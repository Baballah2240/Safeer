import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {startServer} from '../server.mjs';

let apiOrigin='',browser;
const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/track-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-track-')));
 const {send,evaluate,until}=browser;await send('Page.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));'});
 const click=s=>evaluate(`document.querySelector(${JSON.stringify(s)}).click()`);
 let layouts=0;
 for(const lang of ['en','ar'])for(const theme of ['light','dark'])for(const width of [320,390,768,1366]){
  const label=`${lang}/${theme}/${width}`;
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<700});
  await send('Page.navigate',{url:web.origin+'/track?lang='+lang});await until('Boolean(document.querySelector("#track-form"))');
  await evaluate('window.__field=document.querySelector("#track-code");__field.value="SH-AB23CD45";');
  await click('#track-menu-toggle');
  assert.ok(await evaluate('document.querySelector("#track-menu").contains(document.activeElement)'),label+' modal focus');
  await click('#track-settings summary');
  if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('[data-theme-toggle]');
  assert.ok(await evaluate('document.querySelector("#track-code")===__field&&__field.value==="SH-AB23CD45"'),label+' theme preserves draft');
  for(let i=0;i<2;i++){
   await click('#track-language');
   assert.ok(await evaluate('document.querySelector("#track-menu").open&&document.querySelector("#track-settings").open'),label+' language keeps drawer/settings');
   assert.equal(await evaluate('document.querySelector("#track-code").value'),'SH-AB23CD45',label+' language preserves draft');
   assert.equal(await evaluate('document.documentElement.dir'),(i===0?lang==='en':lang==='ar')?'rtl':'ltr',label+' direction');
  }
  await evaluate('document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).forEach(a=>a.finish())');
  assert.ok(await evaluate('(()=>{const d=document.querySelector("#track-menu"),r=d.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&d.scrollWidth<=d.clientWidth+1})()'),label+' drawer fits');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await until('!document.querySelector("#track-menu").open&&document.activeElement.id==="track-menu-toggle"');
  if(width<700)await evaluate('document.documentElement.style.setProperty("--safe-top","32px")');
  await evaluate('scrollTo(0,0)');
  const layout=await evaluate('(()=>{const h=document.querySelector(".track-bar"),r=h.getBoundingClientRect(),n=h.querySelector(".app-header-name").getBoundingClientRect(),i=document.querySelector("#track-code").getBoundingClientRect(),probe=document.createElement("span");probe.style.color="var(--app-primary)";document.body.append(probe);const primary=getComputedStyle(probe).color;probe.remove();return {center:Math.abs((n.left+n.right-r.left-r.right)/2),background:getComputedStyle(h).backgroundColor,top:r.top,fieldFits:i.left>=0&&i.right<=innerWidth,primary:primary,button:getComputedStyle(document.querySelector(".track-submit")).backgroundColor}})()');
  assert.ok(layout.center<=1&&layout.background==='rgba(0, 0, 0, 0)'&&layout.fieldFits,label+' shared header and field fit');
  if(width<700)assert.ok(layout.top>=32,label+' safe inset');
  assert.equal(layout.primary,layout.button,label+' action uses shared app color');
  assert.equal(await evaluate('document.querySelectorAll(".passenger-bottom-nav a").length'),3,label+' shared passenger navigation');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),label+' no horizontal overflow');
  if(width===390)writeFileSync(join(shots,`${lang}-${theme}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.deepEqual(await evaluate('__errors'),[],label+' browser errors');layouts++;
 }
 await send('Page.navigate',{url:web.origin+'/track?lang=en'});await until('Boolean(document.querySelector("#track-form"))');
 await evaluate('document.querySelector("#track-code").value="invalid";document.querySelector("#track-form").requestSubmit()');
 await until('Boolean(document.querySelector("#track-problem"))');
 assert.equal(await evaluate('document.querySelector("#track-code").getAttribute("aria-invalid")'),'true');
 await evaluate('document.querySelector("#track-code").value="SH-22222222";document.querySelector("#track-form").requestSubmit()');
 await until('document.querySelector("#track-problem")?.textContent.includes("could not find")');
 console.log(`Tracking: ${layouts} bilingual light/dark layouts, shared colors/navigation, cutout safety, draft preservation, drawer keyboard/focus and validation passed.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
