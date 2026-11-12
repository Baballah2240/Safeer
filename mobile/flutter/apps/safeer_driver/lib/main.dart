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
  final DriverRepository repository = config.demo ? DemoDriverRepository() : LiveDriverRepository(SafeerApi(origin: config.origin));
  final session = DriverSession(repository: repository, pending: PendingScans(store));
  runApp(DriverApp(session: session, settings: settings, config: config));
}
