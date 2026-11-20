import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';

import 'storage.dart';

/// Crash reports (D128) through Firebase Crashlytics. Release builds made with the private
/// google-services.json send app crashes and uncaught errors with the app version, phone model
/// and Android version. No names, phone numbers, tickets or sign-in details are attached.
/// Without Firebase (tests, debug and builds without the file) everything here does nothing.
/// Users can turn it off in Settings.
class CrashReports extends ChangeNotifier {
  CrashReports(this._store);
  final KeyValueStore _store;
  static const _key = 'safeer.crash.reports';

  /// Whether Firebase started, so reports can be sent at all.
  bool available = false;

  /// The user's choice; on unless turned off.
  bool enabled = true;

  FirebaseCrashlytics? _crashlytics;

  /// Call once in main() before runApp.
  Future<void> start({String? app}) async {
    enabled = await _store.read(_key) != 'off';
    if (kDebugMode) return;
    try {
      await Firebase.initializeApp();
      final c = FirebaseCrashlytics.instance;
      await c.setCrashlyticsCollectionEnabled(enabled);
      if (app != null) await c.setCustomKey('app', app);
      FlutterError.onError = c.recordFlutterFatalError;
      PlatformDispatcher.instance.onError = (error, stack) {
        c.recordError(error, stack, fatal: true);
        return true;
      };
      _crashlytics = c;
      available = true;
    } catch (_) {
      // No Firebase configuration in this build: crash reports stay off.
      available = false;
    }
    notifyListeners();
  }

  Future<void> setEnabled(bool value) async {
    enabled = value;
    await _store.write(_key, value ? 'on' : 'off');
    await _crashlytics?.setCrashlyticsCollectionEnabled(value);
    notifyListeners();
  }

  /// Records a handled problem worth knowing about (never with personal data).
  Future<void> note(Object error, StackTrace? stack, {String? reason}) async {
    if (!enabled) return;
    await _crashlytics?.recordError(error, stack, reason: reason);
  }
}
