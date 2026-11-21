import {supported} from './locales/index.js';
// D91: a Back button in the top bar of every inner screen of the passenger, tracking and
// driver apps. D112: the booking and parcel pages have no Back button; their header tabs cover navigation.
// Pages re-render their whole root, so the button is re-added after each render.
const surface=document.documentElement.dataset.appSurface;
const here=()=>new URL(location.href);
function inner(){
 const url=here(),path=url.pathname,view=url.searchParams.get('view');
 if(surface==='driver')return ['scan','passengers'].includes(view);
 if(surface==='staff')return (history.state?.staffDepth||0)>0;
 return false;
}
function fallback(){
 const url=here(),lang=(l=>l&&l!=='en'&&supported(l)?'?lang='+l:'')(url.searchParams.get('lang'));
 if(surface==='staff')return '/staff'+lang;
 if(surface==='driver'){url.searchParams.delete('view');return url.pathname+url.search;}
 return '/marketplace'+lang;
}
// The site sends no referrer, so the Navigation API tells whether there is an in-app page behind.
const canGoBack=()=>{try{return window.navigation?.canGoBack===true;}catch{return false;}};
function place(){
 const bar=document.querySelector('.app-masthead:has(.app-menu-trigger)');
 const old=document.querySelector('[data-app-back]');
 if(!bar||!inner()){old?.remove();return;}
 if(old&&bar.contains(old))return;
 old?.remove();
 const ar=document.documentElement.lang==='ar';
 const a=document.createElement('a');
 a.className='app-back';a.dataset.appBack='';a.href=fallback();
 a.setAttribute('aria-label',ar?'رجوع':'Back');
 a.innerHTML=`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ar?'M9 6l6 6-6 6':'M15 6l-6 6 6 6'}"/></svg><span>${ar?'رجوع':'Back'}</span>`;
 a.addEventListener('click',event=>{if(canGoBack()){event.preventDefault();history.back();}});
 bar.append(a);
}
let queued=false;
const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;place();});};
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
addEventListener('popstate',schedule);
schedule();
