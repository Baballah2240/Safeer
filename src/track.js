import enTrack from './locales/en/track.js';
import arTrack from './locales/ar/track.js';
import arCommon from './locales/ar/common.js';
import {intlLocale,nextLanguage,textDir,lookup as fromLocale,languageOr} from './locales/index.js';
import './app-back.js';
import {shimmer} from './loading.js';
// D59 public shipment tracking by the random code on the receipt. Shows status and offices only.
import {themeButton,drawerIcon,bindSideDrawer} from './theme.js';
import {bottomNavigation} from './passenger-ui.js';

const root=document.querySelector('#track-app'),params=new URLSearchParams(location.search);
let language=languageOr(params.get('lang')),code=(params.get('code')||'').trim().toUpperCase(),result=null,problem='',busy=false;
const pattern=/^S[HF]-[2-9A-HJ-NP-Z]{8}$/,isTrip=value=>value.startsWith('SF-');
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const words={en:enTrack,ar:arTrack};
Object.assign(words.en,{title:'Track a trip or shipment',lead:'Enter your booking reference to follow your bus, or the tracking code on a shipment receipt, for example',code:'Booking reference or tracking code',
 invalid:'Enter a booking reference (SF- followed by 8 letters and numbers) or a tracking code (SH-…).',missing:'We could not find that reference. Check it on your ticket or receipt.',
 tripTitle:'Your trip',notStarted:'Not started yet',onTheWay:'On the way',reachedDest:'Arrived at the destination',tripClosed:'Trip completed',planned:'Planned',reachedAt:'Reached',startedAt:'Started',nextStop:'Next stop',refreshNote:'This page shows the latest update recorded by the driver.'});
Object.assign(words.ar,{title:'تتبع رحلة أو شحنة',lead:'أدخل رقم الحجز لتتبع حافلتك، أو رمز التتبع المطبوع على إيصال الشحنة، مثل',code:'رقم الحجز أو رمز التتبع',
 invalid:'أدخل رقم حجز (SF- يليه ٨ أحرف وأرقام) أو رمز تتبع (SH-…).',missing:'لم نعثر على هذا الرقم. تحقق منه في تذكرتك أو الإيصال.',
 tripTitle:'رحلتك',notStarted:'لم تبدأ بعد',onTheWay:'في الطريق',reachedDest:'وصلت إلى الوجهة',tripClosed:'اكتملت الرحلة',planned:'المخطط',reachedAt:'الوصول',startedAt:'الانطلاق',nextStop:'المحطة التالية',refreshNote:'تعرض هذه الصفحة آخر تحديث سجله السائق.'});
const w=key=>words[language]?.[key]??words.en[key];
Object.assign(words.en,{menu:'Menu',close:'Close menu',settings:'Settings',appearance:'Appearance',language:'Language',book:'Book',trips:'Trips',profile:'Profile',navigation:'Passenger navigation',parcels:'Parcels',staff:'Staff sign in',staffNote:'For company and station employees',howTitle:'How to send a parcel',how1:'Hand it in at a bus company office on your route and pay there.',how2:'Keep the receipt: its tracking code shows here where the parcel is.',how3:'The receiver collects it at the destination office with their phone number and full name.',companies:'Choose a bus company',again:'Track another code',next:'What next'});
Object.assign(words.ar,{menu:'القائمة',close:'إغلاق القائمة',settings:'الإعدادات',appearance:'المظهر',language:'اللغة',book:'احجز',trips:'الرحلات',profile:'الملف الشخصي',navigation:'تنقل المسافرين',parcels:'الطرود',staff:'دخول الموظفين',staffNote:'لموظفي الشركات والمحطات',howTitle:'كيف ترسل طرداً',how1:'سلّمه في مكتب شركة حافلات على طريقك وادفع هناك.',how2:'احتفظ بالإيصال: رمز التتبع عليه يُظهر هنا مكان الطرد.',how3:'يستلمه المستلم من مكتب الوجهة برقم هاتفه واسمه الكامل.',companies:'اختر شركة حافلات',again:'تتبع رمزاً آخر',next:'الخطوة التالية'});
const link=path=>{const url=new URL(path,location.origin);url.searchParams.set('lang',language);return url.pathname+url.search;};
const navText=key=>({Book:w('book'),Trips:w('trips'),Parcels:w('parcels'),Profile:w('profile'),'Passenger navigation':w('navigation')})[key]||key;
const parcelIcon=()=>drawerIcon('M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10');
const steps=['received','loaded','in_transit','arrived','delivered'];
const when=(row,value)=>value?new Intl.DateTimeFormat(intlLocale(language),{dateStyle:'medium',timeStyle:'short',timeZone:row.timezone}).format(new Date(value)):'';
const pick=(row,key)=>language==='ar'?row[key+'Ar']:row[key+'En'];

function progress(row){
 const at=steps.indexOf(row.status);
 if(at<0)return `<p class="track-state track-state-${e(row.status)}" role="status"><strong>${e(w(row.status))}</strong></p>`;
 return `<ol class="track-steps" aria-label="${e(w('title'))}">${steps.map((s,i)=>`<li class="${i<at?'done':i===at?'current':''}" ${i===at?'aria-current="step"':''}><span aria-hidden="true"></span>${e(w(s))}</li>`).join('')}</ol>`;
}
function tripCard(row){
 const stops=row.stops||[],next=stops.find(s=>!s.reachedAt),state=row.closedAt?'tripClosed':row.arrivedAt?'reachedDest':row.departedAt?'onTheWay':'notStarted';
 const place=s=>e(language==='ar'?(s.stationAr?s.cityAr+' · '+s.stationAr:s.cityAr):(s.stationEn?s.cityEn+' · '+s.stationEn:s.cityEn));
 return `<section class="market-card track-result track-trip" aria-live="polite"><p class="market-small"><bdi>${e(code)}</bdi> · ${e(pick(row,'company'))}</p><h2>${e(w('tripTitle'))}</h2>
  <p class="track-state track-state-${state}" role="status"><strong>${e(w(state))}</strong>${row.departedAt&&!row.arrivedAt&&next?` · ${e(w('nextStop'))}: ${place(next)}`:''}</p>
  <ol class="track-journey">${stops.map(s=>`<li class="${s.reachedAt?'done':s===next&&row.departedAt?'current':''}"><span aria-hidden="true"></span><div><strong>${place(s)}</strong><small>${e(w('planned'))} <bdi>${e(when(row,s.plannedAt))}</bdi>${s.reachedAt?` · ${e(w(s.index===0?'startedAt':'reachedAt'))} <bdi>${e(when(row,s.reachedAt))}</bdi>`:''}</small></div></li>`).join('')}</ol>
  <p class="market-note">${e(w('refreshNote'))}</p><div class="track-next"><button type="button" class="secondary" data-track-again>${e(w('again'))}</button><a href="${link('/marketplace')}">${e(w('back'))}</a></div></section>`;
}
function view(){
 const menuWasOpen=root.querySelector('#track-menu')?.open,settingsOpen=root.querySelector('#track-settings')?.open,focused=document.activeElement?.id;
 document.documentElement.lang=language;document.documentElement.dir=textDir(language);document.title='Safeer | '+w('title');
 const row=result;
 const card=row&&row.stops?tripCard(row):row?`<section class="market-card track-result" aria-live="polite"><p class="market-small"><bdi>${e(row.trackingCode)}</bdi></p>${progress(row)}
  ${row.tripCanceled&&row.status!=='delivered'?`<p class="staff-alert bad">${e(w('canceled'))}</p>`:''}
  <dl class="track-facts"><div><dt>${e(w('from'))}</dt><dd>${e(pick(row,'origin'))}</dd></div><div><dt>${e(w('to'))}</dt><dd>${e(pick(row,'destination'))}</dd></div>
  <div><dt>${e(w('company'))}</dt><dd>${e(pick(row,'companyName'))}</dd></div><div><dt>${e(w('trip'))}</dt><dd>${e(pick(row,'routeName'))} · <bdi>${e(when(row,row.departureAt))}</bdi></dd></div>
  <div><dt>${e(w('items'))}</dt><dd><bdi>${e(row.itemCount)}</bdi></dd></div>${row.updatedAt?`<div><dt>${e(w('updated'))}</dt><dd><bdi>${e(when(row,row.updatedAt))}</bdi></dd></div>`:''}</dl>
  ${row.status==='arrived'?`<p class="market-note">${e(w('collect'))}</p>`:''}
  <div class="track-next" role="group" aria-label="${e(w('next'))}"><button type="button" class="secondary" data-track-again>${e(w('again'))}</button><a href="${link('/marketplace')}">${e(w('back'))}</a></div></section>`:'';
 const how=`<section class="market-card track-how" aria-labelledby="track-how-title"><h2 id="track-how-title">${e(w('howTitle'))}</h2><ol>${['how1','how2','how3'].map((k,i)=>`<li><span aria-hidden="true">${i+1}</span><p>${e(w(k))}</p></li>`).join('')}</ol><a class="track-how-link" href="${link('/marketplace')}#send-parcel">${e(w('companies'))}</a></section>`;
 root.innerHTML=`<div class="market-bar track-bar app-masthead"><button type="button" id="track-menu-toggle" class="secondary sidebar-toggle app-menu-trigger" aria-label="${e(w('menu'))}" aria-controls="track-menu" aria-haspopup="dialog" aria-expanded="false">${drawerIcon('M6 9h12M6 15h12')}</button><strong class="app-header-name"><img src="/src/brand.svg" width="26" height="26" alt=""><span lang="${language}">${fromLocale({ar:arCommon},language,'Safeer')}</span></strong></div>
 <dialog id="track-menu" class="market-drawer" data-app-drawer aria-labelledby="track-menu-title"><div class="market-drawer-head"><div class="market-brand drawer-brand" id="track-menu-title"><img src="/src/brand.svg" width="40" height="40" alt=""><span><small>Safeer</small><strong>${e(w('title'))}</strong></span></div><button type="button" class="secondary app-drawer-close" id="track-menu-close" aria-label="${e(w('close'))}">${drawerIcon('m6 6 12 12M18 6 6 18')}</button></div><p class="drawer-section-label">${e(w('menu'))}</p><nav class="market-drawer-nav" aria-label="${e(w('navigation'))}"><a href="${link('/marketplace')}">${drawerIcon('M4 5h16v12H4zM7 21v-4M17 21v-4M4 11h16')}<span>${e(w('back'))}</span></a><a href="${link('/booking')}">${drawerIcon('M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4zM15 8v2M15 14v2')}<span>${e(w('trips'))}</span></a><a href="${link('/track')}" aria-current="page">${parcelIcon()}<span>${e(w('title'))}</span></a><a href="${link('/staff')}">${drawerIcon('M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3')}<span>${e(w('staff'))}</span></a></nav><div class="drawer-bottom"><details id="track-settings" class="app-settings" ${settingsOpen?'open':''}><summary>${drawerIcon('M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z')}<span>${e(w('settings'))}</span>${drawerIcon('m9 6 6 6-6 6')}</summary><div class="market-preferences"><div><span>${e(w('appearance'))}</span>${themeButton(language)}</div><div><span>${e(w('language'))}</span><button type="button" class="secondary" id="track-language" lang="${nextLanguage(language)}">${e(w('other'))}</button></div></div></details></div></dialog>
 <main class="market-wrap track-wrap"><div class="track-grid"><div class="track-col"><section class="market-card track-search" aria-labelledby="track-title"><span class="track-emblem" aria-hidden="true">${parcelIcon()}</span><h1 id="track-title">${e(w('title'))}</h1><p class="track-lead">${e(w('lead'))} <bdi dir="ltr">SF-AB23CD45</bdi> · <bdi dir="ltr">SH-AB23CD45</bdi></p>
 <form id="track-form" class="track-form" novalidate aria-busy="${busy}"><label><span>${e(w('code'))}</span><input name="code" id="track-code" dir="ltr" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="11" placeholder="SF-AB23CD45" value="${e(code)}" ${problem?'aria-invalid="true" aria-describedby="track-problem"':''}></label><button class="primary market-book track-submit" ${busy?'disabled':''}>${drawerIcon('m21 21-5-5M18 10a8 8 0 1 0-16 0 8 8 0 0 0 16 0')}<span>${e(busy?w('loading'):w('track'))}</span></button></form>
 ${problem?`<p class="staff-alert bad" id="track-problem" role="alert">${e(w(problem))}</p>`:''}</section>${busy?shimmer(language,{compact:true}):card}</div>${how}</div></main>${bottomNavigation('parcels',{t:navText,link})}`;
 bindSideDrawer(root,'track-menu','track-menu-toggle','track-menu-close');
 root.querySelector('[data-track-again]')?.addEventListener('click',()=>{code='';result=null;problem='';const url=new URL(location.href);url.searchParams.delete('code');history.replaceState(null,'',url);view();root.querySelector('#track-code').focus();});
 root.querySelector('#track-form').onsubmit=event=>{event.preventDefault();code=new FormData(event.target).get('code').trim().toUpperCase();void lookup();};
 root.querySelector('#track-language').onclick=()=>{code=root.querySelector('[name=code]').value;language=nextLanguage(language);const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);view();};
 if(menuWasOpen){root.querySelector('#track-menu').showModal();document.documentElement.classList.add('app-drawer-open');root.querySelector('#track-menu-toggle').setAttribute('aria-expanded','true');}
 if(focused)root.querySelector('#'+CSS.escape(focused))?.focus({preventScroll:true});
}
// D72: only the newest lookup may show its answer, so a slow earlier reply never replaces a later code's status.
let lookupSequence=0;
async function lookup(){
 const sequence=++lookupSequence,asked=code;
 result=null;problem='';
 if(!pattern.test(code)){problem='invalid';busy=false;view();root.querySelector('[name=code]').focus();return;}
 busy=true;view();
 const url=new URL(location.href);url.searchParams.set('code',code);history.replaceState(null,'',url);
 let answer=null,failure='';
 try{
  const response=await fetch((isTrip(asked)?'/api/v1/public/track/trips/':'/api/v1/public/shipments/')+encodeURIComponent(asked),{headers:{Accept:'application/json'},cache:'no-store'});
  if(response.status===404)failure='missing';else if(response.status===429)failure='busy';else if(!response.ok)failure='failed';
  else answer=(await response.json()).data;
 }catch{failure='failed';}
 if(sequence!==lookupSequence)return;
 result=answer;problem=failure;busy=false;view();
}
view();
if(code)void lookup();
