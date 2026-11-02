// Company bookings: passenger details stay behind this section's own request, so opening a company workspace reads none of them.
const statusLabel={held:'Held',expired:'Expired',released:'Released'},eventLabel={held:'Seats held',expired:'Hold ended',released:'Seats released',changed:'Details corrected',erased:'Personal details erased'},actorLabel={passenger:'by the passenger',staff:'by staff',trip_canceled:'when the trip was canceled',system:'automatically'};
const money=(row,language)=>new Intl.NumberFormat(language==='ar'?'ar-SD':'en-GB',{style:'currency',currency:row.currency,maximumFractionDigits:2}).format(row.amountMinor/100);
const route=(row,language)=>language==='ar'?row.routeNameAr:row.routeNameEn;
export function bookingsView(data,{t}){
 return `<section class="staff-panel"><header class="staff-section-head"><div><h2>${t('Bookings')}</h2><p>${t('Find a booking by reference, mobile number or traveler name. Viewing bookings is recorded in the company audit.')}</p></div></header><form id="booking-search" class="booking-search"><label>${t('Search')}<input type="search" name="q" maxlength="100"></label><button type="submit" class="staff-primary">${t('Search')}</button></form><div id="booking-results" aria-live="polite"><p role="status">${t('Loading bookings…')}</p></div></section>`;
}
export function bindBookings(root,data,ctx){
 const {api,openForm,input,currentPassword,dialog,t,e,language}=ctx,path='companies/'+data.company.id+'/bookings',box=root.querySelector('#booking-results'),when=(row,value)=>new Intl.DateTimeFormat('en-GB',{dateStyle:'short',timeStyle:'short',timeZone:row.timezone}).format(new Date(value));
 const failure=error=>`<p role="alert">${e(t(error.message))}</p>`;
 const search=async q=>{
  try{
   const result=await api(path+(q?'?q='+encodeURIComponent(q):''));if(!box.isConnected)return;
   box.innerHTML=result.items.length?`<div class="staff-grid">${result.items.map(row=>`<article class="staff-record"><span class="staff-badge">${t(statusLabel[row.status])}</span><h3><bdi>${e(row.reference)}</bdi></h3><p>${e(route(row,language))} · <bdi>${e(row.date)} ${e(row.time)}</bdi></p><p>${!row.hasDetails?t('No passenger details recorded'):row.detailsErased?t('Personal details erased'):`${e(row.travelers[0]?.name||'')} · <bdi>${e(row.mobile||'')}</bdi>`}</p><p>${t('Seats')}: <bdi>${e(row.seats.join(', '))}</bdi> · <bdi>${e(money(row,language))}</bdi></p><div class="staff-actions"><button type="button" data-booking-open="${e(row.id)}">${t('View booking')}</button></div></article>`).join('')}</div>`:`<p>${t(q?'No bookings match your search.':'No bookings yet.')}</p>`;
   box.querySelectorAll('[data-booking-open]').forEach(button=>button.onclick=()=>void open(button,button.dataset.bookingOpen));
  }catch(error){if(box.isConnected)box.innerHTML=failure(error);}
 };
 const open=async(button,id)=>{
  button.disabled=true;
  try{
   const row=await api(path+'/'+id);if(!button.isConnected)return;
   const held=row.status==='held'&&row.canManage,noReasonHint=`<p class="staff-muted">${t('Do not include names or numbers in the reason.')}</p>`;
   dialog.innerHTML=`<header class="staff-section-head"><h2><bdi>${e(row.reference)}</bdi></h2><button type="button" data-booking-close>${t('Close')}</button></header><p><span class="staff-badge">${t(statusLabel[row.status])}</span> ${e(route(row,language))} · <bdi>${e(row.date)} ${e(row.time)}</bdi></p><p>${t('Total')}: <bdi>${e(money(row,language))}</bdi></p>${!row.hasDetails?`<p>${t('No passenger details recorded')}</p>`:row.detailsErased?`<p>${t('Personal details erased')}</p>`:`<p>${t('Mobile number')}: <a dir="ltr" href="tel:${e(row.mobile||'')}">${e(row.mobile||'')}</a></p><h3>${t('Travelers')}</h3><ul class="booking-travelers">${row.travelers.map(p=>`<li><strong>${t('Seat')} <bdi>${e(p.seat)}</bdi></strong> ${e(p.name)}${p.mobile?` · <bdi>${e(p.mobile)}</bdi>`:''}</li>`).join('')}</ul><p class="staff-muted">${t('Erased automatically on')} <bdi>${e(when(row,row.eraseAt))}</bdi></p>`}<h3>${t('History')}</h3><ol class="booking-events">${row.events.map(event=>`<li>${t(eventLabel[event.event])} ${actorLabel[event.actorKind]?t(actorLabel[event.actorKind]):''}${event.reason?` · ${e(event.reason)}`:''} <small><bdi>${e(when(row,event.at))}</bdi></small></li>`).join('')}</ol>${held?`<div class="staff-actions">${row.hasDetails&&!row.detailsErased?`<button type="button" data-booking-correct>${t('Correct details')}</button>`:''}<button type="button" data-booking-release>${t('Release hold')}</button></div>`:''}`;
   dialog.querySelector('[data-booking-close]').onclick=()=>dialog.close();
   dialog.querySelector('[data-booking-correct]')?.addEventListener('click',()=>openForm('Correct details',input('mobile','Mobile number','tel',`dir="ltr" maxlength="30" value="${e(row.mobile)}"`)+row.travelers.map((p,i)=>input('name-'+i,t('Seat')+' '+e(p.seat)+' · '+t('Full name'),'text',`maxlength="100" value="${e(p.name)}"`)).join('')+noReasonHint+input('reason','Reason for the change','text','maxlength="300"')+currentPassword(),f=>api(path+'/'+row.id,'PATCH',{mobile:f.get('mobile'),seats:row.seats,travelers:row.travelers.map((p,i)=>({seat:p.seat,name:f.get('name-'+i),mobile:p.mobile})),reason:f.get('reason'),version:row.version,currentPassword:f.get('currentPassword')})));
   dialog.querySelector('[data-booking-release]')?.addEventListener('click',()=>openForm('Release hold',`<p><bdi>${e(row.reference)}</bdi></p><p>${t('The seats go back on sale immediately. The passenger will see that the company released them.')}</p>`+noReasonHint+input('reason','Reason','text','maxlength="300"')+currentPassword(),f=>api(`companies/${data.company.id}/trips/${row.tripId}/holds/${row.id}/release`,'POST',{reason:f.get('reason'),currentPassword:f.get('currentPassword')})));
   if(!dialog.open)dialog.showModal();
  }catch(error){if(box.isConnected)box.insertAdjacentHTML('afterbegin',failure(error));}finally{if(button.isConnected)button.disabled=false;}
 };
 root.querySelector('#booking-search').onsubmit=event=>{event.preventDefault();void search(new FormData(event.target).get('q').trim());};
 void search('');
}
