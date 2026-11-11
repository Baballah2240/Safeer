import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {ok,setup,paid,staff} from './support/boarding-fixture.mjs';
import {startServer} from '../server.mjs';
let apiOrigin='',browser;const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/section-14-browser-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;const s=await setup(f,'platform-browser'),tid=await s.trip();await paid(f,s,tid,['1','2']);const employee=await staff(f,s,['company.profile.read','company.finance.read']);
 browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-s14-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Runtime.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));'});
 const englishNotice='Fictional <img src=x onerror=alert(1)> service notice '+'Long'.repeat(100),arabicNotice=('إعلان تجريبي للخدمة '+'رحلات متاحة للحجز. '.repeat(15)).trim();
 const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`),fill=(selector,value)=>evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 async function signIn(login,password){await until('Boolean(document.querySelector("#staff-login"))');await fill('[name=login]',login);await fill('[name=password]',password);await evaluate('document.querySelector("#staff-login").requestSubmit()');await until('Boolean(document.querySelector("#staff-logout"))');}
 await send('Page.navigate',{url:web.origin+'/staff'});await signIn('owner@safeer.local',f.password);await click('[data-tab=platform]');await until('Boolean(document.querySelector("[data-platform-settings]"))');
 assert.equal(await evaluate('document.querySelector(".platform-money").textContent.includes("3,000.00 SDG")'),true);
 await click('[data-platform-settings]');await until('document.querySelector("#staff-dialog").open');
 await evaluate('document.querySelector("[name=enabled]").checked=true');await fill('[name=textEn]',englishNotice);await fill('[name=textAr]',arabicNotice);await fill('#staff-dialog [name=currentPassword]',f.password);await evaluate('document.querySelector("#staff-dialog form").requestSubmit()');await until('!document.querySelector("#staff-dialog").open');
 assert.equal(await evaluate('document.querySelectorAll(".staff-panel img[src=x]").length'),0);
 let layouts=0;
 for(const tab of ['platform','notifications']){
  await click('[data-tab='+tab+']');await until(tab==='platform'?'Boolean(document.querySelector("[data-platform-settings]"))':'document.querySelectorAll(".notification-item").length===3');
  for(const theme of ['dark','light'])for(const lang of ['en','ar'])for(const [width,height] of [[1920,1080],[1366,768],[390,844],[320,740]]){
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
   if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('[data-theme-toggle]');
   if(await evaluate('document.documentElement.lang')!==lang)await click('#staff-language');
   assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),`${tab}/${theme}/${lang}/${width}`);assert.deepEqual(await evaluate('__errors'),[]);
   assert.equal(await evaluate('document.documentElement.dir'),lang==='ar'?'rtl':'ltr');
   if(width<700)await evaluate('document.querySelector(".staff-main").scrollIntoView({block:"start"})');
   else await evaluate('scrollTo(0,0)');
   writeFileSync(join(shots,`${tab}-${theme}-${lang}-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));layouts++;
  }
 }
 await click('[data-notification-read]');await until('document.querySelectorAll("[data-notification-read]").length===2');
 await click('[data-tab=platform]');await until('Boolean(document.querySelector("[data-platform-company]"))');await click('[data-platform-company]');await until('Boolean(document.querySelector("[data-company-section=overview]"))');assert.equal(await evaluate('document.querySelector("[data-tab=companies]").getAttribute("aria-current")'),'page');
 await click('[data-tab=platform]');await until('Boolean(document.querySelector("#platform-filters"))');await fill('#platform-filters [name=from]','2026-01-01');await fill('#platform-filters [name=to]','2026-11-03');await evaluate('document.querySelector("#platform-filters").requestSubmit()');await until('Boolean(document.querySelector(".staff-alert.bad"))');assert.equal(await evaluate('document.querySelectorAll(".platform-money").length'),0);assert.equal(await evaluate('Boolean(document.querySelector("#platform-filters"))'),true);
 // Public notice renders as text in either language and never executes supplied HTML.
 await send('Page.navigate',{url:web.origin+'/marketplace?lang=en'});await until('Boolean(document.querySelector(".market-service-notice"))');assert.equal(await evaluate('document.querySelector(".market-notice-message").textContent'),englishNotice);assert.equal(await evaluate('document.querySelectorAll(".market-service-notice img").length'),0);
 await click('#market-language');assert.equal(await evaluate('document.querySelector(".market-notice-message").textContent'),arabicNotice);assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'));assert.deepEqual(await evaluate('__errors'),[]);
 let noticeLayouts=0;
 for(const theme of ['dark','light'])for(const lang of ['en','ar'])for(const [width,height] of [[1920,1080],[1366,768],[390,844],[320,740]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
  if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('[data-theme-toggle]');
  if(await evaluate('document.documentElement.lang')!==lang)await click('#market-language');
  await evaluate('scrollTo(0,0)');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),theme+'/'+lang+'/'+width+' notice overflow');
  assert.equal(await evaluate('document.querySelector(".market-notice-message").textContent'),lang==='ar'?arabicNotice:englishNotice);
  assert.equal(await evaluate('document.querySelector(".market-notice-label").textContent'),lang==='ar'?'تحديث السفر':'Travel update');
  // D72: the header is an edge-to-edge masthead since the app header simplification, so the notice
  // lines up with the page's content band below it and stays under the header.
  const fit=await evaluate('(()=>{const n=document.querySelector(".market-service-notice"),h=document.querySelector(".market-bar"),c=document.querySelector(".market-main .market-band"),m=document.querySelector(".market-notice-message"),r=n.getBoundingClientRect(),cr=c.getBoundingClientRect();return {left:r.left-cr.left,right:r.right-cr.right,top:r.top,headerBottom:h.getBoundingClientRect().bottom,overflow:m.scrollWidth-m.clientWidth,role:n.getAttribute("role")};})()');
  assert.ok(Math.abs(fit.left)<=1&&Math.abs(fit.right)<=1&&fit.top>=fit.headerBottom&&fit.overflow<=1&&fit.role==='status',`Aligned notice with readable wrapping ${theme}/${lang}/${width}: ${JSON.stringify(fit)}`);
  writeFileSync(join(shots,'notice-'+theme+'-'+lang+'-'+width+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));noticeLayouts++;
 }
 for(const name of ['prefers-reduced-transparency','forced-colors']){
  await send('Emulation.setEmulatedMedia',{features:[{name,value:name==='forced-colors'?'active':'reduce'}]});
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".market-service-notice")).backdropFilter'),'none');
 }
 await send('Emulation.setEmulatedMedia',{media:'print',features:[]});assert.equal(await evaluate('getComputedStyle(document.querySelector(".market-service-notice")).display'),'none');
 await send('Emulation.setEmulatedMedia',{media:'screen',features:[]});
 await send('Page.navigate',{url:web.origin+'/staff'});await until('Boolean(document.querySelector("#staff-logout"))');await click('#staff-logout');await signIn(ok(await employee.c.request('auth/me'),200).login,employee.pass);assert.equal(await evaluate('document.querySelectorAll("[data-tab=platform]").length'),0);await click('[data-tab=notifications]');await until('Boolean(document.querySelector("[data-inbox-first]"))');assert.equal(await evaluate('document.querySelectorAll(".notification-item").length'),0);
 assert.deepEqual(await evaluate('__errors'),[]);writeFileSync(join(shots,'result.json'),JSON.stringify({passed:true,built,layouts,noticeLayouts,workflow:'Live platform collections, password-confirmed bilingual notice, safe public rendering, notification receipt, company navigation, invalid-filter stale-data clearing and restricted employee inbox'},null,2));console.log(`Section 14 ${built?'built':'source'} browser workflow and ${layouts} staff layouts and ${noticeLayouts} public notice layouts passed.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
