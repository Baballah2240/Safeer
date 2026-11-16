// D94: staff list pages (Shipments, Bookings) share one layout: a page header with actions, a filter bar,
// active-filter chips, a data table that becomes stacked cards on narrow screens, and pages of 20 rows.
// Presets, status and "Filter this list" narrow only the rows already loaded from the server.
const glyph={box:'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',ticket:'M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4zM14 6v12',search:'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M21 21l-4.3-4.3',close:'m6 6 12 12M18 6 6 18',first:'M6 5v14M18 6l-7 6 7 6',prev:'m15 6-6 6 6 6',next:'m9 6 6 6-6 6',last:'M18 5v14M6 6l7 6-7 6',refresh:'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7'};
const listIcon=name=>`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${glyph[name]||glyph.box}"/></svg>`;

export function listHeader({t,e},{icon,title,subtitle,actions=''}){
 return `<header class="list-head"><span class="list-head-icon">${listIcon(icon)}</span><div class="list-head-text"><h2>${e(t(title))}</h2><p>${e(t(subtitle))}</p></div>${actions?`<div class="list-head-actions">${actions}</div>`:''}</header>`;
}

const day=86400000;
const listRanges=[['all','All','All'],['today','Today','Today'],['7','7D','Last 7 days'],['30','30D','Last 30 days'],['90','90D','Last 90 days']];
// Days are counted in the company's time zone, so "Today" matches the office calendar.
const dayKey=(value,zone)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export function inRange(value,range,zone,now=Date.now()){
 if(range==='all'||!value)return true;
 const key=dayKey(value,zone),today=dayKey(now,zone);
 if(range==='today')return key===today;
 // "7D" is today and the six days before it.
 return key>=dayKey(now-(Number(range)-1)*day,zone)&&key<=today;
}

// state: {range,status,filter,page}. options: columns [{key,label}], rows → {id,cls,cells:{key:html},status,date,text}.
export function paintList(box,items,options,state,after){
 const {t,e,columns,statuses,zone,size=20,empty,rangeLabel='Created'}=options;
 const rows=items.map(options.row);
 const needle=state.filter.trim().toLowerCase();
 const shown=rows.filter(r=>(!state.status||r.status===state.status)&&inRange(r.date,state.range,zone)&&(!needle||r.text.toLowerCase().includes(needle)));
 const pages=Math.max(1,Math.ceil(shown.length/size));state.page=Math.min(state.page,pages-1);
 const slice=shown.slice(state.page*size,state.page*size+size);
 const chips=[state.range!=='all'&&['range',`${t(rangeLabel)}: ${t(listRanges.find(([k])=>k===state.range)[2])}`],state.status&&['status',`${t('Status')}: ${t(statuses.find(([k])=>k===state.status)?.[1]||state.status)}`],needle&&['filter',`${t('Filter')}: ${state.filter.trim()}`]].filter(Boolean);
 // Repainting replaces the controls; keep keyboard focus on the same one.
 const active=document.activeElement,inside=box.contains(active),caret=inside&&active.matches('[data-list-filter]')?active.selectionStart:null,again=inside?['data-list-range','data-list-status','data-list-filter','data-list-page','data-list-clear'].find(n=>active.hasAttribute(n)):null,againValue=again?active.getAttribute(again):null;
 box.innerHTML=`<div class="list-tools"><div class="list-ranges" role="group" aria-label="${e(t(rangeLabel))}">${listRanges.map(([k,label,long])=>`<button type="button" data-list-range="${k}" aria-pressed="${state.range===k}" title="${e(t(long))}" aria-label="${e(t(long))}">${e(t(label))}</button>`).join('')}</div>
  <label class="list-status"><span class="list-sr">${e(t('Status'))}</span><select data-list-status><option value="">${e(t('Any status'))}</option>${statuses.map(([k,label])=>`<option value="${e(k)}" ${state.status===k?'selected':''}>${e(t(label))}</option>`).join('')}</select></label>
  <label class="list-filter">${listIcon('search')}<span class="list-sr">${e(t('Filter this list'))}</span><input type="search" data-list-filter maxlength="60" placeholder="${e(t('Filter this list…'))}" value="${e(state.filter)}"></label></div>
  <div class="list-summary"><h3>${e(t(options.title))} <span class="list-count">${shown.length}</span></h3>${chips.map(([k,label])=>`<button type="button" class="list-chip" data-list-clear="${k}" aria-label="${e(t('Remove filter'))}: ${e(label)}">${e(label)} ${listIcon('close')}</button>`).join('')}</div>
  ${options.before||''}
  ${slice.length?`<div class="list-table-wrap"><table class="list-table"><thead><tr>${columns.map(c=>`<th scope="col" class="list-col-${c.key}">${e(t(c.label))}</th>`).join('')}</tr></thead><tbody>${slice.map(r=>`<tr class="${e(r.cls||'')}" data-row="${e(r.id)}">${columns.map(c=>`<td class="list-col-${c.key}" data-label="${e(t(c.label))}">${r.cells[c.key]??''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:`<p class="list-empty">${e(t(rows.length?'No rows match these filters.':empty))}</p>`}
  ${shown.length>size?`<nav class="list-pages" aria-label="${e(t('Pages'))}"><span>${state.page*size+1}–${Math.min(shown.length,(state.page+1)*size)} ${e(t('of'))} ${shown.length}</span>${[['first',0],['prev',state.page-1],['next',state.page+1],['last',pages-1]].map(([k,p])=>`<button type="button" data-list-page="${p}" aria-label="${e(t({first:'First page',prev:'Previous page',next:'Next page',last:'Last page'}[k]))}" ${p<0||p>=pages||p===state.page?'disabled':''}>${listIcon(k)}</button>`).join('')}</nav>`:''}`;
 const repaint=()=>paintList(box,items,options,state,after);
 box.querySelectorAll('[data-list-range]').forEach(b=>b.onclick=()=>{state.range=b.dataset.listRange;state.page=0;repaint();});
 box.querySelector('[data-list-status]').onchange=event=>{state.status=event.target.value;state.page=0;repaint();};
 const filter=box.querySelector('[data-list-filter]');filter.oninput=()=>{state.filter=filter.value;state.page=0;repaint();};

 box.querySelectorAll('[data-list-clear]').forEach(b=>b.onclick=()=>{const k=b.dataset.listClear;if(k==='range')state.range='all';if(k==='status')state.status='';if(k==='filter')state.filter='';state.page=0;repaint();});
 box.querySelectorAll('[data-list-page]').forEach(b=>b.onclick=()=>{state.page=Number(b.dataset.listPage);repaint();box.querySelector('.list-table')?.scrollIntoView({block:'nearest'});});
 if(again){const target=box.querySelector(again==='data-list-range'||again==='data-list-page'?`[${again}="${againValue}"]:not([disabled])`:`[${again}]`)||box.querySelector('[data-list-filter]');target.focus({preventScroll:true});if(caret!==null&&target.matches('[data-list-filter]'))target.setSelectionRange(caret,caret);}
 after?.(box);
}
export const listState=()=>({range:'all',status:'',filter:'',page:0});
