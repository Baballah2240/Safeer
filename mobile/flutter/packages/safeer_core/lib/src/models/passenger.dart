import 'qr.dart';

String _s(Object? v) => v is String ? v : (v == null ? '' : '$v');
String? _sn(Object? v) => v is String && v.isNotEmpty ? v : null;
int _i(Object? v) => v is int ? v : (v is num ? v.toInt() : int.tryParse('$v') ?? 0);
DateTime? _d(Object? v) => v is String ? DateTime.tryParse(v) : null;
List<Map<String, Object?>> _list(Object? v) =>
    v is List ? v.whereType<Map>().map((m) => m.cast<String, Object?>()).toList() : const [];

/// Text available in English and Arabic from the API (nameEn/nameAr and so on).
class Bilingual {
  const Bilingual(this.en, this.ar);
  final String en, ar;
  String pick(bool arabic) => arabic ? (ar.isEmpty ? en : ar) : (en.isEmpty ? ar : en);
  factory Bilingual.from(Map<String, Object?> json, String key) => Bilingual(_s(json['${key}En']), _s(json['${key}Ar']));
}

class City {
  const City({required this.code, required this.name});
  final String code;
  final Bilingual name;
  factory City.fromJson(Map<String, Object?> j) => City(code: _s(j['code']), name: Bilingual.from(j, 'name'));
  @override
  bool operator ==(Object other) => other is City && other.code == code;
  @override
  int get hashCode => code.hashCode;
}

class TripStop {
  const TripStop({required this.city, required this.station, required this.offsetMinutes});
  final Bilingual city;
  final Bilingual? station;
  final int offsetMinutes;
  Bilingual get place => station ?? city;
  factory TripStop.fromJson(Map<String, Object?> j) {
    final station = Bilingual(_s(j['stationNameEn']), _s(j['stationNameAr']));
    return TripStop(
      city: Bilingual.from(j, 'cityName'),
      station: station.en.isEmpty && station.ar.isEmpty ? null : station,
      offsetMinutes: _i(j['offsetMinutes']),
    );
  }
}

/// One published trip from GET /public/trips (safeer.public_trip_rows).
class Departure {
  const Departure({
    required this.id,
    required this.company,
    required this.route,
    required this.fromCode,
    required this.fromName,
    required this.toCode,
    required this.toName,
    required this.date,
    required this.time,
    required this.arrivalDate,
    required this.arrivalTime,
    required this.durationMinutes,
    required this.fareMinor,
    required this.currency,
    required this.seatCount,
    required this.seatsLeft,
    required this.busType,
    required this.stops,
  });

  final String id, fromCode, toCode, date, time, arrivalDate, arrivalTime, currency;
  final Bilingual company, route, fromName, toName, busType;
  final int durationMinutes, fareMinor, seatCount, seatsLeft;
  final List<TripStop> stops;

  /// Pickup is the first stop's station, or its city when the company has no station.
  Bilingual get pickup => stops.isEmpty ? fromName : stops.first.place;

  factory Departure.fromJson(Map<String, Object?> j) => Departure(
        id: _s(j['id']),
        company: Bilingual.from(j, 'companyName'),
        route: Bilingual.from(j, 'routeName'),
        fromCode: _s(j['fromCode']),
        fromName: Bilingual.from(j, 'fromName'),
        toCode: _s(j['toCode']),
        toName: Bilingual.from(j, 'toName'),
        date: _s(j['date']),
        time: _s(j['time']),
        arrivalDate: _s(j['arrivalDate']),
        arrivalTime: _s(j['arrivalTime']),
        durationMinutes: _i(j['durationMinutes']),
        fareMinor: _i(j['fareMinor']),
        currency: _s(j['currency']).isEmpty ? 'SDG' : _s(j['currency']),
        seatCount: _i(j['seatCount']),
        seatsLeft: j.containsKey('seatsLeft') ? _i(j['seatsLeft']) : _i(j['seatCount']),
        busType: Bilingual.from(j, 'busType'),
        stops: _list(j['stops']).map(TripStop.fromJson).toList(),
      );
}

class SeatCell {
  const SeatCell({required this.label, required this.row, required this.column, required this.available});
  final String label;
  final int row, column;
  final bool available;
  factory SeatCell.fromJson(Map<String, Object?> j) =>
      SeatCell(label: _s(j['label']), row: _i(j['row']), column: _i(j['column']), available: j['available'] == true);
}

/// GET /public/trips/:id: the trip plus its live seat map.
class SeatMap {
  const SeatMap({required this.trip, required this.rows, required this.columns, required this.holdMinutes, required this.seats});
  final Departure trip;
  final int rows, columns, holdMinutes;
  final List<SeatCell> seats;
  factory SeatMap.fromJson(Map<String, Object?> j) => SeatMap(
        trip: Departure.fromJson(j),
        rows: _i(j['rows']),
        columns: _i(j['columns']),
        holdMinutes: _i(j['holdMinutes']),
        seats: _list(j['seats']).map(SeatCell.fromJson).toList(),
      );
}

class Traveller {
  const Traveller(this.seat, this.name);
  final String seat, name;
  Map<String, Object?> toJson() => {'seat': seat, 'name': name};
}

class ReservationRequest {
  const ReservationRequest({required this.tripId, required this.seats, required this.key, required this.mobile, required this.travellers});
  final String tripId, key, mobile;
  final List<String> seats;
  final List<Traveller> travellers;
  Map<String, Object?> toJson() => {
        'tripId': tripId,
        'seats': seats,
        'key': key,
        'mobile': mobile,
        'travelers': travellers.map((t) => t.toJson()).toList(),
      };
}

class PassengerTicket {
  const PassengerTicket({required this.number, required this.seat, required this.status, this.qr});
  final String number, seat, status;
  final TicketQr? qr;
  factory PassengerTicket.fromJson(Map<String, Object?> j) => PassengerTicket(
        number: _s(j['number']),
        seat: _s(j['seat']),
        status: _s(j['status']),
        qr: j['qr'] is Map ? TicketQr.fromJson((j['qr'] as Map).cast<String, Object?>()) : null,
      );
}

enum BookingStatus { held, confirmed, expired, released, refunded, unknown }

/// The passenger booking presentation (safeer.passenger_booking + booking_view). The raw
/// JSON is kept so the saved copy on the phone is exactly what the server sent.
class Booking {
  Booking(this.json)
      : reference = _s(json['reference']),
        status = switch (_s(json['status'])) {
          'held' => BookingStatus.held,
          'confirmed' => BookingStatus.confirmed,
          'expired' => BookingStatus.expired,
          'released' => BookingStatus.released,
          'refunded' => BookingStatus.refunded,
          _ => BookingStatus.unknown,
        },
        tripCanceled = json['tripCanceled'] == true,
        expiresAt = _d(json['expiresAt']),
        departureAt = _d(json['departureAt']),
        timezone = _sn(json['timezone']),
        date = _s(json['date']),
        time = _s(json['time']),
        fareMinor = _i(json['fareMinor']),
        amountMinor = _i(json['amountMinor']),
        currency = _s(json['currency']).isEmpty ? 'SDG' : _s(json['currency']),
        seats = json['seats'] is List ? (json['seats'] as List).map(_s).toList() : const [],
        company = Bilingual.from(json, 'companyName'),
        route = Bilingual.from(json, 'routeName'),
        fromName = Bilingual.from(json, 'fromName'),
        toName = Bilingual.from(json, 'toName'),
        stops = _list(json['stops']).map(TripStop.fromJson).toList(),
        tickets = _list(json['tickets']).map(PassengerTicket.fromJson).toList(),
        travellers = {
          for (final t in _list(json['travelers'])) _s(t['seat']): _s(t['name']),
        };

  final Map<String, Object?> json;
  final String reference, date, time, currency;
  final BookingStatus status;
  final bool tripCanceled;
  final DateTime? expiresAt, departureAt;
  final String? timezone;
  final int fareMinor, amountMinor;
  final List<String> seats;
  final Bilingual company, route, fromName, toName;
  final List<TripStop> stops;
  final List<PassengerTicket> tickets;
  final Map<String, String> travellers;

  Bilingual get boardingPoint => stops.isEmpty ? fromName : stops.first.place;
  List<PassengerTicket> get showable => tickets.where((t) => t.qr != null && t.status == 'valid').toList();
  /// A saved copy can be older than its hold deadline; treat an overdue hold as expired.
  BookingStatus statusAt(DateTime now) =>
      status == BookingStatus.held && expiresAt != null && expiresAt!.isBefore(now) ? BookingStatus.expired : status;

  bool openAt(DateTime now) => !tripCanceled && (statusAt(now) == BookingStatus.held || statusAt(now) == BookingStatus.confirmed);

  /// Local departure for sorting and display: the company-local date and time strings.
  DateTime get localDeparture {
    if (date.isNotEmpty && time.contains(':')) {
      final d = date.split('-').map(int.parse).toList();
      final t = time.split(':').map(int.parse).toList();
      return DateTime(d[0], d[1], d[2], t[0], t[1]);
    }
    return departureAt?.toLocal() ?? DateTime(2000);
  }

  bool isUpcoming(DateTime now) => openAt(now) && (departureAt ?? localDeparture).isAfter(now.subtract(const Duration(hours: 2)));
}
