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
const codeText={damaged:'Damaged',missing:'Missing',wrong_bus:'Wrong bus',wrong_bag:'Wrong bag',other:'Other',delay:'Delay',breakdown:'Breakdown',safety:'Safety',approved:'Approved',suspended:'Suspended',pending:'Pending approval',rejected:'Rejected'};
export function createStaffAlerts({api,t,e,language,openInbox,dialogOpen}){
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
  box.querySelector('[data-card-open]').onclick=()=>{close();openInbox();};
  box.querySelector('[data-card-close]').onclick=close;
  box.querySelector('[data-card-read]').onclick=async event=>{event.currentTarget.disabled=true;try{await api('notifications/'+item.id+'/read','POST',{});}catch{}close();void poll();};
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
   if(waiting&&!dialogOpen()&&!document.querySelector('#staff-alert-card')){const item=waiting;waiting=null;show(item);}
  }catch{/* A failed check is retried on the next turn; signing out is handled by api(). */}
  finally{busy=false;}
 };
 const onVisible=()=>{if(!document.hidden)void poll();};
 return {
  bell,poll,
  start(){if(running)return;running=true;void poll();timer=setInterval(poll,EVERY);document.addEventListener('visibilitychange',onVisible);},
  stop(){running=false;clearInterval(timer);timer=null;count=0;lastId=null;waiting=null;document.querySelector('#staff-alert-card')?.remove();document.removeEventListener('visibilitychange',onVisible);},
 };
}
