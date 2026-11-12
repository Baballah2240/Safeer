import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {startServer} from '../server.mjs';
let apiOrigin='',browser;
const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/typography-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-type-')));
 const {send,evaluate,until}=browser;await send('Page.enable');await send('DOM.enable');await send('CSS.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));addEventListener("securitypolicyviolation",e=>__errors.push("CSP "+e.violatedDirective));'});
 const platformFonts=async selector=>{const d=await send('DOM.getDocument'),n=await send('DOM.querySelector',{nodeId:d.root.nodeId,selector});assert.ok(n.nodeId,selector);return (await send('CSS.getPlatformFontsForNode',{nodeId:n.nodeId})).fonts;};
 for(const file of ['inter-latin.woff2','inter-latin-ext.woff2','noto-sans-arabic.woff2']){
  const r=await fetch(web.origin+'/src/fonts/'+file);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/font\/woff2/);assert.equal(Buffer.from(await r.arrayBuffer()).subarray(0,4).toString(),'wOF2');
 }
 let layouts=0;
 for(const [page,path,ready] of [['booking','/marketplace','#market-search'],['driver','/driver','#driver-login'],['tracking','/track','#track-form'],['staff','/staff','#staff-login'],['legal','/privacy','#legal-app h1'],['preview','/demo','#company-select']])for(const lang of ['en','ar'])for(const theme of ['light','dark'])for(const width of [320,390,1366]){
  const label=`${page}/${lang}/${theme}/${width}`;
  await evaluate('document.body.replaceChildren()');
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<700});
  await send('Page.navigate',{url:web.origin+path+'?lang='+lang});await until(`document.readyState==='complete'&&Boolean(document.querySelector('${ready}'))`);
  if(page==='staff'||page==='driver')await until(`document.querySelector('${ready}')?.getAttribute('aria-busy')==='false'`);
  await evaluate(`document.documentElement.dataset.theme='${theme}'`);
  await evaluate('Promise.all([document.fonts.load(\'400 16px "Inter"\',"Safeer 123"),document.fonts.load(\'600 24px "Noto Sans Arabic"\',"سفير")]).then(()=>document.fonts.ready)');
  await evaluate('document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).forEach(a=>a.finish());scrollTo(0,0)');
  const fonts=await platformFonts('main h1');
  assert.ok(fonts.some(font=>font.isCustomFont&&font.familyName.includes(lang==='ar'?'Noto Sans Arabic':'Inter')),label+' actual bundled font');
  const type=await evaluate('(()=>{const h=document.querySelector("main h1"),c=getComputedStyle(h),input=document.querySelector("main input,main select,main textarea"),name=document.querySelector(".app-header-name span");return {heading:parseFloat(c.fontSize),weight:c.fontWeight,input:input?parseFloat(getComputedStyle(input).fontSize):16,name:name?parseFloat(getComputedStyle(name).fontSize):null,overflow:document.documentElement.scrollWidth>innerWidth+2,externalFonts:performance.getEntriesByType("resource").filter(e=>/fonts\\.(googleapis|gstatic)\\.com/.test(e.name)).length}})()');
  assert.equal(type.heading,24,label+' heading size');assert.equal(type.weight,'600',label+' heading weight');assert.equal(type.input,16,label+' readable input size');
  if(type.name!==null)assert.equal(type.name,lang==='ar'?28:26,label+' wordmark size');
  assert.equal(type.overflow,false,label+' no horizontal overflow');assert.equal(type.externalFonts,0,label+' no third-party font request');
  await evaluate('(()=>{const n=document.createElement("bdi");n.id="type-number-probe";n.style.cssText="position:fixed;inset-inline-start:0;top:120px";n.textContent="123,456.78";document.body.append(n)})()');
  await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const numbers=await platformFonts('#type-number-probe');assert.ok(numbers.some(font=>font.isCustomFont&&font.familyName.includes('Inter')),label+' Inter numerals');await evaluate('document.querySelector("#type-number-probe").remove()');
  if(width===390)writeFileSync(join(shots,`${page}-${lang}-${theme}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.deepEqual(await evaluate('__errors'),[],label+' browser/font errors');layouts++;
 }
 console.log(`Typography: ${layouts} page/language/theme/width combinations, actual custom-font glyphs, Inter numerals, local font delivery, readable controls and no overflow passed.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
