import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {seedOperations} from './support/demo-operations.mjs';
import {staff} from './support/boarding-fixture.mjs';
import {startServer} from '../server.mjs';

// D65 operations overview with fictional data: KPIs, departures, side panel, attention,
// a real driver scan counted once, a duplicate and a wrong-trip ticket left uncounted.
let apiOrigin='',browser;const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/operations-browser-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-d65-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));document.addEventListener("securitypolicyviolation",e=>__errors.push("CSP "+e.violatedDirective));'});
 const click=s=>evaluate(`document.querySelector(${JSON.stringify(s)}).click()`),shot=name=>send('Page.captureScreenshot',{format:'png'}).then(r=>writeFileSync(join(shots,name+'.png'),Buffer.from(r.data,'base64')));
 const fill=async(s,value)=>{await until(`Boolean(document.querySelector(${JSON.stringify(s)}))`);await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(s)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}));})()`);};
 const s=await seedOperations(f);
 const driver=await staff(f,s,['company.driver.operate']),login=(await driver.c.request('auth/me')).data.login;
 const member=(await f.migration.query('SELECT id FROM safeer.company_users WHERE user_id=(SELECT id FROM safeer.users WHERE normalized_login=$1)',[login])).rows[0].id;
 await f.migration.query('UPDATE safeer.drivers SET member_id=$1 WHERE id=$2',[member,s.drivers.d1]);
 const scan=token=>driver.c.request(`driver/companies/${s.cid}/trips/${s.trips.soon}/board`,'POST',{token});
 const kpi=label=>evaluate(`[...document.querySelectorAll('.ops-kpi')].find(k=>k.textContent.includes(${JSON.stringify(label)}))?.querySelector('strong').textContent`);
 const open=async(lang='en')=>{await send('Page.navigate',{url:web.origin+'/staff?lang='+lang});await until('Boolean(document.querySelector("[data-tab=companies]"))');await click('[data-tab=companies]');await until(`Boolean(document.querySelector('[data-company-open="${s.cid}"]'))`);await click(`[data-company-open="${s.cid}"]`);await until('Boolean(document.querySelector(".ops-kpis .ops-kpi strong"))');};
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:web.origin+'/staff'});await until('Boolean(document.querySelector("#staff-login"))');await fill('[name=login]','owner@safeer.local');await fill('[name=password]',f.password);await evaluate('document.querySelector("#staff-login").requestSubmit()');await until('Boolean(document.querySelector("[data-tab=companies]"))');
 await open();
 assert.equal(await evaluate('document.querySelector(".staff-sidebar [data-company-section][aria-current=page]").textContent'),'Overview','Overview opens first and is selected in the sidebar.');
 assert.deepEqual(await evaluate('[...document.querySelectorAll(".staff-sidebar .company-side-nav")[0].querySelectorAll("button")].map(b=>b.textContent)'),['Overview','Trips','Routes','Bookings','Drivers','Vehicles','Reports']);
 assert.equal(await kpi('Departures today'),'3');assert.equal(await kpi('Passengers booked'),'6');assert.equal(await kpi('Boarded'),'0');assert.equal(await kpi('Needs attention'),'1');
 assert.equal(await evaluate('document.querySelectorAll(".ops-table tbody tr").length'),3);
 assert.ok(await evaluate('document.querySelector(".ops-attention").textContent.includes("Driver unassigned")'),'Unassigned trips are surfaced.');
 assert.ok(await evaluate('Boolean(document.querySelector("#ops-create"))'),'Authorized staff see Create trip.');
 await click(`[data-ops-trip="${s.trips.soon}"]`);await until('Boolean(document.querySelector(".ops-panel .ops-bar"))');
 assert.match(await evaluate('document.querySelector(".ops-progress-label").textContent'),/0\s*of\s*4/);
 assert.equal(await evaluate('document.querySelectorAll(".ops-passengers li").length'),4);await shot('overview-desktop-before');

 const token=s.bookings[0].codes[0].token;
 const first=await scan(token);assert.equal(first.status,201,first.raw);
 await click('#ops-refresh');await until('document.querySelector(".ops-progress-label")?.textContent.replace(/\\s+/g," ").includes("1 of 4")');
 assert.equal(await kpi('Boarded'),'1','The dashboard updates from the confirmed record.');
 assert.equal(await evaluate('document.querySelectorAll(".ops-mini tbody tr").length'),1,'One recent scan.');
 const again=await scan(token);assert.equal(again.data.boardedAt,first.data.boardedAt,'A duplicate scan returns the original boarding.');
 assert.equal((await scan(s.bookings[2].codes[0].token)).error.code,'TICKET_WRONG_TRIP','A wrong-trip ticket is refused.');
 await click('#ops-refresh');await until('Boolean(document.querySelector(".ops-panel .ops-bar"))');await new Promise(r=>setTimeout(r,400));
 assert.equal(await kpi('Boarded'),'1','A duplicate or wrong-trip scan leaves the count unchanged.');
 assert.match(await evaluate('document.querySelector(".ops-progress-label").textContent'),/1\s*of\s*4/);
 await shot('overview-desktop-after');

 for(const [lang,width,height] of [['en',390,844],['ar',390,844],['ar',1440,960],['en',320,740]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});await open(lang);
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),`${lang}/${width} fits`);
  if(lang==='ar')assert.ok(await evaluate('document.body.textContent.includes("نظرة عامة على التشغيل")'),'Arabic heading');
  await click(`[data-ops-trip="${s.trips.soon}"]`);await until('Boolean(document.querySelector(".ops-panel .ops-bar"))');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),`${lang}/${width} panel fits`);
  await shot(`overview-${lang}-${width}`);
 }
 // D81: Latin digits in Arabic, departures as labelled cards on phones, and a company that is not approved says who approves it.
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await open('ar');
 assert.ok(await evaluate('[...document.querySelectorAll(".ops-row-open bdi")].every(n=>/^[0-9]{2}:[0-9]{2}/.test(n.textContent))'),'Arabic times use Latin digits');
 assert.equal(await evaluate('getComputedStyle(document.querySelector(".ops-table tbody tr")).display'),'grid','departures are cards on phones');
 assert.ok(await evaluate('[...document.querySelectorAll(".ops-table tbody td:nth-child(4)")].every(td=>td.dataset.label)'),'every card value is labelled');
 {const w=(await f.admin.request('companies/'+s.cid)).data;assert.equal((await f.admin.request('companies/'+s.cid,'PATCH',{...w.company,id:undefined,status:'pending',currentPassword:f.password})).status,200);}
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});await open('en');await until('Boolean(document.querySelector(".company-approval"))');
 const approvalNote=await evaluate('document.querySelector(".company-approval").textContent');assert.ok(approvalNote.includes('waiting for approval')&&approvalNote.includes('full platform access'),approvalNote);
 await shot('overview-pending-en-1440');
 await click('.company-approval [data-company-edit]');await until('Boolean(document.querySelector("#staff-dialog [name=status]"))');await click('[data-dialog-cancel]');
 {const w=(await f.admin.request('companies/'+s.cid)).data;assert.equal((await f.admin.request('companies/'+s.cid,'PATCH',{...w.company,id:undefined,status:'approved',currentPassword:f.password})).status,200);}
 // Readers without trips access do not get the Overview.
 const clerk=await staff(f,s,['company.profile.read','company.bookings.read']);assert.equal((await clerk.c.request(s.base+'/operations')).status,403);
 assert.deepEqual(await evaluate('__errors'),[]);
 writeFileSync(join(shots,'result.json'),JSON.stringify({passed:true,built},null,2)+'\n');
 console.log('Operations browser: sidebar sections, KPIs, departures, attention, side panel, one counted scan, duplicate and wrong-trip unchanged, phone and Arabic layouts passed.');
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
