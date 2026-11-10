// D65 operations overview: today's departures, boarding progress and what needs attention.
// Read-only and refreshed from confirmed records; the driver scanner remains the only writer.
const statusInfo={
 scheduled:['Scheduled','clock','neutral'],boarding:['Boarding','people','selected'],departed:['Departed','check','ok'],arrived:['Arrived','flag','ok'],
 delayed:['Delayed','clock','warning'],unassigned:['Driver unassigned','alert','urgent'],canceled:['Canceled','x','muted'],draft:['Draft','pencil','muted'],
};
const icons={
 clock:'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',people:'M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M20 19v-1a3 3 0 0 0-2-2.8M17 5.2a3 3 0 0 1 0 5.6M4 19v-1a3 3 0 0 1 2-2.8M7 5.2a3 3 0 0 0 0 5.6',
 check:'m5 12 4 4 10-10',flag:'M5 21V4h11l-2 4 2 4H5',alert:'M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0',
 x:'M6 6l12 12M18 6 6 18',pencil:'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',bus:'M5 17V6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v11M5 13h14M7 17v3M17 17v3M8 7h8',
 seat:'M7 4v9h9l2 7M7 13l-2 7M16 13V8',plus:'M12 5v14M5 12h14',close:'M6 6l12 12M18 6 6 18',refresh:'M20 7V3l-4 4M20 7a8 8 0 1 0 0 10',
};
const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]}"/></svg>`;
let state={company:null,trip:null,timer:null};
export const resetOperations=()=>{clearInterval(state.timer);state={company:null,trip:null,timer:null};};

export function operationsView(data,{t}){
 const cap=data.capabilities;
 return `<section class="ops" aria-labelledby="ops-title"><header class="ops-head"><div><h1 id="ops-title">${t('Operations overview')}</h1><p class="ops-day" id="ops-day"></p></div><div class="ops-head-actions"><button type="button" class="secondary ops-icon-button" id="ops-refresh" aria-label="${t('Refresh')}" title="${t('Refresh')}">${svg('refresh')}</button>${cap.tripsManage?`<button type="button" class="staff-primary ops-create" id="ops-create">${svg('plus')}<span>${t('Create trip')}</span></button>`:''}</div></header>
 <div id="ops-body" aria-live="polite"><div class="ops-kpis" aria-hidden="true">${'<article class="ops-kpi ops-skeleton"></article>'.repeat(4)}</div><p role="status" class="ops-loading">${t('Loading today\'s departures…')}</p></div></section>`;
}

export function bindOperations(root,data,ctx){
 const {api,t,e,language}=ctx,cid=data.company.id,base=`companies/${cid}/operations`,body=root.querySelector('#ops-body');
 if(!body)return;
 if(state.company!==cid){resetOperations();state.company=cid;}
 clearInterval(state.timer);
 const tz=data.company.timezone;
 const time=(value,zone=tz)=>new Intl.DateTimeFormat(language==='ar'?'ar-SD':'en-GB',{hour:'2-digit',minute:'2-digit',timeZone:zone}).format(new Date(value));
 const route=row=>{const name=language==='ar'?row.routeAr:row.routeEn,parts=String(name).split(/\s+(?:to|→|إلى)\s+/);return parts.length===2?`<span class="ops-route">${e(parts[0])}<span class="ops-arrow" aria-hidden="true">${language==='ar'?'←':'→'}</span><span class="sr-only"> ${t('to')} </span>${e(parts[1])}</span>`:`<span class="ops-route">${e(name)}</span>`;};
 const driver=row=>row.driverEn?e(language==='ar'?row.driverAr:row.driverEn):'—';
 const badge=status=>{const [label,icon,tone]=statusInfo[status]||statusInfo.scheduled;return `<span class="ops-status ops-${tone}">${svg(icon)}<span>${t(label)}</span></span>`;};
 const ratio=(a,b)=>b?`<bdi>${a} / ${b}</bdi>`:`<bdi>${a}</bdi>`;
 let view=null,detail=null,failed='';

 const kpis=s=>[['Departures today',s.departures,'bus','selected'],['Passengers booked',s.booked,'people','primary'],['Boarded',s.boarded,'seat','ok'],['Needs attention',s.attention,'alert',s.attention?'urgent':'neutral']]
  .map(([label,value,icon,tone])=>`<article class="ops-kpi ops-kpi-${tone}"><span class="ops-kpi-icon">${svg(icon)}</span><div><span>${t(label)}</span><strong><bdi>${e(value)}</bdi></strong></div></article>`).join('');
 const table=rows=>rows.length?`<div class="staff-table-wrap ops-table-wrap" tabindex="0" role="region" aria-label="${t('Today\'s departures')}"><table class="staff-table ops-table"><thead><tr>${['Time','Route','Vehicle','Driver','Booked','Boarded','Status'].map(h=>`<th scope="col">${t(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr class="${state.trip===r.id?'ops-row-selected':''}"><td><button type="button" class="ops-row-open" data-ops-trip="${e(r.id)}" aria-pressed="${state.trip===r.id}" aria-label="${e(t('Open trip details'))} ${e(time(r.departureAt,r.timezone))}"><strong><bdi>${e(time(r.departureAt,r.timezone))}</bdi></strong></button></td><td>${route(r)}</td><td>${r.busCode?`<bdi>${e(r.busCode)}</bdi>`:'—'}</td><td>${driver(r)}</td><td>${ratio(r.booked,r.seatCount)}</td><td>${ratio(r.boarded,r.booked)}</td><td>${badge(r.status)}</td></tr>`).join('')}</tbody></table></div>`
  :`<div class="ops-empty"><span class="ops-kpi-icon">${svg('bus')}</span><p>${t('No departures today.')}</p>${data.capabilities.tripsManage?`<button type="button" class="staff-primary" data-ops-empty-create>${t('Create trip')}</button>`:''}</div>`;
 const attention=items=>items.length?`<section class="ops-attention" aria-labelledby="ops-attention-title"><h2 id="ops-attention-title">${t('Needs attention')} <bdi>(${items.length})</bdi></h2><ul>${items.map(a=>`<li>${badge(a.kind)}<button type="button" class="ops-attention-trip" data-ops-trip="${e(a.id)}"><strong><bdi>${e(time(a.departureAt,a.timezone))}</bdi></strong> ${route(a)}</button><small>${a.kind==='delayed'?(a.minutesLate?`${t('Departure was due')} <bdi>${e(a.minutesLate)}</bdi> ${t('minutes ago')}`:t('A delay was reported')):t('Assign a driver to this trip')}</small></li>`).join('')}</ul></section>`:'';
 const panel=()=>{
  if(!state.trip)return '';
  if(!detail)return `<aside class="ops-panel" aria-label="${t('Trip details')}"><p role="status" class="ops-loading">${t('Loading trip…')}</p></aside>`;
  const d=detail,booked=d.booked||0,pct=booked?Math.round(d.boarded*100/booked):0;
  return `<aside class="ops-panel" aria-labelledby="ops-panel-title"><header><h2 id="ops-panel-title" tabindex="-1">${t('Trip details')}</h2><button type="button" class="secondary ops-icon-button" data-ops-close aria-label="${t('Close trip details')}">${svg('close')}</button></header>
   <p class="ops-panel-route">${svg('bus')}${route(d)}</p>
   <dl class="ops-facts"><div><dt>${t('Departure')}</dt><dd><bdi>${e(time(d.departureAt,d.timezone))}</bdi></dd></div><div><dt>${t('Vehicle')}</dt><dd>${d.busCode?`<bdi>${e(d.busCode)}</bdi>`:'—'}</dd></div><div><dt>${t('Driver')}</dt><dd>${driver(d)}</dd></div><div><dt>${t('Capacity')}</dt><dd>${d.seatCount?`<bdi>${e(d.seatCount)}</bdi> ${t('seats')}`:'—'}</dd></div><div><dt>${t('Status')}</dt><dd>${badge(d.status)}</dd></div></dl>
   <div class="ops-progress"><div class="ops-progress-label"><strong>${t('Boarding progress')}</strong><span><bdi>${e(d.boarded)}</bdi> ${t('of')} <bdi>${e(booked)}</bdi></span></div><div class="ops-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${booked}" aria-valuenow="${d.boarded}" aria-label="${t('Boarding progress')}"><span data-pct="${pct}"></span></div></div>
   ${d.canSeePassengers?`<h3>${t('Recent ticket scans')} <bdi>(${d.recentScans.length})</bdi></h3>${d.recentScans.length?`<table class="staff-table ops-mini"><thead><tr><th scope="col">${t('Time')}</th><th scope="col">${t('Ticket')}</th><th scope="col">${t('Passenger')}</th></tr></thead><tbody>${d.recentScans.map(s=>`<tr><td><bdi>${e(time(s.at,d.timezone))}</bdi></td><td><bdi>${e(s.ticket)}</bdi></td><td>${s.name?e(s.name):`<span class="staff-muted">${t('Name erased')}</span>`}</td></tr>`).join('')}</tbody></table>`:`<p class="staff-muted">${t('No tickets scanned yet.')}</p>`}
   <h3>${t('Passengers')} <bdi>(${d.passengers.length})</bdi></h3>${d.passengers.length?`<ul class="ops-passengers">${d.passengers.map(p=>`<li><span class="ops-seat"><bdi>${e(p.seat)}</bdi></span><span>${p.name?e(p.name):`<span class="staff-muted">${t('Name erased')}</span>`}<small><bdi>${e(p.ticket)}</bdi></small></span>${p.boardedAt?`<span class="ops-status ops-ok">${svg('check')}<span>${t('Boarded')}</span></span>`:`<span class="ops-status ops-neutral">${svg('clock')}<span>${t('Waiting')}</span></span>`}</li>`).join('')}</ul>`:`<p class="staff-muted">${t('No paid tickets on this trip yet.')}</p>`}`
   :`<p class="staff-muted">${t('Passenger names need booking access.')}</p>`}</aside>`;
 };
 const paint=()=>{
  if(!body.isConnected){clearInterval(state.timer);return;}
  const day=root.querySelector('#ops-day');
  if(failed&&!view){body.innerHTML=`<div class="ops-error" role="alert"><p>${e(t(failed))}</p><button type="button" class="staff-primary" data-ops-retry>${t('Try again')}</button></div>`;body.querySelector('[data-ops-retry]').onclick=()=>void load();return;}
  if(!view)return;
  if(day)day.textContent=new Intl.DateTimeFormat(language==='ar'?'ar-SD':'en-GB',{dateStyle:'full',timeZone:tz}).format(new Date(view.asOf));
  body.innerHTML=`${failed?`<p class="staff-alert bad" role="alert">${e(t(failed))}</p>`:''}<div class="ops-kpis">${kpis(view.summary)}</div><div class="ops-layout ${state.trip?'ops-with-panel':''}"><section class="ops-main" aria-labelledby="ops-table-title"><h2 id="ops-table-title">${t('Today\'s departures')}</h2>${table(view.departures)}${attention(view.attention)}</section>${panel()}</div>`;
  // CSP forbids inline style attributes; set the bar width through the CSSOM.
  body.querySelectorAll('[data-pct]').forEach(bar=>{bar.style.width=bar.dataset.pct+'%';});
  body.querySelectorAll('[data-ops-trip]').forEach(b=>b.onclick=()=>{state.trip=b.dataset.opsTrip===state.trip&&b.classList.contains('ops-row-open')?null:b.dataset.opsTrip;detail=null;paint();if(state.trip)void loadTrip(true);});
  body.querySelector('[data-ops-close]')?.addEventListener('click',()=>{const id=state.trip;state.trip=null;detail=null;paint();body.querySelector(`[data-ops-trip="${CSS.escape(id)}"]`)?.focus();});
  body.querySelector('[data-ops-empty-create]')?.addEventListener('click',create);
 };
 const load=async()=>{
  try{view=await api(base);failed='';}catch(error){failed=error.message||'REQUEST_FAILED';}
  paint();if(state.trip)void loadTrip(false);
 };
 const loadTrip=async focus=>{
  const id=state.trip;
  try{const row=await api(`${base}/trips/${id}`);if(state.trip!==id)return;detail=row;}catch(error){if(state.trip!==id)return;failed=error.message;state.trip=null;detail=null;}
  paint();if(focus)body.querySelector('.ops-panel h2')?.focus?.();
 };
 function create(){ctx.openSection?.('trips',()=>root.querySelector('[data-trip-create]')?.click());}
 root.querySelector('#ops-refresh').onclick=()=>void load();
 root.querySelector('#ops-create')?.addEventListener('click',create);
 // Keep the board current while it is on screen: scans arrive from the driver app.
 state.timer=setInterval(()=>{if(!body.isConnected){clearInterval(state.timer);return;}if(document.visibilityState==='visible'&&!document.querySelector('dialog[open]'))void load();},20000);
 void load();
}
