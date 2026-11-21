// D138: the languages Safeer speaks. To add one: add it here, then add src/locales/<code>/<area>.js files (copy the
// Arabic ones and translate the values) and import them in that area's module next to the Arabic file.
// English is the source language: its text is the key, so it needs no translation files of its own except for
// codes (errors, labels). Names typed by companies (cities, routes) exist in English and Arabic only, so other
// languages show the English names.
export const languages={
 en:{name:'English',short:'EN',dir:'ltr',intl:'en-GB'},
 ar:{name:'العربية',short:'ع',dir:'rtl',intl:'ar-SD-u-nu-latn'},
};
export const languageShort=code=>languages[code]?.short||code.toUpperCase();
export const languageCodes=Object.keys(languages);
export const supported=code=>Object.hasOwn(languages,code);
export const languageOr=(code,fallback='en')=>supported(code)?code:fallback;
export const isRtl=code=>languages[code]?.dir==='rtl';
export const textDir=code=>languages[code]?.dir||'ltr';
export const intlLocale=code=>languages[code]?.intl||'en-GB';
export const languageName=code=>languages[code]?.name||code;
// The language switch moves through the list (with two languages: English <-> Arabic, as before).
export const nextLanguage=code=>languageCodes[(languageCodes.indexOf(code)+1)%languageCodes.length];
// Looks a text up in the current language's dictionary; English (the key) when there is no translation.
export const lookup=(dictionaries,code,key)=>(code!=='en'&&dictionaries[code]?.[key])||key;
