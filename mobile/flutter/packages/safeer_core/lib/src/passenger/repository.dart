import '../api/api_client.dart';
import '../models/passenger.dart';

/// Everything the Passenger app needs from Safeer. LivePassengerRepository uses the
/// existing public API; DemoPassengerRepository supplies labelled sample data.
abstract class PassengerRepository {
  bool get isDemo;
  Future<List<City>> cities();
  Future<List<Departure>> departures({required String from, required String to, required DateTime date});
  Future<SeatMap> seatMap(String tripId);

  /// Holds the seats for the company's deadline. Retrying with the same [ReservationRequest.key]
  /// returns the same booking instead of a second one (server idempotency).
  Future<Booking> reserve(ReservationRequest request);

  /// Opens a booking with this phone's key; paid tickets then include their QR geometry.
  Future<Booking> booking(String reference, String key);
}

class LivePassengerRepository implements PassengerRepository {
  LivePassengerRepository(this.api);
  final SafeerApi api;

  @override
  bool get isDemo => false;

  List<Map<String, Object?>> _items(Object? data) =>
      data is Map && data['items'] is List ? (data['items'] as List).whereType<Map>().map((m) => m.cast<String, Object?>()).toList() : const [];

  @override
  Future<List<City>> cities() async => _items(await api.get('public/cities')).map(City.fromJson).toList();

  @override
  Future<List<Departure>> departures({required String from, required String to, required DateTime date}) async {
    final day = '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    final rows = _items(await api.get('public/trips', query: {'from': from, 'to': to, 'date': day}));
    return rows.map(Departure.fromJson).toList()..sort((a, b) => a.time.compareTo(b.time));
  }

  @override
  Future<SeatMap> seatMap(String tripId) async => SeatMap.fromJson((await api.get('public/trips/${Uri.encodeComponent(tripId)}') as Map).cast());

  @override
  Future<Booking> reserve(ReservationRequest request) async => Booking((await api.post('public/holds', request.toJson()) as Map).cast());

  @override
  Future<Booking> booking(String reference, String key) async =>
      Booking((await api.get('public/holds/${Uri.encodeComponent(reference)}', headers: {'X-Booking-Key': key}) as Map).cast());
}
