import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:safeer_core/safeer_core.dart';

import 'boarding_controller.dart';

/// Signed-in driver, assigned trips and one boarding controller per trip. Pending scans are
/// retried every [syncEvery], when the app returns to the foreground and on refresh.
class DriverSession extends ChangeNotifier with WidgetsBindingObserver {
  DriverSession({required this.repository, required this.pending, this.syncEvery = const Duration(seconds: 15), DateTime Function()? clock}) : _clock = clock ?? DateTime.now;

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
  }

  Future<void> signOut() async {
    try {
      await repository.signOut();
    } catch (_) {
      // Signing out locally still succeeds; the server session times out by itself.
    }
    account = null;
    sessionExpired = false;
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
