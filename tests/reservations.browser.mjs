import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {startServer} from '../server.mjs';
let apiOrigin='',browser;const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/section-08-browser-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-s08-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));document.addEventListener("securitypolicyviolation",e=>__errors.push("CSP "+e.violatedDirective));'});
 const click=s=>evaluate(`document.querySelector(${JSON.stringify(s)}).click()`),seat=label=>`[data-seat="${label}"]`;
 const fill=async(s,value)=>{await until(`Boolean(document.querySelector(${JSON.stringify(s)}))`);await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(s)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));})()`);};
 const pw={currentPassword:f.password},need=r=>{assert.ok(r.status<300,r.raw);return r.data;},day=d=>new Date(Date.now()+d*86400000).toISOString().slice(0,10);
 const cid=need(await f.admin.request('companies','POST',{nameEn:'Fictional Nile',nameAr:'شركة النيل',slug:'fictional-nile',holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).id,w=need(await f.admin.request('companies/'+cid));need(await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',...pw}));
 const cities=[];for(const [code,en,ar] of [['KRT','Khartoum','الخرطوم'],['PZU','Port Sudan','بورتسودان']])cities.push(need(await f.admin.request('cities','POST',{code,nameEn:en,nameAr:ar,countryCode:'SD',active:true,...pw})).id);
 const base='companies/'+cid,route=need(await f.admin.request(base+'/routes','POST',{code:'R1',nameEn:'Khartoum to Port Sudan',nameAr:'الخرطوم إلى بورتسودان',active:true,stops:cities.map(cityId=>({cityId})),...pw})).id;
 const seats=[];let n=0;for(let row=1;row<=4;row++)for(const column of [1,2,4,5])seats.push({row,column,label:String(++n)});
 const layout=need(await f.admin.request(base+'/fleet/layouts','POST',{code:'L1',nameEn:'16-seat coach',nameAr:'حافلة 16 مقعداً',active:true,rows:4,columns:5,seats,...pw})).id;
 const bus=need(await f.admin.request(base+'/fleet/buses','POST',{code:'B1',registration:'REG B1',layoutId:layout,layoutRevision:1,active:true,...pw})).id,driver=need(await f.admin.request(base+'/drivers','POST',{employeeCode:'D1',nameEn:'Driver One',nameAr:'Driver One',active:true,...pw})).id;
 const id=need(await f.admin.request(base+'/trips','POST',{routeId:route,dates:[day(5)],time:'07:00',offsets:[0,720],fareMinor:300000,...pw})).ids[0];need(await f.admin.request(`${base}/trips/${id}/assignment`,'POST',{busId:bus,driverId:driver,version:1,...pw}));need(await f.admin.request(`${base}/trips/${id}/publish`,'POST',{version:2,...pw}));
 need(await f.admin.request(base+'/public-profile','PUT',{listed:true,aboutEn:'',aboutAr:'',phone:'+249 900 000 000',version:0,...pw}));
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
 // A passenger finds the trip and opens its seat map with no account.
 await send('Page.navigate',{url:web.origin+'/marketplace'});await until('Boolean(document.querySelector(".market-book"))');assert.ok(await evaluate('document.querySelector(".market-trip").textContent.includes("16 seats left")'));
 await click('.market-book');await until(`Boolean(document.querySelector('${seat(1)}'))`);assert.equal(await evaluate('location.pathname'),'/trip/'+id);
 assert.equal(await evaluate('document.querySelector("#market-hold").disabled'),true,'Nothing can be held before choosing a seat.');
 assert.equal(await evaluate(`getComputedStyle(document.querySelector('${seat(3)}')).gridColumnStart`),'4','Seats follow the saved aisle.');
 await click(seat(1));await click(seat(2));await until('document.querySelector("#market-summary").textContent.includes("1, 2")');assert.equal(await evaluate(`document.querySelector('${seat(1)}').getAttribute('aria-pressed')`),'true');assert.ok(await evaluate('document.querySelector("#market-summary").textContent.includes("6,000")'),'The total follows the selection.');
 await click(seat(2));await until('!document.querySelector("#market-summary").textContent.includes("1, 2")');await click(seat(2));
 // Someone else takes a seat while this page is open: the hold is refused whole and the page says why.
 const rival=need(await f.client().request('public/holds','POST',{tripId:id,seats:['2'],key:crypto.randomUUID()}));
 await click('#market-hold');await until('document.querySelector("#market-summary [role=alert]")?.textContent.includes("just taken")');
 assert.equal(await evaluate(`document.querySelector('${seat(2)}').disabled`),true);assert.equal(await evaluate(`document.querySelector('${seat(1)}').getAttribute('aria-pressed')`),'true','Seats still free stay selected.');
 assert.equal(await evaluate('location.pathname'),'/trip/'+id);
 // The hold shows a reference and a countdown based on the server's time.
 // The first reply is lost after the server has committed: the page must keep the key and recover that same hold, not call the seat taken.
 await evaluate(`(()=>{const real=window.fetch;window.fetch=async(url,init)=>{if(String(url).endsWith('/public/holds')&&!window.__lost){window.__lost=1;await real(url,init);throw new TypeError('lost reply');}return real(url,init);};})()`);
 const seatsBeforeLoss=need(await f.client().request('public/trips/'+id)).seatsLeft;
 await click('#market-hold');await until('document.querySelector("#market-summary [role=alert]")?.textContent.includes("could not confirm")');
 assert.equal(await evaluate(`document.querySelector('${seat(1)}').getAttribute('aria-pressed')`),'true','The seat stays selected, not called taken.');assert.equal(need(await f.client().request('public/trips/'+id)).seatsLeft,seatsBeforeLoss-1,'The server did hold it.');
 await click('#market-hold');await until('Boolean(document.querySelector(".market-reference"))');assert.equal(need(await f.client().request('public/trips/'+id)).seatsLeft,seatsBeforeLoss-1,'The retry returned the same hold instead of creating another.');
 assert.equal(await evaluate('document.activeElement.id'),'market-hold-title','Focus moves to the result.');
 const reference=await evaluate('document.querySelector(".market-reference").textContent');assert.match(reference,/^SF-[2-9A-HJ-NP-Z]{8}$/);assert.equal(await evaluate('location.pathname'),'/hold/'+reference);
 const first=await evaluate('document.querySelector("#market-timer").textContent');assert.match(first,/^(29|30):\d\d$/);await until(`document.querySelector("#market-timer").textContent!==${JSON.stringify(first)}`);
 assert.equal(await evaluate('Boolean(document.querySelector("input"))'),false,'No personal details are requested.');
 // Reloading keeps the hold on this device. Another browser with only the reference gets nothing.
 await send('Page.reload');await until('Boolean(document.querySelector(".market-reference"))');assert.equal(await evaluate('document.querySelector(".market-reference").textContent'),reference);
 assert.equal((await f.client().request('public/holds/'+reference,'GET',undefined,{'X-Booking-Key':crypto.randomUUID()})).status,404);
 const held=need(await f.client().request('public/trips/'+id));assert.equal(held.seatsLeft,14);
 // Staff see the holds, and a reader cannot release one. The admin releases it with a reason.
 const ref2=rival.reference;
 await send('Page.navigate',{url:web.origin+'/staff'});await until('Boolean(document.querySelector("#staff-login"))');await fill('[name=login]','owner@safeer.local');await fill('[name=password]',f.password);await evaluate('document.querySelector("#staff-login").requestSubmit()');await until('Boolean(document.querySelector("[data-tab=companies]"))');
 await click('[data-tab=companies]');await until(`Boolean(document.querySelector('[data-company-open="${cid}"]'))`);await click(`[data-company-open="${cid}"]`);await until('Boolean(document.querySelector("[data-company-section=trips]"))');await click('[data-company-section=trips]');await until(`Boolean(document.querySelector('[data-trip-seats="${id}"]'))`);await click(`[data-trip-seats="${id}"]`);
 await until('document.querySelector("#staff-dialog")?.open&&document.querySelector("#staff-dialog").textContent.includes("Seats and holds")');assert.equal(await evaluate('document.querySelectorAll("#staff-dialog .trip-seat.held").length'),2);assert.ok(await evaluate(`document.querySelector("#staff-dialog").textContent.includes(${JSON.stringify(reference)})&&document.querySelector("#staff-dialog").textContent.includes(${JSON.stringify(ref2)})`));
 writeFileSync(join(shots,'staff-seats.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await click(`#staff-dialog [data-hold-reference="${reference}"]`);await until('Boolean(document.querySelector("#staff-dialog [name=reason]"))');await fill('#staff-dialog [name=reason]','Fictional counter request');await fill('#staff-dialog [name=currentPassword]',f.password);await evaluate('document.querySelector("#staff-dialog form").requestSubmit()');await until('!document.querySelector("#staff-dialog").open');
 assert.equal(need(await f.client().request('public/trips/'+id)).seatsLeft,15);
 // The passenger's page reports it, and they can start again.
 await send('Network.clearBrowserCookies');await send('Page.navigate',{url:`${web.origin}/hold/${reference}`});await until('document.body.textContent.includes("The company released these seats")');assert.equal(await evaluate('Boolean(document.querySelector("#market-timer"))'),false);await click('.market-book');await until(`Boolean(document.querySelector('${seat(1)}'))`);
 // A passenger can release their own hold, after confirming.
 await click(seat(3));await click('#market-hold');await until('Boolean(document.querySelector("#market-release"))');await click('#market-release');await until('Boolean(document.querySelector("#market-keep"))');assert.equal(await evaluate('document.activeElement.id'),'market-keep');await click('#market-keep');await until('Boolean(document.querySelector("#market-release"))');assert.equal(need(await f.client().request('public/trips/'+id)).seatsLeft,14,'Keeping changes nothing.');
 await click('#market-release');await until('Boolean(document.querySelector("#market-release-yes"))');await click('#market-release-yes');await until('document.body.textContent.includes("You released these seats")');assert.equal(need(await f.client().request('public/trips/'+id)).seatsLeft,15);
 // Another device with only the link is told how to get help, without any hold details.
 await evaluate('localStorage.clear()');await send('Page.reload');await until('document.querySelector("[role=alert]")?.textContent.includes("device that made it")');
 await send('Page.navigate',{url:web.origin+'/trip/00000000-0000-4000-8000-000000000000'});await until('document.querySelector("[role=alert]")?.textContent.includes("no longer available")');
 // Every layout, including the hold page, in both languages and themes.
 const hold=need(await f.client().request('public/holds','POST',{tripId:id,seats:['5','6','7'],key:'11111111-1111-4111-8111-111111111111'}));
 await send('Page.navigate',{url:web.origin+'/marketplace'});await until('Boolean(document.querySelector("[data-theme-toggle]"))');await evaluate(`localStorage.setItem('safeer-hold-${hold.reference}','11111111-1111-4111-8111-111111111111')`);
 for(const theme of ['dark','light']){await send('Page.navigate',{url:web.origin+'/marketplace'});await until('Boolean(document.querySelector("[data-theme-toggle]"))');if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('[data-theme-toggle]');for(const lang of ['en','ar'])for(const [width,height]of [[1920,1080],[1366,768],[390,844],[320,740]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});for(const [name,path,ready] of [['trip','/trip/'+id,'.market-seat'],['hold','/hold/'+hold.reference,'.market-reference']]){
  await send('Page.navigate',{url:`${web.origin}${path}?lang=${lang}`});await until(`Boolean(document.querySelector("${ready}"))`);assert.equal(await evaluate('document.documentElement.dir'),lang==='ar'?'rtl':'ltr');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),`${theme}/${lang}/${name}/${width}`);
  if(name==='trip'){assert.equal(await evaluate('document.querySelector(".market-seats").dir'),'ltr','The bus keeps its real left and right.');assert.ok(await evaluate('[...document.querySelectorAll(".market-seat")].every(n=>n.getBoundingClientRect().height>=44&&n.getBoundingClientRect().width>=30)'),`seat size ${theme}/${lang}/${width}`);}
  writeFileSync(join(shots,`${theme}-${lang}-${name}-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));
  assert.deepEqual(await evaluate('window.__errors'),[],`${theme}/${lang}/${name}/${width}`);
 }}}
 console.log(`Section 08 ${built?'built':'source'} browser passed: seat selection, a seat lost to another passenger, hold reference and server-timed countdown, reload, staff view and release, passenger release, other-device refusal, 32 bilingual/theme/layout combinations and no browser or security-policy errors.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
