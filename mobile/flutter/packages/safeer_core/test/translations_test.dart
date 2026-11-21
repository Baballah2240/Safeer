import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safeer_core/safeer_core.dart';

/// D138: every language in the list is supported by the apps, and every extra language (beyond English and
/// Arabic, which are side by side in strings.dart) translates every English text used in strings.dart.
void main() {
  // The English text of each _t('English', 'Arabic') entry, read from the source.
  final source = File('lib/src/l10n/strings.dart').readAsStringSync();
  final english = RegExp(r"_t\(\s*'((?:[^'\\]|\\.)*)'").allMatches(source).map((m) => m.group(1)!.replaceAll(r"\'", "'")).toSet();

  test('the apps support exactly the listed languages', () {
    expect(SafeerStrings.supportedLocales.map((l) => l.languageCode), [for (final l in safeerLanguages) l.code]);
    expect(english.length, greaterThan(200), reason: 'strings.dart was read');
    for (final l in safeerLanguages) {
      expect(SafeerStrings.delegate.isSupported(Locale(l.code)), isTrue, reason: l.code);
    }
    expect(SafeerStrings.delegate.isSupported(const Locale('xx')), isFalse);
  });

  test('every extra language translates every text', () {
    for (final code in extraTranslations.keys) {
      expect(isSafeerLanguage(code), isTrue, reason: '$code has translations but is not in safeerLanguages');
      final missing = english.where((e) => !(extraTranslations[code]!.containsKey(e))).toList();
      expect(missing, isEmpty, reason: '$code is missing ${missing.length} texts, e.g. ${missing.take(3).join(' | ')}');
    }
    for (final l in safeerLanguages.where((l) => l.code != 'en' && l.code != 'ar')) {
      expect(extraTranslations.containsKey(l.code), isTrue, reason: '${l.code} is listed but has no translation file');
    }
  });

  test('English and Arabic behave as before, and an unknown phone language falls back to English', () {
    expect(SafeerStrings(const Locale('en')).retry, 'Retry');
    expect(SafeerStrings(const Locale('ar')).retry, 'إعادة المحاولة');
    expect(AppSettings.resolve(null, const [Locale('ar', 'SD')]).languageCode, 'ar');
    expect(AppSettings.resolve(null, const [Locale('fr')]).languageCode, 'en');
    expect(AppSettings.resolve(const Locale('en'), const [Locale('ar')]).languageCode, 'en');
  });
}
