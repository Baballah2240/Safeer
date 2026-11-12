import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safeer_core/safeer_core.dart';
import 'package:safeer_driver/src/app.dart';
import 'package:safeer_driver/src/session.dart';

const demo = Credential.demoPrefix;

/// Small phone layouts in English and Arabic, at normal and large text sizes.
const layouts = [(360.0, 640.0, 1.0), (320.0, 568.0, 1.0), (360.0, 640.0, 1.6)];

void main() {
  setUpAll(prepareSafeerFormats);

  for (final lang in ['en', 'ar']) {
    for (final (w, h, scale) in layouts) {
      testWidgets('driver flow: $lang, ${w.toInt()}x${h.toInt()}, text x$scale', (tester) async {
        tester.view.physicalSize = Size(w * 3, h * 3);
        tester.view.devicePixelRatio = 3;
        tester.platformDispatcher.textScaleFactorTestValue = scale;
        addTearDown(tester.view.reset);
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

        final s = SafeerStrings(Locale(lang));
        final disk = MemoryStore();
        final settings = AppSettings(disk)..locale = Locale(lang);
        final session = DriverSession(repository: DemoDriverRepository(latency: Duration.zero), pending: PendingScans(disk), syncEvery: Duration.zero);
        ValueChanged<String>? camera;
        await tester.pumpWidget(DriverApp(
          session: session,
          settings: settings,
          config: SafeerConfig(demo: true, origin: Uri.parse(SafeerConfig.hostedOrigin)),
          camera: (context, onCode) {
            camera = onCode;
            return const ColoredBox(color: Colors.black);
          },
        ));
        await tester.pumpAndSettle();
        expect(find.text(s.signInTitle), findsOneWidget);
        expect(Directionality.of(tester.element(find.text(s.signInTitle))), lang == 'ar' ? TextDirection.rtl : TextDirection.ltr);

        await tester.scrollUntilVisible(find.text(s.demoSignIn).hitTestable(), 120, scrollable: find.byType(Scrollable).first);
        await tester.tap(find.text(s.demoSignIn));
        await tester.pumpAndSettle();

        // Today's Trips: the active assignment first, with coach and boarded count.
        expect(find.text(s.activeAssignment), findsOneWidget);
        expect(find.text(lang == 'ar' ? 'الخرطوم إلى بورتسودان' : 'Khartoum to Port Sudan'), findsOneWidget);
        expect(find.text('SD-KH 4521'), findsOneWidget);
        expect(find.text(s.boardedOf(7, 23)), findsOneWidget);

        await tester.tap(find.text(s.scanTicket));
        await tester.pumpAndSettle();
        expect(find.text(s.aimAtQr), findsOneWidget);

        Future<void> scan(String code) async {
          camera!(code);
          await tester.pumpAndSettle();
        }

        Future<void> next() async {
          await tester.ensureVisible(find.text(s.scanNext));
          await tester.tap(find.text(s.scanNext));
          await tester.pumpAndSettle();
        }

        await scan('$demo${DemoDriverRepository.sampleValid}');
        expect(find.text(s.resBoarded), findsOneWidget);
        expect(find.textContaining(s.boardedOf(8, 23)), findsOneWidget);

        // While the result is shown, more reads of the same ticket are ignored.
        await scan('$demo${DemoDriverRepository.sampleValid}');
        expect(find.text(s.resBoarded), findsOneWidget);

        await next();
        await scan('$demo${DemoDriverRepository.sampleValid}');
        expect(find.text(s.resAlready), findsOneWidget);
        expect(find.textContaining(s.boardedOf(8, 23)), findsOneWidget);

        await next();
        await scan('$demo${DemoDriverRepository.sampleWrongTrip}');
        expect(find.text(s.resWrongTrip), findsOneWidget);
        expect(find.textContaining(s.boardedOf(8, 23)), findsOneWidget);

        await next();
        await scan('$demo${DemoDriverRepository.sampleRefunded}');
        expect(find.text(s.resInvalid), findsOneWidget);

        // Offline: pending verification, not counted.
        (session.repository as DemoDriverRepository).offline = true;
        await next();
        await scan('$demo${DemoDriverRepository.passengerDemoTicket}');
        expect(find.text(s.resPending), findsOneWidget);
        expect(find.textContaining(s.boardedOf(8, 23)), findsOneWidget);
        (session.repository as DemoDriverRepository).offline = false;
        await next();

        await tester.tap(find.byType(BackButtonIcon));
        await tester.pumpAndSettle();
        await tester.scrollUntilVisible(find.text(s.retryNow).hitTestable(), 60, scrollable: find.byType(Scrollable).first);
        expect(find.text(s.pendingCount(1)), findsOneWidget);
        await tester.tap(find.text(s.retryNow));
        await tester.pumpAndSettle();
        expect(find.text(s.pendingCount(1)), findsNothing);
        tester.state<ScrollableState>(find.byType(Scrollable).first).position.jumpTo(0);
        await tester.pumpAndSettle();
        expect(find.text(s.boardedOf(9, 23)), findsOneWidget);

        // Passenger list: totals and lookup by name or ticket reference.
        await tester.tap(find.text(s.passengers));
        await tester.pumpAndSettle();
        await tester.enterText(find.byType(TextField), 'amna');
        await tester.pumpAndSettle();
        await tester.scrollUntilVisible(find.text('Amna Osman').hitTestable(), 80, scrollable: find.byType(Scrollable).first);
        expect(find.text('Amna Osman'), findsWidgets);
        expect(find.text('Mohamed Ahmed'), findsNothing);
        tester.state<ScrollableState>(find.byType(Scrollable).first).position.jumpTo(0);
        await tester.pumpAndSettle();
        await tester.enterText(find.byType(TextField), 'TKT-00001110');
        await tester.pumpAndSettle();
        await tester.scrollUntilVisible(find.textContaining('TKT-00001110').hitTestable(), 80, scrollable: find.byType(Scrollable).first);
        expect(find.textContaining('TKT-00001110'), findsOneWidget);
        expect(find.text('Mohamed Ahmed'), findsNothing);
      });
    }
  }
}
