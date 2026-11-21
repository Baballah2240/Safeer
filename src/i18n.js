import arCommon from './locales/ar/common.js';
export const arabic=arCommon;
export function translate(value, language) {
  return language === "ar" ? arabic[value] || value : value;
}
