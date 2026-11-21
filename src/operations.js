import {intlLocale,isRtl} from './locales/index.js';
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
 seat:'M7 4v9h9l2 7M7 13l-2 7M16 13V8',chevron:'m9 6 6 6-6 6',ticket:'M4 8a2 2 0 0 0 0 4v4h16v-4a2 2 0 0 0 0-4V4H4zM13 4v12',plus:'M12 5v14M5 12h14',close:'M6 6l12 12M18 6 6 18',refresh:'M20 7V3l-4 4M20 7a8 8 0 1 0 0 10',
};
const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]}"/></svg>`;
let state={company:null,trip:null,timer:null,status:''};
export const resetOperations=()=>{clearInterval(state.timer);state={company:null,trip:null,timer:null,status:''};};
// D102: dashboard colours are kept for statuses and chart data only.
const statusColor={scheduled:'#9ca3af',boarding:'#3b82f6',departed:'#f59e0b',arrived:'#22c55e',delayed:'#eab308',unassigned:'#dc2626',canceled:'#9f1239',draft:'#cbd5e1'};
const statusOrder=['scheduled','boarding','departed','arrived','delayed','unassigned','canceled'];

export function operationsView(data,{t}){
 const cap=data.capabilities;
 return `<section class="ops dash" aria-labelledby="ops-title"><div class="dash-main"><header class="ops-head"><div><h1 id="ops-title">${t('Operations overview')}</h1><p class="ops-day" id="ops-day"></p></div><div class="ops-head-actions"><button type="button" class="secondary ops-icon-button" id="ops-refresh" aria-label="${t('Refresh')}" title="${t('Refresh')}">${svg('refresh')}</button>${cap.tripsManage?`<button type="button" class="staff-primary ops-create" id="ops-create">${svg('plus')}<span>${t('Create trip')}</span></button>`:''}</div></header>
 <nav class="dash-tabs" aria-label="${t('Dashboard sections')}">${[['ops-summary','Summary'],['ops-table-title','Departures'],['ops-attention-anchor','Needs attention'],['dash-activity','Activity']].map(([id,label],i)=>`<button type="button" data-dash-tab="${id}" ${i===0?'aria-current="true"':''}>${t(label)}</button>`).join('')}</nav><div id="ops-body" aria-live="polite"><div class="ops-kpis" aria-hidden="true">${'<article class="ops-kpi ops-skeleton"></article>'.repeat(4)}</div><p role="status" class="ops-loading">${t('Loading today\'s departures…')}</p></div></div></section>`;
}

export function bindOperations(root,data,ctx){
 const {api,t,e,language}=ctx,cid=data.company.id,base=`companies/${cid}/operations`,body=root.querySelector('#ops-body');
 if(!body)return;
 if(state.company!==cid){resetOperations();state.company=cid;}
 clearInterval(state.timer);
 const tz=data.company.timezone;
 const time=(value,zone=tz)=>new Intl.DateTimeFormat(intlLocale(language),{hour:'2-digit',minute:'2-digit',timeZone:zone}).format(new Date(value));
 const route=row=>{const name=language==='ar'?row.routeAr:row.routeEn,parts=String(name).split(/\s+(?:to|→|إلى)\s+/);return parts.length===2?`<span class="ops-route">${e(parts[0])}<span class="ops-arrow" aria-hidden="true">${isRtl(language)?'←':'→'}</span><span class="sr-only"> ${t('to')} </span>${e(parts[1])}</span>`:`<span class="ops-route">${e(name)}</span>`;};
 const driver=row=>row.driverEn?e(language==='ar'?row.driverAr:row.driverEn):'—';
 const badge=status=>{const [label,icon,tone]=statusInfo[status]||statusInfo.scheduled;return `<span class="ops-status ops-${tone}">${svg(icon)}<span>${t(label)}</span></span>`;};
 const ratio=(a,b)=>b?`<bdi>${a} / ${b}</bdi>`:`<bdi>${a}</bdi>`;
 let view=null,detail=null,failed='';
 // D85: the overview links into the rest of the workspace: KPIs open Trips/Bookings or jump to the list, rows open the trip.
 const cap=data.capabilities,kpiTargets=[cap.tripsRead?'trips':'',cap.bookingsRead?'bookings':'','#ops-table-title','#ops-attention-title'],
  kpiHints={trips:'Open Trips',bookings:'Open Bookings','#ops-table-title':"Show today's departures",'#ops-attention-title':'Show what needs attention'};
 const assign=r=>cap.tripsManage&&r.status!=='canceled'?`<button type="button" class="ops-assign" data-ops-go="trips">${t('Assign')}</button>`:'—';

 const kpis=s=>[['Departures today',s.departures,'bus','selected'],['Passengers booked',s.booked,'people','primary'],['Boarded',s.boarded,'seat','ok'],['Needs attention',s.attention,'alert',s.attention?'urgent':'neutral']]
  .map(([label,value,icon,tone],i)=>{const go=i===3&&!s.attention?'':kpiTargets[i],inner=`<span class="ops-kpi-icon">${svg(icon)}</span><div><span>${t(label)}</span><strong><bdi>${e(value)}</bdi></strong></div>`;
   return go?`<button type="button" class="ops-kpi ops-kpi-${tone} ops-kpi-link" data-ops-go="${go}" title="${e(t(kpiHints[go]))}">${inner}<span class="ops-kpi-go">${svg('chevron')}</span></button>`:`<article class="ops-kpi ops-kpi-${tone}">${inner}</article>`;}).join('');
 const table=rows=>rows.length?`<div class="staff-table-wrap ops-table-wrap" tabindex="0" role="region" aria-label="${t('Today\'s departures')}"><table class="staff-table ops-table"><thead><tr>${['Time','Route','Vehicle','Driver','Booked','Boarded','Status'].map(h=>`<th scope="col">${t(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr class="ops-row ${state.trip===r.id?'ops-row-selected':''} ${r.status==='canceled'?'ops-row-muted':''}" data-ops-row="${e(r.id)}"><td><button type="button" class="ops-row-open" data-ops-trip="${e(r.id)}" aria-pressed="${state.trip===r.id}" aria-label="${e(t('Open trip details'))} ${e(time(r.departureAt,r.timezone))}"><strong><bdi>${e(time(r.departureAt,r.timezone))}</bdi></strong></button></td><td>${route(r)}</td><td>${r.busCode?`<bdi>${e(r.busCode)}</bdi>`:assign(r)}</td><td>${r.driverEn?driver(r):assign(r)}</td><td>${ratio(r.booked,r.seatCount)}</td><td>${ratio(r.boarded,r.booked)}</td><td>${badge(r.status)}</td></tr>`).join('')}</tbody></table></div>`
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
   ${d.legs?.length>1?`<h3>${t('Load by stretch')}</h3><ul class="ops-legs">${d.legs.map(l=>{const pct=d.seatCount?Math.round(l.occupied*100/d.seatCount):0;return `<li><span>${e(language==='ar'?l.fromAr:l.fromEn)} <span aria-hidden="true">${isRtl(language)?'←':'→'}</span> ${e(language==='ar'?l.toAr:l.toEn)}</span><span class="ops-bar" role="img" aria-label="${e(l.occupied+' / '+(d.seatCount||0))}"><span data-pct="${pct}"></span></span><bdi>${e(l.occupied)} / ${e(d.seatCount||0)}</bdi></li>`;}).join('')}</ul>`:''}
   ${d.canSeePassengers?`<h3>${t('Recent ticket scans')} <bdi>(${d.recentScans.length})</bdi></h3>${d.recentScans.length?`<table class="staff-table ops-mini"><thead><tr><th scope="col">${t('Time')}</th><th scope="col">${t('Ticket')}</th><th scope="col">${t('Passenger')}</th></tr></thead><tbody>${d.recentScans.map(s=>`<tr><td><bdi>${e(time(s.at,d.timezone))}</bdi></td><td><bdi>${e(s.ticket)}</bdi></td><td>${s.name?e(s.name):`<span class="staff-muted">${t('Name erased')}</span>`}</td></tr>`).join('')}</tbody></table>`:`<p class="staff-muted">${t('No tickets scanned yet.')}</p>`}
   <h3>${t('Passengers')} <bdi>(${d.passengers.length})</bdi></h3>${d.passengers.length?`<ul class="ops-passengers">${d.passengers.map(p=>`<li><span class="ops-seat"><bdi>${e(p.seat)}</bdi></span><span>${p.name?e(p.name):`<span class="staff-muted">${t('Name erased')}</span>`}<small><bdi>${e(p.ticket)}</bdi>${p.boardsEn&&d.legs?.length>1?` · ${e(language==='ar'?p.boardsAr:p.boardsEn)} ${isRtl(language)?'←':'→'} ${e(language==='ar'?p.leavesAr:p.leavesEn)}`:''}</small></span>${p.boardedAt?`<span class="ops-status ops-ok">${svg('check')}<span>${t('Boarded')}</span></span>`:`<span class="ops-status ops-neutral">${svg('clock')}<span>${t('Waiting')}</span></span>`}</li>`).join('')}</ul>`:`<p class="staff-muted">${t('No paid tickets on this trip yet.')}</p>`}`
   :`<p class="staff-muted">${t('Passenger names need booking access.')}</p>`}
   <div class="ops-panel-actions">${cap.tripsRead?`<button type="button" class="staff-primary" data-ops-go="trips">${svg('bus')}<span>${t(d.status==='unassigned'&&cap.tripsManage?'Assign a driver':'Manage in Trips')}</span></button>`:''}${cap.bookingsRead?`<button type="button" class="secondary" data-ops-go="bookings">${svg('ticket')}<span>${t('Open Bookings')}</span></button>`:''}</div></aside>`;
 };
 let feed=null;
 const statusLabel=status=>t((statusInfo[status]||statusInfo.scheduled)[0]);
 const counts=rows=>{const c={};for(const r of rows)c[r.status]=(c[r.status]||0)+1;return c;};
 // Trip status counts, like the workload strip: each opens the departures with that status.
 const workload=rows=>{const c=counts(rows);return `<section class="dash-block" aria-labelledby="dash-status-title"><h2 class="dash-h" id="dash-status-title">${t('Trip status')}</h2><div class="dash-status">${statusOrder.map(k=>`<button type="button" class="dash-stat" data-dash-status="${k}" aria-pressed="${state.status===k}" ${c[k]?'':'data-empty'}><span class="dash-stat-label"><span class="dash-dot" data-color="${statusColor[k]}"></span>${statusLabel(k)}</span><strong><bdi>${c[k]||0}</bdi></strong></button>`).join('')}</div></section>`;};
 // Seats booked on each departure (bars), coloured by status; a bar opens that trip.
 const seatChart=rows=>{const list=rows.slice(0,12),max=Math.max(1,...list.map(r=>r.seatCount||r.booked||1));
  return `<section class="dash-card dash-chart" aria-labelledby="dash-seats-title"><h2 class="dash-h" id="dash-seats-title">${t('Seats booked by departure')}</h2>${list.length?`<div class="dash-bars" role="list">${list.map(r=>`<button type="button" role="listitem" class="dash-bar" data-ops-trip="${e(r.id)}" title="${e(time(r.departureAt))} · ${e(r.booked)}/${e(r.seatCount||0)}" aria-label="${e(time(r.departureAt))}: ${e(r.booked)} ${t('of')} ${e(r.seatCount||0)} ${t('seats booked')}"><span class="dash-bar-track"><span class="dash-bar-fill" data-height="${Math.round((r.booked||0)*100/max)}" data-color="${statusColor[r.status]||statusColor.scheduled}"></span></span><small><bdi>${e(time(r.departureAt))}</bdi></small></button>`).join('')}</div><p class="dash-axis"><span><bdi>0</bdi></span><span><bdi>${max}</bdi> ${t('seats')}</span></p>`:`<p class="dash-empty">${t('No departures today.')}</p>`}</section>`;};
 // Departures by status as a half ring with a legend.
 const statusChart=rows=>{const c=counts(rows),total=rows.length,keys=statusOrder.filter(k=>c[k]);let at=0;
  const arc=(from,to)=>{const a=Math.PI*(1-from),b=Math.PI*(1-to),r=80,cx=100,cy=95,x1=cx+r*Math.cos(a),y1=cy-r*Math.sin(a),x2=cx+r*Math.cos(b),y2=cy-r*Math.sin(b);return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;};
  const gap=keys.length>1?0.012:0;
  const paths=keys.map(k=>{const from=at,to=at+c[k]/total;at=to;return `<path d="${arc(from+gap/2,Math.max(from+gap/2+0.001,to-gap/2))}" class="dash-ring-part" data-color="${statusColor[k]}"/>`;}).join('');
  return `<section class="dash-card dash-chart" aria-labelledby="dash-ring-title"><h2 class="dash-h" id="dash-ring-title">${t('Departures by status')}</h2>${total?`<div class="dash-ring"><svg viewBox="0 0 200 110" role="img" aria-label="${keys.map(k=>`${statusLabel(k)} ${c[k]}`).join(', ')}"><path d="${arc(0,1)}" class="dash-ring-base"/>${paths}</svg><ul class="dash-legend">${statusOrder.map(k=>`<li><button type="button" data-dash-status="${k}" aria-pressed="${state.status===k}"><span class="dash-dot" data-color="${statusColor[k]}"></span><span>${statusLabel(k)}</span><strong><bdi>${c[k]||0}</bdi></strong></button></li>`).join('')}</ul></div>`:`<p class="dash-empty">${t('No departures today.')}</p>`}</section>`;};
 // Recent activity: this company's latest notifications for this person.
 const activity=()=>`<section class="dash-block dash-activity" id="dash-activity" aria-labelledby="dash-activity-title"><header class="dash-row"><h2 class="dash-h" id="dash-activity-title">${t('Recent activity')}</h2>${ctx.openNotifications?`<button type="button" class="secondary" data-dash-inbox>${t('Open notifications')}</button>`:''}</header>${feed===null?`<p class="dash-empty" role="status">${t('Loading…')}</p>`:feed.length?`<ol class="dash-feed">${feed.map(n=>`<li><span class="dash-feed-icon">${svg(n.code.startsWith('trip')||n.code.startsWith('journey')?'bus':n.code.startsWith('booking')||n.code.startsWith('payment')?'ticket':'alert')}</span><span><strong>${e(t(n.code))}</strong><small><bdi>${e(new Intl.DateTimeFormat(intlLocale(language),{dateStyle:'medium',timeStyle:'short',timeZone:tz}).format(new Date(n.at)))}</bdi>${n.read?'':` · ${t('Unread')}`}</small></span></li>`).join('')}</ol>`:`<p class="dash-empty">${t('No recent activity.')}</p>`}</section>`;
 const loadFeed=async()=>{try{const r=await api('notifications');feed=r.items.filter(n=>n.companyId===cid).slice(0,6);}catch{feed=[];}if(view)paint();};
 // Tabs jump to their part of the dashboard.
 root.querySelectorAll('[data-dash-tab]').forEach(b=>b.onclick=()=>{root.querySelectorAll('[data-dash-tab]').forEach(x=>x.removeAttribute('aria-current'));b.setAttribute('aria-current','true');const target=root.querySelector('#'+b.dataset.dashTab)||root.querySelector('#ops-body');target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});
 const paint=()=>{
  if(!body.isConnected){clearInterval(state.timer);return;}
  const day=root.querySelector('#ops-day');
  if(failed&&!view){body.innerHTML=`<div class="ops-error" role="alert"><p>${e(t(failed))}</p><button type="button" class="staff-primary" data-ops-retry>${t('Try again')}</button></div>`;body.querySelector('[data-ops-retry]').onclick=()=>void load();return;}
  if(!view)return;
  if(day)day.textContent=new Intl.DateTimeFormat(intlLocale(language),{dateStyle:'full',timeZone:tz}).format(new Date(view.asOf));
  body.innerHTML=`${failed?`<p class="staff-alert bad" role="alert">${e(t(failed))}</p>`:''}<section class="dash-block" id="ops-summary" aria-labelledby="dash-overview-title"><h2 class="dash-h" id="dash-overview-title">${t('Overview')}</h2><div class="ops-kpis">${kpis(view.summary)}</div></section>${workload(view.departures)}<div class="dash-charts">${seatChart(view.departures)}${statusChart(view.departures)}</div><div class="ops-layout ${state.trip?'ops-with-panel':''}"><section class="ops-main" aria-labelledby="ops-table-title"><h2 id="ops-table-title">${t('Today\'s departures')}</h2>${state.status?`<p class="dash-filter">${t('Showing')}: <span class="dash-dot" data-color="${statusColor[state.status]}"></span>${t((statusInfo[state.status]||statusInfo.scheduled)[0])} <button type="button" class="secondary" data-dash-clear>${t('Show all')}</button></p>`:''}${table(state.status?view.departures.filter(r=>r.status===state.status):view.departures)}<span id="ops-attention-anchor"></span>${attention(view.attention)}</section>${panel()}</div>${activity()}`;
  // CSP forbids inline style attributes; set the bar width through the CSSOM.
  body.querySelectorAll('[data-pct]').forEach(bar=>{bar.style.width=bar.dataset.pct+'%';});
  body.querySelectorAll('[data-color]').forEach(n=>{n.style.setProperty('--dash-color',n.dataset.color);});
  body.querySelectorAll('[data-height]').forEach(n=>{n.style.height=n.dataset.height+'%';});
  body.querySelectorAll('[data-dash-status]').forEach(b=>b.onclick=()=>{state.status=state.status===b.dataset.dashStatus?'':b.dataset.dashStatus;paint();body.querySelector('#ops-table-title')?.scrollIntoView({behavior:'smooth',block:'start'});});
  body.querySelector('[data-dash-clear]')?.addEventListener('click',()=>{state.status='';paint();});
  body.querySelector('[data-dash-inbox]')?.addEventListener('click',()=>ctx.openNotifications?.());
  body.querySelectorAll('[data-ops-trip]').forEach(b=>b.onclick=()=>{state.trip=b.dataset.opsTrip===state.trip&&b.classList.contains('ops-row-open')?null:b.dataset.opsTrip;detail=null;paint();if(state.trip)void loadTrip(true);});
  body.querySelector('[data-ops-close]')?.addEventListener('click',()=>{const id=state.trip;state.trip=null;detail=null;paint();body.querySelector(`[data-ops-trip="${CSS.escape(id)}"]`)?.focus();});
  body.querySelector('[data-ops-empty-create]')?.addEventListener('click',create);
  body.querySelectorAll('[data-ops-go]').forEach(b=>b.onclick=event=>{event.stopPropagation();const go=b.dataset.opsGo;if(go.startsWith('#')){const target=body.querySelector(go);target?.scrollIntoView({behavior:'smooth',block:'start'});target?.setAttribute('tabindex','-1');target?.focus({preventScroll:true});}else ctx.openSection?.(go);});
  // The whole row opens the trip, not only the time.
  body.querySelectorAll('[data-ops-row]').forEach(row=>row.onclick=event=>{if(event.target.closest('button,a'))return;row.querySelector('.ops-row-open')?.click();});
 };
 const load=async()=>{
  try{view=await api(base);failed='';}catch(error){failed=error.message||'REQUEST_FAILED';}
  paint();void loadFeed();if(state.trip)void loadTrip(false);
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
