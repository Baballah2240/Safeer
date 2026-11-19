import 'dart:async';
import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:safeer_core/safeer_core.dart';

import 'boarding_controller.dart';

/// Signed-in driver, assigned trips and one boarding controller per trip. Pending scans are
/// retried every [syncEvery], when the app returns to the foreground and on refresh.
class DriverSession extends ChangeNotifier with WidgetsBindingObserver {
  DriverSession({required this.repository, required this.pending, this.syncEvery = const Duration(seconds: 15), DateTime Function()? clock, this.lock, KeyValueStore? vault})
      : _clock = clock ?? DateTime.now,
        _vault = vault ?? MemoryStore() {
    final l = lock;
    if (l != null) {
      l.onTooManyFailures = forgetAccount;
      l.addListener(_lockChanged);
    }
  }

  /// D125: the app lock opens this account. While the lock is on, the sign-in details are
  /// kept encrypted in [_vault] (Android Keystore), so after the PIN or fingerprint the app
  /// signs in again by itself, also when the server session (12 h, 30 min idle) has ended.
  /// Signing out, turning the lock off or ten wrong PINs remove them.
  final AppLock? lock;
  final KeyValueStore _vault;
  static const _vaultKey = 'safeer.driver.account';
  String? _password;
  bool restoring = false;

  /// The account the lock opens, if one is saved.
  String? savedEmail;

  bool get _lockOn => lock?.enabled ?? false;

  Future<({String email, String password})?> _saved() async {
    final raw = await _vault.read(_vaultKey);
    if (raw == null) return null;
    try {
      final m = jsonDecode(raw) as Map;
      return (email: m['e'] as String, password: m['p'] as String);
    } catch (_) {
      await _vault.delete(_vaultKey);
      return null;
    }
  }

  Future<void> _save(String email, String password) async {
    savedEmail = email;
    await _vault.write(_vaultKey, jsonEncode({'e': email, 'p': password}));
  }

  Future<void> _forget() async {
    savedEmail = null;
    await _vault.delete(_vaultKey);
  }

  /// At start: remembers which account the lock opens; drops saved details without a lock.
  Future<void> load() async {
    final saved = await _saved();
    if (saved != null && !_lockOn) {
      await _forget();
    } else {
      savedEmail = saved?.email;
    }
    notifyListeners();
    _lockChanged();
  }

  // Unlocked with a saved account and nobody signed in: sign in with the saved details.
  // The lock turned on while signed in: save them; turned off: remove them.
  void _lockChanged() {
    final l = lock;
    if (l == null) return;
    if (!l.enabled) {
      _password = null;
      if (savedEmail != null) _forget();
      return;
    }
    if (account != null && _password != null && savedEmail != account!.email) {
      _save(account!.email, _password!);
      return;
    }
    if (!l.locked && account == null && savedEmail != null && !restoring) restore();
  }

  /// Signs in with the saved details after the lock was opened. A refused password (for
  /// example changed on the website) removes them, so the password is asked again.
  Future<bool> restore() async {
    if (restoring || !_lockOn || (lock?.locked ?? false)) return false;
    restoring = true;
    notifyListeners();
    try {
      final saved = await _saved();
      if (saved == null) return false;
      await signIn(saved.email, saved.password);
      return true;
    } on ApiException catch (e) {
      if (e.status == 400 || e.status == 401 || e.status == 403) await _forget();
      return false;
    } catch (_) {
      return false;
    } finally {
      restoring = false;
      notifyListeners();
    }
  }

  /// Ten wrong PINs: sign out, remove the saved account and the lock that belonged to it.
  Future<void> forgetAccount() async {
    await signOut();
    await lock?.turnOff();
  }

  final DriverRepository repository;
  final PendingScans pending;
  final Duration syncEvery;
  final DateTime Function() _clock;

  DriverAccount? account;
  List<DriverTrip> trips = [];
  bool loadingTrips = false, sessionExpired = false;
  Object? tripsError;
  String? selectedTripId;
  final Map<String, BoardingController> _controllers = {};
  Timer? _timer;
  bool _observing = false;

  DateTime now() => _clock();

  Future<void> signIn(String email, String password) async {
    account = await repository.signIn(email, password);
    sessionExpired = false;
    _password = password;
    if (_lockOn) {
      if (savedEmail != null && savedEmail != account!.email) {
        // Another driver on this phone: the lock belonged to the previous account.
        await _forget();
        await lock?.turnOff();
      } else {
        await _save(account!.email, password);
      }
    }
    await pending.load();
    if (!_observing) {
      WidgetsBinding.instance.addObserver(this);
      _observing = true;
    }
    _timer?.cancel();
    if (syncEvery > Duration.zero) _timer = Timer.periodic(syncEvery, (_) => syncAll());
    notifyListeners();
    await loadTrips();
  }

  Future<void> loadTrips() async {
    loadingTrips = true;
    notifyListeners();
    try {
      trips = await repository.trips();
      tripsError = null;
      for (final t in trips) {
        _controllers[t.id]?.trip = t;
      }
    } on ApiException catch (e) {
      tripsError = e;
      if (e.status == 401) _expire();
    } catch (e) {
      tripsError = e;
    } finally {
      loadingTrips = false;
      notifyListeners();
    }
    await syncAll();
  }

  /// The current assignment: the chosen trip, otherwise the next one not yet arrived.
  DriverTrip? get active {
    if (selectedTripId != null) {
      for (final t in trips) {
        if (t.id == selectedTripId) return t;
      }
    }
    final now = _clock().toUtc();
    final open = trips.where((t) => !t.finished && t.arrivalAt.isAfter(now)).toList()..sort((a, b) => a.departureAt.compareTo(b.departureAt));
    return open.isEmpty ? (trips.isEmpty ? null : trips.first) : open.first;
  }

  void select(DriverTrip trip) {
    selectedTripId = trip.id;
    notifyListeners();
  }

  BoardingController controllerFor(DriverTrip trip) =>
      _controllers.putIfAbsent(trip.id, () {
        final c = BoardingController(repository: repository, trip: trip, pending: pending, onSessionLost: _expire, clock: _clock);
        // Screens ask for controllers while building; load after this frame starts.
        Future.microtask(c.load);
        return c;
      });

  int get pendingTotal => pending.items.length;

  Future<void> syncAll() async {
    if (account == null) return;
    for (final t in trips) {
      if (pending.forTrip(t.id).isNotEmpty) await controllerFor(t).syncPending();
    }
    notifyListeners();
  }

  void _expire() {
    if (account == null) return;
    account = null;
    sessionExpired = true;
    _stop();
    notifyListeners();
    // Still unlocked: sign in again quietly with the saved details.
    if (savedEmail != null && _lockOn && !(lock?.locked ?? true)) {
      restore().then((ok) {
        if (ok) sessionExpired = false;
      });
    }
  }

  Future<void> signOut() async {
    try {
      await repository.signOut();
    } catch (_) {
      // Signing out locally still succeeds; the server session times out by itself.
    }
    account = null;
    sessionExpired = false;
    _password = null;
    await _forget();
    _stop();
    notifyListeners();
  }

  void _stop() {
    _timer?.cancel();
    _timer = null;
    for (final c in _controllers.values) {
      c.dispose();
    }
    _controllers.clear();
    trips = [];
    selectedTripId = null;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(syncAll());
  }

  @override
  void dispose() {
    if (_observing) WidgetsBinding.instance.removeObserver(this);
    _stop();
    super.dispose();
  }
}
