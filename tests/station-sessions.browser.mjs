import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {startServer} from '../server.mjs';

// D92: Sessions has its own entry in the company menu and can be opened by link; a ticketing employee opens
// straight into Sessions after signing in; every staff screen is a history entry, so Back returns to the last one.
let apiOrigin='',browser;const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/station-sessions-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-d92-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));'});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const fill=async(s,value)=>{await until(`Boolean(document.querySelector(${JSON.stringify(s)}))`);await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(s)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}));})()`);};
 const shot=name=>send('Page.captureScreenshot',{format:'png'}).then(r=>writeFileSync(join(shots,name+'.png'),Buffer.from(r.data,'base64')));
 const pw={currentPassword:f.password},need=r=>{assert.ok(r.status<300,r.raw);return r.data;};
 const cid=need(await f.admin.request('companies','POST',{nameEn:'Fictional Sessions Coaches',nameAr:'حافلات الجلسات',slug:'sessions-coaches',holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).id,base='companies/'+cid;
 let w=need(await f.admin.request(base));need(await f.admin.request(base,'PATCH',{...w.company,id:undefined,status:'approved',...pw}));w=need(await f.admin.request(base));
 const city=need(await f.admin.request('cities','POST',{code:'SXN',nameEn:'Fictional North',nameAr:'الشمال',countryCode:'SD',active:true,...pw})).id;
 const branch=need(await f.admin.request(base+'/branches','POST',{nameEn:'Fictional Branch',nameAr:'فرع',code:'BR1',active:true,...pw})).id;
 const station=need(await f.admin.request(base+'/stations','POST',{nameEn:'Fictional North Office',nameAr:'مكتب الشمال',code:'NST',branchId:branch,cityId:city,active:true,...pw})).id;
 need(await f.admin.request(base+'/counters','POST',{stationId:station,code:'N1',name:'North counter 1',...pw}));
 const role=w.roles.find(r=>r.code==='ticketing_employee');assert.ok(role,'ticketing employee template');
 const made=need(await f.admin.request(base+'/members','POST',{login:'cashier.d92@safeer.local',displayName:'Fictional Cashier',existing:false,assignments:[{roleId:role.id,branchId:branch,stationId:station}],...pw}));

 // First sign-in: change the temporary password, then the employee lands on Sessions.
 await send('Page.navigate',{url:web.origin+'/staff'});await until('Boolean(document.querySelector("#staff-login"))');
 await fill('[name=login]',made.user.login);await fill('[name=password]',made.temporaryPassword);await evaluate('document.querySelector("#staff-login").requestSubmit()');
 const password='Fictional-'+Math.random().toString(36).slice(2)+'-Pass9';
 await fill('#change-password [name=currentPassword]',made.temporaryPassword);await fill('#change-password [name=newPassword]',password);await fill('#change-password [name=confirmPassword]',password);
 await evaluate('document.querySelector("#change-password").requestSubmit()');
 await until('Boolean(document.querySelector("[data-company-section=sessions][aria-current=page]"))&&/Open session|Your session/.test(document.querySelector("#station-root")?.textContent||"")',20000);
 const url=new URL(await evaluate('location.href'));assert.equal(url.searchParams.get('section'),'sessions');assert.equal(url.searchParams.get('company'),cid);
 assert.equal(await evaluate('/Walk-in sale/.test(document.querySelector("#station-root").textContent)'),false,'Sessions shows only the session panels.');
 assert.equal(await evaluate('document.querySelectorAll("[data-app-back]").length'),0,'No Back on the first screen.');
 await shot('cashier-sessions');

 // D93: with a session open, Sessions is the working counter: find a booking to pay or change.
 await fill('#session-open [name=opening]','500');await evaluate('document.querySelector("#session-open").requestSubmit()');await until('Boolean(document.querySelector("#station-lookup-form"))');
 await fill('#station-lookup-form [name=q]','SF-NOTHING2');await evaluate('document.querySelector("#station-lookup-form").requestSubmit()');await until('document.querySelector("#station-lookup").textContent.includes("No bookings found.")');
 await shot('cashier-sessions-open');
 // Station, then Back returns to Sessions; Back is hidden again there.
 await evaluate('document.querySelector("[data-company-section=station]").click()');
 await until('Boolean(document.querySelector("[data-company-section=station][aria-current=page]"))&&Boolean(document.querySelector("[data-app-back]"))');
 await until('document.querySelector("#station-info")?.textContent.includes("Fictional North Office")');assert.equal(await evaluate('Boolean(document.querySelector("#station-session,#station-lookup"))'),false,'Station shows only station information.');
 await shot('cashier-station-back');
 await evaluate('document.querySelector("[data-app-back]").click()');
 await until('new URL(location.href).searchParams.get("section")==="sessions"&&Boolean(document.querySelector("[data-company-section=sessions][aria-current=page]"))');
 await until('!document.querySelector("[data-app-back]")');

 // A link opens Sessions directly.
 await send('Page.navigate',{url:`${web.origin}/staff?tab=companies&company=${cid}&section=sessions&lang=ar`});
 await until('Boolean(document.querySelector("[data-company-section=sessions][aria-current=page]"))');
 assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'fits');
 assert.deepEqual(await evaluate('window.__errors'),[]);
 console.log('station sessions ok');
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
