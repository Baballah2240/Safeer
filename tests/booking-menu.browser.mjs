import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {startServer} from '../server.mjs';
let apiOrigin='',browser;
const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/booking-menu-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-menu-')));
 const {send,evaluate,until}=browser;await send('Page.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));'});
 const click=s=>evaluate(`document.querySelector(${JSON.stringify(s)}).click()`);
 const key=async(key,code,n)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:n});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:n});};
 let layouts=0;
 for(const path of ['/marketplace','/booking'])for(const lang of ['en','ar'])for(const theme of ['dark','light'])for(const [width,height] of [[1920,1080],[1366,768],[390,844],[320,740]]){
  const label=`${path}/${lang}/${theme}/${width}`;
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
  await send('Page.navigate',{url:web.origin+path+'?lang='+lang});await until(`Boolean(document.querySelector('${path==='/booking'?'#market-lookup':'#market-search'}'))`);
  assert.equal(await evaluate('document.querySelector("#market-menu").open'),false,label);
  const field=path==='/booking'?'#market-lookup-reference':'#market-date',value=path==='/booking'?'SF-23456789':'2026-12-01';
  await evaluate(`window.__field=document.querySelector('${field}');__field.value='${value}';__field.dispatchEvent(new Event('input',{bubbles:true}));`);
  await click('#market-menu-toggle');assert.equal(await evaluate('document.querySelector("#market-menu-toggle").getAttribute("aria-expanded")'),'true');
  assert.ok(await evaluate('document.querySelector("#market-menu").contains(document.activeElement)'),label+' initial focus');
  await evaluate(`document.querySelector('${field}').focus()`);assert.ok(await evaluate(`!document.activeElement.matches('${field}')`),label+' inert background');
  for(let n=0;n<3;n++){await key('Tab','Tab',9);assert.ok(await evaluate('document.querySelector("#market-menu").contains(document.activeElement)'),label+' keyboard containment');}
  await click('#market-settings summary');
  if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('[data-theme-toggle]');
  await evaluate('document.getAnimations().forEach(a=>a.finish())');assert.ok(await evaluate('(()=>{const d=document.querySelector("#market-menu"),r=d.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&d.scrollWidth<=d.clientWidth+1&&r.height<=innerHeight+1;})()'),label+' drawer fits');
  if(width===390||width===1366)writeFileSync(join(shots,`${path.slice(1)}-${theme}-${lang}-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await key('Escape','Escape',27);await until('!document.querySelector("#market-menu").open');
  await until('document.activeElement.id==="market-menu-toggle"');
  assert.ok(await evaluate('document.activeElement.id==="market-menu-toggle"'),label+' focus return');
  assert.ok(await evaluate(`document.querySelector('${field}')===window.__field&&__field.value==='${value}'`),label+' form preserved');
  await click('#market-menu-toggle');await click('#market-language');
  assert.ok(await evaluate('document.querySelector("#market-menu").open&&document.querySelector("#market-settings").open'),label+' language preserves drawer/settings');
  assert.equal(await evaluate('document.documentElement.dir'),lang==='en'?'rtl':'ltr');
  await click('#market-menu-close');await until('!document.querySelector("#market-menu").open');
  await click('#market-menu-toggle');
  const point=await evaluate('(()=>{const r=document.querySelector("#market-menu").getBoundingClientRect();return {x:r.left>1?20:innerWidth-20,y:100};})()');
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  await until('!document.querySelector("#market-menu").open');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),label+' page fits');assert.deepEqual(await evaluate('__errors'),[],label);layouts++;
 }
 await click('#market-menu-toggle');await send('Emulation.setEmulatedMedia',{media:'print'});assert.equal(await evaluate('getComputedStyle(document.querySelector("#market-menu")).display'),'none');
 writeFileSync(join(shots,'result.json'),JSON.stringify({passed:true,built,layouts,keyboard:true,inertBackground:true,formPreservation:true,settingsAndLanguage:true,backdropDismissal:true,printIsolation:true},null,2)+'\n');
 console.log(`Booking menu: ${layouts} layouts, settings, keyboard/focus, inert background, preserved forms, backdrop close and print passed.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
