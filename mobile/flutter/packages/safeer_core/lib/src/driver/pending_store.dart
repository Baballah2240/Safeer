import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../models/driver.dart';
import '../storage.dart';

/// A scan that could not reach the server. It is never counted as boarded; the server's
/// answer replaces it when the connection returns (D74).
class PendingScan {
  const PendingScan({required this.tripId, required this.companyId, required this.credential, required this.scannedAt});
  final String tripId, companyId;
  final Credential credential;
  final DateTime scannedAt;

  Map<String, Object?> toJson() => {'tripId': tripId, 'companyId': companyId, 'credential': credential.toJson(), 'scannedAt': scannedAt.toUtc().toIso8601String()};

  static PendingScan? fromJson(Object? j) {
    if (j is! Map) return null;
    final m = j.cast<String, Object?>();
    final c = Credential.fromJson(Credential.decode(m['credential']));
    final at = DateTime.tryParse('${m['scannedAt']}');
    if (c == null || at == null || m['tripId'] is! String || m['companyId'] is! String) return null;
    return PendingScan(tripId: m['tripId'] as String, companyId: m['companyId'] as String, credential: c, scannedAt: at.toLocal());
  }
}

/// Saved in the app's private storage so pending scans survive a restart. It holds only
/// opaque ticket codes, no passenger names.
class PendingScans extends ChangeNotifier {
  PendingScans(this._store);
  final KeyValueStore _store;
  static const _key = 'safeer.driver.pending.v1';
  List<PendingScan> _items = [];
  bool _loaded = false;

  List<PendingScan> get items => List.unmodifiable(_items);
  List<PendingScan> forTrip(String tripId) => _items.where((p) => p.tripId == tripId).toList();

  Future<void> load() async {
    if (_loaded) return;
    final raw = await _store.read(_key);
    if (raw != null) {
      try {
        final list = jsonDecode(raw);
        if (list is List) _items = list.map(PendingScan.fromJson).whereType<PendingScan>().toList();
      } on FormatException {
        _items = [];
      }
    }
    _loaded = true;
    notifyListeners();
  }

  /// Returns false when the same ticket is already waiting for this trip.
  Future<bool> add(PendingScan scan) async {
    await load();
    if (_items.any((p) => p.tripId == scan.tripId && p.credential == scan.credential)) return false;
    _items = [..._items, scan];
    notifyListeners();
    await _save();
    return true;
  }

  Future<void> remove(PendingScan scan) async {
    _items = _items.where((p) => !(p.tripId == scan.tripId && p.credential == scan.credential)).toList();
    notifyListeners();
    await _save();
  }

  Future<void> _save() => _store.write(_key, jsonEncode(_items.map((p) => p.toJson()).toList()));
}
