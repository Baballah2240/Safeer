import arCommon from './locales/ar/common.js';
import enLegal,{countryText as enCountry} from './locales/en/legal.js';
import arLegal,{countryText as arCountry} from './locales/ar/legal.js';
import {legalCountries,legalCountry} from './legal-countries.js';
import {countryOptions,countryName} from './countries.js';
import {languageOr,nextLanguage,isRtl,lookup} from './locales/index.js';
import {themeButton} from './theme.js';

// Fill before store submission: a monitored email or web form for privacy and deletion requests.
// Store listings need this to be filled in.
export const SUPPORT_CONTACT='mohammedbaballah142@gmail.com';

const params=new URLSearchParams(location.search),language=languageOr(params.get('lang')),ar=language==='ar';
const page={'/account-deletion':'deletion','/terms':'terms'}[location.pathname]||'privacy';
const e=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const contact=SUPPORT_CONTACT?`<a href="mailto:${e(SUPPORT_CONTACT)}">${e(SUPPORT_CONTACT)}</a>`:null;
const T=({en:enLegal,ar:arLegal}[language]||enLegal)(contact);
// D139: the country changes the law, regulator, card payment and launch notes; the rest is the same everywhere.
const country=legalCountry(params),place=legalCountries[country],C=({en:enCountry,ar:arCountry}[language]||enCountry)(countryName(country,language),place,contact);
const query=(lang=language)=>`?lang=${lang}&country=${country}`;
const titles={privacy:T.privacy,deletion:T.deletion,terms:T.terms};
const sections={privacy:[...T.privacyBody.filter(([h])=>place.cards||h!==T.cardsHeading).map(([h,b])=>h===T.cardsHeading?[h,b.replaceAll('Paymob',place.provider)]:[h,b]),C.privacy],deletion:[...T.deletionBody,C.deletion],terms:C.terms}[page];
const links=['privacy','terms','deletion'].filter(x=>x!==page).map(x=>`<a href="${{privacy:'/privacy',terms:'/terms',deletion:'/account-deletion'}[x]}${query()}">${titles[x]}</a>`).join(' · ');
document.documentElement.lang=language;document.documentElement.dir=ar?'rtl':'ltr';
document.title='Safeer | '+titles[page];
const other=location.pathname+query(nextLanguage(language));
document.getElementById('legal-app').innerHTML=`<header class="staff-topbar legal-top"><div class="staff-topbar-title legal-title"><a class="staff-link legal-back" href="/?lang=${language}" data-legal-back><span aria-hidden="true">${isRtl(language)?'→':'←'}</span> ${lookup({ar:arCommon},language,'Back')}</a><strong>Safeer / سفير</strong></div><div class="staff-top-actions"><a class="staff-link" href="${other}">${T.other}</a>${themeButton(language)}</div></header>
<article class="staff-panel legal-body"><h1>${titles[page]}</h1><p class="staff-muted">${T.updated}</p><label class="legal-country">${C.country} <select id="legal-country" name="country">${countryOptions(language).map(([code,name])=>`<option value="${code}"${code===country?' selected':''}>${e(name)}</option>`).join('')}</select></label>${place.live?'':`<p class="staff-notice legal-draft" role="note">${C.draft}</p>`}${sections.map(([h,b])=>`<h2>${h}</h2><div>${/^</.test(b)?b:`<p>${b}</p>`}</div>`).join('')}
<p class="legal-links">${links}</p><p><a class="staff-link legal-back" href="/?lang=${language}" data-legal-back><span aria-hidden="true">${isRtl(language)?'→':'←'}</span> ${lookup({ar:arCommon},language,'Back')}</a></p></article>`;
document.getElementById('legal-country').addEventListener('change',event=>{location.search=`?lang=${language}&country=${event.target.value}`;});
// Back returns to the Safeer page the reader came from (booking, profile, staff, driver app); opened directly, it goes home.
// The site sends no referrer, so ask the Navigation API, which only lists this site's own pages in the tab.
const cameFromSafeer=()=>{try{return window.navigation?.canGoBack===true;}catch{return false;}};
document.querySelectorAll('[data-legal-back]').forEach(link=>link.addEventListener('click',event=>{if(cameFromSafeer()){event.preventDefault();history.back();}}));
