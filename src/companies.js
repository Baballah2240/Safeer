import {financeView,bindFinance,resetFinance} from './finance.js';
import {routesView,bindRoutes} from './routes.js';
import {fleetView,bindFleet,driversView,bindDrivers} from './fleet.js';
import {tripsView,bindTrips} from './trips.js';
import {publicPageView,bindPublicPage} from './public-page.js';
import {bookingsView,bindBookings,openBookingNext} from './bookings.js';
import {luggageView,bindLuggage,resetLuggage} from './luggage.js';
import {shipmentsView,bindShipments,resetShipments} from './shipments.js';
import {operationsView,bindOperations,resetOperations} from './operations.js';
import {stationView,bindStation,resetStation} from './station.js';
export const companyState={id:'',section:'operations'};
export function resetCompanies(){resetFinance();companyState.id='';companyState.section='operations';openBookingNext(null);resetLuggage();resetShipments();resetOperations();resetStation();}
export async function loadCompanies(api){
  const list=await api('companies');
  if(companyState.id&&!list.items.some(c=>c.id===companyState.id))resetCompanies();
  if(!companyState.id&&list.items.length===1&&!list.canCreate)companyState.id=list.items[0].id;
  if(!companyState.id)return list;
  const workspace=await api('companies/'+companyState.id);
  if(workspace.capabilities.routesRead)workspace.routeCatalog=await api('companies/'+companyState.id+'/routes');
  if(workspace.capabilities.fleetRead)workspace.fleet=await api('companies/'+companyState.id+'/fleet');
  if(workspace.capabilities.driversRead)workspace.driverCatalog=await api('companies/'+companyState.id+'/drivers');
  if(workspace.capabilities.tripsRead)workspace.tripCatalog=await api('companies/'+companyState.id+'/trips');
  if(workspace.capabilities.profile)workspace.publicProfile=await api('companies/'+companyState.id+'/public-profile');
  return {...workspace,selectionCount:list.items.length,canCreate:list.canCreate};
}

export function companyView(data,{t,e,language}){
  const name=r=>e(language==='ar'?r.nameAr:r.nameEn);
  const badge=label=>`<span class="staff-badge">${e(t(label))}</span>`;
  const button=(attr,label)=>`<button type="button" ${attr}>${t(label)}</button>`;
  if(!data.company)return `<section class="staff-panel"><header class="staff-section-head"><div><h1>${t('Companies')}</h1><p>${t('Only companies you are authorized to access appear here.')}</p></div>${data.canCreate?button('data-company-create class="staff-primary"','Create company'):''}</header><div class="staff-grid">${data.items.map(c=>`<article class="staff-record"><strong>${name(c)}</strong><p><bdi>${e(c.slug)}</bdi></p>${badge(c.status)}<div class="staff-actions">${button(`data-company-open="${c.id}"`,'Open company')}</div></article>`).join('')||`<p>${t('No company access assigned.')}</p>`}</div></section>`;
  const c=data.company,cap=data.capabilities;
  const when=value=>new Intl.DateTimeFormat(language==='ar'?'ar-SD':'en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:c.timezone}).format(new Date(value));
  const sections=companySections(cap);
  if(!sections.some(([id])=>id===companyState.section))companyState.section=sections[0][0];
  const title=`<header class="staff-welcome"><div><p class="staff-eyebrow">${t('Company workspace')}</p><h1>${name(c)}</h1><p>${t('Your access is limited to your assigned company and resources.')}</p></div><div class="staff-actions">${badge(c.status)}${data.selectionCount>1||data.canCreate?button('data-company-back','All companies'):''}</div></header>`;
  const branch=id=>data.branches.find(b=>b.id===id),station=id=>data.stations.find(s=>s.id===id);
  const assignment=a=>`${e(t(data.roles.find(r=>r.id===a.roleId)?.displayName||'Company roles'))}${a.branchId?' · '+(branch(a.branchId)?name(branch(a.branchId)):t('branch')):''}${a.stationId?' / '+(station(a.stationId)?name(station(a.stationId)):t('station')):''}`;
  let content='';
  if(companyState.section==='overview')content=`<div class="staff-summary">${[['Visible branches',data.branches.length],['Visible stations',data.stations.length],['Visible staff',data.members.length]].map(([label,count])=>`<article><span>${t(label)}</span><strong>${count}</strong></article>`).join('')}</div><section class="staff-panel"><header class="staff-section-head"><h2>${t('Company profile')}</h2>${cap.profile?button('data-company-edit','Edit company'):''}</header><dl class="company-details">${[['Company slug',c.slug],['Contact email',c.contactEmail||'—'],['Phone',c.phone||'—'],['Address',c.address||'—'],['Hold duration (minutes)',c.holdMinutes],['Timezone',c.timezone],['Default language',t(c.locale==='ar'?'Arabic':'English')]].map(([label,value])=>`<div><dt>${t(label)}</dt><dd><bdi>${e(value)}</bdi></dd></div>`).join('')}</dl><p class="staff-muted">${t('Company settings are saved. Real bookings and payments come in later sections.')}</p></section>`;
  if(companyState.section==='resources')content=`<div class="company-sections">${['branches','stations'].map(kind=>`<section class="staff-panel"><header class="staff-section-head"><h2>${t(kind==='branches'?'Branches':'Stations')}</h2>${(kind==='branches'?cap.branchCreate:cap.managedBranches.length>0)?button(`data-resource-create="${kind}"`,kind==='branches'?'Add branch':'Add station'):''}</header><div class="staff-grid">${data[kind].map(r=>`<article class="staff-record"><strong>${name(r)}</strong><p><bdi>${e(r.code)}</bdi>${r.branchId&&branch(r.branchId)?' · '+name(branch(r.branchId)):''}</p>${badge(r.active?'Active':'Inactive')}${kind==='stations'?`<p>${t('City')}: ${r.cityId&&data.cities.find(c=>c.id===r.cityId)?name(data.cities.find(c=>c.id===r.cityId)):t('Not assigned')}</p>`:''}<div class="staff-actions">${r.canEdit?button(`data-resource-edit="${kind}:${r.id}"`,'Edit'):''}</div></article>`).join('')||`<p>${t('No records to show.')}</p>`}</div></section>`).join('')}</div>`;
  if(companyState.section==='routes')content=routesView(data,{t,e,language});
  if(companyState.section==='fleet')content=fleetView(data,{t,e,language});
  if(companyState.section==='drivers')content=driversView(data,{t,e,language});
  if(companyState.section==='trips')content=tripsView(data,{t,e,language});
  if(companyState.section==='bookings')content=bookingsView(data,{t,e,language});
  if(companyState.section==='operations')return content=operationsView(data,{t,e,language}),`<p class="ops-company"><span>${name(c)}</span>${badge(c.status)}${data.selectionCount>1||data.canCreate?button('data-company-back class="secondary"','All companies'):''}</p>`+content;
  if(companyState.section==='luggage')content=luggageView(data,{t,e,language});
  if(companyState.section==='shipments')content=shipmentsView(data,{t,e,language});
  if(companyState.section==='finance')content=financeView(data,{t,e,language});
  if(companyState.section==='station')content=stationView(data,{t,e,language});
  if(companyState.section==='public')content=publicPageView(data,{t,e,language});
  if(companyState.section==='members')content=`<section class="staff-panel"><header class="staff-section-head"><div><h2>${t('Company staff')}</h2><p>${t('Membership changes affect this company only.')}</p></div>${cap.memberCreate?button('data-member-create class="staff-primary"','Add staff member'):''}</header><div class="staff-grid staff-user-grid">${data.members.map(m=>`<article class="staff-record"><strong>${e(m.displayName)}</strong>${m.jobTitle?`<p class="staff-muted">${e(m.jobTitle)}</p>`:''}<p><bdi>${e(m.login)}</bdi>${m.phone?` · <bdi>${e(m.phone)}</bdi>`:''}</p>${badge(m.active&&m.accountActive?'Active':'Inactive')}<div class="staff-permissions">${m.assignments.map(a=>`<span class="staff-badge">${assignment(a)}</span>`).join('')}</div><div class="staff-actions">${m.canEdit&&cap.memberCreate?button(`data-member-edit="${m.id}"`,'Edit membership'):''}</div></article>`).join('')||`<p>${t('No records to show.')}</p>`}</div></section>`;
  if(companyState.section==='roles')content=`<section class="staff-panel"><header class="staff-section-head"><div><h2>${t('Company roles')}</h2><p>${t('These roles belong to this company. Scope stays fixed after creation.')}</p></div>${cap.roleManage?button('data-company-role-create','Create role'):''}</header><div class="staff-grid">${data.roles.map(r=>`<article class="staff-record"><strong>${e(t(r.displayName))}</strong><p>${t('Scope')}: ${t(r.scope)}</p>${badge(r.active?'Active':'Inactive')}<div class="staff-permissions">${r.permissions.map(p=>badge(p)).join('')||t('No permissions assigned')}</div><div class="staff-actions">${cap.roleManage?button(`data-company-role-edit="${r.id}"`,'Edit role'):''}</div></article>`).join('')}</div></section>`;
  if(companyState.section==='support')content=`<section class="staff-panel"><header class="staff-section-head"><div><h2>${t('Support access')}</h2><p>${t('Read-only access with a recorded reason, expiry and revocation. No financial access.')}</p></div>${cap.supportManage?button('data-support-create','Grant support access'):''}</header><div class="staff-grid">${data.grants.map(g=>`<article class="staff-record"><strong><bdi>${e(g.login)}</bdi></strong><p>${e(g.reason)}</p>${badge(g.revokedAt?'Revoked':g.active?'Active':'Expired')}<p>${t('Expires')}: ${e(when(g.expiresAt))}</p><div class="staff-permissions">${g.permissions.map(badge).join('')}</div><div class="staff-actions">${cap.supportManage&&g.active?button(`data-support-revoke="${g.id}"`,'Revoke access'):''}</div></article>`).join('')||`<p>${t('No support grants.')}</p>`}</div></section>`;
  if(companyState.section==='audit')content=`<section class="staff-panel"><h2>${t('Company audit')}</h2><p>${t('Latest 100 company events in your permitted scope.')}</p><div class="staff-table-wrap"><table class="staff-table"><thead><tr>${['Event','Actor ID','Target ID','Last active'].map(label=>`<th>${t(label)}</th>`).join('')}</tr></thead><tbody>${data.audit.map(a=>`<tr><td>${e(a.action)}</td><td><bdi>${e(a.actorId)}</bdi></td><td><bdi>${e(a.targetId)}</bdi></td><td>${e(when(a.occurredAt))}</td></tr>`).join('')}</tbody></table></div></section>`;
  return title+content;
}

export function bindCompanies(root,data,ctx){
  const {api,refresh,render,openForm,input,currentPassword,dialog,t,e}=ctx;
  const select=(name,label,options,value='',required=true)=>`<label>${t(label)}<select name="${name}" ${required?'required':''}>${options.map(([id,title])=>`<option value="${e(id)}" ${id===value?'selected':''}>${e(title)}</option>`).join('')}</select></label>`;
  const names=row=>input('nameEn','English name','text',`maxlength="100" value="${e(row?.nameEn||'')}"`)+input('nameAr','Arabic name','text',`dir="rtl" maxlength="100" value="${e(row?.nameAr||'')}"`);
  const optional=(name,label,value='',max=300)=>`<label>${t(label)}<input name="${name}" maxlength="${max}" value="${e(value)}"></label>`;
  const enabled=row=>`<label class="staff-check"><input name="active" type="checkbox" ${row?.active!==false?'checked':''}>${t('Active')}</label>`;
  root.querySelectorAll('[data-company-open]').forEach(b=>b.onclick=()=>{companyState.id=b.dataset.companyOpen;companyState.section='operations';void refresh();});
  root.querySelector('[data-company-back]')?.addEventListener('click',()=>{resetCompanies();void refresh();});
  root.querySelectorAll('[data-company-section]').forEach(b=>b.onclick=()=>{companyState.section=b.dataset.companySection;render();});
  const profileForm=row=>{
    const isSuper=data.company?data.capabilities.superAdministrator:data.canCreate;
    openForm(row?'Edit company':'Create company',names(row)+(isSuper?input('slug','Company slug','text',`pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="60" value="${e(row?.slug||'')}"`):'')+(row&&isSuper?select('status','Approval status',['pending','approved','suspended','archived'].map(v=>[v,t(v)]),row.status):'')+optional('contactEmail','Contact email',row?.contactEmail||'',254)+optional('phone','Phone',row?.phone||'',40)+optional('address','Address',row?.address||'')+input('holdMinutes','Hold duration (minutes)','number',`min="5" max="1440" value="${row?.holdMinutes||30}"`)+input('timezone','Timezone','text',`value="${e(row?.timezone||'Africa/Khartoum')}"`)+select('locale','Default language',[['en',t('English')],['ar',t('Arabic')]],row?.locale||'en')+currentPassword(),async f=>{const values=Object.fromEntries(f);values.holdMinutes=Number(values.holdMinutes);const result=await api('companies'+(row?'/'+row.id:''),row?'PATCH':'POST',{...values,...(row?{version:row.version}:{})});companyState.id=result.id;return result;});
  };
  root.querySelector('[data-company-create]')?.addEventListener('click',()=>profileForm());
  root.querySelector('[data-company-edit]')?.addEventListener('click',()=>profileForm(data.company));
  if(!data.company)return;
  const cid=data.company.id,cap=data.capabilities,path='companies/'+cid;
  if(companyState.section==='routes')bindRoutes(root,data,ctx);
  if(companyState.section==='fleet')bindFleet(root,data,ctx);
  if(companyState.section==='drivers')bindDrivers(root,data,ctx);
  if(companyState.section==='trips')bindTrips(root,data,ctx);
  if(companyState.section==='bookings')bindBookings(root,data,ctx);
  if(companyState.section==='operations')bindOperations(root,data,{...ctx,openSection:(id,then)=>{companyState.section=id;render();setTimeout(()=>then?.());}});
  if(companyState.section==='luggage')bindLuggage(root,data,ctx);
  if(companyState.section==='shipments')bindShipments(root,data,ctx);
  if(companyState.section==='finance')bindFinance(root,data,ctx);
  if(companyState.section==='station')bindStation(root,data,{...ctx,goToBooking:id=>{openBookingNext(id);companyState.section='bookings';render();}});
  if(companyState.section==='public')bindPublicPage(root,data,ctx);
  const resourceForm=(kind,row)=>{
    const branches=data.branches.filter(b=>b.active&&(cap.managedBranches.includes(b.id)||row?.branchId===b.id));
    openForm(row?'Edit':kind==='branches'?'Add branch':'Add station',names(row)+input('code','Code','text',`maxlength="40" pattern="[A-Za-z0-9_-]+" value="${e(row?.code||'')}"`)+(kind==='stations'?(row?`<input name="branchId" type="hidden" value="${e(row.branchId)}"><p>${t('Branch')}: ${e(data.branches.find(b=>b.id===row.branchId)?.nameEn||'')}</p>`:select('branchId','Branch',[['',t('Choose branch')],...branches.map(b=>[b.id,b.nameEn+' / '+b.nameAr])],''))+optional('address','Address',row?.address||'')+select('cityId','City',[['',t('Not assigned')],...(data.cities||[]).filter(c=>c.active||c.id===row?.cityId).map(c=>[c.id,c.nameEn+' / '+c.nameAr])],row?.cityId||'',false):'')+(cap.branchCreate?enabled(row):'')+currentPassword(),f=>api(path+'/'+kind+(row?'/'+row.id:''),row?'PATCH':'POST',{...Object.fromEntries(f),...(kind==='stations'?{cityId:f.get('cityId')||null}:{}),active:cap.branchCreate?f.has('active'):row?.active!==false,...(row?{version:row.version}:{})}));
  };
  root.querySelectorAll('[data-resource-create]').forEach(b=>b.onclick=()=>resourceForm(b.dataset.resourceCreate));
  root.querySelectorAll('[data-resource-edit]').forEach(b=>b.onclick=()=>{const [kind,id]=b.dataset.resourceEdit.split(':');resourceForm(kind,data[kind].find(r=>r.id===id));});
  const memberForm=row=>{
    const options=data.roles.filter(r=>r.active&&(r.scope==='company'?cap.memberCompanyScope:r.scope==='branch'?cap.memberBranches.length>0:cap.memberStations.length>0));
    const assignmentRow=a=>`<div class="company-assignment" data-assignment>${select('roleId','Company roles',[['',t('Choose role')],...options.map(r=>[r.id,t(r.displayName)])],a?.roleId||'')}${select('branchId','Branch',[['',t('Choose branch')],...data.branches.filter(b=>b.active&&cap.memberBranches.includes(b.id)).map(b=>[b.id,b.nameEn+' / '+b.nameAr])],a?.branchId||'',false)}${select('stationId','Station',[['',t('Choose station')],...data.stations.filter(s=>s.active&&cap.memberStations.includes(s.id)).map(s=>[s.id,s.nameEn+' / '+s.nameAr])],a?.stationId||'',false)}<button type="button" data-remove-assignment>${t('Remove assignment')}</button></div>`;
    openForm(row?'Edit membership':'Add staff member',input('displayName','Display name','text',`maxlength="100" value="${e(row?.displayName||'')}"`)+`<label>${t('Job title (optional)')}<input name="jobTitle" type="text" maxlength="80" value="${e(row?.jobTitle||'')}" placeholder="${e(t('e.g. Station agent'))}"></label><label>${t('Work phone (optional)')}<input name="phone" type="tel" inputmode="tel" maxlength="20" autocomplete="off" value="${e(row?.phone||'')}" placeholder="+249 912 345 678"></label>`+(row?enabled(row):input('login','Email','email','maxlength="254"')+(cap.superAdministrator?`<label class="staff-check"><input name="existing" type="checkbox">${t('Link an existing account')}</label>`:''))+`<p class="staff-muted">${t('Assign only roles and resources within your own access.')}</p><div data-assignments>${(row?.assignments.length?row.assignments:[null]).map(assignmentRow).join('')}</div><button type="button" data-add-assignment>${t('Add assignment')}</button>`+currentPassword(),f=>{
      const assignments=[...dialog.querySelectorAll('[data-assignment]')].map(el=>({roleId:el.querySelector('[name=roleId]').value,branchId:el.querySelector('[name=branchId]').value||null,stationId:el.querySelector('[name=stationId]').value||null}));
      return api(path+'/members'+(row?'/'+row.id:''),row?'PATCH':'POST',{displayName:f.get('displayName'),jobTitle:f.get('jobTitle'),phone:f.get('phone'),assignments,currentPassword:f.get('currentPassword'),...(row?{active:f.has('active'),version:row.version}:{login:f.get('login'),existing:f.has('existing')})});
    });
    const update=el=>{const role=options.find(r=>r.id===el.querySelector('[name=roleId]').value),branch=el.querySelector('[name=branchId]'),station=el.querySelector('[name=stationId]');branch.disabled=!role||role.scope==='company';branch.required=role&&role.scope!=='company';station.disabled=role?.scope!=='station';station.required=role?.scope==='station';if(branch.disabled)branch.value='';if(station.disabled)station.value='';const keep=station.value,usable=data.stations.filter(s=>s.active&&cap.memberStations.includes(s.id)&&s.branchId===branch.value);station.replaceChildren(new Option(t('Choose station'),''),...usable.map(s=>new Option(s.nameEn+' / '+s.nameAr,s.id)));station.value=usable.some(s=>s.id===keep)?keep:'';};
    const bind=el=>{el.querySelector('[data-remove-assignment]').onclick=()=>el.remove();el.querySelector('[name=roleId]').onchange=()=>update(el);el.querySelector('[name=branchId]').onchange=()=>update(el);update(el);};
    dialog.querySelectorAll('[data-assignment]').forEach(bind);dialog.querySelector('[data-add-assignment]').onclick=()=>{if(dialog.querySelectorAll('[data-assignment]').length>=10)return;dialog.querySelector('[data-assignments]').insertAdjacentHTML('beforeend',assignmentRow());bind(dialog.querySelector('[data-assignment]:last-child'));};
  };
  root.querySelector('[data-member-create]')?.addEventListener('click',()=>memberForm());root.querySelectorAll('[data-member-edit]').forEach(b=>b.onclick=()=>memberForm(data.members.find(m=>m.id===b.dataset.memberEdit)));
  const checks=(codes,selected=[])=>`<fieldset class="staff-checks"><legend>${t('Permissions')}</legend>${codes.map(p=>`<label><input name="permissions" type="checkbox" value="${p}" ${selected.includes(p)?'checked':''}>${e(t(p))}</label>`).join('')}</fieldset>`;
  const roleForm=row=>openForm(row?'Edit role':'Create role',input('displayName','Display name','text',`maxlength="100" value="${e(row?.displayName||'')}"`)+(row?enabled(row):select('scope','Scope',['company','branch','station'].map(v=>[v,t(v)]),'company'))+checks(data.permissions,row?.permissions)+`<p class="staff-muted">${t('Roles with any company permission also get Company profile: read, so the person can open the company workspace. Driver-only roles use the Driver app.')}</p>`+currentPassword(),f=>api(path+'/roles'+(row?'/'+row.id:''),row?'PATCH':'POST',{displayName:f.get('displayName'),permissions:f.getAll('permissions'),currentPassword:f.get('currentPassword'),...(row?{active:f.has('active'),version:row.version}:{scope:f.get('scope')})}));
  root.querySelector('[data-company-role-create]')?.addEventListener('click',()=>roleForm());root.querySelectorAll('[data-company-role-edit]').forEach(b=>b.onclick=()=>roleForm(data.roles.find(r=>r.id===b.dataset.companyRoleEdit)));
  root.querySelector('[data-support-create]')?.addEventListener('click',()=>openForm('Grant support access',input('login','Support email','email','maxlength="254"')+input('reason','Reason','text','maxlength="300"')+input('hours','Duration (hours)','number','min="1" max="24" value="1"')+checks(['company.profile.read','company.resources.read','company.audit.read','company.routes.read'],['company.profile.read'])+currentPassword(),f=>api(path+'/support','POST',{login:f.get('login'),reason:f.get('reason'),hours:Number(f.get('hours')),permissions:f.getAll('permissions'),currentPassword:f.get('currentPassword')})));
  root.querySelectorAll('[data-support-revoke]').forEach(b=>b.onclick=()=>openForm('Revoke access',currentPassword(),f=>api(path+'/support/'+b.dataset.supportRevoke,'DELETE',{currentPassword:f.get('currentPassword')})));
}

// D65: company sections for the sidebar, in the owner's order, filtered by permission.
export function companySections(cap){
  return [
    ['operations','Overview',cap.operations,'main','grid'],['trips','Trips',cap.tripsRead,'main','calendar'],['routes','Routes',cap.routesRead,'main','pin'],
    ['bookings','Bookings',cap.bookingsRead,'main','ticket'],['drivers','Drivers',cap.driversRead,'main','person'],['fleet','Vehicles',cap.fleetRead,'main','bus'],
    ['finance','Reports',cap.financeRead,'main','chart'],
    ['station','Station',cap.stationScreen,'operations','counter'],['luggage','Luggage',cap.luggage||cap.luggageResolve,'operations','bag'],['shipments','Shipments',cap.shipments||cap.shipmentsResolve||cap.shipmentPrices,'operations','box'],
    ['overview','Company profile',true,'settings','building'],['resources','Branches & stations',true,'settings','pin'],['public','Public page',cap.profile,'settings','globe'],
    ['members','Company staff',cap.membersRead,'settings','people'],['roles','Company roles',cap.rolesRead,'settings','shield'],['support','Support access',cap.supportRead,'settings','key'],['audit','Company audit',cap.auditRead,'settings','list'],
  ].filter(r=>r[2]);
}
const sideIcons={grid:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',calendar:'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',pin:'M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4',ticket:'M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4zM14 6v12',person:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0',bus:'M5 17V6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v11M5 13h14M7 17v3M17 17v3',chart:'M5 20V10M12 20V4M19 20v-7',counter:'M3 10h18M5 10v10h14V10M8 6h8l2 4H6z',bag:'M6 8h12l-1 12H7zM9 8V6a3 3 0 0 1 6 0v2',box:'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',building:'M4 21V5l8-3 8 3v16M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4',globe:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',people:'M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6',shield:'M12 3l8 3v6c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V6z',key:'M15 7a4 4 0 1 1-3.5 6L5 19.5V22H2v-3l6.5-6.5A4 4 0 0 1 15 7',list:'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',back:'m15 6-6 6 6 6'};
const sideIcon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${sideIcons[name]}"/></svg>`;
export function companySidebar(data,{t,e,language}){
  if(!data?.company)return '';
  const sections=companySections(data.capabilities),current=sections.some(([id])=>id===companyState.section)?companyState.section:sections[0][0];
  const item=([id,label,,,icon])=>`<button type="button" data-company-section="${id}" ${current===id?'aria-current="page"':''}>${sideIcon(icon)}<span>${t(label)}</span></button>`;
  const group=(key,label)=>{const rows=sections.filter(r=>r[3]===key);return rows.length?`${label?`<p class="staff-sidebar-label">${t(label)}</p>`:''}<nav class="staff-nav company-side-nav" aria-label="${t(label||'Company workspace')}">${rows.map(item).join('')}</nav>`:'';};
  return `<p class="company-side-name">${e(language==='ar'?data.company.nameAr:data.company.nameEn)}</p>${group('main','')}${group('operations','Operations')}${group('settings','Settings')}${data.selectionCount>1||data.canCreate?`<button type="button" class="company-side-back" data-company-back>${sideIcon('back')}<span>${t('All companies')}</span></button>`:''}`;
}
