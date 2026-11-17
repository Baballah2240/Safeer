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
   // D104: the old drawer is gone; the workspace sidebar is the only navigation.
   assert.equal(await evaluate('Boolean(document.querySelector("#staff-sidebar"))'),false,label+' no old drawer');
   if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('[data-theme-toggle]');
   if(!signedIn)assert.equal(await evaluate('Boolean(document.querySelector("#staff-menu-toggle"))'),false,label+' no menu when signed out');
   else if(width>=1024){
    assert.ok(await evaluate('getComputedStyle(document.querySelector(".ws-nav")).display!=="none"'),label+' sidebar shown');
    await click('#staff-menu-toggle');await until('document.querySelector(".staff-shell").classList.contains("ws-collapsed")&&getComputedStyle(document.querySelector(".ws-nav")).display==="none"');
    await click('#staff-menu-toggle');await until('!document.querySelector(".staff-shell").classList.contains("ws-collapsed")');
   }else{
    const field='#staff-search-input';
    await evaluate(`window.__field=document.querySelector('${field}');__field.value='fictional@example.test';__field.dispatchEvent(new Event('input',{bubbles:true}));`);
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".ws-nav")).display'),'none',label+' sidebar closed initially');
    await click('#staff-menu-toggle');await until('document.querySelector(".staff-shell").classList.contains("ws-open")');
    assert.ok(await evaluate('document.querySelector("#staff-ws-nav").contains(document.activeElement)'),label+' focus in sidebar');
    assert.ok(await evaluate('Boolean(document.querySelector("#staff-ws-nav [data-tab=users]"))&&Boolean(document.querySelector("#staff-logout"))'),label+' navigation and account controls');
    await evaluate('document.getAnimations().forEach(a=>a.finish())');
    assert.ok(await evaluate('(()=>{const d=document.querySelector("#staff-ws-nav"),r=d.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&d.scrollWidth<=d.clientWidth+1})()'),label+' sidebar fits');
    if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('[data-theme-toggle]');
    assert.ok(await evaluate(`document.querySelector('${field}')===__field&&__field.value==='fictional@example.test'`),label+' theme preserves input');
    await click('#staff-language');assert.ok(await evaluate('document.querySelector(".staff-shell").classList.contains("ws-open")'),label+' language keeps sidebar open');await click('#staff-language');
    if(width===390)writeFileSync(join(shots,`${signedIn}-${lang}-${theme}-menu.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await until('!document.querySelector(".staff-shell").classList.contains("ws-open")&&document.activeElement.id==="staff-menu-toggle"');
    await click('#staff-menu-toggle');await click('#staff-ws-nav [data-tab=users]');await until('Boolean(document.querySelector("[data-create-user]"))');
    assert.equal(await evaluate('document.querySelector(".staff-shell").classList.contains("ws-open")||document.documentElement.classList.contains("app-drawer-open")'),false,label+' destination closes sidebar');
    await click('[data-tab=profile]');await until('Boolean(document.querySelector(".staff-shortcuts"))');
   }
   assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),label+' page fits');
   // D101: the header stays at the top and holds theme, language, and for a signed-in person search, home, bell and profile.
   assert.equal(await evaluate('getComputedStyle(document.querySelector(".staff-header")).position'),'sticky',label+' sticky header');
   assert.equal(await evaluate('["[data-theme-toggle]","#staff-language","#staff-search-input","#staff-home","#staff-bell","#staff-profile"].filter(s=>document.querySelector(".staff-header "+s)).length'),signedIn?6:2,label+' header controls');
   assert.ok(await evaluate('(()=>{const r=document.querySelector(".staff-header").getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1})()'),label+' header fits');
   if(signedIn&&lang==='en'&&theme==='light'){
    await evaluate('(()=>{const i=document.querySelector("#staff-search-input");i.focus();i.value="audit";i.dispatchEvent(new Event("input"))})()');await until('Boolean(document.querySelector("#staff-search-results [data-search-index]"))');
    await evaluate('document.querySelector("#staff-search-input").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}))');await until('document.querySelector("[data-tab=audit]")?.getAttribute("aria-current")==="page"');
    await click('#staff-home');await until('Boolean(document.querySelector(".staff-shortcuts"))');
    await click('#staff-profile');assert.equal(await evaluate('document.querySelector("#staff-profile-menu").hidden'),false,label+' profile menu');await click('#staff-profile');
    // D106: Overview holds no personal details; the header opens the profile page.
    await click('[data-tab=profile]');await until('Boolean(document.querySelector(".staff-shortcuts"))');assert.equal(await evaluate('Boolean(document.querySelector("#change-password,.staff-profile"))'),false,label+' overview has no profile');
    await click('#staff-profile');await click('[data-profile-open]');await until('Boolean(document.querySelector("#change-password"))');await click('[data-tab=profile]');await until('Boolean(document.querySelector(".staff-shortcuts"))');
   }
   if(width===390)writeFileSync(join(shots,`${signedIn}-${lang}-${theme}-page.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
   assert.deepEqual(await evaluate('__errors'),[],label);layouts++;
  }
 }
 console.log(`Staff app menu: ${layouts} signed-in/out bilingual light/dark layouts, permissions, navigation, settings, draft preservation and modal focus passed.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
