import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {startServer} from '../server.mjs';
import {appRelease} from '../src/app-release.js';
const web=await startServer({port:0,built:process.env.SAFEER_BROWSER_BUILT==='1'});let browser;
try{
 browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-mobile-release-')));const {send,evaluate,until}=browser;await send('Page.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));document.addEventListener("securitypolicyviolation",e=>__errors.push("CSP "+e.violatedDirective));'});
 const android='Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36';
 const cases=[{label:'browser',ua:android},{label:'desktop',ua:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}];
 for(const flavor of ['driver','booking']){const current=appRelease.apps[flavor].versionCode||appRelease.versionCode;for(const code of [16200,17000,current-1,current,current+1])cases.push({label:flavor+'/'+code,ua:android+' SafeerApp/'+code+' ('+flavor+')',flavor,code});}
 for(const c of cases){await send('Emulation.setUserAgentOverride',{userAgent:c.ua});await send('Page.navigate',{url:web.origin+'/privacy'});await until('Boolean(document.querySelector("#legal-app h1"))');
  const result=await evaluate('(async()=>{const m=await import("/src/theme.js");return Object.fromEntries(["driver","booking"].map(f=>[f,{outdated:m.appOutdated(f),banner:m.appBanner("en",f),ar:m.appBanner("ar",f),drawer:m.appDrawerLink("en",f),version:m.appVersionLabel(f)}]));})()');
  for(const flavor of ['driver','booking']){const file=appRelease.apps[flavor],version=file.versionName||appRelease.versionName,code=file.versionCode||appRelease.versionCode,same=c.flavor===flavor,outdated=Boolean(same&&c.code<code),banner=outdated||c.label==='browser'||Boolean(c.flavor&&!same);assert.equal(result[flavor].outdated,outdated,c.label+'/'+flavor);assert.equal(Boolean(result[flavor].banner),banner,c.label+'/'+flavor);assert.equal(Boolean(result[flavor].drawer),!same||outdated||flavor==='driver');assert.equal(result[flavor].version,'v'+version);
   if(banner){assert.ok(result[flavor].banner.includes(file.url));assert.ok(result[flavor].banner.includes(outdated?'Download update':'Get the app'));assert.match(result[flavor].ar,/[\u0600-\u06ff]/);}}
  assert.deepEqual(await evaluate('__errors'),[],c.label);
 }
 assert.equal(appRelease.apps.booking.versionCode||appRelease.versionCode,17003);assert.match(appRelease.apps.booking.sha256,/^[0-9a-f]{64}$/);
 for(const file of Object.values(appRelease.apps)){const url=new URL(file.url);assert.equal(url.origin,'https://github.com');assert.ok(url.pathname.startsWith('/Baballah2240/Safeer/releases/download/'+(file.tag||appRelease.tag)+'/'));assert.match(file.sha256,/^[a-f0-9]{64}$/);assert.ok(file.bytes>1000);}
 console.log('Independent release notices passed: Driver 17 offers 18, Booking 17 stays current, browser/cross-flavor downloads and exact artifact links.');
}finally{await browser?.close();await web.close();}
