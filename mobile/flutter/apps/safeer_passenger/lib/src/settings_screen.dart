import 'package:flutter/material.dart';
import 'package:safeer_core/safeer_core.dart';

import 'app.dart';

class PassengerSettingsScreen extends StatefulWidget {
  const PassengerSettingsScreen({super.key});
  @override
  State<PassengerSettingsScreen> createState() => _PassengerSettingsScreenState();
}

class _PassengerSettingsScreenState extends State<PassengerSettingsScreen> {
  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final scope = PassengerScope.of(context);
    final repo = scope.repository;
    return SafeArea(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 0), child: Semantics(header: true, child: Text(s.settings, style: Theme.of(context).textTheme.headlineSmall))),
        Expanded(
          child: SettingsView(
            settings: scope.settings,
            dataSource: repo.isDemo ? s.demoData : s.liveSite(scope.config.origin.host),
            version: passengerVersion,
            children: [
              if (repo is DemoPassengerRepository)
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(s.simulateOffline),
                  secondary: const Icon(Icons.cloud_off_outlined),
                  value: repo.offline,
                  onChanged: (v) => setState(() => repo.offline = v),
                ),
            ],
          ),
        ),
      ]),
    );
  }
}
