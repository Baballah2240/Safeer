import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {ok,boardingSetup} from './support/boarding-fixture.mjs';
import {startServer} from '../server.mjs';

let apiOrigin='',browser;
const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/section-12-browser-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;const s=await boardingSetup(f);await s.time();
 const login=ok(await s.driver.c.request('auth/me'),200).login;
 browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-s12-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Runtime.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:"window.__errors=[];window.addEventListener('error',e=>__errors.push(e.message));window.addEventListener('unhandledrejection',e=>__errors.push(String(e.reason)));window.confirm=()=>true;"});
 const fill=(selector,value)=>evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
 const submit=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`);
 await send('Page.navigate',{url:web.origin+'/driver'});await until('Boolean(document.querySelector("#driver-login"))');
 await fill('[name=login]',login);await fill('[name=password]',s.driver.pass);await submit('#driver-login');
 await until('Boolean(document.querySelector("[data-trip]"))');await click('[data-trip]');await until('Boolean(document.querySelector("#driver-scan button:not(:disabled)"))');
 await click('[data-open-scan]');await fill('#driver-scan input',s.code.token);await submit('#driver-scan');await until('Boolean(document.querySelector("[data-board]"))');
 assert.equal((await f.migration.query('SELECT count(*)::int n FROM safeer.boarding_records')).rows[0].n,0);
 await click('[data-board]');await until('Boolean(document.querySelector(".driver-message").textContent.includes("Boarding saved"))');
 assert.equal((await f.migration.query('SELECT count(*)::int n FROM safeer.boarding_records')).rows[0].n,1);
 await click('[data-home]');await fill('#driver-incident textarea','Fictional <img src=x onerror=alert(1)> road delay');await submit('#driver-incident');await until('document.querySelectorAll(".driver-incident").length===1');
 assert.equal(await evaluate('Boolean(document.querySelector(".driver-incident img"))'),false);
 for(const theme of ['dark','light'])for(const lang of ['en','ar'])for(const [width,height] of [[1920,1080],[1366,768],[390,844],[320,740]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
  if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('[data-theme-toggle]');
  if(await evaluate('document.documentElement.lang')!==lang)await click('[data-lang]');
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),true,`${theme}/${lang}/${width}`);
  assert.equal(await evaluate('document.documentElement.dir'),lang==='ar'?'rtl':'ltr');
  assert.deepEqual(await evaluate('window.__errors'),[]);
  const shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync(join(shots,`${theme}-${lang}-${width}.png`),Buffer.from(shot.data,'base64'));
 }
 if(await evaluate('document.documentElement.lang')!=='en')await click('[data-lang]');
 await s.time('-1 minute');await click('[data-event=departed]');await until('Boolean(document.querySelector("[data-event=arrived]"))');
 assert.equal(await evaluate('Boolean(document.querySelector("#driver-scan"))'),false);
 await click('[data-event=arrived]');await until('document.querySelectorAll("[data-event]").length===0');
 // Disabling a membership removes stale passenger information on the next request.
 await f.migration.query('UPDATE safeer.company_users SET active=false WHERE id=$1',[s.member]);await click('[data-refresh]');await until('document.querySelectorAll("[data-trip]").length===0');
 assert.equal(await evaluate('Boolean(document.querySelector(".driver-detail"))'),false);assert.deepEqual(await evaluate('window.__errors'),[]);
 await click('[data-logout]');await until('Boolean(document.querySelector("#driver-login"))');
 writeFileSync(join(shots,'result.json'),JSON.stringify({passed:true,built,layouts:16,workflow:'Driver sign-in, assigned manifest, QR check, boarding, incident escaping, departure, arrival, revocation, logout'},null,2));
 console.log(`Section 12 ${built?'built':'source'} browser: workflow and 16 bilingual/theme/responsive layouts passed.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
