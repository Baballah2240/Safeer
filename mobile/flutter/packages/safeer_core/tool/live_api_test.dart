// Runs the real API clients against a disposable local Safeer server (fictional data).
// Not part of `flutter test`; run with a config written by a disposable server harness:
//   SAFEER_LIVE_CONFIG=<file> flutter test tool/live_api_test.dart
// Never point this at the hosted site: it creates holds and boarding records.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safeer_core/safeer_core.dart';

late Map<String, dynamic> cfg;

void main() {
  setUpAll(() {
    HttpOverrides.global = null;
    final path = Platform.environment['SAFEER_LIVE_CONFIG'];
    if (path == null) fail('Set SAFEER_LIVE_CONFIG to the harness config file.');
    cfg = jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;
    final origin = Uri.parse(cfg['origin'] as String);
    if (origin.host != '127.0.0.1') fail('Live tests run only against a local disposable server.');
  });

  SafeerApi api() => SafeerApi(origin: Uri.parse(cfg['origin'] as String));

  group('passenger, live API', () {
    test('cities, departures and the seat map come back in the shapes the app reads', () async {
      final repo = LivePassengerRepository(api());
      final cities = await repo.cities();
      expect(cities.map((c) => c.code), containsAll([cfg['from'], cfg['to']]));
      final day = SafeerFormat.calendarDay(cfg['date'] as String);
      final list = await repo.departures(from: cfg['from'] as String, to: cfg['to'] as String, date: day);
      final d = list.firstWhere((x) => x.id == cfg['trip1']);
      expect(d.fareMinor, 150000);
      expect(SafeerFormat(const Locale('en')).money(d.fareMinor, d.currency), '${d.currency == 'SDG' ? 'SDG ' : '${d.currency} '}1,500');
      expect(d.seatCount, 12);
      expect(d.seatsLeft, 11, reason: 'seat 1 is paid');
      expect(d.pickup.pick(false), isNotEmpty);
      expect(d.time, matches(RegExp(r'^\d\d:\d\d$')));
      final map = await repo.seatMap(d.id);
      expect(map.seats, hasLength(12));
      expect(map.seats.firstWhere((s) => s.label == '1').available, isFalse);
      expect(map.holdMinutes, 30);
      expect(map.rows * map.columns, greaterThanOrEqualTo(12));
    });

    test('a reservation is held once per key; a second key for the same seat conflicts', () async {
      final repo = LivePassengerRepository(api());
      final key = uuidV4();
      final request = ReservationRequest(tripId: cfg['trip1'] as String, seats: const ['2'], key: key, mobile: '0912345678', travellers: const [Traveller('2', 'Flutter Live Test')]);
      final first = await repo.reserve(request);
      expect(first.status, BookingStatus.held);
      expect(first.reference, matches(RegExp(r'^SF-[2-9A-HJ-NP-Z]{8}$')));
      expect(first.expiresAt, isNotNull);
      expect(first.seats, ['2']);
      expect(first.showable, isEmpty, reason: 'no QR before payment');
      final retry = await repo.reserve(request);
      expect(retry.reference, first.reference);
      final other = ReservationRequest(tripId: cfg['trip1'] as String, seats: const ['2'], key: uuidV4(), mobile: '0912345678', travellers: const [Traveller('2', 'Someone Else')]);
      await expectLater(repo.reserve(other), throwsA(isA<ApiException>().having((e) => e.status, 'status', 409)));
      final reopened = await repo.booking(first.reference, key);
      expect(reopened.status, BookingStatus.held);
      await expectLater(repo.booking(first.reference, uuidV4()), throwsA(isA<ApiException>().having((e) => e.status, 'status', 404)));
    });

    test('a paid ticket opened with its key carries server QR geometry, saved for offline use', () async {
      final repo = LivePassengerRepository(api());
      final paid = cfg['paid1'] as Map<String, dynamic>;
      final b = await repo.booking(paid['reference'] as String, paid['key'] as String);
      expect(b.status, BookingStatus.confirmed);
      final t = b.showable.single;
      expect(t.number, paid['ticket']);
      expect(t.qr!.valid, isTrue);
      expect(b.boardingPoint.pick(false), isNotEmpty);
      final disk = MemoryStore();
      await TripStore(disk).save(paid['key'] as String, b);
      final again = (await TripStore(disk).all()).single.booking.showable.single;
      expect(again.qr!.modules.length, t.qr!.modules.length);
    });
  });

  group('driver, live API', () {
    test('sign-in, trips, manifest and server-decided boarding', () async {
      final a = api();
      final repo = LiveDriverRepository(a);
      final d = cfg['driver'] as Map<String, dynamic>;
      await expectLater(repo.signIn(d['email'] as String, 'wrong password'), throwsA(isA<ApiException>().having((e) => e.code, 'code', 'INVALID_CREDENTIALS')));
      final account = await repo.signIn(d['email'] as String, d['password'] as String);
      expect(account.email, d['email']);
      final trips = await repo.trips();
      final trip = trips.firstWhere((t) => t.id == cfg['trip1']);
      expect(trips.map((t) => t.id), contains(cfg['trip2']));
      expect(trip.bus, 'REG B1');
      expect(trip.timezone, 'Africa/Khartoum');
      var m = await repo.manifest(trip);
      expect(m.boardingOpen, isTrue);
      expect(m.expectedCount, 1);
      expect(m.boardedCount, 0);
      expect(m.boardingPoint, isNotNull);

      final p1 = cfg['paid1'] as Map<String, dynamic>, p2 = cfg['paid2'] as Map<String, dynamic>;
      final own = Credential.parse(p1['token'] as String)!;
      final checked = await repo.verify(trip, Credential.parse(p1['ticket'] as String)!);
      expect(checked.status, ScanStatus.verified);
      expect((await repo.manifest(trip)).boardedCount, 0, reason: 'checking does not board');
      final boarded = await repo.board(trip, own);
      expect(boarded.status, ScanStatus.boarded);
      expect(boarded.seat, '1');
      final again = await repo.board(trip, own);
      expect(again.status, ScanStatus.alreadyBoarded);
      await expectLater(repo.board(trip, Credential.parse(p2['token'] as String)!), throwsA(isA<ApiException>().having((e) => e.code, 'code', 'TICKET_WRONG_TRIP')));
      await expectLater(repo.verify(trip, Credential.parse(p2['ticket'] as String)!), throwsA(isA<ApiException>().having((e) => e.code, 'code', 'TICKET_INVALID')));
      m = await repo.manifest(trip);
      expect(m.boardedCount, 1, reason: 'one ticket, boarded once');

      await repo.signOut();
      expect(a.hasSession, isFalse);
      await expectLater(repo.trips(), throwsA(isA<ApiException>().having((e) => e.status, 'status', 401)));
    });

    test('an unreachable server is reported as unknown, not as an answer', () async {
      final dead = SafeerApi(origin: Uri.parse('http://127.0.0.1:9'), timeout: const Duration(seconds: 3));
      await expectLater(LiveDriverRepository(dead).trips(), throwsA(isA<NetworkException>()));
    });
  });
}
