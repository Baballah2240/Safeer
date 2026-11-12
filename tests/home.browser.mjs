import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {startServer} from '../server.mjs';

// D76: the public home page at / in English and Arabic: layouts without sideways scrolling, reveal and scroll
// motion, tabs and keys, the phone menu, reduced motion, no JavaScript, same-site links and a clean CSP.
const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>''});
const shots=resolve('.qa/home-browser-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
// Every translation key on the page exists in the Arabic dictionary.
const html=readFileSync('home.html','utf8'),script=readFileSync('src/home.js','utf8');
const keys=new Set([...html.matchAll(/data-i18n="([^"]+)"/g)].map(m=>m[1]).concat([...html.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap(m=>m[1].split(';').map(p=>p.split(':')[1]))));
const arabic=new Set([...script.matchAll(/'([a-z]+(?:\.[a-z0-9]+)+|skip)':\s*'/g)].map(m=>m[1]));
assert.deepEqual([...keys].filter(k=>!arabic.has(k)),[],'every key has Arabic');
assert.ok(!/ style="/.test(html),'no inline styles (blocked by the CSP)');
let browser;
try{
 browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-home-')));const {send,evaluate,until}=browser;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 await send('Page.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(String(e.message||e.target?.src||e.target?.href||e.type)),true);addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));document.addEventListener("securitypolicyviolation",e=>__errors.push("csp:"+e.violatedDirective+" "+e.blockedURI));'});
 const view=(w,h)=>send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<700});
 const load=async(query='')=>{await send('Page.navigate',{url:web.origin+'/'+query});await until('document.readyState==="complete"&&document.documentElement.classList.contains("hero-ready")');await evaluate('document.fonts.ready.then(()=>true)');};
 const scrollThrough=async()=>{const h=await evaluate('document.documentElement.scrollHeight');for(let y=0;y<=h;y+=500){await evaluate(`scrollTo({top:${y},behavior:"instant"})`);await sleep(80);}await sleep(800);};
 const shot=async name=>writeFileSync(join(shots,name+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 const noOverflow=async label=>assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),label+': sideways overflow');
 const clean=async label=>assert.deepEqual(await evaluate('__errors'),[],label);
 const revealedAll=async label=>assert.equal(await evaluate('[...document.querySelectorAll("[data-reveal]")].filter(e=>!e.classList.contains("is-in")).length'),0,label+': every block revealed');

 for(const [w,h] of [[1440,900],[1024,768],[768,1024],[390,844],[360,740]]){
  await view(w,h);await load();await noOverflow('en '+w);
  if(w===1440||w===390){await sleep(1300);await shot('en-'+w+'-hero');await scrollThrough();await noOverflow('en '+w+' scrolled');await revealedAll('en '+w);}
  await clean('en '+w);
 }
 // The bus photo loads as WebP; every Safeer link stays on this site.
 await view(1440,900);await load();
 assert.match(await evaluate('document.querySelector(".hero-media img").currentSrc'),/\/src\/coach-\d+\.webp$/);
 assert.ok(await evaluate('[...document.querySelectorAll("a[data-safeer]")].every(a=>new URL(a.href).origin===location.origin)'),'relative Safeer links');
 assert.equal(await evaluate('getComputedStyle(document.getElementById("panel-ship")).display'),'none','inactive steps hidden');
 // Scroll motion: the bus drifts and the steps bus follows the section.
 await evaluate('scrollTo({top:300,behavior:"instant"})');await sleep(250);
 assert.match(await evaluate('document.querySelector("[data-hero-media]").style.transform'),/translate3d\(0px?, ?[1-9]/);
 await evaluate('document.getElementById("how").scrollIntoView({block:"start",behavior:"instant"})');await sleep(400);
 assert.ok(Number(await evaluate('getComputedStyle(document.querySelector("[data-steps]")).getPropertyValue("--p")'))>0.2,'steps progress follows the page');
 // Tabs by click and keyboard.
 await evaluate('document.getElementById("tab-ship").click()');assert.equal(await evaluate('document.getElementById("panel-ship").hidden'),false);
 await evaluate('document.getElementById("tab-ship").dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}))');assert.equal(await evaluate('document.activeElement.id'),'tab-travel');
 // Arabic via the button: direction, title, Arabic live links.
 await evaluate('document.querySelector("[data-lang-toggle]").click()');
 assert.equal(await evaluate('document.documentElement.dir'),'rtl');assert.match(await evaluate('document.title'),/سفير/);
 assert.ok(await evaluate('[...document.querySelectorAll("a[data-safeer]")].every(a=>a.href.endsWith("lang=ar"))'));
 for(const [w,h] of [[1440,900],[390,844]]){
  await view(w,h);await load('?lang=ar');assert.equal(await evaluate('document.documentElement.dir'),'rtl');await noOverflow('ar '+w);
  await sleep(1300);await shot('ar-'+w+'-hero');await scrollThrough();await noOverflow('ar '+w+' scrolled');await revealedAll('ar '+w);
  assert.deepEqual(await evaluate('[...document.querySelectorAll("[data-i18n]")].filter(n=>/[A-Za-z]{4,}/.test(n.textContent)&&!/QR|Safeer/.test(n.textContent)).map(n=>n.dataset.i18n)'),[],'Arabic text everywhere');
  await clean('ar '+w);
 }
 // Phone menu: opens with focus inside, Escape closes and returns focus.
 await view(390,844);await load();
 await evaluate('document.querySelector("[data-menu-toggle]").click()');assert.equal(await evaluate('document.activeElement.getAttribute("href")'),'#about');
 await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))');
 assert.equal(await evaluate('document.querySelector("[data-menu-toggle]").getAttribute("aria-expanded")'),'false');assert.ok(await evaluate('document.activeElement.hasAttribute("data-menu-toggle")'));
 // Reduced motion and no JavaScript both show everything.
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await view(1440,900);await load();
 assert.equal(await evaluate('[...document.querySelectorAll("[data-reveal]")].filter(e=>getComputedStyle(e).opacity!=="1").length'),0,'reduced motion');
 assert.equal(await evaluate('document.querySelector("[data-hero-media]").style.transform'),'');
 await send('Emulation.setEmulatedMedia',{features:[]});
 await send('Emulation.setScriptExecutionDisabled',{value:true});await send('Page.navigate',{url:web.origin+'/'});await sleep(1000);
 assert.equal(await evaluate('[...document.querySelectorAll("[data-reveal],[data-hero-item]")].filter(e=>getComputedStyle(e).opacity!=="1").length'),0,'no JavaScript');
 await send('Emulation.setScriptExecutionDisabled',{value:false});
 // The earlier demo workspace now lives at /demo.
 await send('Page.navigate',{url:web.origin+'/demo'});await until('Boolean(document.querySelector(".workspace"))');
 assert.equal(await evaluate('document.querySelector(".sidebar .brand").getAttribute("href").startsWith("/demo")'),true);
 console.log(`D76 ${built?'built':'source'} home page passed: 5 English and 2 Arabic widths without sideways scrolling, reveal and scroll motion, WebP hero, same-site links, tabs and keys, phone menu, reduced motion, no JavaScript, no CSP violations, demo at /demo.`);
}finally{await browser?.close();await web.close();}
