import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {boardingSetup} from './support/boarding-fixture.mjs';
import {startServer} from '../server.mjs';
let apiOrigin='',browser;
const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/manual-ticket-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;const s=await boardingSetup(f);await s.time();browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-manual-')));
 const {send,evaluate,until}=browser;await send('Page.enable');await send('Network.enable');
 const cookie=s.driver.c.cookie,i=cookie.indexOf('=');await send('Network.setCookie',{name:cookie.slice(0,i),value:cookie.slice(i+1),url:web.origin,httpOnly:true,sameSite:'Strict'});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));'});
 const click=s=>evaluate(`document.querySelector(${JSON.stringify(s)}).click()`),fill=(s,value)=>evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(s)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const check=async number=>{await fill('#driver-manual-ticket input',number);await evaluate('document.querySelector("#driver-manual-ticket").requestSubmit()');};
 let layouts=0;
 for(const lang of ['en','ar'])for(const theme of ['dark','light'])for(const [width,height] of [[1920,1080],[1366,768],[390,844],[320,740]]){
  const label=`${lang}/${theme}/${width}`;
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});await send('Page.navigate',{url:web.origin+'/driver?lang='+lang});await until('Boolean(document.querySelector("[data-trip]"))');
  await click('[data-trip]');await until('Boolean(document.querySelector("#driver-manual-entry"))');
  if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('[data-theme-toggle]');
  await click('#driver-manual-entry summary');await check(s.p.ticket.toLowerCase());await until('Boolean(document.querySelector("[data-board]:not(:disabled)"))');
  assert.equal(await evaluate('document.querySelector(".driver-check strong").textContent'),'Fictional Traveler 1',label);
  assert.ok(await evaluate('document.querySelector("#driver-manual-entry").open'),label+' stays expanded');
  assert.equal((await f.migration.query('SELECT count(*)::int n FROM safeer.boarding_records')).rows[0].n,0,label+' checking does not board');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),label+' fits');
  if(width===390||width===1366){await evaluate('document.querySelector("#driver-manual-entry").scrollIntoView({block:"center"})');writeFileSync(join(shots,`${theme}-${lang}-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));}
  await fill('#driver-manual-ticket input','TKT-99999999');assert.equal(await evaluate('Boolean(document.querySelector(".driver-check"))'),false,label+' edit invalidates result');
  await check('TKT-99999999');await until('Boolean(document.querySelector(".driver-message .bad"))');assert.equal(await evaluate('Boolean(document.querySelector("[data-board]"))'),false);
  assert.deepEqual(await evaluate('__errors'),[],label);layouts++;
 }
 // An edited input cannot be validated by a late reply for its previous value.
 await evaluate('window.__fetch=window.fetch;window.__ready=false;window.fetch=async(...a)=>{const r=await __fetch(...a);if(String(a[0]).endsWith("/verify")){__ready=true;await new Promise(resolve=>window.__release=resolve);}return r;};');
 await check(s.p.ticket);await until('window.__ready');await fill('#driver-manual-ticket input','TKT-99999999');await evaluate('window.__release()');await until('!document.querySelector("#driver-manual-ticket button").disabled');
 assert.equal(await evaluate('Boolean(document.querySelector(".driver-check"))'),false,'stale verification ignored');
 await evaluate('window.fetch=async(...a)=>{if(String(a[0]).endsWith("/verify"))throw Error("Fictional disconnected service");return __fetch(...a);};');
 await check(s.p.ticket);await until('Boolean(document.querySelector(".driver-message .bad"))');assert.equal(await evaluate('Boolean(document.querySelector("[data-board]"))'),false,'offline never valid');await evaluate('window.fetch=window.__fetch');
 await check(s.p.ticket);await until('Boolean(document.querySelector("[data-board]:not(:disabled)"))');await click('[data-board]');await until('document.querySelector(".driver-message").textContent.includes("'+(await evaluate('document.documentElement.lang')==='ar'?'تم حفظ الصعود.':'Boarding saved.')+'")');
 assert.equal((await f.migration.query('SELECT count(*)::int n FROM safeer.boarding_records')).rows[0].n,1);
 await check(s.p.ticket);await until('Boolean(document.querySelector(".driver-validation-title"))');assert.equal(await evaluate('Boolean(document.querySelector("[data-board]"))'),false,'already boarded');
 assert.deepEqual(await evaluate('__errors'),[]);writeFileSync(join(shots,'result.json'),JSON.stringify({passed:true,built,layouts,manualCheck:true,explicitBoarding:true,editAndStaleReplyInvalidation:true,offlineNeverValid:true,duplicateBoardingPrevented:true},null,2)+'\n');
 console.log(`Manual fallback: ${layouts} layouts, entry/check, edit/stale/offline protection, explicit and duplicate boarding passed.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
