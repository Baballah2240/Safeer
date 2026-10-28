import {createDemo} from './demo.mjs';
import {cities, categories, workspaceFor, expireReservations, occupiedSeats, reserveSeat, cancelReservation, setHoldMinutes, requestFreight} from './domain.mjs';

const state = createDemo();
const root = document.querySelector('#app');
const dialog = document.querySelector('#reference-dialog');
let companyId = state.companies[0].id;
let tab = 'overview';
let language = 'en';
let tripId = state.trips[0].id;
let selectedSeat = null;
let passengerName = 'Demo passenger';
let toastTimer;

const arabic = {
  'Transport workspace':'مساحة إدارة النقل','Local prototype':'نموذج محلي','Demo company':'الشركة التجريبية',
  'Overview':'نظرة عامة','Passenger reservations':'حجوزات الركاب','Freight requests':'طلبات الشحن','Company policy':'سياسة الشركة',
  'Passenger preview':'معاينة حجز الراكب','Passenger transport and freight, together.':'نقل الركاب والشحن في مكان واحد.',
  'A first look at Safeer. Let’s agree the workflow before building the full system.':'نظرة أولى على سفير. نتفق على سير العمل قبل بناء النظام الكامل.',
  'Fictional data only. No staff sign-in yet. Changes reset when you refresh.':'بيانات تجريبية فقط. تسجيل دخول الموظفين غير مضاف بعد. تعود البيانات لوضعها الأصلي عند تحديث الصفحة.',
  'Sample trips':'رحلات تجريبية','Available seats':'مقاعد متاحة','Active reservations':'حجوزات نشطة','Freight requests today':'طلبات الشحن التجريبية',
  'Upcoming sample trips':'الرحلات التجريبية القادمة','View trips':'عرض الرحلات','Route':'المسار','Departure':'المغادرة','Vehicle':'المركبة',
  'Availability':'التوفر','Example fare':'سعر تجريبي','Actions':'الإجراءات','Choose a seat':'اختيار مقعد','seats free':'مقاعد متاحة',
  'Khartoum':'الخرطوم','Atbara':'عطبرة','Port Sudan':'بورتسودان','Wad Madani':'ود مدني',
  'The two service flows':'مسارا الخدمة','Passenger journey':'رحلة الراكب','Choose trip → choose seat → reserve → pay the company offline.':'اختيار رحلة ← اختيار مقعد ← حجز ← دفع خارج التطبيق للشركة.',
  'Freight journey':'مسار الشحنة','Request transport → company quote → confirmation → transport and delivery.':'طلب نقل ← عرض سعر من الشركة ← تأكيد ← نقل وتسليم.',
  'Confirmed basics':'الأساسيات المتفق عليها','Passengers and freight from the first release':'الركاب والشحن من الإصدار الأول',
  'Separate workspaces for independent companies':'مساحات مستقلة للشركات',
  'Company-defined payment deadlines':'مواعيد دفع تحددها الشركة','No online payment collection':'لا يوجد تحصيل دفع إلكتروني',
  'Plan the real system':'تخطيط النظام الفعلي','Real company access will require staff sign-in and server-side permissions. This selector only switches fictional demo workspaces.':'الوصول الفعلي للشركات يتطلب تسجيل الدخول وصلاحيات على الخادم. هذا المحدد يبدل المساحات التجريبية فقط.',
  'Reserve a sample seat':'حجز مقعد تجريبي','Explore a trip and create an unpaid demonstration reservation.':'استعرض الرحلة وأنشئ حجزاً تجريبياً غير مدفوع.',
  'Trip':'الرحلة','Bus front · example 2+2 layout':'مقدمة الحافلة · توزيع تجريبي ٢+٢','Available':'متاح','Unavailable':'غير متاح','Selected':'محدد','Seat':'المقعد',
  'Reservation summary':'ملخص الحجز','Choose an available seat to continue.':'اختر مقعداً متاحاً للمتابعة.',
  'Demo passenger name':'اسم راكب تجريبي','Use invented information only.':'استخدم معلومات وهمية فقط.',
  'Payment deadline':'موعد الدفع','minutes after reservation, no later than departure':'دقيقة بعد الحجز، وبحد أقصى وقت المغادرة',
  'Reserve seat':'حجز المقعد','No payment is taken here. This creates a reservation reference, not a paid ticket.':'لا يتم تحصيل أي مبلغ هنا. يتم إنشاء مرجع حجز، وليس تذكرة مدفوعة.',
  'Reservations':'الحجوزات','Reference':'المرجع','Passenger':'الراكب','Status':'الحالة','Expires':'ينتهي','View reference':'عرض المرجع','Cancel':'إلغاء',
  'reserved':'محجوز','expired':'منتهي','cancelled':'ملغى','requested':'طلب جديد','No reservations yet.':'لا توجد حجوزات بعد.',
  'Reservation created. No payment collected.':'تم إنشاء الحجز دون تحصيل دفع.','Reservation cancelled. The seat is available again.':'ألغي الحجز وأصبح المقعد متاحاً مجدداً.',
  'An unpaid reservation expired and its seat was released.':'انتهت مهلة حجز غير مدفوع وأعيد المقعد للإتاحة.',
  'Request freight transport':'طلب نقل شحنة','Freight uses cargo details, quantities and quotes rather than passenger seats.':'يعتمد الشحن على تفاصيل البضاعة والكميات وعروض الأسعار، وليس مقاعد الركاب.',
  'Demo customer name':'اسم عميل تجريبي','Origin':'المنشأ','Destination':'الوجهة','Cargo category':'فئة الشحنة','Packages':'عدد الطرود','Weight (kg)':'الوزن بالكيلوغرام',
  'General goods':'بضائع عامة','Parcels':'طرود','Agricultural goods':'بضائع زراعية','Create demo request':'إنشاء طلب تجريبي',
  'Requests for this company':'طلبات هذه الشركة','Customer':'العميل','Cargo':'الشحنة','No freight requests yet.':'لا توجد طلبات شحن بعد.',
  'Request created. A quote and transport confirmation are separate steps.':'أنشئ الطلب. عرض السعر وتأكيد النقل خطوتان منفصلتان.',
  'A freight request does not assign a truck or confirm a delivery price.':'طلب الشحن لا يخصص شاحنة ولا يؤكد سعر التسليم.',
  'Set the reservation window':'تحديد مهلة الحجز','Each company controls how long an unpaid seat is held. Expired reservations release the seat.':'تحدد كل شركة مدة الاحتفاظ بالمقعد غير المدفوع. يعاد المقعد للإتاحة بعد انتهاء الحجز.',
  'Hold duration (minutes)':'مدة الاحتفاظ بالمقعد بالدقائق','Save demo policy':'حفظ السياسة التجريبية',
  'Applies to new reservations only. Existing deadlines remain unchanged. Prototype range: 5–1440 minutes.':'تطبق على الحجوزات الجديدة فقط، ولا تغير المواعيد السابقة. النطاق التجريبي: ٥ إلى ١٤٤٠ دقيقة.',
  'Policy updated for this company.':'حدثت سياسة هذه الشركة.','Still to decide together':'قرارات نحتاج إلى مناقشتها',
  'Passenger sign-in: phone verification or guest reservations?':'دخول الركاب: توثيق الهاتف أم الحجز كزائر؟',
  'Which staff roles can confirm payments, issue tickets and cancel bookings?':'ما أدوار الموظفين المخولين بتأكيد الدفع وإصدار التذاكر وإلغاء الحجوزات؟',
  'Freight pricing, delivery confirmation and receipt numbering.':'تسعير الشحن وإثبات التسليم وترقيم الإيصالات.',
  'Ticket and receipt issuance follows the payment workflow we agree. No real tickets or payment receipts are issued by this prototype.':'يتبع إصدار التذاكر والإيصالات سير الدفع الذي نتفق عليه. لا يصدر هذا النموذج تذاكر أو إيصالات دفع فعلية.',
  'Reservation reference':'مرجع الحجز','UNPAID · DEMONSTRATION':'غير مدفوع · نموذج تجريبي','Company':'الشركة','Close':'إغلاق','Print reference':'طباعة المرجع',
  'This reference is not proof of payment or permission to board. All details and prices are fictional.':'هذا المرجع ليس إثبات دفع أو إذناً بالصعود. جميع التفاصيل والأسعار تجريبية.',
  'Choose a company.':'اختر شركة.','Trip not found in this company.':'الرحلة غير موجودة في هذه الشركة.','This trip has departed.':'غادرت هذه الرحلة.',
  'Enter a demo passenger name, up to 80 characters.':'أدخل اسماً تجريبياً للراكب لا يتجاوز ٨٠ حرفاً.','Choose a valid seat.':'اختر مقعداً صالحاً.',
  'This seat is unavailable. Choose another.':'هذا المقعد غير متاح. اختر مقعداً آخر.','Reservation not found in this company.':'الحجز غير موجود في هذه الشركة.',
  'Only an active reservation can be cancelled.':'يمكن إلغاء الحجز النشط فقط.','Choose a whole number from 5 to 1440 minutes.':'اختر عدداً صحيحاً بين ٥ و١٤٤٠ دقيقة.',
  'Enter a demo customer name, up to 80 characters.':'أدخل اسماً تجريبياً للعميل لا يتجاوز ٨٠ حرفاً.','Choose different origin and destination cities.':'اختر مدينتين مختلفتين للمنشأ والوجهة.',
  'Choose a cargo category.':'اختر فئة الشحنة.','Enter a valid package count.':'أدخل عدداً صالحاً للطرود.','Enter a valid weight in kilograms.':'أدخل وزناً صالحاً بالكيلوغرام.',
  'All prices, routes and availability shown are illustrative. No actual travel or shipping is booked.':'الأسعار والمسارات والإتاحة أمثلة توضيحية. لا يتم حجز سفر أو شحن فعلي.',
};

const t = value => language === 'ar' ? arabic[value] || value : value;
const e = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const number = value => new Intl.NumberFormat(language === 'ar' ? 'ar-SD' : 'en-GB').format(value);
const date = value => new Intl.DateTimeFormat(language === 'ar' ? 'ar-SD' : 'en-GB', {timeZone:'Africa/Khartoum', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}).format(value);
const companyName = company => language === 'ar' ? company.nameAr : company.name;
const route = trip => `${t(trip.from)} <span class="route-arrow" aria-hidden="true">↗</span> ${t(trip.to)}`;
const nav = [['overview','Overview','◫'],['passengers','Passenger reservations','▦'],['freight','Freight requests','▱'],['settings','Company policy','⚙']];

function toast(message, bad = false) {
  const node = document.querySelector('#toast'); node.textContent = t(message); node.className = bad ? 'show bad' : 'show';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.className = ''; }, 6000);
}

function tripTable(workspace) {
  return `<div class="table-wrap"><table><thead><tr>${['Route','Departure','Vehicle','Availability','Example fare','Actions'].map(label=>`<th>${t(label)}</th>`).join('')}</tr></thead><tbody>${workspace.trips.map(trip=>`<tr><td><strong>${route(trip)}</strong></td><td>${e(date(trip.departureAt))}</td><td><span class="vehicle">${e(trip.vehicle)}</span></td><td><span class="availability">${number(trip.capacity-occupiedSeats(state,trip.id).size)} ${t('seats free')}</span></td><td>${number(trip.fare)} <small>SDG</small></td><td><button class="text-button" data-open-trip="${trip.id}">${t('Choose a seat')} <span aria-hidden="true">↗</span></button></td></tr>`).join('')}</tbody></table></div>`;
}

function overview(workspace) {
  const available = workspace.trips.reduce((sum, trip) => sum + trip.capacity - occupiedSeats(state,trip.id).size, 0);
  return `<section class="metrics">${[['Sample trips',workspace.trips.length],['Available seats',available],['Active reservations',workspace.reservations.filter(row=>row.status==='reserved').length],['Freight requests today',workspace.freightRequests.length]].map(([label,value],index)=>`<article class="metric"><span>${t(label)}</span><strong>${number(value)}</strong><small>0${index+1} <span class="metric-line"></span></small></article>`).join('')}</section>
    <section class="panel"><div class="section-heading"><div><p class="eyebrow">SAFEER / ${t('Trip')}</p><h2>${t('Upcoming sample trips')}</h2></div><button class="secondary" data-nav="passengers">${t('View trips')}</button></div>${tripTable(workspace)}</section>
    <div class="two-columns"><section class="panel"><h2>${t('The two service flows')}</h2><article class="flow-item"><span class="flow-number">01</span><div><h3>${t('Passenger journey')}</h3><p>${t('Choose trip → choose seat → reserve → pay the company offline.')}</p></div></article><article class="flow-item"><span class="flow-number">02</span><div><h3>${t('Freight journey')}</h3><p>${t('Request transport → company quote → confirmation → transport and delivery.')}</p></div></article></section><section class="panel"><h2>${t('Confirmed basics')}</h2><ul class="check-list">${['Passengers and freight from the first release','Separate workspaces for independent companies','Company-defined payment deadlines','No online payment collection'].map(label=>`<li>${t(label)}</li>`).join('')}</ul><button class="text-button" data-nav="settings">${t('Plan the real system')} ↗</button></section></div>`;
}

function reservationTable(workspace) {
  return `<div class="table-wrap"><table><thead><tr>${['Reference','Passenger','Trip','Seat','Status','Expires','Actions'].map(label=>`<th>${t(label)}</th>`).join('')}</tr></thead><tbody>${workspace.reservations.map(row=>{const trip=workspace.trips.find(trip=>trip.id===row.tripId);return `<tr><td><bdi class="reference">${e(row.reference)}</bdi></td><td>${e(row.passengerName)}</td><td>${route(trip)}</td><td>${number(row.seat)}</td><td><span class="status ${row.status}">${t(row.status)}</span></td><td>${e(date(row.expiresAt))}</td><td><div class="row-actions"><button class="text-button" data-reference="${row.id}">${t('View reference')}</button>${row.status==='reserved'?`<button class="text-button danger" data-cancel="${row.id}">${t('Cancel')}</button>`:''}</div></td></tr>`;}).join('')||`<tr><td colspan="7" class="empty">${t('No reservations yet.')}</td></tr>`}</tbody></table></div>`;
}

function passengers(workspace) {
  const trip = workspace.trips.find(row=>row.id===tripId) || workspace.trips[0];
  const occupied = occupiedSeats(state,trip.id); tripId = trip.id;
  if (occupied.has(selectedSeat)) selectedSeat = null;
  const rows = Array.from({length:Math.ceil(trip.capacity/4)},(_,row)=>`<div class="seat-row">${[0,1,2,3].map(column=>{const seat=row*4+column+1;return `${column===2?'<span class="aisle" aria-hidden="true"></span>':''}${seat<=trip.capacity?`<button type="button" class="seat ${seat===selectedSeat?'selected':''}" data-seat="${seat}" ${occupied.has(seat)?'disabled':''} aria-pressed="${seat===selectedSeat}" aria-label="${t('Seat')} ${seat}${occupied.has(seat)?' · '+t('Unavailable'):''}">${seat}</button>`:''}`;}).join('')}</div>`).join('');
  return `<section class="panel"><div class="section-heading"><div><p class="eyebrow">SAFEER / ${t('Passenger preview')}</p><h2>${t('Reserve a sample seat')}</h2><p>${t('Explore a trip and create an unpaid demonstration reservation.')}</p></div></div><label class="trip-choice">${t('Trip')}<select id="trip-select">${workspace.trips.map(item=>`<option value="${item.id}" ${item.id===trip.id?'selected':''}>${t(item.from)} → ${t(item.to)} · ${e(date(item.departureAt))}</option>`).join('')}</select></label><div class="booking-grid"><div class="bus-area"><div class="seat-legend"><span><i></i>${t('Available')}</span><span><i class="taken"></i>${t('Unavailable')}</span><span><i class="selected"></i>${t('Selected')}</span></div><div class="bus"><div class="bus-front">${t('Bus front · example 2+2 layout')}</div>${rows}</div></div><form id="reservation-form" class="booking-summary"><p class="eyebrow">${t('Reservation summary')}</p><h2>${route(trip)}</h2><p>${e(date(trip.departureAt))} · ${e(trip.vehicle)}</p><div class="price"><strong>${number(trip.fare)}</strong> SDG<small>${t('Example fare')}</small></div><div class="summary-seat"><span>${t('Seat')}</span><strong>${selectedSeat?number(selectedSeat):'—'}</strong></div><label>${t('Demo passenger name')}<input name="passengerName" maxlength="80" required value="${e(passengerName)}" autocomplete="off"></label><p class="hint">${t('Use invented information only.')}</p><div class="deadline"><strong>${t('Payment deadline')}</strong><p>${number(workspace.company.holdMinutes)} ${t('minutes after reservation, no later than departure')}</p></div><button class="primary" ${selectedSeat?'':'disabled'}>${t('Reserve seat')}</button><p class="hint">${t(selectedSeat?'No payment is taken here. This creates a reservation reference, not a paid ticket.':'Choose an available seat to continue.')}</p></form></div></section><section class="panel"><div class="section-heading"><h2>${t('Reservations')}</h2><span class="count">${number(workspace.reservations.length)}</span></div>${reservationTable(workspace)}</section>`;
}

function selectField(label, name, values, value) {
  return `<label>${t(label)}<select name="${name}">${values.map(option=>`<option value="${option}" ${option===value?'selected':''}>${t(option)}</option>`).join('')}</select></label>`;
}

function freight(workspace) {
  return `<div class="two-columns freight-grid"><section class="panel"><p class="eyebrow">SAFEER / CARGO</p><h2>${t('Request freight transport')}</h2><p>${t('Freight uses cargo details, quantities and quotes rather than passenger seats.')}</p><form id="freight-form"><label>${t('Demo customer name')}<input name="customerName" value="Demo customer" required maxlength="80" autocomplete="off"></label><div class="form-grid">${selectField('Origin','from',cities,'Khartoum')}${selectField('Destination','to',cities,'Atbara')}</div>${selectField('Cargo category','category',categories,'General goods')}<div class="form-grid"><label>${t('Packages')}<input name="packages" type="number" min="1" max="10000" step="1" value="1" required></label><label>${t('Weight (kg)')}<input name="weightKg" type="number" min="0.1" max="1000000" step="0.1" value="10" required></label></div><p class="hint">${t('Use invented information only.')}</p><button class="primary">${t('Create demo request')}</button></form></section><section class="panel freight-flow"><span class="cargo-symbol" aria-hidden="true">▱</span><h2>${t('Freight journey')}</h2><p>${t('Request transport → company quote → confirmation → transport and delivery.')}</p><div class="callout">${t('A freight request does not assign a truck or confirm a delivery price.')}</div></section></div><section class="panel"><div class="section-heading"><h2>${t('Requests for this company')}</h2><span class="count">${number(workspace.freightRequests.length)}</span></div><div class="table-wrap"><table><thead><tr>${['Reference','Customer','Route','Cargo','Status'].map(label=>`<th>${t(label)}</th>`).join('')}</tr></thead><tbody>${workspace.freightRequests.map(row=>`<tr><td><bdi class="reference">${e(row.reference)}</bdi></td><td>${e(row.customerName)}</td><td>${route(row)}</td><td>${t(row.category)}<small class="subline">${number(row.packages)} · ${number(row.weightKg)} kg</small></td><td><span class="status requested">${t(row.status)}</span></td></tr>`).join('')||`<tr><td colspan="5">${t('No freight requests yet.')}</td></tr>`}</tbody></table></div></section>`;
}

function settings(workspace) {
  return `<div class="two-columns"><section class="panel"><p class="eyebrow">SAFEER / POLICY</p><h2>${t('Set the reservation window')}</h2><p>${t('Each company controls how long an unpaid seat is held. Expired reservations release the seat.')}</p><form id="policy-form"><label>${t('Hold duration (minutes)')}<input type="number" name="holdMinutes" min="5" max="1440" step="1" value="${workspace.company.holdMinutes}" required></label><p class="hint">${t('Applies to new reservations only. Existing deadlines remain unchanged. Prototype range: 5–1440 minutes.')}</p><button class="primary">${t('Save demo policy')}</button></form></section><section class="panel"><h2>${t('Still to decide together')}</h2><ul class="discussion-list">${['Passenger sign-in: phone verification or guest reservations?','Which staff roles can confirm payments, issue tickets and cancel bookings?','Freight pricing, delivery confirmation and receipt numbering.'].map(label=>`<li>${t(label)}</li>`).join('')}</ul><p class="callout">${t('Ticket and receipt issuance follows the payment workflow we agree. No real tickets or payment receipts are issued by this prototype.')}</p></section></div><section class="panel"><h2>${t('Separate workspaces for independent companies')}</h2><p>${t('Real company access will require staff sign-in and server-side permissions. This selector only switches fictional demo workspaces.')}</p></section>`;
}

function render() {
  clearTimeout(toastTimer);
  document.querySelector('#toast').className = '';
  expireReservations(state);
  const workspace = workspaceFor(state,companyId);
  document.documentElement.lang = language;
  document.documentElement.dir = language==='ar'?'rtl':'ltr';
  root.innerHTML = `<div class="shell"><aside class="sidebar"><a class="brand" href="/"><img src="/src/brand.svg" alt=""><span>Safeer <small>سفير</small></span></a><p class="sidebar-label">${t('Transport workspace')}</p><nav aria-label="${t('Transport workspace')}">${nav.map(([id,label,icon])=>`<button type="button" class="nav-item ${tab===id?'active':''}" data-nav="${id}" ${tab===id?'aria-current="page"':''}><span aria-hidden="true">${icon}</span>${t(label)}</button>`).join('')}</nav><div class="sidebar-footer"><span class="live-dot"></span>${t('Local prototype')}<small>v0.1.0 · Sudan</small></div></aside><div class="workspace"><header class="topbar"><label class="company-control"><span>${t('Demo company')}</span><select id="company-select">${state.companies.map(company=>`<option value="${company.id}" ${company.id===companyId?'selected':''}>${e(companyName(company))}</option>`).join('')}</select></label><div class="header-actions"><span class="demo-badge">${t('Local prototype')}</span><button type="button" id="language-button" class="secondary" lang="${language==='en'?'ar':'en'}">${language==='en'?'العربية':'English'}</button></div></header><main><div class="notice"><span aria-hidden="true">◉</span>${t('Fictional data only. No staff sign-in yet. Changes reset when you refresh.')}</div><header class="page-heading"><div><p class="eyebrow">SAFEER / ${e(companyName(workspace.company))}</p><h1>${t(tab==='overview'?'Passenger transport and freight, together.':nav.find(row=>row[0]===tab)[1])}</h1><p>${t('A first look at Safeer. Let’s agree the workflow before building the full system.')}</p></div>${tab==='overview'?`<button type="button" class="primary" data-nav="passengers">${t('Passenger preview')} ↗</button>`:''}</header>${tab==='overview'?overview(workspace):tab==='passengers'?passengers(workspace):tab==='freight'?freight(workspace):settings(workspace)}<footer class="footer"><strong>Safeer / سفير</strong><span>${t('All prices, routes and availability shown are illustrative. No actual travel or shipping is booked.')}</span></footer></main></div></div>`;
  bind();
}

function showReference(id) {
  const workspace = workspaceFor(state,companyId), row=workspace.reservations.find(item=>item.id===id);
  if (!row) return;
  const trip = workspace.trips.find(item=>item.id===row.tripId);
  dialog.dir = language==='ar'?'rtl':'ltr';
  dialog.innerHTML = `<div class="reference-sheet"><header class="reference-heading"><img src="/src/brand.svg" alt=""><span>Safeer / سفير</span><button type="button" class="secondary no-print" data-close>${t('Close')}</button></header><p class="eyebrow">${t('UNPAID · DEMONSTRATION')}</p><h2 id="reference-title">${t('Reservation reference')}</h2><bdi class="reference reference-large">${e(row.reference)}</bdi><dl>${[['Company',companyName(workspace.company)],['Passenger',row.passengerName],['Route',t(trip.from)+' → '+t(trip.to)],['Departure',date(trip.departureAt)],['Seat',number(row.seat)],['Example fare',number(trip.fare)+' SDG'],['Status',t(row.status)],['Payment deadline',date(row.expiresAt)]].map(([key,value])=>`<div><dt>${t(key)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl><p class="callout">${t('This reference is not proof of payment or permission to board. All details and prices are fictional.')}</p><button type="button" class="primary no-print" data-print>${t('Print reference')}</button></div>`;
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.querySelector('[data-print]').onclick = () => window.print();
  dialog.showModal();
}

function safely(action) { try { action(); } catch(error) { toast(error.message,true); } }

function bind() {
  root.querySelectorAll('[data-nav]').forEach(button=>button.onclick=()=>{tab=button.dataset.nav;selectedSeat=null;render();});
  root.querySelector('#language-button').onclick=()=>{language=language==='en'?'ar':'en';render();};
  root.querySelector('#company-select').onchange=event=>{companyId=event.target.value;tripId=workspaceFor(state,companyId).trips[0].id;selectedSeat=null;passengerName='Demo passenger';render();};
  root.querySelectorAll('[data-open-trip]').forEach(button=>button.onclick=()=>{tripId=button.dataset.openTrip;selectedSeat=null;tab='passengers';render();});
  const tripSelect=root.querySelector('#trip-select'); if(tripSelect)tripSelect.onchange=event=>{tripId=event.target.value;selectedSeat=null;render();};
  root.querySelectorAll('[data-seat]').forEach(button=>button.onclick=()=>{selectedSeat=Number(button.dataset.seat);render();root.querySelector(`[data-seat="${selectedSeat}"]`)?.focus();});
  const form=root.querySelector('#reservation-form');
  if(form){form.elements.passengerName.oninput=event=>{passengerName=event.target.value;};form.onsubmit=event=>{event.preventDefault();safely(()=>{const row=reserveSeat(state,companyId,{tripId,seat:selectedSeat,passengerName});selectedSeat=null;render();showReference(row.id);toast('Reservation created. No payment collected.');});};}
  root.querySelectorAll('[data-reference]').forEach(button=>button.onclick=()=>showReference(button.dataset.reference));
  root.querySelectorAll('[data-cancel]').forEach(button=>button.onclick=()=>safely(()=>{cancelReservation(state,companyId,button.dataset.cancel);render();toast('Reservation cancelled. The seat is available again.');}));
  const freightForm=root.querySelector('#freight-form');
  if(freightForm)freightForm.onsubmit=event=>{event.preventDefault();safely(()=>{const values=Object.fromEntries(new FormData(freightForm));requestFreight(state,companyId,{...values,packages:Number(values.packages),weightKg:Number(values.weightKg)});render();toast('Request created. A quote and transport confirmation are separate steps.');});};
  const policyForm=root.querySelector('#policy-form');
  if(policyForm)policyForm.onsubmit=event=>{event.preventDefault();safely(()=>{setHoldMinutes(state,companyId,Number(policyForm.elements.holdMinutes.value));toast('Policy updated for this company.');});};
}

render();
const expiryTimer=setInterval(()=>{
  if(expireReservations(state)){
    if(dialog.open)dialog.close();
    if(!['freight','settings'].includes(tab))render();
    toast('An unpaid reservation expired and its seat was released.');
  }
},1000);
window.addEventListener('pagehide',()=>{clearInterval(expiryTimer);clearTimeout(toastTimer);},{once:true});
