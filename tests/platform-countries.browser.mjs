import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {startServer} from '../server.mjs';

// D145: the Super Administrator's Countries panel on Platform overview shows every served country and its setup.
let apiOrigin='',browser;const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/platform-countries-browser-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-d145-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>window.__errors.push(e.message));addEventListener("unhandledrejection",e=>window.__errors.push(String(e.reason)));'});
 const q=JSON.stringify,click=s=>evaluate(`document.querySelector(${q(s)}).click()`);
 const fill=async(s,v)=>{await until(`Boolean(document.querySelector(${q(s)}))`);await evaluate(`(()=>{const n=document.querySelector(${q(s)});n.value=${q(v)};n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));})()`);};
 const submit=()=>evaluate('document.querySelector("#staff-dialog form").requestSubmit()');
 const saved=async()=>{try{await until('!document.querySelector("#staff-dialog").open');}catch{throw Error('Save failed: '+await evaluate('document.querySelector(".staff-dialog-error")?.textContent||""'));}};
 const shot=name=>send('Page.captureScreenshot',{format:'png'}).then(r=>writeFileSync(join(shots,name+'.png'),Buffer.from(r.data,'base64')));
 const signIn=async(email,pass)=>{await until('Boolean(document.querySelector("#staff-login"))');await fill('[name=login]',email);await fill('[name=password]',pass);await evaluate('document.querySelector("#staff-login").requestSubmit()');await until('Boolean(document.querySelector(".staff-welcome"))');};
 const pw={currentPassword:f.password};
 assert.equal((await f.admin.request('platform/country-prices/KW','PUT',{monthlyFeeMinor:'50000',commissionBps:250,currency:'KWD',version:0,...pw})).status,200);
 const panel=async()=>{await click('[data-tab=platform]');await until('Boolean(document.querySelector("#country-prices tr[data-country=KW]"))');await evaluate('document.querySelector("#country-prices").scrollIntoView()');};
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:web.origin+'/staff'});await signIn('owner@safeer.local',f.password);
 await panel();assert.equal(await evaluate('document.querySelectorAll("#country-prices tbody tr").length'),11);
 const kw=await evaluate('document.querySelector("#country-prices tr[data-country=KW]").textContent');
 for(const part of ['KWD','3','+965','Asia/Kuwait','MyFatoorah','Keys not set','Draft','50.000'])assert.ok(kw.includes(part),'Kuwait row shows '+part+': '+kw);
 assert.ok((await evaluate('document.querySelector("#country-prices tr[data-country=SD]").textContent')).includes('Station only'));
 await shot('countries-1366-en');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate('localStorage.setItem("safeer.language","ar")');await send('Page.navigate',{url:web.origin+'/staff?lang=ar'});await until('Boolean(document.querySelector(".staff-welcome"))');
 await panel();assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'fits a phone');assert.ok(await evaluate('document.querySelector("#country-prices h2").textContent==="الدول"'));
 await shot('countries-390-ar');
 assert.deepEqual(await evaluate('window.__errors'),[]);
 console.log(`D145 ${built?'built':'source'} browser passed: Platform overview Countries panel with 11 countries, Kuwait setup and price, desktop and Arabic phone.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
