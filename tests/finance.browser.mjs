import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {ok,setup,paid} from './support/boarding-fixture.mjs';
import {startServer} from '../server.mjs';
let apiOrigin='',browser;const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/section-13-browser-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;const s=await setup(f,'finance-browser'),tid=await s.trip(),p=await paid(f,s,tid,['1','2']);
 ok(await f.admin.request(`${s.base}/bookings/${p.bid}/refund`,'POST',{reason:'Fictional refund',key:crypto.randomUUID(),currentPassword:f.password}));
 await paid(f,s,tid,['3']);
 browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-s13-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Runtime.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];window.__prints=0;window.__exports=[];window.print=()=>__prints++;URL.createObjectURL=(blob)=>{blob.text().then(t=>__exports.push(t));return "blob:fictional"};HTMLAnchorElement.prototype.click=function(){};addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));'});
 const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`),fill=(selector,value)=>evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await send('Page.navigate',{url:web.origin+'/staff'});await until('Boolean(document.querySelector("#staff-login"))');await fill('[name=login]','owner@safeer.local');await fill('[name=password]',f.password);await evaluate('document.querySelector("#staff-login").requestSubmit()');await until('Boolean(document.querySelector("[data-tab=companies]"))');await click('[data-tab=companies]');await until('Boolean(document.querySelector("[data-company-open]"))');await click('[data-company-open]');await until('Boolean(document.querySelector("[data-company-section=finance]"))');await click('[data-company-section=finance]');await until('document.querySelectorAll(".finance-currency").length===1');
 assert.equal(await evaluate('Boolean(document.querySelector(".finance-report").textContent.includes("Net collections"))'),true);
 await click('[data-finance-export]');await until('window.__exports.length===1');assert.ok((await evaluate('__exports[0]')).includes('RCP-'));assert.equal((await evaluate('__exports[0]')).includes('Fictional Traveler'),false);
 await click('[data-finance-print]');await until('document.querySelector("#staff-dialog").open');assert.equal(await evaluate('__prints'),1);await send('Emulation.setEmulatedMedia',{media:'print'});assert.equal(await evaluate('getComputedStyle(document.querySelector("#staff-app")).display'),'none');await send('Emulation.setEmulatedMedia',{media:''});await click('[data-finance-close]');
 await fill('#finance-filters [name=from]','2026-01-01');await fill('#finance-filters [name=to]','2026-11-03');await evaluate('document.querySelector("#finance-filters").requestSubmit()');await until('Boolean(document.querySelector("#finance-content [role=alert]"))');assert.equal(await evaluate('document.querySelectorAll(".finance-report").length'),0,'Failed filters remove stale totals.');
 // Re-enter this section to restore valid defaults after the rejected draft.
 await click('[data-company-section=overview]');await click('[data-company-section=finance]');await until('document.querySelectorAll(".finance-currency").length===1');
 for(const theme of ['dark','light'])for(const lang of ['en','ar'])for(const [width,height] of [[1920,1080],[1366,768],[390,844],[320,740]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
  if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('[data-theme-toggle]');
  if(await evaluate('document.documentElement.lang')!==lang){await click('#staff-language');await until('document.querySelectorAll(".finance-currency").length===1');}
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),`${theme}/${lang}/${width}`);assert.deepEqual(await evaluate('__errors'),[]);
  writeFileSync(join(shots,`${theme}-${lang}-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 }
 assert.deepEqual(await evaluate('__errors'),[]);writeFileSync(join(shots,'result.json'),JSON.stringify({passed:true,built,layouts:16,workflow:'Financial summary, CSV export, print isolation, invalid-filter stale-data clearing, Arabic/English dark/light responsive layouts'},null,2));console.log(`Section 13 ${built?'built':'source'} financial browser workflow and 16 layouts passed.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
