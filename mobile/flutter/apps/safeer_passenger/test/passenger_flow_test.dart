import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safeer_core/safeer_core.dart';
import 'package:safeer_passenger/src/app.dart';

/// Small phone layouts in English and Arabic, at normal and large text sizes.
const layouts = [(360.0, 640.0, 1.0), (320.0, 568.0, 1.0), (360.0, 640.0, 1.6)];

void useLayout(WidgetTester tester, double w, double h, double scale) {
  tester.view.physicalSize = Size(w * 3, h * 3);
  tester.view.devicePixelRatio = 3;
  tester.platformDispatcher.textScaleFactorTestValue = scale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
}

/// The first vertical scrollable (the ticket screen also has a horizontal pager).
final vertical = find.byWidgetPredicate((w) => w is Scrollable && (w.axisDirection == AxisDirection.down || w.axisDirection == AxisDirection.up)).first;

/// Brings a widget on screen: directly when it is already built, otherwise by scrolling.
Future<void> reveal(WidgetTester tester, Finder finder) async {
  if (finder.evaluate().isNotEmpty) {
    await tester.ensureVisible(finder.first);
    await tester.pumpAndSettle();
  }
  if (finder.hitTestable().evaluate().isEmpty) await tester.scrollUntilVisible(finder.hitTestable(), 80, scrollable: vertical);
}

Future<void> tapVisible(WidgetTester tester, Finder finder) async {
  await reveal(tester, finder);
  await tester.tap(finder.hitTestable().first);
  await tester.pumpAndSettle();
}

final config = SafeerConfig(demo: true, origin: Uri.parse(SafeerConfig.hostedOrigin));

void main() {
  setUpAll(prepareSafeerFormats);

  for (final lang in ['en', 'ar']) {
    final ar = lang == 'ar';
    for (final (w, h, scale) in layouts) {
      final name = '$lang, ${w.toInt()}x${h.toInt()}, text x$scale';

      testWidgets('booking flow: $name', (tester) async {
        useLayout(tester, w, h, scale);
        final s = SafeerStrings(Locale(lang));
        final disk = MemoryStore();
        final repo = DemoPassengerRepository(latency: Duration.zero);
        await tester.pumpWidget(PassengerApp(repository: repo, trips: TripStore(disk), settings: AppSettings(disk)..locale = Locale(lang), config: config));
        await tester.pumpAndSettle();
        expect(find.text(s.heroTitle), findsOneWidget);
        expect(Directionality.of(tester.element(find.text(s.heroTitle))), ar ? TextDirection.rtl : TextDirection.ltr);

        // Departure and destination must differ.
        await tapVisible(tester, find.text(s.chooseCity));
        await tester.tap(find.text(ar ? 'الخرطوم' : 'Khartoum').last);
        await tester.pumpAndSettle();
        expect(find.text(s.sameCity), findsOneWidget);
        await tapVisible(tester, find.byIcon(Icons.place_outlined));
        await tester.tap(find.text(ar ? 'بورتسودان' : 'Port Sudan').last);
        await tester.pumpAndSettle();
        expect(find.text(s.sameCity), findsNothing);

        await tapVisible(tester, find.text(s.tomorrow));
        await tapVisible(tester, find.text(s.findDepartures));

        // Departures: route and date stay visible; each card shows time, operator, pickup, seats and fare.
        expect(find.text(s.departures), findsOneWidget);
        expect(find.text(s.change), findsOneWidget);
        await reveal(tester, find.textContaining(ar ? 'الميناء البري' : 'Mina Al Barri land port'));
        expect(find.textContaining(ar ? 'الميناء البري' : 'Mina Al Barri land port'), findsWidgets);
        expect(find.textContaining(ar ? 'ج.س.' : 'SDG'), findsWidgets);
        await tapVisible(tester, find.text('06:00'));

        // Seat map with legend; choose the first free seat.
        await reveal(tester, find.text(s.seatTaken));
        expect(find.text(s.seatAvailable), findsOneWidget);
        expect(find.text(s.seatTaken), findsOneWidget);
        final tomorrow = DateUtils.dateOnly(DateTime.now()).add(const Duration(days: 1));
        final map = await repo.seatMap('demo-KRT-PZU-${SafeerFormat.isoDay(tomorrow)}-0');
        final seat = map.seats.firstWhere((x) => x.available).label;
        await tapVisible(tester, find.text(seat));
        await tester.tap(find.text(s.continueLabel));
        await tester.pumpAndSettle();

        // Review: fare, seat and boarding point before confirming.
        expect(find.text(s.review), findsOneWidget);
        expect(find.textContaining(s.total), findsWidgets);
        await tester.ensureVisible(find.byType(TextFormField).first);
        await tester.enterText(find.byType(TextFormField).first, 'Test Traveller');
        await tester.ensureVisible(find.byType(TextFormField).last);
        await tester.enterText(find.byType(TextFormField).last, '0912345678');
        await tester.pumpAndSettle();
        await tester.tap(find.text(s.reserveSeats));
        await tester.pumpAndSettle();

        expect(find.text(s.reserved), findsWidgets);
        final booking = (await TripStore(disk).all()).single.booking;
        await reveal(tester, find.text(booking.reference));
        expect(find.text(booking.reference), findsOneWidget);
        expect(booking.seats, [seat]);

        await tapVisible(tester, find.text(s.viewMyTrips));
        expect(find.text(booking.reference), findsWidgets);
      });

      testWidgets('saved ticket reopens offline after a restart: $name', (tester) async {
        useLayout(tester, w, h, scale);
        final s = SafeerStrings(Locale(lang));
        final disk = MemoryStore();
        // Earlier session: the paid ticket was saved on this phone.
        await DemoPassengerRepository(latency: Duration.zero).seed(TripStore(disk));
        // Now the app starts again with no connection.
        final offline = DemoPassengerRepository(latency: Duration.zero)..offline = true;
        await tester.pumpWidget(PassengerApp(repository: offline, trips: TripStore(disk), settings: AppSettings(disk)..locale = Locale(lang), config: config, initialTab: 1));
        await tester.pumpAndSettle();

        expect(find.text(s.nextDepartureLabel), findsOneWidget);
        expect(find.text(s.offline), findsOneWidget);
        expect(find.textContaining(ar ? 'نسخة محفوظة' : 'Saved copy'), findsOneWidget);
        await tapVisible(tester, find.text(s.showTicket));

        expect(find.byType(QrView), findsOneWidget);
        expect(find.text('TKT-00001107'), findsOneWidget);
        expect(find.text('SF-DEM2TKT7'), findsOneWidget);
        expect(find.text('7C'), findsOneWidget);
        expect(find.text(s.demoTicket), findsOneWidget);
        await reveal(tester, find.text(ar ? 'الميناء البري' : 'Mina Al Barri land port'));
        expect(find.textContaining(ar ? 'نسخة محفوظة' : 'Saved copy'), findsWidgets);
      });
    }
  }
}
