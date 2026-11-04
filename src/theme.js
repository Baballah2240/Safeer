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
export const sidebarButton=(language,id)=>`<button type="button" class="secondary sidebar-toggle" data-sidebar-toggle aria-controls="${id}" aria-expanded="${!sidebarHidden}" aria-label="${sidebarLabel(language)}" title="${sidebarLabel(language)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></svg><span>${sidebarLabel(language)}</span></button>`;
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
document.addEventListener('click',event=>{
  if(!event.target.closest?.('[data-sidebar-toggle]'))return;
  sidebarHidden=!sidebarHidden;
  try{localStorage.setItem(sidebarKey,sidebarHidden?'1':'0');}catch{/* Preserve in-memory preference. */}
  applySidebar();
});
addEventListener('storage',event=>{
  if(event.key!==sidebarKey&&event.key!==null)return;
  sidebarHidden=event.newValue==='1';applySidebar();
});
applySidebar();

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
