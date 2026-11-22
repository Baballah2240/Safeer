import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {startServer} from '../server.mjs';

// D136: Users > Access shows everything one person can reach and lets the Super Administrator give platform
// permissions, add company access and remove it, on a phone and a computer, in English and Arabic.
let apiOrigin='',browser;const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/user-access-browser-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-d136-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>window.__errors.push(e.message));addEventListener("unhandledrejection",e=>window.__errors.push(String(e.reason)));'});
 const q=JSON.stringify,click=s=>evaluate(`document.querySelector(${q(s)}).click()`);
 const fill=async(s,v)=>{await until(`Boolean(document.querySelector(${q(s)}))`);await evaluate(`(()=>{const n=document.querySelector(${q(s)});n.value=${q(v)};n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));})()`);};
 const submit=()=>evaluate('document.querySelector("#staff-dialog form").requestSubmit()');
 const saved=async()=>{try{await until('!document.querySelector("#staff-dialog").open');}catch{throw Error('Save failed: '+await evaluate('document.querySelector(".staff-dialog-error")?.textContent||""'));}};
 const shot=name=>send('Page.captureScreenshot',{format:'png'}).then(r=>writeFileSync(join(shots,name+'.png'),Buffer.from(r.data,'base64')));
 const signIn=async(email,pass)=>{await until('Boolean(document.querySelector("#staff-login"))');await fill('[name=login]',email);await fill('[name=password]',pass);await evaluate('document.querySelector("#staff-login").requestSubmit()');await until('Boolean(document.querySelector(".staff-welcome"))');};
 const pw={currentPassword:f.password};
 const cid=(await f.admin.request('companies','POST',{nameEn:'Fictional Access Co',nameAr:'شركة تجريبية',slug:'user-access',holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).data.id;
 const w=(await f.admin.request('companies/'+cid)).data;assert.equal((await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',...pw})).status,200);
 const uid=(await f.admin.request('identity/users','POST',{displayName:'Fictional Helper',login:'helper@safeer.local',...pw})).data.user.id;
 const openAccess=async()=>{await click('[data-tab=users]');await until(`Boolean(document.querySelector('[data-access-user="${uid}"]'))`);await click(`[data-access-user="${uid}"]`);await until('Boolean(document.querySelector("#staff-dialog [data-access-add]"))');};
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:web.origin+'/staff'});await signIn('owner@safeer.local',f.password);
 // Own platform permission.
 await openAccess();await shot('access-empty-1366-en');
 await evaluate('(()=>{const n=document.querySelector(\'#staff-dialog input[name=permissions][value="identity.audit.read"]\');n.checked=true;})()');
 await fill('#staff-dialog [name=currentPassword]',f.password);await submit();await saved();
 assert.deepEqual((await f.admin.request(`identity/users/${uid}/access`)).data.permissions,['identity.audit.read']);
 // Add to a company with the company administrator role.
 await openAccess();await click('#staff-dialog [data-access-add]');await until('Boolean(document.querySelector("#staff-dialog [name=companyId]"))');
 await fill('#staff-dialog [name=companyId]',cid);await until('Boolean(document.querySelector("#staff-dialog [data-company-access] [name=roleId]"))');
 const admin=await evaluate('[...document.querySelectorAll("#staff-dialog [data-company-access] [name=roleId] option")].find(o=>/administrator/i.test(o.textContent))?.value');assert.ok(admin);
 await fill('#staff-dialog [data-company-access] [name=roleId]',admin);await fill('#staff-dialog [name=currentPassword]',f.password);await submit();await saved();
 let a=(await f.admin.request(`identity/users/${uid}/access`)).data;assert.equal(a.companies.length,1);assert.equal(a.companies[0].active,true);
 await openAccess();assert.ok(await evaluate('document.querySelector("#staff-dialog").textContent.includes("Fictional Access Co")'));await shot('access-company-1366-en');
 // Remove that company access.
 await click(`#staff-dialog [data-access-remove="${cid}"]`);await until('Boolean(document.querySelector("#staff-dialog [name=currentPassword]"))&&!document.querySelector("#staff-dialog [data-access-add]")');
 await fill('#staff-dialog [name=currentPassword]',f.password);await submit();await saved();
 a=(await f.admin.request(`identity/users/${uid}/access`)).data;assert.equal(a.companies[0].active,false);
 // Phone, Arabic: the view fits.
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate('localStorage.setItem("safeer.language","ar")');await send('Page.navigate',{url:web.origin+'/staff?lang=ar'});await until('Boolean(document.querySelector(".staff-welcome"))');
 await openAccess();assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2&&document.querySelector("#staff-dialog").scrollWidth<=document.querySelector("#staff-dialog").clientWidth+2'),'fits a phone');
 assert.ok(await evaluate('document.querySelector("#staff-dialog").textContent.includes("إزالة")||document.querySelector("#staff-dialog").textContent.includes("الوصول")'),'Arabic labels');await shot('access-390-ar');
 assert.deepEqual(await evaluate('window.__errors'),[]);
 console.log(`D136 ${built?'built':'source'} browser passed: Users > Access gives a platform permission, adds company access, removes it, and fits a phone in Arabic.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
