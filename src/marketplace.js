import {themeButton} from './theme.js';
// Public pages: published trips and temporary seat holds. Passenger details arrive with Section 09, so nothing here collects them.
const arabic={'Find a bus trip':'ابحث عن رحلة حافلة','Compare published trips from approved bus companies across Sudan.':'قارن الرحلات المنشورة من شركات الحافلات المعتمدة في السودان.','From':'من','To':'إلى','to':'إلى','Travel date':'تاريخ السفر','Any city':'أي مدينة','Search trips':'ابحث عن الرحلات','Clear':'مسح','Sort by':'الترتيب حسب','Earliest departure':'أقرب موعد مغادرة','Lowest price':'أقل سعر','Shortest journey':'أقصر رحلة','No trips match your search. Try another date or city.':'لا توجد رحلات مطابقة. جرّب تاريخاً أو مدينة أخرى.','No trips are published yet.':'لا توجد رحلات منشورة بعد.','Bus companies':'شركات الحافلات','No companies are listed yet.':'لا توجد شركات مدرجة بعد.','View company':'عرض الشركة','Seats on this bus':'مقاعد هذه الحافلة','Stops':'المحطات','Select seats':'اختر المقاعد','Full':'ممتلئة','Choose your seats to hold them for a limited time, then pay the company at its station before the hold ends.':'اختر مقاعدك لحجزها مؤقتاً، ثم ادفع للشركة في محطتها قبل انتهاء المهلة.','Choose your seats':'اختر مقاعدك','Front of the bus':'مقدمة الحافلة','Available':'متاح','Taken':'محجوز','Selected':'محدد','Seat':'مقعد','Your selection':'اختيارك','No seats selected yet.':'لم تحدد أي مقعد بعد.','Seats':'المقاعد','Total':'الإجمالي','Hold these seats':'احجز هذه المقاعد مؤقتاً','Holding…':'جارٍ الحجز…','You can choose up to 10 seats.':'يمكنك اختيار 10 مقاعد كحد أقصى.','Seats stay held for':'تبقى المقاعد محجوزة لمدة','minutes':'دقيقة','No account or personal details are needed yet.':'لا يلزم حساب أو بيانات شخصية في هذه المرحلة.','Some of your seats were just taken. Please choose again.':'حُجز بعض مقاعدك للتو. يرجى الاختيار مرة أخرى.','Too many attempts. Please wait a few minutes and try again.':'محاولات كثيرة. انتظر بضع دقائق ثم حاول مرة أخرى.','This trip can no longer be held.':'لم يعد بالإمكان حجز هذه الرحلة.','We could not reach the service. Try again.':'تعذر الوصول إلى الخدمة. حاول مرة أخرى.','This trip is no longer available.':'لم تعد هذه الرحلة متاحة.','Your seats are held':'تم حجز مقاعدك مؤقتاً','This hold has ended':'انتهت مهلة هذا الحجز','These seats were released':'تم إلغاء حجز هذه المقاعد','Booking reference':'مرجع الحجز','Time left':'الوقت المتبقي','Pay at a company station and give this reference before the time runs out. If you do not, the seats are released automatically.':'ادفع في إحدى محطات الشركة وقدّم هذا المرجع قبل انتهاء الوقت، وإلا سيتم إلغاء الحجز تلقائياً.','The time ran out, so the seats went back on sale.':'انتهى الوقت، فأصبحت المقاعد متاحة مرة أخرى.','You released these seats.':'لقد ألغيت حجز هذه المقاعد.','The company released these seats.':'ألغت الشركة حجز هذه المقاعد.','The trip was canceled, so these seats were released.':'أُلغيت الرحلة، لذا أُلغي حجز هذه المقاعد.','Choose seats again':'اختر المقاعد مرة أخرى','Release these seats':'ألغِ حجز هذه المقاعد','Release now?':'إلغاء الحجز الآن؟','Yes, release':'نعم، ألغِ الحجز','Keep my seats':'احتفظ بمقاعدي','This hold can only be opened on the device that made it. Give your reference to the company for help.':'لا يمكن فتح هذا الحجز إلا من الجهاز الذي أنشأه. قدّم مرجعك للشركة للمساعدة.','Trip':'الرحلة','Checking…':'جارٍ التحقق…','We could not confirm your hold. Trying again with the same seats…':'تعذر تأكيد حجزك. نحاول مجدداً بالمقاعد نفسها…','Try again':'حاول مرة أخرى','We could not release these seats. They are still held. Try again.':'تعذر إلغاء حجز هذه المقاعد. ما زالت محجوزة. حاول مرة أخرى.','You already hold seats on this trip:':'لديك مقاعد محجوزة على هذه الرحلة:','All companies':'جميع الشركات','About':'عن الشركة','Contact':'التواصل','No contact details published.':'لم تُنشر بيانات تواصل.','Routes':'المسارات','Bus types':'أنواع الحافلات','Upcoming trips':'الرحلات القادمة','This company has no upcoming trips.':'لا توجد رحلات قادمة لهذه الشركة.','This company page is not available.':'صفحة هذه الشركة غير متاحة.','The trip service is not available right now. Please try again later.':'خدمة الرحلات غير متاحة حالياً. حاول مرة أخرى لاحقاً.','Check your search and try again.':'تحقق من بحثك وحاول مرة أخرى.','Loading':'جارٍ التحميل','from':'من','Staff sign in':'دخول الموظفين','h':'س','min':'د','Phone':'الهاتف','Email':'البريد الإلكتروني','Address':'العنوان','Arrives':'الوصول'};
const root=document.querySelector('#market'),params=new URL(location.href).searchParams,slugMatch=/^\/company\/([a-z0-9-]+)$/.exec(location.pathname),slug=slugMatch?.[1]||null;
let language=params.get('lang')==='ar'?'ar':'en',cities=[],companies=[],trips=[],company=null,failure='',searchFailure='',sort='time',searched=false,loading=true;
let tripId=/^\/trip\/([0-9a-f-]{36})$/.exec(location.pathname)?.[1]||null,holdRef=/^\/hold\/(SF-[2-9A-HJ-NP-Z]{8})$/.exec(location.pathname)?.[1]||null,seatTrip=null,selected=[],holdKey=null,holdError='',holding=false,booking=null,bookingKey=null,clockOffset=0,confirming=false,releaseError='',releasing=false,checking=false,unresolved=false,summaryHtml='',myHold=null;
let query={from:params.get('from')||'',to:params.get('to')||'',date:params.get('date')||''};
const t=key=>language==='ar'?(arabic[key]||key):key,e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick=(row,key)=>language==='ar'?row[key+'Ar']:row[key+'En'],locale=()=>language==='ar'?'ar-SD-u-nu-latn':'en-GB';
// Arabic counts change their wording with the number, so each phrase is chosen by plural category.
const phrases={trips:{en:{one:n=>`${n} trip found`,other:n=>`${n} trips found`},ar:{zero:()=>'لا توجد رحلات',one:()=>'رحلة واحدة',two:()=>'رحلتان',few:n=>`${n} رحلات`,many:n=>`${n} رحلة`,other:n=>`${n} رحلة`}},seatsLeft:{en:{one:n=>`${n} seat left`,other:n=>`${n} seats left`},ar:{zero:()=>'لا توجد مقاعد متبقية',one:()=>'مقعد واحد متبقٍ',two:()=>'مقعدان متبقيان',few:n=>`${n} مقاعد متبقية`,many:n=>`${n} مقعداً متبقياً`,other:n=>`${n} مقعد متبقٍ`}},upcoming:{en:{one:n=>`${n} upcoming trip`,other:n=>`${n} upcoming trips`},ar:{zero:()=>'لا توجد رحلات قادمة',one:()=>'رحلة قادمة واحدة',two:()=>'رحلتان قادمتان',few:n=>`${n} رحلات قادمة`,many:n=>`${n} رحلة قادمة`,other:n=>`${n} رحلة قادمة`}}};
const count=(n,key)=>{const forms=phrases[key][language];return (forms[new Intl.PluralRules(locale()).select(n)]||forms.other)(n);};
const money=row=>{const digits=row.fareMinor%100?2:0;return new Intl.NumberFormat(locale(),{style:'currency',currency:row.currency,minimumFractionDigits:digits,maximumFractionDigits:digits}).format(row.fareMinor/100);};
const day=value=>new Intl.DateTimeFormat(locale(),{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
const length=minutes=>{const h=Math.floor(minutes/60),m=minutes%60;return [h?`${h} ${t('h')}`:'',m?`${m} ${t('min')}`:''].filter(Boolean).join(' ');};
const link=path=>`${path}${language==='ar'?'?lang=ar':''}`;
async function get(path,headers={}){const response=await fetch('/api/v1/public/'+path,{credentials:'omit',cache:'no-store',headers});if(response.status===400||response.status===404)throw Object.assign(Error(),{status:response.status});if(!response.ok)throw Error();return (await response.json()).data;}
async function post(path,data){const response=await fetch('/api/v1/public/'+path,{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const reply=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(Error(),{status:response.status,code:reply.error?.code});return reply.data;}
// The browser keeps the only copy of each hold's key. A blocked store just means the hold cannot be reopened after leaving the page.
const keys={get:reference=>{try{return localStorage.getItem('safeer-hold-'+reference);}catch{return null;}},set:(reference,value)=>{try{localStorage.setItem('safeer-hold-'+reference,value);}catch{/* Staff can still find the hold by its reference. */}},pending:(value)=>{try{if(value===undefined)return JSON.parse(localStorage.getItem('safeer-hold-pending')||'null');if(value)localStorage.setItem('safeer-hold-pending',JSON.stringify(value));else localStorage.removeItem('safeer-hold-pending');}catch{return null;}},trip:(id,reference)=>{try{if(reference===undefined)return localStorage.getItem('safeer-trip-hold-'+id);localStorage.setItem('safeer-trip-hold-'+id,reference);}catch{return null;}}};
const mark=name=>`<span class="market-mark" aria-hidden="true">${e((name.trim()[0]||'').toUpperCase())}</span>`;
const tripEnd=(time,city,note='')=>`<div class="market-end"><strong><bdi>${e(time)}</bdi></strong><span>${e(city)}</span>${note?`<small>${e(note)}</small>`:''}</div>`;
function tripCard(row,showCompany=true){
 return `<article class="market-trip" data-trip="${e(row.id)}"><div class="market-trip-main"><h3 class="market-sr">${e(pick(row,'fromName'))} ${t('to')} ${e(pick(row,'toName'))}</h3><p class="market-trip-head"><strong>${e(day(row.date))}</strong>${showCompany?`<a href="${e(link('/company/'+row.companySlug))}">${e(pick(row,'companyName'))}</a>`:''}</p><div class="market-times">${tripEnd(row.time,pick(row,'fromName'))}<span class="market-line">${e(length(row.durationMinutes))}</span>${tripEnd(row.arrivalTime,pick(row,'toName'),row.arrivalDate!==row.date?`${t('Arrives')} ${day(row.arrivalDate)}`:'')}</div><p>${e(pick(row,'busType'))} · ${count(row.seatsLeft,'seatsLeft')}</p><details><summary>${t('Stops')} (${row.stops.length})</summary><ol>${row.stops.map(s=>`<li>${e(pick(s,'cityName'))}${s.stationNameEn?` · ${e(pick(s,'stationName'))}`:''}${s.offsetMinutes?` <small>+${e(length(s.offsetMinutes))}</small>`:''}</li>`).join('')}</ol></details></div><div class="market-price"><strong><bdi>${e(money(row))}</bdi></strong>${row.seatsLeft>0?`<a class="primary market-book" href="${e(link('/trip/'+row.id))}">${t('Select seats')}</a>`:`<span class="market-badge">${t('Full')}</span>`}</div></article>`;
}
const sorted=()=>[...trips].sort(sort==='price'?(a,b)=>a.fareMinor-b.fareMinor:sort==='length'?(a,b)=>a.durationMinutes-b.durationMinutes:()=>0);
function home(){
 const options=(value)=>`<option value="">${t('Any city')}</option>${cities.map(c=>`<option value="${e(c.code)}" ${c.code===value?'selected':''}>${e(pick(c,'name'))}</option>`).join('')}`;
 return `<section class="market-band market-band-search"><div class="market-wrap"><h1>${t('Find a bus trip')}</h1><p>${t('Compare published trips from approved bus companies across Sudan.')}</p><form id="market-search" class="market-card"><label>${t('From')}<select id="market-from" name="from">${options(query.from)}</select></label><label>${t('To')}<select id="market-to" name="to">${options(query.to)}</select></label><label>${t('Travel date')}<input id="market-date" type="date" name="date" value="${e(query.date)}"></label><div class="market-buttons"><button id="market-submit" class="primary">${t('Search trips')}</button>${searched?`<button type="button" class="secondary" data-clear>${t('Clear')}</button>`:''}</div></form></div></section><div class="market-wrap market-body"><section class="market-results"><header class="market-head"><h2>${count(trips.length,'trips')}</h2><label class="market-sort">${t('Sort by')}<select id="market-sort">${[['time','Earliest departure'],['price','Lowest price'],['length','Shortest journey']].map(([id,label])=>`<option value="${id}" ${id===sort?'selected':''}>${t(label)}</option>`).join('')}</select></label></header><p class="market-note">${t('Choose your seats to hold them for a limited time, then pay the company at its station before the hold ends.')}</p>${searchFailure?`<p class="market-empty" role="alert">${t(searchFailure)}</p>`:sorted().map(row=>tripCard(row)).join('')||`<p class="market-empty">${t(searched?'No trips match your search. Try another date or city.':'No trips are published yet.')}</p>`}</section><section class="market-results"><header class="market-head"><h2>${t('Bus companies')}</h2></header>${companies.length?`<div class="market-companies">${companies.map(c=>`<article class="market-card">${mark(pick(c,'name'))}<h3>${e(pick(c,'name'))}</h3><p>${count(c.tripCount,'upcoming')}</p><a href="${e(link('/company/'+c.slug))}">${t('View company')}</a></article>`).join('')}</div>`:`<p class="market-empty">${t('No companies are listed yet.')}</p>`}</section></div>`;
}
function companyPage(){
 const unique=key=>[...new Map(trips.map(row=>[key(row),row])).values()],about=pick(company,'about'),routeKey=row=>row.routeNameEn+'|'+row.routeNameAr,lowest=route=>Math.min(...trips.filter(row=>routeKey(row)===routeKey(route)).map(row=>row.fareMinor));
 const fact=(label,value)=>`<div><dt>${t(label)}</dt><dd>${value}</dd></div>`;
 return `<section class="market-band"><div class="market-wrap"><a href="${e(link('/marketplace'))}">${language==='ar'?'→':'←'} ${t('All companies')}</a><div class="market-company">${mark(pick(company,'name'))}<div><h1>${e(pick(company,'name'))}</h1><p>${count(company.tripCount,'upcoming')}</p></div></div></div></section><div class="market-wrap market-body market-split"><aside class="market-aside"><section class="market-card"><h2>${t('Contact')}</h2>${company.phone||company.email||company.address?`<dl class="market-facts">${company.phone?fact('Phone',`<a dir="ltr" href="tel:${e(company.phone.replace(/[^+0-9]/g,''))}">${e(company.phone)}</a>`):''}${company.email?fact('Email',`<a dir="ltr" href="mailto:${e(company.email)}">${e(company.email)}</a>`):''}${company.address?fact('Address',`<bdi>${e(company.address)}</bdi>`):''}</dl>`:`<p>${t('No contact details published.')}</p>`}</section>${about?`<section class="market-card"><h2>${t('About')}</h2><p class="market-pre">${e(about)}</p></section>`:''}${trips.length?`<section class="market-card"><h2>${t('Routes')}</h2><ul class="market-rows">${unique(routeKey).map(row=>`<li><span>${e(pick(row,'routeName'))}</span><span>${t('from')} <bdi>${e(money({...row,fareMinor:lowest(row)}))}</bdi></span></li>`).join('')}</ul></section><section class="market-card"><h2>${t('Bus types')}</h2><ul class="market-rows">${unique(row=>row.busTypeEn+'|'+row.seatCount).map(row=>`<li><span>${e(pick(row,'busType'))}</span><span>${t('Seats on this bus')}: ${row.seatCount}</span></li>`).join('')}</ul></section>`:''}</aside><section class="market-results"><header class="market-head"><h2>${t('Upcoming trips')}</h2></header><p class="market-note">${t('Choose your seats to hold them for a limited time, then pay the company at its station before the hold ends.')}</p>${trips.map(row=>tripCard(row,false)).join('')||`<p class="market-empty">${t('This company has no upcoming trips.')}</p>`}</section></div>`;
}
// Seats are placed from their stored row and column. The map keeps the bus's real left and right in both languages.
function tripPage(){
 const row=seatTrip;
 return `<section class="market-band"><div class="market-wrap"><a href="${e(link('/marketplace'))}">${language==='ar'?'→':'←'} ${t('Find a bus trip')}</a><div class="market-company"><div><h1>${e(pick(row,'fromName'))} ${t('to')} ${e(pick(row,'toName'))}</h1><p><bdi>${e(day(row.date))} · ${e(row.time)}</bdi> · <a href="${e(link('/company/'+row.companySlug))}">${e(pick(row,'companyName'))}</a></p></div></div></div></section><div class="market-wrap market-body market-booking"><section class="market-card market-map"><h2>${t('Choose your seats')}</h2><ul class="market-legend"><li><i></i>${t('Available')}</li><li><i class="selected"></i>${t('Selected')}</li><li><i class="taken"></i>${t('Taken')}</li></ul><p class="market-front">${t('Front of the bus')}</p><div class="market-seats" id="market-seats" dir="ltr" role="group" aria-label="${e(t('Choose your seats'))}">${row.seats.map(s=>`<button type="button" class="market-seat" id="market-seat-${s.row}-${s.column}" data-seat="${e(s.label)}" data-row="${s.row}" data-column="${s.column}" aria-label="${e(t('Seat')+' '+s.label)}">${e(s.label)}</button>`).join('')}</div></section><aside class="market-aside">${myHold?`<p class="market-note">${t('You already hold seats on this trip:')} <a dir="ltr" href="${e(link('/hold/'+myHold))}">${e(myHold)}</a></p>`:''}<section class="market-card" id="market-summary"></section><p class="market-note">${t('No account or personal details are needed yet.')}</p></aside></div>`;
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
 const html=`<h2>${t('Your selection')}</h2>${selected.length?`<dl class="market-facts"><div><dt>${t('Seats')}</dt><dd><bdi>${e(selected.join(', '))}</bdi></dd></div><div><dt>${t('Total')}</dt><dd><strong><bdi>${e(money(total))}</bdi></strong></dd></div></dl>`:`<p>${t('No seats selected yet.')}</p>`}${holdError?`<p class="market-error" role="alert">${t(holdError)}</p>`:''}<button type="button" class="primary market-hold" id="market-hold" ${selected.length&&!holding?'':'disabled'}>${t(holding?'Holding…':unresolved?'Try again':'Hold these seats')}</button><p class="market-small">${t('Seats stay held for')} ${seatTrip.holdMinutes} ${t('minutes')}.</p>`;
 // Only a real change touches the summary, so a refresh neither moves focus nor repeats an alert.
 const summary=root.querySelector('#market-summary');if(html===summaryHtml&&summary.innerHTML)return;
 const focused=document.activeElement?.id==='market-hold';
 summaryHtml=html;summary.innerHTML=html;summary.querySelector('#market-hold').onclick=()=>void placeHold();
 if(focused)summary.querySelector('#market-hold').focus();
}
async function refreshSeats(){
 try{
  const before=seatTrip?.seats.map(s=>s.label+'@'+s.row+'-'+s.column).join();
  seatTrip=await get('trips/'+tripId);
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
 // The attempt is saved first, so even a reload can recover a hold whose reply never arrived.
 keys.pending({key:holdKey,tripId,seats:selected});
 try{
  const data=await post('holds',{tripId,seats:selected,key:holdKey});
  keys.set(data.reference,holdKey);keys.trip(tripId,data.reference);keys.pending(null);unresolved=false;holding=false;showBooking(data,holdKey);
  history.pushState(null,'',link('/hold/'+data.reference));holdRef=data.reference;tripId=null;render();announce('Your seats are held');
 }catch(error){
  holdError=error.code==='SEATS_UNAVAILABLE'?'Some of your seats were just taken. Please choose again.':error.code==='RATE_LIMITED'?'Too many attempts. Please wait a few minutes and try again.':error.code==='TRIP_NOT_BOOKABLE'?'This trip can no longer be held.':'We could not reach the service. Try again.';
  // Only a clear refusal from the service means nothing was held. Anything else may have succeeded, so the same key and seats are retried.
  const refused=error.status>=400&&error.status<500;
  if(refused){holdKey=null;unresolved=false;keys.pending(null);}
  else{unresolved=true;holdError='We could not confirm your hold. Trying again with the same seats…';}
  holding=false;await refreshSeats();paintSeats();root.querySelector('#market-hold')?.focus();
 }
}
const announce=key=>{document.querySelector('#market-status').textContent=t(key);const title=root.querySelector('#market-hold-title');if(title){title.tabIndex=-1;title.focus();}};
const showBooking=(data,key)=>{booking=data;bookingKey=key;clockOffset=Date.parse(data.serverNow)-Date.now();if(data.status!=='held')confirming=false;};
const remaining=()=>Math.max(0,Date.parse(booking.expiresAt)-(Date.now()+clockOffset));
const clockText=()=>{if(!remaining())return t('Checking…');const total=Math.ceil(remaining()/1000),h=Math.floor(total/3600),m=Math.floor(total%3600/60),s=total%60,two=n=>String(n).padStart(2,'0');return h?`${h}:${two(m)}:${two(s)}`:`${two(m)}:${two(s)}`;};
function holdPage(){
 const b=booking,held=b.status==='held',title=held?'Your seats are held':b.status==='expired'?'This hold has ended':'These seats were released',why=held?'Pay at a company station and give this reference before the time runs out. If you do not, the seats are released automatically.':b.status==='expired'?'The time ran out, so the seats went back on sale.':b.releasedBy==='passenger'?'You released these seats.':b.releasedBy==='staff'?'The company released these seats.':'The trip was canceled, so these seats were released.';
 return `<section class="market-band"><div class="market-wrap"><a href="${e(link('/marketplace'))}">${language==='ar'?'→':'←'} ${t('Find a bus trip')}</a><div class="market-company"><div><h1 id="market-hold-title">${t(title)}</h1><p>${t(why)}</p></div></div></div></section><div class="market-wrap market-body market-booking"><section class="market-card market-ticket"><p class="market-small">${t('Booking reference')}</p><p class="market-reference" dir="ltr">${e(b.reference)}</p>${held?`<p class="market-small">${t('Time left')}</p><p class="market-timer" id="market-timer" role="timer" dir="ltr">${clockText()}</p>`:''}<dl class="market-facts"><div><dt>${t('Trip')}</dt><dd>${e(pick(b,'routeName'))} · <bdi>${e(day(b.date))} ${e(b.time)}</bdi></dd></div><div><dt>${t('Seats')}</dt><dd><bdi>${e(b.seats.join(', '))}</bdi></dd></div><div><dt>${t('Total')}</dt><dd><strong><bdi>${e(money({fareMinor:b.amountMinor,currency:b.currency}))}</bdi></strong></dd></div></dl>${releaseError?`<p class="market-error" role="alert">${t(releaseError)}</p>`:''}${held?(confirming?`<div class="market-confirm"><p>${t('Release now?')}</p><button type="button" class="secondary" id="market-keep" ${releasing?'disabled':''}>${t('Keep my seats')}</button><button type="button" class="secondary market-danger" id="market-release-yes" ${releasing?'disabled':''}>${t('Yes, release')}</button></div>`:`<button type="button" class="secondary" id="market-release">${t('Release these seats')}</button>`):b.tripOpen?`<a class="primary market-book" href="${e(link('/trip/'+b.tripId))}">${t('Choose seats again')}</a>`:`<a class="primary market-book" href="${e(link('/marketplace'))}">${t('Find a bus trip')}</a>`}</section><aside class="market-aside"><section class="market-card"><h2>${e(pick(b,'companyName'))}</h2>${b.phone||b.email||b.address?`<dl class="market-facts">${b.phone?`<div><dt>${t('Phone')}</dt><dd><a dir="ltr" href="tel:${e(b.phone.replace(/[^+0-9]/g,''))}">${e(b.phone)}</a></dd></div>`:''}${b.email?`<div><dt>${t('Email')}</dt><dd><a dir="ltr" href="mailto:${e(b.email)}">${e(b.email)}</a></dd></div>`:''}${b.address?`<div><dt>${t('Address')}</dt><dd><bdi>${e(b.address)}</bdi></dd></div>`:''}</dl>`:`<p>${t('No contact details published.')}</p>`}</section></aside></div>`;
}
async function reloadBooking(){
 if(checking)return;checking=true;
 try{const was=booking.status;showBooking(await get('holds/'+holdRef,{'X-Booking-Key':bookingKey}),bookingKey);if(booking.status!==was)render();}catch{/* The next check tries again. */}
 checking=false;
}
function render(){
 document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';document.title='Safeer | '+(booking?booking.reference:company?pick(company,'name'):t('Find a bus trip'));
 const notice=body=>`<div class="market-wrap market-body">${body}</div>`,focused=document.activeElement?.id;
 root.innerHTML=`<header class="market-bar"><a class="market-brand" href="${e(link('/marketplace'))}"><img src="/src/brand.svg" alt="" width="34" height="34">Safeer / سفير</a><div>${themeButton(language)}<button type="button" class="secondary" id="market-language" lang="${language==='en'?'ar':'en'}">${language==='en'?'العربية':'English'}</button><a class="secondary market-link" href="/staff?lang=${language}">${t('Staff sign in')}</a></div></header><main class="market-main">${loading?notice(`<p class="market-empty">${t('Loading')}…</p>`):failure?notice(`<h1 class="market-sr">Safeer</h1><p class="market-empty" role="alert">${t(failure)}</p>${slug||tripId||holdRef?`<p><a href="${e(link('/marketplace'))}">${t('All companies')}</a></p>`:''}`):holdRef?holdPage():tripId?tripPage():slug?companyPage():home()}</main>`;
 bind();paintSeats();
 // Rendering replaces the page, so the control in use gets its keyboard focus back.
 if(focused)document.getElementById(focused)?.focus();
}
function bind(){
 root.querySelector('#market-language').onclick=()=>{language=language==='en'?'ar':'en';const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);render();};
 root.querySelector('#market-sort')?.addEventListener('change',event=>{sort=event.target.value;render();});
 root.querySelector('[data-clear]')?.addEventListener('click',()=>{query={from:'',to:'',date:''};void search();});
 root.querySelector('#market-seats')?.addEventListener('click',event=>{
  const button=event.target.closest('[data-seat]');if(!button||button.disabled||holding||unresolved)return;
  const label=button.dataset.seat;holdError='';
  if(selected.includes(label))selected=selected.filter(x=>x!==label);else if(selected.length>=10)holdError='You can choose up to 10 seats.';else selected=[...selected,label];
  holdKey=null;paintSeats();
 });
 root.querySelector('#market-release')?.addEventListener('click',()=>{confirming=true;render();root.querySelector('#market-keep')?.focus();});
 root.querySelector('#market-keep')?.addEventListener('click',()=>{confirming=false;render();root.querySelector('#market-release')?.focus();});
 root.querySelector('#market-release-yes')?.addEventListener('click',async()=>{
  if(releasing)return;releasing=true;releaseError='';render();
  try{showBooking(await post(`holds/${holdRef}/release`,{key:bookingKey}),bookingKey);}
  catch{releaseError='We could not release these seats. They are still held. Try again.';}
  releasing=false;render();if(booking.status==='released')announce('These seats were released');
 });
 const form=root.querySelector('#market-search');if(form)form.onsubmit=event=>{event.preventDefault();const v=Object.fromEntries(new FormData(form));query={from:v.from,to:v.to,date:v.date};void search();};
}
async function search(){
 const values=Object.entries(query).filter(([,value])=>value),qs=new URLSearchParams(values).toString();searched=values.length>0;
 try{trips=(await get('trips'+(qs?'?'+qs:''))).items;searchFailure='';}catch(error){trips=[];searchFailure=error.status===400?'Check your search and try again.':'The trip service is not available right now. Please try again later.';}
 const url=new URL(location.href);for(const key of ['from','to','date'])query[key]?url.searchParams.set(key,query[key]):url.searchParams.delete(key);history.replaceState(null,'',url);render();
 document.querySelector('#market-status').textContent=searchFailure?t(searchFailure):count(trips.length,'trips');
}
render();
addEventListener('popstate',()=>location.reload());
try{
 if(holdRef){
  bookingKey=keys.get(holdRef);
  if(!bookingKey)failure='This hold can only be opened on the device that made it. Give your reference to the company for help.';
  else showBooking(await get('holds/'+holdRef,{'X-Booking-Key':bookingKey}),bookingKey);
 }
 else if(tripId){
  seatTrip=await get('trips/'+tripId);
  // Reopening the page shows a hold this browser already has, and finishes an attempt whose reply was lost.
  const reference=keys.trip(tripId),saved=reference&&keys.get(reference);
  if(saved)try{if((await get('holds/'+reference,{'X-Booking-Key':saved})).status==='held')myHold=reference;}catch{/* It is only a convenience link. */}
  const pending=keys.pending();if(pending?.tripId===tripId){selected=pending.seats;holdKey=pending.key;unresolved=true;holdError='We could not confirm your hold. Trying again with the same seats…';setTimeout(()=>void placeHold(),0);}
 }
 else if(slug){const data=await get('companies/'+slug);company=data.company;trips=data.trips;}
 else{[{items:cities},{items:companies}]=await Promise.all([get('cities'),get('companies')]);loading=false;await search();}
}catch(error){failure=holdRef&&error.status===404?'This hold can only be opened on the device that made it. Give your reference to the company for help.':tripId&&error.status===404?'This trip is no longer available.':error.status===404?'This company page is not available.':'The trip service is not available right now. Please try again later.';}
loading=false;render();
// Availability is rechecked while a seat page is open. The countdown is display only; the server decides when a hold ends.
setInterval(()=>{if(tripId&&seatTrip&&!holding)void (unresolved?placeHold():refreshSeats());},15000);
let lastBookingCheck=Date.now();
setInterval(()=>{
 if(!holdRef||!booking||booking.status!=='held')return;
 const timer=root.querySelector('#market-timer');if(timer)timer.textContent=clockText();
 // Once the time is up the server is asked every few seconds, never overlapping, until it confirms the hold has ended.
 if(Date.now()-lastBookingCheck>(remaining()?30000:5000)){lastBookingCheck=Date.now();void reloadBooking();}
},1000);
