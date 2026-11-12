import 'package:flutter/material.dart';

import 'storage.dart';

/// Appearance and language, saved on the phone. Dark is the default, as on the website.
class AppSettings extends ChangeNotifier {
  AppSettings(this._store);
  final KeyValueStore _store;
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
