import 'package:flutter/material.dart';

import 'l10n/languages.dart';

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

  /// D130: Safeer Driver beeps after each ticket scan (on by default).
  bool scanSounds = true;

  /// null follows the phone language (Arabic phones get Arabic, others English).
  Locale? locale;

  Future<void> load() async {
    themeMode = switch (await _store.read('safeer.theme')) {
      'light' => ThemeMode.light,
      'system' => ThemeMode.system,
      _ => ThemeMode.dark,
    };
    final lang = await _store.read('safeer.language');
    locale = isSafeerLanguage(lang) ? Locale(lang!) : null;
    scanSounds = await _store.read('safeer.scan.sounds') != 'off';
    await lock.load();
    notifyListeners();
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    themeMode = mode;
    notifyListeners();
    await _store.write('safeer.theme', mode.name);
  }

  Future<void> setScanSounds(bool on) async {
    scanSounds = on;
    notifyListeners();
    await _store.write('safeer.scan.sounds', on ? 'on' : 'off');
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
    return isSafeerLanguage(first?.languageCode) ? Locale(first!.languageCode) : const Locale('en');
  }
}
