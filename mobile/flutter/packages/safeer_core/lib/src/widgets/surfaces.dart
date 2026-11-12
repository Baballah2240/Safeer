import 'dart:ui';

import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../theme/palette.dart';

/// Frosted glass, used only for the home hero, the search card and overlays (D74). When the
/// phone asks for high contrast the panel becomes solid.
class GlassPanel extends StatelessWidget {
  const GlassPanel({super.key, required this.child, this.padding = const EdgeInsets.all(20), this.radius = 24});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  @override
  Widget build(BuildContext context) {
    final p = SafeerPalette.of(context);
    final solid = MediaQuery.highContrastOf(context);
    final shape = BorderRadius.circular(radius);
    final box = DecoratedBox(
      decoration: BoxDecoration(
        color: solid ? p.paper : p.glass,
        borderRadius: shape,
        border: Border.all(color: solid ? p.border : p.glassEdge),
        boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 32, offset: Offset(0, 12))],
      ),
      child: Padding(padding: padding, child: child),
    );
    if (solid) return box;
    return ClipRRect(borderRadius: shape, child: BackdropFilter(filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18), child: box));
  }
}

/// Solid, high-contrast surface for tickets, seat maps, passenger lists and scan results.
class SolidCard extends StatelessWidget {
  const SolidCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.onTap, this.highlight = false, this.semanticLabel});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final bool highlight;
  final String? semanticLabel;
  @override
  Widget build(BuildContext context) {
    final p = SafeerPalette.of(context);
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
      side: BorderSide(color: highlight ? SafeerBrand.sky : p.border, width: highlight ? 2 : 1),
    );
    Widget content = Padding(padding: padding, child: child);
    if (semanticLabel != null) content = Semantics(label: semanticLabel, button: onTap != null, excludeSemantics: true, child: content);
    return Material(
      color: p.paper,
      shape: shape,
      clipBehavior: Clip.antiAlias,
      child: onTap == null ? content : InkWell(onTap: onTap, child: content),
    );
  }
}

/// Orange-edged strip shown on every screen that uses demo data.
class DemoBanner extends StatelessWidget {
  const DemoBanner({super.key});
  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final p = SafeerPalette.of(context);
    return Semantics(
      container: true,
      label: s.demoBanner,
      excludeSemantics: true,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(color: p.warningBg, border: const BorderDirectional(start: BorderSide(color: SafeerBrand.orange, width: 4))),
        child: Row(children: [
          Icon(Icons.science_outlined, size: 18, color: p.warningInk),
          const SizedBox(width: 8),
          Expanded(child: Text(s.demoBanner, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: p.warningInk))),
        ]),
      ),
    );
  }
}

class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 8),
        child: Semantics(header: true, child: Text(text, style: Theme.of(context).textTheme.titleSmall?.copyWith(color: SafeerPalette.of(context).muted))),
      );
}
