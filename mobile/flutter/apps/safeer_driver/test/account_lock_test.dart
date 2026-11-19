import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safeer_core/safeer_core.dart';
import 'package:safeer_driver/src/app.dart';
import 'package:safeer_driver/src/session.dart';

class NoBiometrics implements BiometricCheck {
  @override
  Future<bool> available() async => false;
  @override
  Future<bool> confirm(String reason) async => false;
}

/// Counts sign-ins and can refuse the password, as after a change on the website.
class CountingRepository extends DemoDriverRepository {
  CountingRepository() : super(latency: Duration.zero);
  int signIns = 0;
  bool refuse = false;
  @override
  Future<DriverAccount> signIn(String email, String password) async {
    signIns++;
    if (refuse) throw ApiException(401, 'INVALID_CREDENTIALS');
    return super.signIn(email, password);
  }
}

/// One phone: the same disk and vault survive an app restart.
class Phone {
  final disk = MemoryStore(), vault = MemoryStore();
  final repo = CountingRepository();
  late AppSettings settings;
  late DriverSession session;

  Future<void> start(WidgetTester tester) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    settings = AppSettings(disk, biometrics: NoBiometrics());
    await settings.load();
    session = DriverSession(repository: repo, pending: PendingScans(disk), syncEvery: Duration.zero, lock: settings.lock, vault: vault);
    await session.load();
    await tester.pumpWidget(DriverApp(session: session, settings: settings, config: SafeerConfig(demo: true, origin: Uri.parse(SafeerConfig.hostedOrigin)), camera: (c, o) => const SizedBox()));
    await tester.pumpAndSettle();
  }
}

Future<void> typePin(WidgetTester tester, String pin) async {
  for (final d in pin.split('')) {
    await tester.tap(find.text(d).last);
  }
  await tester.pump();
  await tester.tap(find.byKey(const ValueKey('pin-continue')));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(prepareSafeerFormats);
  const email = 'demo.driver@example.invalid';
  final s = SafeerStrings(const Locale('en'));

  testWidgets('with the lock on, the PIN opens the account after a restart without the password (D125)', (tester) async {
    final phone = Phone();
    await phone.start(tester);
    expect(find.text(s.accountLockNote), findsOneWidget);
    await phone.session.signIn(email, 'secret-pass');
    await phone.settings.lock.setPin('2468');
    await tester.pumpAndSettle();
    expect(phone.vault.values, isNotEmpty, reason: 'saved once the lock is on');
    expect(phone.disk.values.values.join(), isNot(contains('secret-pass')), reason: 'never in plain storage');

    // Restart: lock screen names the account, the PIN signs in by itself.
    await tester.pumpWidget(const SizedBox());
    await phone.start(tester);
    expect(find.text(s.enterPin), findsOneWidget);
    expect(find.text(s.unlockAccount(email)), findsOneWidget);
    final before = phone.repo.signIns;
    await typePin(tester, '2468');
    expect(phone.repo.signIns, before + 1);
    expect(find.text(s.activeAssignment), findsOneWidget);
  });

  testWidgets('signing out, or a refused saved password, removes the saved account and the lock', (tester) async {
    final phone = Phone();
    await phone.start(tester);
    await phone.settings.lock.setPin('2468');
    await phone.session.signIn(email, 'secret-pass');
    expect(phone.vault.values, isNotEmpty);

    phone.repo.refuse = true;
    await tester.pumpWidget(const SizedBox());
    await phone.start(tester);
    await typePin(tester, '2468');
    expect(find.text(s.signInTitle), findsOneWidget, reason: 'password changed: ask for it again');
    expect(phone.vault.values, isEmpty);

    phone.repo.refuse = false;
    await phone.session.signIn(email, 'new-pass');
    expect(phone.vault.values, isNotEmpty);
    await phone.session.signOut();
    await phone.settings.lock.turnOff();
    expect(phone.vault.values, isEmpty);
  });

  testWidgets('ten wrong PINs sign out and remove the lock', (tester) async {
    var now = DateTime(2026, 11, 19, 9);
    final phone = Phone();
    await phone.start(tester);
    await phone.settings.lock.setPin('2468');
    await phone.session.signIn(email, 'secret-pass');
    await tester.pumpWidget(const SizedBox());
    phone.settings = AppSettings(phone.disk, biometrics: NoBiometrics());
    // Count PINs directly with a clock that skips the waits.
    final lock = AppLock(phone.disk, biometrics: NoBiometrics(), clock: () => now);
    await lock.load();
    final session = DriverSession(repository: phone.repo, pending: PendingScans(phone.disk), syncEvery: Duration.zero, lock: lock, vault: phone.vault);
    await session.load();
    expect(session.savedEmail, email);
    for (var i = 0; i < AppLock.forgetAfter; i++) {
      lock.unlockWithPin('0000');
      now = now.add(const Duration(hours: 2));
    }
    await tester.pump();
    expect(lock.enabled, isFalse);
    expect(lock.locked, isFalse);
    expect(session.savedEmail, isNull);
    expect(phone.vault.values, isEmpty);
  });
}
