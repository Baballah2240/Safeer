import 'passenger.dart' show Bilingual;

String _s(Object? v) => v is String ? v : (v == null ? '' : '$v');
DateTime? _d(Object? v) => v is String ? DateTime.tryParse(v) : null;
List<Map<String, Object?>> _list(Object? v) =>
    v is List ? v.whereType<Map>().map((m) => m.cast<String, Object?>()).toList() : const [];

/// GET /driver/trips item (safeer.driver_trips).
class DriverTrip {
  const DriverTrip({
    required this.id,
    required this.companyId,
    required this.company,
    required this.route,
    required this.timezone,
    required this.departureAt,
    required this.arrivalAt,
    required this.status,
    required this.bus,
    required this.journey,
  });
  final String id, companyId, timezone, status, bus, journey;
  final Bilingual company, route;
  final DateTime departureAt, arrivalAt;

  bool get finished => journey == 'arrived' || status == 'canceled';

  factory DriverTrip.fromJson(Map<String, Object?> j) => DriverTrip(
        id: _s(j['id']),
        companyId: _s(j['companyId']),
        company: Bilingual(_s(j['companyEn']), _s(j['companyAr'])),
        route: Bilingual(_s(j['routeEn']), _s(j['routeAr'])),
        timezone: _s(j['timezone']),
        departureAt: _d(j['departureAt']) ?? DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
        arrivalAt: _d(j['arrivalAt']) ?? DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
        status: _s(j['status']),
        bus: _s(j['bus']),
        journey: _s(j['journey']).isEmpty ? 'scheduled' : _s(j['journey']),
      );
}

class ManifestPassenger {
  const ManifestPassenger({required this.ticket, required this.bookingReference, required this.seat, required this.name, required this.valid, required this.boardedAt});
  final String ticket, bookingReference, seat;
  final String? name;
  final bool valid;
  final DateTime? boardedAt;
  bool get boarded => boardedAt != null;

  ManifestPassenger withBoarded(DateTime at) =>
      ManifestPassenger(ticket: ticket, bookingReference: bookingReference, seat: seat, name: name, valid: valid, boardedAt: boardedAt ?? at);

  factory ManifestPassenger.fromJson(Map<String, Object?> j) => ManifestPassenger(
        ticket: _s(j['ticket']),
        bookingReference: _s(j['bookingReference']),
        seat: _s(j['seat']),
        name: j['name'] is String && (j['name'] as String).isNotEmpty ? j['name'] as String : null,
        valid: j['valid'] == true,
        boardedAt: _d(j['boardedAt']),
      );
}

/// GET /driver/companies/:cid/trips/:tid (safeer.driver_manifest).
class Manifest {
  const Manifest({required this.tripId, required this.boardingOpen, required this.timezone, required this.stops, required this.passengers, required this.departureAt});
  final String tripId, timezone;
  final bool boardingOpen;
  final DateTime? departureAt;
  final List<Bilingual> stops;
  final List<ManifestPassenger> passengers;

  Bilingual? get boardingPoint => stops.isEmpty ? null : stops.first;
  Iterable<ManifestPassenger> get expected => passengers.where((p) => p.valid);
  int get expectedCount => expected.length;

  /// Derived from the set of tickets with a boarding record, so the same ticket can
  /// never be counted twice.
  int get boardedCount => expected.where((p) => p.boarded).length;

  Manifest withPassengers(List<ManifestPassenger> list) =>
      Manifest(tripId: tripId, boardingOpen: boardingOpen, timezone: timezone, stops: stops, passengers: list, departureAt: departureAt);

  factory Manifest.fromJson(Map<String, Object?> j) => Manifest(
        tripId: _s(j['tripId']),
        boardingOpen: j['boardingOpen'] == true,
        timezone: _s(j['timezone']),
        departureAt: _d(j['departureAt']),
        stops: _list(j['stops']).map((s) => Bilingual(_s(s['nameEn']), _s(s['nameAr']))).toList(),
        passengers: _list(j['passengers']).map(ManifestPassenger.fromJson).toList(),
      );
}

/// What a scanned or typed code is. Only the server decides whether it is valid.
class Credential {
  const Credential._(this.token, this.ticketNumber);
  const Credential.token(String value) : this._(value, null);
  const Credential.number(String value) : this._(null, value);
  final String? token, ticketNumber;

  bool get isNumber => ticketNumber != null;
  String get value => token ?? ticketNumber!;
  Map<String, Object?> toJson() => token != null ? {'token': token} : {'ticketNumber': ticketNumber};

  static final _token = RegExp(r'^TQ[0-9a-f]{64}$');
  static final _number = RegExp(r'^TKT-[0-9]{8,12}$');
  static const demoPrefix = 'SAFEER-DEMO:';

  /// Printed QR codes carry the opaque TQ credential; the printed ticket number can be
  /// typed or scanned from a barcode. Demo codes are recognised only by the demo data.
  static Credential? parse(String raw) {
    final value = raw.trim();
    if (_token.hasMatch(value)) return Credential.token(value);
    final upper = value.toUpperCase();
    if (_number.hasMatch(upper)) return Credential.number(upper);
    if (value.startsWith(demoPrefix) && _number.hasMatch(value.substring(demoPrefix.length))) return Credential.token(value);
    return null;
  }

  static Map<String, Object?>? decode(Object? json) => json is Map ? json.cast<String, Object?>() : null;
  static Credential? fromJson(Map<String, Object?>? j) {
    if (j == null) return null;
    if (j['token'] is String) return Credential.token(j['token'] as String);
    if (j['ticketNumber'] is String) return Credential.number(j['ticketNumber'] as String);
    return null;
  }

  @override
  bool operator ==(Object other) => other is Credential && other.token == token && other.ticketNumber == ticketNumber;
  @override
  int get hashCode => Object.hash(token, ticketNumber);
}

enum ScanStatus { boarded, verified, alreadyBoarded, wrongTrip, invalid, notSafeer, boardingClosed, pending, failed }

class ScanResult {
  const ScanResult(this.status, {this.ticket, this.seat, this.name, this.boardedAt, this.credential, this.code});
  final ScanStatus status;
  final String? ticket, seat, name, code;
  final DateTime? boardedAt;
  final Credential? credential;

  /// The server's verify/board reply: {ticket, seat, name, boardedAt, alreadyBoarded}.
  factory ScanResult.fromReply(Map<String, Object?> j, {required bool board, Credential? credential}) => ScanResult(
        j['alreadyBoarded'] == true ? ScanStatus.alreadyBoarded : (board ? ScanStatus.boarded : ScanStatus.verified),
        ticket: j['ticket'] as String?,
        seat: j['seat'] as String?,
        name: j['name'] as String?,
        boardedAt: _d(j['boardedAt']),
        credential: credential,
      );
}
