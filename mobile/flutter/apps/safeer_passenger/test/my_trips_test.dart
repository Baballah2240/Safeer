import 'package:flutter_test/flutter_test.dart';
import 'package:safeer_core/safeer_core.dart';
import 'package:safeer_passenger/src/my_trips.dart';

void main() {
  test('an offline refresh drops the "up to date" mark and keeps the saved copy', () async {
    final disk = MemoryStore();
    final repo = DemoPassengerRepository(latency: Duration.zero);
    await repo.seed(TripStore(disk));
    final trips = MyTripsController(repo, TripStore(disk));
    await trips.load();
    expect(trips.offline, isFalse);
    expect(trips.isFresh('SF-DEM2TKT7'), isTrue);

    repo.offline = true;
    await trips.refresh();
    expect(trips.offline, isTrue);
    expect(trips.isFresh('SF-DEM2TKT7'), isFalse, reason: 'found on a phone: it still said up to date');
    expect(trips.saved.single.booking.showable.single.qr!.valid, isTrue, reason: 'the saved ticket still opens');

    repo.offline = false;
    await trips.refresh();
    expect(trips.isFresh('SF-DEM2TKT7'), isTrue);
  });

  test('demo bookings made before an app restart are still found (seen on a phone)', () async {
    final disk = MemoryStore();
    final before = DemoPassengerRepository(latency: Duration.zero, clock: () => DateTime(2026, 11, 12, 4));
    final trip = (await before.departures(from: 'KRT', to: 'PZU', date: DateTime(2026, 11, 13))).first;
    final seat = (await before.seatMap(trip.id)).seats.firstWhere((s) => s.available && s.label != '3A' && s.label != '3B').label;
    final key = uuidV4();
    final made = await before.reserve(ReservationRequest(tripId: trip.id, seats: [seat], key: key, mobile: '0912345678', travellers: [Traveller(seat, 'Test Person')]));
    await TripStore(disk).save(key, made);

    final after = DemoPassengerRepository(latency: Duration.zero, remember: TripStore(disk));
    final trips = MyTripsController(after, TripStore(disk));
    await trips.load();
    expect(trips.saved.single.gone, isFalse);
    expect(trips.isFresh(made.reference), isTrue);
  });
}
