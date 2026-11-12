import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../settings.dart';
import '../theme/palette.dart';
import 'surfaces.dart';

/// Language and appearance controls shared by both apps.
class SettingsView extends StatelessWidget {
  const SettingsView({super.key, required this.settings, required this.dataSource, required this.version, this.children = const []});
  final AppSettings settings;
  final String dataSource, version;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final p = SafeerPalette.of(context);
    return ListenableBuilder(
      listenable: settings,
      builder: (context, _) => ListView(padding: const EdgeInsets.all(16), children: [
        SectionLabel(s.language),
        SegmentedButton<String>(
          showSelectedIcon: false,
          segments: [
            ButtonSegment(value: 'phone', label: Text(s.phoneSetting, textAlign: TextAlign.center)),
            ButtonSegment(value: 'en', label: Text(s.english)),
            ButtonSegment(value: 'ar', label: Text(s.arabic)),
          ],
          selected: {settings.locale?.languageCode ?? 'phone'},
          onSelectionChanged: (v) => settings.setLocale(v.first == 'phone' ? null : Locale(v.first)),
        ),
        const SizedBox(height: 16),
        SectionLabel(s.appearance),
        SegmentedButton<ThemeMode>(
          showSelectedIcon: false,
          segments: [
            ButtonSegment(value: ThemeMode.dark, icon: const Icon(Icons.dark_mode_outlined), label: Text(s.dark)),
            ButtonSegment(value: ThemeMode.light, icon: const Icon(Icons.light_mode_outlined), label: Text(s.light)),
            ButtonSegment(value: ThemeMode.system, icon: const Icon(Icons.phone_android), label: Text(s.phoneSetting, textAlign: TextAlign.center)),
          ],
          selected: {settings.themeMode},
          onSelectionChanged: (v) => settings.setThemeMode(v.first),
        ),
        const SizedBox(height: 16),
        ...children,
        const SizedBox(height: 8),
        ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.cloud_outlined), title: Text(s.dataSource), subtitle: Text(dataSource, style: TextStyle(color: p.muted))),
        ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.info_outline), title: Text(s.version), subtitle: Text(version, textDirection: TextDirection.ltr, style: TextStyle(color: p.muted))),
      ]),
    );
  }
}
