import assert from 'node:assert/strict';import {mkdtempSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {chrome} from './support/chrome.mjs';import {startServer} from '../server.mjs';
// D123: on touch phones, the keyboard shows Next until the last field, Enter moves to the next field
// instead of sending the form, and floating bottom bars step aside while typing.
const web=await startServer({port:0,built:process.env.SAFEER_BROWSER_BUILT==='1'});let browser;
try{browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-keyboard-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));'});
 for(const [path,form] of [['/driver?signedout=1','#driver-login'],['/staff','#staff-login']]){
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:740,deviceScaleFactor:2,mobile:true});await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await send('Page.navigate',{url:web.origin+path});await until(`Boolean(document.querySelector('${form} [name=password]'))`,20000);
  assert.ok(await evaluate(`document.querySelector('meta[name=viewport]').content.includes('interactive-widget=resizes-content')`),path+' viewport resizes for the keyboard');
  assert.equal(await evaluate(`matchMedia('(pointer:coarse)').matches`),true);
  await evaluate(`document.querySelector('${form} [name=login]').focus()`);await evaluate(`document.querySelector('${form} [name=password]').focus()`);
  assert.equal(await evaluate(`document.querySelector('${form} [name=login]').getAttribute('enterkeyhint')`),'next',path);
  assert.equal(await evaluate(`document.querySelector('${form} [name=password]').getAttribute('enterkeyhint')`),'go',path);
  // Enter on the first field goes to the password, and the form is not sent.
  await evaluate(`(()=>{window.__sent=0;document.querySelector('${form}').addEventListener('submit',e=>{__sent++;e.preventDefault();},true);document.querySelector('${form} [name=login]').focus();})()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert.equal(await evaluate('document.activeElement.name'),'password',path+' Enter moves to the password');assert.equal(await evaluate('__sent'),0);
  assert.ok(await evaluate(`parseFloat(getComputedStyle(document.querySelector('${form} [name=login]')).fontSize)>=16`),path+' fields stay at 16px so phones do not zoom');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));assert.deepEqual(await evaluate('__errors'),[]);
 }
 // A mouse and keyboard (no touch): Enter keeps sending the form.
 await send('Emulation.setTouchEmulationEnabled',{enabled:false});await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:web.origin+'/driver?signedout=1'});await until(`Boolean(document.querySelector('#driver-login [name=password]'))`,20000);
 assert.equal(await evaluate(`matchMedia('(pointer:coarse)').matches`),false);
 await evaluate(`(()=>{window.__sent=0;document.querySelector('#driver-login').addEventListener('submit',e=>{__sent++;e.preventDefault();e.stopImmediatePropagation();},true);document.querySelector('#driver-login [name=login]').value='fictional@safeer.local';document.querySelector('#driver-login [name=password]').value='fictional-password';document.querySelector('#driver-login [name=login]').focus();})()`);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 assert.equal(await evaluate('__sent'),1,'desktop Enter still sends the form');
 // The floating booking bar hides while the keyboard is open.
 await send('Page.navigate',{url:web.origin+'/booking'});await until('Boolean(document.querySelector(".passenger-bottom-nav"))',20000);
 await evaluate('document.documentElement.classList.add("keyboard-open")');
 assert.equal(await evaluate('getComputedStyle(document.querySelector(".passenger-bottom-nav")).visibility'),'hidden');
 console.log('keyboard browser checks passed');
}finally{await browser?.close();await web.close();}
