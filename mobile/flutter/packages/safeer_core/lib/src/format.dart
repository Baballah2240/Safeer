import 'dart:math';

import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';
import 'package:timezone/data/latest_10y.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import 'l10n/languages.dart';

/// Arabic and Persian digits become Latin digits, as on the website (ar-SD-u-nu-latn).
String latinDigits(String value) => value.replaceAllMapped(RegExp('[\u0660-\u0669\u06F0-\u06F9]'), (m) {
      final c = m[0]!.codeUnitAt(0);
      return String.fromCharCode(0x30 + (c >= 0x06F0 ? c - 0x06F0 : c - 0x0660));
    });

/// Keeps codes such as SF-ABCD2345, TKT-12345678, SD-KH 4521 or seat 3A readable inside Arabic
/// text, and on one line: a word joiner after each hyphen and no-break spaces (found on a phone,
/// where "SD-KH 3307" broke after its hyphen).
String ltr(String value) => '\u2066${unbroken(value)}\u2069';

String unbroken(String value) => value.replaceAll('-', '-\u2060').replaceAll(' ', '\u00A0');

bool _zonesReady = false;
void _zones() {
  if (!_zonesReady) {
    tzdata.initializeTimeZones();
    _zonesReady = true;
  }
}

/// D143: decimals per currency (ISO 4217), same table as src/money.mjs.
const _currencyExponent = <String, int>{
  'KWD': 3, 'LYD': 3, 'BHD': 3, 'OMR': 3, 'JOD': 3, 'TND': 3, 'IQD': 3,
  'XAF': 0, 'XOF': 0, 'JPY': 0, 'KRW': 0, 'UGX': 0, 'RWF': 0, 'DJF': 0, 'GNF': 0, 'KMF': 0, 'VND': 0,
};
int currencyDigits(String currency) => _currencyExponent[currency] ?? 2;

class SafeerFormat {
  SafeerFormat(this.locale);
  factory SafeerFormat.of(BuildContext context) => SafeerFormat(Localizations.localeOf(context));
  final Locale locale;
  bool get _ar => locale.languageCode == 'ar';
  String get _tag => safeerLanguage(locale.languageCode)?.dateTag ?? 'en_GB';

  /// Integer minor units, like the API. Shows without decimals when whole.
  /// D143: decimals follow the currency (KWD and LYD 3, XAF 0, others 2), as on the website.
  String money(int minor, String currency) {
    final digits = currencyDigits(currency);
    var unit = 1;
    for (var i = 0; i < digits; i++) {
      unit *= 10;
    }
    final whole = minor % unit == 0;
    final number = NumberFormat(whole || digits == 0 ? '#,##0' : '#,##0.${'0' * digits}', 'en').format(minor / unit);
    if (currency == 'SDG') return _ar ? '$number ج.س.' : 'SDG $number';
    return _ar ? '$number $currency' : '$currency $number';
  }

  String time(DateTime value) => DateFormat('HH:mm', 'en').format(value);
  String day(DateTime value) => latinDigits(DateFormat('EEE d MMM', _tag).format(value));
  String dayLong(DateTime value) => latinDigits(DateFormat('EEEE d MMMM y', _tag).format(value));
  /// Arabic comma in Arabic, as in the website text.
  String get comma => _ar ? '، ' : ', ';
  String dayTime(DateTime value) => '${day(value)}$comma${time(value)}';

  /// Server dates like 2026-11-14 are company-local calendar days.
  static DateTime calendarDay(String value) {
    final parts = value.split('-').map(int.parse).toList();
    return DateTime(parts[0], parts[1], parts[2]);
  }

  static String isoDay(DateTime value) =>
      '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';

  /// Converts a server instant to the trip's named time zone (for example Africa/Khartoum).
  static DateTime inZone(DateTime instant, String? zone) {
    if (zone == null || zone.isEmpty) return instant.toLocal();
    try {
      _zones();
      final t = tz.TZDateTime.from(instant, tz.getLocation(zone));
      return DateTime(t.year, t.month, t.day, t.hour, t.minute, t.second);
    } catch (_) {
      return instant.toLocal();
    }
  }
}

/// Random version 4 UUID for booking keys and request keys (dart:math secure random).
String uuidV4() {
  final r = Random.secure();
  final b = List<int>.generate(16, (_) => r.nextInt(256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  final h = b.map((x) => x.toRadixString(16).padLeft(2, '0')).join();
  return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}';
}
