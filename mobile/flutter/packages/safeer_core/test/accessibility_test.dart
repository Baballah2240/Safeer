import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safeer_core/safeer_core.dart';

/// Found on a phone with uiautomator: labelled controls hid their tap action from screen
/// readers. Each control must be announced as a button and activatable through semantics.
void main() {
  testWidgets('labelled controls can be activated by a screen reader', (tester) async {
    final handle = tester.ensureSemantics();
    final taps = <String>[];
    final map = SeatMap.fromJson({
      'id': 't', 'date': '2026-11-13', 'time': '08:30', 'fareMinor': 100, 'seatCount': 2, 'stops': <Object>[],
      'rows': 1, 'columns': 2, 'holdMinutes': 30,
      'seats': [
        {'label': '1A', 'row': 1, 'column': 1, 'available': true},
        {'label': '1B', 'row': 1, 'column': 2, 'available': false},
      ],
    });
    await tester.pumpWidget(MaterialApp(
      theme: safeerTheme(Brightness.dark, arabic: false),
      localizationsDelegates: const [SafeerStrings.delegate, GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate],
      home: Scaffold(
        body: ListView(children: [
          PrimaryButton(label: 'Find departures', onPressed: () => taps.add('button')),
          const PrimaryButton(label: 'Disabled', onPressed: null),
          SolidCard(semanticLabel: 'Departs 08:30', onTap: () => taps.add('card'), child: const Text('card')),
          SizedBox(width: 300, child: SeatMapView(map: map, selected: const {}, onToggle: (s) => taps.add('seat ${s.label}'))),
        ]),
      ),
    ));
    await tester.pumpAndSettle();
    final s = SafeerStrings(const Locale('en'));

    expect(tester.getSemantics(find.bySemanticsLabel('Find departures')), isSemantics(isButton: true, hasTapAction: true, isEnabled: true));
    expect(tester.getSemantics(find.bySemanticsLabel('Disabled')), isSemantics(isButton: true, hasTapAction: false, isEnabled: false));
    expect(tester.getSemantics(find.bySemanticsLabel('Departs 08:30')), isSemantics(isButton: true, hasTapAction: true));
    final free = find.bySemanticsLabel(s.seatSemantics('1A', s.seatAvailable));
    final taken = find.bySemanticsLabel(s.seatSemantics('1B', s.seatTaken));
    expect(tester.getSemantics(free), isSemantics(isButton: true, hasTapAction: true));
    expect(tester.getSemantics(taken), isSemantics(isButton: true, hasTapAction: false));

    tester.semantics.tap(find.semantics.byLabel('Find departures'));
    tester.semantics.tap(find.semantics.byLabel('Departs 08:30'));
    tester.semantics.tap(find.semantics.byLabel(s.seatSemantics('1A', s.seatAvailable)));
    expect(taps, ['button', 'card', 'seat 1A']);
    handle.dispose();
  });
}
