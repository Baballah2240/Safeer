import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {fakeGoogle,googleSession} from './support/fake-google.mjs';
import {startServer} from '../server.mjs';

// D75: what Google's brand check reads (a privacy policy covering Google sign-in, the deletion page, home-page
// privacy links with and without JavaScript) and the signed-in Profile's Delete account, in English and Arabic.
const g=await fakeGoogle();Object.assign(process.env,{SAFEER_GOOGLE_CLIENT_ID:'test-client.apps',SAFEER_GOOGLE_CLIENT_SECRET:'test-secret-value',SAFEER_GOOGLE_TEST_BASE:g.base});
let apiOrigin='',browser;const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/passenger-privacy-browser-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-d75-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Network.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));document.addEventListener("securitypolicyviolation",e=>__errors.push("csp:"+e.violatedDirective));'});
 const q=JSON.stringify,text=s=>evaluate(`document.querySelector(${q(s)})?.textContent||''`),click=s=>evaluate(`document.querySelector(${q(s)}).click()`),has=s=>evaluate(`Boolean(document.querySelector(${q(s)}))`);
 const clean=async label=>assert.deepEqual(await evaluate('__errors'),[],label);
 const open=async(path,ready)=>{await send('Page.navigate',{url:web.origin+path});await until(ready);};
 const headings=()=>evaluate('[...document.querySelectorAll(".legal-body h2")].map(h=>h.textContent)');
 const shot=name=>send('Page.captureScreenshot',{format:'png'}).then(r=>writeFileSync(join(shots,name+'.png'),Buffer.from(r.data,'base64')));
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});

 // Privacy policy: Google sign-in, what is kept, Limited Use, in both languages.
 await open('/privacy','Boolean(document.querySelector(".legal-body h2"))');
 assert.ok((await headings()).includes('Google sign-in'),q(await headings()));
 let body=await text('.legal-body');
 for(const words of ['Last updated 12 November 2026','Google account ID, email address and name','not shared with bus companies','Limited Use','we do not keep your Google profile photo'])assert.ok(body.includes(words),words);
 assert.ok(await has('.legal-body a[href="https://developers.google.com/terms/api-services-user-data-policy"]'),'Links the Google API Services User Data Policy.');
 await clean('privacy en');
 await open('/privacy?lang=ar','document.documentElement.lang==="ar"&&Boolean(document.querySelector(".legal-body h2"))');
 assert.ok((await headings()).includes('تسجيل الدخول عبر Google'),q(await headings()));
 assert.ok((await text('.legal-body')).includes('١٢ نوفمبر ٢٠٢٦'),'Arabic date updated too.');
 await clean('privacy ar');

 // Deletion page: passengers delete their own account; no more "Passengers do not create accounts".
 await open('/account-deletion','Boolean(document.querySelector(".legal-body h2"))');
 assert.ok((await headings()).includes('Passenger accounts'));body=await text('.legal-body');
 assert.ok(!body.includes('do not create accounts'),'The outdated sentence is gone.');
 assert.ok(body.includes('Delete account')&&await has('.legal-body a[href="/marketplace?view=profile&lang=en"]'),'Points to Profile.');
 await open('/account-deletion?lang=ar','document.documentElement.lang==="ar"&&Boolean(document.querySelector(".legal-body h2"))');
 assert.ok((await headings()).includes('حسابات الركاب'));
 await clean('deletion pages');

 // Booking home page: visible privacy links, and a description with links that needs no JavaScript.
 await open('/marketplace','Boolean(document.querySelector(".market-hero"))&&Boolean(document.querySelector(".market-legal"))');
 assert.ok(await evaluate(`(()=>{const a=document.querySelector('.market-legal a[href^="/privacy"]');const r=a.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(a).visibility!=='hidden';})()`),'Privacy link is visible on the home page.');
 assert.ok(await has('.market-legal a[href^="/account-deletion"]'));
 const html=await (await fetch(web.origin+'/marketplace')).text();
 assert.match(html,/<meta name="description" content="Safeer: find and book bus trips/);
 assert.match(html,/<noscript>[\s\S]*href="\/privacy"[\s\S]*href="\/account-deletion"[\s\S]*<\/noscript>/,'Links work without JavaScript.');
 await clean('home');

 // Profile: Delete account asks first, focuses "Keep my account", then removes the account and session.
 const signedIn=async(sub,lang='en')=>{
  g.state.claims={sub,email:sub+'@example.com',name:'Fictional '+sub};const session=await googleSession(f.api.origin,g);g.state.claims={};
  await send('Network.setCookie',{name:'safeer_passenger',value:session,url:web.origin+'/api/v1/passenger/me',path:'/api/v1/passenger',httpOnly:true,sameSite:'Strict'});
  await open('/marketplace?view=profile'+(lang==='ar'?'&lang=ar':''),'Boolean(document.querySelector("#account-delete"))');
  return session;
 };
 const session=await signedIn('g-delete');
 assert.ok((await text('.profile-identity')).includes('g-delete@example.com'));
 await click('#account-delete');await until('Boolean(document.querySelector("#account-delete-yes"))');
 assert.equal(await evaluate('document.activeElement?.id'),'account-delete-keep','Keep my account is focused first.');
 assert.ok((await text('.account-delete')).includes('cannot be undone'));
 await click('#account-delete-keep');await until('Boolean(document.querySelector("#account-delete"))');
 assert.equal(await evaluate('document.activeElement?.id'),'account-delete','Focus returns to Delete account.');
 assert.ok((await text('.profile-identity')).includes('g-delete@example.com'),'Keeping changes nothing.');
 await click('#account-delete');await until('Boolean(document.querySelector("#account-delete-yes"))');await shot('delete-confirm-en-1280');
 await click('#account-delete-yes');
 await until('(document.querySelector(".account-notice")?.textContent||"").includes("Your account was deleted.")');
 assert.ok(await has('.google-signin'),'Back to the guest Profile, with sign-in offered again.');
 assert.equal((await (await fetch(f.api.origin+'/api/v1/passenger/me',{headers:{Cookie:'safeer_passenger='+session}})).json()).data.account,null,'The old session no longer works.');
 assert.equal((await f.migration.query("SELECT count(*)::int AS n FROM safeer.passenger_accounts WHERE provider_subject='g-delete'")).rows[0].n,0,'The account is gone.');
 await clean('delete en');

 // Arabic at phone width.
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await signedIn('g-arabic','ar');
 assert.equal((await text('#account-delete')).trim(),'حذف الحساب');
 await click('#account-delete');await until('Boolean(document.querySelector("#account-delete-yes"))');
 assert.ok((await text('.account-delete')).includes('لا يمكن التراجع'));
 assert.equal((await text('#account-delete-yes')).trim(),'احذف حسابي');
 assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'No sideways scrolling on a phone.');
 await evaluate('document.querySelector(".account-delete").scrollIntoView({block:"center"})');await shot('delete-confirm-ar-390');
 await click('#account-delete-keep');await until('Boolean(document.querySelector("#account-delete"))');
 await open('/marketplace?lang=ar','Boolean(document.querySelector(".market-legal"))');
 assert.ok((await text('.market-legal')).includes('سياسة الخصوصية'));
 assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'));await evaluate('document.querySelector(".market-legal").scrollIntoView({block:"center"})');await shot('home-legal-ar-390');
 await clean('arabic phone');
 console.log(`D75 ${built?'built':'source'} browser passed: privacy policy and deletion page cover Google sign-in in English and Arabic, home-page privacy links with and without JavaScript, and Profile Delete account with confirmation, focus, session end and phone layout.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();await g.close();for(const k of ['SAFEER_GOOGLE_CLIENT_ID','SAFEER_GOOGLE_CLIENT_SECRET','SAFEER_GOOGLE_TEST_BASE'])delete process.env[k];}
