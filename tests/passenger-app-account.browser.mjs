import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {setup,ok} from './support/boarding-fixture.mjs';
import {startServer} from '../server.mjs';

// D72: Google refuses sign-in inside embedded app views and the Android shell opens only Safeer pages,
// so the installed Booking app shows where account sign-in works instead of a button that cannot work.
// Contact links stay plain tel:/mailto: links, which the Android shell hands to the dialer or mail app.
Object.assign(process.env,{SAFEER_GOOGLE_CLIENT_ID:'test-client.apps',SAFEER_GOOGLE_CLIENT_SECRET:'test-secret-value'});
let apiOrigin='',browser;
const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const browserUa='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;const s=await setup(f,'app-account');
 const profile=ok(await f.admin.request(s.base+'/public-profile'),200);
 ok(await f.admin.request(s.base+'/public-profile','PUT',{listed:true,aboutEn:'',aboutAr:'',phone:'+249 911 000 000',email:'office@app-account.example',version:profile.version,...s.pw}),200);
 browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-app-account-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));document.addEventListener("securitypolicyviolation",e=>__errors.push("csp:"+e.violatedDirective));'});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const profilePage=async lang=>{await send('Page.navigate',{url:web.origin+'/marketplace?view=profile'+(lang==='ar'?'&lang=ar':'')});await until('Boolean(document.querySelector(".profile-identity"))&&!document.querySelector(".app-loading")');await until('Boolean(document.querySelector(".google-signin,[data-account-app-note]"))');};
 for(const lang of ['en','ar']){
  await send('Emulation.setUserAgentOverride',{userAgent:browserUa});await profilePage(lang);
  assert.match(await evaluate('document.querySelector(".google-signin")?.getAttribute("href")||""'),/^\/api\/v1\/passenger\/google\/start\?return=/,lang+' browser offers Google sign-in');
  assert.equal(await evaluate('Boolean(document.querySelector("[data-account-app-note]"))'),false);
  await send('Emulation.setUserAgentOverride',{userAgent:browserUa+' SafeerApp/17004 (booking)'});await profilePage(lang);
  assert.equal(await evaluate('Boolean(document.querySelector(".google-signin"))'),false,lang+' installed app hides the Google button');
  const note=await evaluate('document.querySelector("[data-account-app-note]").textContent');
  assert.ok(lang==='ar'?note.includes('Google')&&/[\u0600-\u06ff]/.test(note):note.includes('website'),note);
  assert.ok(await evaluate('Boolean(document.querySelector(".profile-identity a.primary[href*=\\"/booking\\"]"))'),'My Trips stays available to guests');
 }
 // Company contacts are tel:/mailto: links the Android shell opens in the phone's own apps.
 await send('Page.navigate',{url:web.origin+'/company/app-account'});await until('Boolean(document.querySelector(".market-facts"))');
 assert.equal(await evaluate('document.querySelector(".market-facts a[href^=\\"tel:\\"]")?.getAttribute("href")'),'tel:+249911000000');
 assert.equal(await evaluate('document.querySelector(".market-facts a[href^=\\"mailto:\\"]")?.getAttribute("href")'),'mailto:office@app-account.example');
 assert.deepEqual(await evaluate('__errors'),[]);
});}finally{await browser?.close();await web.close();}
console.log('Passenger app account: browser Google sign-in, installed-app guidance in English and Arabic, and contact links passed.');
