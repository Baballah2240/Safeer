import {themeButton,sidebarButton} from './theme.js';
import {translate} from './i18n.js';
import {createDemo} from './demo.mjs';
import {workspaceFor, expireReservations, occupiedSeats, reserveSeat, cancelReservation, setHoldMinutes} from './domain.mjs';

const state = createDemo();
const root = document.querySelector('#app');
const dialog = document.querySelector('#reference-dialog');
let companyId = state.companies[0].id;
let tab = 'overview';
let language = new URL(location.href).searchParams.get('lang') === 'ar' ? 'ar' : 'en';
let tripId = state.trips[0].id;
let selectedSeat = null;
let passengerName = 'Demo passenger';
let hasLuggage = false;
let luggageDescription = '';
let toastTimer;

const t = value => translate(value, language);

const e = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const number = value => new Intl.NumberFormat(language === 'ar' ? 'ar-SD' : 'en-GB').format(value);
const date = value => new Intl.DateTimeFormat(language === 'ar' ? 'ar-SD' : 'en-GB', {timeZone:'Africa/Khartoum', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}).format(value);
const companyName = company => language === 'ar' ? company.nameAr : company.name;
const route = trip => `${t(trip.from)} <span class="route-arrow" aria-hidden="true">↗</span> ${t(trip.to)}`;
const nav = [['overview','Overview','◫'],['passengers','Passenger reservations','▦'],['settings','Company policy','⚙']];

function toast(message, bad = false) {
  const node = document.querySelector('#toast'); node.textContent = t(message); node.className = bad ? 'show bad' : 'show';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.className = ''; }, 6000);
}

function tripTable(workspace) {
  return `<div class="table-wrap"><table><thead><tr>${['Route','Departure','Vehicle','Availability','Example fare','Actions'].map(label=>`<th>${t(label)}</th>`).join('')}</tr></thead><tbody>${workspace.trips.map(trip=>`<tr><td><strong>${route(trip)}</strong></td><td>${e(date(trip.departureAt))}</td><td><span class="vehicle">${e(trip.vehicle)}</span></td><td><span class="availability">${number(trip.capacity-occupiedSeats(state,trip.id).size)} ${t('seats free')}</span></td><td>${number(trip.fare)} <small>${e(trip.currency)}</small></td><td><button class="text-button" data-open-trip="${trip.id}">${t('Choose a seat')} <span aria-hidden="true">↗</span></button></td></tr>`).join('')}</tbody></table></div>`;
}

function overview(workspace) {
  const available = workspace.trips.reduce((sum, trip) => sum + trip.capacity - occupiedSeats(state,trip.id).size, 0);
  return `<section class="metrics">${[['Sample trips',workspace.trips.length],['Available seats',available],['Active reservations',workspace.reservations.filter(row=>row.status==='reserved').length],['Total seats',workspace.trips.reduce((sum,trip)=>sum+trip.capacity,0)]].map(([label,value],index)=>`<article class="metric"><span>${t(label)}</span><strong>${number(value)}</strong><small>0${index+1} <span class="metric-line"></span></small></article>`).join('')}</section>
    <section class="panel"><div class="section-heading"><div><p class="eyebrow">SAFEER / ${t('Trip')}</p><h2>${t('Upcoming sample trips')}</h2></div><button class="secondary" data-nav="passengers">${t('View trips')}</button></div>${tripTable(workspace)}</section>
    <div class="two-columns"><section class="panel"><h2>${t('Passenger booking flow')}</h2><article class="flow-item"><span class="flow-number">01</span><div><h3>${t('Passenger journey')}</h3><p>${t('Choose trip → choose seat → reserve → pay the company offline.')}</p></div></article><article class="flow-item"><span class="flow-number">02</span><div><h3>${t('Official ticket after station payment')}</h3><p>${t('Company staff confirm offline payment before issuing a final ticket and receipt.')}</p></div></article></section><section class="panel"><h2>${t('Confirmed basics')}</h2><ul class="check-list">${['Passenger transport and luggage in release 1','Separate workspaces for independent companies','Company-defined payment deadlines','No online payment collection'].map(label=>`<li>${t(label)}</li>`).join('')}</ul><button class="text-button" data-nav="settings">${t('Plan the real system')} ↗</button></section></div>`;
}

function reservationTable(workspace) {
  return `<div class="table-wrap"><table><thead><tr>${['Reference','Passenger','Trip','Seat','Status','Expires','Actions'].map(label=>`<th>${t(label)}</th>`).join('')}</tr></thead><tbody>${workspace.reservations.map(row=>{const trip=workspace.trips.find(trip=>trip.id===row.tripId);return `<tr><td><bdi class="reference">${e(row.reference)}</bdi></td><td>${e(row.passengerName)}<small class="passenger-luggage">${t(row.hasLuggage?'Has luggage':'No luggage')}${row.hasLuggage?': '+e(row.luggageDescription):''}</small></td><td>${route(trip)}</td><td>${number(row.seat)}</td><td><span class="status ${row.status}">${t(row.status)}</span></td><td>${e(date(row.expiresAt))}</td><td><div class="row-actions"><button class="text-button" data-reference="${row.id}">${t('View reference')}</button>${row.status==='reserved'?`<button class="text-button danger" data-cancel="${row.id}">${t('Cancel')}</button>`:''}</div></td></tr>`;}).join('')||`<tr><td colspan="7" class="empty">${t('No reservations yet.')}</td></tr>`}</tbody></table></div>`;
}

function luggageFields() {
  return `<label>${t('Does the passenger have luggage?')}<select name="hasLuggage" aria-controls="luggage-details"><option value="no" ${hasLuggage?'':'selected'}>${t('No luggage')}</option><option value="yes" ${hasLuggage?'selected':''}>${t('Has luggage')}</option></select></label><label id="luggage-details" class="luggage-details" ${hasLuggage?'':'hidden'}>${t('Luggage description')}<textarea name="luggageDescription" rows="3" maxlength="300" aria-describedby="luggage-hint" ${hasLuggage?'required':'disabled'}>${e(luggageDescription)}</textarea><span id="luggage-hint" class="hint">${t('Describe the bags, colour and any identifying details. Maximum 300 characters.')}</span></label>`;
}

function passengers(workspace) {
  const trip = workspace.trips.find(row=>row.id===tripId) || workspace.trips[0];
  const occupied = occupiedSeats(state,trip.id); tripId = trip.id;
  if (occupied.has(selectedSeat)) selectedSeat = null;
  const rows = Array.from({length:Math.ceil(trip.capacity/4)},(_,row)=>`<div class="seat-row">${[0,1,2,3].map(column=>{const seat=row*4+column+1;return `${column===2?'<span class="aisle" aria-hidden="true"></span>':''}${seat<=trip.capacity?`<button type="button" class="seat ${seat===selectedSeat?'selected':''}" data-seat="${seat}" ${occupied.has(seat)?'disabled':''} aria-pressed="${seat===selectedSeat}" aria-label="${t('Seat')} ${seat}${occupied.has(seat)?' · '+t('Unavailable'):''}">${seat}</button>`:''}`;}).join('')}</div>`).join('');
  return `<section class="panel"><div class="section-heading"><div><p class="eyebrow">SAFEER / ${t('Passenger preview')}</p><h2>${t('Reserve a sample seat')}</h2><p>${t('Explore a trip and create an unpaid demonstration reservation.')}</p></div></div><label class="trip-choice">${t('Trip')}<select id="trip-select">${workspace.trips.map(item=>`<option value="${item.id}" ${item.id===trip.id?'selected':''}>${t(item.from)} → ${t(item.to)} · ${e(date(item.departureAt))}</option>`).join('')}</select></label><div class="booking-grid"><div class="bus-area"><div class="seat-legend"><span><i></i>${t('Available')}</span><span><i class="taken"></i>${t('Unavailable')}</span><span><i class="selected"></i>${t('Selected')}</span></div><div class="bus"><div class="bus-front">${t('Bus front · example 2+2 layout')}</div>${rows}</div></div><form id="reservation-form" class="booking-summary"><p class="eyebrow">${t('Reservation summary')}</p><h2>${route(trip)}</h2><p>${e(date(trip.departureAt))} · ${e(trip.vehicle)}</p><div class="price"><strong>${number(trip.fare)}</strong> ${e(trip.currency)}<small>${t('Example fare')}</small></div><div class="summary-seat"><span>${t('Seat')}</span><strong>${selectedSeat?number(selectedSeat):'—'}</strong></div><label>${t('Demo passenger name')}<input name="passengerName" maxlength="80" required value="${e(passengerName)}" autocomplete="off"></label><p class="hint">${t('Use invented information only.')}</p>${luggageFields()}<div class="deadline"><strong>${t('Payment deadline')}</strong><p>${number(workspace.company.holdMinutes)} ${t('minutes after reservation, no later than departure')}</p></div><button class="primary" ${selectedSeat?'':'disabled'}>${t('Reserve seat')}</button><p class="hint">${t(selectedSeat?'No payment is taken here. This creates a reservation reference, not a paid ticket.':'Choose an available seat to continue.')}</p></form></div></section><section class="panel"><div class="section-heading"><h2>${t('Reservations')}</h2><span class="count">${number(workspace.reservations.length)}</span></div>${reservationTable(workspace)}</section>`;
}

function settings(workspace) {
  return `<div class="two-columns"><section class="panel"><p class="eyebrow">SAFEER / POLICY</p><h2>${t('Set the reservation window')}</h2><p>${t('Each company controls how long an unpaid seat is held. Expired reservations release the seat.')}</p><form id="policy-form"><label>${t('Hold duration (minutes)')}<input type="number" name="holdMinutes" min="5" max="1440" step="1" value="${workspace.company.holdMinutes}" required></label><p class="hint">${t('Applies to new reservations only. Existing deadlines remain unchanged. Prototype range: 5–1440 minutes.')}</p><button class="primary">${t('Save demo policy')}</button></form></section><section class="panel"><h2>${t('Approved foundations')}</h2><ul class="discussion-list">${['Guest booking is approved; the real booking module will collect full name and mobile number.','Local staff sign-in and role management are available in Staff access.','Passenger luggage is planned for Section 11; it is not parcel shipping.'].map(label=>`<li>${t(label)}</li>`).join('')}</ul><p class="callout">${t('Official tickets and receipts require confirmed station payment. They are not issued by this prototype.')}</p></section></div><section class="panel"><div class="section-heading"><div><h2>${t('Manage staff accounts')}</h2><p>${t('Open the local staff workspace to manage accounts, roles and sign-in sessions.')}</p></div><a class="secondary workspace-link" href="/staff?lang=${language}">${t('Staff access')} &#8599;</a></div><h3>${t('Separate workspaces for independent companies')}</h3><p>${t('Staff company access uses authenticated memberships. This selector switches fictional demo workspaces only.')}</p></section>`;
}

function render() {
  clearTimeout(toastTimer);
  document.querySelector('#toast').className = '';
  expireReservations(state);
  const workspace = workspaceFor(state,companyId);
  document.documentElement.lang = language;
  document.documentElement.dir = language==='ar'?'rtl':'ltr';
  root.innerHTML = `<div class="shell"><aside class="sidebar" id="preview-sidebar"><a class="brand" href="/?lang=${language}"><img src="/src/brand.svg" alt=""><span>Safeer <small>سفير</small></span></a><p class="sidebar-label">${t('Transport workspace')}</p><nav aria-label="${t('Transport workspace')}">${nav.map(([id,label,icon])=>`<button type="button" class="nav-item ${tab===id?'active':''}" data-nav="${id}" ${tab===id?'aria-current="page"':''}><span aria-hidden="true">${icon}</span>${t(label)}</button>`).join('')}<a class="nav-item" href="/staff?lang=${language}"><span aria-hidden="true">↗</span>${t('Staff access')}</a></nav><div class="sidebar-footer"><span class="live-dot"></span>${t('Local prototype')}<small>${t("Staff and permissions")} \u00b7 ${t("Sudan")}</small></div></aside><div class="workspace"><header class="topbar"><label class="company-control"><span>${t('Demo company')}</span><select id="company-select">${state.companies.map(company=>`<option value="${company.id}" ${company.id===companyId?'selected':''}>${e(companyName(company))}</option>`).join('')}</select></label><div class="header-actions">${sidebarButton(language,"preview-sidebar")}${themeButton(language)}<span class="demo-badge">${t('Local prototype')}</span><button type="button" id="language-button" class="secondary" lang="${language==='en'?'ar':'en'}">${language==='en'?'العربية':'English'}</button></div></header><main><div class="notice"><span aria-hidden="true">◉</span>${t('Fictional reservations reset on refresh. Staff accounts are managed separately in Staff access.')}</div><header class="page-heading"><div><p class="eyebrow">SAFEER / ${e(companyName(workspace.company))}</p><h1>${t(tab==='overview'?'Passenger transport workspace':nav.find(row=>row[0]===tab)[1])}</h1><p>${t('Browse sample trips, choose a seat and review the reservation.')}</p></div>${tab==='overview'?`<button type="button" class="primary" data-nav="passengers">${t('Passenger preview')} ↗</button>`:''}</header>${tab==='overview'?overview(workspace):tab==='passengers'?passengers(workspace):settings(workspace)}<footer class="footer"><strong>Safeer / سفير</strong><span>${t('All prices, routes and availability shown are illustrative. No actual travel is booked.')}</span></footer></main></div></div>`;
  bind();
}

function showReference(id) {
  const workspace = workspaceFor(state,companyId), row=workspace.reservations.find(item=>item.id===id);
  if (!row) return;
  const trip = workspace.trips.find(item=>item.id===row.tripId);
  dialog.dir = language==='ar'?'rtl':'ltr';
  dialog.innerHTML = `<div class="reference-sheet"><header class="reference-heading"><img src="/src/brand.svg" alt=""><span>Safeer / سفير</span><button type="button" class="secondary no-print" data-close>${t('Close')}</button></header><p class="eyebrow">${t('UNPAID · DEMONSTRATION')}</p><h2 id="reference-title">${t('Reservation reference')}</h2><bdi class="reference reference-large">${e(row.reference)}</bdi><dl>${[['Company',companyName(workspace.company)],['Passenger',row.passengerName],['Luggage',t(row.hasLuggage?'Has luggage':'No luggage')],...(row.hasLuggage?[['Luggage description',row.luggageDescription]]:[]),['Route',t(trip.from)+' → '+t(trip.to)],['Departure',date(trip.departureAt)],['Seat',number(row.seat)],['Example fare',number(trip.fare)+' '+trip.currency],['Status',t(row.status)],['Payment deadline',date(row.expiresAt)]].map(([key,value])=>`<div><dt>${t(key)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl><p class="callout">${t('This reference is not proof of payment or permission to board. All details and prices are fictional.')}</p><button type="button" class="primary no-print" data-print>${t('Print reference')}</button></div>`;
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.querySelector('[data-print]').onclick = () => window.print();
  dialog.showModal();
}

function safely(action) { try { action(); } catch(error) { toast(error.message,true); } }

function bind() {
  root.querySelectorAll('[data-nav]').forEach(button=>button.onclick=()=>{tab=button.dataset.nav;selectedSeat=null;render();});
  root.querySelector('#language-button').onclick=()=>{language=language==='en'?'ar':'en';const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);render();};
  root.querySelector('#company-select').onchange=event=>{companyId=event.target.value;tripId=workspaceFor(state,companyId).trips[0].id;selectedSeat=null;passengerName='Demo passenger';hasLuggage=false;luggageDescription='';render();};
  root.querySelectorAll('[data-open-trip]').forEach(button=>button.onclick=()=>{tripId=button.dataset.openTrip;selectedSeat=null;tab='passengers';render();});
  const tripSelect=root.querySelector('#trip-select'); if(tripSelect)tripSelect.onchange=event=>{tripId=event.target.value;selectedSeat=null;render();};
  root.querySelectorAll('[data-seat]').forEach(button=>button.onclick=()=>{selectedSeat=Number(button.dataset.seat);render();root.querySelector(`[data-seat="${selectedSeat}"]`)?.focus();});
  const form=root.querySelector('#reservation-form');
  if(form){
    form.elements.passengerName.oninput=event=>{passengerName=event.target.value;};
    form.elements.hasLuggage.onchange=event=>{
      hasLuggage=event.target.value==='yes';
      const description=form.elements.luggageDescription;
      form.querySelector('#luggage-details').hidden=!hasLuggage;
      description.disabled=!hasLuggage; description.required=hasLuggage;
      if(!hasLuggage){luggageDescription='';description.value='';}
    };
    form.elements.luggageDescription.oninput=event=>{luggageDescription=event.target.value;};
    form.onsubmit=event=>{event.preventDefault();safely(()=>{
      const row=reserveSeat(state,companyId,{tripId,seat:selectedSeat,passengerName,hasLuggage,luggageDescription});
      selectedSeat=null;hasLuggage=false;luggageDescription='';render();showReference(row.id);toast('Reservation created. No payment collected.');
    });};
  }
  root.querySelectorAll('[data-reference]').forEach(button=>button.onclick=()=>showReference(button.dataset.reference));
  root.querySelectorAll('[data-cancel]').forEach(button=>button.onclick=()=>safely(()=>{if(!confirm(t('Cancel this unpaid demo reservation?')))return;cancelReservation(state,companyId,button.dataset.cancel);render();toast('Reservation cancelled. The seat is available again.');}));
  const policyForm=root.querySelector('#policy-form');
  if(policyForm)policyForm.onsubmit=event=>{event.preventDefault();safely(()=>{setHoldMinutes(state,companyId,Number(policyForm.elements.holdMinutes.value));toast('Policy updated for this company.');});};
}

render();
let expiryTimer;
function refreshExpiry() {
  if (expireReservations(state)) {
    if (dialog.open) dialog.close();
    if (tab !== 'settings') render();
    toast('An unpaid reservation expired and its seat was released.');
  }
}
function startExpiry() {
  clearInterval(expiryTimer);
  refreshExpiry();
  expiryTimer = setInterval(refreshExpiry, 1000);
}
startExpiry();
window.addEventListener('pageshow', startExpiry);
window.addEventListener('pagehide', () => { clearInterval(expiryTimer); clearTimeout(toastTimer); });
