// D59 public shipment tracking by the random code on the receipt. Shows status and offices only.
import {themeButton,drawerIcon,bindSideDrawer} from './theme.js';
import {bottomNavigation} from './passenger-ui.js';

const root=document.querySelector('#track-app'),params=new URLSearchParams(location.search);
let language=params.get('lang')==='ar'?'ar':'en',code=(params.get('code')||'').trim().toUpperCase(),result=null,problem='',busy=false;
const pattern=/^SH-[2-9A-HJ-NP-Z]{8}$/;
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const words={
 en:{title:'Track a shipment',lead:'Enter the tracking code printed on the shipment receipt, for example',code:'Tracking code',track:'Track',back:'Find a bus trip',other:'العربية',
  invalid:'Enter a code in the form SH- followed by 8 letters and numbers.',missing:'We could not find that tracking code. Check it on the receipt.',busy:'Too many attempts. Try again later.',failed:'Tracking is unavailable right now. Try again shortly.',
  from:'From',to:'To',company:'Bus company',trip:'Trip',updated:'Last update',items:'Items',loading:'Checking…',
  collect:'The receiver collects it at the destination office with their phone number and full name.',
  received:'Received',loaded:'Loaded',in_transit:'In transit',arrived:'Arrived',delivered:'Delivered',returned:'Returned to sender',lost:'Lost',delayed:'Delayed — the company is checking it',canceled:'The trip was canceled. Contact the bus company.'},
 ar:{title:'تتبع شحنة',lead:'أدخل رمز التتبع المطبوع على إيصال الشحنة، مثل',code:'رمز التتبع',track:'تتبع',back:'ابحث عن رحلة حافلة',other:'English',
  invalid:'أدخل رمزاً يبدأ بـ SH- يليه ٨ أحرف وأرقام.',missing:'لم نعثر على رمز التتبع هذا. تحقق منه في الإيصال.',busy:'محاولات كثيرة. حاول لاحقاً.',failed:'التتبع غير متاح الآن. حاول بعد قليل.',
  from:'من',to:'إلى',company:'شركة الحافلات',trip:'الرحلة',updated:'آخر تحديث',items:'القطع',loading:'جارٍ التحقق…',
  collect:'يستلمها المستلم من مكتب الوجهة برقم هاتفه واسمه الكامل.',
  received:'مستلمة',loaded:'محمّلة',in_transit:'في الطريق',arrived:'وصلت',delivered:'سُلّمت',returned:'أُرجعت للمرسل',lost:'مفقودة',delayed:'متأخرة — تتحقق الشركة منها',canceled:'أُلغيت الرحلة. تواصل مع شركة الحافلات.'}};
const w=key=>words[language][key];
Object.assign(words.en,{menu:'Menu',close:'Close menu',settings:'Settings',appearance:'Appearance',language:'Language',book:'Book',trips:'Trips',profile:'Profile',navigation:'Passenger navigation'});
Object.assign(words.ar,{menu:'القائمة',close:'إغلاق القائمة',settings:'الإعدادات',appearance:'المظهر',language:'اللغة',book:'احجز',trips:'الرحلات',profile:'الملف الشخصي',navigation:'تنقل المسافرين'});
const link=path=>{const url=new URL(path,location.origin);url.searchParams.set('lang',language);return url.pathname+url.search;};
const navText=key=>({Book:w('book'),Trips:w('trips'),Profile:w('profile'),'Passenger navigation':w('navigation')})[key]||key;
const parcelIcon=()=>drawerIcon('M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10');
const steps=['received','loaded','in_transit','arrived','delivered'];
const when=(row,value)=>value?new Intl.DateTimeFormat(language==='ar'?'ar-SD':'en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:row.timezone}).format(new Date(value)):'';
const pick=(row,key)=>language==='ar'?row[key+'Ar']:row[key+'En'];

function progress(row){
 const at=steps.indexOf(row.status);
 if(at<0)return `<p class="track-state track-state-${e(row.status)}" role="status"><strong>${e(w(row.status))}</strong></p>`;
 return `<ol class="track-steps" aria-label="${e(w('title'))}">${steps.map((s,i)=>`<li class="${i<at?'done':i===at?'current':''}" ${i===at?'aria-current="step"':''}><span aria-hidden="true"></span>${e(w(s))}</li>`).join('')}</ol>`;
}
function view(){
 const menuWasOpen=root.querySelector('#track-menu')?.open,settingsOpen=root.querySelector('#track-settings')?.open,focused=document.activeElement?.id;
 document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';document.title='Safeer | '+w('title');
 const row=result;
 const card=row?`<section class="market-card track-result" aria-live="polite"><p class="market-small"><bdi>${e(row.trackingCode)}</bdi></p>${progress(row)}
  ${row.tripCanceled&&row.status!=='delivered'?`<p class="staff-alert bad">${e(w('canceled'))}</p>`:''}
  <dl class="track-facts"><div><dt>${e(w('from'))}</dt><dd>${e(pick(row,'origin'))}</dd></div><div><dt>${e(w('to'))}</dt><dd>${e(pick(row,'destination'))}</dd></div>
  <div><dt>${e(w('company'))}</dt><dd>${e(pick(row,'companyName'))}</dd></div><div><dt>${e(w('trip'))}</dt><dd>${e(pick(row,'routeName'))} · <bdi>${e(when(row,row.departureAt))}</bdi></dd></div>
  <div><dt>${e(w('items'))}</dt><dd><bdi>${e(row.itemCount)}</bdi></dd></div>${row.updatedAt?`<div><dt>${e(w('updated'))}</dt><dd><bdi>${e(when(row,row.updatedAt))}</bdi></dd></div>`:''}</dl>
  ${row.status==='arrived'?`<p class="market-note">${e(w('collect'))}</p>`:''}</section>`:'';
 root.innerHTML=`<div class="market-bar track-bar app-masthead"><button type="button" id="track-menu-toggle" class="secondary sidebar-toggle app-menu-trigger" aria-label="${e(w('menu'))}" aria-controls="track-menu" aria-haspopup="dialog" aria-expanded="false">${drawerIcon('M6 9h12M6 15h12')}</button><strong class="app-header-name"><img src="/src/brand.svg" width="26" height="26" alt=""><span lang="${language}">${language==='ar'?'سفير':'Safeer'}</span></strong></div>
 <dialog id="track-menu" class="market-drawer" data-app-drawer aria-labelledby="track-menu-title"><div class="market-drawer-head"><div class="market-brand drawer-brand" id="track-menu-title"><img src="/src/brand.svg" width="40" height="40" alt=""><span><small>Safeer</small><strong>${e(w('title'))}</strong></span></div><button type="button" class="secondary app-drawer-close" id="track-menu-close" aria-label="${e(w('close'))}">${drawerIcon('m6 6 12 12M18 6 6 18')}</button></div><p class="drawer-section-label">${e(w('menu'))}</p><nav class="market-drawer-nav" aria-label="${e(w('navigation'))}"><a href="${link('/marketplace')}">${drawerIcon('M4 5h16v12H4zM7 21v-4M17 21v-4M4 11h16')}<span>${e(w('back'))}</span></a><a href="${link('/booking')}">${drawerIcon('M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4zM15 8v2M15 14v2')}<span>${e(w('trips'))}</span></a><a href="${link('/track')}" aria-current="page">${parcelIcon()}<span>${e(w('title'))}</span></a></nav><div class="drawer-bottom"><details id="track-settings" class="app-settings" ${settingsOpen?'open':''}><summary>${drawerIcon('M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z')}<span>${e(w('settings'))}</span>${drawerIcon('m9 6 6 6-6 6')}</summary><div class="market-preferences"><div><span>${e(w('appearance'))}</span>${themeButton(language)}</div><div><span>${e(w('language'))}</span><button type="button" class="secondary" id="track-language" lang="${language==='en'?'ar':'en'}">${e(w('other'))}</button></div></div></details></div></dialog>
 <main class="market-wrap track-wrap"><section class="market-card track-search" aria-labelledby="track-title"><span class="track-emblem" aria-hidden="true">${parcelIcon()}</span><h1 id="track-title">${e(w('title'))}</h1><p class="track-lead">${e(w('lead'))} <bdi dir="ltr">SH-AB23CD45</bdi></p>
 <form id="track-form" class="track-form" novalidate aria-busy="${busy}"><label><span>${e(w('code'))}</span><input name="code" id="track-code" dir="ltr" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="11" placeholder="SH-AB23CD45" value="${e(code)}" ${problem?'aria-invalid="true" aria-describedby="track-problem"':''}></label><button class="primary market-book track-submit" ${busy?'disabled':''}>${drawerIcon('m21 21-5-5M18 10a8 8 0 1 0-16 0 8 8 0 0 0 16 0')}<span>${e(busy?w('loading'):w('track'))}</span></button></form>
 ${problem?`<p class="staff-alert bad" id="track-problem" role="alert">${e(w(problem))}</p>`:''}</section>${card}</main>${bottomNavigation(null,{t:navText,link})}`;
 bindSideDrawer(root,'track-menu','track-menu-toggle','track-menu-close');
 root.querySelector('#track-form').onsubmit=event=>{event.preventDefault();code=new FormData(event.target).get('code').trim().toUpperCase();void lookup();};
 root.querySelector('#track-language').onclick=()=>{code=root.querySelector('[name=code]').value;language=language==='en'?'ar':'en';const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);view();};
 if(menuWasOpen){root.querySelector('#track-menu').showModal();document.documentElement.classList.add('app-drawer-open');root.querySelector('#track-menu-toggle').setAttribute('aria-expanded','true');}
 if(focused)root.querySelector('#'+CSS.escape(focused))?.focus({preventScroll:true});
}
async function lookup(){
 result=null;problem='';
 if(!pattern.test(code)){problem='invalid';view();root.querySelector('[name=code]').focus();return;}
 busy=true;view();
 const url=new URL(location.href);url.searchParams.set('code',code);history.replaceState(null,'',url);
 try{
  const response=await fetch('/api/v1/public/shipments/'+encodeURIComponent(code),{headers:{Accept:'application/json'},cache:'no-store'});
  if(response.status===404)problem='missing';else if(response.status===429)problem='busy';else if(!response.ok)problem='failed';
  else result=(await response.json()).data;
 }catch{problem='failed';}
 busy=false;view();
}
view();
if(code)void lookup();
