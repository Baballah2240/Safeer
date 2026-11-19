import 'package:flutter/material.dart';

import '../app_update.dart';
import '../l10n/strings.dart';
import '../theme/palette.dart';
import 'surfaces.dart';

/// Wrap the app (inside AppLockGate): checks for an update once at start and shows a card
/// at the bottom when a newer version is published (D126).
class UpdatePrompt extends StatefulWidget {
  const UpdatePrompt({super.key, required this.updater, required this.child});
  final AppUpdater? updater;
  final Widget child;
  @override
  State<UpdatePrompt> createState() => _UpdatePromptState();
}

class _UpdatePromptState extends State<UpdatePrompt> {
  @override
  void initState() {
    super.initState();
    final u = widget.updater;
    if (u != null && u.state == UpdateState.idle) WidgetsBinding.instance.addPostFrameCallback((_) => u.check());
  }

  @override
  Widget build(BuildContext context) {
    final u = widget.updater;
    if (u == null) return widget.child;
    return ListenableBuilder(
      listenable: u,
      builder: (context, _) => Stack(fit: StackFit.expand, children: [
        widget.child,
        if (u.hasUpdate && !u.dismissed)
          Align(
            alignment: Alignment.bottomCenter,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 76),
                child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 520), child: Material(elevation: 6, borderRadius: BorderRadius.circular(16), clipBehavior: Clip.antiAlias, child: UpdateCard(updater: u, onClose: u.dismiss))),
              ),
            ),
          ),
      ]),
    );
  }
}

/// The update offer: version, Update button with download progress, and what to do next.
class UpdateCard extends StatelessWidget {
  const UpdateCard({super.key, required this.updater, this.onClose});
  final AppUpdater updater;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final p = SafeerPalette.of(context);
    final u = updater;
    final r = u.release!;
    final note = switch (u.state) {
      UpdateState.downloading => s.updateDownloading((u.progress * 100).round()),
      UpdateState.ready => u.needsPermission ? s.updateAllowInstalls : s.updateInstallerOpened,
      UpdateState.failed => s.updateFailed,
      _ => s.updateKeepsData,
    };
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        Row(children: [
          const Icon(Icons.system_update),
          const SizedBox(width: 12),
          Expanded(child: Text(s.updateAvailable(r.versionName), style: Theme.of(context).textTheme.titleMedium)),
          if (onClose != null) TextButton(onPressed: onClose, child: Text(s.updateLater)),
        ]),
        Padding(padding: const EdgeInsets.only(top: 4, right: 8), child: Text(note, style: TextStyle(color: u.state == UpdateState.failed ? Theme.of(context).colorScheme.error : p.muted))),
        if (u.state == UpdateState.downloading) Padding(padding: const EdgeInsets.only(top: 10, right: 8), child: LinearProgressIndicator(value: u.progress)),
        Padding(
          padding: const EdgeInsets.only(top: 10, right: 8),
          child: FilledButton.icon(
            key: const ValueKey('app-update'),
            onPressed: u.busy ? null : u.update,
            icon: const Icon(Icons.download),
            label: Text(u.state == UpdateState.failed ? s.updateTryAgain : s.updateNow(r.bytes / (1024 * 1024))),
          ),
        ),
      ]),
    );
  }
}

/// Settings section: current state and Check for updates.
class AppUpdateSettings extends StatelessWidget {
  const AppUpdateSettings({super.key, required this.updater});
  final AppUpdater updater;

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    return ListenableBuilder(
      listenable: updater,
      builder: (context, _) {
        final u = updater;
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SectionLabel(s.appUpdate),
          if (u.hasUpdate)
            Card(margin: EdgeInsets.zero, child: UpdateCard(updater: u))
          else
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: u.state == UpdateState.checking ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.system_update_alt),
              title: Text(s.checkForUpdates),
              subtitle: Text(switch (u.state) {
                UpdateState.upToDate => s.updatedNow,
                UpdateState.failed => s.updateCheckFailed,
                _ => s.updateHint,
              }),
              onTap: u.busy ? null : u.check,
            ),
          const SizedBox(height: 8),
        ]);
      },
    );
  }
}
