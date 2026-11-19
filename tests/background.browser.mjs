import assert from 'node:assert/strict';import {mkdtempSync,writeFileSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {chrome} from './support/chrome.mjs';import {startServer} from '../server.mjs';
// D127: on phones the page background is one fixed layer as tall as the largest viewport, so it neither scrolls
// away (iPhone ignores background-attachment:fixed) nor rescales when the address bar hides.
const web=await startServer({port:0,built:process.env.SAFEER_BROWSER_BUILT==='1'});let browser;
const shots=process.env.SAFEER_BACKGROUND_SHOTS;
try{browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-background-')));const {send,evaluate,until}=browser;
 await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 for(const [path,layer,photo] of [['/booking','::before',true],['/track','::after'],['/privacy','::after'],['/driver?signedout=1','::before']]){
  await send('Page.navigate',{url:web.origin+path});await until('document.readyState==="complete"',20000);await new Promise(r=>setTimeout(r,600));
  const read=`(()=>{const s=getComputedStyle(document.body,'${layer}');return {position:s.position,top:s.top,height:s.height,attachment:getComputedStyle(document.body).backgroundAttachment,image:s.backgroundImage!=='none'}})()`;
  const before=await evaluate(read);
  assert.equal(before.position,'fixed',path+' background layer is fixed');assert.ok(before.image,path+' layer has the background');
  assert.notEqual(before.attachment,'fixed',path+' no background-attachment:fixed');
  assert.ok(parseFloat(before.height)>=844,path+' layer covers the screen');
  if(photo){assert.match(await evaluate(`getComputedStyle(document.body,'::before').backgroundImage`),/coach-/,path+' bus photo');assert.equal(await evaluate('getComputedStyle(document.body).backgroundColor'),'rgba(0, 0, 0, 0)',path+' nothing paints over the bus photo');}
  if(shots)writeFileSync(join(shots,path.replace(/\W+/g,'_')+'-top.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate('scrollTo(0,Math.min(900,document.documentElement.scrollHeight-innerHeight))');await new Promise(r=>setTimeout(r,300));
  assert.deepEqual(await evaluate(read),before,path+' layer keeps its place and size while scrolling');
  if(shots)writeFileSync(join(shots,path.replace(/\W+/g,'_')+'-scrolled.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),path+' no sideways scroll');
 }
 console.log('PASS steady phone backgrounds');
}finally{await browser?.close();await web.close?.();}
