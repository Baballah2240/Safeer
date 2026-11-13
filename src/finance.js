import {formatMinor} from './finance-format.mjs';
let saved=null,epoch=0;
export function resetFinance(){saved=null;epoch++;}
export function financeView(data,{t}){
 return `<section class="staff-panel finance-panel"><header class="staff-section-head"><div><h2>${t('Finance')}</h2><p>${t('Sales, refunds and cash reconciliation from recorded station transactions.')}</p></div></header><div id="finance-content" aria-live="polite"><p role="status">${t('Loading financial report…')}</p></div></section>`;
}
function defaultDates(timezone){
 const parts=new Intl.DateTimeFormat('en',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const part=type=>parts.find(p=>p.type===type).value,to=`${part('year')}-${part('month')}-${part('day')}`;
 const start=new Date(to+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-6);
 return {from:start.toISOString().slice(0,10),to};
}
export function bindFinance(root,data,ctx){
 const {api,t,e,language,dialog}=ctx,cid=data.company.id,base=`companies/${cid}/finance`,box=root.querySelector('#finance-content'),sessionEpoch=epoch;
 if(!saved||saved.cid!==cid)saved={cid,filters:{...defaultDates(data.company.timezone),stationId:'',employeeId:'',method:'',page:0,sessionPage:0,asOf:''}};
 let filters={...saved.filters},options={stations:[],employees:[]},report=null,busy=false,message='',bad=false,sequence=0;
 const connected=()=>box.isConnected&&epoch===sessionEpoch;
 const money=(v,c)=>`<bdi>${e(formatMinor(v,language,c))}</bdi>`;
 const name=x=>e(language==='ar'?x.nameAr:x.nameEn);
 const station=x=>e(language==='ar'?x.stationAr:x.stationEn);
 const date=v=>e(new Intl.DateTimeFormat(language==='ar'?'ar-SD-u-nu-latn':'en-GB',{timeZone:data.company.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(v)));
 const query=()=>new URLSearchParams(Object.entries(filters).map(([k,v])=>[k,String(v)])).toString();
 const method=k=>t({cash:'Cash',bank_transfer:'Bank transfer',mobile_wallet:'Mobile wallet'}[k]||k);
 const table=(headers,rows)=>`<div class="staff-table-wrap" tabindex="0" role="region" aria-label="${e(t(headers[0]))}"><table class="staff-table"><thead><tr>${headers.map(h=>`<th scope="col">${t(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>${rows.length?'':`<p>${t('No matching records.')}</p>`}</div>`;
 const pageButtons=(kind,page,total,size)=>`<div class="finance-pagination no-print"><span>${t('Page')} ${page+1} / ${Math.max(1,Math.ceil(total/size))} · ${total} ${t('records')}</span><button type="button" data-finance-page="${kind}" data-step="-1" ${page===0||busy?'disabled':''}>${t('Previous')}</button><button type="button" data-finance-page="${kind}" data-step="1" ${(page+1)*size>=total||busy?'disabled':''}>${t('Next')}</button></div>`;
 function reportHtml(r,printing=false){
  const summary=r.totals.map(x=>`<article class="finance-currency"><h3><bdi>${e(x.currency)}</bdi></h3><div class="finance-summary">${[['Gross payments',x.salesMinor],['Refunds',x.refundMinor],['Net collections',x.netMinor]].map(([k,v])=>`<div><span>${t(k)}</span><strong>${money(v,x.currency)}</strong></div>`).join('')}</div><p>${t('Tickets sold')}: ${x.ticketsSold} · ${t('Tickets refunded')}: ${x.ticketsRefunded}</p></article>`).join('')||`<p>${t('No matching records.')}</p>`;
  const parts=r.breakdown.filter(x=>x.category==='employee'),stations=r.breakdown.filter(x=>x.category==='station'),trips=r.breakdown.filter(x=>x.category==='trip');
  return `<div class="finance-report"><p>${t('Posting dates')}: <bdi>${e(r.from)} — ${e(r.to)}</bdi> · <bdi>${e(r.timezone)}</bdi></p><p class="finance-note">${t('Snapshot')}: <bdi>${date(r.asOf)}</bdi>. ${t('Net collections are payments minus refunds, not profit.')}</p>${summary}
  <h3>${t('Payment methods')}</h3>${table(['Payment method','Gross payments','Refunds'],r.methods.map(x=>[method(x.method),money(x.salesMinor,x.currency),money(x.refundMinor,x.currency)]))}
  <details class="finance-breakdowns" ${printing?'open':''}><summary>${t('Daily, employee, station and trip breakdowns')}</summary><h3>${t('Daily collections')}</h3>${table(['Date','Net collections'],r.daily.map(x=>[`<bdi>${e(x.date)}</bdi>`,money(x.netMinor,x.currency)]))}${[['Employee',parts],['Station',stations],['Trip',trips]].map(([label,rows])=>`<h3>${t(label)}</h3>${table([label,'Net collections','Transactions'],rows.map(x=>[name(x),money(x.netMinor,x.currency),String(x.movements)]))}`).join('')}</details>
  <h3>${t('Transaction history')}</h3>${table(['Document','Type','Posted at','Payment method','Amount','Employee','Station'],r.movements.map(x=>[`<bdi>${e(x.document)}</bdi>`,t(x.kind==='payment'?'Payment':'Refund'),`<bdi>${date(x.at)}</bdi>`,method(x.method),money((x.kind==='refund'?'-':'')+x.amountMinor,x.currency),e(x.employee),station(x)]))}${printing?`<p>${t('Current transaction page')}: ${r.page+1} · ${r.movementCount} ${t('records')}</p>`:pageButtons('page',r.page,r.movementCount,75)}
  <h3>${t('Cash reconciliation')}</h3><p class="finance-note">${t('Sessions overlap the selected dates. Amounts cover each session’s full lifetime up to the snapshot; payment-method filters do not change this table. Close sessions under Station.')}</p>${table(['Station','Counter','Employee','Session opened','Session closed','Opening cash','Cash in','Cash out','Expected cash','Counted cash','Difference'],r.sessions.map(x=>[station(x),e(x.counterName),e(x.employee),`<bdi>${date(x.openedAt)}</bdi>`,x.closedAt?`<bdi>${date(x.closedAt)}</bdi>`:t(x.stale?'Open over 24 hours':'Open'),money(x.openingMinor,x.currency),money(x.cashInMinor,x.currency),money(x.cashOutMinor,x.currency),money(x.recordedExpectedMinor??x.expectedMinor,x.currency),x.countedMinor===null?'—':money(x.countedMinor,x.currency),x.varianceMinor===null?'—':`<span class="${BigInt(x.varianceMinor)!==0n?'finance-difference':''}">${money(x.varianceMinor,x.currency)}</span>`]))}${printing?`<p>${t('Current session page')}: ${r.sessionPage+1} · ${r.sessionCount} ${t('records')}</p>`:pageButtons('sessionPage',r.sessionPage,r.sessionCount,50)}</div>`;
 }
 function render(){
  if(!connected())return;
  box.innerHTML=`${message?`<p role="${bad?'alert':'status'}" class="staff-alert ${bad?'bad':''}">${e(t(message))}</p>`:''}<form id="finance-filters" class="finance-filters"><label>${t('From')}<input type="date" name="from" value="${e(filters.from)}" required></label><label>${t('To')}<input type="date" name="to" value="${e(filters.to)}" required></label><label>${t('Station')}<select name="stationId"><option value="">${t('All permitted stations')}</option>${options.stations.map(s=>`<option value="${s.id}" ${filters.stationId===s.id?'selected':''}>${name(s)}</option>`).join('')}</select></label><label>${t('Employee')}<select name="employeeId"><option value="">${t('All permitted employees')}</option>${options.employees.map(s=>`<option value="${s.id}" ${filters.employeeId===s.id?'selected':''}>${e(s.name)}</option>`).join('')}</select></label><label>${t('Payment method')}<select name="method"><option value="">${t('All methods')}</option>${['cash','bank_transfer','mobile_wallet'].map(m=>`<option value="${m}" ${filters.method===m?'selected':''}>${method(m)}</option>`).join('')}</select></label><button class="staff-primary" ${busy?'disabled':''}>${t('Apply filters')}</button></form><p class="finance-note">${t('Select up to 31 days. Dates use the company timezone.')}</p><div class="staff-actions finance-tools"><button type="button" data-finance-print ${!report||busy?'disabled':''}>${t('Print current pages')}</button><button type="button" data-finance-export ${!report||busy?'disabled':''}>${t('Export all transactions (CSV)')}</button></div>${busy?`<p role="status">${t('Loading financial report…')}</p>`:''}${report?reportHtml(report):''}`;
  box.querySelector('#finance-filters').onsubmit=event=>{event.preventDefault();filters={...Object.fromEntries(new FormData(event.currentTarget)),page:0,sessionPage:0,asOf:''};void load();};
  box.querySelectorAll('[data-finance-page]').forEach(b=>b.onclick=()=>{filters[b.dataset.financePage]+=Number(b.dataset.step);void load();});
  box.querySelector('[data-finance-export]').onclick=()=>void task(async()=>{
   const result=await api(base+'/export','POST',filters);if(!connected())return;
   const blob=new Blob(['\uFEFF'+result.csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=result.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message='Export ready.';
  });
  box.querySelector('[data-finance-print]').onclick=()=>void task(async()=>{
   const fresh=await api(base+'?'+query());if(!connected())return;
   dialog.innerHTML=`<div class="finance-print"><h1>${name(data.company)}</h1><h2>${t('Finance')}</h2><p>${t('Filters')}: ${e(filters.stationId?options.stations.find(s=>s.id===filters.stationId)?.[language==='ar'?'nameAr':'nameEn']||'':'')} · ${e(filters.employeeId?options.employees.find(s=>s.id===filters.employeeId)?.name||'':'')} · ${filters.method?method(filters.method):t('All methods')}</p>${reportHtml(fresh,true)}<button type="button" class="no-print" data-finance-close>${t('Close')}</button></div>`;
   dialog.querySelector('[data-finance-close]').onclick=()=>dialog.close();dialog.showModal();window.print();
  });
 }
 async function task(fn){
  if(busy)return;busy=true;message='';bad=false;render();
  try{await fn();}catch(error){message=error.message;bad=true;if(['FORBIDDEN','UNAUTHENTICATED','NOT_FOUND'].includes(error.message))report=null;}
  finally{busy=false;render();}
 }
 async function load(){
  const version=++sequence;busy=true;message='';bad=false;report=null;render();
  try{const r=await api(base+'?'+query());if(!connected()||version!==sequence)return;report=r;filters.asOf=r.asOf;saved={cid,filters:{...filters}};}
  catch(error){if(version===sequence){message=error.message;bad=true;report=null;}}
  finally{if(version===sequence){busy=false;render();}}
 }
 void (async()=>{try{options=await api(base+'/options');if(connected())await load();}catch(error){message=error.message;bad=true;report=null;render();}})();
}
