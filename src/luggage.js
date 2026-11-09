// Passenger luggage at the station: find a ticket or bag, register, tag, move, report problems and hand over.
const statusLabel={registered:'Registered',tagged:'Tagged',loaded:'Loaded',in_transit:'In transit',unloaded:'Unloaded',collected:'Collected',lost:'Lost',exception_reported:'Problem reported'},categoryLabel={suitcase:'Suitcase',bag:'Bag',box:'Box',other:'Other'},kindLabel={damaged:'Damaged',missing:'Missing',wrong_bag:'Wrong bag',other:'Other'},outcomeLabel={found:'Found',settled:'Settled with the passenger',closed:'Closed'},eventLabel={registered:'Registered',updated:'Details changed',tagged:'Tag printed',tag_replaced:'Tag replaced',moved:'Moved',corrected:'Corrected',returned:'Returned before travel',collected:'Collected',exception_reported:'Problem reported',exception_resolved:'Problem resolved'};
const nextStep={tagged:['loaded','Mark loaded'],loaded:['in_transit','Mark in transit'],in_transit:['unloaded','Mark unloaded']};
const kilos=grams=>(grams/1000).toLocaleString('en-GB',{maximumFractionDigits:3});
export function luggageView(data,{t}){
 return `<section class="staff-panel"><header class="staff-section-head"><div><h2>${t('Luggage')}</h2><p>${t('Scan a tag, or type a ticket, tag, bag or booking number. Searches are recorded in the company audit.')}</p></div></header><form id="luggage-search" class="booking-search"><label>${t('Scan or search')}<input type="search" name="q" maxlength="40" dir="ltr" autocomplete="off"></label><button type="submit" class="staff-primary">${t('Search')}</button><button type="button" id="luggage-refresh">${t('Refresh luggage')}</button></form><div id="luggage-results" aria-live="polite"><p role="status">${t('Loading luggage…')}</p></div></section>`;
}
export function bindLuggage(root,data,ctx){
 const {api,openForm,input,currentPassword,dialog,t,e,language}=ctx,base=`companies/${data.company.id}/luggage`,box=root.querySelector('#luggage-results'),canOperate=data.capabilities.luggage,canResolve=data.capabilities.luggageResolve;
 const form=root.querySelector('#luggage-search');
 const when=(row,value)=>new Intl.DateTimeFormat('en-GB',{dateStyle:'short',timeStyle:'short',timeZone:row.timezone}).format(new Date(value));
 const route=row=>language==='ar'?row.routeNameAr:row.routeNameEn;
 const noNames=`<p class="staff-muted">${t('Do not include names or numbers.')}</p>`;
 if(remembered.company!==data.company.id)remembered={company:data.company.id,query:null};
 let current={query:remembered.query,token:null},notice='',latest=0;
 const fields=row=>`<label>${t('Type')}<select name="category">${Object.keys(categoryLabel).map(c=>`<option value="${c}" ${row?.category===c?'selected':''}>${t(categoryLabel[c])}</option>`).join('')}</select></label>${input('quantity','Number of pieces','number',`min="1" max="20" step="1" value="${row?.quantity??1}"`)}${input('kilos','Weight in kilograms','number',`min="0.001" max="500" step="0.001" value="${row?row.weightGrams/1000:''}"`)}<label>${t('Description (optional)')}<input name="description" maxlength="300" value="${e(row?.description||'')}"></label><label>${t('Handling (optional)')}<input name="handling" maxlength="200" value="${e(row?.handling||'')}"></label>${noNames}`;
 const values=f=>({category:f.get('category'),quantity:Number(f.get('quantity')),weightGrams:Math.round(Number(f.get('kilos'))*1000),description:f.get('description')||null,handling:f.get('handling')||null});
 const card=row=>{
  const collected=row.lifecycle==='collected'||row.lifecycle==='lost',open=row.exception,next=nextStep[row.lifecycle],early=row.lifecycle==='registered'||row.lifecycle==='tagged';
  const actions=[
   canOperate&&!collected&&(row.tagNumber?`<button type="button" data-tag="${e(row.id)}" data-replace="1">${t('Replace tag')}</button>`:`<button type="button" class="staff-primary" data-tag="${e(row.id)}">${t('Print tag')}</button>`),
   canOperate&&next&&`<button type="button" data-move="${e(row.id)}" data-to="${next[0]}">${t(next[1])}</button>`,
   canOperate&&row.lifecycle==='loaded'&&`<button type="button" data-unload="${e(row.id)}">${t('Take off the bus')}</button>`,
   canOperate&&(early||row.lifecycle==='unloaded')&&!open&&`<button type="button" data-collect="${e(row.id)}">${t(early?'Return to passenger':'Hand over')}</button>`,
   canOperate&&early&&`<button type="button" data-edit="${e(row.id)}">${t('Change details')}</button>`,
   canOperate&&!open&&`<button type="button" data-report="${e(row.id)}">${t('Report a problem')}</button>`,
   canResolve&&open&&`<button type="button" data-resolve="${e(row.id)}">${t('Resolve problem')}</button>`,
  ].filter(Boolean).join('');
  return `<article class="staff-record"><span class="staff-badge">${t(statusLabel[row.status])}</span><h3><bdi>${e(row.number)}</bdi></h3><p>${e(route(row))} · <bdi>${e(row.date)} ${e(row.time)}</bdi>${row.busRegistration?` · <bdi>${e(row.busRegistration)}</bdi>`:''}</p><p>${row.traveler?`${e(row.traveler)} · `:''}${t('Seat')} <bdi>${e(row.seat)}</bdi> · <bdi>${e(row.ticketNumber)}</bdi></p><p>${t(categoryLabel[row.category])} × <bdi>${row.quantity}</bdi> · <bdi>${e(kilos(row.weightGrams))}</bdi> ${t('kg')}${row.tagNumber?` · <bdi>${e(row.tagNumber)}</bdi>`:''}</p>${row.description?`<p>${e(row.description)}</p>`:''}${row.handling?`<p><strong>${t('Handling')}:</strong> ${e(row.handling)}</p>`:''}${open?`<p class="staff-alert bad">${t(kindLabel[open.kind])}${open.note?`: ${e(open.note)}`:''} · ${t('Recorded state')}: ${t(statusLabel[row.lifecycle])}.${collected?'':` ${t('This bag cannot be handed over until the problem is resolved.')}`}</p>`:''}<details><summary>${t('History')}</summary><ol class="booking-events">${row.events.map(v=>`<li>${t(eventLabel[v.event])}${v.to&&v.event==='moved'?` · ${t(statusLabel[v.to])}`:''}${v.before?` · ${t('Weight before')}: <bdi>${e(kilos(v.before.weightGrams))}</bdi> ${t('kg')}`:''} · ${e(v.by)}${v.reason?` · ${e(v.reason)}`:''} <small><bdi>${e(when(row,v.at))}</bdi></small></li>`).join('')}</ol></details>${actions?`<div class="staff-actions">${actions}</div>`:''}</article>`;
 };
 const paint=result=>{
  if(!box.isConnected)return;
  const ticket=result.ticket,items=result.items,find=id=>items.find(row=>row.id===id);
  const head=ticket?`<article class="staff-record"><strong><bdi>${e(ticket.number)}</bdi></strong><p>${ticket.traveler?`${e(ticket.traveler)} · `:''}${t('Seat')} <bdi>${e(ticket.seat)}</bdi> ${ticket.reference?` · <bdi>${e(ticket.reference)}</bdi>`:''}</p>${ticket.declared?`<p>${t('Traveler says they have')}: ${e(ticket.declared)}</p>`:''}${ticket.status!=='valid'?`<p class="staff-alert bad">${t('This ticket was refunded, so no bags can be registered.')}</p>`:canOperate&&ticket.canRegister?`<div class="staff-actions"><button type="button" class="staff-primary" id="luggage-register">${t('Register a bag')}</button></div>`:''}</article>`:'';
  const empty=result.searchOnly&&!current.query&&!current.token?t('Enter a ticket, tag, bag or booking number to find luggage.'):t(current.query||current.token?'No luggage matches your search.':'No luggage yet.');
  box.removeAttribute('aria-busy');
  box.innerHTML=`${items.length===50?`<p class="staff-alert" role="status">${t('Showing the latest 50 matching bags. Search by bag or tag number to find an older bag.')}</p>`:''}${notice?`<p class="staff-alert bad" role="alert">${e(t(notice))}</p>`:''}<div class="staff-grid">${head}${items.map(card).join('')}</div>${head||items.length?'':`<p>${empty}</p>`}`;
  box.querySelector('#luggage-register')?.addEventListener('click',()=>{const key=crypto.randomUUID();openForm('Register a bag',`<p><bdi>${e(ticket.number)}</bdi></p>`+fields(),f=>api(base,'POST',{ticketNumber:ticket.number,...values(f),key}).catch(error=>{throw error.message==='REQUEST_FAILED'||error.message==='IDEMPOTENCY_CONFLICT'?Error('BAG_MAYBE_SAVED'):error;}));dialog.addEventListener('close',()=>void load(),{once:true});});
  box.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const row=find(b.dataset.edit);openForm('Change details',`<p><bdi>${e(row.number)}</bdi></p>`+fields(row),f=>api(`${base}/${row.id}`,'PATCH',{...values(f),version:row.version}));});
  box.querySelectorAll('[data-move]').forEach(b=>b.onclick=async()=>{const row=find(b.dataset.move);b.disabled=true;try{await api(`${base}/${row.id}/move`,'POST',{to:b.dataset.to,version:row.version});await load();}catch(error){b.disabled=false;b.insertAdjacentHTML('afterend',`<p class="staff-alert bad" role="alert">${e(t(error.message))}</p>`);}});
  box.querySelectorAll('[data-unload]').forEach(b=>b.onclick=()=>{const row=find(b.dataset.unload);openForm('Take off the bus',`<p><bdi>${e(row.number)}</bdi></p>`+input('reason','Reason','text','maxlength="300"')+noNames,f=>api(`${base}/${row.id}/move`,'POST',{to:'tagged',reason:f.get('reason'),version:row.version}));});
  box.querySelectorAll('[data-collect]').forEach(b=>b.onclick=()=>{const row=find(b.dataset.collect),early=row.lifecycle!=='unloaded';openForm(early?'Return to passenger':'Hand over',`<p><bdi>${e(row.number)}</bdi></p><p>${t('Ask for the ticket number or the mobile number on the booking.')}</p>`+input('proof','Ticket or mobile number','text','maxlength="40" dir="ltr" autocomplete="off"')+(early?input('reason','Reason','text','maxlength="300"')+noNames:''),f=>api(`${base}/${row.id}/collect`,'POST',{proof:f.get('proof'),reason:f.get('reason')||null,version:row.version}));});
  box.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>{const row=find(b.dataset.report);openForm('Report a problem',`<p><bdi>${e(row.number)}</bdi></p><label>${t('Problem')}<select name="kind">${Object.keys(kindLabel).map(k=>`<option value="${k}">${t(kindLabel[k])}</option>`).join('')}</select></label><label>${t('Note (optional)')}<input name="note" maxlength="300"></label>`+noNames,f=>api(`${base}/${row.id}/exceptions`,'POST',{kind:f.get('kind'),note:f.get('note')||null}));});
  box.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=()=>{const row=find(b.dataset.resolve);openForm('Resolve problem',`<p><bdi>${e(row.number)}</bdi> · ${t(kindLabel[row.exception.kind])}</p><label>${t('Outcome')}<select name="outcome">${Object.keys(outcomeLabel).map(k=>`<option value="${k}">${t(outcomeLabel[k])}</option>`).join('')}</select></label>${row.exception.kind==='missing'?`<p class="staff-alert bad">${t('For a missing bag, Settled or Closed permanently marks it Lost and ends company custody. Choose Found only when it has been found.')}</p>`:''}<label>${t('Note (optional)')}<input name="note" maxlength="300"></label>`+noNames+currentPassword(),f=>api(`${base}/${row.id}/exceptions/${row.exception.id}/resolve`,'POST',{outcome:f.get('outcome'),note:f.get('note')||null,currentPassword:f.get('currentPassword')}));});
  box.querySelectorAll('[data-tag]').forEach(b=>b.onclick=async()=>{
   const row=find(b.dataset.tag),show=result=>{dialog.innerHTML=`<div class="print-sheet"><article class="print-ticket luggage-tag"><header class="print-head"><strong>${e(language==='ar'?data.company.nameAr:data.company.nameEn)}</strong><h2>${t('Luggage tag')}</h2></header><svg class="luggage-qr" viewBox="-4 -4 ${result.qr.size+8} ${result.qr.size+8}" role="img" aria-label="${e(t('QR code'))}"><rect x="-4" y="-4" width="${result.qr.size+8}" height="${result.qr.size+8}" fill="#fff"/><path d="${e(result.qr.path)}" fill="#000"/></svg><p class="print-number"><bdi>${e(result.tagNumber)}</bdi></p><p><bdi>${e(row.number)}</bdi> · ${t('Seat')} <bdi>${e(row.seat)}</bdi></p><p>${e(route(row))} · <bdi>${e(row.date)} ${e(row.time)}</bdi></p></article></div><p class="luggage-once no-print">${t('Print this tag now. Its QR cannot be shown again.')}</p><div class="staff-actions no-print"><button type="button" data-tag-print>${t('Print')}</button><button type="button" data-tag-done>${t('Close')}</button></div>`;dialog.querySelector('[data-tag-print]').onclick=()=>window.print();const keep=event=>event.preventDefault();dialog.addEventListener('cancel',keep);dialog.addEventListener('close',()=>{dialog.removeEventListener('cancel',keep);void load();},{once:true});dialog.querySelector('[data-tag-done]').onclick=()=>dialog.close();if(!dialog.open)dialog.showModal();window.print();};
   if(b.dataset.replace){openForm('Replace tag',`<p><bdi>${e(row.number)}</bdi> · <bdi>${e(row.tagNumber)}</bdi></p><p>${t('The old tag stops working as soon as the new one is made. Take it off the bag.')}</p>`+input('reason','Reason','text','maxlength="300"')+noNames,async f=>{const made=await api(`${base}/${row.id}/tag`,'POST',{reason:f.get('reason'),version:row.version});current={query:row.number,token:null};remembered.query=row.number;dialog.addEventListener('close',()=>setTimeout(()=>show(made)),{once:true});return made;});return;}
   b.disabled=true;try{show(await api(`${base}/${row.id}/tag`,'POST',{}));}catch(error){notice=error.message==='REQUEST_FAILED'||error.message==='TAG_REASON_REQUIRED'?'TAG_MAYBE_MADE':error.message;await load();}
  });
  notice='';
  // A scanner types into the search box, so the box is ready for the next bag. Not on touch screens, where it would raise the keyboard.
  if(!dialog.open&&matchMedia('(pointer:fine)').matches)form.elements.q.focus({preventScroll:true});
 };
 const load=async()=>{
  const mine=++latest,{query,token}=current;
  if(!box.isConnected)return;
  box.setAttribute('aria-busy','true');
  box.innerHTML=`<p role="status">${t('Loading luggage…')}</p>`;
  try{
   const result=token?await api(base+'/scan','POST',{token}):await api(base+(query?'?q='+encodeURIComponent(query):''));
   if(mine!==latest)return;
   if(token){current={query:result.items[0]?.number||null,token:null};form.elements.q.value=current.query||'';}
   remembered.query=current.query;paint(result);
  }
  catch(error){if(mine===latest&&box.isConnected){box.removeAttribute('aria-busy');box.innerHTML=`<p class="staff-alert bad" role="alert">${e(t(error.message))}</p>`;}}
 };
 form.elements.q.value=current.query||'';
 root.querySelector('#luggage-refresh').onclick=()=>void load();
 form.onsubmit=event=>{event.preventDefault();const value=new FormData(form).get('q').trim().toUpperCase();current=value.startsWith('LQ')?{query:null,token:value}:{query:value||null,token:null};void load();};
 void load();
}
// The last search stays across redraws, and is forgotten on sign-out.
let remembered={company:null,query:null};
export const resetLuggage=()=>{remembered={company:null,query:null};};
