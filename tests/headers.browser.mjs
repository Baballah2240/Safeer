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
const shots=resolve('.qa/headers-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;const s=await boardingSetup(f);
 // Real published cards make the public page scroll without synthetic filler.
 for(const days of [11,12,13])await s.trip([new Date(Date.now()+days*86400000).toISOString().slice(0,10)]);
 browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-headers-')));
 const {send,evaluate,until}=browser;await send('Page.enable');await send('Network.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));'});
 const settle=()=>evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 const cookie=async value=>{const i=value.indexOf('=');await send('Network.setCookie',{name:value.slice(0,i),value:value.slice(i+1),url:web.origin,httpOnly:true,sameSite:'Strict'});};
 let layouts=0;
 for(const [page,path,selector,ready] of [['staff','/staff','.staff-topbar','.staff-shortcuts'],['driver','/driver','.driver-header','[data-trip]'],['booking','/marketplace','.market-bar','.market-trip'],['preview','/','.topbar','.metrics']]){
  await cookie(page==='driver'?s.driver.c.cookie:f.admin.cookie);
  for(const theme of ['dark','light'])for(const lang of ['en','ar']){
   await send('Page.navigate',{url:web.origin+path+'?lang='+lang});await until(`Boolean(document.querySelector(${JSON.stringify(ready)}))`);
   if(await evaluate('document.documentElement.dataset.theme')!==theme)await evaluate('document.querySelector("[data-theme-toggle]").click()');
   if(page==='driver'){await evaluate('document.querySelector("[data-trip]").click()');await until('Boolean(document.querySelector("#driver-scan"))');}
   if(page==='preview'){await evaluate('document.querySelector("[data-nav=passengers]").click()');await until('Boolean(document.querySelector("#reservation-form"))');}
   for(const [width,height] of [[1920,1080],[1366,768],[390,844],[320,740]]){
    const label=`${page}/${theme}/${lang}/${width}`;
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});await evaluate('scrollTo(0,0)');await settle();
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),label+' overflow');
    const start=await evaluate(`(()=>{const n=document.querySelector('${selector}'),r=n.getBoundingClientRect();return {y:r.top+scrollY,height:r.height,max:document.documentElement.scrollHeight-innerHeight};})()`);
    assert.ok(start.max>start.y+2,label+' must have real scrollable content');
    await evaluate(`scrollTo(0,${Math.min(start.max,start.y+240)})`);await settle();
    const state=await evaluate(`(()=>{const n=document.querySelector('${selector}'),r=n.getBoundingClientRect(),c=getComputedStyle(n);return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,position:c.position,blur:c.backdropFilter,measured:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky-header-height')),padding:parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)};})()`);
    const gap=width<=760?10:12;
    assert.equal(state.position,'sticky',label);assert.ok(Math.abs(state.top-gap)<=1,label+' header must keep its floating top gap');
    assert.ok(state.left>=-1&&state.right<=width+1,label+' header clipped');assert.ok(state.bottom<=height,label+' header too tall');
    assert.ok(Math.abs(state.measured-state.height)<=1&&state.padding>=state.height+gap,label+' focus offset follows header height and top gap');assert.match(state.blur,/blur\(28px\)/,label+' glass');
    // Check the actual hit target too: DOM click alone cannot detect an overlay.
    const drawer=page==='booking'?'market':page==='driver'?'driver':null;
    const navigation=drawer?`#${drawer}-menu-toggle`:'[data-theme-toggle]';
    assert.ok(await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(navigation)}),r=b.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest(${JSON.stringify(navigation)})===b;})()`),label+' navigation hit target');
    if(drawer)await evaluate(`document.querySelector('#${drawer}-menu-toggle').click();document.querySelector('#${drawer}-settings').open=true`);
    await evaluate('document.querySelector("[data-theme-toggle]").click()');assert.notEqual(await evaluate('document.documentElement.dataset.theme'),theme,label+' interaction');
    await evaluate('document.querySelector("[data-theme-toggle]").click()');
    if(drawer)await evaluate(`document.querySelector('#${drawer}-menu-close').click()`);
    const field={staff:'#change-password [name=currentPassword]',driver:'#driver-incident textarea',booking:'#market-date',preview:'#reservation-form [name=passengerName]'}[page];
    await evaluate(`document.querySelector(${JSON.stringify(field)}).scrollIntoView({block:'start'})`);await settle();
    assert.ok(await evaluate(`document.querySelector(${JSON.stringify(field)}).getBoundingClientRect().top>=document.querySelector('${selector}').getBoundingClientRect().bottom-1`),label+' scrolled form field must clear header');
    if(width===1366||width===320)writeFileSync(join(shots,`${page}-${theme}-${lang}-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    assert.deepEqual(await evaluate('__errors'),[],label);layouts++;
   }
  }
 }
 await cookie(f.admin.cookie);await send('Page.navigate',{url:web.origin+'/staff'});await until('Boolean(document.querySelector("#staff-language"))');
 await evaluate('window.__oldHeader=document.querySelector(".staff-topbar");document.querySelector("#staff-language").click()');await until('document.querySelector(".staff-topbar")!==window.__oldHeader');await settle();
 assert.ok(await evaluate('Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sticky-header-height"))-document.querySelector(".staff-topbar").getBoundingClientRect().height)<=1'),'Observer follows replacement header');
 for(const [name,value] of [['prefers-reduced-motion','reduce'],['prefers-reduced-transparency','reduce'],['forced-colors','active']]){
  await send('Emulation.setEmulatedMedia',{features:[{name,value}]});await settle();
  if(name!=='prefers-reduced-motion')assert.equal(await evaluate('getComputedStyle(document.querySelector(".staff-topbar")).backdropFilter'),'none');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".staff-topbar")).position'),'sticky');
 }
 await send('Emulation.setEmulatedMedia',{media:'print',features:[]});assert.notEqual(await evaluate('getComputedStyle(document.querySelector(".staff-topbar")).position'),'sticky','Screen-only sticky styling does not affect print');
 writeFileSync(join(shots,'result.json'),JSON.stringify({passed:true,built,layouts,scrolling:true,headerReplacement:true,accessibilityPreferences:true,printIsolation:true},null,2)+'\n');
 console.log(`Sticky glass headers: ${layouts} real-data scroll/layout combinations, all four pages, live height/replacement tracking, navigation, accessibility preferences and print isolation passed.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
