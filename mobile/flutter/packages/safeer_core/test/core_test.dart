import 'dart:convert';
import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:safeer_core/safeer_core.dart';

final token = 'TQ${'ab' * 32}';

void main() {
  group('Credential.parse', () {
    test('accepts the server credential, printed numbers and demo codes only', () {
      expect(Credential.parse(token)?.token, token);
      expect(Credential.parse(' tkt-00001107 ')?.ticketNumber, 'TKT-00001107');
      expect(Credential.parse('SAFEER-DEMO:TKT-00001107')?.token, 'SAFEER-DEMO:TKT-00001107');
      expect(Credential.parse('https://example.com'), isNull);
      expect(Credential.parse('TQ1234'), isNull);
      expect(Credential.parse('TKT-12'), isNull);
    });
  });

  group('TicketQr', () {
    test('reads the server geometry without encoding anything', () {
      final qr = TicketQr(demoTicketQrSize, demoTicketQrPath);
      expect(qr.valid, isTrue);
      expect(qr.size, 25);
      // The top-left finder pattern starts with seven dark modules.
      for (var x = 0; x < 7; x++) {
        expect(qr.modules, contains((x, 0)));
      }
      expect(TicketQr(25, 'nonsense').valid, isFalse);
    });
  });

  group('SafeerApi', () {
    test('sends the site origin, keeps the session cookie and CSRF value, and maps errors', () async {
      final seen = <http.Request>[];
      final api = SafeerApi(
        origin: Uri.parse('https://safeer.example'),
        client: MockClient((request) async {
          seen.add(request);
          if (request.url.path == '/api/v1/auth/login') {
            return http.Response(jsonEncode({'data': {'user': {'login': 'd@example.invalid'}, 'csrfToken': 'c' * 64}}), 201,
                headers: {'set-cookie': 'safeer_session=abc123; Path=/api/v1; HttpOnly; SameSite=Strict; Secure'});
          }
          if (request.url.path.endsWith('/board')) return http.Response(jsonEncode({'error': {'code': 'TICKET_WRONG_TRIP', 'message': 'x'}}), 409);
          return http.Response(jsonEncode({'data': {'items': []}}), 200);
        }),
      );
      await api.post('auth/login', {'login': 'd@example.invalid', 'password': 'p'});
      expect(seen.last.headers['Origin'], 'https://safeer.example');
      expect(seen.last.headers['Content-Type'], startsWith('application/json'));
      expect(api.hasSession, isTrue);
      await api.get('driver/trips');
      expect(seen.last.headers['Cookie'], 'safeer_session=abc123');
      expect(seen.last.headers.containsKey('Origin'), isFalse);
      await expectLater(api.post('driver/companies/c/trips/t/board', {'token': token}), throwsA(isA<ApiException>().having((e) => e.code, 'code', 'TICKET_WRONG_TRIP')));
      expect(seen.last.headers['X-CSRF-Token'], 'c' * 64);
      expect(seen.last.headers['Cookie'], 'safeer_session=abc123');
      expect(seen.last.headers.containsKey('Authorization'), isFalse);
    });

    test('treats unreachable servers and lost answers as unknown, not as an answer', () async {
      final down = SafeerApi(origin: Uri.parse('https://safeer.example'), client: MockClient((_) async => throw const SocketException('offline')));
      await expectLater(down.get('public/cities'), throwsA(isA<NetworkException>()));
      final gateway = SafeerApi(origin: Uri.parse('https://safeer.example'), client: MockClient((_) async => http.Response('bad gateway', 502)));
      await expectLater(gateway.get('public/cities'), throwsA(isA<NetworkException>()));
    });

    test('forgets the session after a 401', () async {
      var calls = 0;
      final api = SafeerApi(
        origin: Uri.parse('https://safeer.example'),
        client: MockClient((r) async => ++calls == 1
            ? http.Response(jsonEncode({'data': {'csrfToken': 'd' * 64}}), 201, headers: {'set-cookie': 'safeer_session=s1; Path=/api/v1'})
            : http.Response(jsonEncode({'error': {'code': 'UNAUTHENTICATED'}}), 401)),
      );
      await api.post('auth/login', {});
      await expectLater(api.get('driver/trips'), throwsA(isA<ApiException>()));
      expect(api.hasSession, isFalse);
    });
  });

  group('models', () {
    test('a public trip row gives pickup, seats left and fare', () {
      final d = Departure.fromJson({
        'id': 't1', 'companyNameEn': 'Co', 'companyNameAr': 'شركة', 'fromCode': 'KRT', 'fromNameEn': 'Khartoum', 'fromNameAr': 'الخرطوم',
        'toCode': 'PZU', 'toNameEn': 'Port Sudan', 'toNameAr': 'بورتسودان', 'date': '2026-11-13', 'time': '08:30', 'fareMinor': 4550000, 'currency': 'SDG',
        'seatCount': 44, 'seatsLeft': 3,
        'stops': [
          {'cityNameEn': 'Khartoum', 'cityNameAr': 'الخرطوم', 'stationNameEn': 'Land port', 'stationNameAr': 'الميناء البري', 'offsetMinutes': 0},
        ],
      });
      expect(d.pickup.pick(false), 'Land port');
      expect(d.pickup.pick(true), 'الميناء البري');
      expect(d.seatsLeft, 3);
      expect(SafeerFormat(const Locale('en')).money(d.fareMinor, d.currency), 'SDG 45,500');
      expect(SafeerFormat(const Locale('ar')).money(d.fareMinor, d.currency), '45,500 ج.س.');
    });

    test('the manifest counts each boarded ticket once', () {
      final m = Manifest.fromJson({
        'tripId': 't',
        'boardingOpen': true,
        'passengers': [
          {'ticket': 'TKT-1', 'seat': '1A', 'valid': true, 'boardedAt': '2026-11-12T06:00:00Z'},
          {'ticket': 'TKT-2', 'seat': '1B', 'valid': true},
          {'ticket': 'TKT-3', 'seat': '1C', 'valid': false, 'boardedAt': '2026-11-12T06:00:00Z'},
        ],
      });
      expect(m.expectedCount, 2);
      expect(m.boardedCount, 1);
      final again = m.withPassengers([for (final p in m.passengers) p.ticket == 'TKT-1' ? p.withBoarded(DateTime.now()) : p]);
      expect(again.boardedCount, 1);
    });

    test('an overdue saved hold reads as expired', () {
      final b = Booking({'reference': 'SF-AAAAAAAA', 'status': 'held', 'expiresAt': '2026-01-01T00:00:00Z'});
      expect(b.statusAt(DateTime.utc(2026, 1, 2)), BookingStatus.expired);
      expect(b.openAt(DateTime.utc(2026, 1, 2)), isFalse);
    });

    test('latin digits and isolates for codes', () {
      expect(latinDigits('\u0661\u0662:\u0663\u0660'), '12:30');
      expect(ltr('SF-ABCD2345').runes.first, 0x2066);
    });
  });

  group('TripStore', () {
    test('a saved ticket, with its QR, is still there after the app restarts', () async {
      final disk = MemoryStore();
      final demo = DemoPassengerRepository(latency: Duration.zero);
      await demo.seed(TripStore(disk));
      final reopened = await TripStore(disk).all();
      expect(reopened, hasLength(1));
      final ticket = reopened.single.booking.showable.single;
      expect(ticket.number, 'TKT-00001107');
      expect(ticket.qr!.valid, isTrue);
      expect(reopened.single.key, DemoPassengerRepository.seedKey);
    });
  });

  group('DemoPassengerRepository', () {
    test('refuses the same city, retries are idempotent and taken seats conflict', () async {
      final repo = DemoPassengerRepository(latency: Duration.zero, clock: () => DateTime(2026, 11, 12, 4));
      await expectLater(repo.departures(from: 'KRT', to: 'KRT', date: DateTime(2026, 11, 13)), throwsA(isA<ApiException>()));
      final trips = await repo.departures(from: 'KRT', to: 'PZU', date: DateTime(2026, 11, 13));
      expect(trips, isNotEmpty);
      final map = await repo.seatMap(trips.first.id);
      expect(map.seats.where((s) => s.available).length, trips.first.seatsLeft);
      final seat = map.seats.firstWhere((s) => s.available).label;
      final request = ReservationRequest(tripId: trips.first.id, seats: [seat], key: uuidV4(), mobile: '0912345678', travellers: [Traveller(seat, 'Test Person')]);
      final first = await repo.reserve(request);
      final retry = await repo.reserve(request);
      expect(retry.reference, first.reference);
      final other = ReservationRequest(tripId: trips.first.id, seats: [seat], key: uuidV4(), mobile: '0912345678', travellers: [Traveller(seat, 'Someone Else')]);
      await expectLater(repo.reserve(other), throwsA(isA<ApiException>().having((e) => e.code, 'code', 'SEATS_UNAVAILABLE')));
      expect(await repo.departures(from: 'KSL', to: 'DNG', date: DateTime(2026, 11, 13)), isEmpty);
    });
  });
}
