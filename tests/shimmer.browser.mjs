import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {startServer} from '../server.mjs';
let apiOrigin='',browser;const web=await startServer({port:0,built:process.env.SAFEER_BROWSER_BUILT==='1',identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/shimmer');mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-shimmer-')));const {send,evaluate,until}=browser;await send('Page.enable');await send('Network.enable');
 const injected=await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__errors=[];addEventListener('error',e=>__errors.push(e.message));addEventListener('unhandledrejection',e=>__errors.push(String(e.reason)));const originalFetch=window.fetch;let calls=0,waiting=[],released=false;window.__release=()=>{released=true;waiting.forEach(r=>r());waiting=[];};window.fetch=async(...args)=>{const url=String(args[0]);if(url.includes('/api/v1/')){calls++;if(!released&&!(location.pathname==='/staff'&&calls===1))await new Promise(r=>waiting.push(r));}return originalFetch(...args);};`});
 let count=0;
 for(const page of ['marketplace','driver','staff','track'])for(const lang of ['en','ar'])for(const theme of ['light','dark'])for(const width of [320,390]){
  await send('Network.clearBrowserCookies');if(page==='staff'){const value=f.admin.cookie,i=value.indexOf('=');await send('Network.setCookie',{name:value.slice(0,i),value:value.slice(i+1),url:web.origin,httpOnly:true,sameSite:'Strict'});}
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await send('Page.navigate',{url:web.origin+'/'+page+'?lang='+lang+(page==='track'?'&code=SH-AB23CD45':'')});await until('Boolean(document.querySelector(".safeer-shimmer"))&&Boolean(document.querySelector(".app-menu-trigger"))');await evaluate('document.documentElement.dataset.theme='+JSON.stringify(theme));
  const state=await evaluate(`(()=>{const s=document.querySelector('.safeer-shimmer'),b=s.querySelector('.shimmer-block'),n=document.querySelector('.app-header-name');return {status:s.getAttribute('role'),hidden:s.querySelector('.shimmer-shapes').getAttribute('aria-hidden'),text:s.textContent,position:getComputedStyle(s).position,animation:getComputedStyle(b,'::after').animationName,direction:getComputedStyle(b,'::after').animationDirection,overflow:document.documentElement.scrollWidth>innerWidth+2,nameVisible:n.getBoundingClientRect().bottom<=s.getBoundingClientRect().top};})()`);
  assert.equal(state.status,'status');assert.equal(state.hidden,'true');assert.match(state.text,lang==='ar'?/\u062c\u0627\u0631/:/Loading/);assert.equal(state.position,'static');assert.equal(state.animation,'safeer-shimmer');assert.equal(state.direction,lang==='ar'?'reverse':'normal');assert.equal(state.overflow,false);assert.equal(state.nameVisible,true);
  if(width===390)writeFileSync(join(shots,page+'-'+lang+'-'+theme+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert.equal(await evaluate('getComputedStyle(document.querySelector(".shimmer-block"),"::after").animationName'),'none');
  await evaluate('__release()');await until('!document.querySelector(".safeer-shimmer")');assert.deepEqual(await evaluate('__errors'),[]);count++;
 }
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier});console.log('Shimmer: '+count+' delayed-request mobile layouts passed, including RTL, themes, reduced motion, visible masthead and settled requests.');
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
