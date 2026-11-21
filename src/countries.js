import {languageOr} from './locales/index.js';
// D135: countries Safeer can serve (same list as apps/api/src/countries.ts): calling code, default currency and
// time zone. Names come from the browser in the page language.
export const countries={SD:['249','SDG','Africa/Khartoum'],EG:['20','EGP','Africa/Cairo'],SS:['211','SSP','Africa/Juba'],SA:['966','SAR','Asia/Riyadh'],AE:['971','AED','Asia/Dubai'],QA:['974','QAR','Asia/Qatar'],OM:['968','OMR','Asia/Muscat'],KW:['965','KWD','Asia/Kuwait'],BH:['973','BHD','Asia/Bahrain'],JO:['962','JOD','Asia/Amman'],LY:['218','LYD','Africa/Tripoli'],TD:['235','XAF','Africa/Ndjamena'],ET:['251','ETB','Africa/Addis_Ababa'],ER:['291','ERN','Africa/Asmara'],KE:['254','KES','Africa/Nairobi'],UG:['256','UGX','Africa/Kampala']};
export function countryName(code,language){try{return new Intl.DisplayNames([languageOr(language)],{type:'region'}).of(code)||code;}catch{return code;}}
export const countryOptions=language=>Object.keys(countries).map(code=>[code,countryName(code,language)]).sort((a,b)=>a[1].localeCompare(b[1],language));
// Picking a country fills its time zone and currency in the same form; they can still be changed.
export function bindCountryDefaults(root=document){
 root.addEventListener('change',event=>{const select=event.target;if(!(select instanceof HTMLSelectElement)||select.name!=='countryCode'||!select.form)return;
  const place=countries[select.value];if(!place)return;const form=select.form;
  if(form.elements.timezone)form.elements.timezone.value=place[2];if(form.elements.currency)form.elements.currency.value=place[1];});
}
