import 'package:flutter/material.dart';
import 'package:safeer_core/safeer_core.dart';

import 'src/app.dart';

/// Safeer Passenger entry point (D74). Debug builds use labelled demo data unless
/// --dart-define=SAFEER_DATA=live is given; release builds use the live site.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await prepareSafeerFormats();
  final config = SafeerConfig.fromEnvironment();
  final store = DeviceStore();
  final settings = AppSettings(store);
  await settings.load();
  final trips = TripStore(store);
  final PassengerRepository repository;
  if (config.demo) {
    final demo = DemoPassengerRepository();
    await demo.seed(trips);
    repository = demo;
  } else {
    repository = LivePassengerRepository(SafeerApi(origin: config.origin));
  }
  runApp(PassengerApp(repository: repository, trips: trips, settings: settings, config: config));
}
