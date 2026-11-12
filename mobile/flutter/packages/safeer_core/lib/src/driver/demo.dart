import '../api/api_client.dart';
import '../models/driver.dart';
import '../models/passenger.dart' show Bilingual;
import 'repository.dart';

/// Labelled sample trips and passengers (D74). It follows the server's boarding rules:
/// tickets for another trip, refunded tickets and closed boarding are refused, and a
/// second boarding of the same ticket reports alreadyBoarded.
class DemoDriverRepository implements DriverRepository {
  DemoDriverRepository({this.latency = const Duration(milliseconds: 400), DateTime Function()? clock}) : _clock = clock ?? DateTime.now {
    final now = _clock().toUtc();
    _trips = [
      _trip('demo-trip-1', 'Khartoum to Port Sudan', 'الخرطوم إلى بورتسودان', now.add(const Duration(minutes: 45)), 12, 'SD-KH 4521'),
      _trip('demo-trip-2', 'Khartoum to Wad Madani', 'الخرطوم إلى ود مدني', now.add(const Duration(hours: 5)), 3, 'SD-KH 3307'),
      _trip('demo-trip-3', 'Port Sudan to Khartoum', 'بورتسودان إلى الخرطوم', now.add(const Duration(hours: 30)), 12, 'SD-PS 1180'),
    ];
    const names = [
      'Mohamed Ahmed', 'فاطمة الطيب', 'Osman Ali', 'آمنة إبراهيم', 'Khalid Hassan', 'Sara Abdelrahman', 'Amna Osman', 'Hiba Yousif',
      'Ibrahim Musa', 'نور الهدى صالح', 'Ahmed Babiker', 'Mariam Elnour', 'Yasir Omer', 'سلمى حامد', 'Tariq Adam', 'Rania Mahmoud',
      'Hassan Idris', 'محمد عثمان', 'Abdalla Kamal', 'هالة النور', 'Mustafa Siddig', 'Nada Fadul', 'Omer Bashir', 'Samia Gaafar',
    ];
    const letters = ['A', 'B', 'C', 'D'];
    _passengers['demo-trip-1'] = [
      for (var i = 0; i < 24; i++)
        _Seat(
          ticket: 'TKT-0000${1101 + i}',
          reference: 'SF-PZU${_alpha[i]}4K72',
          seat: i == 6 ? '7C' : '${i ~/ 4 + 1}${letters[i % 4]}',
          name: i == 21 ? null : names[i],
          valid: i != 23,
          boardedAt: i < 8 && i != 6 ? now.subtract(Duration(minutes: 30 - i)) : null,
        ),
    ];
    _passengers['demo-trip-2'] = [
      for (var i = 0; i < 10; i++)
        _Seat(ticket: 'TKT-0000${2001 + i}', reference: 'SF-WMD${_alpha[i]}5H82', seat: '${i ~/ 4 + 1}${letters[i % 4]}', name: names[23 - i], valid: true, boardedAt: null),
    ];
    _passengers['demo-trip-3'] = [];
  }

  static const _alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  final Duration latency;
  final DateTime Function() _clock;
  late final List<DriverTrip> _trips;
  final Map<String, List<_Seat>> _passengers = {};
  bool _signedIn = false;

  /// Settings switch to show pending verification without turning off the network.
  bool offline = false;

  /// Ticket numbers for trying the scanner by hand, with what the demo server answers.
  static const sampleValid = 'TKT-00001109', sampleAlready = 'TKT-00001101', sampleWrongTrip = 'TKT-00002001', sampleRefunded = 'TKT-00001124';

  /// The passenger demo ticket (SAFEER-DEMO:TKT-00001107, seat 7C) belongs to demo-trip-1.
  static const passengerDemoTicket = 'TKT-00001107';

  static DriverTrip _trip(String id, String en, String ar, DateTime departure, int hours, String bus) => DriverTrip(
        id: id,
        companyId: 'demo-company',
        company: const _Name('Nile Star Coaches (demo)', 'حافلات نجمة النيل (تجريبي)').bilingual,
        route: _Name(en, ar).bilingual,
        timezone: 'Africa/Khartoum',
        departureAt: departure,
        arrivalAt: departure.add(Duration(hours: hours)),
        status: 'published',
        bus: bus,
        journey: 'scheduled',
      );

  Future<void> _wait() async {
    if (latency > Duration.zero) await Future<void>.delayed(latency);
    if (offline) throw NetworkException('demo offline');
  }

  void _session() {
    if (!_signedIn) throw ApiException(401, 'UNAUTHENTICATED');
  }

  @override
  bool get isDemo => true;

  @override
  Future<DriverAccount> signIn(String email, String password) async {
    await _wait();
    if (email.trim().isEmpty || password.isEmpty) throw ApiException(400, 'INVALID_INPUT');
    _signedIn = true;
    return const DriverAccount(name: 'Demo driver', email: 'demo.driver@example.invalid');
  }

  @override
  Future<void> signOut() async => _signedIn = false;

  @override
  Future<List<DriverTrip>> trips() async {
    await _wait();
    _session();
    return List.of(_trips);
  }

  bool _open(DriverTrip t) {
    final now = _clock().toUtc();
    return t.departureAt.subtract(const Duration(hours: 24)).isBefore(now) && t.arrivalAt.isAfter(now);
  }

  @override
  Future<Manifest> manifest(DriverTrip trip) async {
    await _wait();
    _session();
    final t = _trips.firstWhere((x) => x.id == trip.id, orElse: () => throw ApiException(404, 'NOT_FOUND'));
    final stops = switch (t.id) {
      'demo-trip-1' => const [_Name('Mina Al Barri land port', 'الميناء البري'), _Name('Port Sudan bus terminal', 'موقف بورتسودان')],
      'demo-trip-2' => const [_Name('Mina Al Barri land port', 'الميناء البري'), _Name('Wad Madani bus terminal', 'موقف ود مدني')],
      _ => const [_Name('Port Sudan bus terminal', 'موقف بورتسودان'), _Name('Mina Al Barri land port', 'الميناء البري')],
    };
    return Manifest(
      tripId: t.id,
      boardingOpen: _open(t),
      timezone: t.timezone,
      departureAt: t.departureAt,
      stops: [for (final s in stops) s.bilingual],
      passengers: [for (final p in _passengers[t.id]!) p.view],
    );
  }

  String? _number(Credential c) {
    if (c.ticketNumber != null) return c.ticketNumber;
    final token = c.token!;
    return token.startsWith(Credential.demoPrefix) ? token.substring(Credential.demoPrefix.length) : null;
  }

  Future<ScanResult> _check(DriverTrip trip, Credential credential, {required bool board}) async {
    await _wait();
    _session();
    final t = _trips.firstWhere((x) => x.id == trip.id, orElse: () => throw ApiException(403, 'FORBIDDEN'));
    final number = _number(credential);
    final here = _passengers[t.id]!.where((p) => p.ticket == number).firstOrNull;
    if (here == null) {
      final elsewhere = _passengers.entries.any((e) => e.key != t.id && e.value.any((p) => p.ticket == number));
      // Like the server: a QR code for another trip says so; a typed number does not.
      if (elsewhere && !credential.isNumber) throw ApiException(409, 'TICKET_WRONG_TRIP');
      if (elsewhere && credential.isNumber) throw ApiException(409, 'TICKET_INVALID');
      throw ApiException(409, 'TICKET_INVALID');
    }
    if (!here.valid) throw ApiException(409, 'TICKET_INVALID');
    if (!_open(t)) throw ApiException(409, 'BOARDING_CLOSED');
    final was = here.boardedAt != null;
    if (board && !was) here.boardedAt = _clock().toUtc();
    return ScanResult.fromReply({
      'ticket': here.ticket,
      'seat': here.seat,
      'name': here.name,
      'boardedAt': here.boardedAt?.toIso8601String(),
      'alreadyBoarded': was,
    }, board: board, credential: credential);
  }

  @override
  Future<ScanResult> verify(DriverTrip trip, Credential credential) => _check(trip, credential, board: false);

  @override
  Future<ScanResult> board(DriverTrip trip, Credential credential) => _check(trip, credential, board: true);
}

class _Name {
  const _Name(this.en, this.ar);
  final String en, ar;
  Bilingual get bilingual => Bilingual(en, ar);
}

class _Seat {
  _Seat({required this.ticket, required this.reference, required this.seat, required this.name, required this.valid, required this.boardedAt});
  final String ticket, reference, seat;
  final String? name;
  final bool valid;
  DateTime? boardedAt;
  ManifestPassenger get view => ManifestPassenger(ticket: ticket, bookingReference: reference, seat: seat, name: name, valid: valid, boardedAt: boardedAt);
}
