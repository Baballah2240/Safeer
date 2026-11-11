import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {startServer} from '../server.mjs';
let apiOrigin='',browser;
const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/staff-menu-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-staff-menu-')));
 const {send,evaluate,until}=browser;await send('Page.enable');await send('Network.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));'});
 const click=s=>evaluate(`document.querySelector(${JSON.stringify(s)}).click()`);
 let layouts=0;
 for(const signedIn of [false,true]){
  await send('Network.clearBrowserCookies');
  if(signedIn){const value=f.admin.cookie,i=value.indexOf('=');await send('Network.setCookie',{name:value.slice(0,i),value:value.slice(i+1),url:web.origin,httpOnly:true,sameSite:'Strict'});}
  for(const lang of ['en','ar'])for(const theme of ['light','dark'])for(const width of [320,390,768,1366]){
   const label=`${signedIn}/${lang}/${theme}/${width}`;
   await evaluate('document.querySelector(".staff-modern-shell")?.remove()');
   await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<700});
   await send('Page.navigate',{url:web.origin+'/staff?lang='+lang});
   await until(signedIn?'Boolean(document.querySelector(".staff-shortcuts"))':'document.querySelector("#staff-login")?.getAttribute("aria-busy")==="false"');
   assert.equal(await evaluate('document.querySelectorAll("#staff-app .sidebar-column,#staff-app header.staff-topbar").length'),0,label+' no legacy shell');
   assert.equal(await evaluate('document.querySelector("#staff-sidebar").open'),false,label+' drawer closed initially');
   const field=signedIn?'#change-password [name=currentPassword]':'#staff-login [name=login]';
   await evaluate(`window.__field=document.querySelector('${field}');__field.value='fictional@example.test';__field.dispatchEvent(new Event('input',{bubbles:true}));`);
   await click('#staff-menu-toggle');await click('#staff-settings summary');
   assert.ok(await evaluate('document.querySelector("#staff-sidebar").contains(document.activeElement)'),label+' focus in modal');
   assert.equal(await evaluate('Boolean(document.querySelector("#staff-sidebar [data-tab=users]"))'),signedIn,label+' permission navigation');
   assert.equal(await evaluate('Boolean(document.querySelector("#staff-logout"))'),signedIn,label+' account controls');
   if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('[data-theme-toggle]');
   assert.ok(await evaluate(`document.querySelector('${field}')===__field&&__field.value==='fictional@example.test'`),label+' theme preserves input');
   await click('#staff-language');
   assert.ok(await evaluate('document.querySelector("#staff-sidebar").open&&document.querySelector("#staff-settings").open'),label+' language preserves menu');
   if(!signedIn)assert.equal(await evaluate('document.querySelector("#staff-login [name=login]").value'),'fictional@example.test',label+' login draft');
   await click('#staff-language');
   await evaluate('document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).forEach(a=>a.finish())');
   assert.ok(await evaluate('(()=>{const d=document.querySelector("#staff-sidebar"),r=d.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&d.scrollWidth<=d.clientWidth+1})()'),label+' drawer fits');
   if(width===390)writeFileSync(join(shots,`${signedIn}-${lang}-${theme}-menu.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   await until('!document.querySelector("#staff-sidebar").open&&document.activeElement.id==="staff-menu-toggle"');
   if(signedIn){await click('#staff-menu-toggle');await click('#staff-sidebar [data-tab=users]');await until('Boolean(document.querySelector("[data-create-user]"))');assert.equal(await evaluate('document.querySelector("#staff-sidebar").open'),false,label+' destination closes menu');assert.equal(await evaluate('document.documentElement.classList.contains("app-drawer-open")'),false,label+' destination restores body scrolling');}
   assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),label+' page fits');
   if(width===390)writeFileSync(join(shots,`${signedIn}-${lang}-${theme}-page.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
   assert.deepEqual(await evaluate('__errors'),[],label);layouts++;
  }
 }
 console.log(`Staff app menu: ${layouts} signed-in/out bilingual light/dark layouts, permissions, navigation, settings, draft preservation and modal focus passed.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
