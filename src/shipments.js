// D59 shipments at the office: price list, new shipment with payment, tag, journey steps,
// hand-over to the recorded receiver, returns and problems. Rules live on the server.
import {moneyText} from './station.js';

const statusLabel={received:'Received',loaded:'Loaded',in_transit:'In transit',arrived:'Arrived',delivered:'Delivered',returned:'Returned to sender',lost:'Lost',exception_reported:'Problem reported'};
const categoryLabel={envelope:'Envelope',small:'Small parcel',large:'Large parcel',other:'Other item'};
const kindLabel={damaged:'Damaged',missing:'Missing',wrong_bus:'Wrong bus',other:'Other'},outcomeLabel={found:'Found',settled:'Settled with the sender',closed:'Closed'};
const eventLabel={received:'Received and paid',tagged:'Tag printed',tag_replaced:'Tag replaced',moved:'Moved',corrected:'Taken off the bus',delivered:'Handed over',returned:'Returned to sender',exception_reported:'Problem reported',exception_resolved:'Problem resolved'};
const methodLabel={cash:'Cash',bank_transfer:'Bank transfer',mobile_wallet:'Mobile wallet'};
const nextStep={received:['loaded','Mark loaded'],loaded:['in_transit','Mark in transit'],in_transit:['arrived','Mark arrived']};
const kilos=grams=>(grams/1000).toLocaleString('en-GB',{maximumFractionDigits:3});
const shipmentPattern=/^(SHP|SPT|RCP)-[0-9]{8}$|^SH-[2-9A-HJ-NP-Z]{8}$/;
let remembered={company:null,query:null};
export const resetShipments=()=>{remembered={company:null,query:null};};

export function shipmentsView(data,{t}){
 const cap=data.capabilities;
 return `<section class="staff-panel shipments-panel"><header class="staff-section-head"><div><h2>${t('Shipments')}</h2><p>${t('Parcels sent without a traveler. The sender pays at drop-off; the receiver collects with their phone number and name.')}</p></div><div class="staff-actions">${cap.shipments?`<button type="button" class="staff-primary" id="shipment-new">${t('New shipment')}</button>`:''}${cap.shipmentPrices?`<button type="button" id="shipment-prices">${t('Price list')}</button>`:''}</div></header><form id="shipment-search" class="booking-search"><label>${t('Scan or search')}<input type="search" name="q" maxlength="40" dir="ltr" autocomplete="off" placeholder="SHP-00000001"></label><button type="submit" class="staff-primary">${t('Search')}</button><button type="button" id="shipment-refresh">${t('Refresh')}</button></form><div id="shipment-notice"></div><div id="shipment-results" aria-live="polite"><p role="status">${t('Loading shipments…')}</p></div></section>`;
}

export function bindShipments(root,data,ctx){
 const {api,openForm,input,currentPassword,dialog,t,e,language}=ctx,cid=data.company.id,base=`companies/${cid}/shipments`,cap=data.capabilities;
 const box=root.querySelector('#shipment-results'),form=root.querySelector('#shipment-search'),noticeBox=root.querySelector('#shipment-notice');
 const name=row=>language==='ar'?row.nameAr:row.nameEn,place=(row,key)=>language==='ar'?row[key+'Ar']:row[key+'En'];
 const when=(row,value)=>new Intl.DateTimeFormat(language==='ar'?'ar-SD':'en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:row.timezone||data.company.timezone}).format(new Date(value));
 const money=(minor,currency)=>moneyText(minor,currency||'SDG',language);
 const noNames=`<p class="staff-muted">${t('Do not include names or numbers.')}</p>`;
 if(remembered.company!==cid)remembered={company:cid,query:null};
 let current={query:remembered.query,token:null},options=null,latest=0,notice='';
 const loadOptions=async()=>{options=await api(base+'/options');return options;};

 const card=row=>{
  const closed=['delivered','returned','lost'].includes(row.lifecycle),open=row.exception,next=nextStep[row.lifecycle];
  const actions=[
   cap.shipments&&!closed&&(row.tagNumber?`<button type="button" data-tag="${e(row.id)}" data-replace="1">${t('Replace tag')}</button>`:`<button type="button" class="staff-primary" data-tag="${e(row.id)}">${t('Print tag')}</button>`),
   cap.shipments&&next&&!open&&(next[0]!=='loaded'||row.tagNumber)&&`<button type="button" data-move="${e(row.id)}" data-to="${next[0]}">${t(next[1])}</button>`,
   cap.shipments&&row.lifecycle==='loaded'&&`<button type="button" data-unload="${e(row.id)}">${t('Take off the bus')}</button>`,
   cap.shipments&&row.lifecycle==='arrived'&&!open&&`<button type="button" class="staff-primary" data-deliver="${e(row.id)}">${t('Hand over to receiver')}</button>`,
   cap.shipments&&row.lifecycle==='received'&&!open&&`<button type="button" data-return="${e(row.id)}">${t('Return to sender')}</button>`,
   cap.shipments&&!closed&&!open&&`<button type="button" data-report="${e(row.id)}">${t('Report a problem')}</button>`,
   cap.shipmentsResolve&&open&&`<button type="button" data-resolve="${e(row.id)}">${t('Resolve problem')}</button>`,
   row.payment&&`<button type="button" data-receipt="${e(row.id)}">${t('Print receipt')}</button>`,
  ].filter(Boolean).join('');
  const people=row.detailsErased?`<p class="staff-muted">${t('Sender and receiver details were erased after the retention period.')}</p>`:`<dl class="company-details"><div><dt>${t('Sender')}</dt><dd>${e(row.senderName)} · <bdi dir="ltr">${e(row.senderMobile)}</bdi></dd></div><div><dt>${t('Receiver')}</dt><dd>${e(row.receiverName)} · <bdi dir="ltr">${e(row.receiverMobile)}</bdi></dd></div></dl>`;
  return `<article class="staff-record shipment-record"><span class="staff-badge">${t(statusLabel[row.status])}</span><h3><bdi>${e(row.number)}</bdi> <small class="staff-muted"><bdi>${e(row.trackingCode)}</bdi></small></h3>
   <p><strong>${e(place(row,'origin'))}</strong> → <strong>${e(place(row,'destination'))}</strong></p>
   <p>${e(language==='ar'?row.routeNameAr:row.routeNameEn)} · <bdi>${e(when(row,row.departureAt))}</bdi>${row.tripStatus==='canceled'?` · <span class="staff-alert bad">${t('Trip canceled')}</span>`:''}</p>${people}
   <p>${row.items.map(i=>`${t(categoryLabel[i.category])} <bdi>${e(kilos(i.weightGrams))}</bdi> ${t('kg')}`).join(' · ')}</p>
   <p><strong><bdi>${e(money(row.amountMinor,row.currency))}</bdi></strong>${row.payment?` · ${t(methodLabel[row.payment.method])} · <bdi>${e(row.payment.receiptNumber)}</bdi>`:''}${row.tagNumber?` · ${t('Tag')} <bdi>${e(row.tagNumber)}</bdi>`:''}</p>
   ${open?`<p class="staff-alert bad">${t(kindLabel[open.kind])}${open.note?`: ${e(open.note)}`:''} · ${t('Recorded state')}: ${t(statusLabel[row.lifecycle])}. ${t('It cannot move or be handed over until the problem is resolved.')}</p>`:''}
   <details><summary>${t('History')}</summary><ol class="booking-events">${row.events.map(v=>`<li>${t(eventLabel[v.event])}${v.event==='moved'&&v.to?` · ${t(statusLabel[v.to])}`:''}${v.reason&&v.event!=='exception_reported'&&v.event!=='exception_resolved'?` · ${e(v.reason)}`:''} <small><bdi>${e(when(row,v.at))}</bdi></small></li>`).join('')}</ol></details>
   ${actions?`<div class="staff-actions">${actions}</div>`:''}</article>`;
 };

 const printSheet=(html,after)=>{
  dialog.innerHTML=`<div class="print-sheet">${html}</div><div class="staff-actions no-print"><button type="button" data-sheet-print>${t('Print')}</button><button type="button" data-sheet-done>${t('Close')}</button></div>`;
  dialog.querySelector('[data-sheet-print]').onclick=()=>window.print();dialog.querySelector('[data-sheet-done]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{after?.();},{once:true});if(!dialog.open)dialog.showModal();
 };
 const company=()=>e(language==='ar'?data.company.nameAr:data.company.nameEn);
 const receipt=row=>printSheet(`<article class="print-ticket shipment-receipt"><header class="print-head"><strong>${company()}</strong><h2>${t('Shipment receipt')}</h2></header>
  <p class="print-number"><bdi>${e(row.payment.receiptNumber)}</bdi></p><dl class="company-details">
  <div><dt>${t('Shipment')}</dt><dd><bdi>${e(row.number)}</bdi></dd></div><div><dt>${t('Tracking code')}</dt><dd><bdi>${e(row.trackingCode)}</bdi></dd></div>
  <div><dt>${t('From')}</dt><dd>${e(place(row,'origin'))}</dd></div><div><dt>${t('To')}</dt><dd>${e(place(row,'destination'))}</dd></div>
  <div><dt>${t('Trip')}</dt><dd>${e(language==='ar'?row.routeNameAr:row.routeNameEn)} · <bdi>${e(when(row,row.departureAt))}</bdi></dd></div>
  ${row.detailsErased?'':`<div><dt>${t('Sender')}</dt><dd>${e(row.senderName)} · <bdi dir="ltr">${e(row.senderMobile)}</bdi></dd></div><div><dt>${t('Receiver')}</dt><dd>${e(row.receiverName)} · <bdi dir="ltr">${e(row.receiverMobile)}</bdi></dd></div>`}
  ${row.items.map((i,n)=>`<div><dt>${t('Item')} ${n+1}</dt><dd>${t(categoryLabel[i.category])} · <bdi>${e(kilos(i.weightGrams))}</bdi> ${t('kg')} · <bdi>${e(money(i.priceMinor,row.currency))}</bdi></dd></div>`).join('')}
  <div><dt>${t('Total paid')}</dt><dd><strong><bdi>${e(money(row.amountMinor,row.currency))}</bdi></strong> · ${t(methodLabel[row.payment.method])}</dd></div></dl>
  <p>${t('Track this shipment on the Safeer website with the tracking code. The receiver collects it with their phone number and name.')}</p></article>`,()=>void load());

 const paint=result=>{
  if(!box.isConnected)return;
  const items=result.items,find=id=>items.find(row=>row.id===id);
  box.removeAttribute('aria-busy');
  noticeBox.innerHTML=notice?`<p class="staff-alert bad" role="alert">${e(t(notice))}</p>`:'';notice='';
  box.innerHTML=`${items.length===50?`<p class="staff-alert" role="status">${t('Showing the latest 50 shipments. Search by number to find an older one.')}</p>`:''}<div class="staff-grid">${items.map(card).join('')}</div>${items.length?'':`<p>${t(current.query||current.token?'No shipment matches your search.':'No shipments yet.')}</p>`}`;
  box.querySelectorAll('[data-move]').forEach(b=>b.onclick=async()=>{const row=find(b.dataset.move);b.disabled=true;try{await api(`${base}/${row.id}/move`,'POST',{to:b.dataset.to,version:row.version});await load();}catch(error){b.disabled=false;b.insertAdjacentHTML('afterend',`<p class="staff-alert bad" role="alert">${e(t(error.message))}</p>`);}});
  box.querySelectorAll('[data-unload]').forEach(b=>b.onclick=()=>{const row=find(b.dataset.unload);openForm('Take off the bus',`<p><bdi>${e(row.number)}</bdi></p>`+input('reason','Reason','text','maxlength="300"')+noNames,f=>api(`${base}/${row.id}/move`,'POST',{to:'received',reason:f.get('reason'),version:row.version}));});
  box.querySelectorAll('[data-deliver]').forEach(b=>b.onclick=()=>{const row=find(b.dataset.deliver);openForm('Hand over to receiver',`<p><bdi>${e(row.number)}</bdi> · ${e(place(row,'destination'))}</p><p>${t('Ask the receiver for their phone number and full name. Both must match the shipment.')}</p>`+input('receiverMobile','Receiver phone number','tel','maxlength="30" dir="ltr" autocomplete="off" inputmode="tel"')+input('receiverName','Receiver full name','text','maxlength="100" autocomplete="off"'),f=>api(`${base}/${row.id}/deliver`,'POST',{receiverName:f.get('receiverName'),receiverMobile:f.get('receiverMobile'),version:row.version}));});
  box.querySelectorAll('[data-return]').forEach(b=>b.onclick=()=>{const row=find(b.dataset.return);openForm('Return to sender',`<p><bdi>${e(row.number)}</bdi></p><p>${t('Only before it is loaded. The fee is not refunded in Safeer.')}</p>`+input('reason','Reason','text','maxlength="300"')+noNames,f=>api(`${base}/${row.id}/return`,'POST',{reason:f.get('reason'),version:row.version}));});
  box.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>{const row=find(b.dataset.report);openForm('Report a problem',`<p><bdi>${e(row.number)}</bdi></p><label>${t('Problem')}<select name="kind">${Object.keys(kindLabel).map(k=>`<option value="${k}">${t(kindLabel[k])}</option>`).join('')}</select></label><label>${t('Note (optional)')}<input name="note" maxlength="300"></label>`+noNames,f=>api(`${base}/${row.id}/exceptions`,'POST',{kind:f.get('kind'),note:f.get('note')||null}));});
  box.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=()=>{const row=find(b.dataset.resolve);openForm('Resolve problem',`<p><bdi>${e(row.number)}</bdi> · ${t(kindLabel[row.exception.kind])}</p><label>${t('Outcome')}<select name="outcome">${Object.keys(outcomeLabel).map(k=>`<option value="${k}">${t(outcomeLabel[k])}</option>`).join('')}</select></label>${row.exception.kind==='missing'?`<p class="staff-alert bad">${t('For a missing shipment, Settled or Closed permanently marks it Lost. Choose Found only when it has been found.')}</p>`:''}<label>${t('Note (optional)')}<input name="note" maxlength="300"></label>`+noNames+currentPassword(),f=>api(`${base}/${row.id}/exceptions/${row.exception.id}/resolve`,'POST',{outcome:f.get('outcome'),note:f.get('note')||null,currentPassword:f.get('currentPassword')}));});
  box.querySelectorAll('[data-receipt]').forEach(b=>b.onclick=()=>receipt(find(b.dataset.receipt)));
  box.querySelectorAll('[data-tag]').forEach(b=>b.onclick=async()=>{
   const row=find(b.dataset.tag),show=made=>{printSheet(`<article class="print-ticket luggage-tag"><header class="print-head"><strong>${company()}</strong><h2>${t('Shipment tag')}</h2></header><svg class="luggage-qr" viewBox="-4 -4 ${made.qr.size+8} ${made.qr.size+8}" role="img" aria-label="${e(t('QR code'))}"><rect x="-4" y="-4" width="${made.qr.size+8}" height="${made.qr.size+8}" fill="#fff"/><path d="${e(made.qr.path)}" fill="#000"/></svg><p class="print-number"><bdi>${e(made.tagNumber)}</bdi></p><p><bdi>${e(row.number)}</bdi> · ${row.itemCount} ${t('items')}</p><p><strong>${e(place(row,'destination'))}</strong></p></article><p class="luggage-once no-print">${t('Print this tag now. Its QR cannot be shown again.')}</p>`,()=>void load());window.print();};
   if(b.dataset.replace){openForm('Replace tag',`<p><bdi>${e(row.number)}</bdi> · <bdi>${e(row.tagNumber)}</bdi></p><p>${t('The old tag stops working as soon as the new one is made. Take it off the parcel.')}</p>`+input('reason','Reason','text','maxlength="300"')+noNames,async f=>{const made=await api(`${base}/${row.id}/tag`,'POST',{reason:f.get('reason'),version:row.version});dialog.addEventListener('close',()=>setTimeout(()=>show(made)),{once:true});return made;});return;}
   b.disabled=true;try{show(await api(`${base}/${row.id}/tag`,'POST',{}));}catch(error){notice=error.message==='REQUEST_FAILED'||error.message==='TAG_REASON_REQUIRED'?'TAG_MAYBE_MADE':error.message;await load();}
  });
  if(!dialog.open&&matchMedia('(pointer:fine)').matches)form.elements.q.focus({preventScroll:true});
 };
 const load=async()=>{
  const mine=++latest,{query,token}=current;if(!box.isConnected)return;
  box.setAttribute('aria-busy','true');box.innerHTML=`<p role="status">${t('Loading shipments…')}</p>`;
  try{
   const result=token?await api(base+'/scan','POST',{token}):await api(base+(query?'?q='+encodeURIComponent(query):''));
   if(mine!==latest)return;
   if(token){current={query:result.items[0]?.number||null,token:null};form.elements.q.value=current.query||'';}
   remembered.query=current.query;paint(result);
  }catch(error){if(mine===latest&&box.isConnected){box.removeAttribute('aria-busy');box.innerHTML=`<p class="staff-alert bad" role="alert">${e(t(error.message))}</p>`;}}
 };

 const itemRow=n=>`<fieldset class="shipment-item" data-item><legend>${t('Item')} <span data-item-number>${n}</span></legend><label>${t('Type')}<select name="category" data-price-input>${Object.keys(categoryLabel).map(c=>{const p=options.prices.find(x=>x.category===c&&x.active);return `<option value="${c}" ${p?'':'disabled'}>${t(categoryLabel[c])}${p?` · ${money(p.priceMinor,p.currency)}`:` · ${t('No price')}`}</option>`;}).join('')}</select></label>${input('kilos','Weight in kilograms','number','min="0.001" max="500" step="0.001"')}<label>${t('Description (optional)')}<input name="description" maxlength="200"></label><button type="button" data-item-remove>${t('Remove item')}</button></fieldset>`;
 const newShipment=async()=>{
  try{await loadOptions();}catch(error){notice=error.message;return load();}
  const priced=options.prices.filter(p=>p.active);
  if(!options.session){notice='NO_OPEN_SESSION';return load();}
  if(!priced.length){notice='PRICE_MISSING';return load();}
  const stations=options.stations.filter(s=>s.id!==options.session.stationId);
  const key=crypto.randomUUID();
  openForm('New shipment',`
   <label>${t('Trip')}<select name="tripId" required><option value="">${t('Choose a trip')}</option>${options.trips.map(x=>`<option value="${e(x.id)}">${e(language==='ar'?x.routeNameAr:x.routeNameEn)} · ${e(when(x,x.departureAt))}</option>`).join('')}</select></label>
   <label>${t('Destination office')}<select name="destinationId" required><option value="">${t('Choose an office')}</option>${stations.map(s=>`<option value="${e(s.id)}">${e(name(s))}</option>`).join('')}</select></label>
   <fieldset><legend>${t('Sender')}</legend>${input('senderName','Full name','text','maxlength="100" autocomplete="off"')}${input('senderMobile','Phone number','tel','maxlength="30" dir="ltr" autocomplete="off" inputmode="tel"')}</fieldset>
   <fieldset><legend>${t('Receiver')}</legend>${input('receiverName','Full name','text','maxlength="100" autocomplete="off"')}${input('receiverMobile','Phone number','tel','maxlength="30" dir="ltr" autocomplete="off" inputmode="tel"')}<p class="staff-muted">${t('The receiver must give this phone number and name to collect the shipment.')}</p></fieldset>
   <div data-items>${itemRow(1)}</div><button type="button" data-item-add>${t('Add item')}</button>
   <p class="shipment-total" aria-live="polite">${t('Total')}: <strong data-total></strong></p>
   <label>${t('Payment method')}<select name="method">${Object.keys(methodLabel).map(m=>`<option value="${m}">${t(methodLabel[m])}</option>`).join('')}</select></label>
   <label data-reference hidden>${t('Payment reference')}<input name="reference" maxlength="100" dir="ltr" autocomplete="off"></label>
   <label class="shipment-declare"><input type="checkbox" name="declared" value="yes" required> ${t('I checked the contents: no cash, weapons, hazardous goods, live animals or perishable food.')}</label>`,
   async f=>{
    const kilosList=f.getAll('kilos'),descriptions=f.getAll('description');
    const items=f.getAll('category').map((category,i)=>({category,weightGrams:Math.round(Number(kilosList[i])*1000),description:descriptions[i]||null}));
    const made=await api(base,'POST',{tripId:f.get('tripId'),destinationId:f.get('destinationId'),senderName:f.get('senderName'),senderMobile:f.get('senderMobile'),receiverName:f.get('receiverName'),receiverMobile:f.get('receiverMobile'),items,method:f.get('method'),reference:f.get('method')==='cash'?null:f.get('reference'),declared:f.get('declared')==='yes',key})
     .catch(error=>{throw error.message==='REQUEST_FAILED'||error.message==='IDEMPOTENCY_CONFLICT'?Error('SHIPMENT_MAYBE_SAVED'):error;});
    current={query:made.number,token:null};remembered.query=made.number;
    dialog.addEventListener('close',()=>setTimeout(()=>receipt(made)),{once:true});
    return made;
   });
  const formEl=dialog.querySelector('form'),list=formEl.querySelector('[data-items]'),total=formEl.querySelector('[data-total]'),method=formEl.elements.method,reference=formEl.querySelector('[data-reference]');
  const recount=()=>{const rows=[...list.querySelectorAll('[data-item]')];rows.forEach((r,i)=>{r.querySelector('[data-item-number]').textContent=i+1;r.querySelector('[data-item-remove]').hidden=rows.length===1;});
   const sum=rows.reduce((s,r)=>s+(options.prices.find(p=>p.category===r.querySelector('select').value)?.priceMinor||0),0);total.textContent=money(sum,priced[0].currency);formEl.querySelector('[data-item-add]').hidden=rows.length>=20;};
  const firstPriced=select=>{if(select.selectedOptions[0]?.disabled){const ok=[...select.options].find(o=>!o.disabled);if(ok)select.value=ok.value;}};
  list.querySelectorAll('select').forEach(firstPriced);
  formEl.querySelector('[data-item-add]').onclick=()=>{list.insertAdjacentHTML('beforeend',itemRow(list.children.length+1));firstPriced(list.lastElementChild.querySelector('select'));recount();list.lastElementChild.querySelector('select').focus();};
  list.addEventListener('click',event=>{const remove=event.target.closest('[data-item-remove]');if(remove){remove.closest('[data-item]').remove();recount();}});
  list.addEventListener('change',recount);
  method.onchange=()=>{reference.hidden=method.value==='cash';reference.querySelector('input').required=method.value!=='cash';};
  recount();
 };
 const priceList=async()=>{
  try{await loadOptions();}catch(error){notice=error.message;return load();}
  const rows=Object.keys(categoryLabel).map(c=>{const p=options.prices.find(x=>x.category===c);return `<fieldset><legend>${t(categoryLabel[c])}</legend>${input('price_'+c,'Price','number',`min="0.01" max="1000000" step="0.01" value="${p?p.priceMinor/100:''}"`)}<label><input type="checkbox" name="active_${c}" value="yes" ${!p||p.active?'checked':''}> ${t('Available')}</label></fieldset>`;}).join('');
  openForm('Price list',`<p>${t('One fixed price per item type. Leave a price empty to keep it unset.')}</p>${rows}`,async f=>{
   for(const c of Object.keys(categoryLabel)){
    const raw=f.get('price_'+c);if(raw===''||raw===null)continue;
    const p=options.prices.find(x=>x.category===c),priceMinor=Math.round(Number(raw)*100),active=f.get('active_'+c)==='yes';
    if(p&&p.priceMinor===priceMinor&&p.active===active)continue;
    await api(base+'/prices','POST',{category:c,priceMinor,active,version:p?p.version:null});
   }
  });
  dialog.querySelectorAll('input[type=number]').forEach(i=>i.required=false);
 };

 form.elements.q.value=current.query||'';
 root.querySelector('#shipment-refresh').onclick=()=>void load();
 root.querySelector('#shipment-new')?.addEventListener('click',()=>void newShipment());
 root.querySelector('#shipment-prices')?.addEventListener('click',()=>void priceList());
 form.onsubmit=event=>{event.preventDefault();const value=new FormData(form).get('q').trim().toUpperCase();
  if(value&&!value.startsWith('SQ')&&!shipmentPattern.test(value)){notice='INVALID_SHIPMENT_SEARCH';return void load();}
  current=value.startsWith('SQ')?{query:null,token:value}:{query:value||null,token:null};void load();};
 void load();
}
