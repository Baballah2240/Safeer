import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {startServer} from '../server.mjs';

// D91: inner screens of the booking and tracking apps have a Back button in the top bar; the main
// booking screen does not. Opened directly, Back goes to the booking home; otherwise it goes back.
const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built});let browser;
const shots=resolve('.qa/app-back-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
const ready='Boolean(document.querySelector(".app-masthead .app-menu-trigger"))';
try{
 browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-back-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Page.navigate',{url:`${web.origin}/marketplace?lang=en`});await until(ready);
 await new Promise(r=>setTimeout(r,300));
 assert.equal(await evaluate('document.querySelectorAll("[data-app-back]").length'),0,'No Back on the booking home.');
 // D112: no Back button on any booking or parcel page.
 for(const [path,lang] of [['/company/no-such-company','en'],['/company/no-such-company','ar'],['/track','en']]){
  await send('Page.navigate',{url:`${web.origin}${path}?lang=${lang}`});await until(ready);await new Promise(r=>setTimeout(r,300));
  assert.equal(await evaluate('document.querySelectorAll("[data-app-back]").length'),0,`No Back on ${path} ${lang}.`);
 }
 console.log('app back ok');
}finally{await browser?.close();await web.close();}
