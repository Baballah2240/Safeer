import 'dart:math';

import '../api/api_client.dart';
import '../demo_qr.dart';
import '../format.dart';
import '../models/passenger.dart';
import 'repository.dart';
import 'trip_store.dart';

/// Labelled sample data (D74). Companies, people and tickets are invented. The app shows a
/// "Demo data" banner whenever this repository is used.
class DemoPassengerRepository implements PassengerRepository {
  DemoPassengerRepository({this.latency = const Duration(milliseconds: 450), DateTime Function()? clock}) : _clock = clock ?? DateTime.now;

  final Duration latency;
  final DateTime Function() _clock;

  /// Settings switch to show offline behaviour without turning off the phone's network.
  bool offline = false;

  static const _cities = [
    ('KRT', 'Khartoum', 'الخرطوم', 'Mina Al Barri land port', 'الميناء البري'),
    ('PZU', 'Port Sudan', 'بورتسودان', 'Port Sudan bus terminal', 'موقف بورتسودان'),
    ('KSL', 'Kassala', 'كسلا', 'Kassala bus terminal', 'موقف كسلا'),
    ('WMD', 'Wad Madani', 'ود مدني', 'Wad Madani bus terminal', 'موقف ود مدني'),
    ('EOB', 'El Obeid', 'الأبيض', 'El Obeid bus terminal', 'موقف الأبيض'),
    ('ATB', 'Atbara', 'عطبرة', 'Atbara bus terminal', 'موقف عطبرة'),
    ('GDF', 'Gedaref', 'القضارف', 'Gedaref bus terminal', 'موقف القضارف'),
    ('DNG', 'Dongola', 'دنقلا', 'Dongola bus terminal', 'موقف دنقلا'),
  ];
  static const _companies = [
    ('Nile Star Coaches (demo)', 'حافلات نجمة النيل (تجريبي)'),
    ('Red Sea Lines (demo)', 'خطوط البحر الأحمر (تجريبي)'),
    ('Savanna Express (demo)', 'سافانا إكسبريس (تجريبي)'),
  ];
  static const _times = ['06:00', '08:30', '13:15', '21:00'];
  static const _hours = {'PZU': 12, 'KSL': 8, 'WMD': 3, 'EOB': 9, 'ATB': 5, 'GDF': 7, 'DNG': 8, 'KRT': 6};
  static const _rows = 11, _columns = 5;
  static const _letters = {1: 'A', 2: 'B', 4: 'C', 5: 'D'};

  final Set<String> _taken = {};
  final Set<String> _contestedDone = {};
  final Map<String, Booking> _byKey = {};

  Future<void> _wait() async {
    if (latency > Duration.zero) await Future<void>.delayed(latency);
    if (offline) throw NetworkException('demo offline');
  }

  (String, String, String, String, String) _city(String code) => _cities.firstWhere((c) => c.$1 == code, orElse: () => _cities.first);

  @override
  bool get isDemo => true;

  @override
  Future<List<City>> cities() async {
    await _wait();
    return [for (final c in _cities) City(code: c.$1, name: Bilingual(c.$2, c.$3))];
  }

  int _hash(String s) => s.codeUnits.fold(7, (h, c) => (h * 31 + c) & 0x7fffffff);

  String _tripId(String from, String to, String day, int slot) => 'demo-$from-$to-$day-$slot';

  bool _occupied(String tripId, String seat) {
    if (_taken.contains('$tripId/$seat')) return true;
    if (tripId.endsWith('-2')) return true; // the 13:15 departure is full
    return _hash('$tripId/$seat') % 10 < 4;
  }

  List<SeatCell> _seats(String tripId) => [
        for (var r = 1; r <= _rows; r++)
          for (final e in _letters.entries)
            SeatCell(label: '$r${e.value}', row: r, column: e.key, available: !_occupied(tripId, '$r${e.value}')),
      ];

  Map<String, Object?> _tripJson(String from, String to, String day, int slot) {
    final a = _city(from), b = _city(to);
    final hours = _hours[to == 'KRT' ? from : to] ?? 6;
    final company = _companies[(slot + _hash(from + to)) % _companies.length];
    final start = _times[slot].split(':').map(int.parse).toList();
    final depart = FormatDay.parse(day).add(Duration(hours: start[0], minutes: start[1]));
    final arrive = depart.add(Duration(hours: hours));
    final id = _tripId(from, to, day, slot);
    return {
      'id': id,
      'companySlug': 'demo-${(slot + _hash(from + to)) % _companies.length}',
      'companyNameEn': company.$1,
      'companyNameAr': company.$2,
      'routeNameEn': '${a.$2} to ${b.$2}',
      'routeNameAr': '${a.$3} إلى ${b.$3}',
      'fromCode': from,
      'fromNameEn': a.$2,
      'fromNameAr': a.$3,
      'toCode': to,
      'toNameEn': b.$2,
      'toNameAr': b.$3,
      'date': day,
      'time': _times[slot],
      'arrivalDate': SafeerFormat.isoDay(arrive),
      'arrivalTime': '${arrive.hour.toString().padLeft(2, '0')}:${arrive.minute.toString().padLeft(2, '0')}',
      'durationMinutes': hours * 60,
      'fareMinor': ((hours * 3500 + 2000) ~/ 500 * 500) * 100,
      'currency': 'SDG',
      'seatCount': _rows * _letters.length,
      'seatsLeft': _seats(id).where((s) => s.available).length,
      'busTypeEn': 'Standard 44-seat coach',
      'busTypeAr': 'حافلة عادية 44 مقعداً',
      'stops': [
        {'cityNameEn': a.$2, 'cityNameAr': a.$3, 'stationNameEn': a.$4, 'stationNameAr': a.$5, 'offsetMinutes': 0},
        {'cityNameEn': b.$2, 'cityNameAr': b.$3, 'stationNameEn': b.$4, 'stationNameAr': b.$5, 'offsetMinutes': hours * 60},
      ],
    };
  }

  @override
  Future<List<Departure>> departures({required String from, required String to, required DateTime date}) async {
    await _wait();
    if (from == to) throw ApiException(400, 'INVALID_INPUT');
    final day = SafeerFormat.isoDay(date);
    // Demo trips start or end in Khartoum; other pairs show the empty state.
    if (from != 'KRT' && to != 'KRT') return [];
    final now = _clock();
    return [
      for (var slot = 0; slot < _times.length; slot++)
        if (FormatDay.parse(day).add(_slotTime(slot)).isAfter(now)) Departure.fromJson(_tripJson(from, to, day, slot)),
    ];
  }

  Duration _slotTime(int slot) {
    final t = _times[slot].split(':').map(int.parse).toList();
    return Duration(hours: t[0], minutes: t[1]);
  }

  (String, String, String, int) _decode(String tripId) {
    final p = tripId.split('-');
    if (p.length != 7 || p[0] != 'demo') throw ApiException(404, 'NOT_FOUND');
    return (p[1], p[2], '${p[3]}-${p[4]}-${p[5]}', int.parse(p[6]));
  }

  @override
  Future<SeatMap> seatMap(String tripId) async {
    await _wait();
    final (from, to, day, slot) = _decode(tripId);
    return SeatMap.fromJson({..._tripJson(from, to, day, slot), 'holdMinutes': 30, 'rows': _rows, 'columns': _columns, 'seats': [
      for (final s in _seats(tripId)) {'label': s.label, 'row': s.row, 'column': s.column, 'available': s.available},
    ]});
  }

  @override
  Future<Booking> reserve(ReservationRequest request) async {
    await _wait();
    final existing = _byKey[request.key];
    if (existing != null) return existing;
    final (from, to, day, slot) = _decode(request.tripId);
    // On the 08:30 departure seats 3A and 3B are taken by "someone else" the first time
    // they are reserved, to show what happens when availability changes.
    if (slot == 1 && !_contestedDone.contains(request.tripId)) {
      final contested = request.seats.where((s) => s == '3A' || s == '3B').toList();
      if (contested.isNotEmpty) {
        _contestedDone.add(request.tripId);
        for (final s in contested) {
          _taken.add('${request.tripId}/$s');
        }
        throw ApiException(409, 'SEATS_UNAVAILABLE');
      }
    }
    if (request.seats.any((s) => _occupied(request.tripId, s))) throw ApiException(409, 'SEATS_UNAVAILABLE');
    for (final s in request.seats) {
      _taken.add('${request.tripId}/$s');
    }
    final trip = _tripJson(from, to, day, slot);
    final now = _clock();
    final booking = Booking({
      ...trip,
      'reference': _reference(),
      'status': 'held',
      'expiresAt': now.add(const Duration(minutes: 30)).toUtc().toIso8601String(),
      'serverNow': now.toUtc().toIso8601String(),
      'holdMinutes': 30,
      'seatCount': request.seats.length,
      'amountMinor': (trip['fareMinor'] as int) * request.seats.length,
      'seats': request.seats,
      'tickets': <Object>[],
      'travelers': [for (final t in request.travellers) t.toJson()],
      'tripId': request.tripId,
      'departureAt': _instant(day, trip['time'] as String),
      'timezone': 'Africa/Khartoum',
      'tripCanceled': false,
    });
    _byKey[request.key] = booking;
    return booking;
  }

  /// Africa/Khartoum is UTC+2 all year.
  String _instant(String day, String time) {
    final t = time.split(':').map(int.parse).toList();
    final d = day.split('-').map(int.parse).toList();
    return DateTime.utc(d[0], d[1], d[2], t[0] - 2, t[1]).toIso8601String();
  }

  String _reference() {
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    final r = Random();
    return 'SF-${List.generate(8, (_) => alphabet[r.nextInt(alphabet.length)]).join()}';
  }

  @override
  Future<Booking> booking(String reference, String key) async {
    await _wait();
    final b = _byKey[key];
    if (b != null && b.reference == reference) return b;
    if (key == seedKey) return seededBooking();
    throw ApiException(404, 'NOT_FOUND');
  }

  static const seedKey = '00000000-0000-4000-8000-0000000d3e01';

  /// A paid demo ticket for tomorrow morning, so My Trips and Show ticket can be tried.
  Booking seededBooking() {
    final tomorrow = _clock().add(const Duration(days: 1));
    final day = SafeerFormat.isoDay(tomorrow);
    final trip = _tripJson('KRT', 'PZU', day, 1);
    return Booking({
      ...trip,
      'reference': 'SF-DEM2TKT7',
      'status': 'confirmed',
      'holdMinutes': 30,
      'seatCount': 1,
      'amountMinor': trip['fareMinor'],
      'seats': ['7C'],
      'tickets': [
        {'number': 'TKT-00001107', 'seat': '7C', 'status': 'valid', 'qr': {'size': demoTicketQrSize, 'path': demoTicketQrPath}},
      ],
      'travelers': [
        {'seat': '7C', 'name': 'Amna Osman'},
      ],
      'departureAt': _instant(day, trip['time'] as String),
      'timezone': 'Africa/Khartoum',
      'tripCanceled': false,
      'demo': true,
    });
  }

  /// Puts the demo ticket on a fresh install, so it can be reopened offline at once.
  Future<void> seed(TripStore store) async {
    if ((await store.all()).isEmpty) await store.save(seedKey, seededBooking());
  }
}

/// Parses YYYY-MM-DD as a local calendar day.
class FormatDay {
  static DateTime parse(String day) => SafeerFormat.calendarDay(day);
}
