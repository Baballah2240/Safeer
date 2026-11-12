import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {startServer} from '../server.mjs';

// D73: Users > Create user gives a new account its company access with custom permissions; Company staff
// shows them, edits them in place and hides the personal role from Company roles, in English and Arabic.
let apiOrigin='',browser;const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/direct-permissions-browser-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-d73-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>window.__errors.push(e.message));addEventListener("unhandledrejection",e=>window.__errors.push(String(e.reason)));'});
 const q=JSON.stringify,click=s=>evaluate(`document.querySelector(${q(s)}).click()`),value=s=>evaluate(`document.querySelector(${q(s)})?.value`);
 const fill=async(s,v)=>{await until(`Boolean(document.querySelector(${q(s)}))`);await evaluate(`(()=>{const n=document.querySelector(${q(s)});n.value=${q(v)};n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));})()`);};
 const tick=(code,on=true)=>evaluate(`(()=>{const n=document.querySelector(${q(`#staff-dialog [data-custom-permissions] input[value="${code}"]`)});n.checked=${on};n.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const ticked=code=>evaluate(`document.querySelector(${q(`#staff-dialog [data-custom-permissions] input[value="${code}"]`)}).checked`);
 const submit=()=>evaluate('document.querySelector("#staff-dialog form").requestSubmit()');
 const saved=async()=>{try{await until('!document.querySelector("#staff-dialog").open');}catch{throw Error('Save failed: '+await evaluate('document.querySelector(".staff-dialog-error")?.textContent||document.body.textContent'));}};
 const password=(pw=f.password)=>fill('#staff-dialog [name=currentPassword]',pw);
 const section=async id=>{await click(`[data-company-section="${id}"]`);await until(`document.querySelector('[data-company-section="${id}"]')?.getAttribute('aria-current')==='page'`);};
 const shot=name=>send('Page.captureScreenshot',{format:'png'}).then(r=>writeFileSync(join(shots,name+'.png'),Buffer.from(r.data,'base64')));
 const signIn=async(email,pass)=>{await until('Boolean(document.querySelector("#staff-login"))');await fill('[name=login]',email);await fill('[name=password]',pass);await evaluate('document.querySelector("#staff-login").requestSubmit()');await until('Boolean(document.querySelector("#change-password"))');};

 const pw={currentPassword:f.password};
 const cid=(await f.admin.request('companies','POST',{nameEn:'Fictional Access Co',nameAr:'شركة تجريبية',slug:'access-browser',holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).data.id,base='companies/'+cid;
 let w=(await f.admin.request(base)).data;assert.equal((await f.admin.request(base,'PATCH',{...w.company,id:undefined,status:'approved',...pw})).status,200);
 const branch=(await f.admin.request(base+'/branches','POST',{code:'MAIN',nameEn:'Fictional Main',nameAr:'فرع تجريبي',active:true,...pw})).data.id;
 const north=(await f.admin.request(base+'/stations','POST',{code:'NORTH',nameEn:'Fictional North',nameAr:'محطة تجريبية',branchId:branch,active:true,...pw})).data.id;

 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:web.origin+'/staff'});await signIn('owner@safeer.local',f.password);

 // Users > Create user: choose the company, then Custom permissions at one station.
 await click('[data-tab=users]');await until('Boolean(document.querySelector("[data-create-user]"))');await click('[data-create-user]');
 await until('Boolean(document.querySelector("#staff-dialog [name=companyId]"))');
 await fill('#staff-dialog [name=displayName]','Fictional Counter Agent');await fill('#staff-dialog [name=login]','counter.agent@safeer.local');
 await fill('#staff-dialog [name=companyId]',cid);await until('Boolean(document.querySelector("#staff-dialog [data-company-access] [name=roleId]"))');
 assert.ok(await evaluate(`[...document.querySelectorAll('#staff-dialog [name=roleId] option')].some(o=>o.value==='custom')`),'Custom permissions are offered.');
 assert.ok(await evaluate(`[...document.querySelectorAll('#staff-dialog [name=roleId] option')].some(o=>o.textContent==='Ticketing employee')`),'Ready roles stay available.');
 assert.equal(await evaluate('document.querySelector("#staff-dialog [data-custom-permissions]").hidden'),true,'The list appears only for Custom permissions.');
 await fill('#staff-dialog [name=roleId]','custom');
 assert.equal(await evaluate('document.querySelector("#staff-dialog [data-custom-permissions]").hidden'),false);
 assert.equal(await evaluate('document.querySelector("#staff-dialog [name=branchId]").options[0].text'),'Whole company');
 assert.equal(await evaluate('document.querySelector("#staff-dialog [name=stationId]").disabled'),true,'Station waits for a branch.');
 await fill('#staff-dialog [name=branchId]',branch);assert.equal(await evaluate('document.querySelector("#staff-dialog [name=stationId]").disabled'),false);
 assert.equal(await evaluate('document.querySelector("#staff-dialog [name=stationId]").options[0].text'),'Whole branch');
 await fill('#staff-dialog [name=stationId]',north);await password();await submit();
 await until('(document.querySelector(".staff-dialog-error")?.textContent||"").includes("Tick at least one permission")');
 await tick('company.ticketing.operate');await tick('company.bookings.read');await shot('create-user-custom-en-1366');
 await submit();await until('Boolean(document.querySelector(".staff-secret"))');
 const temporary=await evaluate('document.querySelector(".staff-secret").textContent');assert.ok(temporary.length>=24);await click('[data-close-secret]');await until('!document.querySelector("#staff-dialog").open');
 w=(await f.admin.request(base)).data;const member=w.members.find(m=>m.login==='counter.agent@safeer.local');assert.ok(member,'The account joined the company.');
 const personal=w.roles.find(r=>r.id===member.assignments[0].roleId);assert.equal(personal.personal,true);assert.equal(member.assignments[0].stationId,north);
 assert.deepEqual(personal.permissions,['company.bookings.read','company.profile.read','company.ticketing.operate']);
 assert.ok(await evaluate('document.body.textContent.includes("counter.agent@safeer.local")'),'Listed under Users.');

 // Company staff shows the custom permissions and edits the same personal role.
 await click('[data-tab=companies]');await until(`Boolean(document.querySelector('[data-company-open="${cid}"]'))`);await click(`[data-company-open="${cid}"]`);
 await until('Boolean(document.querySelector("[data-company-section=members]"))');await section('members');
 const edit=`[data-member-edit="${member.id}"]`,card=()=>evaluate(`document.querySelector(${q(edit)})?.closest('article')?.textContent||''`);await until(`Boolean(document.querySelector(${q(edit)}))`);
 let text=await card();assert.ok(text.includes('Custom permissions')&&text.includes('Sell tickets, take payment and refund'),text);
 await click(edit);await until('Boolean(document.querySelector("#staff-dialog [data-assignment]"))');
 assert.equal(await value('#staff-dialog [name=roleId]'),'custom');assert.equal(await value('#staff-dialog [name=stationId]'),north);
 assert.equal(await ticked('company.ticketing.operate'),true);assert.equal(await ticked('company.finance.read'),false);
 await tick('company.luggage.operate');await password();await submit();await saved();
 w=(await f.admin.request(base)).data;const updated=w.members.find(m=>m.id===member.id);assert.equal(updated.assignments[0].roleId,personal.id,'The same personal role is updated.');
 assert.ok(w.roles.find(r=>r.id===personal.id).permissions.includes('company.luggage.operate'));
 await section('roles');await until('Boolean(document.querySelector("[data-company-role-create]"))');
 assert.equal(await evaluate(`document.querySelector(${q(`[data-company-role-edit="${personal.id}"]`)})`),null,'Personal roles are not listed as company roles.');

 // Arabic, and the dialog fits a phone.
 await click('#staff-language');await until('document.documentElement.lang==="ar"');await section('members');
 await until(`(document.querySelector(${q(edit)})?.closest('article')?.textContent||'').includes('صلاحيات مخصصة')`);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await click(edit);await until('Boolean(document.querySelector("#staff-dialog [data-assignment]"))');
 assert.ok(await evaluate(`[...document.querySelectorAll('#staff-dialog [name=roleId] option')].some(o=>o.textContent==='صلاحيات مخصصة (لهذا الشخص فقط)')`));
 assert.equal(await evaluate('document.querySelector("#staff-dialog [name=branchId]").options[0].text'),'الشركة كلها');
 const fit=await evaluate(`(()=>{const d=document.querySelector('#staff-dialog'),list=d.querySelector('[data-custom-permissions]');return {page:document.documentElement.scrollWidth-innerWidth,dialog:d.scrollWidth-d.clientWidth,list:list.scrollWidth-list.clientWidth};})()`);
 assert.ok(fit.page<=2&&fit.dialog<=2&&fit.list<=2,'No sideways scrolling on a phone: '+q(fit));
 await evaluate('document.querySelector("#staff-dialog [data-custom-permissions]").scrollIntoView()');await shot('edit-membership-custom-ar-390');
 await click('#staff-dialog [data-dialog-cancel]');await until('!document.querySelector("#staff-dialog").open');

 // The new person sees the ticket window (Station) but no staff management.
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});await click('#staff-language');await until('document.documentElement.lang==="en"');
 await click('#staff-logout');await signIn('counter.agent@safeer.local',temporary);
 const fresh=randomBytes(24).toString('hex');await fill('#change-password [name=currentPassword]',temporary);await fill('#change-password [name=newPassword]',fresh);await fill('#change-password [name=confirmPassword]',fresh);await evaluate('document.querySelector("#change-password").requestSubmit()');
 await until('Boolean(document.querySelector("[data-tab=companies]"))');await click('[data-tab=companies]');await until('Boolean(document.querySelector(".company-side-nav"))');
 assert.ok(await evaluate('Boolean(document.querySelector("[data-company-section=station]"))'),'Station (the ticket window) is in the menu.');
 assert.equal(await evaluate('document.querySelector("[data-company-section=members]")'),null,'No staff management.');
 assert.deepEqual(await evaluate('window.__errors'),[]);
 console.log(`D73 ${built?'built':'source'} browser passed: Users > Create user with company custom permissions, required-tick message, Company staff summary and in-place edit, personal role hidden from Company roles, Arabic labels, phone-width dialog, and the new person's Station access.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
