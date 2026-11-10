import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {startServer} from '../server.mjs';
import {appRelease} from '../src/app-release.js';
const web=await startServer({port:0,built:process.env.SAFEER_BROWSER_BUILT==='1'});
let browser;
try{
 browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-mobile-release-')));
 const {send,evaluate,until}=browser;
 await send('Page.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));document.addEventListener("securitypolicyviolation",e=>__errors.push("CSP "+e.violatedDirective));'});
 const android='Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36';
 const cases=[['browser',android,false,true],['desktop','Mozilla/5.0 (Windows NT 10.0; Win64; x64)',false,false]];
 for(const flavor of ['driver','booking'])for(const [label,code,outdated]of [['installed-0.16.3',16300,true],['installed-0.16.2',16200,true],['old',appRelease.versionCode-1,true],['current',appRelease.versionCode,false],['newer',appRelease.versionCode+1,false]])cases.push([label+'-'+flavor,android+' SafeerApp/'+code+' ('+flavor+')',outdated,outdated]);
 for(const [label,userAgent,outdated,banner]of cases){
  await send('Emulation.setUserAgentOverride',{userAgent});
  await send('Page.navigate',{url:web.origin+'/privacy'});await until('Boolean(document.querySelector("#legal-app h1"))');
  const result=await evaluate('(async()=>{const m=await import("/src/theme.js");return {outdated:m.appOutdated(),en:m.appBanner("en","booking"),ar:m.appBanner("ar","booking"),drawer:m.appDrawerLink("en","booking"),driver:m.appBanner("en","driver"),driverDrawer:m.appDrawerLink("en","driver")};})()');
  assert.equal(result.outdated,outdated,label);assert.equal(Boolean(result.en),banner,label);
  assert.equal(Boolean(result.drawer),!label.startsWith('current')&&!label.startsWith('newer'),label+' drawer');
  if(banner){assert.ok(result.driver.includes(appRelease.apps.driver.url),label+' Driver APK');assert.ok(result.driverDrawer.includes(appRelease.apps.driver.url),label+' Driver menu update');assert.ok(result.en.includes(appRelease.apps.booking.url),label+' exact artifact URL');assert.match(result.ar,/[\u0600-\u06ff]/,label+' Arabic');assert.ok(result.en.includes(outdated?'Download update':'Get the app'));}
  assert.deepEqual(await evaluate('window.__errors'),[],label);
 }
 for(const file of Object.values(appRelease.apps)){const url=new URL(file.url);assert.equal(url.origin,'https://github.com');assert.ok(url.pathname.startsWith('/Baballah2240/Safeer/releases/download/'+appRelease.tag+'/'));assert.match(file.sha256,/^[a-f0-9]{64}$/);assert.ok(file.bytes>1000);}
 console.log('Mobile release notices passed: Android browser, desktop, old/current/newer versions of both apps, exact APK links, Arabic and no browser/CSP errors.');
}finally{await browser?.close();await web.close();}
