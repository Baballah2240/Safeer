import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:safeer_core/safeer_core.dart';

import 'boarding_controller.dart';
import 'scan_feedback.dart';

/// Builds the camera view. Tests replace it, because widget tests have no camera.
typedef CameraBuilder = Widget Function(BuildContext context, ValueChanged<String> onCode);

/// Full-screen camera with a scan frame, torch, typed ticket numbers and the active route.
/// While a result is on screen, new reads are ignored until the driver taps Scan next.
class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key, required this.trip, required this.controller, this.camera});
  final DriverTrip trip;
  final BoardingController controller;
  final CameraBuilder? camera;
  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  MobileScannerController? _camera;

  BoardingController get c => widget.controller;

  @override
  void initState() {
    super.initState();
    if (widget.camera == null) _camera = MobileScannerController(formats: const [BarcodeFormat.qrCode, BarcodeFormat.code128], detectionSpeed: DetectionSpeed.noDuplicates);
    WidgetsBinding.instance.addPostFrameCallback((_) => c.resetCooldown());
  }

  @override
  void dispose() {
    _camera?.dispose();
    super.dispose();
  }

  bool get _showingResult => c.processing || c.last != null;

  Future<void> _onCode(String raw) async {
    if (_showingResult) return;
    final r = await c.scan(raw);
    if (r != null && mounted) HapticFeedback.mediumImpact();
  }

  Future<void> _typeNumber() async {
    final number = await showModalBottomSheet<String>(context: context, isScrollControlled: true, useSafeArea: true, builder: (_) => const _NumberSheet());
    if (number != null && mounted) await c.check(number);
  }

  void _next() => c.resetCooldown();

  Widget _cameraView(BuildContext context) {
    if (widget.camera != null) return widget.camera!(context, _onCode);
    return MobileScanner(
      controller: _camera,
      onDetect: (capture) {
        final raw = capture.barcodes.map((b) => b.rawValue).whereType<String>().firstOrNull;
        if (raw != null) _onCode(raw);
      },
      errorBuilder: (context, error) => _CameraProblem(denied: error.errorCode == MobileScannerErrorCode.permissionDenied, onType: _typeNumber),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final f = SafeerFormat.of(context);
    final ar = s.isArabic;
    final departs = SafeerFormat.inZone(widget.trip.departureAt, widget.trip.timezone);
    return Scaffold(
      backgroundColor: Colors.black,
      body: ListenableBuilder(
        listenable: c,
        builder: (context, _) => Stack(fit: StackFit.expand, children: [
          _cameraView(context),
          const IgnorePointer(child: _ScanFrame()),
          SafeArea(
            child: Column(children: [
              // Active route and count stay visible above the camera.
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 12, 0),
                child: Row(children: [
                  IconButton.filled(
                    style: IconButton.styleFrom(backgroundColor: const Color(0xCC05142B), foregroundColor: Colors.white),
                    tooltip: MaterialLocalizations.of(context).backButtonTooltip,
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const BackButtonIcon(),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(color: const Color(0xCC05142B), borderRadius: BorderRadius.circular(14)),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                        Text(widget.trip.route.pick(ar), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
                        Text('${f.time(departs)} · ${s.boardedOf(c.boardedCount, c.expectedCount)}', style: const TextStyle(color: Color(0xE6FFFFFF), fontSize: 14)),
                      ]),
                    ),
                  ),
                ]),
              ),
              // Results sit at the bottom, within thumb reach, and scroll when text is large.
              Expanded(
                child: Align(
                  alignment: Alignment.bottomCenter,
                  child: SingleChildScrollView(
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      if (!_showingResult)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                          child: Text(s.aimAtQr, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w600, shadows: [Shadow(blurRadius: 6)])),
                        ),
                      Padding(padding: const EdgeInsets.fromLTRB(12, 0, 12, 12), child: _bottom(context)),
                    ]),
                  ),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _bottom(BuildContext context) {
    final s = SafeerStrings.of(context);
    if (c.processing) {
      return StatusPanel(icon: Icons.hourglass_top, tone: StatusTone.info, title: s.checking, child: const LinearProgressIndicator());
    }
    final last = c.last;
    if (last != null) {
      return ScanResultPanel(result: last, timezone: widget.trip.timezone, actions: [
        if (last.status == ScanStatus.verified && last.credential != null)
          PrimaryButton(label: s.boardPassenger, icon: Icons.how_to_reg, onPressed: () => c.boardChecked(last.credential!)),
        if (last.status == ScanStatus.verified)
          OutlinedButton(onPressed: _next, child: Text(s.cancel))
        else
          PrimaryButton(label: s.scanNext, icon: Icons.qr_code_scanner, onPressed: _next),
      ]);
    }
    return Row(children: [
      if (_camera != null)
        ValueListenableBuilder<MobileScannerState>(
          valueListenable: _camera!,
          builder: (context, state, _) {
            final on = state.torchState == TorchState.on;
            return _RoundAction(
              icon: on ? Icons.flashlight_off : Icons.flashlight_on,
              label: on ? s.torchOff : s.torchOn,
              selected: on,
              toggle: true,
              onTap: state.torchState == TorchState.unavailable ? null : () => _camera!.toggleTorch(),
            );
          },
        ),
      const SizedBox(width: 12),
      Expanded(child: _RoundAction(icon: Icons.keyboard_alt_outlined, label: s.typeTicketNumber, onTap: _typeNumber, wide: true)),
      if (c.repository.isDemo) ...[
        const SizedBox(width: 12),
        _RoundAction(icon: Icons.science_outlined, label: s.demoCodes, onTap: () => _demoScans(context)),
      ],
    ]);
  }

  /// Demo only: feeds sample codes through the same path as the camera.
  Future<void> _demoScans(BuildContext context) async {
    final s = SafeerStrings.of(context);
    const p = Credential.demoPrefix;
    final code = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: ListView(shrinkWrap: true, children: [
          ListTile(title: Text(s.demoCodes, style: Theme.of(context).textTheme.titleMedium)),
          for (final (value, label) in [
            ('$p${DemoDriverRepository.sampleValid}', s.demoValid),
            ('$p${DemoDriverRepository.passengerDemoTicket}', s.demoValid),
            ('$p${DemoDriverRepository.sampleAlready}', s.resAlready),
            ('$p${DemoDriverRepository.sampleWrongTrip}', s.demoWrongTrip),
            ('$p${DemoDriverRepository.sampleRefunded}', s.demoRefunded),
          ])
            ListTile(
              leading: const Icon(Icons.qr_code_2),
              title: Text(value.substring(p.length), textDirection: TextDirection.ltr),
              subtitle: Text(label),
              onTap: () => Navigator.of(context).pop(value),
            ),
        ]),
      ),
    );
    if (code != null) await _onCode(code);
  }
}

class _RoundAction extends StatelessWidget {
  const _RoundAction({required this.icon, required this.label, required this.onTap, this.selected = false, this.wide = false, this.toggle = false});
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool selected, wide;

  /// Only the torch is an on/off control; other round buttons are plain buttons.
  final bool toggle;
  @override
  Widget build(BuildContext context) {
    final body = Material(
      color: selected ? Colors.white : const Color(0xE605142B),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0x66FFFFFF))),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56, minWidth: 56),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Row(mainAxisSize: MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(icon, color: selected ? SafeerBrand.navy : Colors.white),
              if (wide) ...[
                const SizedBox(width: 8),
                Flexible(child: Text(label, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600))),
              ],
            ]),
          ),
        ),
      ),
    );
    return Semantics(button: true, label: label, enabled: onTap != null, toggled: toggle && onTap != null ? selected : null, onTap: onTap, excludeSemantics: true, child: wide ? body : Tooltip(message: label, child: body));
  }
}

/// Dark scrim with a clear square in the middle.
class _ScanFrame extends StatelessWidget {
  const _ScanFrame();
  @override
  Widget build(BuildContext context) => CustomPaint(painter: _FramePainter(), size: Size.infinite);
}

class _FramePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final side = (size.shortestSide * 0.68).clamp(180.0, 340.0);
    final rect = Rect.fromCenter(center: Offset(size.width / 2, size.height * 0.42), width: side, height: side);
    final hole = RRect.fromRectAndRadius(rect, const Radius.circular(24));
    canvas.drawPath(Path.combine(PathOperation.difference, Path()..addRect(Offset.zero & size), Path()..addRRect(hole)), Paint()..color = const Color(0x8C000000));
    final edge = Paint()
      ..color = SafeerBrand.orange
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round;
    const l = 36.0;
    for (final (corner, dx, dy) in [(rect.topLeft, 1.0, 1.0), (rect.topRight, -1.0, 1.0), (rect.bottomLeft, 1.0, -1.0), (rect.bottomRight, -1.0, -1.0)]) {
      canvas.drawLine(corner, corner.translate(l * dx, 0), edge);
      canvas.drawLine(corner, corner.translate(0, l * dy), edge);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _CameraProblem extends StatelessWidget {
  const _CameraProblem({required this.denied, required this.onType});
  final bool denied;
  final VoidCallback onType;
  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    return ColoredBox(
      color: SafeerBrand.deepNavy,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Theme(
            data: Theme.of(context),
            child: StatusPanel(
              icon: denied ? Icons.no_photography_outlined : Icons.videocam_off_outlined,
              tone: StatusTone.warning,
              title: denied ? s.cameraDenied : s.cameraUnavailable,
              message: denied ? s.cameraDeniedHint : null,
              child: PrimaryButton(label: s.typeTicketNumber, icon: Icons.keyboard_alt_outlined, onPressed: onType),
            ),
          ),
        ),
      ),
    );
  }
}

class _NumberSheet extends StatefulWidget {
  const _NumberSheet();
  @override
  State<_NumberSheet> createState() => _NumberSheetState();
}

class _NumberSheetState extends State<_NumberSheet> {
  final _text = TextEditingController(text: 'TKT-');
  String? _problem;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  void _submit() {
    final value = _text.text.trim().toUpperCase();
    final c = Credential.parse(value);
    if (c == null || !c.isNumber) return setState(() => _problem = SafeerStrings.of(context).ticketNumberInvalid);
    Navigator.of(context).pop(value);
  }

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(s.typeTicketNumber, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        TextField(
          controller: _text,
          autofocus: true,
          textDirection: TextDirection.ltr,
          textCapitalization: TextCapitalization.characters,
          keyboardType: TextInputType.visiblePassword,
          autocorrect: false,
          enableSuggestions: false,
          onSubmitted: (_) => _submit(),
          decoration: InputDecoration(labelText: s.ticketNumber, hintText: s.ticketNumberHint, errorText: _problem, prefixIcon: const Icon(Icons.confirmation_number_outlined)),
        ),
        const SizedBox(height: 16),
        PrimaryButton(label: s.checkTicket, icon: Icons.search, onPressed: _submit),
      ]),
    );
  }
}
