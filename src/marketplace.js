import arBooking from './locales/ar/booking.js';
const arabic=arBooking;
import './app-back.js';
import {shimmer} from './loading.js';
import {bottomNavigation,journeyCard,journeyTimeline,boardingDetails,isPastBooking,icon as passengerIcon} from './passenger-ui.js';
import {accountArabic,loadAccount,linkBooking,accountSection,bindAccount,prefill} from './passenger-account.js';
import {themeButton,drawerIcon as menuIcon,bindSideDrawer,legalLinks,appBanner,appDrawerLink,appVersionLabel} from './theme.js';
let serviceNotice=null;
// D82: a listed company's own colors and logo on its public page.
let brand=null;
const root=document.querySelector('#market'),params=new URL(location.href).searchParams,slugMatch=/^\/company\/([a-z0-9-]+)$/.exec(location.pathname),slug=slugMatch?.[1]||null;
let language=params.get('lang')==='ar'?'ar':'en',cities=[],companies=[],trips=[],company=null,failure='',searchFailure='',sort='time',searched=false,loading=true;
let tripId=/^\/trip\/([0-9a-f-]{36})$/.exec(location.pathname)?.[1]||null,holdRef=/^\/hold\/(SF-[2-9A-HJ-NP-Z]{8})$/.exec(location.pathname)?.[1]||null,seatTrip=null,selected=[],holdKey=null,holdError='',holding=false,booking=null,bookingKey=null,clockOffset=0,confirming=false,releaseError='',releasing=false,checking=false,unresolved=false,summaryHtml='',myHold=null,lookupMode=location.pathname==='/booking',lookupReference='',lookupMobile='',lookupError='',lookingUp=false,retrievedMobile=null;
const names={},bags={};let contactMobile='';
let query={from:params.get('from')||'',to:params.get('to')||'',date:params.get('date')||''};
arabic['Only bookings saved on this device are listed. Times are published by the company.']="تظهر الحجوزات المحفوظة على هذا الجهاز فقط. المواعيد كما تنشرها الشركة.";
arabic['Book without an account. Keep your reference to find a booking on another device.']="احجز دون حساب. احتفظ بمرجع الحجز للعثور عليه من جهاز آخر.";
Object.assign(arabic,accountArabic);
// D89: the passenger's own stops on a trip page (?from=&to= are stop indexes; missing means the whole trip).
const stopParam=name=>{const v=new URLSearchParams(location.search).get(name);return /^\d{1,2}$/.test(v||'')?Number(v):null;};
let journey={from:stopParam('from'),to:stopParam('to')};
const journeyQuery=()=>journey.from!==null&&journey.to!==null?`?from=${journey.from}&to=${journey.to}`:'';
const t=key=>language==='ar'?(arabic[key]||key):key,e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick=(row,key)=>language==='ar'?row[key+'Ar']:row[key+'En'],locale=()=>language==='ar'?'ar-SD-u-nu-latn':'en-GB';
// Arabic counts change their wording with the number, so each phrase is chosen by plural category.
const phrases={trips:{en:{one:n=>`${n} trip found`,other:n=>`${n} trips found`},ar:{zero:()=>'لا توجد رحلات',one:()=>'رحلة واحدة',two:()=>'رحلتان',few:n=>`${n} رحلات`,many:n=>`${n} رحلة`,other:n=>`${n} رحلة`}},seatsLeft:{en:{one:n=>`${n} seat left`,other:n=>`${n} seats left`},ar:{zero:()=>'لا توجد مقاعد متبقية',one:()=>'مقعد واحد متبقٍ',two:()=>'مقعدان متبقيان',few:n=>`${n} مقاعد متبقية`,many:n=>`${n} مقعداً متبقياً`,other:n=>`${n} مقعد متبقٍ`}},upcoming:{en:{one:n=>`${n} upcoming trip`,other:n=>`${n} upcoming trips`},ar:{zero:()=>'لا توجد رحلات قادمة',one:()=>'رحلة قادمة واحدة',two:()=>'رحلتان قادمتان',few:n=>`${n} رحلات قادمة`,many:n=>`${n} رحلة قادمة`,other:n=>`${n} رحلة قادمة`}}};
const count=(n,key)=>{const forms=phrases[key][language];return (forms[new Intl.PluralRules(locale()).select(n)]||forms.other)(n);};
const money=row=>{const digits=row.fareMinor%100?2:0;return new Intl.NumberFormat(locale(),{style:'currency',currency:row.currency,minimumFractionDigits:digits,maximumFractionDigits:digits}).format(row.fareMinor/100);};
const day=value=>new Intl.DateTimeFormat(locale(),{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
const length=minutes=>{const h=Math.floor(minutes/60),m=minutes%60;return [h?`${h} ${t('h')}`:'',m?`${m} ${t('min')}`:''].filter(Boolean).join(' ');};
let searchVersion=0,searchDraft={...query};
const bookingTooLarge='This booking is too large. Shorten the descriptions and try again.';
arabic[bookingTooLarge]='بيانات الحجز كبيرة جداً. اختصر الأوصاف وحاول مجدداً.';
const link=path=>{const u=new URL(path,location.origin);if(language==='ar')u.searchParams.set('lang','ar');if(path.startsWith('/trip/')&&passengerCount>1)u.searchParams.set('passengers',String(passengerCount));return u.pathname+u.search+u.hash;};
async function get(path,headers={}){const response=await fetch('/api/v1/public/'+path,{credentials:'omit',cache:'no-store',headers});if(response.status===400||response.status===404)throw Object.assign(Error(),{status:response.status});if(!response.ok)throw Error();return (await response.json()).data;}
async function post(path,data){const response=await fetch('/api/v1/public/'+path,{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const reply=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(Error(),{status:response.status,code:reply.error?.code});return reply.data;}
// The browser keeps the only copy of each hold's key. A blocked store just means the hold cannot be reopened after leaving the page.
const keys={get:reference=>{try{return localStorage.getItem('safeer-hold-'+reference);}catch{return null;}},set:(reference,value)=>{try{localStorage.setItem('safeer-hold-'+reference,value);}catch{/* Staff can still find the hold by its reference. */}},pending:(value)=>{try{if(value===undefined)return JSON.parse(localStorage.getItem('safeer-hold-pending')||'null');if(value)localStorage.setItem('safeer-hold-pending',JSON.stringify(value));else localStorage.removeItem('safeer-hold-pending');}catch{return null;}},trip:(id,reference)=>{try{if(reference===undefined)return localStorage.getItem('safeer-trip-hold-'+id);localStorage.setItem('safeer-trip-hold-'+id,reference);}catch{return null;}},list:()=>{try{return Object.keys(localStorage).filter(name=>/^safeer-hold-SF-/.test(name)).map(name=>name.slice('safeer-hold-'.length)).sort();}catch{return [];}},forget:reference=>{try{localStorage.removeItem('safeer-hold-'+reference);}catch{/* Nothing stored. */}}};
const profileMode=params.get('view')==='profile';
let renderedLocation=location.pathname+location.search,ticketAnchorUsed=false;
let passengerCount=Math.min(10,Math.max(1,Number.parseInt(params.get('passengers')||'1',10)||1)),savedBookings=[],savedLoading=true,savedFailures=0,savedEpoch=0,tripsTab='upcoming';
const schedules=new Map();
const passengerContext=()=>({t,e,language,link});
function scheduleFor(reference){if(schedules.has(reference))return schedules.get(reference);try{const row=JSON.parse(localStorage.getItem('safeer-route-'+reference)||'null');if(row&&Array.isArray(row.stops)){schedules.set(reference,row);return row;}}catch{}return null;}
function saveSchedule(reference,trip){if(!trip)return;const data={};for(const field of ['fromNameEn','fromNameAr','toNameEn','toNameAr','arrivalDate','arrivalTime','date','time'])if(typeof trip[field]==='string')data[field]=trip[field].slice(0,200);data.stops=Array.isArray(trip.stops)?trip.stops.slice(0,60).map(stop=>Object.fromEntries(['stationNameEn','stationNameAr','cityNameEn','cityNameAr'].filter(k=>typeof stop[k]==='string').map(k=>[k,stop[k].slice(0,200)]))):[];schedules.set(reference,data);try{localStorage.setItem('safeer-route-'+reference,JSON.stringify(data));}catch{}}
async function resolveSchedule(b){if(Array.isArray(b.stops)){saveSchedule(b.reference,b);return;}if(scheduleFor(b.reference))return;try{saveSchedule(b.reference,await get('trips/'+b.tripId));if(holdRef===b.reference&&!lookupMode)render();}catch{/* Historical/private schedules are not invented. */}}
async function loadSavedBookings(){const epoch=++savedEpoch,refs=keys.list().slice(0,50),rows=[];savedLoading=true;savedFailures=0;render();let cursor=0,failures=0;await Promise.all(Array.from({length:Math.min(4,refs.length)},async()=>{while(cursor<refs.length){const ref=refs[cursor++];try{const b=await get('holds/'+ref,{'X-Booking-Key':keys.get(ref)});if(Array.isArray(b.stops))saveSchedule(ref,b);if(!scheduleFor(ref))try{saveSchedule(ref,await get('trips/'+b.tripId));}catch{}rows.push(b);}catch{failures++;}}}));if(epoch!==savedEpoch)return;savedBookings=rows;savedFailures=failures;savedLoading=false;if(lookupMode)render();}
function lookupPage(){const today=new Date().toISOString().slice(0,10),upcoming=savedBookings.filter(b=>!isPastBooking(b,today)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)||Number(b.status==='confirmed')-Number(a.status==='confirmed')||a.reference.localeCompare(b.reference)),past=savedBookings.filter(b=>isPastBooking(b,today)).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)||a.reference.localeCompare(b.reference)),rows=tripsTab==='upcoming'?upcoming:past;
 return `<section class="passenger-trips"><header class="passenger-page-heading"><span>Safeer</span><h1>${t('My Trips')}</h1><p>${t('Your reservations, ready when you are.')}</p></header><div class="passenger-tabs" role="tablist" aria-label="${t('My Trips')}">${[['upcoming','Upcoming'],['past','Past']].map(([id,label])=>`<button type="button" id="trips-tab-${id}" role="tab" data-trips-tab="${id}" aria-selected="${tripsTab===id}" aria-controls="passenger-trip-panel" tabindex="${tripsTab===id?'0':'-1'}">${t(label)}<span>${id==='upcoming'?upcoming.length:past.length}</span></button>`).join('')}</div><div id="passenger-trip-panel" role="tabpanel" aria-labelledby="trips-tab-${tripsTab}" class="passenger-trip-panel">${savedLoading?shimmer(language):rows.length?rows.map((b,i)=>journeyCard(b,scheduleFor(b.reference),{...passengerContext(),large:i===0})+(i===0?journeyTimeline(b,scheduleFor(b.reference),passengerContext()):'')).join(''):`<div class="glass-panel passenger-empty">${passengerIcon('trips')}<h2>${t(savedFailures?'Some trips are unavailable':tripsTab==='upcoming'?'No upcoming trips yet':'No past trips yet')}</h2><p>${t(savedFailures?'Your saved links are still here. Refresh or use your booking reference below.':'Bookings saved on this device appear here. You can also find a booking below.')}</p><a class="primary" href="${e(link('/marketplace'))}">${t('Find a bus trip')}</a></div>`}</div>${savedFailures?`<p class="journey-notice" role="alert">${t('Some bookings could not be loaded. Check your connection and refresh.')}</p>`:''}${keys.list().length>50?`<p>${t('Showing up to 50 saved bookings. Use your reference to find another booking.')}</p>`:''}<button type="button" class="secondary trips-refresh" id="passenger-trips-refresh" ${savedLoading?'disabled':''}>${t('Refresh trips')}</button><p class="passenger-device-note">${t('Only bookings saved on this device are listed. Journeys scheduled today are in Upcoming.')}</p><div class="passenger-lookup">${lookupFormPage()}</div></section>`;
}
function profilePage(){return `<section class="passenger-profile"><header class="passenger-page-heading"><span>Safeer</span><h1>${t('Profile')}</h1><p>${t('Your travel space, on this device.')}</p></header>${accountSection({t,e,link,icon:passengerIcon})}<section class="glass-panel profile-settings"><h2>${t('Preferences')}</h2><div><span>${t('Appearance')}</span>${themeButton(language)}</div><div><span>${t('Language')}</span><button type="button" data-passenger-language>${language==='ar'?'English':'Arabic'}</button></div></section><section class="glass-panel profile-settings"><h2>${t('Privacy and support')}</h2>${legalLinks(language)}<p>${t('Pay at the station. No in-app payments.')}</p></section></section>`;}

const mark=name=>`<span class="market-mark" aria-hidden="true">${e((name.trim()[0]||'').toUpperCase())}</span>`;
const tripEnd=(time,city,note='')=>`<div class="market-end"><strong><bdi>${e(time)}</bdi></strong><span>${e(city)}</span>${note?`<small>${e(note)}</small>`:''}</div>`;
function tripCard(row,showCompany=true){
 return `<article class="market-trip" data-trip="${e(row.id)}"><div class="market-trip-main"><h3 class="market-sr">${e(pick(row,'fromName'))} ${t('to')} ${e(pick(row,'toName'))}</h3><p class="market-trip-head"><strong>${e(day(row.date))}</strong>${showCompany?`<a href="${e(link('/company/'+row.companySlug))}">${e(pick(row,'companyName'))}</a>`:''}</p><div class="market-times">${tripEnd(row.time,pick(row,'fromName'))}<span class="market-line">${e(length(row.durationMinutes))}</span>${tripEnd(row.arrivalTime,pick(row,'toName'),row.arrivalDate!==row.date?`${t('Arrives')} ${day(row.arrivalDate)}`:'')}</div>${(()=>{const first=row.stops?.[row.fromIndex??0],last=row.stops?.[row.toIndex??row.stops.length-1],up=first&&first.stationNameEn?pick(first,'stationName'):'',down=last&&last.stationNameEn?pick(last,'stationName'):'';return up||down?`<p class="market-points">${up?`<span class="market-point market-point-pickup"><span aria-hidden="true"></span>${t('Pickup')}: <bdi>${e(up)}</bdi></span>`:''}${down?`<span class="market-point market-point-dropoff"><span aria-hidden="true"></span>${t('Drop-off')}: <bdi>${e(down)}</bdi></span>`:''}</p>`:'';})()}<p>${e(pick(row,'busType'))} · ${count(row.seatsLeft,'seatsLeft')}</p><details><summary>${t('Stops')} (${row.stops.length})</summary><ol>${row.partial?`<p class="market-badge market-partial">${t('Part of the route')}</p>`:''}${row.stops.map(s=>`<li${row.partial&&(s.index<row.fromIndex||s.index>row.toIndex)?' class="market-stop-off"':''}>${e(pick(s,'cityName'))}${s.stationNameEn?` · ${e(pick(s,'stationName'))}`:''}${s.offsetMinutes?` <small>+${e(length(s.offsetMinutes))}</small>`:''}</li>`).join('')}</ol></details></div><div class="market-price"><strong><bdi>${e(money(row))}</bdi></strong>${row.seatsLeft>0?`<a class="primary market-book" href="${e(link('/trip/'+row.id+(row.partial?`?from=${row.fromIndex}&to=${row.toIndex}`:'')))}">${t('Select seats')}</a>`:`<span class="market-badge">${t('Full')}</span>`}</div></article>`;
}
const sorted=()=>[...trips].sort(sort==='price'?(a,b)=>a.fareMinor-b.fareMinor:sort==='length'?(a,b)=>a.durationMinutes-b.durationMinutes:()=>0);
// D65 booking-first homepage icons.
const homePin='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4"/></svg>';
const homeCalendar='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5h14v15H5zM8 3v4M16 3v4M5 10h14"/></svg>';
const homePeople='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M20 19v-1a3 3 0 0 0-2-2.8M17 5.2a3 3 0 0 1 0 5.6"/></svg>';
const homeSearch='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-4-4"/></svg>';
const homeArrow='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5"/></svg>';
const homeBus='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 17V6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v11M5 13h14M7 17v3M17 17v3"/></svg>';
// Popular routes are the most frequent published city pairs in the loaded results; no invented routes.
function popularRoutes(){
 if(searched)return '';
 const pairs=new Map();for(const row of trips){if(!row.fromCode||!row.toCode)continue;const key=row.fromCode+'>'+row.toCode,item=pairs.get(key)||{row,count:0,lowest:row.fareMinor};item.count++;item.lowest=Math.min(item.lowest,row.fareMinor);pairs.set(key,item);}
 const top=[...pairs.values()].sort((a,b)=>b.count-a.count||a.lowest-b.lowest).slice(0,3);
 if(!top.length)return '';
 return `<section class="market-wrap market-popular" aria-labelledby="market-popular-title"><h2 id="market-popular-title">${t('Popular routes')}</h2><div class="market-popular-grid">${top.map(({row,lowest})=>`<button type="button" class="market-popular-card" data-popular-from="${e(row.fromCode)}" data-popular-to="${e(row.toCode)}"><span class="market-popular-image">${(()=>{const city=cities.find(c=>c.code===row.toCode);return city?.photoVersion?`<img src="/api/v1/public/cities/${encodeURIComponent(city.code)}/photo?v=${encodeURIComponent(city.photoVersion)}" alt="${e(pick(row,'toName'))}" width="1200" height="720" loading="lazy">`:'<img src="/src/coach-journey.jpg" alt="" width="1200" height="720" loading="lazy">';})()}<span class="market-popular-tag">${homeBus}${t('Intercity')}</span></span><span class="market-popular-route"><span class="market-popular-dots" aria-hidden="true"></span><strong><bdi>${e(pick(row,'fromName'))}</bdi> ${homeArrow} <bdi>${e(pick(row,'toName'))}</bdi></strong><small>${t('from')} <bdi>${e(money({...row,fareMinor:lowest}))}</bdi></small></span></button>`).join('')}</div></section>`;
}
function helpSection(){
 const items=[['How to book','Search a route and date, choose your seats and enter each traveler\'s name. Your seats are held for a limited time.'],['Paying','Pay the bus company at its station before the hold ends. Safeer has no online payment.'],['Your ticket','After payment, your QR ticket appears under My tickets on this device. Show it to the driver when boarding.'],['Changes and help','Contact the bus company from its page, or see the privacy page for Safeer support.']];
 return `<section class="market-wrap market-help" id="help" aria-labelledby="market-help-title"><h2 id="market-help-title">${t('Help')}</h2><div class="market-help-grid">${items.map(([title,body])=>`<article class="market-card"><h3>${t(title)}</h3><p>${t(body)}</p></article>`).join('')}</div><p><a href="/privacy?lang=${language}">${t('Privacy and support contact')}</a></p></section>`;
}
function home(){
 const options=(value)=>`<option value="">${t('Any city')}</option>${cities.map(c=>`<option value="${e(c.code)}" ${c.code===value?'selected':''}>${e(pick(c,'name'))}</option>`).join('')}`;
 return `<section class="market-band market-band-search market-hero"><div class="market-hero-art"><img src="/src/coach-journey.jpg" alt="" width="1200" height="720" fetchpriority="high"><span class="market-hero-caption">${t('Illustration')}</span></div><div class="market-wrap"><h1 class="market-hero-title">${t('Book your next bus trip.')}</h1><p>${t('Compare published trips from approved bus companies across Sudan.')}</p><form id="market-search" class="market-card market-search-panel"><label class="market-field"><span class="market-field-label">${homePin}${t('From')}</span><select id="market-from" name="from">${options(searchDraft.from)}</select></label><label class="market-field market-field-to"><span class="market-field-label">${homePin}${t('To')}</span><select id="market-to" name="to">${options(searchDraft.to)}</select></label><label class="market-field"><span class="market-field-label">${homeCalendar}${t('Travel date')}</span><input id="market-date" type="date" name="date" value="${e(searchDraft.date)}"></label><label class="market-field"><span class="market-field-label">${homePeople}${t('Passengers')}</span><select name="passengers" id="market-passengers">${Array.from({length:10},(_,i)=>`<option value="${i+1}" ${passengerCount===i+1?'selected':''}>${i+1}</option>`).join('')}</select></label><div class="market-buttons"><button id="market-submit" class="primary market-find">${homeSearch}<span>${t('Find trips')}</span></button>${searched?`<button type="button" class="secondary" data-clear>${t('Clear')}</button>`:''}</div></form></div></section>${popularRoutes()}<div class="market-wrap market-body"><section class="market-results" id="market-results"><header class="market-head"><h2>${count(trips.length,'trips')}</h2><label class="market-sort">${t('Sort by')}<select id="market-sort">${[['time','Earliest departure'],['price','Lowest price'],['length','Shortest journey']].map(([id,label])=>`<option value="${id}" ${id===sort?'selected':''}>${t(label)}</option>`).join('')}</select></label></header><p class="market-note">${t('Choose your seats to hold them for a limited time, then pay the company at its station before the hold ends.')}</p>${searchFailure?`<p class="market-empty" role="alert">${t(searchFailure)}</p>`:sorted().filter(row=>passengerCount<=1||row.seatsLeft>=passengerCount).map(row=>tripCard(row)).join('')||`<p class="market-empty">${t(searched?'No trips match your search. Try another date or city.':'No trips are published yet.')}</p>`}</section><section class="market-results"><header class="market-head"><h2>${t('Bus companies')}</h2></header>${companies.length?`<div class="market-companies">${companies.map(c=>`<article class="market-card">${mark(pick(c,'name'))}<h3>${e(pick(c,'name'))}</h3><p>${count(c.tripCount,'upcoming')}</p><a href="${e(link('/company/'+c.slug))}">${t('View company')}</a></article>`).join('')}</div>`:`<p class="market-empty">${t('No companies are listed yet.')}</p>`}</section>
 <section class="market-results market-parcel" id="send-parcel" aria-labelledby="send-parcel-title"><span class="market-parcel-icon" aria-hidden="true">${passengerIcon('parcels')}</span><div><h2 id="send-parcel-title">${t('Send a parcel')}</h2><p>${t('Hand your parcel in at a bus company office and pay there. The receipt has a tracking code; the receiver collects it at the destination office with their phone number and name.')}</p></div><div class="market-parcel-actions"><a class="market-parcel-primary" href="${e(link('/track'))}">${t('Track a parcel')}</a></div></section></div>${helpSection()}<footer class="market-wrap market-legal">${legalLinks(language)}</footer>`;
}
function companyPage(){
 const unique=key=>[...new Map(trips.map(row=>[key(row),row])).values()],about=pick(company,'about'),routeKey=row=>row.routeNameEn+'|'+row.routeNameAr,lowest=route=>Math.min(...trips.filter(row=>routeKey(row)===routeKey(route)).map(row=>row.fareMinor));
 const fact=(label,value)=>`<div><dt>${t(label)}</dt><dd>${value}</dd></div>`;
 return `<section class="market-band${brand?.secondaryColor?' market-band-brand':''}"><div class="market-wrap"><a href="${e(link('/marketplace'))}">${language==='ar'?'→':'←'} ${t('All companies')}</a><div class="market-company">${brand?.logoVersion?`<img class="market-company-logo" src="/api/v1/public/companies/${e(slug)}/logo?v=${e(brand.logoVersion)}" alt="" width="64" height="64">`:mark(pick(company,'name'))}<div><h1>${e(pick(company,'name'))}</h1><p>${count(company.tripCount,'upcoming')}</p></div></div></div></section><div class="market-wrap market-body market-split"><aside class="market-aside"><section class="market-card"><h2>${t('Contact')}</h2>${company.phone||company.email||company.address?`<dl class="market-facts">${company.phone?fact('Phone',`<a dir="ltr" href="tel:${e(company.phone.replace(/[^+0-9]/g,''))}">${e(company.phone)}</a>`):''}${company.email?fact('Email',`<a dir="ltr" href="mailto:${e(company.email)}">${e(company.email)}</a>`):''}${company.address?fact('Address',`<bdi>${e(company.address)}</bdi>`):''}</dl>`:`<p>${t('No contact details published.')}</p>`}</section>${about?`<section class="market-card"><h2>${t('About')}</h2><p class="market-pre">${e(about)}</p></section>`:''}${trips.length?`<section class="market-card"><h2>${t('Routes')}</h2><ul class="market-rows">${unique(routeKey).map(row=>`<li><span>${e(pick(row,'routeName'))}</span><span>${t('from')} <bdi>${e(money({...row,fareMinor:lowest(row)}))}</bdi></span></li>`).join('')}</ul></section><section class="market-card"><h2>${t('Bus types')}</h2><ul class="market-rows">${unique(row=>row.busTypeEn+'|'+row.seatCount).map(row=>`<li><span>${e(pick(row,'busType'))}</span><span>${t('Seats on this bus')}: ${row.seatCount}</span></li>`).join('')}</ul></section>`:''}</aside><section class="market-results"><header class="market-head"><h2>${t('Upcoming trips')}</h2></header><p class="market-note">${t('Choose your seats to hold them for a limited time, then pay the company at its station before the hold ends.')}</p>${trips.map(row=>tripCard(row,false)).join('')||`<p class="market-empty">${t('This company has no upcoming trips.')}</p>`}</section></div>`;
}
// Seats are placed from their stored row and column. The map keeps the bus's real left and right in both languages.
function tripPage(){
 const row=seatTrip;
 return `<section class="market-band"><div class="market-wrap"><a href="${e(link('/marketplace'))}">${language==='ar'?'→':'←'} ${t('Find a bus trip')}</a><div class="market-company"><div><h1>${e(pick(row,'fromName'))} ${t('to')} ${e(pick(row,'toName'))}</h1><p><bdi>${e(day(row.date))} · ${e(row.time)}</bdi> · <a href="${e(link('/company/'+row.companySlug))}">${e(pick(row,'companyName'))}</a></p></div></div></div></section><div class="market-wrap market-body market-booking">${journeyPicker(row)}<section class="market-card market-map"><h2>${t('Choose your seats')}</h2><ul class="market-legend"><li><i></i>${t('Available')}</li><li><i class="selected"></i>${t('Selected')}</li><li><i class="taken"></i>${t('Taken')}</li></ul><p class="market-front">${t('Front of the bus')}</p><div class="market-seats" id="market-seats" dir="ltr" role="group" aria-label="${e(t('Choose your seats'))}">${row.seats.map(s=>`<button type="button" class="market-seat" id="market-seat-${s.row}-${s.column}" data-seat="${e(s.label)}" data-row="${s.row}" data-column="${s.column}" aria-label="${e(t('Seat')+' '+s.label)}">${e(s.label)}</button>`).join('')}</div></section><aside class="market-aside">${myHold?`<p class="market-note">${t('You already hold seats on this trip:')} <a dir="ltr" href="${e(link('/hold/'+myHold))}">${e(myHold)}</a></p>`:''}<section class="market-card" id="market-summary"></section><p class="market-note">${t('No account is needed.')}</p></aside></div>`;
}
function journeyPicker(row){
 if(!row.stops||row.stops.length<3)return '';
 const priced=(f,l)=>(row.fares||[]).some(x=>x.from===f&&x.to===l),name=s=>e(pick(s,'cityName'))+(s.stationNameEn?' · '+e(pick(s,'stationName')):'');
 const froms=row.stops.slice(0,-1).filter(s=>row.stops.some(x=>x.index>s.index&&priced(s.index,x.index)));
 const tos=row.stops.filter(s=>s.index>row.fromIndex&&priced(row.fromIndex,s.index));
 return `<form class="market-card market-journey" id="market-journey"><h2>${t('Your journey on this bus')}</h2><div class="market-journey-fields"><label>${t('Board at')}<select name="from">${froms.map(s=>`<option value="${s.index}" ${s.index===row.fromIndex?'selected':''}>${name(s)}</option>`).join('')}</select></label><label>${t('Get off at')}<select name="to">${tos.map(s=>`<option value="${s.index}" ${s.index===row.toIndex?'selected':''}>${name(s)}</option>`).join('')}</select></label></div></form>`;
}
async function changeJourney(from,to){
 const row=seatTrip;if(!row)return;
 // Keep a valid, priced pair: a new boarding stop picks its first priced drop-off.
 const priced=(f,l)=>(row.fares||[]).some(x=>x.from===f&&x.to===l);
 if(to<0||!priced(from,to))to=row.stops.find(s=>s.index>from&&priced(from,s.index))?.index??null;
 if(to===null)return;
 journey={from,to};selected=[];holdKey=null;holdError='';summaryHtml='';
 const url=new URL(location.href);url.searchParams.set('from',String(from));url.searchParams.set('to',String(to));history.replaceState(null,'',url);
 try{seatTrip=await get('trips/'+tripId+journeyQuery());}catch(error){if(error.status===404){failure='This journey has no price yet. Choose other stops.';seatTrip=null;}}
 render();
}
function paintSeats(){
 const box=root.querySelector('#market-seats');if(!box||!seatTrip)return;
 box.style.setProperty('--market-columns',seatTrip.columns);
 for(const button of box.children){
  const seat=seatTrip.seats.find(s=>s.label===button.dataset.seat);if(!seat)continue;
  const picked=selected.includes(seat.label);
  button.style.gridRow=seat.row;button.style.gridColumn=seat.column;button.disabled=!seat.available&&!picked;button.setAttribute('aria-pressed',String(picked));button.classList.toggle('selected',picked);button.classList.toggle('taken',!seat.available&&!picked);
 }
 const total={fareMinor:seatTrip.fareMinor*selected.length,currency:seatTrip.currency};
 const locked=holding||unresolved?'disabled':'',seatOf=label=>seatTrip.seats.find(s=>s.label===label);
 const html=`<h2>${t('Your selection')}</h2>${selected.length?`<dl class="market-facts"><div><dt>${t('Seats')}</dt><dd><bdi>${e(selected.join(', '))}</bdi></dd></div><div><dt>${t('Total')}</dt><dd><strong><bdi>${e(money(total))}</bdi></strong></dd></div></dl>`:`<p>${t('No seats selected yet.')}</p>`}<form id="market-details">${selected.length?`<fieldset class="market-travelers"><legend>${t('Traveler details')}</legend>${selected.map(label=>{const s=seatOf(label);return `<label><span>${t('Seat')} <bdi>${e(label)}</bdi> · ${t('Full name')}</span><input id="market-name-${s?.row}-${s?.column}" data-name-seat="${e(label)}" required minlength="2" maxlength="100" autocomplete="off" ${locked}></label><label><span>${t('Luggage, if any: describe it')}</span><input id="market-bag-${s?.row}-${s?.column}" data-bag-seat="${e(label)}" maxlength="300" autocomplete="off" ${locked}></label>`;}).join('')}<label>${t('Mobile number')}<input id="market-mobile" type="tel" dir="ltr" required maxlength="30" autocomplete="tel" ${locked}></label><p class="market-small">${t('Your details go to the bus company for this trip and are erased 90 days after it ends.')}</p>${legalLinks(language)}</fieldset>`:''}${holdError?`<p class="market-error" role="alert">${t(holdError)}</p>`:''}<button class="primary market-hold" id="market-hold" ${selected.length&&!holding?'':'disabled'}>${t(holding?'Holding…':unresolved?'Try again':'Hold these seats')}</button><p class="market-small">${t('Seats stay held for')} ${seatTrip.holdMinutes} ${t('minutes')}.</p></form>`;
 // Only a real change touches the summary, so a refresh neither moves focus, loses typing nor repeats an alert.
 const summary=root.querySelector('#market-summary');if(html===summaryHtml&&summary.innerHTML)return;
 const focused=summary.contains(document.activeElement)?document.activeElement.id:null;
 summaryHtml=html;summary.innerHTML=html;
 contactMobile=prefill(names,selected,contactMobile);
 summary.querySelectorAll('[data-name-seat]').forEach(input=>{input.value=names[input.dataset.nameSeat]||'';input.oninput=()=>{names[input.dataset.nameSeat]=input.value;holdKey=null;};});
 summary.querySelectorAll('[data-bag-seat]').forEach(input=>{input.value=bags[input.dataset.bagSeat]||'';input.oninput=()=>{bags[input.dataset.bagSeat]=input.value;holdKey=null;};});
 const mobile=summary.querySelector('#market-mobile');if(mobile){mobile.value=contactMobile;mobile.oninput=()=>{contactMobile=mobile.value;holdKey=null;};}
 summary.querySelector('#market-details').onsubmit=event=>{event.preventDefault();void placeHold();};
 if(focused)document.getElementById(focused)?.focus();
}
async function refreshSeats(){
 try{
  const before=seatTrip?.seats.map(s=>s.label+'@'+s.row+'-'+s.column).join();
  seatTrip=await get('trips/'+tripId+journeyQuery());
  // While a hold's outcome is unknown, its seats may read as taken because of that very hold. Only the server's reply can settle it.
  if(!unresolved){
   const gone=selected.filter(label=>!seatTrip.seats.find(s=>s.label===label)?.available);
   if(gone.length){selected=selected.filter(label=>!gone.includes(label));holdKey=null;holdError='Some of your seats were just taken. Please choose again.';}
  }
  // A bus change can replace the whole map.
  if(before!==seatTrip.seats.map(s=>s.label+'@'+s.row+'-'+s.column).join())render();else paintSeats();
 }catch(error){if(error.status===404&&!holding){failure='This trip is no longer available.';seatTrip=null;render();}}
}
async function placeHold(){
 if(holding||!selected.length)return;
 holding=true;holdError=unresolved?holdError:'';holdKey??=crypto.randomUUID();paintSeats();
 // The key is saved first, so even a reload can find a hold whose reply never arrived. Names and numbers are not saved.
 keys.pending({key:holdKey,tripId});
 try{
  const data=await post('holds',{tripId,...(journey.from!==null&&journey.to!==null?{fromIndex:journey.from,toIndex:journey.to}:{}),seats:selected,key:holdKey,mobile:contactMobile,travelers:selected.map(seat=>({seat,name:names[seat]||'',luggage:bags[seat]||null}))});
  openBooking(data,holdKey);
 }catch(error){
  holdError=error.status===413?bookingTooLarge:error.code==='SEATS_UNAVAILABLE'?'Some of your seats were just taken. Please choose again.':error.code==='RATE_LIMITED'?'Too many attempts. Please wait a few minutes and try again.':error.code==='TRIP_NOT_BOOKABLE'?'This trip can no longer be held.':error.code==='INVALID_MOBILE'||error.code==='INVALID_PASSENGERS'?'Check the names and mobile number.':'We could not reach the service. Try again.';
  // Only a clear refusal from the service means nothing was held. Anything else may have succeeded, so the same key and seats are retried.
  // A limit reached while retrying says nothing about the first attempt, so the key is kept.
  const refused=error.status>=400&&error.status<500&&!(error.status===429&&unresolved);
  if(refused){holdKey=null;unresolved=false;keys.pending(null);}
  else{unresolved=true;holdError='We could not confirm your hold. Trying again with the same seats…';}
  holding=false;await refreshSeats();paintSeats();root.querySelector('#market-hold')?.focus();
 }
}
const openBooking=(data,key)=>{
 saveSchedule(data.reference,Array.isArray(data.stops)?data:seatTrip);keys.set(data.reference,key);keys.trip(tripId||data.tripId,data.reference);keys.pending(null);unresolved=false;holding=false;showBooking(data,key);void linkBooking(data.reference,key);
 // Typed details leave memory once the server has them.
 for(const seat of Object.keys(names))delete names[seat];for(const seat of Object.keys(bags))delete bags[seat];contactMobile='';
 history.pushState(null,'',link('/hold/'+data.reference));holdRef=data.reference;tripId=null;render();announce(statusTitle(data));
};
const bagStatus={registered:'Registered',tagged:'Tagged',loaded:'Loaded',in_transit:'In transit',unloaded:'Unloaded',collected:'Collected',lost:'Lost',exception_reported:'Problem reported'};
const statusTitle=data=>data.status==='confirmed'?(data.tripCanceled?'This trip was canceled':'Your tickets are confirmed'):data.status==='refunded'?'This booking was refunded':data.status==='held'?'Your seats are held':data.status==='expired'?'This hold has ended':'These seats were released';
const announce=key=>{document.querySelector('#market-status').textContent=t(key);const title=root.querySelector('#market-hold-title');if(title){title.tabIndex=-1;title.focus();}};
// D136: the result Paymob sends the passenger back with (?card=paid|failed|needs_refund).
const cardResult=new URLSearchParams(location.search).get('card');
let cardError='';
const cardNotice=()=>(cardError?`<p class="market-note market-error" role="alert">${t(cardError)}</p>`:'')+(cardResult==='paid'&&booking?.status!=='confirmed'?`<p class="market-note" role="status">${t('Your card payment is being confirmed. This page will update.')}</p>`:cardResult==='failed'?`<p class="market-note market-error" role="alert">${t('The card payment did not go through. You can try again or pay at the station.')}</p>`:cardResult==='needs_refund'?`<p class="market-note market-error" role="alert">${t('Your payment arrived after the seats were released. The company will refund it.')}</p>`:'');
const showBooking=(data,key)=>{void resolveSchedule(data);booking=data;bookingKey=key;clockOffset=Date.parse(data.serverNow)-Date.now();if(data.status!=='held')confirming=false;};
const remaining=()=>Math.max(0,Date.parse(booking.expiresAt)-(Date.now()+clockOffset));
const clockText=()=>{if(!remaining())return t('Checking…');const total=Math.ceil(remaining()/1000),h=Math.floor(total/3600),m=Math.floor(total%3600/60),s=total%60,two=n=>String(n).padStart(2,'0');return h?`${h}:${two(m)}:${two(s)}`:`${two(m)}:${two(s)}`;};
function holdPage(){
 const b=booking,held=b.status==='held',paid=b.status==='confirmed',title=statusTitle(b),why=paid?(b.tripCanceled?'This trip was canceled. Contact the company for a full refund.':'Show your ticket number when you board.'):b.status==='refunded'?(b.tripCanceled?'The company has returned your payment because the trip was canceled.':'The company has returned your payment and the seats went back on sale.'):held?(b.cardPayment?'Pay by card below, or at a company station with this reference, before the time runs out. If you do not, the seats are released automatically.':'Pay at a company station and give this reference before the time runs out. If you do not, the seats are released automatically.'):b.status==='expired'?'The time ran out, so the seats went back on sale.':b.releasedBy==='passenger'?'You released these seats.':b.releasedBy==='staff'?'The company released these seats.':'The trip was canceled, so these seats were released.';
 return `<div class="passenger-hold-feature">${journeyCard(b,scheduleFor(b.reference),{...passengerContext(),ticketPage:true})}${journeyTimeline(b,scheduleFor(b.reference),passengerContext())}</div><section class="market-band"><div class="market-wrap"><a href="${e(link('/marketplace'))}">${language==='ar'?'→':'←'} ${t('Find a bus trip')}</a><div class="market-company"><div><h1 id="market-hold-title">${t(title)}</h1><p>${t(why)}</p>${b.retrieved&&b.status!=='released'&&b.status!=='refunded'?`<button type="button" id="market-recheck">${t('Check again')}</button>`:''}</div></div></div></section><div class="market-wrap market-body market-booking"><section class="market-card market-ticket" id="passenger-ticket">${boardingDetails(b,passengerContext())}<p class="market-small">${t('Booking reference')}</p><p class="market-reference" dir="ltr">${e(b.reference)}</p>${held?`<p class="market-small">${t('Time left')}</p><p class="market-timer" id="market-timer" role="timer" dir="ltr">${clockText()}</p>`:''}${cardNotice()}${held&&b.cardPayment?`<button type="button" class="primary market-card-pay" id="market-pay-card">${t('Pay by card')}</button><p class="market-small">${t('You will pay on the secure Paymob card page. Your tickets appear here as soon as the payment is confirmed.')}</p>`:''}<dl class="market-facts"><div><dt>${t('Trip')}</dt><dd>${e(pick(b,'routeName'))} · <bdi>${e(day(b.date))} ${e(b.time)}</bdi></dd></div><div><dt>${t('Seats')}</dt><dd><bdi>${e(b.seats.join(', '))}</bdi></dd></div><div><dt>${t('Total')}</dt><dd><strong><bdi>${e(money({fareMinor:b.amountMinor,currency:b.currency}))}</bdi></strong></dd></div>${b.mobile?`<div><dt>${t('Mobile number')}</dt><dd><bdi dir="ltr">${e(b.mobile)}</bdi></dd></div>`:''}</dl>${paid&&b.tickets?.length?`<h2 class="market-subhead">${t('Tickets')}</h2><ul class="market-rows">${b.tickets.map(ticket=>`<li><span>${t('Seat')} <bdi>${e(ticket.seat)}</bdi></span><strong dir="ltr">${e(ticket.number)}</strong></li>`).join('')}</ul>`:''}${b.luggage?.length?`<h2 class="market-subhead">${t('Luggage')}</h2><ul class="market-rows">${b.luggage.map(bag=>`<li><span dir="ltr">${e(bag.number)}</span><strong>${t(bagStatus[bag.status])}</strong></li>`).join('')}</ul>`:''}${b.detailsErased?`<p class="market-small">${t('Personal details for this booking have been erased.')}</p>`:b.travelers?.length?`<h2 class="market-subhead">${t('Travelers')}</h2><ul class="market-rows">${b.travelers.map(p=>`<li><span>${t('Seat')} <bdi>${e(p.seat)}</bdi></span><span>${e(p.name)}</span></li>`).join('')}</ul>`:''}${b.retrieved?`<p class="market-small">${t('Some details are hidden because you opened this booking with its reference.')}</p>`:''}${releaseError?`<p class="market-error" role="alert">${t(releaseError)}</p>`:''}${held?(confirming?`<div class="market-confirm"><p>${t('Release now?')}</p><button type="button" class="secondary" id="market-keep" ${releasing?'disabled':''}>${t('Keep my seats')}</button><button type="button" class="secondary market-danger" id="market-release-yes" ${releasing?'disabled':''}>${t('Yes, release')}</button></div>`:`<button type="button" class="secondary" id="market-release">${t('Release these seats')}</button>`):paid?'':b.tripOpen?`<a class="primary market-book" href="${e(link('/trip/'+b.tripId))}">${t('Choose seats again')}</a>`:`<a class="primary market-book" href="${e(link('/marketplace'))}">${t('Find a bus trip')}</a>`}</section><aside class="market-aside"><section class="market-card"><h2>${e(pick(b,'companyName'))}</h2>${b.phone||b.email||b.address?`<dl class="market-facts">${b.phone?`<div><dt>${t('Phone')}</dt><dd><a dir="ltr" href="tel:${e(b.phone.replace(/[^+0-9]/g,''))}">${e(b.phone)}</a></dd></div>`:''}${b.email?`<div><dt>${t('Email')}</dt><dd><a dir="ltr" href="mailto:${e(b.email)}">${e(b.email)}</a></dd></div>`:''}${b.address?`<div><dt>${t('Address')}</dt><dd><bdi>${e(b.address)}</bdi></dd></div>`:''}</dl>`:`<p>${t('No contact details published.')}</p>`}</section></aside></div>`;
}
async function reloadBooking(){
 if(checking)return;checking=true;
 try{const was=booking.status,canceled=booking.tripCanceled;showBooking(retrievedMobile?await post('holds/lookup',{reference:holdRef,mobile:retrievedMobile}):await get('holds/'+holdRef,{'X-Booking-Key':bookingKey}),bookingKey);if(booking.status!==was||booking.tripCanceled!==canceled){releaseError='';render();announce(statusTitle(booking));}}
 catch(error){
  // In a reference-and-mobile view, a changed number or a reached limit ends the view. The passenger can look it up again.
  if(retrievedMobile&&(error.status===404||error.status===429)){retrievedMobile=null;booking=null;lookupMode=true;lookupReference=holdRef;render();}
 }
 checking=false;
}
function lookupFormPage(){
 const saved=keys.list();
 return `<section class="market-band"><div class="market-wrap"><a href="${e(link('/marketplace'))}">${language==='ar'?'→':'←'} ${t('Find a bus trip')}</a><div class="market-company"><div><h2>${t('Find your booking')}</h2><p>${t('Enter your booking reference and the mobile number on the booking.')}</p></div></div></div></section><div class="market-wrap market-body market-booking"><section class="market-card"><form id="market-lookup" class="market-lookup"><label>${t('Booking reference')}<input id="market-lookup-reference" dir="ltr" required maxlength="20" autocomplete="off" value="${e(lookupReference)}"></label><label>${t('Mobile number')}<input id="market-lookup-mobile" type="tel" dir="ltr" required maxlength="30" autocomplete="tel" value="${e(lookupMobile)}"></label>${lookupError?`<p class="market-error" role="alert">${t(lookupError)}</p>`:''}<button id="market-lookup-submit" class="primary market-hold" ${lookingUp?'disabled':''}>${t(lookingUp?'Searching…':'Find booking')}</button></form></section>${saved.length?`<aside class="market-aside"><section class="market-card"><h2>${t('Bookings on this device')}</h2><ul class="market-rows">${saved.map(reference=>`<li><a dir="ltr" href="${e(link('/hold/'+reference))}">${e(reference)}</a><button type="button" class="secondary" data-forget="${e(reference)}">${t('Forget')}</button></li>`).join('')}</ul><p class="market-small">${t('Removes the link from this device. The booking is not canceled.')}</p></section></aside>`:''}</div>`;
}
async function findBooking(){
 if(lookingUp)return;lookingUp=true;lookupError='';render();
 try{
  const data=await post('holds/lookup',{reference:lookupReference,mobile:lookupMobile});
  retrievedMobile=lookupMobile;lookupMobile='';lookupMode=false;lookingUp=false;showBooking(data,null);holdRef=data.reference;
  history.pushState(null,'',link('/hold/'+data.reference));render();announce(statusTitle(data));
 }catch(error){
  lookingUp=false;lookupError=error.status===429?'Too many attempts. Please wait a few minutes and try again.':error.status===404||error.status===400?'No booking matches those details.':'We could not reach the service. Try again.';render();
 }
}
function bookingNavigation(settingsOpen){
 return `<div class="market-bar app-masthead"><button type="button" id="market-menu-toggle" class="secondary sidebar-toggle app-menu-trigger" aria-label="${t('Menu')}" aria-controls="market-menu" aria-haspopup="dialog" aria-expanded="false">${menuIcon('M6 9h12M6 15h12')}</button><strong class="market-page-label app-header-name"><img src="/src/brand.svg" width="26" height="26" alt=""><span lang="${language}">${language==='ar'?'سفير':'Safeer'}</span></strong></div>${appBanner(language,'booking')}<dialog id="market-menu" class="market-drawer" data-app-drawer data-app-flavor="booking" aria-labelledby="market-menu-title"><div class="market-drawer-head"><div class="market-brand drawer-brand" id="market-menu-title"><img src="/src/brand.svg" alt="" width="40" height="40"><span><small>Safeer</small><strong>${t('Passenger booking')}</strong></span></div><button type="button" id="market-menu-close" class="secondary app-drawer-close" aria-label="${t('Close menu')}">${menuIcon('m6 6 12 12M18 6 6 18')}</button></div><div class="drawer-intro"><h2>${t('Where will you go next?')}</h2><p>${t('Find a trip, reserve a seat and manage your booking.')}</p></div><p class="drawer-section-label">${t('Your journey')}</p><nav class="market-drawer-nav" aria-label="${t('Booking navigation')}"><a href="${e(link('/marketplace'))}" ${!lookupMode&&!holdRef?'aria-current="page"':''}>${menuIcon('M4 5h16v12H4zM7 21v-4M17 21v-4M4 11h16M8 8h1M15 8h1')}<span class="drawer-nav-copy"><strong>${t('Find a bus trip')}</strong><small>${t('Choose a route and reserve your seat')}</small></span></a><a id="market-my-booking" href="${e(link('/booking'))}" ${lookupMode||holdRef?'aria-current="page"':''}>${menuIcon('M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4zM15 8v2M15 14v2')}<span class="drawer-nav-copy"><strong>${t('My Trips')}</strong><small>${t('Find your reservation and travel details')}</small></span></a><a href="/staff?lang=${language}">${menuIcon('M15 21H5V3h10M10 12h12M18 8l4 4-4 4')}<span class="drawer-nav-copy"><strong>${t('Staff sign in')}</strong><small>${t('For company and station employees')}</small></span></a><a href="/track?lang=${language}">${menuIcon('M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10')}<span class="drawer-nav-copy"><strong>${t('Track a shipment')}</strong><small>${t('Check where a parcel is with its tracking code')}</small></span></a>${appDrawerLink(language,'booking')}</nav><div class="drawer-bottom"><details class="app-settings" id="market-settings" ${settingsOpen?'open':''}><summary>${menuIcon('M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z')}<span>${t('Settings')}</span>${menuIcon('m9 6 6 6-6 6')}</summary><div class="market-preferences"><div><span>${t('Appearance')}</span>${themeButton(language)}</div><div><span>${t('Language')}</span><button type="button" class="secondary" id="market-language" lang="${language==='en'?'ar':'en'}">${language==='en'?'العربية':'English'}</button></div></div></details><a class="drawer-help" href="/privacy?lang=${language}">${t('Privacy and support')}</a><p class="market-drawer-foot">${t('Pay at the station. No in-app payments.')}<span class="drawer-version">${appVersionLabel()}</span></p></div></dialog>`;

}
function render(){
 renderedLocation=location.pathname+location.search;
 document.documentElement.dataset.passengerView=profileMode?'profile':lookupMode?'trips':holdRef?'ticket':'book';document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';document.title='Safeer | '+(profileMode?t('Profile'):lookupMode?t('My Trips'):booking?booking.reference:company?pick(company,'name'):t('Find a bus trip'));
 const notice=body=>`<div class="market-wrap market-body">${body}</div>`,focused=document.activeElement?.id,menuWasOpen=root.querySelector('#market-menu')?.open,settingsOpen=root.querySelector('#market-settings')?.open;
 root.innerHTML=`${bookingNavigation(settingsOpen)}<main class="market-main">${serviceNotice?.enabled?`<aside class="market-service-notice" role="status" lang="${language}" dir="${language==='ar'?'rtl':'ltr'}"><span class="market-notice-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4a1 1 0 0 0 1 1h3l11 4V5L8 9H5a1 1 0 0 0-1 1Z M8 15l1 6h3l-1-5 M22 9v6"/></svg></span><div class="market-notice-copy"><strong class="market-notice-label">${language==='ar'?'تحديث السفر':'Travel update'}</strong><p class="market-notice-message">${e(language==='ar'?serviceNotice.textAr:serviceNotice.textEn)}</p></div></aside>`:''}${loading?shimmer(language):failure?notice(`<h1 class="market-sr">Safeer</h1><p class="market-empty" role="alert">${t(failure)}</p>${slug||tripId||holdRef?`<p><a href="${e(link('/marketplace'))}">${t('All companies')}</a></p>`:''}`):profileMode?profilePage():lookupMode?lookupPage():holdRef?holdPage():tripId?tripPage():slug?companyPage():home()}</main>${bottomNavigation(profileMode?'profile':lookupMode||holdRef?'trips':'book',passengerContext())}`;
 bind();paintSeats();
 if(!ticketAnchorUsed&&location.hash==='#passenger-ticket'){const ticket=root.querySelector('#passenger-ticket');if(ticket){ticketAnchorUsed=true;requestAnimationFrame(()=>{if(ticket.isConnected)ticket.scrollIntoView({block:'start'});});}}
 if(menuWasOpen){root.querySelector("#market-menu").showModal();root.querySelector("#market-menu-toggle").setAttribute("aria-expanded","true");}
 // Rendering replaces the page, so the control in use gets its keyboard focus back.
 if(focused)document.getElementById(focused)?.focus();
}
function bind(){
 const picker=root.querySelector('#market-journey');if(picker)picker.onchange=event=>{const f=Number(picker.elements.from.value),l=Number(picker.elements.to.value);void changeJourney(f,event.target.name==='from'?-1:l);};
 bindSideDrawer(root,'market-menu','market-menu-toggle','market-menu-close');
 bindAccount(root,{t,render,keys});
 root.querySelector('[data-passenger-language]')?.addEventListener('click',()=>root.querySelector('#market-language').click());
 root.querySelector('#passenger-trips-refresh')?.addEventListener('click',()=>void loadSavedBookings());
 root.querySelectorAll('[data-trips-tab]').forEach(button=>{button.onclick=()=>{tripsTab=button.dataset.tripsTab;render();document.getElementById('trips-tab-'+tripsTab)?.focus({preventScroll:true});};button.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();tripsTab=event.key==='Home'?'upcoming':event.key==='End'?'past':tripsTab==='upcoming'?'past':'upcoming';render();document.getElementById('trips-tab-'+tripsTab)?.focus({preventScroll:true});};});
 root.querySelector('#market-language').onclick=()=>{language=language==='en'?'ar':'en';const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);render();};
 root.querySelector('#market-sort')?.addEventListener('change',event=>{sort=event.target.value;render();});
 root.querySelector('[data-clear]')?.addEventListener('click',()=>{query={from:'',to:'',date:''};searchDraft={...query};passengerCount=1;void search();});
 root.querySelector('#market-seats')?.addEventListener('click',event=>{
  const button=event.target.closest('[data-seat]');if(!button||button.disabled||holding||unresolved)return;
  const label=button.dataset.seat;holdError='';
  if(selected.includes(label))selected=selected.filter(x=>x!==label);else if(selected.length>=10)holdError='You can choose up to 10 seats.';else selected=[...selected,label];
  holdKey=null;paintSeats();
 });
 root.querySelector('#market-recheck')?.addEventListener('click',()=>void reloadBooking());
 root.querySelector('#market-pay-card')?.addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{const {url}=await post('holds/'+booking.reference+'/card',{key:bookingKey});if(typeof url==='string'&&(url.startsWith('https://')||url.startsWith('http://127.0.0.1:')))location.assign(url);}catch(error){button.disabled=false;cardError=error.code==='HOLD_CLOSED'?'This hold has ended. Choose your seats again.':'Card payment is not available right now. Try again or pay at the station.';render();}});
 root.querySelector('#market-release')?.addEventListener('click',()=>{confirming=true;render();root.querySelector('#market-keep')?.focus();});
 root.querySelector('#market-keep')?.addEventListener('click',()=>{confirming=false;render();root.querySelector('#market-release')?.focus();});
 const lookup=root.querySelector('#market-lookup');if(lookup){
  const reference=lookup.querySelector('#market-lookup-reference'),mobile=lookup.querySelector('#market-lookup-mobile');
  reference.oninput=()=>{lookupReference=reference.value;};mobile.oninput=()=>{lookupMobile=mobile.value;};
  lookup.onsubmit=event=>{event.preventDefault();void findBooking();};
  root.querySelectorAll('[data-forget]').forEach(button=>button.onclick=()=>{keys.forget(button.dataset.forget);try{localStorage.removeItem('safeer-route-'+button.dataset.forget);}catch{}void loadSavedBookings();});
 }
 root.querySelector('#market-release-yes')?.addEventListener('click',async()=>{
  if(releasing)return;releasing=true;releaseError='';render();
  try{showBooking(await post(`holds/${holdRef}/release`,retrievedMobile?{mobile:retrievedMobile}:{key:bookingKey}),bookingKey);}
  catch{releaseError='We could not release these seats. They are still held. Try again.';}
  releasing=false;render();if(booking.status==='released')announce('These seats were released');
 });
 root.querySelectorAll('[data-popular-from]').forEach(card=>card.addEventListener('click',()=>{const f=root.querySelector('#market-search');if(!f)return;f.elements.from.value=card.dataset.popularFrom;f.elements.to.value=card.dataset.popularTo;f.elements.from.dispatchEvent(new Event('change',{bubbles:true}));f.requestSubmit();}));
 const form=root.querySelector('#market-search');if(form){
  const capture=()=>{const v=Object.fromEntries(new FormData(form));searchDraft={from:v.from,to:v.to,date:v.date};passengerCount=Math.min(10,Math.max(1,Number(v.passengers)||1));root.querySelectorAll('.market-book[href]').forEach(anchor=>{const u=new URL(anchor.href);if(u.pathname.startsWith('/trip/'))anchor.href=link(u.pathname+u.search.replace(/[?&](lang|passengers)=[^&]*/g,'').replace(/^&/,'?'));});};
  form.addEventListener('input',capture);form.addEventListener('change',capture);
  form.onsubmit=event=>{event.preventDefault();capture();query={...searchDraft};void search();};
 }
}
async function search(){
 const sequence=++searchVersion,filters={...query};
 const values=Object.entries(filters).filter(([,value])=>value),qs=new URLSearchParams(values).toString();
 let rows,errorMessage='';
 try{rows=(await get('trips'+(qs?'?'+qs:''))).items;}catch(error){rows=[];errorMessage=error.status===400?'Check your search and try again.':'The trip service is not available right now. Please try again later.';}
 if(sequence!==searchVersion)return;
 trips=rows;searchFailure=errorMessage;searched=values.length>0;
 const url=new URL(location.href);for(const key of ['from','to','date'])filters[key]?url.searchParams.set(key,filters[key]):url.searchParams.delete(key);if(passengerCount>1)url.searchParams.set('passengers',String(passengerCount));else url.searchParams.delete('passengers');history.replaceState(null,'',url);render();
 document.querySelector('#market-status').textContent=searchFailure?t(searchFailure):count(trips.length,'trips');
}
void loadAccount().then(()=>{if(profileMode)render();});
render();
addEventListener('popstate',()=>{if(location.pathname+location.search!==renderedLocation)location.reload();});
try{serviceNotice=await get('notice');}catch{serviceNotice=null;}
try{
 if(lookupMode||profileMode){/* Guest pages do not require public search data. */}
 else if(holdRef){
  bookingKey=keys.get(holdRef);
  // Another device gets the retrieval form, ready with this reference. A link alone shows no details.
  if(!bookingKey){lookupMode=true;lookupReference=holdRef;}
  else showBooking(await get('holds/'+holdRef,{'X-Booking-Key':bookingKey}),bookingKey);
 }
 else if(tripId){
  seatTrip=await get('trips/'+tripId+journeyQuery());
  // Reopening the page shows a hold this browser already has, and finishes an attempt whose reply was lost.
  const reference=keys.trip(tripId),saved=reference&&keys.get(reference);
  if(saved)try{if((await get('holds/'+reference,{'X-Booking-Key':saved})).status==='held')myHold=reference;}catch{/* It is only a convenience link. */}
  // Only the key was saved, so this finds the hold if it was made and otherwise simply starts again.
  const pending=keys.pending();if(pending?.tripId===tripId)try{const data=await get('holds/current',{'X-Booking-Key':pending.key});loading=false;openBooking(data,pending.key);}catch(error){if(error.status===404)keys.pending(null);}
 }
 else if(slug){const [data,look]=await Promise.all([get('companies/'+slug),get('companies/'+slug+'/brand').catch(()=>null)]);company=data.company;trips=data.trips;brand=look;
  // The brand colors are set through the style API (the page's security policy forbids inline style attributes).
  if(brand?.primaryColor)document.documentElement.style.setProperty('--accent',brand.primaryColor);
  if(brand?.secondaryColor)document.documentElement.style.setProperty('--company-band',brand.secondaryColor);}
 else{[{items:cities},{items:companies}]=await Promise.all([get('cities'),get('companies')]);loading=false;await search();}
}catch(error){if(holdRef&&error.status===404){lookupMode=true;lookupReference=holdRef;}else failure=tripId&&error.status===404?'This trip is no longer available.':error.status===404&&slug?'This company page is not available.':'The trip service is not available right now. Please try again later.';}
loading=false;if(!holdRef||lookupMode||!document.querySelector('#market-hold-title'))render();if(lookupMode)void loadSavedBookings();
// Availability is rechecked while a seat page is open. The countdown is display only; the server decides when a hold ends.
setInterval(()=>{if(tripId&&seatTrip&&!holding)void (unresolved?placeHold():refreshSeats());},15000);
let lastBookingCheck=Date.now();
setInterval(()=>{
 if(!holdRef||!booking||lookupMode||booking.status==='released'||booking.status==='refunded')return;
 // A key holder's paid or ended booking can still change at the counter, so it is checked now and then.
 if(booking.status!=='held'){if(!retrievedMobile&&Date.now()-lastBookingCheck>60000){lastBookingCheck=Date.now();void reloadBooking();}return;}
 const timer=root.querySelector('#market-timer');if(timer)timer.textContent=clockText();
 // Once the time is up the server is asked every few seconds, never overlapping, until it confirms the hold has ended.
 // Reference-and-mobile views use up lookup attempts, so they check only once the time is up, and less often.
 if(retrievedMobile&&remaining())return;
 if(Date.now()-lastBookingCheck>(retrievedMobile?30000:remaining()?30000:5000)){lastBookingCheck=Date.now();void reloadBooking();}
},1000);
