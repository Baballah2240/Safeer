import 'package:flutter/material.dart';

import 'app_lock.dart';
import 'app_update.dart';
import 'crash_reports.dart';
import 'storage.dart';

/// Appearance and language, saved on the phone. Dark is the default, as on the website.
class AppSettings extends ChangeNotifier {
  AppSettings(this._store, {BiometricCheck? biometrics}) : lock = AppLock(_store, biometrics: biometrics);
  final KeyValueStore _store;

  /// PIN or biometric app lock (D113).
  final AppLock lock;

  /// In-app update (D126). Set by main(); null in tests and previews.
  AppUpdater? updater;

  /// Crash reports (D128). Set by main(); null in tests and previews.
  CrashReports? crashReports;
  ThemeMode themeMode = ThemeMode.dark;

  /// null follows the phone language (Arabic phones get Arabic, others English).
  Locale? locale;

  Future<void> load() async {
    themeMode = switch (await _store.read('safeer.theme')) {
      'light' => ThemeMode.light,
      'system' => ThemeMode.system,
      _ => ThemeMode.dark,
    };
    final lang = await _store.read('safeer.language');
    locale = lang == 'ar' || lang == 'en' ? Locale(lang!) : null;
    await lock.load();
    notifyListeners();
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    themeMode = mode;
    notifyListeners();
    await _store.write('safeer.theme', mode.name);
  }

  Future<void> setLocale(Locale? value) async {
    locale = value;
    notifyListeners();
    if (value == null) {
      await _store.delete('safeer.language');
    } else {
      await _store.write('safeer.language', value.languageCode);
    }
  }

  static Locale resolve(Locale? chosen, List<Locale>? phone) {
    if (chosen != null) return chosen;
    final first = phone == null || phone.isEmpty ? null : phone.first;
    return first?.languageCode == 'ar' ? const Locale('ar') : const Locale('en');
  }
}
