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
