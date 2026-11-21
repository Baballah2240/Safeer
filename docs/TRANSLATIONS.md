# Translations

Safeer is written in English, with Arabic for every visible text. English is the source language: the
English sentence (or an error/permission code) is the key, and other languages translate it.

## Website (`src/locales/`)

| File | What it holds |
|---|---|
| `src/locales/index.js` | The language list: code, own name, short label, direction (ltr/rtl), date/number format. The language switch, `?lang=`, page direction and date formats all come from here. |
| `src/locales/ar/*.js` | Arabic, one file per area: `staff`, `booking`, `account`, `driver`, `track`, `common`, `theme`, `home`, `legal`, `retired`, `plurals`. Most are plain `{"English": "Arabic"}` maps. `home.js` keeps its texts under `text`. `legal.js` and `retired.js` export small functions, because they insert a support address or choose between the two apps. |
| `src/locales/en/*.js` | English texts that are not their own key: staff/driver error messages and permission labels (by code), plus English versions of the functions above. |

Check: `npm run check:translations` (part of `npm run check`). It fails when:
- a fixed text passed to `t('...')` has no Arabic translation;
- a listed language lacks any of the Arabic files, or any key in them.

Names typed by companies (cities, routes, stations, company names) are stored in English and Arabic in the
database, so a third language shows the English names.

### Adding a language (example: French)

1. Add it to `languages` in `src/locales/index.js`, for example `fr:{name:'Français',short:'FR',dir:'ltr',intl:'fr-FR'}`.
2. Copy `src/locales/ar/` to `src/locales/fr/` and translate the values (keep the keys). For `legal.js` and
   `retired.js`, translate the text inside the function.
3. In each module that imports an Arabic file, import the French one next to it and add it where the Arabic one is
   used. Search for `{ar:` and `ar:arTrack`, for example `{en:enTrack,ar:arTrack,fr:frTrack}`.
4. Run `node scripts/register-locales.mjs` (or add the files to `config/assets.mjs`), then `npm run check:translations`
   and the browser tests.

## Phone apps (`mobile/flutter/packages/safeer_core/lib/src/l10n/`)

- `strings.dart`: English and Arabic side by side for every text (`_t('English', 'Arabic')`).
- `languages.dart`: the language list (code, own name, right-to-left, date format) used for supported locales,
  Settings > Language and the phone-language default.
- `translations/<code>.dart`: one map from English text to translation per extra language, registered in
  `translations/all.dart`.

Check: `test/translations_test.dart` fails when a listed language has no translation file or misses any text in
`strings.dart`.
