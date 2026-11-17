// D98/D99: the staff notification button beside the menu button, with an iOS-style unread count, and a card in the
// middle of the screen with the full details of a notification that arrives while the page is open.
// The page asks the server every 30 seconds while it is visible, at once when it becomes visible again, and after
// every screen load, so the count always matches the server. Events already unread when the page opens only count
// on the badge; the card is shown for events that arrive later, and never on top of a form that is open.
const EVERY=30000;
const bellPath='M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4';
// What each event means, shown on the card and in Notifications.
export const alertText={
 'payment.proof':'A bank transfer was taken with a proof photo. Check the transfer in the booking details.',
 'shipment.exception':'A problem was reported on a shipment. Resolve it under Shipments.',
 'booking.refunded':'A booking was refunded at the counter.',
 'trip.canceled':'A trip was canceled. Passengers with paid tickets are due a full refund.',
 'journey.incident':'A driver reported a problem on a journey.',
 'cash.difference':'A cash session closed with a difference between the expected and counted cash.',
 'luggage.exception':'A problem was reported on a bag. Resolve it under Luggage.',
 'company.registered':'A new company registered and is waiting for approval.',
 'company.status':'A company\'s status changed.',
 'marketplace.changed':'A company was added to or removed from the booking site.',
};
// D100: the panel's filters group events by what they are about.
const categoryOf=code=>/^(payment\.|booking\.refunded|cash\.|invoice\.)/.test(code)?'money':/^(trip\.|journey\.|luggage\.|shipment\.)/.test(code)?'operations':'company';
const categoryLabel={money:'Money',operations:'Operations',company:'Company'};
const codeText={damaged:'Damaged',missing:'Missing',wrong_bus:'Wrong bus',wrong_bag:'Wrong bag',other:'Other',delay:'Delay',breakdown:'Breakdown',safety:'Safety',approved:'Approved',suspended:'Suspended',pending:'Pending approval',rejected:'Rejected'};
export function createStaffAlerts({api,t,e,language,dialogOpen}){
 let count=0,lastId=null,timer=null,running=false,busy=false,waiting=null;
 const label=()=>count?`${t('Notifications')}: ${count} ${t('Unread')}`:t('Notifications');
 const shown=()=>count>99?'99+':String(count);
 const bell=()=>`<button type="button" id="staff-bell" class="secondary app-bell" aria-label="${e(label())}" title="${e(label())}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${bellPath}"/></svg><span class="app-bell-count" data-bell-count aria-hidden="true" ${count?'':'hidden'}>${shown()}</span></button>`;
 const paint=changed=>{
  const b=document.querySelector('#staff-bell');if(!b)return;b.setAttribute('aria-label',label());b.title=label();
  const n=b.querySelector('[data-bell-count]');n.textContent=shown();n.hidden=!count;n.classList.toggle('is-wide',count>9);
  if(changed&&count){n.classList.remove('is-bumped');void n.offsetWidth;n.classList.add('is-bumped');}
 };
 const ar=()=>language()==='ar';
 const value=(x,zone)=>{
  if(x.minor!==undefined&&x.minor!==null)return new Intl.NumberFormat(ar()?'ar-SD-u-nu-latn':'en-GB',{style:'currency',currency:x.currency||'SDG',maximumFractionDigits:2}).format(Number(x.minor)/100);
  if(x.at)return new Intl.DateTimeFormat(ar()?'ar-SD-u-nu-latn':'en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:zone||'Africa/Khartoum'}).format(new Date(x.at));
  if(x.code)return t(codeText[x.code]||x.code);
  if(x.textEn!==undefined)return ar()?x.textAr:x.textEn;
  return x.text??'';
 };
 const close=()=>{const box=document.querySelector('#staff-alert-card');if(!box)return;box.classList.add('is-leaving');setTimeout(()=>{if(box.open)box.close();box.remove();},180);};
 const show=item=>{
  document.querySelector('#staff-alert-card')?.remove();
  const name=ar()?item.companyAr:item.companyEn,more=count>1?count-1:0,box=document.createElement('dialog');
  box.id='staff-alert-card';box.className='staff-alert-card';box.setAttribute('aria-labelledby','staff-alert-title');
  box.innerHTML=`<article class="staff-alert-card-body"><header><span class="staff-alert-card-icon"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${bellPath}"/></svg></span><div><p class="staff-alert-card-kicker">${e(t('New notification'))}</p><h2 id="staff-alert-title">${e(t(item.code))}</h2></div></header>
   ${alertText[item.code]?`<p class="staff-alert-card-text">${e(t(alertText[item.code]))}</p>`:''}
   <dl class="staff-alert-card-facts"><div><dt>${e(t('Company'))}</dt><dd>${e(name||'')}</dd></div><div><dt>${e(t('Time'))}</dt><dd><bdi>${e(value({at:item.at},item.timezone))}</bdi></dd></div>${(item.detail||[]).map(x=>`<div><dt>${e(t(x.label))}</dt><dd><bdi>${e(value(x,item.timezone))}</bdi></dd></div>`).join('')}</dl>
   ${more?`<p class="staff-alert-card-more">${e(t('Unread notifications'))}: <bdi>${count}</bdi></p>`:''}
   <footer><button type="button" class="staff-primary" data-card-open>${e(t('Open notifications'))}</button><button type="button" data-card-read>${e(t('Mark read'))}</button><button type="button" class="secondary" data-card-close>${e(t('Close'))}</button></footer></article>`;
  document.body.append(box);box.showModal();
  box.addEventListener('cancel',event=>{event.preventDefault();close();});
  box.addEventListener('click',event=>{if(event.target===box)close();});
  box.querySelector('[data-card-open]').onclick=()=>{close();setTimeout(openPanel,190);};
  box.querySelector('[data-card-close]').onclick=close;
  box.querySelector('[data-card-read]').onclick=async event=>{event.currentTarget.disabled=true;try{await api('notifications/'+item.id+'/read','POST',{});}catch{}close();void poll();};
 };
 // D100: Notifications open as a panel over the current screen, not as a page.
 let panel=null;
 const panelBox=()=>document.querySelector('#staff-notifications');
 const when=at=>value({at},null);
 const facts=n=>(n.detail||[]).map(x=>`<div><dt>${e(t(x.label))}</dt><dd><bdi>${e(value(x,null))}</bdi></dd></div>`).join('');
 const pdf=n=>n.code.startsWith('invoice.')?`/api/v1/companies/${encodeURIComponent(n.companyId)}/invoices/${encodeURIComponent(n.sourceId)}/pdf?lang=${ar()?'ar':'en'}`:n.code.startsWith('contract.')?`/api/v1/companies/${encodeURIComponent(n.companyId)}/contracts/${encodeURIComponent(n.sourceId)}/pdf?lang=${ar()?'ar':'en'}`:'';
 const card=n=>{const link=pdf(n),cat=categoryOf(n.code),open=panel.details.has(n.id);
  return `<article class="notification-item ${n.read?'':'notification-unread'}" data-notification="${e(n.id)}"><header><span class="notify-kicker notify-${cat}">${e(t(categoryLabel[cat]))}</span><time><bdi>${e(when(n.at))}</bdi></time></header>
   <h3 class="notify-title">${e(t(n.code))}</h3>${alertText[n.code]?`<p class="notify-text">${e(t(alertText[n.code]))}</p>`:''}
   <p class="notify-meta"><span>${e(ar()?n.companyAr:n.companyEn)}</span><span class="notify-state">${n.read?`${e(t('Read'))}${n.readAt?` · <bdi>${e(when(n.readAt))}</bdi>`:''}`:`<b>${e(t('Unread'))}</b>`}</span></p>
   ${open&&n.detail?.length?`<dl class="notify-facts">${facts(n)}</dl>`:''}
   <div class="notify-actions">${n.detail?.length?`<button type="button" data-notification-details="${e(n.id)}" aria-expanded="${open}">${e(t(open?'Hide details':'Details'))}</button>`:''}${link?`<a class="staff-link" href="${e(link)}" download>${e(t('Download PDF'))}</a>`:''}${n.read?'':`<button type="button" class="staff-primary" data-notification-read="${e(n.id)}">${e(t('Mark read'))}</button>`}</div></article>`;};
 const paintPanel=()=>{
  const box=panelBox();if(!box||!panel)return;
  const q=panel.query.trim().toLocaleLowerCase(),rows=(panel.items||[]).filter(n=>(panel.filter==='all'||(panel.filter==='unread'?!n.read:categoryOf(n.code)===panel.filter))&&(!q||[t(n.code),alertText[n.code]?t(alertText[n.code]):'',n.companyEn,n.companyAr,...(n.detail||[]).map(x=>value(x,null))].join(' ').toLocaleLowerCase().includes(q)));
  const unread=panel.unreadCount??count,focus=document.activeElement?.matches?.('[data-notify-search]')?document.activeElement.selectionStart:null;
  // D109: the panel element is kept between redraws so its opening animation plays once, not again on every update.
  const shell=box.querySelector(":scope>.notify-panel")||box.appendChild(Object.assign(document.createElement("div"),{className:"notify-panel"}));
  shell.innerHTML=`<header class="notify-head"><div><h2 id="staff-notifications-title">${e(t('Notifications'))}</h2><p>${unread?`${e(t('Unread notifications'))}: <bdi>${unread}</bdi>`:e(t("You're all caught up"))}</p></div><button type="button" data-inbox-read-all ${unread?'':'disabled'}>${e(t('Mark all read'))}</button><button type="button" class="notify-close" data-notify-close aria-label="${e(t('Close'))}">×</button></header>
   <label class="notify-search"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M21 21l-4.3-4.3"/></svg><span class="list-sr">${e(t('Search notifications'))}</span><input type="search" data-notify-search maxlength="60" placeholder="${e(t('Search notifications'))}" value="${e(panel.query)}"></label>
   <div class="notify-filters" role="group" aria-label="${e(t('Filter'))}">${[['all','All'],['unread','Unread'],['money','Money'],['operations','Operations'],['company','Company']].map(([k,l])=>`<button type="button" data-notify-filter="${k}" aria-pressed="${panel.filter===k}">${e(t(l))}</button>`).join('')}</div>
   <div class="notify-bar"><span>${rows.length} ${e(t('updates'))}</span><button type="button" data-notify-refresh>${e(t('Refresh'))}</button></div>
   <div class="notify-list" aria-live="polite" ${panel.loading?'aria-busy="true"':''}>${panel.error?`<p class="staff-alert bad" role="alert">${e(t(panel.error))}</p>`:''}${panel.items===null?`<p role="status">${e(t('Loading…'))}</p>`:rows.map(card).join('')||`<p class="notify-empty">${e(t(panel.items.length?'No notifications match.':'No notifications to show.'))}</p>`}${panel.next?`<button type="button" class="notify-more" data-inbox-next>${e(t('Older notifications'))}</button>`:''}</div>
   <footer class="notify-foot">${e(t('From the last 90 days. Only notifications your access allows are shown.'))}</footer>`;
  box.querySelector('[data-notify-close]').onclick=closePanel;
  box.querySelector('[data-notify-refresh]').onclick=()=>void loadPanel(false);
  box.querySelector('[data-inbox-read-all]').onclick=async ev=>{ev.currentTarget.disabled=true;try{await api('notifications/read-all','POST',{});}catch(error){panel.error=error.message;}await loadPanel(false);void poll();};
  box.querySelectorAll('[data-notify-filter]').forEach(b=>b.onclick=()=>{panel.filter=b.dataset.notifyFilter;paintPanel();box.querySelector(`[data-notify-filter="${panel.filter}"]`)?.focus();});
  const search=box.querySelector('[data-notify-search]');search.oninput=()=>{panel.query=search.value;paintPanel();};
  if(focus!==null){const again=box.querySelector('[data-notify-search]');again.focus();again.setSelectionRange(focus,focus);}
  box.querySelectorAll('[data-notification-details]').forEach(b=>b.onclick=()=>{const id=b.dataset.notificationDetails;panel.details.has(id)?panel.details.delete(id):panel.details.add(id);paintPanel();box.querySelector(`[data-notification-details="${id}"]`)?.focus();});
  box.querySelectorAll('[data-notification-read]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('notifications/'+b.dataset.notificationRead+'/read','POST',{});const n=panel.items.find(x=>x.id===b.dataset.notificationRead);if(n){n.read=true;n.readAt=new Date().toISOString();}panel.unreadCount=Math.max(0,(panel.unreadCount||1)-1);}catch(error){panel.error=error.message;}paintPanel();void poll();});
  box.querySelector('[data-inbox-next]')?.addEventListener('click',()=>void loadPanel(true));
 };
 const loadPanel=async older=>{
  if(!panel)return;panel.loading=true;panel.error='';if(!older){panel.items=panel.items||null;}paintPanel();
  try{const r=await api('notifications'+(older&&panel.next?'?before='+encodeURIComponent(panel.next):''));if(!panel)return;
   panel.items=older?[...panel.items,...r.items]:r.items;panel.next=r.nextCursor||null;panel.unreadCount=r.unreadCount;}
  catch(error){if(panel){panel.error=error.message;panel.items=panel.items||[];}}
  if(panel){panel.loading=false;paintPanel();}
 };
 const closePanel=()=>{const box=panelBox();panel=null;if(!box)return;box.classList.add('is-leaving');setTimeout(()=>{if(box.open)box.close();box.remove();document.querySelector('#staff-bell')?.focus();},180);};
 const openPanel=()=>{
  document.querySelector('#staff-alert-card')?.remove();
  if(panelBox()){void loadPanel(false);return;}
  panel={items:null,next:null,unreadCount:count,filter:'all',query:'',details:new Set(),loading:true,error:''};
  const box=document.createElement('dialog');box.id='staff-notifications';box.className='staff-notify';box.setAttribute('aria-labelledby','staff-notifications-title');
  document.body.append(box);paintPanel();box.showModal();
  box.addEventListener('cancel',ev=>{ev.preventDefault();closePanel();});
  box.addEventListener('click',ev=>{if(ev.target===box)closePanel();});
  void loadPanel(false);
 };
 const poll=async()=>{
  if(!running||busy||document.hidden)return;busy=true;
  try{
   const r=await api('notifications/unread');if(!running)return;
   const before=count;count=r.unreadCount||0;
   const id=r.latest?.id;
   if(id&&lastId!==null&&BigInt(id)>BigInt(lastId))waiting=r.latest;
   if(id&&(lastId===null||BigInt(id)>BigInt(lastId)))lastId=id;else if(lastId===null)lastId='0';
   paint(count!==before);
   if(panel&&waiting){waiting=null;void loadPanel(false);}
   if(waiting&&!dialogOpen()&&!document.querySelector('#staff-alert-card')){const item=waiting;waiting=null;show(item);}
  }catch{/* A failed check is retried on the next turn; signing out is handled by api(). */}
  finally{busy=false;}
 };
 const onVisible=()=>{if(!document.hidden)void poll();};
 return {
  bell,poll,openPanel,
  // Language or theme changed while the panel is open.
  repaint(){paintPanel();},
  start(){if(running)return;running=true;void poll();timer=setInterval(poll,EVERY);document.addEventListener('visibilitychange',onVisible);},
  stop(){running=false;if(panelBox()){panel=null;panelBox().remove();}clearInterval(timer);timer=null;count=0;lastId=null;waiting=null;document.querySelector('#staff-alert-card')?.remove();document.removeEventListener('visibilitychange',onVisible);},
 };
}
