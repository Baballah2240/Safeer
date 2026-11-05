const storageKey='safeer.theme';
const valid=value=>value==='light'||value==='dark';
let theme='dark';
try{const saved=localStorage.getItem(storageKey);if(valid(saved))theme=saved;}catch{/* Storage restrictions must not prevent access. */}

const label=language=>language==='ar'
  ?(theme==='dark'?'الوضع الفاتح':'الوضع الداكن')
  :(theme==='dark'?'Light mode':'Dark mode');

function apply(){
  document.documentElement.dataset.theme=theme;
  document.querySelectorAll('[data-theme-toggle]').forEach(button=>{
    button.textContent=label(document.documentElement.lang);
  });
}

export const themeButton=language=>`<button type="button" class="secondary theme-toggle" data-theme-toggle>${label(language)}</button>`;

// Delegation avoids losing form values or focus when the theme changes.
document.addEventListener('click',event=>{
  if(!event.target.closest?.('[data-theme-toggle]'))return;
  theme=theme==='dark'?'light':'dark';
  try{localStorage.setItem(storageKey,theme);}catch{/* Keep this tab functional without persistence. */}
  apply();
});
addEventListener('storage',event=>{
  if(event.key!==storageKey&&event.key!==null)return;
  theme=valid(event.newValue)?event.newValue:'dark';apply();
});
apply();

const sidebarKey='safeer.sidebar.hidden';
let sidebarHidden=false;
try{sidebarHidden=localStorage.getItem(sidebarKey)==='1';}catch{/* Layout remains usable without storage. */}
const sidebarLabel=language=>language==='ar'
  ?(sidebarHidden?'إظهار القائمة الجانبية':'إخفاء القائمة الجانبية')
  :(sidebarHidden?'Show sidebar':'Hide sidebar');
export const sidebarButton=(language,id)=>`<button type="button" class="secondary sidebar-toggle" data-sidebar-toggle aria-controls="${id}" aria-expanded="${!sidebarHidden}" aria-label="${sidebarLabel(language)}" title="${sidebarLabel(language)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M6 9h12M6 15h12"/></svg><span>${sidebarLabel(language)}</span></button>`;
function applySidebar(){
  document.documentElement.dataset.sidebarHidden=String(sidebarHidden);
  document.querySelectorAll('[data-sidebar-toggle]').forEach(button=>{
    // A cross-tab change must not leave focus in navigation that becomes hidden.
    const sidebar=document.getElementById(button.getAttribute('aria-controls'));
    if(sidebarHidden&&sidebar?.contains(document.activeElement))button.focus();
    const text=sidebarLabel(document.documentElement.lang);
    button.setAttribute('aria-expanded',String(!sidebarHidden));
    button.setAttribute('aria-label',text);button.title=text;
    button.querySelector('span').textContent=text;
  });
}
// Slide the sidebar out/in and glide the content into place (FLIP). Reduced motion snaps.
let sidebarMoving=false;
const sidebarEase='cubic-bezier(.22,1,.36,1)';
async function toggleSidebar(button){
  const sidebar=document.getElementById(button.getAttribute('aria-controls'));
  const shell=sidebar?.closest('.staff-shell,.shell');
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches||!sidebar?.animate;
  const save=()=>{try{localStorage.setItem(sidebarKey,sidebarHidden?'1':'0');}catch{/* Preserve in-memory preference. */}};
  if(still||!shell){sidebarHidden=!sidebarHidden;save();applySidebar();return;}
  sidebarMoving=true;
  const away=(document.documentElement.dir==='rtl'?1:-1)*48+'px';
  const content=[...shell.children].filter(node=>!node.contains(sidebar));
  const before=content.map(node=>node.getBoundingClientRect());
  const out=[{opacity:1,transform:'none',filter:'blur(0)'},{opacity:0,transform:`translateX(${away}) scale(.96)`,filter:'blur(6px)'}];
  try{
    if(!sidebarHidden)await sidebar.animate(out,{duration:240,easing:'cubic-bezier(.4,0,1,1)'}).finished;
    sidebarHidden=!sidebarHidden;save();applySidebar();
    content.forEach((node,i)=>{
      const after=node.getBoundingClientRect(),dx=before[i].left-after.left;
      if(Math.abs(dx)>1)node.animate([{transform:`translateX(${dx}px)`},{transform:'none'}],{duration:420,easing:sidebarEase});
    });
    if(!sidebarHidden)await sidebar.animate([...out].reverse(),{duration:380,easing:sidebarEase}).finished;
  }catch{/* An interrupted animation leaves the final state applied. */}
  finally{sidebarMoving=false;}
}
document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-sidebar-toggle]');
  if(!button||sidebarMoving)return;
  void toggleSidebar(button);
});
addEventListener('storage',event=>{
  if(event.key!==sidebarKey&&event.key!==null)return;
  sidebarHidden=event.newValue==='1';applySidebar();
});
applySidebar();

// Shared modal navigation: no page re-render when opening or closing a drawer.
export const drawerIcon=path=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
export function bindSideDrawer(root,id,triggerId,closeId){
  const menu=root.querySelector('#'+id),toggle=root.querySelector('#'+triggerId);
  toggle.onclick=()=>{menu.showModal();toggle.setAttribute('aria-expanded','true');};
  root.querySelector('#'+closeId).onclick=()=>menu.close();
  menu.addEventListener('close',()=>{toggle.setAttribute('aria-expanded','false');toggle.focus({preventScroll:true});});
  menu.addEventListener('click',event=>{if(event.target!==menu)return;const r=menu.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)menu.close();});
  menu.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',()=>menu.close()));
}

// App renders replace their header nodes. Follow the current one so keyboard
// focus and scrollIntoView clear the actual wrapped height at every viewport.
if(typeof ResizeObserver==='function'){
  let header;
  const sizes=new ResizeObserver(entries=>{
    const height=Math.ceil(entries[0].target.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--sticky-header-height',height+'px');
  });
  const followHeader=()=>{
    const current=document.querySelector('.staff-topbar,.driver-header,.market-bar,.topbar');
    if(current===header)return;
    sizes.disconnect();header=current;
    if(header)sizes.observe(header);
  };
  const renders=new MutationObserver(followHeader);
  renders.observe(document.body,{childList:true,subtree:true});
  followHeader();
}

// Layout motion. Only transform/opacity animate, so text, data and controls stay untouched.
const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const tiles='.staff-welcome,.staff-summary article,.staff-shortcuts button,.staff-panel,.staff-record,.metric,.panel,.market-band,.market-trip,.market-card,.market-companies article,.driver-trip,.driver-detail>*';
let viewKey='';
function revealView(){
  // Replays only when the page or section heading changes, not on ordinary refreshes.
  const heading=document.querySelector('.staff-topbar strong,.topbar h1,main h1,.market-band h1,.driver-header strong');
  const key=location.pathname+location.search+'|'+(heading?.textContent||'')+'|'+(document.querySelector('[aria-current=page]')?.textContent||'');
  if(key===viewKey)return;viewKey=key;
  if(calm()||!document.body.animate)return;
  [...document.querySelectorAll(tiles)].filter(node=>node.getBoundingClientRect().top<innerHeight&&!node.querySelector('.market-seats,.trip-seat-map,.seat-map,.bus')).slice(0,24).forEach((node,i)=>{
    node.animate([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:460,delay:Math.min(i*38,420),easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});
  });
}
let revealQueued=false;
new MutationObserver(()=>{if(revealQueued)return;revealQueued=true;requestAnimationFrame(()=>{revealQueued=false;revealView();});}).observe(document.body,{childList:true,subtree:true});
revealView();

// Stronger header glass once the page scrolls under it.
const markScroll=()=>document.documentElement.classList.toggle('page-scrolled',scrollY>8);
addEventListener('scroll',markScroll,{passive:true});markScroll();

// Soft ripple from the press point on buttons (not seats, whose colours carry meaning).
document.addEventListener('pointerdown',event=>{
  const button=event.target.closest?.('button:not(:disabled):not(.seat):not(.market-seat):not(.trip-seat),.workspace-link,.market-book');
  if(!button||calm()||!button.animate)return;
  const box=button.getBoundingClientRect(),size=Math.max(box.width,box.height)*2,dot=document.createElement('span');
  dot.className='press-ripple';dot.setAttribute('aria-hidden','true');
  dot.style.cssText=`width:${size}px;height:${size}px;left:${event.clientX-box.left-size/2}px;top:${event.clientY-box.top-size/2}px`;
  button.append(dot);
  dot.animate([{transform:'scale(0)',opacity:.35},{transform:'scale(1)',opacity:0}],{duration:520,easing:'ease-out'}).finished.finally(()=>dot.remove());
});

// Store-required notices shown wherever someone signs in or gives personal details.
export const legalLinks=language=>{
  const ar=language==='ar',q='?lang='+(ar?'ar':'en');
  return `<p class="legal-links"><a href="/privacy${q}">${ar?'سياسة الخصوصية':'Privacy policy'}</a><span aria-hidden="true"> · </span><a href="/account-deletion${q}">${ar?'حذف الحساب والبيانات':'Delete account and data'}</a></p>`;
};
