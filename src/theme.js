import './app-retired.js';
import {validateAppRelease} from './app-update-data.js';
import {appRelease} from './app-release.js';
const storageKey='safeer.theme';
const valid=value=>value==='light'||value==='dark';
let theme=document.documentElement.dataset.appSurface?'light':'dark';
try{const saved=localStorage.getItem(storageKey);if(valid(saved))theme=saved;}catch{/* Storage restrictions must not prevent access. */}

const label=language=>language==='ar'
  ?(theme==='dark'?'الوضع الفاتح':'الوضع الداكن')
  :(theme==='dark'?'Light mode':'Dark mode');

function apply(){
  document.documentElement.dataset.theme=theme;
  document.querySelectorAll('[data-theme-toggle]').forEach(button=>{
    button.textContent=label(document.documentElement.lang);
  });
}

export const themeButton=language=>`<button type="button" class="secondary theme-toggle" data-theme-toggle>${label(language)}</button>`;

// Delegation avoids losing form values or focus when the theme changes.
document.addEventListener('click',event=>{
  if(!event.target.closest?.('[data-theme-toggle]'))return;
  theme=theme==='dark'?'light':'dark';
  try{localStorage.setItem(storageKey,theme);}catch{/* Keep this tab functional without persistence. */}
  apply();
});
addEventListener('storage',event=>{
  if(event.key!==storageKey&&event.key!==null)return;
  theme=valid(event.newValue)?event.newValue:'dark';apply();
});
apply();

const sidebarKey='safeer.sidebar.hidden';
let sidebarHidden=false;
try{sidebarHidden=localStorage.getItem(sidebarKey)==='1';}catch{/* Layout remains usable without storage. */}
// D58: on phones the workspace menu is an off-canvas panel that is closed by
// default and slides in from the side; desktop keeps the saved show/hide column.
const phoneQuery=matchMedia('(max-width:760px)');
let sidebarOpen=false;
const sidebarShown=()=>phoneQuery.matches?sidebarOpen:!sidebarHidden;
const sidebarLabel=language=>{
  const shown=sidebarShown();
  if(phoneQuery.matches)return language==='ar'?(shown?'إغلاق القائمة':'فتح القائمة'):(shown?'Close menu':'Open menu');
  return language==='ar'?(shown?'إخفاء القائمة الجانبية':'إظهار القائمة الجانبية'):(shown?'Hide sidebar':'Show sidebar');
};
export const sidebarButton=(language,id)=>`<button type="button" class="secondary sidebar-toggle" data-sidebar-toggle aria-controls="${id}" aria-expanded="${sidebarShown()}" aria-label="${sidebarLabel(language)}" title="${sidebarLabel(language)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path class="toggle-open" d="M6 9h12M6 15h12"/><path class="toggle-close" d="m7 7 10 10M17 7 7 17"/></svg><span>${sidebarLabel(language)}</span></button>`;
function applySidebar(){
  const open=phoneQuery.matches&&sidebarOpen;
  document.documentElement.dataset.sidebarHidden=String(sidebarHidden);
  document.documentElement.dataset.sidebarOpen=String(open);
  document.querySelectorAll('[data-sidebar-toggle]').forEach(button=>{
    // A cross-tab change must not leave focus in navigation that becomes hidden.
    const sidebar=document.getElementById(button.getAttribute('aria-controls'));
    const column=sidebar?.closest('.sidebar-column');
    // The open phone panel is modal: the page behind it is inert.
    if(column)[...column.parentElement.children].forEach(node=>{if(node!==column)node.inert=open;});
    if(!sidebarShown()&&sidebar?.contains(document.activeElement))button.focus();
    const text=sidebarLabel(document.documentElement.lang);
    button.setAttribute('aria-expanded',String(sidebarShown()));
    button.setAttribute('aria-label',text);button.title=text;
    button.querySelector('span').textContent=text;
  });
}
function setPhoneMenu(open,{focus=true}={}){
  if(sidebarOpen===open)return;
  // Slide only for a deliberate open/close; resizing or re-rendering snaps.
  const root=document.documentElement;root.dataset.sidebarMotion='true';clearTimeout(setPhoneMenu.timer);setPhoneMenu.timer=setTimeout(()=>{delete root.dataset.sidebarMotion;},340);
  sidebarOpen=open;applySidebar();
  const button=document.querySelector('[data-sidebar-toggle]'),sidebar=button&&document.getElementById(button.getAttribute('aria-controls'));
  // Start at the current page so the panel opens where the person already is.
  if(open&&focus)(sidebar?.querySelector('[aria-current=page],.nav-item.active')||sidebar?.querySelector('nav :is(a[href],button:not([disabled]))')||sidebar?.querySelector('a[href],button:not([disabled])'))?.focus({preventScroll:true});
  else if(!open&&focus&&button&&(document.activeElement===document.body||sidebar?.contains(document.activeElement)))button.focus({preventScroll:true});
}
// Slide the sidebar out/in and glide the content into place (FLIP). Reduced motion snaps.
let sidebarMoving=false;
const sidebarEase='cubic-bezier(.22,1,.36,1)';
async function toggleSidebar(button){
  const sidebar=document.getElementById(button.getAttribute('aria-controls'));
  const shell=sidebar?.closest('.staff-shell,.shell');
  if(phoneQuery.matches){setPhoneMenu(!sidebarOpen);return;}
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches||!sidebar?.animate;
  const save=()=>{try{localStorage.setItem(sidebarKey,sidebarHidden?'1':'0');}catch{/* Preserve in-memory preference. */}};
  if(still||!shell){sidebarHidden=!sidebarHidden;save();applySidebar();return;}
  sidebarMoving=true;
  const away=(document.documentElement.dir==='rtl'?1:-1)*48+'px';
  const content=[...shell.children].filter(node=>!node.contains(sidebar));
  const before=content.map(node=>node.getBoundingClientRect());
  const out=[{opacity:1,transform:'none',filter:'blur(0)'},{opacity:0,transform:`translateX(${away}) scale(.96)`,filter:'blur(6px)'}];
  try{
    // Apply visibility and accessibility immediately; animation must not delay keyboard state.
    sidebarHidden=!sidebarHidden;save();applySidebar();
    content.forEach((node,i)=>{
      const after=node.getBoundingClientRect(),dx=before[i].left-after.left;
      if(Math.abs(dx)>1)node.animate([{transform:`translateX(${dx}px)`},{transform:'none'}],{duration:420,easing:sidebarEase});
    });
    if(!sidebarHidden)await sidebar.animate([...out].reverse(),{duration:380,easing:sidebarEase}).finished;
  }catch{/* An interrupted animation leaves the final state applied. */}
  finally{sidebarMoving=false;}
}
document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-sidebar-toggle]');
  if(button){if(!sidebarMoving)void toggleSidebar(button);return;}
  if(!phoneQuery.matches||!sidebarOpen)return;
  // Tapping the dimmed backdrop or choosing a destination closes the panel.
  const target=event.target;
  if(target.classList?.contains('sidebar-column')||target.closest?.(':is(.staff-sidebar,.sidebar) :is(a[href],button)'))setPhoneMenu(false,{focus:!target.closest?.('a[href]')});
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&phoneQuery.matches&&sidebarOpen){event.preventDefault();setPhoneMenu(false);}
});
phoneQuery.addEventListener?.('change',()=>{sidebarOpen=false;applySidebar();});
// Password fields can be revealed; the value never leaves the input.
document.addEventListener('click',event=>{
  const reveal=event.target.closest?.('[data-reveal]');
  const field=reveal?.parentElement?.querySelector('input');
  if(!field)return;
  const show=field.type==='password',ar=document.documentElement.lang==='ar';
  field.type=show?'text':'password';
  reveal.setAttribute('aria-pressed',String(show));
  reveal.setAttribute('aria-label',show?(ar?'إخفاء كلمة المرور':'Hide password'):(ar?'إظهار كلمة المرور':'Show password'));
});
const eye='M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6';
export const passwordField=(language,label)=>`<label>${label}<span class="auth-input-wrap"><input name="password" type="password" required autocomplete="current-password" maxlength="128"><button type="button" class="auth-reveal" data-reveal aria-pressed="false" aria-label="${language==='ar'?'إظهار كلمة المرور':'Show password'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${eye}"/></svg></button></span></label>`;
addEventListener('storage',event=>{
  if(event.key!==sidebarKey&&event.key!==null)return;
  sidebarHidden=event.newValue==='1';applySidebar();
});
applySidebar();

// Shared modal navigation: no page re-render when opening or closing a drawer.
export const drawerIcon=path=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
export function bindSideDrawer(root,id,triggerId,closeId){
  const menu=root.querySelector('#'+id),toggle=root.querySelector('#'+triggerId);
  toggle.onclick=()=>{if(!menu.open)menu.showModal();document.documentElement.classList.add('app-drawer-open');toggle.setAttribute('aria-expanded','true');};
  root.querySelector('#'+closeId).onclick=()=>menu.close();
  menu.addEventListener('close',()=>{if(!document.querySelector('dialog[data-app-drawer][open]'))document.documentElement.classList.remove('app-drawer-open');toggle.setAttribute('aria-expanded','false');if(toggle.isConnected)toggle.focus({preventScroll:true});});
  menu.addEventListener('click',event=>{if(event.target!==menu)return;const r=menu.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)menu.close();});
  menu.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',()=>menu.close()));
}

// App renders replace their mastheads. Only sticky staff headers reserve
// vertical clearance; body wordmarks scroll normally.
if(typeof ResizeObserver==='function'){
  let header;
  const measureHeader=()=>{
    if(!header?.isConnected)return;
    const height=header.classList.contains('app-masthead')?0:Math.ceil(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--sticky-header-height',height+'px');
  };
  const sizes=new ResizeObserver(entries=>{if(entries.some(entry=>entry.target===header))measureHeader();});
  const followHeader=()=>{
    const current=document.querySelector('.staff-topbar,.driver-header,.market-bar,.topbar');
    if(current===header)return;
    sizes.disconnect();header=current;
    if(header){sizes.observe(header);measureHeader();}
  };
  const renders=new MutationObserver(followHeader);
  renders.observe(document.body,{childList:true,subtree:true});
  followHeader();
}

// Layout motion. Only transform/opacity animate, so text, data and controls stay untouched.
const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const tiles='.staff-welcome,.staff-summary article,.staff-shortcuts button,.staff-panel,.staff-record,.metric,.panel,.market-band,.market-trip,.market-card,.market-companies article,.driver-trip,.driver-detail>*';
let viewKey='';
function revealView(){
  // Replays only when the page or section heading changes, not on ordinary refreshes.
  const heading=document.querySelector('.staff-topbar strong,.topbar h1,main h1,.market-band h1,.driver-header strong');
  const key=location.pathname+location.search+'|'+(heading?.textContent||'')+'|'+(document.querySelector('[aria-current=page]')?.textContent||'');
  if(key===viewKey)return;viewKey=key;
  if(calm()||!document.body.animate)return;
  [...document.querySelectorAll(tiles)].filter(node=>node.getBoundingClientRect().top<innerHeight&&!node.querySelector('.market-seats,.trip-seat-map,.seat-map,.bus')).slice(0,24).forEach((node,i)=>{
    node.animate([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:460,delay:Math.min(i*38,420),easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});
  });
}
let revealQueued=false;
new MutationObserver(()=>{if(revealQueued)return;revealQueued=true;requestAnimationFrame(()=>{revealQueued=false;revealView();});}).observe(document.body,{childList:true,subtree:true});
revealView();

// Stronger header glass once the page scrolls under it.
const markScroll=()=>document.documentElement.classList.toggle('page-scrolled',scrollY>8);
addEventListener('scroll',markScroll,{passive:true});markScroll();

// Soft ripple from the press point on buttons (not seats, whose colours carry meaning).
document.addEventListener('pointerdown',event=>{
  const button=event.target.closest?.('button:not(:disabled):not(.seat):not(.market-seat):not(.trip-seat),.workspace-link,.market-book');
  if(!button||calm()||!button.animate)return;
  const box=button.getBoundingClientRect(),size=Math.max(box.width,box.height)*2,dot=document.createElement('span');
  dot.className='press-ripple';dot.setAttribute('aria-hidden','true');
  dot.style.cssText=`width:${size}px;height:${size}px;left:${event.clientX-box.left-size/2}px;top:${event.clientY-box.top-size/2}px`;
  button.append(dot);
  dot.animate([{transform:'scale(0)',opacity:.35},{transform:'scale(1)',opacity:0}],{duration:520,easing:'ease-out'}).finished.finally(()=>dot.remove());
});

// Store-required notices shown wherever someone signs in or gives personal details.
export const legalLinks=language=>{
  const ar=language==='ar',q='?lang='+(ar?'ar':'en');
  return `<p class="legal-links"><a href="/privacy${q}">${ar?'سياسة الخصوصية':'Privacy policy'}</a><span aria-hidden="true"> · </span><a href="/account-deletion${q}">${ar?'حذف الحساب والبيانات':'Delete account and data'}</a></p>`;
};

// D60: download and update notices for the Android apps. The installed app adds
// "SafeerApp/<versionCode> (<flavor>)" to its user agent; files live on GitHub releases.
// D78: the downloads are the Flutter apps (Safeer Passenger and Safeer Driver). Only the retired WebView
// apps send that user agent, and app-retired.js shows them the new app's download instead of the page.
let releases=validateAppRelease(appRelease);
const installed=/SafeerApp\/(\d+) \((driver|booking)\)/.exec(navigator.userAgent);
const androidBrowser=!installed&&/Android/i.test(navigator.userAgent);
const downloadIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';
const appWords=(language,flavor)=>language==='ar'
  ?{name:flavor==='driver'?'تطبيق سفير السائق':'تطبيق سفير المسافر',update:'يتوفر تحديث جديد',updateLink:'تنزيل التحديث',get:'احصل على التطبيق',getLink:'تنزيل',download:'تنزيل تطبيق أندرويد',version:'الإصدار'}
  :{name:flavor==='driver'?'Safeer Driver app':'Safeer Passenger app',update:'A new version is available',updateLink:'Download update',get:'Get the app',getLink:'Download',download:'Download Android app',version:'Version'};
export const releaseFor=flavor=>releases.apps[flavor]||null;
export const appOutdated=(flavor=installed?.[2])=>{const file=releaseFor(flavor);return Boolean(installed&&installed[2]===flavor&&file&&Number(installed[1])<file.versionCode);};
export const appVersionLabel=(flavor=installed?.[2])=>{const file=releaseFor(flavor)||releases;return file?'v'+file.versionName:'';};
export function appBanner(language,flavor){
  const file=releaseFor(flavor),w=appWords(language,flavor);
  if(!file)return '';
  const kind=appOutdated(flavor)?'update':androidBrowser||(installed&&installed[2]!==flavor)?'get':'';
  if(!kind)return '';
  return `<aside class="app-banner app-banner-${kind}" aria-label="${w.name}">${downloadIcon}<span><strong>${kind==='update'?w.update:w.get}</strong><small>${w.name} · ${w.version} <bdi>${file.versionName}</bdi></small></span><a class="app-banner-link" href="${file.url}" rel="noopener">${kind==='update'?w.updateLink:w.getLink}</a></aside>`;
}
export function appDrawerLink(language,flavor){
  const file=releaseFor(flavor),w=appWords(language,flavor);
  if(!file||(flavor!=='driver'&&installed&&installed[2]===flavor&&!appOutdated(flavor)))return '';
  return `<a class="drawer-download" ${flavor==='driver'?'data-driver-download':''} href="${file.url}" rel="noopener">${downloadIcon}<span>${appOutdated(flavor)?w.updateLink:flavor==='driver'?(language==='ar'?'\u062a\u0646\u0632\u064a\u0644 \u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u0633\u0627\u0626\u0642':'Download Driver app'):w.download}<small>${w.version} <bdi>${file.versionName}</bdi></small></span></a>`;
}

const updateWords={"en":{"check":"Check for updates","checking":"Checking for updates…","latest":"Latest Driver version","failed":"Could not check for updates. Try again or use Download Driver app."},"ar":{"check":"التحقق من التحديثات","checking":"جارٍ التحقق من التحديثات…","latest":"أحدث إصدار للسائق","failed":"تعذر التحقق من التحديثات. أعد المحاولة أو استخدم تنزيل تطبيق السائق."}};
let updateRequest=null,updateState='',lastUpdateAttempt=0;
const driverPage=()=>document.documentElement.dataset.appSurface==='driver';
const updateStatus=language=>{const w=updateWords[language==='ar'?'ar':'en'];return updateState==='checking'?w.checking:updateState==='failed'?w.failed:updateState==='ok'?w.latest+' · '+releaseFor('driver').versionName:'';};
export function driverUpdateControls(language){
 const w=updateWords[language==='ar'?'ar':'en'];
 return '<button type="button" class="drawer-nav-action" data-check-app-update '+(updateRequest?'disabled':'')+'>'+downloadIcon+'<span>'+w.check+'</span></button><p class="driver-update-status" data-app-update-status role="status" aria-live="polite">'+updateStatus(language)+'</p>';
}
function refreshDriverUpdateUi(){
 if(!driverPage())return;const language=document.documentElement.lang==='ar'?'ar':'en';
 const banner=document.querySelector('[data-driver-update-banner]'),markup=appBanner(language,'driver');if(banner&&banner.innerHTML!==markup)banner.innerHTML=markup;
 document.querySelectorAll('[data-driver-download]').forEach(link=>{const holder=document.createElement('template');holder.innerHTML=appDrawerLink(language,'driver');const next=holder.content.firstElementChild;if(next){link.href=next.href;if(link.innerHTML!==next.innerHTML)link.innerHTML=next.innerHTML;}});
 document.querySelectorAll('[data-app-update-status]').forEach(n=>n.textContent=updateStatus(language));
 document.querySelectorAll('[data-check-app-update]').forEach(n=>n.disabled=Boolean(updateRequest));
 document.querySelectorAll('#driver-menu .drawer-version').forEach(n=>n.textContent=appVersionLabel('driver'));
}
export function refreshAppRelease({force=false}={}){
 if(!driverPage())return Promise.resolve(false);
 if(updateRequest)return updateRequest;
 if(!force&&(document.hidden||Date.now()-lastUpdateAttempt<15000))return Promise.resolve(false);
 lastUpdateAttempt=Date.now();updateState='checking';
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
 const task=(async()=>{
  try{const response=await fetch('/mobile/releases',{cache:'no-store',credentials:'omit',signal:controller.signal,headers:{Accept:'application/json'}});if(!response.ok)throw Error('Release unavailable');
   releases=validateAppRelease(await response.json(),releases);updateState='ok';return true;
  }catch{updateState='failed';return false;}
  finally{clearTimeout(timeout);}
 })();
 updateRequest=task;refreshDriverUpdateUi();
 void task.finally(()=>{if(updateRequest===task)updateRequest=null;refreshDriverUpdateUi();});
 return task;
}
document.addEventListener('click',event=>{if(event.target.closest?.('[data-check-app-update],#driver-menu-toggle'))void refreshAppRelease({force:true});});
addEventListener('pageshow',()=>void refreshAppRelease());
addEventListener('focus',()=>void refreshAppRelease());
addEventListener('online',()=>void refreshAppRelease({force:true}));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshAppRelease();});
if(driverPage()){queueMicrotask(()=>void refreshAppRelease());setInterval(()=>{if(!document.hidden)void refreshAppRelease();},60000);}
