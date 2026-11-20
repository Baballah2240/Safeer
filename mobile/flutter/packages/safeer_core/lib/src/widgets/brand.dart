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
  // D131: the Route Pin drawn with depth (lit from the top left): shaded tile with a soft top
  // highlight, a raised pin with its shadow on the tile and a gloss, a lit bus, and a rounded
  // road. All vector, so it stays sharp at any size and screen density.
  static Paint _shade(Rect r, List<Color> colors, {Alignment from = Alignment.topLeft, Alignment to = Alignment.bottomRight}) =>
      Paint()..shader = LinearGradient(begin: from, end: to, colors: colors).createShader(r);

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 120);
    const tile = Rect.fromLTWH(0, 0, 120, 120);
    final tileShape = RRect.fromRectAndRadius(tile, const Radius.circular(28));
    canvas.drawRRect(tileShape, _shade(tile, const [Color(0xFF17407A), SafeerBrand.navy, Color(0xFF061A38)]));
    canvas.save();
    canvas.clipRRect(tileShape);
    canvas.drawOval(const Rect.fromLTWH(-20, -46, 160, 92), Paint()..shader = RadialGradient(colors: [Colors.white.withValues(alpha: .16), Colors.white.withValues(alpha: 0)]).createShader(const Rect.fromLTWH(-20, -46, 160, 92)));
    canvas.restore();
    canvas.drawRRect(tileShape.deflate(.75), Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..shader = _shade(tile, [Colors.white.withValues(alpha: .28), Colors.white.withValues(alpha: 0), Colors.black.withValues(alpha: .25)], from: Alignment.topCenter, to: Alignment.bottomCenter).shader);

    final pin = Path()
      ..moveTo(60, 12)
      ..cubicTo(42, 12, 28, 26, 28, 44)
      ..cubicTo(28, 67, 60, 94, 60, 94)
      ..cubicTo(60, 94, 92, 67, 92, 44)
      ..cubicTo(92, 26, 78, 12, 60, 12)
      ..close();
    const pinBox = Rect.fromLTWH(28, 12, 64, 82);
    // Shadow of the raised pin, and its contact shadow on the road.
    canvas.drawPath(pin.shift(const Offset(3, 5)), Paint()
      ..color = Colors.black.withValues(alpha: .38)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4));
    canvas.drawOval(const Rect.fromLTWH(48, 92, 24, 6), Paint()
      ..color = Colors.black.withValues(alpha: .35)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2));
    canvas.drawPath(pin, _shade(pinBox, const [Color(0xFF6CB8FF), SafeerBrand.sky, SafeerBrand.skyDeep]));
    // Rim light on the left edge and gloss on the top.
    canvas.drawPath(pin, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4
      ..shader = _shade(pinBox, [Colors.white.withValues(alpha: .55), Colors.white.withValues(alpha: 0)], to: Alignment.center).shader);
    canvas.save();
    canvas.clipPath(pin);
    canvas.drawOval(const Rect.fromLTWH(34, 15, 34, 20), Paint()..shader = _shade(const Rect.fromLTWH(34, 15, 34, 20), [Colors.white.withValues(alpha: .45), Colors.white.withValues(alpha: 0)], from: Alignment.topCenter, to: Alignment.bottomCenter).shader);
    canvas.restore();

    // Bus: lit body with a small drop shadow, tinted windscreen, glowing lights.
    const body = Rect.fromLTWH(44, 26, 32, 34);
    final bodyShape = RRect.fromRectAndRadius(body, const Radius.circular(7));
    canvas.drawRRect(bodyShape.shift(const Offset(1.2, 2)), Paint()
      ..color = const Color(0xFF0A3D80).withValues(alpha: .55)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.6));
    canvas.drawRRect(bodyShape, _shade(body, const [Colors.white, Color(0xFFDDE9F7)], from: Alignment.topCenter, to: Alignment.bottomCenter));
    const glass = Rect.fromLTWH(48.5, 31, 23, 13);
    canvas.drawRRect(RRect.fromRectAndRadius(glass, const Radius.circular(2.5)), _shade(glass, const [Color(0xFF24518F), SafeerBrand.navy, Color(0xFF041431)]));
    canvas.drawLine(const Offset(51, 33.5), const Offset(58, 33.5), Paint()
      ..strokeWidth = 1.2
      ..strokeCap = StrokeCap.round
      ..color = Colors.white.withValues(alpha: .35));
    for (final x in const [51.0, 69.0]) {
      canvas.drawCircle(Offset(x, 52), 4.2, Paint()
        ..color = SafeerBrand.orange.withValues(alpha: .45)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.5));
      canvas.drawCircle(Offset(x, 52), 3, Paint()..shader = RadialGradient(center: const Alignment(-.4, -.4), colors: const [Color(0xFFFFD08A), SafeerBrand.orange, Color(0xFFD86F00)]).createShader(Rect.fromCircle(center: Offset(x, 52), radius: 3)));
    }

    // Road: a rounded orange band with a darker underside and a lit top edge.
    final road = Path()
      ..moveTo(16, 104)
      ..cubicTo(44, 90, 76, 90, 104, 104);
    Paint stroke(double width, Paint p) => p
      ..style = PaintingStyle.stroke
      ..strokeWidth = width
      ..strokeCap = StrokeCap.round;
    canvas.drawPath(road.shift(const Offset(0, 1.6)), stroke(7, Paint()..color = const Color(0xFFB85E00)));
    canvas.drawPath(road, stroke(7, _shade(const Rect.fromLTWH(16, 90, 88, 14), const [Color(0xFFFFA733), SafeerBrand.orange], from: Alignment.topCenter, to: Alignment.bottomCenter)));
    canvas.drawPath(road.shift(const Offset(0, -1.6)), stroke(1.4, Paint()..color = Colors.white.withValues(alpha: .35)));
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
