import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {startServer} from '../server.mjs';

// D89: a passenger searches a middle stop, picks where to board and get off, and holds a seat at that journey's
// price; staff edit the route's price list.
let apiOrigin='',browser;const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/d89-stops-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-d89-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));document.addEventListener("securitypolicyviolation",e=>__errors.push("CSP "+e.violatedDirective));'});
 const settle=()=>new Promise(r=>setTimeout(r,1200)),click=s=>evaluate(`document.querySelector(${JSON.stringify(s)}).click()`),shot=name=>send('Page.captureScreenshot',{format:'png'}).then(r=>writeFileSync(join(shots,name+'.png'),Buffer.from(r.data,'base64')));
 const fill=async(s,value)=>{await until(`Boolean(document.querySelector(${JSON.stringify(s)}))`);await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(s)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));})()`);};
 const pw={currentPassword:f.password},need=r=>{assert.ok(r.status<300,r.raw);return r.data;},day=new Date(Date.now()+5*86400000).toISOString().slice(0,10);
 const cid=need(await f.admin.request('companies','POST',{nameEn:'Fictional Stops',nameAr:'شركة المحطات',slug:'fictional-stops',holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).id,w=need(await f.admin.request('companies/'+cid));need(await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',...pw}));
 const cities=[];for(const [code,en,ar] of [['KRT','Khartoum','الخرطوم'],['WAD','Wad Madani','ود مدني'],['KSL','Kassala','كسلا']])cities.push(need(await f.admin.request('cities','POST',{code,nameEn:en,nameAr:ar,countryCode:'SD',active:true,...pw})).id);
 const base='companies/'+cid,route=need(await f.admin.request(base+'/routes','POST',{code:'R1',nameEn:'Khartoum to Kassala',nameAr:'الخرطوم إلى كسلا',active:true,stops:cities.map(cityId=>({cityId})),...pw})).id;
 const layout=need(await f.admin.request(base+'/fleet/layouts','POST',{code:'L1',nameEn:'Coach',nameAr:'حافلة',active:true,rows:2,columns:2,seats:[1,2,3,4].map(i=>({row:Math.ceil(i/2),column:(i-1)%2+1,label:String(i)})),...pw})).id;
 const bus=need(await f.admin.request(base+'/fleet/buses','POST',{code:'B1',registration:'REG B1',layoutId:layout,layoutRevision:1,active:true,...pw})).id,driver=need(await f.admin.request(base+'/drivers','POST',{employeeCode:'D1',nameEn:'Driver',nameAr:'سائق',active:true,...pw})).id;
 const trip=need(await f.admin.request(base+'/trips','POST',{routeId:route,dates:[day],time:'07:00',offsets:[0,150,480],fareMinor:500000,...pw})).ids[0];
 need(await f.admin.request(`${base}/trips/${trip}/assignment`,'POST',{busId:bus,driverId:driver,version:1,...pw}));need(await f.admin.request(`${base}/trips/${trip}/publish`,'POST',{version:2,...pw}));
 need(await f.admin.request(base+'/public-profile','PUT',{listed:true,aboutEn:'',aboutAr:'',version:0,...pw}));
 // Staff set the price list from Routes.
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:web.origin+'/staff'});await until('Boolean(document.querySelector("#staff-login"))');await fill('[name=login]','owner@safeer.local');await fill('[name=password]',f.password);await evaluate('document.querySelector("#staff-login").requestSubmit()');await until('Boolean(document.querySelector("#staff-logout"))').catch(async error=>{console.log('page errors',await evaluate('JSON.stringify(__errors)'),await evaluate('document.body.innerText.slice(0,400)'));throw error;});
 await click('[data-tab=companies]');await until(`Boolean(document.querySelector('[data-company-open="${cid}"]'))`);await click(`[data-company-open="${cid}"]`);await until('Boolean(document.querySelector("[data-company-section=routes]"))');
 await click('[data-company-section=routes]');await until('Boolean(document.querySelector("[data-route-fares]"))');await click('[data-route-fares]');await until('document.querySelector("#staff-dialog").open&&Boolean(document.querySelector("#staff-dialog [name=fare-0-1]"))');
 assert.equal(await evaluate('document.querySelectorAll("#staff-dialog .route-fares input").length'),2,'Two journeys besides the whole route.');
 await fill('#staff-dialog [name=fare-0-1]','2,000');await fill('#staff-dialog [name=fare-1-2]','3500.50');await fill('#staff-dialog [name=currentPassword]',f.password);await shot('prices-en');
 await evaluate('document.querySelector("#staff-dialog form").requestSubmit()');await until('!document.querySelector("#staff-dialog").open');
 assert.deepEqual(need(await f.admin.request(`${base}/routes/${route}/fares`)).fares.map(x=>x.fareMinor),[200000,350050]);
 // A passenger searches Wad Madani to Kassala.
 for(const [lang,width,height] of [['en',390,844],['ar',390,844],['en',1366,900]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
  await send('Page.navigate',{url:`${web.origin}/marketplace?from=WAD&to=KSL&lang=${lang}`});await until('document.querySelectorAll(".market-trip").length===1');
  assert.ok(await evaluate('document.querySelector(".market-price").textContent.includes("3,500.50")'),`${lang}: the journey price`);
  assert.ok(await evaluate('Boolean(document.querySelector(".market-partial"))'),'Marked as part of the route.');
  assert.equal(await evaluate('document.querySelector("#market-search [name=from]").value'),'WAD','A middle stop can be chosen as the origin.');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),`${lang}/${width} results fit`);await settle();await shot(`results-${lang}-${width}`);
 }
 await click('.market-book');await until('Boolean(document.querySelector("#market-journey"))&&Boolean(document.querySelector("#market-seats button"))');
 assert.match(await evaluate('location.search'),/from=1&to=2/);
 assert.ok(await evaluate('document.querySelector(".market-band h1").textContent.includes("Wad Madani")'));
 assert.equal(await evaluate('document.querySelector("#market-journey [name=from]").value'),'1');
 // Choosing another boarding stop moves to the first priced drop-off and its price.
 await fill('#market-journey [name=from]','0');await until('location.search.includes("from=0&to=1")');
 await until('document.querySelector(".market-band h1").textContent.includes("Khartoum")');
 await click('[data-seat="1"]');await until('Boolean(document.querySelector("#market-summary"))&&document.querySelector("#market-summary").textContent.includes("2,000")');
 await fill('[data-name-seat="1"]','Fictional Traveler');await fill('#market-mobile','0912345678');
 await settle();await shot('trip-en-1366');
 await evaluate('document.querySelector("#market-details").requestSubmit()');await until('location.pathname.startsWith("/hold/")');
 await until('document.body.textContent.includes("Khartoum")&&document.body.textContent.includes("Wad Madani")');
 // Seat 1 is free again from Wad Madani.
 const page=need(await f.client().request(`public/trips/${trip}?from=1&to=2`));assert.equal(page.seats.find(s=>s.label==='1').available,true);
 assert.deepEqual(await evaluate('__errors'),[]);
 console.log('stop-to-stop browser ok');
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
