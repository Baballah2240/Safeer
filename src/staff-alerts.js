// D98: the staff notification button beside the menu button, with the unread count, and a live pop-up for new events.
// The page asks the server every 30 seconds while it is visible (and at once when it becomes visible again).
// Events already unread when the page opens only count on the badge; a pop-up is shown for events that arrive later.
const EVERY=30000,SHOW_FOR=10000;
const bellPath='M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4';
export function createStaffAlerts({api,t,e,language,openInbox}){
 let count=0,lastId=null,timer=null,running=false,busy=false,popTimer=null;
 const label=()=>count?`${t('Notifications')}: ${count} ${t('Unread')}`:t('Notifications');
 const shown=()=>count>99?'99+':String(count);
 const bell=()=>`<button type="button" id="staff-bell" class="secondary app-bell" aria-label="${e(label())}" title="${e(label())}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${bellPath}"/></svg><span class="app-bell-count" data-bell-count ${count?'':'hidden'}>${shown()}</span></button>`;
 const paint=()=>{const b=document.querySelector('#staff-bell');if(!b)return;b.setAttribute('aria-label',label());b.title=label();const n=b.querySelector('[data-bell-count]');n.textContent=shown();n.hidden=!count;};
 const closePop=()=>{clearTimeout(popTimer);document.querySelector('#staff-alert-pop')?.remove();};
 const pop=item=>{
  closePop();
  const name=language()==='ar'?item.companyAr:item.companyEn,box=document.createElement('div');
  box.id='staff-alert-pop';box.className='staff-alert-pop';box.setAttribute('role','status');box.setAttribute('aria-live','polite');
  box.innerHTML=`<span class="staff-alert-pop-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${bellPath}"/></svg></span><div><strong>${e(t(item.code))}</strong><small>${e(name||'')}</small></div><button type="button" class="staff-primary" data-pop-open>${e(t('View'))}</button><button type="button" class="secondary" data-pop-close aria-label="${e(t('Close'))}">×</button>`;
  document.body.append(box);
  box.querySelector('[data-pop-open]').onclick=()=>{closePop();openInbox();};
  box.querySelector('[data-pop-close]').onclick=closePop;
  popTimer=setTimeout(closePop,SHOW_FOR);
 };
 const poll=async()=>{
  if(!running||busy||document.hidden)return;busy=true;
  try{
   const r=await api('notifications/unread');if(!running)return;
   count=r.unreadCount||0;
   const id=r.latest?.id;
   if(id&&lastId!==null&&BigInt(id)>BigInt(lastId))pop(r.latest);
   if(id&&(lastId===null||BigInt(id)>BigInt(lastId)))lastId=id;else if(lastId===null)lastId='0';
   paint();
  }catch{/* A failed check is retried on the next turn; signing out is handled by api(). */}
  finally{busy=false;}
 };
 const onVisible=()=>{if(!document.hidden)void poll();};
 return {
  bell,poll,
  start(){if(running)return;running=true;void poll();timer=setInterval(poll,EVERY);document.addEventListener('visibilitychange',onVisible);},
  stop(){running=false;clearInterval(timer);timer=null;count=0;lastId=null;closePop();document.removeEventListener('visibilitychange',onVisible);},
 };
}
