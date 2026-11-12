// Screenshots for visual review (not a regression test). Run:
//   flutter test tool/screens_test.dart --update-goldens
// PNGs are written to build/screens/ (ignored by Git).
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safeer_core/safeer_core.dart';
import 'package:safeer_passenger/src/app.dart';
import 'package:safeer_passenger/src/ticket_screen.dart';

Future<void> loadFonts() async {
  Future<void> family(String name, List<String> files) async {
    final loader = FontLoader(name);
    for (final f in files) {
      loader.addFont(rootBundle.load(f));
    }
    await loader.load();
  }

  final w = [400, 500, 600, 700];
  await family('packages/safeer_core/Inter', [for (final x in w) 'packages/safeer_core/assets/fonts/Inter-$x.ttf']);
  await family('packages/safeer_core/NotoSansArabic', [for (final x in w) 'packages/safeer_core/assets/fonts/NotoSansArabic-$x.ttf']);
  await family('MaterialIcons', ['fonts/MaterialIcons-Regular.otf']);
}

final vertical = find.byWidgetPredicate((w) => w is Scrollable && (w.axisDirection == AxisDirection.down || w.axisDirection == AxisDirection.up)).first;

void main() {
  setUpAll(() async {
    await prepareSafeerFormats();
    await loadFonts();
  });

  for (final lang in ['en', 'ar']) {
    for (final (w, h, scale, theme) in [(360.0, 640.0, 1.0, ThemeMode.dark), (360.0, 640.0, 1.6, ThemeMode.dark), (320.0, 568.0, 1.0, ThemeMode.light)]) {
      final name = '${lang}_${w.toInt()}x${h.toInt()}_x${scale}_${theme.name}';
      testWidgets('passenger screens $name', (tester) async {
        tester.view.physicalSize = Size(w * 2, h * 2);
        tester.view.devicePixelRatio = 2;
        tester.platformDispatcher.textScaleFactorTestValue = scale;
        addTearDown(tester.view.reset);
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        final s = SafeerStrings(Locale(lang));
        final ar = lang == 'ar';
        final disk = MemoryStore();
        final repo = DemoPassengerRepository(latency: Duration.zero);
        await repo.seed(TripStore(disk));
        final settings = AppSettings(disk)
          ..locale = Locale(lang)
          ..themeMode = theme;
        await tester.pumpWidget(PassengerApp(repository: repo, trips: TripStore(disk), settings: settings, config: SafeerConfig(demo: true, origin: Uri.parse(SafeerConfig.hostedOrigin))));
        await tester.pumpAndSettle();
        await tester.runAsync(() => precacheImage(const AssetImage('assets/coach-journey.jpg'), tester.element(find.byType(Scaffold).first)));
        await tester.pumpAndSettle();
        Future<void> shot(String step) => expectLater(find.byType(MaterialApp), matchesGoldenFile('../build/screens/passenger_${name}_$step.png'));
        Future<void> tap(Finder f) async {
          await tester.scrollUntilVisible(f.hitTestable(), 80, scrollable: vertical);
          await tester.tap(f.hitTestable().first);
          await tester.pumpAndSettle();
        }

        await shot('1_explore');
        await tap(find.byIcon(Icons.place_outlined));
        await tester.tap(find.text(ar ? 'الخرطوم' : 'Khartoum').last);
        await tester.pumpAndSettle();
        await shot('2_same_city');
        await tap(find.byIcon(Icons.place_outlined));
        await tester.tap(find.text(ar ? 'بورتسودان' : 'Port Sudan').last);
        await tester.pumpAndSettle();
        await tap(find.text(s.tomorrow));
        await tap(find.text(s.findDepartures));
        await shot('3_departures');
        await tap(find.text('08:30'));
        await shot('4_seats');
        final tomorrow = DateUtils.dateOnly(DateTime.now()).add(const Duration(days: 1));
        final map = await repo.seatMap('demo-KRT-PZU-${SafeerFormat.isoDay(tomorrow)}-1');
        final free = map.seats.where((x) => x.available && x.label != '3A' && x.label != '3B').first.label;
        await tap(find.text(free));
        await shot('5_seat_selected');
        await tester.tap(find.text(s.continueLabel));
        await tester.pumpAndSettle();
        await shot('6_review');
        await tester.enterText(find.byType(TextFormField).first, 'Test Traveller');
        await tester.enterText(find.byType(TextFormField).last, '0912345678');
        await tester.tap(find.text(s.reserveSeats));
        await tester.pumpAndSettle();
        await shot('7_confirmed');
        await tap(find.text(s.viewMyTrips));
        await shot('8_my_trips');
        final saved = (await TripStore(disk).all()).firstWhere((b) => b.reference == 'SF-DEM2TKT7');
        Navigator.of(tester.element(find.text(s.myTrips).first)).push(MaterialPageRoute<void>(builder: (_) => TicketScreen(saved: saved)));
        await tester.pumpAndSettle();
        await shot('9_ticket');
      });
    }
  }
}

