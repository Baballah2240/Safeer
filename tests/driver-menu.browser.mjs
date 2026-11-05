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
const shots=resolve('.qa/driver-menu-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;const s=await boardingSetup(f);browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-driver-menu-')));
 const {send,evaluate,until}=browser;await send('Page.enable');await send('Network.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));'});
 const click=s=>evaluate(`document.querySelector(${JSON.stringify(s)}).click()`);
 let layouts=0;
 for(const signedIn of [false,true]){
  await send('Network.clearBrowserCookies');if(signedIn){const value=s.driver.c.cookie,i=value.indexOf('=');await send('Network.setCookie',{name:value.slice(0,i),value:value.slice(i+1),url:web.origin,httpOnly:true,sameSite:'Strict'});}
  for(const lang of ['en','ar'])for(const theme of ['dark','light'])for(const [width,height] of [[1920,1080],[1366,768],[390,844],[320,740]]){
   const label=`${signedIn}/${lang}/${theme}/${width}`;
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
   await send('Page.navigate',{url:web.origin+'/driver?lang='+lang});await until(`Boolean(document.querySelector('${signedIn?'[data-trip]':'#driver-login'}'))`);
   if(signedIn){await click('[data-trip]');await until('Boolean(document.querySelector("#driver-incident"))');}
   const field=signedIn?'#driver-incident textarea':'#driver-login [name=login]',value=signedIn?'Fictional unsaved incident':'fictional@example.test';
   await evaluate(`window.__field=document.querySelector('${field}');__field.value='${value}';__field.dispatchEvent(new Event('input',{bubbles:true}));`);
   await click('#driver-menu-toggle');assert.ok(await evaluate('document.querySelector("#driver-menu").contains(document.activeElement)'),label+' focus');
   await evaluate(`document.querySelector('${field}').focus()`);assert.ok(await evaluate(`!document.activeElement.matches('${field}')`),label+' inert background');
   await click('#driver-settings summary');if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('[data-theme-toggle]');
   assert.ok(await evaluate('(()=>{const d=document.querySelector("#driver-menu"),r=d.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&d.scrollWidth<=d.clientWidth+1&&r.height<=innerHeight+1;})()'),label+' drawer fits');
   assert.equal(await evaluate('Boolean(document.querySelector("#driver-menu [data-refresh]"))'),signedIn,label+' refresh access');
   if(width===390||width===1366)writeFileSync(join(shots,`${signedIn}-${theme}-${lang}-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   await until('!document.querySelector("#driver-menu").open&&document.activeElement.id==="driver-menu-toggle"');
   assert.ok(await evaluate(`document.querySelector('${field}')===window.__field&&__field.value==='${value}'`),label+' draft preserved');
   await click('#driver-menu-toggle');await click('[data-lang]');
   assert.ok(await evaluate('document.querySelector("#driver-menu").open&&document.querySelector("#driver-settings").open'),label+' language keeps settings');
   assert.equal(await evaluate('document.documentElement.dir'),lang==='en'?'rtl':'ltr');
   if(signedIn)assert.equal(await evaluate('document.querySelector("#driver-incident textarea").value'),value,label+' incident survives language');
   await click('#driver-menu-close');await until('!document.querySelector("#driver-menu").open');
   assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),label+' page fits');assert.deepEqual(await evaluate('__errors'),[],label);layouts++;
  }
 }
 await click('#driver-menu-toggle');await send('Emulation.setEmulatedMedia',{media:'print'});assert.equal(await evaluate('getComputedStyle(document.querySelector("#driver-menu")).display'),'none');
 writeFileSync(join(shots,'result.json'),JSON.stringify({passed:true,built,layouts,authenticatedAndSignedOut:true,settings:true,focusAndKeyboard:true,draftPreservation:true,rtlAndPrint:true},null,2)+'\n');
 console.log(`Driver menu: ${layouts} signed-in/out layouts, settings/language, focus, draft preservation and print passed.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
