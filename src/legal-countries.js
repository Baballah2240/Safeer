// D139 (global plan: legal pages per country): what the privacy, deletion and terms pages say for each
// country Safeer can serve (same codes as src/countries.js). This is a plain-language summary, not legal
// advice: a local lawyer must check a country's text before Safeer launches there, then set live:true.
// law: the main personal data law (null when the country has no general one); regulator: who to complain to;
// cards: passengers can pay by card there (Paymob, D136). Text is [English, Arabic].
import {countries} from './countries.js';
export const legalCountries={
 SD:{live:true,cards:false,law:null,regulator:null},
 EG:{live:false,cards:true,law:['Personal Data Protection Law No. 151 of 2020','قانون حماية البيانات الشخصية رقم ١٥١ لسنة ٢٠٢٠'],regulator:['the Personal Data Protection Center','مركز حماية البيانات الشخصية'],consumer:['Consumer Protection Law No. 181 of 2018','قانون حماية المستهلك رقم ١٨١ لسنة ٢٠١٨']},
 SS:{live:false,cards:false,law:null,regulator:null},
 SA:{live:false,cards:false,law:['Personal Data Protection Law (Royal Decree M/19)','نظام حماية البيانات الشخصية (المرسوم الملكي م/١٩)'],regulator:['the Saudi Data and AI Authority (SDAIA)','الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا)']},
 AE:{live:false,cards:false,law:['Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data','المرسوم بقانون اتحادي رقم ٤٥ لسنة ٢٠٢١ بشأن حماية البيانات الشخصية'],regulator:['the UAE Data Office','مكتب الإمارات للبيانات']},
 QA:{live:false,cards:false,law:['Law No. 13 of 2016 on Personal Data Privacy Protection','القانون رقم ١٣ لسنة ٢٠١٦ بشأن حماية خصوصية البيانات الشخصية'],regulator:null},
 OM:{live:false,cards:false,law:['Personal Data Protection Law (Royal Decree 6/2022)','قانون حماية البيانات الشخصية (المرسوم السلطاني ٦/٢٠٢٢)'],regulator:null},
 KW:{live:false,cards:false,law:null,regulator:null},
 BH:{live:false,cards:false,law:['Law No. 30 of 2018 on Personal Data Protection','القانون رقم ٣٠ لسنة ٢٠١٨ بشأن حماية البيانات الشخصية'],regulator:null},
 JO:{live:false,cards:false,law:['Personal Data Protection Law No. 24 of 2023','قانون حماية البيانات الشخصية رقم ٢٤ لسنة ٢٠٢٣'],regulator:null},
 LY:{live:false,cards:false,law:null,regulator:null},
 TD:{live:false,cards:false,law:['Law No. 007/PR/2015 on the Protection of Personal Data','القانون رقم ٠٠٧/PR/٢٠١٥ بشأن حماية البيانات الشخصية'],regulator:null},
 ET:{live:false,cards:false,law:['Personal Data Protection Proclamation No. 1321/2024','إعلان حماية البيانات الشخصية رقم ١٣٢١/٢٠٢٤'],regulator:null},
 ER:{live:false,cards:false,law:null,regulator:null},
 KE:{live:false,cards:false,law:['Data Protection Act, 2019','قانون حماية البيانات لعام ٢٠١٩'],regulator:['the Office of the Data Protection Commissioner','مكتب مفوض حماية البيانات']},
 UG:{live:false,cards:false,law:['Data Protection and Privacy Act, 2019','قانون حماية البيانات والخصوصية لعام ٢٠١٩'],regulator:['the Personal Data Protection Office','مكتب حماية البيانات الشخصية']},
};
for(const code of Object.keys(countries))if(!legalCountries[code])throw Error('legal-countries.js is missing '+code);
const STORE='safeer.legal.country';
// The country comes from ?country=, then the reader's last choice, then Sudan.
export function legalCountry(params){
 const asked=String(params.get('country')||'').toUpperCase();
 if(legalCountries[asked]){try{localStorage.setItem(STORE,asked);}catch{}return asked;}
 try{const saved=localStorage.getItem(STORE);if(legalCountries[saved])return saved;}catch{}
 return 'SD';
}
