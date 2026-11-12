import 'package:flutter/material.dart';

/// Official SAFEER colours (D71) and the light/dark tokens from src/tokens.css.
/// Status colours follow the Driver dashboard; every status also has an icon and a label.
class SafeerBrand {
  static const navy = Color(0xFF0B2D5B);
  static const sky = Color(0xFF1E90FF);
  static const orange = Color(0xFFFF8C00);
  static const deepNavy = Color(0xFF05142B);
  /// Darker sky blue used behind white text (4.9:1), as in the website's pressed buttons.
  static const skyDeep = Color(0xFF1E6FCC);
}

@immutable
class SafeerPalette extends ThemeExtension<SafeerPalette> {
  const SafeerPalette({
    required this.page,
    required this.paper,
    required this.raised,
    required this.ink,
    required this.muted,
    required this.accent,
    required this.border,
    required this.glass,
    required this.glassEdge,
    required this.warning,
    required this.successBg,
    required this.successInk,
    required this.warningBg,
    required this.warningInk,
    required this.errorBg,
    required this.errorInk,
    required this.infoBg,
    required this.infoInk,
    required this.seatFree,
    required this.seatTaken,
    required this.seatTakenInk,
  });

  final Color page, paper, raised, ink, muted, accent, border, glass, glassEdge, warning;
  final Color successBg, successInk, warningBg, warningInk, errorBg, errorInk, infoBg, infoInk;
  final Color seatFree, seatTaken, seatTakenInk;

  static const dark = SafeerPalette(
    page: Color(0xFF061A35),
    paper: Color(0xFF0B2346),
    raised: Color(0xFF103063),
    ink: Color(0xFFEAF2FC),
    muted: Color(0xFF9FB4CF),
    accent: Color(0xFF8CC8FF),
    border: Color(0xFF23406A),
    glass: Color(0xB80B2346),
    glassEdge: Color(0x47CFE4FF),
    warning: Color(0xFFFFB04D),
    successBg: Color(0xFF102C33),
    successInk: Color(0xFF9BE6C8),
    warningBg: Color(0xFF3C3016),
    warningInk: Color(0xFFFFE0A2),
    errorBg: Color(0xFF401E2B),
    errorInk: Color(0xFFFFD1DC),
    infoBg: Color(0xFF0B2346),
    infoInk: Color(0xFFCFE4FF),
    seatFree: Color(0xFF0B2346),
    seatTaken: Color(0xFF1A2C47),
    seatTakenInk: Color(0xFF7D8FA8),
  );

  static const light = SafeerPalette(
    page: Color(0xFFEEF4FB),
    paper: Color(0xFFFFFFFF),
    raised: Color(0xFFF3F8FE),
    ink: Color(0xFF0B1F3A),
    muted: Color(0xFF52667F),
    accent: Color(0xFF0B2D5B),
    border: Color(0xFFCFDCEC),
    glass: Color(0xD9FFFFFF),
    glassEdge: Color(0xA6FFFFFF),
    warning: Color(0xFFA85300),
    successBg: Color(0xFFE6F6EF),
    successInk: Color(0xFF0D5C43),
    warningBg: Color(0xFFFFF2CD),
    warningInk: Color(0xFF4D3500),
    errorBg: Color(0xFFFFF0F2),
    errorInk: Color(0xFF8C1933),
    infoBg: Color(0xFFF3F0FF),
    infoInk: Color(0xFF0B2D5B),
    seatFree: Color(0xFFFFFFFF),
    seatTaken: Color(0xFFDCE4EE),
    seatTakenInk: Color(0xFF5B6B80),
  );

  static SafeerPalette of(BuildContext context) => Theme.of(context).extension<SafeerPalette>()!;

  @override
  SafeerPalette copyWith() => this;

  @override
  SafeerPalette lerp(ThemeExtension<SafeerPalette>? other, double t) => t < 0.5 || other is! SafeerPalette ? this : other;
}
