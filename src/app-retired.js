// D78: the Android WebView apps (Safeer Booking 0.17 and Safeer Driver 0.18) are retired. The Flutter apps that
// replaced them never load the website, so a "SafeerApp/<versionCode> (<flavor>)" user agent is always one of the
// old WebView apps. Every page then shows only the download of the new app, which installs over the old one
// (same Android app ID and signing key). Other browsers load nothing more than this file.
const flavor=/SafeerApp\/\d+ \((driver|booking)\)/.exec(navigator.userAgent)?.[1];
if(flavor){
 // Hide the page at once; the page scripts still run underneath but are never shown. Nothing on the hidden
 // page may block the download either, so its dialogs open without making the rest of the page inert.
 document.documentElement.classList.add('app-retired-on');
 const hideOthers=screen=>{for(const node of document.body.children)if(node!==screen&&!node.hasAttribute('hidden'))node.setAttribute('hidden','');};
 hideOthers(null);
 HTMLDialogElement.prototype.showModal=function(){if(!this.open)this.show();};
 const [{appRelease},{validateAppRelease}]=await Promise.all([import('./app-release.js'),import('./app-update-data.js')]);
 let file=null;try{file=validateAppRelease(appRelease).apps[flavor]||null;}catch{file=null;}
 mount(flavor,file,hideOthers);
}

function words(language,app){
 const ar=language==='ar',passenger=app==='booking';
 return ar?{
  old:passenger?'تطبيق سفير للحجز':'تطبيق سفير للسائق',
  title:'تم استبدال هذا التطبيق',
  lead:passenger?'لدى سفير تطبيق جديد للمسافرين هو سفير المسافر. لم يعد هذا الإصدار يفتح سفير.':'لدى سفير تطبيق جديد للسائقين هو سفير السائق. لم يعد هذا الإصدار يفتح سفير.',
  download:passenger?'تنزيل سفير المسافر':'تنزيل سفير السائق',
  meta:(version,size)=>`أندرويد 8 أو أحدث · الإصدار <bdi>${version}</bdi>${size?` · <bdi>${size}</bdi>&nbsp;ميغابايت`:''}`,
  steps:['اضغط زر التنزيل.','افتح الملف الذي تم تنزيله واضغط تحديث. يُثبَّت التطبيق الجديد فوق هذا التطبيق.',passenger?'افتح سفير المسافر.':'افتح سفير السائق وسجّل الدخول بحساب السائق.'],
  note:passenger?'حجزت بهذا التطبيق من قبل؟ افتح <bdi dir="ltr">safeer.mohbaba.online/booking</bdi> في متصفح هاتفك واستخدم «ابحث عن حجزك» بمرجع الحجز ورقم الجوال.':'رحلاتك وسجلات الصعود محفوظة على سفير ولن تتغير.',
  other:'English',otherLang:'en',otherLabel:'Switch to English'
 }:{
  old:passenger?'Safeer Booking app':'Safeer Driver app',
  title:'This app has been replaced',
  lead:passenger?'Safeer has a new app for passengers, Safeer Passenger. This version no longer opens Safeer.':'Safeer has a new app for drivers, Safeer Driver. This version no longer opens Safeer.',
  download:passenger?'Download Safeer Passenger':'Download Safeer Driver',
  meta:(version,size)=>`Android 8 or later · version <bdi>${version}</bdi>${size?` · <bdi>${size}</bdi>&nbsp;MB`:''}`,
  steps:['Tap Download.','Open the downloaded file and tap Update. The new app installs over this one.',passenger?'Open Safeer Passenger.':'Open Safeer Driver and sign in with your driver account.'],
  note:passenger?'Booked with this app before? In your phone’s browser, open <bdi dir="ltr">safeer.mohbaba.online/booking</bdi> and use Find your booking with the booking reference and mobile number.':'Your trips and boarding records stay on Safeer.',
  other:'العربية',otherLang:'ar',otherLabel:'التبديل إلى العربية'
 };
}

function mount(app,file,hideOthers){
 const asked=new URLSearchParams(location.search).get('lang');
 let language=asked==='ar'||asked==='en'?asked:/^ar\b/i.test(navigator.language||'')?'ar':'en';
 const screen=document.createElement('main');screen.className='app-retired';screen.hidden=true;screen.setAttribute('aria-labelledby','app-retired-title');
 // The old apps open only Safeer GitHub release links outside the app, in the phone's browser.
 const href=file?.url||'https://github.com/Baballah2240/Safeer/releases/latest';
 const size=file?.bytes?String(Math.max(1,Math.round(file.bytes/1048576))):'';
 const render=()=>{
  const w=words(language,app);
  screen.lang=language;screen.dir=language==='ar'?'rtl':'ltr';
  screen.innerHTML=`<div class="app-retired-card"><div class="app-retired-top"><img src="/src/brand.svg" width="36" height="36" alt=""><span class="app-retired-brand">${language==='ar'?'سفير':'Safeer'}</span><button type="button" class="app-retired-lang" lang="${w.otherLang}" aria-label="${w.otherLabel}">${w.other}</button></div>`
   +`<p class="app-retired-eyebrow">${w.old}</p><h1 id="app-retired-title" tabindex="-1">${w.title}</h1><p class="app-retired-lead">${w.lead}</p>`
   +`<a class="app-retired-download" href="${href}" rel="noopener" data-retired-download="${app}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg><span>${w.download}</span></a>`
   +(file?`<p class="app-retired-meta">${w.meta(file.versionName,size)}</p>`:'')
   +`<ol class="app-retired-steps">${w.steps.map(step=>`<li>${step}</li>`).join('')}</ol><p class="app-retired-note">${w.note}</p></div>`;
  document.title=w.title+(language==='ar'?' | سفير':' | Safeer');
 };
 render();
 screen.addEventListener('click',event=>{
  if(!event.target.closest('.app-retired-lang'))return;
  language=language==='ar'?'en':'ar';render();screen.querySelector('.app-retired-lang').focus();
 });
 const place=()=>{if(screen.parentNode!==document.body)document.body.prepend(screen);hideOthers(screen);};
 place();new MutationObserver(place).observe(document.body,{childList:true});
 // Show the screen once its styles are in, so it never flashes unstyled.
 let shown=false;
 const show=()=>{if(shown)return;shown=true;screen.hidden=false;screen.querySelector('h1').focus({preventScroll:true});};
 const style=document.createElement('link');style.rel='stylesheet';style.href='/src/app-retired.css';
 style.addEventListener('load',show,{once:true});style.addEventListener('error',show,{once:true});setTimeout(show,2000);
 document.head.append(style);
}
