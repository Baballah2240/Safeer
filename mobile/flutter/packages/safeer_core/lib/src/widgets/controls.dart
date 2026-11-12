import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../theme/palette.dart';

/// Main action: the website's sky-to-navy enamel, with a darker start so white text stays
/// readable outdoors. While [busy] it is disabled, so a booking or scan cannot be sent twice.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({super.key, required this.label, required this.onPressed, this.icon, this.busy = false, this.busyLabel});
  final String label;
  final String? busyLabel;
  final IconData? icon;
  final VoidCallback? onPressed;
  final bool busy;
  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !busy;
    final text = busy ? (busyLabel ?? label) : label;
    return Semantics(
      button: true,
      enabled: enabled,
      label: text,
      // The label replaces the inner widgets for screen readers, so the tap action goes here too.
      onTap: enabled ? onPressed : null,
      excludeSemantics: true,
      child: Opacity(
        opacity: enabled || busy ? 1 : 0.55,
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: const LinearGradient(colors: [SafeerBrand.skyDeep, SafeerBrand.navy], begin: AlignmentDirectional.topStart, end: AlignmentDirectional.bottomEnd),
            border: Border.all(color: const Color(0x708CC8FF)),
            boxShadow: const [BoxShadow(color: Color(0x300B2D5B), blurRadius: 18, offset: Offset(0, 6))],
          ),
          child: Material(
            type: MaterialType.transparency,
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: enabled ? onPressed : null,
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 56),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    if (busy)
                      const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                    else if (icon != null)
                      Icon(icon, color: Colors.white, size: 22),
                    if (busy || icon != null) const SizedBox(width: 8),
                    Flexible(child: Text(text, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w600))),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Placeholder cards while a request is pending; they pulse gently unless the phone asks
/// for reduced motion.
class LoadingCards extends StatefulWidget {
  const LoadingCards({super.key, required this.label, this.count = 3, this.height = 112});
  final String label;
  final int count;
  final double height;
  @override
  State<LoadingCards> createState() => _LoadingCardsState();
}

class _LoadingCardsState extends State<LoadingCards> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100), lowerBound: 0.55);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _pulse.value = 1;
      _pulse.stop();
    } else if (!_pulse.isAnimating) {
      _pulse.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = SafeerPalette.of(context);
    return Semantics(
      label: widget.label,
      liveRegion: true,
      child: FadeTransition(
        opacity: _pulse,
        child: ExcludeSemantics(
          child: Column(children: [
            for (var i = 0; i < widget.count; i++)
              Container(
                height: widget.height,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(color: p.raised, borderRadius: BorderRadius.circular(18), border: Border.all(color: p.border)),
              ),
          ]),
        ),
      ),
    );
  }
}

/// Empty and error states with an optional action such as Retry.
class MessageState extends StatelessWidget {
  const MessageState({super.key, required this.icon, required this.title, this.message, this.actionLabel, this.onAction, this.secondary});
  final IconData icon;
  final String title;
  final String? message, actionLabel;
  final VoidCallback? onAction;
  final Widget? secondary;
  @override
  Widget build(BuildContext context) {
    final p = SafeerPalette.of(context);
    final t = Theme.of(context).textTheme;
    return Semantics(
      liveRegion: true,
      container: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 8),
        child: Column(children: [
          Icon(icon, size: 48, color: p.muted),
          const SizedBox(height: 12),
          Text(title, style: t.titleMedium, textAlign: TextAlign.center),
          if (message != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(message!, style: t.bodyMedium?.copyWith(color: p.muted), textAlign: TextAlign.center)),
          if (onAction != null) Padding(padding: const EdgeInsets.only(top: 16), child: OutlinedButton.icon(onPressed: onAction, icon: const Icon(Icons.refresh), label: Text(actionLabel ?? SafeerStrings.of(context).retry))),
          ?secondary,
        ]),
      ),
    );
  }
}

/// From → To, with the arrow mirrored for Arabic.
class RouteLine extends StatelessWidget {
  const RouteLine({super.key, required this.from, required this.to, this.style});
  final String from, to;
  final TextStyle? style;
  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final st = style ?? Theme.of(context).textTheme.titleMedium;
    return Semantics(
      label: '${s.from} $from, ${s.to} $to',
      excludeSemantics: true,
      child: Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 8, children: [
        Text(from, style: st),
        Icon(Icons.arrow_forward, size: (st?.fontSize ?? 18) + 2, color: SafeerBrand.orange),
        Text(to, style: st),
      ]),
    );
  }
}

/// A label above a value, for ticket and trip details.
class InfoPair extends StatelessWidget {
  const InfoPair({super.key, required this.label, required this.value, this.ltrValue = false, this.large = false});
  final String label, value;
  final bool ltrValue, large;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Semantics(
      label: '$label: $value',
      excludeSemantics: true,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        Text(label, style: t.labelSmall),
        const SizedBox(height: 2),
        Text(value, textDirection: ltrValue ? TextDirection.ltr : null, style: (large ? t.titleLarge : t.titleSmall)?.copyWith(fontFamily: ltrValue ? 'packages/safeer_core/Inter' : null)),
      ]),
    );
  }
}
