import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {startServer} from '../server.mjs';

const built=process.env.SAFEER_BROWSER_BUILT==='1';
const web=await startServer({port:0,built});
let browser;
try{
 browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-login-')));
 const {send,evaluate,until}=browser;
 await send('Page.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`
 window.__errors=[];addEventListener('error',e=>window.__errors.push(e.message));
 addEventListener('unhandledrejection',e=>window.__errors.push(String(e.reason)));
 window.__loginCalls=0;window.__mode='reject';let initial=true,signedIn=false;
 const nativeFetch=window.fetch.bind(window);
 const principal={id:'fictional-owner',login:'fictional@safeer.local',displayName:'Fictional Owner',roles:[],permissions:[],superAdministrator:false,mustChangePassword:false,csrfToken:'fictional-csrf'};
 const reply=(status,data)=>new Response(JSON.stringify(status===200?{data}:{error:{code:data}}),{status,headers:{'content-type':'application/json'}});
 window.fetch=async(input,options)=>{
  const path=new URL(input,location.href).pathname;
  if(path==='/api/v1/auth/me'){
   if(initial){initial=false;await new Promise(resolve=>window.__releaseSession=resolve);return reply(401,'UNAUTHENTICATED');}
   return signedIn?reply(200,principal):reply(401,'UNAUTHENTICATED');
  }
  if(path==='/api/v1/auth/login'){
   window.__loginCalls++;await new Promise(resolve=>window.__releaseLogin=resolve);
   if(window.__mode==='reject')return reply(401,'INVALID_CREDENTIALS');
   if(window.__mode==='offline')throw Error('Fictional connection failure');
   signedIn=true;return reply(200,{csrfToken:'fictional-csrf'});
  }
  if(path==='/api/v1/driver/trips')return reply(200,{items:[]});
  return nativeFetch(input,options);
 };
 `});
 const fill=(selector,value)=>evaluate(`document.querySelector(${JSON.stringify(selector)}).value=${JSON.stringify(value)}`);
 for(const page of ['staff','driver'])for(const width of [1366,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<700});
  await send('Page.navigate',{url:web.origin+'/'+page});
  const form='#'+page+'-login';
  await until(`Boolean(window.__releaseSession)&&Boolean(document.querySelector('${form}'))`);
  assert.equal(await evaluate(`document.querySelector('${form} button').disabled`),true,'startup must block premature login');
  await fill(form+' [name=login]','fictional@safeer.local');
  await fill(form+' [name=password]','Startup fictional password');
  await evaluate(`document.querySelector('${form}').requestSubmit()`);
  assert.equal(await evaluate('window.__loginCalls'),0);

  await evaluate('window.__releaseSession()');
  await until(`!document.querySelector('${form} button').disabled`);
  await fill(form+' [name=login]','fictional@safeer.local');
  await fill(form+' [name=password]','Fictional password for browser test');
  await evaluate(`document.querySelector('${page==='staff'?'#staff-language':'[data-lang]'}').click()`);
  assert.equal(await evaluate(`document.querySelector('${form} [name=login]').value`),'fictional@safeer.local');
  assert.equal(await evaluate(`document.querySelector('${form} [name=password]').value`),'Fictional password for browser test');
  assert.equal(await evaluate(`document.querySelector('${form}').outerHTML.includes('Fictional password for browser test')`),false,'password must not enter markup');
  await evaluate(`document.querySelector('${form}').requestSubmit()`);
  await until('window.__loginCalls===1');
  await evaluate(`document.querySelector('${page==='staff'?'#staff-language':'[data-lang]'}').click()`);
  assert.equal(await evaluate(`document.querySelector('${form} button').disabled`),true,'rerender must preserve submission lock');
  await evaluate(`document.querySelector('${form}').requestSubmit()`);
  assert.equal(await evaluate('window.__loginCalls'),1,'one login request at a time');
  await evaluate('window.__releaseLogin()');
  await until(`!document.querySelector('${form} button').disabled`);
  assert.equal(await evaluate(`document.querySelector('${form} [name=login]').value`),'fictional@safeer.local');
  assert.equal(await evaluate(`document.querySelector('${form} [name=password]').value`),'');
  assert.ok(await evaluate(`document.querySelector('[role=alert]')?.textContent.trim()`));
  await fill(form+' [name=password]','Another fictional password');
  await evaluate(`window.__mode='offline';document.querySelector('${form}').requestSubmit()`);
  await until('window.__loginCalls===2');await evaluate('window.__releaseLogin()');
  await until(`!document.querySelector('${form} button').disabled`);
  assert.equal(await evaluate(`document.querySelector('${form} [name=login]').value`),'fictional@safeer.local');
  assert.equal(await evaluate(`document.querySelector('${form} [name=password]').value`),'');
  await fill(form+' [name=password]','Successful fictional password');
  await evaluate(`window.__mode='success';document.querySelector('${form}').requestSubmit()`);
  await until('window.__loginCalls===3');await evaluate('window.__releaseLogin()');
  await until(`Boolean(document.querySelector('${page==='staff'?'#change-password':'#driver-trips'}'))`);
  assert.equal(await evaluate(`Boolean(document.querySelector('${form}'))`),false);
  assert.deepEqual(await evaluate('window.__errors'),[]);
 }
 console.log('Login browser regressions passed: Staff/Driver desktop/mobile, startup races, language drafts, pending submission locks, invalid/offline retries, password clearing, and successful sign-in. '+(built?'Built':'Source')+' assets.');
}finally{await browser?.close();await web.close();}
