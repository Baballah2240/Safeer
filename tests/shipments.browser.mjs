import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {startServer} from '../server.mjs';

// D59 staff walkthrough with fictional data: prices, a paid two-item shipment, receipt,
// tag, journey, refused and accepted hand-over, phone layout and Arabic.
let apiOrigin='',browser;const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/shipments-browser-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-d59-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];window.__prints=0;window.print=()=>{window.__prints++;};addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));document.addEventListener("securitypolicyviolation",e=>__errors.push("CSP "+e.violatedDirective));'});
 const click=s=>evaluate(`document.querySelector(${JSON.stringify(s)}).click()`),shot=name=>send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}).then(r=>writeFileSync(join(shots,name+'.png'),Buffer.from(r.data,'base64')));
 const fill=async(s,value)=>{await until(`Boolean(document.querySelector(${JSON.stringify(s)}))`);await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(s)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));})()`);};
 const submit=()=>evaluate('document.querySelector("#staff-dialog form").requestSubmit()'),dialogText=()=>evaluate('document.querySelector("#staff-dialog").textContent');
 const pw={currentPassword:f.password},need=r=>{assert.ok(r.status<300,r.raw);return r.data;},day=d=>new Date(Date.now()+d*86400000).toISOString().slice(0,10);
 const cid=need(await f.admin.request('companies','POST',{nameEn:'Fictional Nile',nameAr:'شركة النيل',slug:'fictional-nile-parcels',holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).id,w=need(await f.admin.request('companies/'+cid));need(await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',...pw}));
 const cities=[];for(const [code,en,ar] of [['KRT','Khartoum','الخرطوم'],['PZU','Port Sudan','بورتسودان']])cities.push(need(await f.admin.request('cities','POST',{code,nameEn:en,nameAr:ar,countryCode:'SD',active:true,...pw})).id);
 const base='companies/'+cid,route=need(await f.admin.request(base+'/routes','POST',{code:'R1',nameEn:'Khartoum to Port Sudan',nameAr:'الخرطوم إلى بورتسودان',active:true,stops:cities.map(cityId=>({cityId})),...pw})).id;
 const layout=need(await f.admin.request(base+'/fleet/layouts','POST',{code:'L1',nameEn:'Coach',nameAr:'حافلة',active:true,rows:2,columns:2,seats:[{row:1,column:1,label:'1'},{row:1,column:2,label:'2'},{row:2,column:1,label:'3'},{row:2,column:2,label:'4'}],...pw})).id;
 const bus=need(await f.admin.request(base+'/fleet/buses','POST',{code:'B1',registration:'REG B1',layoutId:layout,layoutRevision:1,active:true,...pw})).id,driver=need(await f.admin.request(base+'/drivers','POST',{employeeCode:'D1',nameEn:'Driver One',nameAr:'Driver One',active:true,...pw})).id;
 const trip=need(await f.admin.request(base+'/trips','POST',{routeId:route,dates:[day(5)],time:'07:00',offsets:[0,720],fareMinor:300000,...pw})).ids[0];need(await f.admin.request(`${base}/trips/${trip}/assignment`,'POST',{busId:bus,driverId:driver,version:1,...pw}));need(await f.admin.request(`${base}/trips/${trip}/publish`,'POST',{version:2,...pw}));
 const branch=need(await f.admin.request(base+'/branches','POST',{nameEn:'Fictional Branch',nameAr:'فرع تجريبي',code:'BR1',active:true,...pw})).id;
 const origin=need(await f.admin.request(base+'/stations','POST',{nameEn:'Khartoum Office',nameAr:'مكتب الخرطوم',code:'ST1',branchId:branch,active:true,...pw})).id;
 const destination=need(await f.admin.request(base+'/stations','POST',{nameEn:'Port Sudan Office',nameAr:'مكتب بورتسودان',code:'ST2',branchId:branch,active:true,...pw})).id;
 const counter=need(await f.admin.request(base+'/counters','POST',{stationId:origin,code:'c1',name:'Counter 1',...pw})).id;need(await f.admin.request(base+'/counter/sessions','POST',{counterId:counter,openingMinor:0}));

 const open=async(lang='en')=>{await send('Page.navigate',{url:web.origin+'/staff?lang='+lang});await until('Boolean(document.querySelector("[data-tab=companies]"))');await click('[data-tab=companies]');await until(`Boolean(document.querySelector('[data-company-open="${cid}"]'))`);await click(`[data-company-open="${cid}"]`);await until('Boolean(document.querySelector("[data-company-section=shipments]"))');await click('[data-company-section=shipments]');await until('Boolean(document.querySelector("#shipment-results:not([aria-busy])"))');};
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:web.origin+'/staff'});await until('Boolean(document.querySelector("#staff-login"))');await fill('[name=login]','owner@safeer.local');await fill('[name=password]',f.password);await evaluate('document.querySelector("#staff-login").requestSubmit()');await until('Boolean(document.querySelector("[data-tab=companies]"))');
 await open();
 assert.ok(await evaluate('document.body.textContent.includes("No shipments yet.")'));

 // Without prices, New shipment explains what to do instead of opening an empty form.
 await click('#shipment-new');await until('document.querySelector("#shipment-notice").textContent.includes("price list")');
 await click('#shipment-prices');await until('Boolean(document.querySelector("#staff-dialog[open] [name=price_small]"))');
 await fill('[name=price_small]','300');await fill('[name=price_envelope]','100');await submit();
 await until('!document.querySelector("#staff-dialog").open');await until('Boolean(document.querySelector("#shipment-results:not([aria-busy])"))');
 assert.deepEqual((await f.migration.query('SELECT category,price_minor FROM safeer.shipment_prices WHERE company_id=$1 ORDER BY category',[cid])).rows.map(r=>[r.category,r.price_minor]),[['envelope',10000],['small',30000]]);

 await click('#shipment-new');await until('Boolean(document.querySelector("#staff-dialog[open] [name=tripId]"))');
 assert.ok(await evaluate(`![...document.querySelectorAll('[name=destinationId] option')].some(o=>o.value==='${origin}')`),'The current office is not offered as a destination.');
 assert.ok(await evaluate('document.querySelector("[name=category] option[value=large]").disabled'),'Unpriced types cannot be chosen.');
 await fill('[name=tripId]',trip);await fill('[name=destinationId]',destination);
 await fill('[name=senderName]','Fictional Sender');await fill('[name=senderMobile]','0912345678');await fill('[name=receiverName]','Fictional Receiver');await fill('[name=receiverMobile]','0998765432');
 await fill('[name=category]','small');await fill('[name=kilos]','2.5');await click('[data-item-add]');
 await evaluate(`(()=>{const items=document.querySelectorAll('[data-item]');const s=items[1].querySelector('select');s.value='envelope';s.dispatchEvent(new Event('change',{bubbles:true}));items[1].querySelector('[name=kilos]').value='0.1';})()`);
 assert.match(await evaluate('document.querySelector("[data-total]").textContent'),/400/,'The total updates as items are added.');
 assert.equal(await evaluate('document.querySelector("#staff-dialog form").checkValidity()'),false,'The contents declaration is required before saving.');
 await evaluate('document.querySelector("[name=declared]").checked=true');await submit();
 await until('document.querySelector("#staff-dialog[open] .shipment-receipt")!==null');
 const receipt=await dialogText();assert.match(receipt,/RCP-\d{8}/);assert.match(receipt,/SH-[2-9A-HJ-NP-Z]{8}/);assert.match(receipt,/400/);assert.match(receipt,/Port Sudan Office/);
 await shot('receipt');await click('[data-sheet-done]');await until('Boolean(document.querySelector(".shipment-record"))');
 const row=(await f.migration.query('SELECT id,amount_minor FROM safeer.shipments WHERE company_id=$1',[cid])).rows[0];assert.equal(row.amount_minor,40000);

 await click('[data-tag]');await until('document.querySelector("#staff-dialog[open] .luggage-qr")!==null');assert.ok(await evaluate('window.__prints>0'),'Printing starts straight away.');
 await click('[data-sheet-done]');await until('Boolean(document.querySelector("[data-move][data-to=loaded]"))');
 await click('[data-move][data-to=loaded]');await until('document.querySelector(".shipment-record .staff-badge").textContent==="Loaded"');
 await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.trips SET departure_at=clock_timestamp()-interval '1 minute',arrival_at=clock_timestamp()+interval '719 minutes' WHERE id=$1",[trip]);await f.migration.query('SET session_replication_role=DEFAULT');
 await click('#shipment-refresh');await until('Boolean(document.querySelector("[data-move][data-to=in_transit]"))');await click('[data-move][data-to=in_transit]');
 await until('Boolean(document.querySelector("[data-move][data-to=arrived]"))');await click('[data-move][data-to=arrived]');await until('Boolean(document.querySelector("[data-deliver]"))');
 await click('[data-deliver]');await until('Boolean(document.querySelector("#staff-dialog[open] [name=receiverName]"))');
 await fill('[name=receiverMobile]','0998765432');await fill('[name=receiverName]','Someone Else');await submit();
 await until('document.querySelector(".staff-dialog-error").textContent.includes("does not match")');
 await fill('[name=receiverName]','fictional receiver');await submit();await until('!document.querySelector("#staff-dialog").open');
 await until('document.querySelector(".shipment-record .staff-badge")?.textContent==="Delivered"');await shot('delivered-desktop');

 // Public tracking: status and offices only.
 const code=(await f.migration.query('SELECT tracking_code FROM safeer.shipments WHERE company_id=$1',[cid])).rows[0].tracking_code;
 for(const [lang,width] of [['en',1366],['ar',390],['en',320]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<700});
  await send('Page.navigate',{url:web.origin+'/track?lang='+lang+'&code='+code});await until('Boolean(document.querySelector(".track-result"))');
  const page=await evaluate('document.body.innerText');
  assert.ok(page.includes(lang==='ar'?'سُلّمت':'Delivered')&&page.includes(lang==='ar'?'مكتب بورتسودان':'Port Sudan Office'),'Tracking shows status and destination '+lang);
  for(const secret of ['Fictional Receiver','Fictional Sender','998765432','912345678','SHP-'])assert.equal(page.includes(secret),false,'Tracking hides '+secret);
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'Tracking fits '+width);await shot('track-'+lang+'-'+width);
 }
 await send('Page.navigate',{url:web.origin+'/track?lang=en'});await until('Boolean(document.querySelector("#track-form"))');
 await fill('#track-form [name=code]','nonsense');await evaluate('document.querySelector("#track-form").requestSubmit()');await until('Boolean(document.querySelector("#track-problem"))');
 await fill('#track-form [name=code]','SH-22222222');await evaluate('document.querySelector("#track-form").requestSubmit()');await until('document.querySelector("#track-problem")?.textContent.includes("could not find")');
 await send('Page.navigate',{url:web.origin+'/marketplace?lang=en'});await until('Boolean(document.querySelector("#market-menu a[href*=track]"))');
 for(const [lang,width,height] of [['en',390,844],['ar',390,844],['ar',1366,900],['en',320,740]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});await open(lang);
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),`${lang}/${width} fits`);
  if(lang==='ar')assert.ok(await evaluate('document.body.textContent.includes("الشحنات")&&document.body.textContent.includes("سُلّمت")'),'Arabic labels');
  await shot(`list-${lang}-${width}`);
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await open('en');
 await click('#shipment-new');await until('Boolean(document.querySelector("#staff-dialog[open] [name=tripId]"))');
 assert.ok(await evaluate('document.querySelector("#staff-dialog").getBoundingClientRect().right<=innerWidth+1'),'The form fits a phone.');await shot('new-phone');
 assert.deepEqual(await evaluate('__errors'),[]);
 writeFileSync(join(shots,'result.json'),JSON.stringify({passed:true,built},null,2)+'\n');
 console.log('Shipments browser: prices, paid two-item shipment with receipt, tag, journey, refused/accepted hand-over, phone and Arabic layouts passed.');
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
