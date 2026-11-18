// Measures how long each page takes to fetch its scripts and styles on a slow phone connection
// (250 ms latency, about 1.6 Mbps), against the built site served locally, or a deployed site given as the
// first argument (read-only page loads, nothing is signed in or changed). Usage: node scripts/measure-loading.mjs [origin]
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chrome} from '../tests/support/chrome.mjs';
import {startServer} from '../server.mjs';

const remote=process.argv[2],web=remote?{origin:remote.replace(/\/$/,''),close:async()=>{}}:await startServer({port:0,built:true,identityApiUrl:()=>'http://127.0.0.1:9'});let browser;
try{
 browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-measure-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
 await send('Network.emulateNetworkConditions',{offline:false,latency:250,downloadThroughput:200000,uploadThroughput:100000});
 for(const page of ['/staff','/marketplace','/track','/driver']){
  const runs=[];
  for(let i=0;i<3;i++){
   await send('Page.navigate',{url:web.origin+page});await until('document.readyState==="complete"',30000);
   await new Promise(r=>setTimeout(r,300));
   runs.push(await evaluate('(()=>{const r=performance.getEntriesByType("resource").filter(e=>/\\.(js|css)$/.test(new URL(e.name).pathname));return {files:r.length,ready:Math.round(Math.max(...r.map(e=>e.responseEnd))),load:Math.round(performance.getEntriesByType("navigation")[0].loadEventEnd)}})()'));
  }
  runs.sort((a,b)=>a.ready-b.ready);const m=runs[1];
  console.log(`${page.padEnd(13)} ${String(m.files).padStart(3)} files  scripts and styles ready ${m.ready} ms  load ${m.load} ms`);
 }
}finally{await browser?.close();await web.close();}
