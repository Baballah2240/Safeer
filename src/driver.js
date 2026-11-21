import arCommon from './locales/ar/common.js';
import {intlLocale,nextLanguage,textDir,languageName,lookup,languageOr} from './locales/index.js';
import arDriver from './locales/ar/driver.js';
import enDriverErrors from './locales/en/driver-errors.js';
const ar=arDriver;
const errors=enDriverErrors;
import './app-back.js';
import {shimmer} from './loading.js';
import {DriverCamera} from './driver-camera.js';
import {driverIcon as icon,boardingSummary,filterPassengers,activeTrip,nextStop,passengerRows} from './driver-dashboard.js';
import {loginFormState} from './login-form.js';
import {themeButton,drawerIcon as menuIcon,bindSideDrawer,legalLinks,passwordField,appBanner,appDrawerLink,appVersionLabel,driverUpdateControls} from './theme.js';
const shipmentStatus={received:'Received',loaded:'Loaded',in_transit:'In transit',arrived:'Arrived',delivered:'Delivered',lost:'Lost',exception_reported:'Problem reported'};

const root=document.querySelector('#driver-app');
const signIn=loginFormState();
let language=languageOr(new URL(location.href).searchParams.get('lang'));
let me=null,csrf='',trips=[],selected=null,manifest=null,checked=null,scan='',message='',bad=false,busy=false,epoch=0;
let incident={kind:'delay',note:'',key:crypto.randomUUID()};
let manualNumber='',manualEntryOpen=false,checkedInput=null,ticketRevision=0;
ar.TICKET_WRONG_TRIP=ar['Wrong trip'];
const t=k=>({ar}[language]?.[k])||errors[k]||k;
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=value=>new Intl.DateTimeFormat(intlLocale(language),{dateStyle:'medium',timeStyle:'short',timeZone:manifest?.timezone||selected?.timezone||'Africa/Khartoum'}).format(new Date(value));
const reset=()=>{camera.stop();view='dashboard';passengerQuery='';passengerFilter='all';pendingScan=null;scanResult=null;epoch++;ticketRevision++;me=null;csrf='';trips=[];selected=null;manifest=null;checked=null;checkedInput=null;scan='';manualNumber='';manualEntryOpen=false;incident={kind:'delay',note:'',key:crypto.randomUUID()};};
function invalidateTicket(){ticketRevision++;checked=null;checkedInput=null;root.querySelector('.driver-check')?.remove();}
function checkTicket(input){
 if(busy)return;
 camera.setPaused(true);invalidateTicket();const revision=ticketRevision,currentEpoch=epoch;
 void action(async()=>{const result=await api(path()+'/verify','POST',input);if(revision===ticketRevision&&currentEpoch===epoch){checked=result;checkedInput=input;}});
}
async function api(path,method='GET',data){
 let response,result;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{response=await fetch('/api/v1/'+path,{method,signal:controller.signal,credentials:'same-origin',cache:'no-store',headers:{...(data?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-CSRF-Token':csrf}:{})},...(data?{body:JSON.stringify(data)}:{})});result=await response.json();}catch{throw Error('REQUEST_FAILED');}finally{clearTimeout(timeout);}
 if(!response.ok){if(response.status===401&&path!=='auth/login'){reset();render();}throw Error(result.error?.code||'REQUEST_FAILED');}
 if(result.data.csrfToken)csrf=result.data.csrfToken;return result.data;
}
const path=()=>`driver/companies/${selected.companyId}/trips/${selected.id}`;
async function reload(){
 ticketRevision++;checked=null;checkedInput=null;scan='';manualNumber='';
 const currentEpoch=epoch,rows=await api('driver/trips');if(currentEpoch!==epoch)return;
 trips=rows.items;const previous=selected;selected=trips.find(x=>x.id===previous?.id&&x.companyId===previous?.companyId)||(previous?null:activeTrip(trips));manifest=null;if(!selected){camera.stop();view='dashboard';pendingScan=null;}
 if(selected){const detail=await api(path());if(currentEpoch===epoch)manifest=detail;}
}
async function action(fn){
 if(busy)return;busy=true;message='';bad=false;render();
 try{await fn();}catch(error){message=error.message;bad=true;invalidateTicket();
  // Never leave an old manifest visible after authority or session failures.
  if(['FORBIDDEN','UNAUTHENTICATED'].includes(error.message)){camera.stop();pendingScan=null;scanResult=null;passengerQuery='';passengerFilter='all';view='dashboard';manifest=null;selected=null;trips=[];scan='';}
 }finally{busy=false;render();}
}

let view='dashboard',passengerQuery='',passengerFilter='all',scanResult=null,pendingScan=null,scanRevision=0,scanning=false,cameraState={status:'stopped'};
const camera=new DriverCamera({onCode:boardFromCamera,onState:state=>{cameraState=state;updateScanUI();}});
const cameraLabels={CAMERA_PERMISSION_DENIED:'Camera permission denied. Allow the camera in app settings or enter a printed code.',CAMERA_NOT_FOUND:'No camera found. Enter a printed code.',CAMERA_UNAVAILABLE:'Camera unavailable. Retry or enter a printed code.',CAMERA_DECODER_UNAVAILABLE:'Scanner unavailable. Retry or enter a printed code.',CAMERA_APP_UPDATE_REQUIRED:'Install the new Driver app version to enable camera scanning.',CAMERA_DRIVER_APP_REQUIRED:'Open the Driver app to scan tickets.',CAMERA_TORCH_UNAVAILABLE:'Flashlight unavailable on this camera.'};
function setView(next,push=true){scanRevision++;
 if(next!=='scan'){camera.stop();pendingScan=null;scanResult=null;}view=next;
 const url=new URL(location.href);if(next==='dashboard')url.searchParams.delete('view');else url.searchParams.set('view',next);
 if(push)history.pushState({driverView:next},'',url);else history.replaceState({driverView:next},'',url);
 render();window.scrollTo({top:0,behavior:'instant'});
}
window.addEventListener('popstate',()=>{const next=new URL(location.href).searchParams.get('view');setView(['scan','passengers'].includes(next)?next:'dashboard',false);});
function countLabel(){const x=boardingSummary(manifest);return language==='ar'?x.boarded+' '+t('of')+' '+x.total+' '+t('boarded'):x.boarded+' of '+x.total+' boarded';}
function dashboard(journey){const summary=boardingSummary(manifest),stop=nextStop(manifest),open=manifest.status==='published'&&journey!=='arrived'&&manifest.boardingOpen===true;return `<section class="staff-panel driver-route-card"><div class="driver-eyebrow">Safeer / ${t('Driver app')}</div><div class="driver-route-heading"><h1>${e(language==='ar'?selected.routeAr:selected.routeEn)}</h1><span class="driver-trip-status ${manifest.status==='canceled'?'canceled':''}">${icon(manifest.status==='canceled'?'close':'clock')}${t(manifest.status==='canceled'?'canceled':journey)}</span></div><p>${e(language==='ar'?selected.companyAr:selected.companyEn)} · <bdi>${e(selected.bus)}</bdi></p><div class="driver-departure">${icon('clock')}<span>${t('Departure')}<strong><bdi>${e(when(manifest.departureAt))}</bdi></strong></span></div><div class="driver-metrics"><strong data-board-count>${countLabel()}</strong><span>${t('Boarding progress')}</span></div><progress id="driver-progress" value="${summary.boarded}" max="${summary.total||1}" aria-label="${t('Boarding progress')}"></progress><div class="driver-primary-actions"><button type="button" data-open-scan class="staff-primary driver-scan-button" ${!open||busy?'disabled':''}>${icon('scan')}${t('Scan ticket')}</button><button type="button" data-open-passengers>${icon('people')}${t('Passenger list')}<span data-waiting-count>${summary.waiting} ${t('Waiting')}</span></button></div>${open?'':`<p class="driver-warning">${icon('warning')}${t(manifest.status==='canceled'?'canceled':'Boarding closed')}</p>`}</section><section class="staff-panel driver-next-stop"><span class="driver-stop-icon">${icon('location')}</span><div><small>${t('Next stop')}</small><h2>${stop?e(language==='ar'?stop.nameAr:stop.nameEn):t(journey==='arrived'?'Journey complete':'Not available')}</h2>${stop?.scheduledAt?`<p>${t('Scheduled')} · <bdi>${e(when(stop.scheduledAt))}</bdi></p>`:''}<p>${t('Estimated arrival')} · ${manifest.estimatedArrivalAt?e(when(manifest.estimatedArrivalAt)):t('Not available')}</p></div></section>`;}
function scannerPanel(open){return `<section class="staff-panel driver-camera-panel"><div class="driver-view-heading"><button type="button" data-home aria-label="${t('Back to dashboard')}">${icon('back')}</button><h2>${t('Scan ticket')}</h2><button type="button" data-open-passengers aria-label="${t('Passenger list')}">${icon('people')}</button></div><p class="driver-scanner-route">${e(language==='ar'?selected.routeAr:selected.routeEn)} · <bdi>${e(when(manifest.departureAt))}</bdi></p><p data-board-count>${countLabel()}</p><div class="driver-camera-stage"><video id="driver-camera" autoplay muted playsinline aria-label="${t('Ticket camera')}"></video><div id="driver-scan-frame" aria-hidden="true"><i></i></div><p>${t('Place the QR ticket inside the frame')}</p></div><div id="driver-scan-result" role="status" aria-live="polite" aria-atomic="true"></div><p id="driver-camera-status" role="status"></p><div class="driver-camera-controls"><button type="button" id="driver-camera-start" ${!open?'disabled':''}>${icon('repeat')}${t('Start camera')}</button><button type="button" id="driver-torch" disabled>${icon('flash')}${t('Flashlight')}</button><button type="button" data-manual>${t('Manual code entry')}</button></div><button type="button" id="driver-retry-scan" class="staff-primary" hidden>${t('Retry validation')}</button><p class="driver-camera-note">${t('Ticket checks need an internet connection.')}</p></section>`;}
function passengerPanel(){return `<section class="staff-panel driver-passenger-panel"><div class="driver-view-heading"><button type="button" data-home aria-label="${t('Back to dashboard')}">${icon('back')}</button><h2>${t('Passenger list')}</h2><button type="button" data-open-scan aria-label="${t('Scan ticket')}" ${manifest.boardingOpen!==true?'disabled':''}>${icon('scan')}</button></div><label class="driver-search">${t('Search passengers')}<input id="driver-passenger-search" type="search" value="${e(passengerQuery)}" placeholder="${t('Name, seat or booking code')}" autocomplete="off"></label><div class="driver-passenger-filters" role="group" aria-label="${t('Passenger filter')}">${['all','waiting','boarded'].map(f=>`<button type="button" data-filter="${f}" aria-pressed="${passengerFilter===f}">${t({all:'All',waiting:'Waiting',boarded:'Boarded'}[f])}</button>`).join('')}</div><p id="driver-passenger-count" role="status"></p><div class="staff-table-wrap" tabindex="0" role="region" aria-label="${t('Passenger manifest')}"><table class="staff-table"><thead><tr>${['Seat','Passenger','Ticket','Boarding'].map(x=>`<th scope="col">${t(x)}</th>`).join('')}</tr></thead><tbody id="driver-passenger-rows">${passengerRows(filterPassengers(manifest.passengers,passengerQuery,passengerFilter),{t,e})}</tbody></table></div></section>`;}
function updatePassengers(){if(!manifest)return;const list=filterPassengers(manifest.passengers,passengerQuery,passengerFilter);const rows=root.querySelector('#driver-passenger-rows');if(rows)rows.innerHTML=passengerRows(list,{t,e});const label=root.querySelector('#driver-passenger-count');if(label)label.textContent=list.length?list.length+' '+t('Passengers'):t('No matching passengers.');root.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===passengerFilter)));const summary=boardingSummary(manifest);root.querySelectorAll('[data-board-count]').forEach(n=>n.textContent=countLabel());const progress=root.querySelector('#driver-progress');if(progress){progress.max=summary.total||1;progress.value=summary.boarded;}root.querySelectorAll('[data-waiting-count]').forEach(n=>n.textContent=summary.waiting+' '+t('Waiting'));}
function updateScanUI(){
 const result=root.querySelector('#driver-scan-result');if(result){result.className=scanResult?'driver-scan-result '+scanResult.kind:'';result.innerHTML=scanResult?icon(scanResult.kind==='accepted'?'check':scanResult.kind==='working'?'clock':'warning')+'<strong>'+e(t(scanResult.label))+(scanResult.seat?' · '+t('Seat')+' '+e(scanResult.seat):'')+'</strong>'+(scanResult.journey?'<small class="driver-journey">'+e(scanResult.journey)+'</small>':''):'';}
 const status=root.querySelector('#driver-camera-status');if(status)status.textContent=t(cameraLabels[cameraState.code]||(cameraState.status==='active'?'Ready for the next ticket':cameraState.status==='starting'?'Starting camera…':cameraState.status==='paused'?'Camera paused. Tap Start camera to resume.':'Start camera or enter a printed code.'));
 const start=root.querySelector('#driver-camera-start');if(start)start.hidden=cameraState.status==='starting'||(cameraState.status==='active'&&!camera.paused);
 const torch=root.querySelector('#driver-torch');if(torch){torch.disabled=!cameraState.torchSupported;torch.setAttribute('aria-pressed',String(Boolean(cameraState.torch)));}
 const retry=root.querySelector('#driver-retry-scan');if(retry){retry.hidden=!pendingScan;retry.disabled=scanning;}
}
async function boardFromCamera(token){
 if(scanning||busy||checked||!manifest||!selected||view!=='scan')return;
 if(pendingScan&&pendingScan.token!==token)return;const revision=scanRevision,credential={token},base=path(),currentEpoch=epoch;scanning=true;scanResult={kind:'working',label:'Validating ticket…'};updateScanUI();
 try{
  const result=await api(base+'/board','POST',credential);if(revision!==scanRevision||currentEpoch!==epoch||!selected||path()!==base||view!=='scan')return;
  pendingScan=null;scanResult={kind:result.alreadyBoarded?'warning':'accepted',label:result.alreadyBoarded?'Already scanned':'Ticket accepted',seat:result.seat,journey:result.boardsEn?(language==='ar'?`${result.boardsAr} ← ${result.leavesAr}`:`${result.boardsEn} → ${result.leavesEn}`):''};
  const p=manifest.passengers.find(x=>x.ticket===result.ticket);if(p)p.boardedAt=result.boardedAt;updatePassengers();updateScanUI();
  // Refresh authoritative validity/counts; a failed refresh is retried with the same idempotent ticket.
  const fresh=await api(base);if(revision!==scanRevision||currentEpoch!==epoch||!selected||path()!==base||view!=='scan')return;manifest=fresh;updatePassengers();camera.setPaused(false);
 }catch(error){
  if(revision!==scanRevision||currentEpoch!==epoch||!selected||path()!==base||view!=='scan')return;
  if(['FORBIDDEN','UNAUTHENTICATED'].includes(error.message)){camera.stop();manifest=null;selected=null;trips=[];pendingScan=null;passengerQuery='';passengerFilter='all';view='dashboard';message=error.message;bad=true;render();return;}
  const labels={TICKET_WRONG_TRIP:'Wrong trip',TICKET_INVALID:'Invalid ticket',BOARDING_CLOSED:'Boarding closed',INVALID_INPUT:'Invalid ticket'};
  const retry=!labels[error.message];pendingScan=retry?credential:null;camera.setPaused(retry||error.message==='BOARDING_CLOSED');scanResult={kind:retry?'warning':'error',label:retry?'Validation unavailable. Retry this ticket.':labels[error.message]};
 }finally{scanning=false;updateScanUI();}
}
function bindDashboard(){
 root.querySelectorAll('[data-open-scan]').forEach(b=>b.onclick=()=>{setView('scan');void camera.start();});
 root.querySelectorAll('[data-open-passengers]').forEach(b=>b.onclick=()=>setView('passengers'));
 root.querySelectorAll('[data-home]').forEach(b=>b.onclick=()=>setView('dashboard'));
 root.querySelector('#driver-camera-start')?.addEventListener('click',()=>{void camera.start().then(()=>{camera.setPaused(Boolean(pendingScan||checked));updateScanUI();});});
 root.querySelector('#driver-torch')?.addEventListener('click',()=>void camera.toggleTorch());
 root.querySelector('#driver-retry-scan')?.addEventListener('click',()=>{if(pendingScan)void boardFromCamera(pendingScan.token);});
 root.querySelector('[data-manual]')?.addEventListener('click',()=>{camera.setPaused(true);manualEntryOpen=true;const details=root.querySelector('#driver-manual-entry');if(details)details.open=true;root.querySelector('#driver-manual-ticket input')?.focus();root.querySelector('.driver-manual-panel')?.scrollIntoView({block:'start',behavior:'instant'});});
 root.querySelector('#driver-passenger-search')?.addEventListener('input',ev=>{passengerQuery=ev.target.value;updatePassengers();});
 root.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{passengerFilter=b.dataset.filter;updatePassengers();});updatePassengers();
}

function detail(){
 if(!selected||!manifest)return `<section class="staff-panel driver-empty"><h2>${t('Passenger manifest')}</h2><p>${t('Choose a trip to see its manifest.')}</p></section>`;
 const journey=manifest.events.some(x=>x.event==='arrived')?'arrived':manifest.events.length?'departed':'scheduled';
 const open=manifest.status==='published'&&journey!=='arrived';
 return `<section class="driver-detail" data-view="${view}">${dashboard(journey)}${scannerPanel(open&&manifest.boardingOpen===true)}${journeyPanel()}
 ${open?`<section class="staff-panel driver-manual-panel"><h2>${t('Check ticket')}</h2><p>${t('Use a keyboard scanner. Checking does not board the passenger.')}</p><form id="driver-scan"><label>${t('Scan or paste ticket QR')}<input name="token" dir="ltr" required maxlength="66" autocomplete="off" spellcheck="false" value="${e(scan)}"></label><button class="staff-primary" ${busy?'disabled':''}>${t('Check ticket')}</button></form><details class="driver-manual-entry" id="driver-manual-entry" ${manualEntryOpen?'open':''}><summary>${t('Enter ticket number instead')}</summary><form id="driver-manual-ticket"><label>${t('Printed ticket number')}<input name="ticketNumber" dir="ltr" maxlength="16" pattern="[Tt][Kk][Tt]-[0-9]{8,12}" placeholder="TKT-00000001" autocomplete="off" autocapitalize="characters" spellcheck="false" required value="${e(manualNumber)}"></label><p>${t('Use the number printed on the passenger ticket, for example TKT-00000001.')}</p><button class="staff-primary" ${busy?'disabled':''}>${t('Check ticket')}</button></form></details>${checked?`<div class="driver-check" role="status"><p class="driver-validation-title">${t(checked.boardedAt?'Already boarded':'Ticket valid for this trip')}</p><strong>${e(checked.name||t('Name erased'))}</strong><p>${t('Seat')} <bdi>${e(checked.seat)}</bdi> · <bdi>${e(checked.ticket)}</bdi></p>${checked.boardedAt?`<p>${t('Boarded')} · ${e(when(checked.boardedAt))}</p>`:`<button data-board class="staff-primary" ${busy?'disabled':''}>${t('Confirm boarding')}</button>`}<button data-clear ${busy?'disabled':''}>${t('Clear')}</button></div>`:''}</section>`:''}
 ${passengerPanel()}
 ${(manifest.shipments||[]).length?`<section class="staff-panel"><h2>${t('Shipments on this trip')}</h2><p>${t('Parcels only. The destination office hands them over.')}</p><div class="staff-table-wrap" tabindex="0" role="region" aria-label="${t('Shipments on this trip')}"><table class="staff-table"><thead><tr>${['Shipment','Items','Destination office','Status'].map(x=>`<th scope="col">${t(x)}</th>`).join('')}</tr></thead><tbody>${manifest.shipments.map(x=>`<tr><td><bdi>${e(x.number)}</bdi></td><td><bdi>${e(x.items)}</bdi></td><td>${e(language==='ar'?x.destinationAr:x.destinationEn)}</td><td>${t(shipmentStatus[x.status]||x.status)}</td></tr>`).join('')}</tbody></table></div></section>`:''}
 <section class="staff-panel"><h2>${t('Report incident')}</h2><form id="driver-incident"><label>${t('Incident type')}<select name="kind">${['delay','breakdown','safety','other'].map(k=>`<option value="${k}" ${incident.kind===k?'selected':''}>${t(k)}</option>`).join('')}</select></label><label>${t('Details')}<textarea name="note" required maxlength="500" rows="3">${e(incident.note)}</textarea></label><p>${t('Avoid passenger names and contact details.')}</p><button class="staff-primary" ${busy?'disabled':''}>${t('Report incident')}</button></form><h3>${t('Incidents')}</h3>${manifest.incidents.map(i=>`<article class="driver-incident"><strong>${t(i.kind)}</strong><p>${e(i.note||'')}</p><small><bdi>${e(when(i.at))}</bdi></small></article>`).join('')||`<p>${t('No incidents.')}</p>`}</section></section>`;
}
function driverNavigation(){
 return `<div class="driver-header driver-compact-header app-masthead"><button type="button" id="driver-menu-toggle" class="secondary sidebar-toggle app-menu-trigger" aria-label="${t('Menu')}" aria-haspopup="dialog" aria-controls="driver-menu" aria-expanded="false">${menuIcon('M6 9h12M6 15h12')}</button><strong class="app-header-name"><img src="/src/brand.svg" width="26" height="26" alt=""><span lang="${language}">${lookup({ar:arCommon},language,'Safeer')}</span></strong></div><div data-driver-update-banner>${appBanner(language,'driver')}</div><dialog id="driver-menu" class="market-drawer driver-settings-drawer" data-app-drawer data-app-flavor="driver" aria-labelledby="driver-menu-title"><div class="market-drawer-head"><strong id="driver-menu-title">${t('Settings')}</strong><button type="button" class="secondary app-drawer-close" id="driver-menu-close" aria-label="${t('Close menu')}">${menuIcon('m6 6 12 12M18 6 6 18')}</button></div><section id="driver-settings" aria-labelledby="driver-menu-title"><div class="market-preferences"><div><span>${t('Appearance')}</span>${themeButton(language)}</div><div><span>${t('Language')}</span><button type="button" data-lang id="driver-language" lang="${nextLanguage(language)}" ${busy?'disabled':''}>${languageName(nextLanguage(language))}</button></div></div></section><p class="market-drawer-foot driver-settings-version"><span>${lookup({ar:arCommon},language,'Version')}</span><span class="drawer-version">${appVersionLabel('driver')}</span></p></dialog>`;
}
function render(){
 if(me)signIn.clear();else signIn.capture(root.querySelector('#driver-login'));
 const manualEntry=root.querySelector('#driver-manual-entry');if(manualEntry)manualEntryOpen=manualEntry.open;
 document.documentElement.lang=language;document.documentElement.dir=textDir(language);
 const menuWasOpen=root.querySelector('#driver-menu')?.open,focused=document.activeElement?.id;
 root.innerHTML=`<div class="driver-shell">${driverNavigation()}<main>${me?`<div class="driver-main-actions"><button type="button" data-refresh ${busy?'disabled':''}>${menuIcon('M20 7V3l-4 4M20 7a8 8 0 1 0 0 10')}<span>${t('Refresh')}</span></button><button type="button" data-logout ${busy?'disabled':''}>${menuIcon('M9 21H3V3h6M9 12h12M17 8l4 4-4 4')}<span>${t('Sign out')}</span></button></div>`:''}<div class="driver-message" role="${bad?'alert':'status'}">${message?`<p class="staff-alert ${bad?'bad':''}">${e(t(message))}</p>`:''}${busy?shimmer(language,{compact:Boolean(me)}):''}</div>${!me?`<section class="staff-panel staff-login auth-card"><div class="auth-brand"><img src="/src/brand.svg" alt="" width="48" height="48"><span><strong>Safeer / سفير</strong><small>${t('Driver app')}</small></span></div><h1>${t('Driver sign in')}</h1><p class="auth-lead">${t('Use the account your company manager created for you.')}</p><form id="driver-login" class="auth-form"><label>${t('Email')}<input name="login" type="email" autocomplete="username" required maxlength="254" autocapitalize="none" spellcheck="false"></label>${passwordField(language,t('Password'))}<button class="staff-primary auth-submit" ${busy?'disabled':''}>${t('Sign in')}</button></form><p class="auth-note">${menuIcon('M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6z')}<span>${t('Ticket checks need an internet connection.')}</span></p>${legalLinks(language)}</section>`:me.mustChangePassword?`<section class="staff-panel"><p>${t('Change your temporary password in the company workspace first.')}</p><a class="staff-link" href="/staff?lang=${language}">${t('Company workspace')}</a></section>`:`<div class="driver-layout"><aside class="staff-panel driver-trips" id="driver-trips"><h2>${t('Assigned trips')}</h2>${trips.map(x=>`<button class="driver-trip" data-trip="${e(x.id)}" ${selected?.id===x.id?'aria-current="true"':''} ${busy?'disabled':''}><strong>${e(language==='ar'?x.routeAr:x.routeEn)}</strong><span>${e(language==='ar'?x.companyAr:x.companyEn)}</span><small><bdi>${e(when(x.departureAt))}</bdi></small><span>${t(x.status==='canceled'?'canceled':x.journey)} · <bdi>${e(x.bus)}</bdi></span></button>`).join('')||`<p>${t('No assigned trips. Ask your manager to link your driver record and grant driver access.')}</p>`}</aside>${detail()}</div>`}<details class="driver-app-maintenance"><summary>${lookup({ar:arCommon},language,'App updates')}</summary><div class="driver-maintenance-content">${appDrawerLink(language,'driver')}${driverUpdateControls(language)}</div></details></main></div>`;
 signIn.restore(root.querySelector('#driver-login'));
 bind();
 camera.attach(root.querySelector('#driver-camera'),root.querySelector('#driver-scan-frame'));updateScanUI();
 if(menuWasOpen){root.querySelector('#driver-menu').showModal();root.querySelector('#driver-menu-toggle').setAttribute('aria-expanded','true');}
 if(focused)root.querySelector('#'+CSS.escape(focused))?.focus({preventScroll:true});
}
function bind(){
 bindSideDrawer(root,'driver-menu','driver-menu-toggle','driver-menu-close');bindDashboard();
 root.querySelector('[data-lang]').onclick=()=>{language=nextLanguage(language);const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);render();};
 root.querySelector('#driver-login')?.addEventListener('submit',event=>{event.preventDefault();const values=signIn.begin(event.currentTarget);if(!values)return;void action(async()=>{try{await api('auth/login','POST',values);me=await api('auth/me');if(!me.mustChangePassword)await reload();}finally{signIn.finish(root.querySelector('#driver-login'),!me);}});});
 root.querySelector('[data-logout]')?.addEventListener('click',()=>{root.querySelector('#driver-menu').close();void action(async()=>{await api('auth/logout','POST',{});reset();});});
 root.querySelector('[data-refresh]')?.addEventListener('click',()=>{root.querySelector('#driver-menu').close();void action(reload);});
 root.querySelectorAll('[data-trip]').forEach(button=>button.onclick=()=>{if(incident.note&&!confirm(t('Discard the unsaved incident?')))return;camera.stop();pendingScan=null;scanResult=null;passengerQuery='';passengerFilter='all';setView('dashboard',false);void action(async()=>{selected=trips.find(x=>x.id===button.dataset.trip);manifest=null;checked=null;scan='';incident={kind:'delay',note:'',key:crypto.randomUUID()};await reload();});});
 const scanner=root.querySelector('#driver-scan');
 scanner?.querySelector('input').addEventListener('focus',()=>{camera.setPaused(true);updateScanUI();});
 scanner?.querySelector('input').addEventListener('input',event=>{scan=event.target.value;invalidateTicket();});
 scanner?.addEventListener('submit',event=>{event.preventDefault();scan=scan.trim();checkTicket({token:scan});});
 const manual=root.querySelector('#driver-manual-ticket');
 manual?.querySelector('input').addEventListener('focus',()=>{camera.setPaused(true);updateScanUI();});
 manual?.querySelector('input').addEventListener('input',event=>{manualNumber=event.target.value;invalidateTicket();});
 manual?.addEventListener('submit',event=>{event.preventDefault();manualNumber=manualNumber.trim().toUpperCase();checkTicket({ticketNumber:manualNumber});});
 root.querySelector('[data-clear]')?.addEventListener('click',()=>{const field=checkedInput?.ticketNumber?'#driver-manual-ticket input':'#driver-scan input';invalidateTicket();scan='';manualNumber='';camera.setPaused(Boolean(pendingScan));render();root.querySelector(field)?.focus();});
 root.querySelector('[data-board]')?.addEventListener('click',()=>{if(!checkedInput||!checked)return;const input=checkedInput;void action(async()=>{await api(path()+'/board','POST',input);await reload();camera.setPaused(Boolean(pendingScan));message='Boarding saved.';});});
 root.querySelectorAll('[data-event]').forEach(button=>button.onclick=()=>{
  const kind=button.dataset.event,count=manifest.passengers.filter(x=>x.valid&&!x.boardedAt).length;
  if(!confirm(kind==='departed'?t('Start the trip now? Passengers not boarded yet:')+' '+count:kind==='closed'?t('Close this trip? It cannot be reopened.'):t('Confirm arrival at the destination?')))return;
  void action(async()=>{await api(path()+'/events','POST',{event:kind});await reload();message='Journey event saved.';});
 });
 root.querySelectorAll('[data-stop]').forEach(button=>button.onclick=()=>{
  if(!confirm(t('Confirm arrival at this stop?')))return;
  void action(async()=>{await api(path()+'/stops','POST',{stopIndex:Number(button.dataset.stop)});await reload();message='Stop saved.';});
 });
 const form=root.querySelector('#driver-incident');
 if(form){form.elements.kind.disabled=form.elements.note.disabled=Boolean(incident.locked);}
 form?.addEventListener('input',()=>{if(!incident.locked){incident.kind=form.elements.kind.value;incident.note=form.elements.note.value;}});
 form?.addEventListener('submit',event=>{event.preventDefault();const request={kind:incident.kind,note:incident.note,key:incident.key};incident.locked=true;void action(async()=>{
  try{await api(path()+'/incidents','POST',request);}catch(error){if(['INVALID_INPUT','INVALID_REQUEST','CATALOG_LIMIT','FORBIDDEN'].includes(error.message))incident.locked=false;throw error;}
  incident={kind:'delay',note:'',key:crypto.randomUUID()};await reload();message='Incident saved.';
 });});
}
render();
await action(async()=>{try{me=await api('auth/me');if(!me.mustChangePassword)await reload();}catch(error){if(error.message!=='UNAUTHENTICATED')throw error;}finally{signIn.finish(root.querySelector('#driver-login'));}});

// D122: the journey step by step. Start the trip (passengers may still be missing), mark each stop reached,
// mark the destination reached, then close the trip.
function journeyPanel(){
 const p=manifest.progress||{stops:[]},stops=p.stops||[],last=stops.length-1,live=manifest.status==='published',off=busy?'disabled':'';
 const lastReached=Math.max(0,...stops.filter(s=>s.reachedAt&&s.index<last).map(s=>s.index));
 const place=s=>e(language==='ar'?(s.stationAr?s.cityAr+' · '+s.stationAr:s.cityAr):(s.stationEn?s.cityEn+' · '+s.stationEn:s.cityEn));
 const row=s=>{
  let action='';
  if(live&&!s.reachedAt){
   if(s.index===0)action=`<button class="staff-primary" data-event="departed" ${off}>${t('Start trip')}</button>`;
   else if(p.departedAt&&!p.arrivedAt&&s.index===last)action=`<button class="staff-primary" data-event="arrived" ${off}>${t('Destination reached')}</button>`;
   else if(p.departedAt&&!p.arrivedAt&&s.index>lastReached)action=`<button data-stop="${s.index}" ${off}>${t('Arrived at this stop')}</button>`;
  }
  return `<li class="journey-stop${s.reachedAt?' is-reached':''}"><span class="journey-dot" aria-hidden="true"></span><div><strong>${place(s)}</strong><small>${t('Planned')} <bdi>${e(when(s.plannedAt))}</bdi>${s.reachedAt?` · ${t(s.index===0?'Started':'Reached')} <bdi>${e(when(s.reachedAt))}</bdi>`:''}</small></div>${action}</li>`;
 };
 const close=live&&p.arrivedAt&&!p.closedAt?`<button class="staff-primary journey-close" data-event="closed" ${off}>${t('Close trip')}</button>`:'';
 return `<section class="staff-panel driver-operations"><h2>${t('Journey')}</h2>${p.closedAt?`<p class="journey-closed">${t('Trip closed')} · <bdi>${e(when(p.closedAt))}</bdi></p>`:''}<ol class="journey-steps">${stops.map(row).join('')}</ol>${close}</section>`;
}
