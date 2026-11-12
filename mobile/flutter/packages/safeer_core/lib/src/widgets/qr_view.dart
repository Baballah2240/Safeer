import 'package:flutter/material.dart';

import '../models/qr.dart';

/// Black modules on white with a four-module quiet zone, in both themes, so scanners read
/// it outdoors. The squares come from the server; nothing is encoded here.
class QrView extends StatelessWidget {
  const QrView({super.key, required this.qr, required this.semanticLabel, this.size = 240});
  final TicketQr qr;
  final String semanticLabel;
  final double size;
  @override
  Widget build(BuildContext context) => Semantics(
        image: true,
        label: semanticLabel,
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
          child: CustomPaint(painter: _QrPainter(qr)),
        ),
      );
}

class _QrPainter extends CustomPainter {
  _QrPainter(this.qr);
  final TicketQr qr;
  @override
  void paint(Canvas canvas, Size size) {
    final total = qr.size + 8;
    final m = size.width / total;
    final paint = Paint()
      ..color = Colors.black
      ..isAntiAlias = false;
    for (final (x, y) in qr.modules) {
      canvas.drawRect(Rect.fromLTWH((x + 4) * m, (y + 4) * m, m + 0.4, m + 0.4), paint);
    }
  }

  @override
  bool shouldRepaint(_QrPainter old) => old.qr.path != qr.path;
}
