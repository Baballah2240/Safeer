/// D138: the languages the apps speak (same list as the website's src/locales/index.js).
///
/// English and Arabic are written side by side in strings.dart. To add a language:
///  1. add it to [safeerLanguages] below;
///  2. add lib/src/l10n/translations/<code>.dart with a `const Map<String, String>` from each English text in
///     strings.dart to its translation, and register it in [extraTranslations];
///  3. run the tests: test/translations_test.dart fails while any text is missing.
/// Names typed by companies (cities, routes) exist in English and Arabic only, so other languages show English.
library;

import 'translations/all.dart';

class SafeerLanguage {
  const SafeerLanguage(this.code, this.name, {this.rtl = false, this.dateTag = 'en_GB'});
  final String code;

  /// The language's own name, shown in Settings.
  final String name;
  final bool rtl;

  /// intl locale used for dates and numbers.
  final String dateTag;
}

const safeerLanguages = [
  SafeerLanguage('en', 'English'),
  SafeerLanguage('ar', 'العربية', rtl: true, dateTag: 'ar'),
];

/// Translations for languages other than English and Arabic: language code -> English text -> translation.
const Map<String, Map<String, String>> extraTranslations = allExtraTranslations;

SafeerLanguage? safeerLanguage(String? code) {
  for (final l in safeerLanguages) {
    if (l.code == code) return l;
  }
  return null;
}

bool isSafeerLanguage(String? code) => safeerLanguage(code) != null;
