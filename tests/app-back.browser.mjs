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
 for(const [path,lang] of [['/company/no-such-company','en'],['/company/no-such-company','ar'],['/track','en']]){
  await send('Page.navigate',{url:`${web.origin}${path}?lang=${lang}`});await until(ready+'&&Boolean(document.querySelector("[data-app-back]"))');
  assert.equal(await evaluate('document.querySelector("[data-app-back]").getAttribute("href")'),lang==='ar'?'/marketplace?lang=ar':'/marketplace');
  const box=await evaluate('JSON.stringify(document.querySelector("[data-app-back]").getBoundingClientRect())').then(JSON.parse);
  assert.ok(box.top<120&&box.width>=44&&box.height>=44,'Back is a 44px target at the top.');
  const menu=await evaluate('JSON.stringify(document.querySelector(".app-menu-trigger").getBoundingClientRect())').then(JSON.parse);
  assert.ok(box.right<=menu.left||box.left>=menu.right,'Back does not cover the menu button.');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),`${path} ${lang} fits`);
  writeFileSync(join(shots,`${path.split('/')[1]}-${lang}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 }
 // From the booking home, Back on an inner page returns there.
 await send('Page.navigate',{url:`${web.origin}/marketplace?lang=en`});await until(ready);
 await evaluate(`location.href='/track?lang=en'`);await until('location.pathname==="/track"&&Boolean(document.querySelector("[data-app-back]"))');
 await evaluate('document.querySelector("[data-app-back]").click()');await until('location.pathname==="/marketplace"');
 console.log('app back ok');
}finally{await browser?.close();await web.close();}
