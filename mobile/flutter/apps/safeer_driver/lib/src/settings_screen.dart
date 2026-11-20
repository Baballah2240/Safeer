import 'package:flutter/material.dart';
import 'package:safeer_core/safeer_core.dart';

import 'app.dart';

class DriverSettingsScreen extends StatefulWidget {
  const DriverSettingsScreen({super.key});
  @override
  State<DriverSettingsScreen> createState() => _DriverSettingsScreenState();
}

class _DriverSettingsScreenState extends State<DriverSettingsScreen> {
  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final scope = DriverScope.of(context);
    final repo = scope.session.repository;
    return Scaffold(
      appBar: AppBar(title: Text(s.settings)),
      body: SettingsView(
        settings: scope.settings,
        version: driverVersion,
        children: [
          ListenableBuilder(
            listenable: scope.settings,
            builder: (context, _) => SwitchListTile(
              key: const ValueKey('scan-sounds'),
              contentPadding: EdgeInsets.zero,
              secondary: const Icon(Icons.volume_up_outlined),
              title: Text(s.scanSounds),
              subtitle: Text(s.scanSoundsHint),
              value: scope.settings.scanSounds,
              onChanged: scope.settings.setScanSounds,
            ),
          ),
          if (repo is DemoDriverRepository)
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              secondary: const Icon(Icons.cloud_off_outlined),
              title: Text(s.simulateOffline),
              value: repo.offline,
              onChanged: (v) {
                setState(() => repo.offline = v);
                if (!v) scope.session.syncAll();
              },
            ),
          if (scope.session.account != null)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.logout),
              title: Text(s.signOut),
              subtitle: Text(scope.session.account!.email, textDirection: TextDirection.ltr),
              onTap: () async {
                await scope.session.signOut();
                if (context.mounted) Navigator.of(context).popUntil((r) => r.isFirst);
              },
            ),
        ],
      ),
    );
  }
}
