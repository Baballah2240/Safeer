import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {startServer} from '../server.mjs';

// D88: the privacy and account deletion pages have a Back button: it returns to the Safeer page the reader came
// from, and goes to the home page when the page was opened directly.
const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built});let browser;
const shots=resolve('.qa/legal-back-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{
 browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-legal-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Runtime.enable');
 for(const [page,lang,width] of [['privacy','en',390],['account-deletion','ar',390],['privacy','ar',1280]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<700});
  await send('Page.navigate',{url:`${web.origin}/${page}?lang=${lang}`});await until('document.querySelectorAll("[data-legal-back]").length===2');
  assert.equal(await evaluate('document.querySelector("[data-legal-back]").getAttribute("href")'),`/?lang=${lang}`,'Opened directly, Back goes home.');
  assert.ok(await evaluate('document.querySelector(".legal-top [data-legal-back]").getBoundingClientRect().top<120'),'Back is at the top of the page.');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),`${page}/${lang}/${width} fits`);
  writeFileSync(join(shots,`${page}-${lang}-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 }
 // Coming from the booking site, Back returns there.
 await send('Page.navigate',{url:`${web.origin}/marketplace?lang=en`});await until('document.readyState==="complete"');
 await evaluate(`location.href='/privacy?lang=en'`);await until('location.pathname==="/privacy"&&Boolean(document.querySelector("[data-legal-back]"))');
 await evaluate('document.querySelector("[data-legal-back]").click()');await until('location.pathname==="/marketplace"');
 console.log('legal back ok');
}finally{await browser?.close();await web.close();}
