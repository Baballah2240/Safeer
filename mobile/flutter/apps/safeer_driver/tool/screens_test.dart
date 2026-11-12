// Screenshots for visual review (not a regression test). Run:
//   flutter test tool/screens_test.dart --update-goldens
// PNGs are written to build/screens/ (ignored by Git).
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safeer_core/safeer_core.dart';
import 'package:safeer_driver/src/app.dart';
import 'package:safeer_driver/src/session.dart';

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

void main() {
  setUpAll(() async {
    await prepareSafeerFormats();
    await loadFonts();
  });

  for (final lang in ['en', 'ar']) {
    for (final (w, h, scale, theme) in [(360.0, 640.0, 1.0, ThemeMode.dark), (360.0, 640.0, 1.6, ThemeMode.dark), (320.0, 568.0, 1.0, ThemeMode.light)]) {
      final name = '${lang}_${w.toInt()}x${h.toInt()}_x${scale}_${theme.name}';
      testWidgets('driver screens $name', (tester) async {
        tester.view.physicalSize = Size(w * 2, h * 2);
        tester.view.devicePixelRatio = 2;
        tester.platformDispatcher.textScaleFactorTestValue = scale;
        addTearDown(tester.view.reset);
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        final disk = MemoryStore();
        final settings = AppSettings(disk)
          ..locale = Locale(lang)
          ..themeMode = theme;
        final repo = DemoDriverRepository(latency: Duration.zero);
        final session = DriverSession(repository: repo, pending: PendingScans(disk), syncEvery: Duration.zero);
        ValueChanged<String>? camera;
        await tester.pumpWidget(DriverApp(
          session: session,
          settings: settings,
          config: SafeerConfig(demo: true, origin: Uri.parse(SafeerConfig.hostedOrigin)),
          camera: (context, onCode) {
            camera = onCode;
            return const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(colors: [Color(0xFF3A4A5A), Color(0xFF1A2026)])));
          },
        ));
        await tester.pumpAndSettle();
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('../build/screens/driver_${name}_1_signin.png'));

        await tester.runAsync(() => session.signIn('demo', 'demo'));
        await tester.pumpAndSettle();
        await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
        await tester.pumpAndSettle();
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('../build/screens/driver_${name}_2_today.png'));

        final s = SafeerStrings(Locale(lang));
        await tester.tap(find.text(s.scanTicket));
        await tester.pumpAndSettle();
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('../build/screens/driver_${name}_3_scanner.png'));
        camera!('${Credential.demoPrefix}${DemoDriverRepository.sampleValid}');
        await tester.pumpAndSettle();
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('../build/screens/driver_${name}_4_valid.png'));
        await tester.tap(find.text(s.scanNext));
        await tester.pumpAndSettle();
        camera!('${Credential.demoPrefix}${DemoDriverRepository.sampleWrongTrip}');
        await tester.pumpAndSettle();
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('../build/screens/driver_${name}_5_wrongtrip.png'));
        await tester.tap(find.text(s.scanNext));
        await tester.pumpAndSettle();
        repo.offline = true;
        camera!('${Credential.demoPrefix}${DemoDriverRepository.passengerDemoTicket}');
        await tester.pumpAndSettle();
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('../build/screens/driver_${name}_6_pending.png'));
        repo.offline = false;
        Navigator.of(tester.element(find.text(s.scanNext))).pop();
        await tester.pumpAndSettle();
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('../build/screens/driver_${name}_7_today_pending.png'));
        await tester.tap(find.text(s.passengers));
        await tester.pumpAndSettle();
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('../build/screens/driver_${name}_8_passengers.png'));
      });
    }
  }
}
