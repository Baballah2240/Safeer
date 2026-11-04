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
