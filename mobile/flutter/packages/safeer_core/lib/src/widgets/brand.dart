import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../theme/palette.dart';

/// The adopted "Route Pin" mark (src/brand.svg, D71) drawn natively.
class SafeerLogo extends StatelessWidget {
  const SafeerLogo({super.key, this.size = 40});
  final double size;
  @override
  Widget build(BuildContext context) => ExcludeSemantics(child: CustomPaint(size: Size.square(size), painter: _LogoPainter()));
}

class _LogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 120);
    final fill = Paint()..style = PaintingStyle.fill;
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(0, 0, 120, 120), const Radius.circular(28)), fill..color = SafeerBrand.navy);
    final pin = Path()
      ..moveTo(60, 12)
      ..cubicTo(42, 12, 28, 26, 28, 44)
      ..cubicTo(28, 67, 60, 94, 60, 94)
      ..cubicTo(60, 94, 92, 67, 92, 44)
      ..cubicTo(92, 26, 78, 12, 60, 12)
      ..close();
    canvas.drawPath(pin, fill..color = SafeerBrand.sky);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(44, 26, 32, 34), const Radius.circular(7)), fill..color = Colors.white);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(48.5, 31, 23, 13), const Radius.circular(2.5)), fill..color = SafeerBrand.navy);
    fill.color = SafeerBrand.orange;
    canvas.drawCircle(const Offset(51, 52), 3, fill);
    canvas.drawCircle(const Offset(69, 52), 3, fill);
    final road = Path()
      ..moveTo(16, 104)
      ..cubicTo(44, 90, 76, 90, 104, 104);
    canvas.drawPath(road, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 7
      ..strokeCap = StrokeCap.round
      ..color = SafeerBrand.orange);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Logo with the localized name, using the website's 26/28 wordmark size.
class SafeerWordmark extends StatelessWidget {
  const SafeerWordmark({super.key, this.caption, this.onDark = false});
  final String? caption;
  final bool onDark;
  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final p = SafeerPalette.of(context);
    final color = onDark ? Colors.white : p.ink;
    return Semantics(
      header: true,
      label: caption == null ? s.brand : '${s.brand}, $caption',
      excludeSemantics: true,
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        const SafeerLogo(size: 40),
        const SizedBox(width: 10),
        Flexible(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(s.brand, style: TextStyle(fontSize: s.isArabic ? 28 : 26, fontWeight: FontWeight.w700, height: 1.1, color: color)),
            if (caption != null)
              Text(caption!, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: onDark ? Colors.white70 : p.muted), overflow: TextOverflow.ellipsis),
          ]),
        ),
      ]),
    );
  }
}
