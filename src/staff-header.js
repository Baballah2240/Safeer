// D101: the staff workspace header, fixed to the top of the screen: menu and home buttons, a search bar in the
// middle, theme and language buttons, the notification bell and the person's profile.
// Search finds the pages and company sections this person may open, and jumps to a booking or shipment search
// when a reference is typed. Ctrl+K (⌘K on a Mac) moves to the search bar.
const icon=(d,size=20)=>`<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const paths={menu:'M5 8h14M5 16h14',home:'M4 11l8-7 8 7M6 10v10h4v-6h4v6h4V10',search:'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M21 21l-4.3-4.3',sun:'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',moon:'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8',page:'M7 3h7l5 5v13H7zM14 3v5h5',section:'M4 6h16M4 12h16M4 18h10',find:'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M21 21l-4.3-4.3M8 11h6',user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0',out:'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10'};
const bookingRef=/^SF-[2-9A-HJ-NP-Z]{3,8}$/i,shipmentRef=/^(SHP|SPT|RCP)-[0-9]{1,8}$|^SH-[2-9A-HJ-NP-Z]{3,8}$/i;
export const initials=name=>String(name||'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(w=>[...w][0]).join('').toUpperCase()||'?';

export function staffHeader({me,t,e,language,bell}){
 const signedIn=Boolean(me&&!me.mustChangePassword);
 return `<div class="staff-topbar app-masthead staff-header" data-staff-header>
  <div class="staff-header-start"><button type="button" id="staff-menu-toggle" class="secondary sidebar-toggle app-menu-trigger header-icon" aria-label="${e(t('Workspace'))}" aria-controls="staff-ws-nav" aria-expanded="true">${icon(paths.menu)}</button>${signedIn?`<button type="button" id="staff-home" class="secondary header-icon" aria-label="${e(t('Home'))}" title="${e(t('Home'))}">${icon(paths.home)}</button>`:''}<strong class="app-header-name"><img src="/src/brand.svg" width="26" height="26" alt=""><span lang="${language}">${language==='ar'?'سفير':'Safeer'}</span></strong></div>
  ${signedIn?`<div class="staff-search" role="search"><label class="staff-search-box">${icon(paths.search,18)}<span class="list-sr">${e(t('Search pages, bookings or shipments'))}</span><input type="search" id="staff-search-input" autocomplete="off" maxlength="60" placeholder="${e(t('Search pages, bookings or shipments'))}" role="combobox" aria-expanded="false" aria-controls="staff-search-results" aria-autocomplete="list"><kbd aria-hidden="true">${/Mac|iPhone|iPad/.test(navigator.platform)?'⌘K':'Ctrl K'}</kbd></label><ul id="staff-search-results" class="staff-search-results" role="listbox" hidden></ul></div>`:'<div class="staff-search-space"></div>'}
  <div class="staff-header-end"><button type="button" class="secondary header-icon" data-theme-toggle data-theme-icon aria-label="${e(t('Change theme'))}" title="${e(t('Change theme'))}"><span class="theme-icon-dark">${icon(paths.moon)}</span><span class="theme-icon-light">${icon(paths.sun)}</span></button><button type="button" id="staff-language" class="secondary header-icon header-lang" lang="${language==='en'?'ar':'en'}" aria-label="${language==='en'?'العربية':'English'}" title="${language==='en'?'العربية':'English'}">${language==='en'?'ع':'EN'}</button>${signedIn?bell:''}${signedIn?`<div class="staff-header-profile"><button type="button" id="staff-profile" class="secondary staff-profile-button" aria-haspopup="menu" aria-expanded="false" aria-controls="staff-profile-menu"><span class="staff-avatar" aria-hidden="true">${e(initials(me.displayName))}</span><span class="staff-profile-name">${e(me.displayName)}</span></button><div id="staff-profile-menu" class="staff-profile-menu" role="menu" hidden><p><strong>${e(me.displayName)}</strong><small><bdi>${e(me.login||'')}</bdi></small></p><button type="button" role="menuitem" data-profile-open>${icon(paths.user,18)}<span>${e(t('Your profile'))}</span></button><button type="button" role="menuitem" data-profile-logout>${icon(paths.out,18)}<span>${e(t('Sign out'))}</span></button></div></div>`:''}</div>
 </div>`;
}

// targets(): [{label,group,kind,go}] the person may open. lookup(kind,query): opens a booking or shipment search.
export function bindStaffHeader(root,{t,e,targets,lookup,home,openProfile,logout,canLookup}){
 const input=root.querySelector('#staff-search-input'),list=root.querySelector('#staff-search-results');
 root.querySelector('#staff-home')?.addEventListener('click',home);
 // Profile menu.
 const profile=root.querySelector('#staff-profile'),menu=root.querySelector('#staff-profile-menu');
 const closeMenu=(focus)=>{if(!menu||menu.hidden)return;menu.hidden=true;profile.setAttribute('aria-expanded','false');if(focus)profile.focus();};
 profile?.addEventListener('click',()=>{const open=menu.hidden;menu.hidden=!open;profile.setAttribute('aria-expanded',String(open));if(open)menu.querySelector('button')?.focus();});
 menu?.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeMenu(true);}});
 menu?.querySelector('[data-profile-open]').addEventListener('click',()=>{closeMenu();openProfile();});
 menu?.querySelector('[data-profile-logout]').addEventListener('click',()=>{closeMenu();logout();});
 root.addEventListener('click',event=>{if(menu&&!menu.hidden&&!event.target.closest(".staff-header-profile"))closeMenu();});
 if(!input)return;
 // Search.
 let results=[],active=-1;
 const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
 const paint=()=>{
  const q=input.value.trim(),low=q.toLocaleLowerCase();
  if(!q){results=[];close();return;}
  const found=targets().filter(x=>`${x.label} ${x.group||''}`.toLocaleLowerCase().includes(low)).slice(0,8);
  results=[...(bookingRef.test(q)&&canLookup('booking')?[{label:`${t('Find booking')} ${q.toUpperCase()}`,group:t('Bookings'),kind:'find',go:()=>lookup('booking',q.toUpperCase())}]:[]),
   ...(shipmentRef.test(q)&&canLookup('shipment')?[{label:`${t('Find shipment')} ${q.toUpperCase()}`,group:t('Shipments'),kind:'find',go:()=>lookup('shipment',q.toUpperCase())}]:[]),...found];
  active=results.length?0:-1;
  list.innerHTML=results.map((x,i)=>`<li id="staff-search-option-${i}" role="option" aria-selected="${i===active}" data-search-index="${i}">${icon(paths[x.kind]||paths.page,18)}<span><strong>${e(x.label)}</strong>${x.group?`<small>${e(x.group)}</small>`:''}</span></li>`).join('')||`<li class="staff-search-empty" role="option" aria-disabled="true">${e(t('No matching pages'))}</li>`;
  list.hidden=false;input.setAttribute('aria-expanded','true');mark();
 };
 const mark=()=>{list.querySelectorAll('[data-search-index]').forEach(li=>li.setAttribute('aria-selected',String(Number(li.dataset.searchIndex)===active)));if(active>=0){input.setAttribute('aria-activedescendant','staff-search-option-'+active);list.querySelector(`#staff-search-option-${active}`)?.scrollIntoView({block:'nearest'});}};
 const choose=i=>{const x=results[i];if(!x)return;input.value='';close();input.blur();x.go();};
 input.addEventListener('input',paint);
 input.addEventListener('focus',()=>{if(input.value.trim())paint();});
 input.addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'&&results.length){event.preventDefault();active=(active+1)%results.length;mark();}
  else if(event.key==='ArrowUp'&&results.length){event.preventDefault();active=(active-1+results.length)%results.length;mark();}
  else if(event.key==='Enter'){event.preventDefault();if(active>=0)choose(active);}
  else if(event.key==='Escape'){if(!list.hidden){event.preventDefault();close();}else input.blur();}
 });
 list.addEventListener('mousedown',event=>event.preventDefault());
 list.addEventListener('click',event=>{const li=event.target.closest('[data-search-index]');if(li)choose(Number(li.dataset.searchIndex));});
 input.addEventListener('blur',()=>setTimeout(close,120));
}
// Ctrl+K / ⌘K from anywhere in the workspace.
document.addEventListener('keydown',event=>{
 if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==='k'){const input=document.querySelector('#staff-search-input');if(input&&!document.querySelector('dialog[open]')){event.preventDefault();input.focus();input.select();}}
});
