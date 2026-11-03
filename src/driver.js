import {themeButton} from './theme.js';

const root=document.querySelector('#driver-app');
const ar={
 'Driver workspace':'مساحة السائق','Company workspace':'مساحة الشركة','Sign in':'تسجيل الدخول','Sign out':'تسجيل الخروج','Email':'البريد الإلكتروني','Password':'كلمة المرور','Refresh':'تحديث','Assigned trips':'الرحلات المعينة','No assigned trips. Ask your manager to link your driver record and grant driver access.':'لا توجد رحلات معينة. اطلب من المدير ربط سجل السائق بحسابك ومنح صلاحية السائق.',
 'Choose a trip to see its manifest.':'اختر رحلة لعرض كشف الركاب.','Local only · Online verification required':'محلي فقط · يلزم الاتصال للتحقق','Loading…':'جار التحميل…','Passenger manifest':'كشف الركاب','Seat':'المقعد','Passenger':'الراكب','Ticket':'التذكرة','Boarding':'الصعود','Boarded':'تم الصعود','Not boarded':'لم يصعد','Invalid ticket':'تذكرة غير صالحة','No passengers yet.':'لا يوجد ركاب بعد.',
 'Check ticket':'فحص التذكرة','Scan or paste ticket QR':'امسح أو الصق رمز التذكرة','Use a keyboard scanner. Checking does not board the passenger.':'استخدم قارئ رموز يعمل كلوحة مفاتيح. الفحص لا يسجل الصعود.','Confirm boarding':'تأكيد الصعود','Clear':'مسح','Boarding saved.':'تم حفظ الصعود.','Journey':'سير الرحلة','Record departure':'تسجيل المغادرة','Record arrival':'تسجيل الوصول','Confirm departure? Remaining valid passengers not boarded:':'تأكيد المغادرة؟ عدد الركاب الصالحين الذين لم يصعدوا:',
 'Confirm arrival?':'تأكيد الوصول؟','Journey event saved.':'تم حفظ حدث الرحلة.','scheduled':'مجدولة','departed':'غادرت','arrived':'وصلت','published':'منشورة','canceled':'ملغاة','Report incident':'تسجيل بلاغ','Incident type':'نوع البلاغ','Details':'التفاصيل','delay':'تأخير','breakdown':'عطل','safety':'سلامة','other':'أخرى','Incident saved.':'تم حفظ البلاغ.','Avoid passenger names and contact details.':'تجنب أسماء الركاب وبيانات الاتصال.','Incidents':'البلاغات','No incidents.':'لا توجد بلاغات.','Name erased':'تم محو الاسم','Change your temporary password in the company workspace first.':'غيّر كلمة المرور المؤقتة في مساحة الشركة أولاً.',
 'UNAUTHENTICATED':'يرجى تسجيل الدخول.','INVALID_CREDENTIALS':'بيانات الدخول غير صحيحة.','FORBIDDEN':'لا تملك صلاحية هذه الرحلة.','TICKET_INVALID':'التذكرة غير صالحة لهذه الرحلة أو تم رد قيمتها أو إلغاؤها.','BOARDING_CLOSED':'الصعود مغلق. يفتح قبل 24 ساعة من المغادرة ويغلق عند المغادرة الفعلية أو الوصول المجدول.','JOURNEY_STATE':'لا يمكن تسجيل هذه الخطوة الآن. لا يمكن المغادرة قبل الموعد والوصول يتطلب تسجيل المغادرة.','REQUEST_FAILED':'تعذر تأكيد الطلب. حدّث البيانات أو أعد المحاولة.','RATE_LIMITED':'طلبات كثيرة. انتظر ثم أعد المحاولة.','PASSWORD_CHANGE_REQUIRED':'غيّر كلمة المرور المؤقتة أولاً.','INVALID_INPUT':'تحقق من البيانات المدخلة.','IDEMPOTENCY_CONFLICT':'هذا الطلب سبق استخدامه بتفاصيل مختلفة.','CATALOG_LIMIT':'تم الوصول إلى الحد المسموح.','Saved':'محفوظ',
};
const errors={TICKET_INVALID:'This ticket is invalid for this trip, refunded or canceled.',BOARDING_CLOSED:'Boarding opens 24 hours before departure and closes at actual departure or scheduled arrival.',JOURNEY_STATE:'This step is unavailable. Departure must wait for its scheduled time; arrival requires departure.',FORBIDDEN:'You no longer have access to this trip.',REQUEST_FAILED:'The request could not be confirmed. Refresh or retry.',INVALID_CREDENTIALS:'The sign-in details are incorrect.'};
Object.assign(ar,{'Discard the unsaved incident?':'تجاهل البلاغ غير المحفوظ؟'});
Object.assign(errors,{UNAUTHENTICATED:'Sign in to continue.',INVALID_INPUT:'Check the information entered.',RATE_LIMITED:'Too many requests. Wait a moment and retry.',PASSWORD_CHANGE_REQUIRED:'Change your temporary password first.',IDEMPOTENCY_CONFLICT:'This request was already used with different details.',CATALOG_LIMIT:'The allowed capacity has been reached.'});
let language=new URL(location.href).searchParams.get('lang')==='ar'?'ar':'en';
let me=null,csrf='',trips=[],selected=null,manifest=null,checked=null,scan='',message='',bad=false,busy=false,epoch=0;
let incident={kind:'delay',note:'',key:crypto.randomUUID()};
const t=k=>language==='ar'?(ar[k]||k):(errors[k]||k);
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=value=>new Intl.DateTimeFormat(language==='ar'?'ar-SD':'en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Khartoum'}).format(new Date(value));
const reset=()=>{epoch++;me=null;csrf='';trips=[];selected=null;manifest=null;checked=null;scan='';incident={kind:'delay',note:'',key:crypto.randomUUID()};};
async function api(path,method='GET',data){
 let response,result;
 try{response=await fetch('/api/v1/'+path,{method,credentials:'same-origin',cache:'no-store',headers:{...(data?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-CSRF-Token':csrf}:{})},...(data?{body:JSON.stringify(data)}:{})});result=await response.json();}catch{throw Error('REQUEST_FAILED');}
 if(!response.ok){if(response.status===401){reset();render();}throw Error(result.error?.code||'REQUEST_FAILED');}
 if(result.data.csrfToken)csrf=result.data.csrfToken;return result.data;
}
const path=()=>`driver/companies/${selected.companyId}/trips/${selected.id}`;
async function reload(){
 checked=null;scan='';
 const currentEpoch=epoch,rows=await api('driver/trips');if(currentEpoch!==epoch)return;
 trips=rows.items;selected=trips.find(x=>x.id===selected?.id&&x.companyId===selected?.companyId)||null;manifest=null;
 if(selected){const detail=await api(path());if(currentEpoch===epoch)manifest=detail;}
}
async function action(fn){
 if(busy)return;busy=true;message='';bad=false;render();
 try{await fn();}catch(error){message=error.message;bad=true;checked=null;
  // Never leave an old manifest visible after authority or session failures.
  if(['FORBIDDEN','UNAUTHENTICATED'].includes(error.message)){manifest=null;selected=null;trips=[];scan='';}
 }finally{busy=false;render();}
}
function detail(){
 if(!selected||!manifest)return `<section class="staff-panel driver-empty"><h2>${t('Passenger manifest')}</h2><p>${t('Choose a trip to see its manifest.')}</p></section>`;
 const journey=manifest.events.some(x=>x.event==='arrived')?'arrived':manifest.events.length?'departed':'scheduled';
 const valid=manifest.passengers.filter(x=>x.valid),boarded=valid.filter(x=>x.boardedAt).length,open=manifest.status==='published'&&journey==='scheduled';
 return `<section class="driver-detail"><section class="staff-panel"><header class="staff-section-head"><div><h1>${e(language==='ar'?selected.routeAr:selected.routeEn)}</h1><p>${e(language==='ar'?selected.companyAr:selected.companyEn)} · <bdi>${e(selected.bus)}</bdi></p></div><span class="staff-badge">${t(manifest.status==='canceled'?'canceled':journey)}</span></header><p><bdi>${e(when(manifest.departureAt))}</bdi> — <bdi>${e(when(manifest.arrivalAt))}</bdi></p><div class="driver-metrics"><strong>${boarded} / ${valid.length}</strong><span>${t('Boarded')}</span></div><div class="staff-actions">${open?`<button data-event="departed" ${busy?'disabled':''}>${t('Record departure')}</button>`:''}${manifest.status==='published'&&journey==='departed'?`<button data-event="arrived" ${busy?'disabled':''}>${t('Record arrival')}</button>`:''}</div>${manifest.events.map(x=>`<p>${t(x.event)} · <bdi>${e(when(x.at))}</bdi></p>`).join('')}</section>
 ${open?`<section class="staff-panel"><h2>${t('Check ticket')}</h2><p>${t('Use a keyboard scanner. Checking does not board the passenger.')}</p><form id="driver-scan"><label>${t('Scan or paste ticket QR')}<input name="token" dir="ltr" required maxlength="66" autocomplete="off" spellcheck="false" value="${e(scan)}"></label><button class="staff-primary" ${busy?'disabled':''}>${t('Check ticket')}</button></form>${checked?`<div class="driver-check" role="status"><strong>${e(checked.name||t('Name erased'))}</strong><p>${t('Seat')} <bdi>${e(checked.seat)}</bdi> · <bdi>${e(checked.ticket)}</bdi></p>${checked.boardedAt?`<p>${t('Boarded')} · ${e(when(checked.boardedAt))}</p>`:`<button data-board class="staff-primary" ${busy?'disabled':''}>${t('Confirm boarding')}</button>`}<button data-clear ${busy?'disabled':''}>${t('Clear')}</button></div>`:''}</section>`:''}
 <section class="staff-panel"><h2>${t('Passenger manifest')}</h2><div class="staff-table-wrap" tabindex="0" role="region" aria-label="${t('Passenger manifest')}"><table class="staff-table"><thead><tr>${['Seat','Passenger','Ticket','Boarding'].map(x=>`<th scope="col">${t(x)}</th>`).join('')}</tr></thead><tbody>${manifest.passengers.map(p=>`<tr><td><bdi>${e(p.seat)}</bdi></td><td>${e(p.name||t('Name erased'))}</td><td><bdi>${e(p.ticket)}</bdi></td><td>${!p.valid?t('Invalid ticket'):p.boardedAt?t('Boarded'):t('Not boarded')}</td></tr>`).join('')}</tbody></table></div>${manifest.passengers.length?'':`<p>${t('No passengers yet.')}</p>`}</section>
 <section class="staff-panel"><h2>${t('Report incident')}</h2><form id="driver-incident"><label>${t('Incident type')}<select name="kind">${['delay','breakdown','safety','other'].map(k=>`<option value="${k}" ${incident.kind===k?'selected':''}>${t(k)}</option>`).join('')}</select></label><label>${t('Details')}<textarea name="note" required maxlength="500" rows="3">${e(incident.note)}</textarea></label><p>${t('Avoid passenger names and contact details.')}</p><button class="staff-primary" ${busy?'disabled':''}>${t('Report incident')}</button></form><h3>${t('Incidents')}</h3>${manifest.incidents.map(i=>`<article class="driver-incident"><strong>${t(i.kind)}</strong><p>${e(i.note||'')}</p><small><bdi>${e(when(i.at))}</bdi></small></article>`).join('')||`<p>${t('No incidents.')}</p>`}</section></section>`;
}
function render(){
 document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';
 root.innerHTML=`<div class="driver-shell"><header class="driver-header"><a class="driver-brand" href="/driver"><img src="/src/brand.svg" alt=""><span>Safeer / سفير<small>${t('Driver workspace')}</small></span></a><nav aria-label="${t('Driver workspace')}">${themeButton(language)}<button data-lang ${busy?'disabled':''}>${language==='ar'?'English':'العربية'}</button><a class="staff-link" href="/staff?tab=notifications&lang=${language}">${language==='ar'?'الإشعارات':'Notifications'}</a><a class="staff-link" href="/staff?lang=${language}">${t('Company workspace')}</a>${me?`<button data-refresh ${busy?'disabled':''}>${t('Refresh')}</button><button data-logout ${busy?'disabled':''}>${t('Sign out')}</button>`:''}</nav></header><main><p class="driver-local">${t('Local only · Online verification required')}</p><div class="driver-message" role="${bad?'alert':'status'}">${message?`<p class="staff-alert ${bad?'bad':''}">${e(t(message))}</p>`:''}${busy?`<p>${t('Loading…')}</p>`:''}</div>${!me?`<section class="staff-panel staff-login"><h1>${t('Driver workspace')}</h1><form id="driver-login"><label>${t('Email')}<input name="login" type="email" autocomplete="username" required maxlength="254"></label><label>${t('Password')}<input name="password" type="password" autocomplete="current-password" required maxlength="128"></label><button class="staff-primary" ${busy?'disabled':''}>${t('Sign in')}</button></form></section>`:me.mustChangePassword?`<section class="staff-panel"><p>${t('Change your temporary password in the company workspace first.')}</p></section>`:`<div class="driver-layout"><aside class="staff-panel driver-trips"><h2>${t('Assigned trips')}</h2>${trips.map(x=>`<button class="driver-trip" data-trip="${e(x.id)}" ${selected?.id===x.id?'aria-current="true"':''} ${busy?'disabled':''}><strong>${e(language==='ar'?x.routeAr:x.routeEn)}</strong><span>${e(language==='ar'?x.companyAr:x.companyEn)}</span><small><bdi>${e(when(x.departureAt))}</bdi></small><span>${t(x.status==='canceled'?'canceled':x.journey)} · <bdi>${e(x.bus)}</bdi></span></button>`).join('')||`<p>${t('No assigned trips. Ask your manager to link your driver record and grant driver access.')}</p>`}</aside>${detail()}</div>`}</main></div>`;
 bind();
}
function bind(){
 root.querySelector('[data-lang]').onclick=()=>{language=language==='en'?'ar':'en';const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);render();};
 root.querySelector('#driver-login')?.addEventListener('submit',event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget));void action(async()=>{await api('auth/login','POST',values);me=await api('auth/me');if(!me.mustChangePassword)await reload();});});
 root.querySelector('[data-logout]')?.addEventListener('click',()=>void action(async()=>{await api('auth/logout','POST',{});reset();}));
 root.querySelector('[data-refresh]')?.addEventListener('click',()=>void action(reload));
 root.querySelectorAll('[data-trip]').forEach(button=>button.onclick=()=>{if(incident.note&&!confirm(t('Discard the unsaved incident?')))return;void action(async()=>{selected=trips.find(x=>x.id===button.dataset.trip);manifest=null;checked=null;scan='';incident={kind:'delay',note:'',key:crypto.randomUUID()};await reload();});});
 const scanner=root.querySelector('#driver-scan');
 scanner?.querySelector('input').addEventListener('input',event=>{scan=event.target.value;checked=null;root.querySelector('.driver-check')?.remove();});
 scanner?.addEventListener('submit',event=>{event.preventDefault();void action(async()=>{const value=scan.trim();checked=await api(path()+'/verify','POST',{token:value});scan=value;});});
 root.querySelector('[data-clear]')?.addEventListener('click',()=>{checked=null;scan='';render();root.querySelector('#driver-scan input')?.focus();});
 root.querySelector('[data-board]')?.addEventListener('click',()=>void action(async()=>{await api(path()+'/board','POST',{token:scan});await reload();message='Boarding saved.';}));
 root.querySelectorAll('[data-event]').forEach(button=>button.onclick=()=>{
  const kind=button.dataset.event,count=manifest.passengers.filter(x=>x.valid&&!x.boardedAt).length;
  if(!confirm(kind==='departed'?t('Confirm departure? Remaining valid passengers not boarded:')+' '+count:t('Confirm arrival?')))return;
  void action(async()=>{await api(path()+'/events','POST',{event:kind});await reload();message='Journey event saved.';});
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
await action(async()=>{try{me=await api('auth/me');if(!me.mustChangePassword)await reload();}catch(error){if(error.message!=='UNAUTHENTICATED')throw error;}});
