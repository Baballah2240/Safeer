import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {startServer} from '../server.mjs';

// D79: the booking home is search-first. On every size, theme and language the compact header, the clear photo,
// the 24px heading and the whole search form (button included) fit on the first screen, nothing covers the photo,
// and the Book/Trips/Profile navigation never covers the form: a bottom bar below it on phones, a top pill from 1024px.
// The public API is replaced in the page by fictional data, so no database is needed.
const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>''});
const shots=resolve('.qa/booking-hero-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
const fake=`const real=window.fetch;window.fetch=async(url,options)=>{const path=String(url);
 if(path.includes('/api/v1/public/')||path.includes('/api/v1/passenger/me')){
  const data=path.includes('passenger/me')?{signedIn:false,googleEnabled:false}:path.includes('notice')?{enabled:false}:{items:path.includes('cities')?[{code:'AAA',nameEn:'City AA',nameAr:'مدينة أ'},{code:'BBB',nameEn:'City BB',nameAr:'مدينة ب'}]:[]};
  return new Response(JSON.stringify({data}),{status:200,headers:{'Content-Type':'application/json'}});}
 return real(url,options);};`;
let browser;
try{
 browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-booking-hero-')));const {send,evaluate,until}=browser;
 await send('Page.enable');
 let checked=0;
 for(const theme of ['light','dark'])for(const lang of ['en','ar']){
  const script=(await send('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.setItem('safeer.theme','${theme}')}catch{};window.__errors=[];addEventListener('error',e=>__errors.push(String(e.message||e.target?.src||e.type)),true);addEventListener('unhandledrejection',e=>__errors.push(String(e.reason)));document.addEventListener('securitypolicyviolation',e=>__errors.push('csp:'+e.violatedDirective));${fake}`})).identifier;
  for(const [width,height] of [[1677,903],[1440,900],[1024,768],[768,1024],[390,844],[360,740],[320,568]]){
   const label=`${theme}/${lang}/${width}x${height}`;
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
   await send('Page.navigate',{url:web.origin+'/marketplace'+(lang==='ar'?'?lang=ar':'')});
   await until('Boolean(document.querySelector("#market-search option[value=BBB]"))&&document.querySelector(".market-hero-art img").complete');
   await evaluate('document.fonts.ready.then(()=>true)');
   const m=await evaluate(`(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};const title=document.querySelector('.market-hero-title');
    return {bar:box('.market-bar'),art:box('.market-hero-art'),title:box('.market-hero-title'),form:box('#market-search'),find:box('#market-submit'),nav:box('.passenger-bottom-nav'),menu:box('.app-menu-trigger'),brand:(()=>{const i=document.querySelector('.app-header-name img').getBoundingClientRect(),t=document.querySelector('.app-header-name>span').getBoundingClientRect();return {left:Math.min(i.left,t.left),right:Math.max(i.right,t.right)};})(),
     navPosition:getComputedStyle(document.querySelector('.passenger-bottom-nav')).position,titleSize:parseFloat(getComputedStyle(title).fontSize),dir:document.documentElement.dir,
     overflow:document.documentElement.scrollWidth>innerWidth+1,errors:window.__errors};})()`);
   assert.equal(m.overflow,false,label+' no sideways scrolling');
   assert.ok(m.bar.bottom-m.bar.top<=72,label+' compact header');
   assert.equal(m.titleSize,24,label+' shared 24px heading');
   assert.ok(m.title.top>=m.art.bottom&&m.title.bottom<=m.form.top,label+' the photo stays clear: heading and search below it');
   assert.ok(m.find.bottom<=height,label+' the whole search fits on the first screen');
   assert.equal(m.navPosition,'fixed');
   if(width>=1024){
    assert.ok(m.nav.bottom<=m.art.top,label+' navigation sits in the header, above the photo');
    assert.ok(m.dir==='rtl'?m.nav.right<m.brand.left:m.nav.left>m.brand.right,label+' navigation clear of the wordmark');
   }else assert.ok(m.find.bottom<=m.nav.top,label+' the bottom bar never covers the search button '+JSON.stringify({find:m.find,nav:m.nav,form:m.form,art:m.art}));
   assert.deepEqual(m.errors,[],label);
   if([1677,1440,390,320].includes(width))writeFileSync(join(shots,`${theme}-${lang}-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
   checked++;
  }
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:script});
 }
 console.log(`D79 ${built?'built':'source'} booking hero passed: ${checked} layouts (7 sizes, light/dark, English/Arabic) with a compact header, a clear photo, the 24px heading, the whole search on the first screen and navigation that never covers it.`);
}finally{await browser?.close();await web.close();}
