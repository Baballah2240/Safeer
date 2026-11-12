import 'package:flutter/material.dart';

import 'palette.dart';

/// Bundled fonts (same Google Fonts versions as src/fonts): Inter for Latin text and all
/// numerals, Noto Sans Arabic for Arabic. Latin digits are used in both languages.
const interFamily = 'packages/safeer_core/Inter';
const arabicFamily = 'packages/safeer_core/NotoSansArabic';

ThemeData safeerTheme(Brightness brightness, {required bool arabic}) {
  final p = brightness == Brightness.dark ? SafeerPalette.dark : SafeerPalette.light;
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme(
    brightness: brightness,
    primary: dark ? p.accent : SafeerBrand.navy,
    onPrimary: dark ? SafeerBrand.deepNavy : Colors.white,
    secondary: SafeerBrand.sky,
    onSecondary: Colors.white,
    tertiary: SafeerBrand.orange,
    onTertiary: SafeerBrand.deepNavy,
    error: p.errorInk,
    onError: p.errorBg,
    surface: p.paper,
    onSurface: p.ink,
    onSurfaceVariant: p.muted,
    outline: p.border,
    outlineVariant: p.border,
    surfaceContainerHighest: p.raised,
    surfaceContainerHigh: p.raised,
    surfaceContainer: p.paper,
    surfaceContainerLow: p.paper,
    surfaceContainerLowest: p.page,
  );
  // As on the website: Inter for Latin text and every numeral, Noto Sans Arabic for Arabic
  // letters (by per-glyph fallback). Arabic gets more line spacing.
  final height = arabic ? 1.6 : 1.35;
  const family = interFamily;
  const fallback = [arabicFamily];
  // Every style names the bundled fonts, so component themes (app bar, buttons, chips) use them too.
  TextStyle style(double size, FontWeight weight, [Color? color]) =>
      TextStyle(fontFamily: family, fontFamilyFallback: fallback, fontSize: size, fontWeight: weight, height: height, color: color ?? p.ink);
  final text = TextTheme(
    displaySmall: style(28, FontWeight.w700),
    headlineMedium: style(26, FontWeight.w700),
    headlineSmall: style(24, FontWeight.w600),
    titleLarge: style(20, FontWeight.w600),
    titleMedium: style(18, FontWeight.w600),
    titleSmall: style(16, FontWeight.w600),
    bodyLarge: style(16, FontWeight.w400),
    bodyMedium: style(16, FontWeight.w400),
    bodySmall: style(14, FontWeight.w400, p.muted),
    labelLarge: style(16, FontWeight.w500),
    labelMedium: style(14, FontWeight.w500),
    labelSmall: style(13, FontWeight.w500, p.muted),
  );
  final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(16));
  final field = OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: p.border));
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: p.page,
    canvasColor: p.page,
    fontFamily: family,
    fontFamilyFallback: fallback,
    textTheme: text,
    extensions: [p],
    visualDensity: VisualDensity.standard,
    materialTapTargetSize: MaterialTapTargetSize.padded,
    appBarTheme: AppBarTheme(
      backgroundColor: p.page,
      foregroundColor: p.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: text.titleMedium,
    ),
    cardTheme: CardThemeData(color: p.paper, surfaceTintColor: Colors.transparent, elevation: 0, shape: shape.copyWith(side: BorderSide(color: p.border)), margin: EdgeInsets.zero),
    dividerTheme: DividerThemeData(color: p.border, space: 1, thickness: 1),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: p.paper,
      border: field,
      enabledBorder: field,
      focusedBorder: field.copyWith(borderSide: const BorderSide(color: SafeerBrand.sky, width: 2)),
      errorBorder: field.copyWith(borderSide: BorderSide(color: p.errorInk)),
      focusedErrorBorder: field.copyWith(borderSide: BorderSide(color: p.errorInk, width: 2)),
      labelStyle: style(16, FontWeight.w500, p.muted),
      floatingLabelStyle: style(16, FontWeight.w600, dark ? p.accent : SafeerBrand.navy),
      hintStyle: style(16, FontWeight.w400, p.muted),
      errorStyle: style(13, FontWeight.w500, p.errorInk),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(64, 52),
        backgroundColor: SafeerBrand.skyDeep,
        foregroundColor: Colors.white,
        textStyle: text.labelLarge?.copyWith(fontWeight: FontWeight.w600),
        shape: shape,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(64, 52),
        foregroundColor: dark ? p.accent : SafeerBrand.navy,
        side: BorderSide(color: dark ? p.accent.withValues(alpha: 0.55) : SafeerBrand.navy.withValues(alpha: 0.4)),
        textStyle: text.labelLarge?.copyWith(fontWeight: FontWeight.w600),
        shape: shape,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(minimumSize: const Size(48, 48), foregroundColor: dark ? p.accent : SafeerBrand.navy, textStyle: text.labelLarge),
    ),
    iconButtonTheme: IconButtonThemeData(style: IconButton.styleFrom(minimumSize: const Size(48, 48), foregroundColor: p.ink)),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: p.paper,
      surfaceTintColor: Colors.transparent,
      indicatorColor: SafeerBrand.sky.withValues(alpha: dark ? 0.28 : 0.16),
      labelTextStyle: WidgetStatePropertyAll(text.labelMedium),
      iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(color: s.contains(WidgetState.selected) ? (dark ? p.accent : SafeerBrand.navy) : p.muted)),
      height: 72,
    ),
    bottomSheetTheme: BottomSheetThemeData(backgroundColor: p.paper, surfaceTintColor: Colors.transparent, showDragHandle: true, dragHandleColor: p.muted),
    dialogTheme: DialogThemeData(backgroundColor: p.paper, surfaceTintColor: Colors.transparent, shape: shape),
    snackBarTheme: SnackBarThemeData(behavior: SnackBarBehavior.floating, backgroundColor: dark ? p.raised : SafeerBrand.navy, contentTextStyle: text.bodyMedium?.copyWith(color: Colors.white)),
    chipTheme: ChipThemeData(backgroundColor: p.paper, selectedColor: SafeerBrand.sky.withValues(alpha: dark ? 0.3 : 0.16), side: BorderSide(color: p.border), labelStyle: text.labelMedium, shape: StadiumBorder(side: BorderSide(color: p.border))),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: SafeerBrand.sky),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: SegmentedButton.styleFrom(selectedBackgroundColor: SafeerBrand.sky.withValues(alpha: dark ? 0.3 : 0.16), selectedForegroundColor: p.ink, foregroundColor: p.ink, side: BorderSide(color: p.border), minimumSize: const Size(48, 48)),
    ),
    listTileTheme: ListTileThemeData(iconColor: p.muted, textColor: p.ink, minVerticalPadding: 12),
  );
}
