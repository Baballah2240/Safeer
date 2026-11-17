import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safeer_core/safeer_core.dart';

class FakeBiometrics implements BiometricCheck {
  bool has = true, pass = true;
  int asked = 0;
  @override
  Future<bool> available() async => has;
  @override
  Future<bool> confirm(String reason) async {
    asked++;
    return pass;
  }
}

Widget host(AppSettings settings, Widget home) => MaterialApp(
      localizationsDelegates: const [SafeerStrings.delegate, GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate],
      supportedLocales: SafeerStrings.supportedLocales,
      theme: safeerTheme(Brightness.light, arabic: false),
      builder: (context, child) => AppLockGate(lock: settings.lock, child: child!),
      home: home,
    );

Future<void> typePin(WidgetTester tester, String pin) async {
  for (final d in pin.split('')) {
    await tester.tap(find.text(d).last);
  }
  await tester.pump();
  await tester.tap(find.byKey(const ValueKey('pin-continue')));
  await tester.pumpAndSettle();
}

void main() {
  group('AppLock (D113)', () {
    test('stores only a salted hash, survives a restart, and locks on start', () async {
      final store = MemoryStore();
      final lock = AppLock(store, biometrics: FakeBiometrics());
      await lock.load();
      expect(lock.enabled, isFalse);
      expect(() => lock.setPin('12'), throwsArgumentError);
      await lock.setPin('4821');
      expect(store.values.values.join(), isNot(contains('4821')));
      final again = AppLock(store, biometrics: FakeBiometrics());
      await again.load();
      expect(again.enabled, isTrue);
      expect(again.locked, isTrue);
      expect(again.unlockWithPin('0000'), isFalse);
      expect(again.unlockWithPin('4821'), isTrue);
      expect(again.locked, isFalse);
      again.lock();
      expect(again.locked, isTrue);
    });

    test('waits after five wrong PINs', () async {
      var now = DateTime(2026, 11, 17, 9);
      final lock = AppLock(MemoryStore(), biometrics: FakeBiometrics(), clock: () => now);
      await lock.setPin('123456');
      for (var i = 0; i < 5; i++) {
        expect(lock.checkPin('000000'), isFalse);
      }
      expect(lock.wait, isNotNull);
      expect(lock.checkPin('123456'), isFalse, reason: 'even the right PIN waits');
      now = now.add(const Duration(seconds: 31));
      expect(lock.wait, isNull);
      expect(lock.checkPin('123456'), isTrue);
    });

    test('biometrics unlock only in biometric mode; turning off clears the PIN', () async {
      final bio = FakeBiometrics();
      final store = MemoryStore();
      final lock = AppLock(store, biometrics: bio);
      await lock.setPin('1234');
      lock.lock();
      expect(await lock.unlockWithBiometrics('x'), isFalse);
      await lock.setMode(LockMode.biometric);
      bio.pass = false;
      expect(await lock.unlockWithBiometrics('x'), isFalse);
      bio.pass = true;
      expect(await lock.unlockWithBiometrics('x'), isTrue);
      await lock.turnOff();
      expect(store.values.keys.where((k) => k.startsWith('safeer.lock')), isEmpty);
    });
  });

  testWidgets('Settings turns on a PIN lock, and the lock screen covers the app until the PIN is typed', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final settings = AppSettings(MemoryStore(), biometrics: FakeBiometrics()..has = false);
    await settings.load();
    await tester.pumpWidget(host(settings, Scaffold(body: SettingsView(settings: settings, dataSource: 'Demo', version: '1'))));
    await tester.pumpAndSettle();
    expect(find.text('App lock'), findsOneWidget);
    await tester.tap(find.text('PIN'));
    await tester.pumpAndSettle();
    expect(find.text('Choose a PIN'), findsOneWidget);
    await typePin(tester, '2468');
    expect(find.text('Enter the PIN again'), findsOneWidget);
    await typePin(tester, '1357');
    expect(find.text('The PINs did not match. Try again.'), findsOneWidget);
    await typePin(tester, '2468');
    await typePin(tester, '2468');
    expect(settings.lock.enabled, isTrue);
    expect(find.text('Change PIN'), findsOneWidget);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(find.text('Enter your PIN'), findsOneWidget);
    expect(find.text('Change PIN'), findsNothing, reason: 'the app is hidden behind the lock');
    await typePin(tester, '1111');
    expect(find.text('Wrong PIN'), findsOneWidget);
    await typePin(tester, '2468');
    expect(find.text('Enter your PIN'), findsNothing);
    expect(find.text('Change PIN'), findsOneWidget);
  });

  testWidgets('Biometric mode asks for the fingerprint when the lock screen opens', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final bio = FakeBiometrics();
    final store = MemoryStore();
    final first = AppLock(store, biometrics: bio);
    await first.setPin('9753', newMode: LockMode.biometric);
    final settings = AppSettings(store, biometrics: bio);
    await settings.load();
    expect(settings.lock.locked, isTrue);
    await tester.pumpWidget(host(settings, const Scaffold(body: Text('Trips'))));
    await tester.pumpAndSettle();
    expect(bio.asked, 1);
    expect(find.text('Trips'), findsOneWidget);
  });
}
