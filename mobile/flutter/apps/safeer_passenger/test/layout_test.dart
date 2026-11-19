import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safeer_core/safeer_core.dart';
import 'package:safeer_passenger/src/app.dart';
import 'package:safeer_passenger/src/confirmation_screen.dart';
import 'package:safeer_passenger/src/departures_screen.dart';
import 'package:safeer_passenger/src/review_screen.dart';
import 'package:safeer_passenger/src/seat_screen.dart';
import 'package:safeer_passenger/src/ticket_screen.dart';

/// Every screen on small, large and folding phones, tablets and landscape, at large text sizes,
/// with and without the on-screen keyboard. A layout overflow fails the test.
const devices = [
  (320.0, 568.0, 1.0), (360.0, 640.0, 1.6), (412.0, 915.0, 2.0), (673.0, 841.0, 1.0),
  (800.0, 1280.0, 1.3), (1280.0, 800.0, 1.0), (740.0, 360.0, 1.0), (568.0, 320.0, 1.3),
];

/// Typical keyboard height: about 300 in portrait, about half the screen in landscape.
double keyboardFor(double h) => h < 500 ? h * 0.5 : 300.0;

void main() {
  setUpAll(prepareSafeerFormats);
  for (final lang in ['en', 'ar']) {
    for (final (w, h, scale) in devices) {
      testWidgets('passenger screens fit: $lang ${w.toInt()}x${h.toInt()} text x$scale', (tester) async {
        tester.view.physicalSize = Size(w * 2, h * 2);
        tester.view.devicePixelRatio = 2;
        tester.platformDispatcher.textScaleFactorTestValue = scale;
        addTearDown(tester.view.reset);
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        Future<void> typing(bool on) async {
          tester.view.viewInsets = on ? FakeViewPadding(bottom: keyboardFor(h) * 2) : FakeViewPadding.zero;
          await tester.pumpAndSettle();
        }

        final s = SafeerStrings(Locale(lang));
        final disk = MemoryStore();
        final repo = DemoPassengerRepository(latency: Duration.zero);
        await tester.pumpWidget(PassengerApp(repository: repo, trips: TripStore(disk), settings: AppSettings(disk)..locale = Locale(lang), config: SafeerConfig(demo: true, origin: Uri.parse(SafeerConfig.hostedOrigin))));
        await tester.pumpAndSettle();
        expect(find.text(s.heroTitle), findsOneWidget);

        // City picker with the keyboard open on its search field.
        await tester.scrollUntilVisible(find.byIcon(Icons.trip_origin).hitTestable(), 60, scrollable: find.byType(Scrollable).first);
        await tester.tap(find.byIcon(Icons.trip_origin));
        await tester.pumpAndSettle();
        await tester.tap(find.byType(TextField).last);
        await typing(true);
        await tester.enterText(find.byType(TextField).last, 'k');
        await tester.pumpAndSettle();
        await typing(false);
        Navigator.of(tester.element(find.byType(TextField).last)).pop();
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

        final day = DateUtils.dateOnly(DateTime.now()).add(const Duration(days: 1));
        final cities = await repo.cities();
        final from = cities.firstWhere((c) => c.name.en == 'Khartoum'), to = cities.firstWhere((c) => c.name.en == 'Port Sudan');
        await open(DeparturesScreen(from: from, to: to, date: day));
        await back();

        final departure = (await repo.departures(from: from.code, to: to.code, date: day)).first;
        await open(SeatScreen(departure: departure));
        await back();

        // Review with two travellers: Next moves between fields, Done on the mobile number books.
        final map = await repo.seatMap(departure.id);
        final seats = map.seats.where((x) => x.available).take(2).map((x) => x.label).toList();
        await open(ReviewScreen(map: map, seats: seats));
        final fields = find.byType(TextFormField);
        await tester.ensureVisible(fields.first);
        await tester.pumpAndSettle();
        await tester.tap(fields.first);
        await typing(true);
        await tester.enterText(fields.first, 'Test Traveller');
        await tester.testTextInput.receiveAction(TextInputAction.next);
        await tester.pumpAndSettle();
        expect(tester.widget<EditableText>(find.descendant(of: fields.at(1), matching: find.byType(EditableText))).focusNode.hasFocus, isTrue, reason: 'Next goes to the second traveller');
        expect(find.text(s.reserveSeats).hitTestable(), findsOneWidget, reason: 'the reserve button stays above the keyboard');
        await typing(false);
        await back();

        final booking = await repo.reserve(ReservationRequest(tripId: departure.id, seats: seats.take(1).toList(), key: uuidV4(), mobile: '0912345678', travellers: [Traveller(seats.first, 'Test Traveller')]));
        await open(ConfirmationScreen(booking: booking, holdMinutes: map.holdMinutes));
        await back();
        await open(TicketScreen(saved: SavedBooking(reference: booking.reference, key: 'k', savedAt: DateTime.now(), booking: booking)));
        await back();

        for (final tab in [s.myTrips, s.settings]) {
          await tester.tap(find.text(tab).last);
          await tester.pumpAndSettle();
        }
      });
    }
  }
}
