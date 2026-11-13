import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {startServer} from '../server.mjs';
import {appRelease} from '../src/app-release.js';

// D78: the retired WebView apps (user agent "SafeerApp/<code> (<flavor>)") see only the download of the Flutter
// app that replaces them, on every page, in English or Arabic, on small phones. Other browsers never see that
// screen and are offered the new apps. The home page's stable download links lead to the current release files.
const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>''});
const shots=resolve('.qa/app-retired-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
let browser;
try{
 for(const flavor of ['booking','driver']){
  const reply=await fetch(web.origin+'/mobile/download/'+flavor,{redirect:'manual'});
  assert.equal(reply.status,302,flavor+' download redirects');assert.equal(reply.headers.get('location'),appRelease.apps[flavor].url);assert.equal(reply.headers.get('cache-control'),'no-store');
 }
 assert.equal((await fetch(web.origin+'/mobile/download/other',{redirect:'manual'})).status,404);
 assert.equal((await fetch(web.origin+'/mobile/download/booking',{method:'POST',redirect:'manual'})).status,405);
 // The published apps are the Flutter apps, above every WebView version (Booking 17004, Driver 18005).
 for(const file of Object.values(appRelease.apps)){assert.ok(file.versionCode>18005,'replaces the WebView apps');assert.match(file.url,/^https:\/\/github\.com\/Baballah2240\/Safeer\/releases\/download\/v\d+\.\d+\.\d+\/Safeer-(Booking|Driver)-\d+\.\d+\.\d+\.apk$/);}

 browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-retired-')));const {send,evaluate,until}=browser;
 await send('Page.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(String(e.message||e.target?.src||e.target?.href||e.type)),true);addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));document.addEventListener("securitypolicyviolation",e=>__errors.push("csp:"+e.violatedDirective+" "+e.blockedURI));'});
 const android='Mozilla/5.0 (Linux; Android 13; Phone) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
 const view=(w,h)=>send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:true});
 const shot=async name=>writeFileSync(join(shots,name+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 const open=async url=>{await send('Page.navigate',{url});await until('Boolean(document.querySelector(".app-retired:not([hidden])"))');await evaluate('document.fonts.ready.then(()=>true)');};
 const screen=()=>evaluate(`(()=>{const s=document.querySelector(".app-retired"),link=s.querySelector(".app-retired-download"),box=link.getBoundingClientRect();
  return {visible:getComputedStyle(s).display!=="none"&&s.getBoundingClientRect().height>200,dir:s.dir,lang:s.lang,title:s.querySelector("h1").textContent,text:s.textContent,href:link.href,flavor:link.dataset.retiredDownload,
   others:[...document.body.children].filter(n=>n!==s&&getComputedStyle(n).display!=="none").map(n=>n.tagName+"#"+n.id),overflow:document.documentElement.scrollWidth>innerWidth+1,
   bigButton:box.width>=200&&box.height>=48,focused:document.activeElement===s.querySelector("h1"),arabicLeft:[...s.querySelectorAll("p,li,h1,a,.app-retired-eyebrow")].filter(n=>s.dir==="rtl"&&/[A-Za-z]{4,}/.test(n.textContent.replace(/safeer\\.mohbaba\\.online\\/booking|QR/g,""))).map(n=>n.textContent)};})()`);
 const cases=[['booking',17004,'/marketplace'],['booking',17004,'/booking'],['booking',16200,'/privacy'],['booking',17004,'/'],['driver',18005,'/driver'],['driver',18005,'/track']];
 for(const [flavor,code,path] of cases){
  await send('Emulation.setUserAgentOverride',{userAgent:android+' SafeerApp/'+code+' ('+flavor+')',acceptLanguage:'en-GB'});
  for(const [w,h] of [[360,640],[320,568]]){
   const label=flavor+' '+path+' '+w;await view(w,h);await open(web.origin+path);
   const s=await screen();
   assert.ok(s.visible,label+': screen shown');assert.equal(s.flavor,flavor);assert.equal(s.href,appRelease.apps[flavor].url,label+': current release file');
   assert.deepEqual(s.others,[],label+': the page underneath is hidden');assert.equal(s.overflow,false,label+': no sideways scrolling');assert.ok(s.bigButton,label+': large download button');
   assert.equal(s.title,'This app has been replaced');assert.equal(s.dir,'ltr');assert.ok(s.focused,label+': focus starts on the title');
   assert.ok(s.text.includes(flavor==='driver'?'Download Safeer Driver':'Download Safeer Passenger'));assert.ok(s.text.includes(appRelease.apps[flavor].versionName));
   if(w===360&&['/marketplace','/driver'].includes(path))await shot(flavor+'-en-360');
  }
  // The language button switches the screen only; ?lang=ar opens it in Arabic.
  await evaluate('document.querySelector(".app-retired-lang").click()');
  let s=await screen();assert.equal(s.dir,'rtl');assert.equal(s.lang,'ar');assert.equal(s.title,'تم استبدال هذا التطبيق');assert.equal(s.href,appRelease.apps[flavor].url);assert.deepEqual(s.arabicLeft,[]);
  assert.equal(await evaluate('document.activeElement.className'),'app-retired-lang');
  await open(web.origin+path+'?lang=ar');s=await screen();assert.equal(s.dir,'rtl');assert.deepEqual(s.others,[]);assert.equal(s.overflow,false);assert.deepEqual(s.arabicLeft,[]);
  if(['/marketplace','/driver'].includes(path))await shot(flavor+'-ar-360');
  assert.deepEqual(await evaluate('__errors'),[],flavor+' '+path+': no errors or CSP violations');
 }
 // A phone set to Arabic opens the screen in Arabic without ?lang.
 await send('Emulation.setUserAgentOverride',{userAgent:android+' SafeerApp/17004 (booking)',acceptLanguage:'ar-SD,ar'});await open(web.origin+'/marketplace');
 assert.equal((await screen()).dir,'rtl');
 // The hidden page cannot block the download: its dialogs open without making the screen inert.
 assert.equal(await evaluate(`(async()=>{const d=document.createElement("dialog");d.textContent="Fictional page dialog";document.body.append(d);d.showModal();await new Promise(r=>setTimeout(r,50));
  const link=document.querySelector(".app-retired-download");link.scrollIntoView({block:"center"});const b=link.getBoundingClientRect();
  return d.open&&!d.matches(":modal")&&getComputedStyle(d).display==="none"&&document.elementFromPoint(b.left+b.width/2,b.top+b.height/2)?.closest(".app-retired-download")===link;})()`),true,'a page dialog cannot cover or block the download');

 // Other browsers never see the screen; the booking page offers the new Passenger app.
 await send('Emulation.setUserAgentOverride',{userAgent:android,acceptLanguage:'en-GB'});await view(390,844);
 await send('Page.navigate',{url:web.origin+'/marketplace'});await until('Boolean(document.querySelector(".app-banner a"))');
 assert.equal(await evaluate('Boolean(document.querySelector(".app-retired"))||document.documentElement.classList.contains("app-retired-on")'),false);
 assert.equal(await evaluate('document.querySelector(".app-banner a").href'),appRelease.apps.booking.url);
 assert.match(await evaluate('document.querySelector(".app-banner").textContent'),/Get the app.*Safeer Passenger app/);
 await send('Page.navigate',{url:web.origin+'/'});await until('document.documentElement.classList.contains("hero-ready")');
 assert.equal(await evaluate('Boolean(document.querySelector(".app-retired"))'),false);
 assert.deepEqual(await evaluate('[...document.querySelectorAll("[data-app-download]")].map(a=>a.getAttribute("href"))'),['/mobile/download/booking','/mobile/download/driver']);
 assert.deepEqual(await evaluate('__errors'),[]);
 console.log(`D78 ${built?'built':'source'} retired apps passed: Booking and Driver WebView apps see only the new app's download on 6 pages at 360 and 320 px, English and Arabic (button, ?lang=ar, Arabic phone), focus, no page underneath, nothing can block the button; browsers and the home page offer the Flutter apps through stable download links.`);
}finally{await browser?.close();await web.close();}
