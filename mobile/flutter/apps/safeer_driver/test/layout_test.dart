import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safeer_core/safeer_core.dart';
import 'package:safeer_driver/src/app.dart';
import 'package:safeer_driver/src/journey_screen.dart';
import 'package:safeer_driver/src/passengers_screen.dart';
import 'package:safeer_driver/src/scanner_screen.dart';
import 'package:safeer_driver/src/session.dart';
import 'package:safeer_driver/src/settings_screen.dart';

/// Every screen on small, large and folding phones, tablets and landscape, at large text sizes,
/// with and without the on-screen keyboard. A layout overflow fails the test.
const devices = [(320.0, 568.0, 1.0), (360.0, 640.0, 1.6), (412.0, 915.0, 2.0), (673.0, 841.0, 1.0), (800.0, 1280.0, 1.3), (1280.0, 800.0, 1.0), (740.0, 360.0, 1.0), (568.0, 320.0, 1.3)];
/// Typical keyboard height: about 300 in portrait, about half the screen in landscape.
double keyboardFor(double h) => h < 500 ? h * 0.5 : 300.0;

void main() {
  setUpAll(prepareSafeerFormats);
  for (final lang in ['en', 'ar']) {
    for (final (w, h, scale) in devices) {
      testWidgets('driver screens fit: $lang ${w.toInt()}x${h.toInt()} text x$scale', (tester) async {
        tester.view.physicalSize = Size(w * 2, h * 2);
        tester.view.devicePixelRatio = 2;
        tester.platformDispatcher.textScaleFactorTestValue = scale;
        addTearDown(tester.view.reset);
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        Future<void> typing(bool on) async {
          tester.view.viewInsets = on ? FakeViewPadding(bottom: keyboardFor(h) * 2) : FakeViewPadding.zero;
          await tester.pumpAndSettle();
        }

        final disk = MemoryStore();
        final session = DriverSession(
          repository: DemoDriverRepository(latency: Duration.zero),
          pending: PendingScans(disk),
          syncEvery: Duration.zero,
        );
        await tester.pumpWidget(
          DriverApp(
            session: session,
            settings: AppSettings(disk)..locale = Locale(lang),
            config: SafeerConfig(demo: true, origin: Uri.parse(SafeerConfig.hostedOrigin)),
            camera: (context, onCode) => const ColoredBox(color: Colors.black),
          ),
        );
        await tester.pumpAndSettle();
        final s = SafeerStrings(Locale(lang));

        // Sign in, keyboard open on the password field: the button stays reachable.
        await tester.ensureVisible(find.byType(TextField).last);
        await tester.pumpAndSettle();
        await tester.tap(find.byType(TextField).last);
        await typing(true);
        await tester.ensureVisible(find.text(s.signIn));
        await tester.pumpAndSettle();
        expect(find.text(s.signIn).hitTestable(), findsOneWidget, reason: 'sign-in button reachable above the keyboard');
        await typing(false);

        await session.signIn('demo.driver@example.invalid', 'demo');
        await tester.pumpAndSettle();
        expect(find.text(s.activeAssignment), findsOneWidget);

        final trip = session.trips.first;
        final c = session.controllerFor(trip);
        await tester.pumpAndSettle();
        final nav = tester.state<NavigatorState>(find.byType(Navigator).first);
        Future<void> open(Widget screen) async {
          nav.push(MaterialPageRoute<void>(builder: (_) => screen));
          await tester.pumpAndSettle();
        }

        Future<void> back() async {
          nav.pop();
          await tester.pumpAndSettle();
        }

        await open(PassengersScreen(trip: trip, controller: c));
        await tester.scrollUntilVisible(find.byType(TextField), 60, scrollable: find.byType(Scrollable).first);
        await tester.pumpAndSettle();
        await tester.tap(find.byType(TextField));
        await typing(true);
        await tester.enterText(find.byType(TextField), 'a');
        await tester.pumpAndSettle();
        await typing(false);
        await back();

        await open(JourneyScreen(trip: trip, controller: c));
        await back();

        await open(
          ScannerScreen(
            trip: trip,
            controller: c,
            camera: (context, onCode) => const ColoredBox(color: Colors.black),
          ),
        );
        await tester.tap(find.text(s.typeTicketNumber));
        await tester.pumpAndSettle();
        await typing(true);
        await tester.enterText(find.byType(TextField), 'bad');
        // The keyboard's Done key checks the number, as the button does.
        await tester.testTextInput.receiveAction(TextInputAction.done);
        await tester.pumpAndSettle();
        expect(find.text(s.ticketNumberInvalid), findsOneWidget);
        if (h >= 360) {
          await tester.ensureVisible(find.text(s.checkTicket));
          await tester.pumpAndSettle();
          expect(find.text(s.checkTicket).hitTestable(), findsOneWidget, reason: 'the button stays reachable above the keyboard');
        }
        await typing(false);
        Navigator.of(tester.element(find.text(s.checkTicket))).pop();
        await tester.pumpAndSettle();
        await back();

        await open(const DriverSettingsScreen());
        await back();
      });
    }
  }
}
