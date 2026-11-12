import 'package:flutter/foundation.dart';

/// Build-time choices (D74):
///   --dart-define=SAFEER_DATA=demo|live   (default: demo in debug, live in release)
///   --dart-define=SAFEER_ORIGIN=https://… (default: the hosted Safeer site)
/// Release builds accept only an https origin.
class SafeerConfig {
  const SafeerConfig({required this.demo, required this.origin});
  final bool demo;
  final Uri origin;

  static const hostedOrigin = 'https://safeer.mohbaba.online';

  factory SafeerConfig.fromEnvironment() {
    const data = String.fromEnvironment('SAFEER_DATA');
    const origin = String.fromEnvironment('SAFEER_ORIGIN', defaultValue: hostedOrigin);
    final uri = Uri.parse(origin);
    if (kReleaseMode && uri.scheme != 'https') throw StateError('Release builds need an https SAFEER_ORIGIN.');
    return SafeerConfig(demo: data.isEmpty ? !kReleaseMode : data == 'demo', origin: Uri(scheme: uri.scheme, host: uri.host, port: uri.hasPort ? uri.port : null));
  }
}
