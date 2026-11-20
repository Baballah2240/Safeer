import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:safeer_core/safeer_core.dart';

import 'app.dart';

/// D130: the sound after a scan. Valid, needs a look, or not valid.
enum ScanSound { ok, check, bad }

ScanSound scanSound(ScanStatus status) => switch (status) {
      ScanStatus.boarded || ScanStatus.verified => ScanSound.ok,
      ScanStatus.alreadyBoarded || ScanStatus.boardingClosed || ScanStatus.pending => ScanSound.check,
      _ => ScanSound.bad,
    };

/// Plays [scanSound] through Android's tone generator (MainActivity "safeer/sound"); silent
/// where there is no such channel (tests, other platforms).
class ScanBeeper {
  static const _channel = MethodChannel('safeer/sound');

  /// Replaced in tests to record what would play.
  static Future<void> Function(ScanSound sound) play = (sound) async {
    try {
      await _channel.invokeMethod('play', sound.name);
    } catch (_) {}
  };
}

/// Every outcome has its own icon, title and explanation, never colour alone.
(IconData, String, String?, StatusTone) describeScan(SafeerStrings s, SafeerFormat f, ScanResult r, String timezone) {
  String at(DateTime? d) => d == null ? '' : f.time(SafeerFormat.inZone(d, timezone));
  return switch (r.status) {
    ScanStatus.boarded => (Icons.check_circle, s.resBoarded, null, StatusTone.success),
    ScanStatus.verified => (Icons.verified_outlined, s.resVerified, null, StatusTone.info),
    ScanStatus.alreadyBoarded => (Icons.replay_circle_filled_outlined, s.resAlready, s.resAlreadyHint(at(r.boardedAt)), StatusTone.warning),
    ScanStatus.wrongTrip => (Icons.alt_route, s.resWrongTrip, s.resWrongTripHint, StatusTone.error),
    ScanStatus.invalid => (Icons.cancel_outlined, s.resInvalid, s.resInvalidHint, StatusTone.error),
    ScanStatus.notSafeer => (Icons.qr_code_scanner, s.resInvalid, s.resNotSafeer, StatusTone.error),
    ScanStatus.boardingClosed => (Icons.lock_clock, s.resClosed, s.resClosedHint, StatusTone.warning),
    ScanStatus.pending => (Icons.hourglass_top, s.resPending, s.resPendingHint, StatusTone.info),
    ScanStatus.failed => (Icons.error_outline, driverError(s, ApiException(0, r.code ?? '')), null, StatusTone.error),
  };
}

class ScanResultPanel extends StatelessWidget {
  const ScanResultPanel({super.key, required this.result, required this.timezone, this.actions = const []});
  final ScanResult result;
  final String timezone;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final f = SafeerFormat.of(context);
    final (icon, title, hint, tone) = describeScan(s, f, result, timezone);
    final hasPerson = result.seat != null || result.name != null || result.ticket != null;
    return StatusPanel(
      icon: icon,
      title: title,
      message: hint,
      tone: tone,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (hasPerson)
          Wrap(spacing: 20, runSpacing: 8, children: [
            if (result.seat != null) InfoPair(label: s.seat, value: result.seat!, ltrValue: true, large: true),
            if (result.name != null) InfoPair(label: s.passenger, value: result.name!),
            if (result.ticket != null) InfoPair(label: s.ticketNumber, value: result.ticket!, ltrValue: true),
            if (result.boards != null && result.leaves != null) InfoPair(label: s.journeyLabel, value: s.journey(result.boards!.pick(s.isArabic), result.leaves!.pick(s.isArabic))),
          ]),
        if (actions.isNotEmpty) ...[
          if (hasPerson) const SizedBox(height: 14),
          for (final a in actions) Padding(padding: const EdgeInsets.only(top: 8), child: a),
        ],
      ]),
    );
  }
}
