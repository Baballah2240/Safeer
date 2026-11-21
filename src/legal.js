import enLegal from './locales/en/legal.js';
import arLegal from './locales/ar/legal.js';
import {languageOr,nextLanguage} from './locales/index.js';
import {themeButton} from './theme.js';

// Fill before store submission: a monitored email or web form for privacy and deletion requests.
// Store listings need this to be filled in.
export const SUPPORT_CONTACT='mohammedbaballah142@gmail.com';

const params=new URLSearchParams(location.search),language=languageOr(params.get('lang')),ar=language==='ar';
const page=location.pathname==='/account-deletion'?'deletion':'privacy';
const e=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const contact=SUPPORT_CONTACT?`<a href="mailto:${e(SUPPORT_CONTACT)}">${e(SUPPORT_CONTACT)}</a>`:(ar?'(يُضاف عنوان التواصل قبل النشر)':'(contact address is added before publishing)');
const T=({en:enLegal,ar:arLegal}[language]||enLegal)(contact);
document.documentElement.lang=language;document.documentElement.dir=ar?'rtl':'ltr';
document.title='Safeer | '+(page==='privacy'?T.privacy:T.deletion);
if(!ar)T.privacyBody.push(['Driver camera','Camera access in the Driver app is optional for scanning ticket QR codes. Frames are processed on your device and are never uploaded or saved. Only the ticket code is sent over the encrypted connection for validation and boarding. We do not request microphone permission or record audio. You can enter a printed ticket number instead.']);
if(ar)T.privacyBody.push(["كاميرا السائق","إذن الكاميرا في تطبيق السائق اختياري لمسح رموز التذاكر. تُعالج إطارات الكاميرا على جهازك ولا تُرفع أو تُحفظ. يُرسل رمز التذكرة فقط عبر اتصال مشفّر للتحقق وتسجيل الصعود. لا نطلب إذن الميكروفون أو نسجّل الصوت. يمكنك إدخال رقم التذكرة المطبوع بدلاً من الكاميرا."]);
const other=`${location.pathname}?lang=${nextLanguage(language)}`;
document.getElementById('legal-app').innerHTML=`<header class="staff-topbar legal-top"><div class="staff-topbar-title legal-title"><a class="staff-link legal-back" href="/?lang=${language}" data-legal-back><span aria-hidden="true">${ar?'→':'←'}</span> ${ar?'رجوع':'Back'}</a><strong>Safeer / سفير</strong></div><div class="staff-top-actions"><a class="staff-link" href="${other}">${T.other}</a>${themeButton(language)}</div></header>
<article class="staff-panel legal-body"><h1>${page==='privacy'?T.privacy:T.deletion}</h1><p class="staff-muted">${T.updated}</p>${(page==='privacy'?T.privacyBody:T.deletionBody).map(([h,b])=>`<h2>${h}</h2><div>${/^</.test(b)?b:`<p>${b}</p>`}</div>`).join('')}
<p><a href="${page==='privacy'?'/account-deletion':'/privacy'}?lang=${language}">${page==='privacy'?T.deletion:T.privacy}</a></p><p><a class="staff-link legal-back" href="/?lang=${language}" data-legal-back><span aria-hidden="true">${ar?'→':'←'}</span> ${ar?'رجوع':'Back'}</a></p></article>`;
// Back returns to the Safeer page the reader came from (booking, profile, staff, driver app); opened directly, it goes home.
// The site sends no referrer, so ask the Navigation API, which only lists this site's own pages in the tab.
const cameFromSafeer=()=>{try{return window.navigation?.canGoBack===true;}catch{return false;}};
document.querySelectorAll('[data-legal-back]').forEach(link=>link.addEventListener('click',event=>{if(cameFromSafeer()){event.preventDefault();history.back();}}));
