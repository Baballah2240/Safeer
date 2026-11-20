import 'package:flutter/material.dart';
import 'package:safeer_core/safeer_core.dart';

import 'src/app.dart';
import 'src/session.dart';

/// Safeer Driver entry point (D74). Debug builds use labelled demo data unless
/// --dart-define=SAFEER_DATA=live is given; release builds use the live site.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await prepareSafeerFormats();
  final config = SafeerConfig.fromEnvironment();
  final store = DeviceStore();
  final settings = AppSettings(store);
  await settings.load();
  // D128: crash reports, only in release builds made with the private Firebase file.
  final crashes = CrashReports(store);
  await crashes.start(app: 'driver');
  settings.crashReports = crashes;
  // D126: offered inside the app when the website publishes a newer version (release builds only).
  if (!config.demo) settings.updater = AppUpdater(flavor: 'driver', versionCode: driverVersionCode, origin: config.origin);
  final DriverRepository repository = config.demo ? DemoDriverRepository() : LiveDriverRepository(SafeerApi(origin: config.origin));
  final session = DriverSession(repository: repository, pending: PendingScans(store), lock: settings.lock, vault: SecureDeviceStore());
  await session.load();
  runApp(DriverApp(session: session, settings: settings, config: config));
}
