import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:safeer_core/safeer_core.dart';

/// Scan handling for one assigned trip.
///
/// * The server decides every result; this class only reports it.
/// * The boarded count comes from the passenger list (tickets with a boarding record), so a
///   repeated or retried scan can never raise it.
/// * Camera reads are ignored while a scan is being processed, and the same code is ignored
///   for [cooldown] afterwards, so one ticket in front of the camera is sent once.
/// * When the server cannot be reached the scan becomes "pending verification": saved on the
///   phone, not counted, and sent again when the connection returns.
class BoardingController extends ChangeNotifier {
  BoardingController({required this.repository, required this.trip, required this.pending, this.onSessionLost, this.cooldown = const Duration(seconds: 3), DateTime Function()? clock})
      : _clock = clock ?? DateTime.now;

  final DriverRepository repository;
  final PendingScans pending;
  final VoidCallback? onSessionLost;
  final Duration cooldown;
  final DateTime Function() _clock;
  DriverTrip trip;

  Manifest? manifest;
  Object? loadError;
  bool loading = false, processing = false;
  ScanResult? last;

  /// Pending scans the server has since answered, newest first.
  final List<ScanResult> settled = [];
  String? _lastRaw;
  DateTime? _lastAt;
  bool _syncing = false, _disposed = false;

  int get boardedCount => manifest?.boardedCount ?? 0;
  int get expectedCount => manifest?.expectedCount ?? 0;
  List<PendingScan> get waiting => pending.forTrip(trip.id);

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  Future<void> load() async {
    loading = true;
    _notify();
    try {
      manifest = await repository.manifest(trip);
      loadError = null;
    } on ApiException catch (e) {
      loadError = e;
      if (e.status == 401) onSessionLost?.call();
    } catch (e) {
      loadError = e;
    } finally {
      loading = false;
      _notify();
    }
  }

  /// A code read by the camera. Returns null when the read is suppressed.
  Future<ScanResult?> scan(String raw) async {
    if (processing) return null;
    final now = _clock();
    final value = raw.trim();
    if (value == _lastRaw && _lastAt != null && now.difference(_lastAt!) < cooldown) return null;
    _lastRaw = value;
    _lastAt = now;
    final credential = Credential.parse(value);
    if (credential == null) return _show(const ScanResult(ScanStatus.notSafeer));
    return _send(credential, board: true);
  }

  /// Lets the same ticket be read again at once (the driver pressed "Scan next").
  void resetCooldown() {
    _lastRaw = null;
    _lastAt = null;
    last = null;
    _notify();
  }

  /// A typed ticket number: checked first, boarded only when the driver confirms.
  Future<ScanResult?> check(String number) async {
    if (processing) return null;
    final credential = Credential.parse(number.trim());
    if (credential == null || !credential.isNumber) return _show(const ScanResult(ScanStatus.notSafeer));
    return _send(credential, board: false);
  }

  Future<ScanResult?> boardChecked(Credential credential) async => processing ? null : _send(credential, board: true);

  ScanResult _show(ScanResult r) {
    last = r;
    _notify();
    return r;
  }

  Future<ScanResult> _send(Credential credential, {required bool board}) async {
    processing = true;
    last = null;
    _notify();
    try {
      final r = board ? await repository.board(trip, credential) : await repository.verify(trip, credential);
      if (board) _applyBoarding(r);
      return _show(r);
    } on NetworkException {
      // Unknown outcome: keep it, never count it (D74).
      await pending.add(PendingScan(tripId: trip.id, companyId: trip.companyId, credential: credential, scannedAt: _clock()));
      return _show(ScanResult(ScanStatus.pending, credential: credential, ticket: credential.ticketNumber));
    } on ApiException catch (e) {
      if (e.status == 401) onSessionLost?.call();
      return _show(_fromError(e, credential));
    } finally {
      processing = false;
      _notify();
    }
  }

  static ScanResult _fromError(ApiException e, Credential c) => switch (e.code) {
        'TICKET_WRONG_TRIP' => ScanResult(ScanStatus.wrongTrip, credential: c, code: e.code),
        'TICKET_INVALID' || 'INVALID_INPUT' => ScanResult(ScanStatus.invalid, credential: c, ticket: c.ticketNumber, code: e.code),
        'BOARDING_CLOSED' => ScanResult(ScanStatus.boardingClosed, credential: c, code: e.code),
        _ => ScanResult(ScanStatus.failed, credential: c, code: e.code),
      };

  /// Marks the ticket boarded in the local list (once), then reloads the server's list.
  void _applyBoarding(ScanResult r) {
    final m = manifest;
    if (r.status != ScanStatus.boarded && r.status != ScanStatus.alreadyBoarded) return;
    if (m == null || r.ticket == null) {
      unawaited(load());
      return;
    }
    final at = r.boardedAt ?? _clock();
    var found = false;
    final list = <ManifestPassenger>[];
    for (final p in m.passengers) {
      if (p.ticket == r.ticket) {
        found = true;
        list.add(p.withBoarded(at));
      } else {
        list.add(p);
      }
    }
    manifest = m.withPassengers(list);
    if (!found || r.status == ScanStatus.boarded) unawaited(load());
  }

  /// Sends waiting scans again. Stops at the first network failure.
  Future<int> syncPending() async {
    if (_syncing) return 0;
    _syncing = true;
    var done = 0;
    try {
      for (final p in waiting) {
        try {
          var r = await repository.board(trip, p.credential);
          // A lost reply may have boarded it already: a boarding at or after this scan is ours.
          if (r.status == ScanStatus.alreadyBoarded && r.boardedAt != null && !r.boardedAt!.isBefore(p.scannedAt.subtract(const Duration(minutes: 1)))) {
            r = ScanResult(ScanStatus.boarded, ticket: r.ticket, seat: r.seat, name: r.name, boardedAt: r.boardedAt, credential: r.credential);
          }
          await pending.remove(p);
          _applyBoarding(r);
          settled.insert(0, r);
          done++;
        } on NetworkException {
          break;
        } on ApiException catch (e) {
          if (e.status == 401 || e.status == 403 || e.status == 429 || e.status >= 500) {
            if (e.status == 401) onSessionLost?.call();
            break;
          }
          await pending.remove(p);
          settled.insert(0, _fromError(e, p.credential));
          done++;
        }
      }
    } finally {
      _syncing = false;
      _notify();
    }
    if (done > 0) unawaited(load());
    return done;
  }
}
