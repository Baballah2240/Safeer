import 'package:flutter/material.dart';

import '../l10n/languages.dart';
import '../l10n/strings.dart';
import '../settings.dart';
import '../theme/palette.dart';
import 'app_lock_view.dart';
import 'app_update_view.dart';
import 'surfaces.dart';

/// Language, appearance, app lock and update controls shared by both apps. D129: crash
/// reports stay on (described on the privacy page) and the data source is not shown.
class SettingsView extends StatelessWidget {
  const SettingsView({super.key, required this.settings, required this.version, this.children = const []});
  final AppSettings settings;
  final String version;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final p = SafeerPalette.of(context);
    return ListenableBuilder(
      listenable: settings,
      builder: (context, _) => ListView(padding: const EdgeInsets.all(16), children: [
        SectionLabel(s.language),
        ChoiceList<String>(
          key: const ValueKey('language'),
          choices: [
            Choice('phone', s.phoneSetting, icon: Icons.phone_android),
            Choice('ar', s.arabic, icon: Icons.translate),
            Choice('en', s.english, icon: Icons.language),
            // D138: any further language from the list, under its own name.
            for (final l in safeerLanguages.where((l) => l.code != 'ar' && l.code != 'en')) Choice(l.code, l.name, icon: Icons.translate),
          ],
          selected: settings.locale?.languageCode ?? 'phone',
          onSelected: (v) => settings.setLocale(v == 'phone' ? null : Locale(v)),
        ),
        const SizedBox(height: 16),
        SectionLabel(s.appearance),
        ChoiceList<ThemeMode>(
          key: const ValueKey('appearance'),
          choices: [
            Choice(ThemeMode.system, s.phoneSetting, icon: Icons.brightness_auto_outlined),
            Choice(ThemeMode.dark, s.dark, icon: Icons.dark_mode_outlined),
            Choice(ThemeMode.light, s.light, icon: Icons.light_mode_outlined),
          ],
          selected: settings.themeMode,
          onSelected: settings.setThemeMode,
        ),
        const SizedBox(height: 16),
        AppLockSettings(lock: settings.lock),
        if (settings.updater != null) AppUpdateSettings(updater: settings.updater!),
        ...children,
        const SizedBox(height: 8),
        ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.info_outline), title: Text(s.version), subtitle: Text(version, textDirection: TextDirection.ltr, style: TextStyle(color: p.muted))),
      ]),
    );
  }
}
