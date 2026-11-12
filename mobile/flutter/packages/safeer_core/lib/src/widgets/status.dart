import 'package:flutter/material.dart';

import '../theme/palette.dart';

enum StatusTone { success, warning, error, info, neutral }

(Color, Color) toneColors(SafeerPalette p, StatusTone tone) => switch (tone) {
      StatusTone.success => (p.successBg, p.successInk),
      StatusTone.warning => (p.warningBg, p.warningInk),
      StatusTone.error => (p.errorBg, p.errorInk),
      StatusTone.info => (p.infoBg, p.infoInk),
      StatusTone.neutral => (p.raised, p.ink),
    };

/// A status is always an icon plus words, never colour alone.
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.icon, required this.label, required this.tone, this.dense = false});
  final IconData icon;
  final String label;
  final StatusTone tone;
  final bool dense;
  @override
  Widget build(BuildContext context) {
    final (bg, ink) = toneColors(SafeerPalette.of(context), tone);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: dense ? 8 : 10, vertical: dense ? 3 : 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999), border: Border.all(color: ink.withValues(alpha: 0.35))),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: dense ? 15 : 17, color: ink),
        const SizedBox(width: 5),
        Flexible(child: Text(label, style: TextStyle(color: ink, fontWeight: FontWeight.w600, fontSize: dense ? 13 : 14))),
      ]),
    );
  }
}

/// Large solid result block (scan feedback, booking problems).
class StatusPanel extends StatelessWidget {
  const StatusPanel({super.key, required this.icon, required this.title, required this.tone, this.message, this.child, this.liveRegion = true});
  final IconData icon;
  final String title;
  final String? message;
  final StatusTone tone;
  final Widget? child;
  final bool liveRegion;
  @override
  Widget build(BuildContext context) {
    final (bg, ink) = toneColors(SafeerPalette.of(context), tone);
    return Semantics(
      liveRegion: liveRegion,
      container: true,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(18), border: Border.all(color: ink.withValues(alpha: 0.5), width: 1.5)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, size: 30, color: ink),
            const SizedBox(width: 12),
            Expanded(child: Text(title, style: TextStyle(color: ink, fontSize: 20, fontWeight: FontWeight.w700))),
          ]),
          if (message != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(message!, style: TextStyle(color: ink, fontSize: 15))),
          if (child != null) Padding(padding: const EdgeInsets.only(top: 12), child: DefaultTextStyle.merge(style: TextStyle(color: ink), child: child!)),
        ]),
      ),
    );
  }
}
