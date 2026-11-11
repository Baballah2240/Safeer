import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {startServer} from '../server.mjs';
let apiOrigin='',browser;const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/section-06-browser-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-s06-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));document.addEventListener("securitypolicyviolation",e=>__errors.push("CSP "+e.violatedDirective));'});
 const click=s=>evaluate(`document.querySelector(${JSON.stringify(s)}).click()`);
 const fill=async(s,value)=>{await until(`Boolean(document.querySelector(${JSON.stringify(s)}))`);await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(s)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));})()`);};
 const submit=()=>evaluate('document.querySelector("#staff-dialog form").requestSubmit()');
 const saved=async()=>{try{await until('!document.querySelector("#staff-dialog").open');}catch{throw Error('Save failed: '+await evaluate('document.querySelector(".staff-dialog-error")?.textContent||document.body.textContent'));}};
 const password=()=>fill('#staff-dialog [name=currentPassword]',f.password);
 const pw={currentPassword:f.password},need=r=>{assert.ok(r.status<300,r.raw);return r.data;},date=new Date(Date.now()+864000000).toISOString().slice(0,10);
 const cid=need(await f.admin.request('companies','POST',{nameEn:'Fictional Trip Operator',nameAr:'شركة تجريبية',slug:'trip-browser',holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).id,w=need(await f.admin.request('companies/'+cid));need(await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',...pw}));
 const cities=[];for(const code of ['AA','BB'])cities.push(need(await f.admin.request('cities','POST',{code,nameEn:'City '+code,nameAr:'مدينة '+code,countryCode:'SD',active:true,...pw})).id);
 const base='companies/'+cid,route=need(await f.admin.request(base+'/routes','POST',{code:'R1',nameEn:'Fictional Route',nameAr:'مسار تجريبي',active:true,stops:cities.map(cityId=>({cityId})),...pw})).id;
 const layout=need(await f.admin.request(base+'/fleet/layouts','POST',{code:'L1',nameEn:'Fictional Coach',nameAr:'حافلة',active:true,rows:1,columns:2,seats:[{row:1,column:1,label:'1'},{row:1,column:2,label:'2'}],...pw})).id;
 for(const code of ['B1','B2'])need(await f.admin.request(base+'/fleet/buses','POST',{code,registration:'REG '+code,layoutId:layout,layoutRevision:1,active:true,...pw}));
 for(const code of ['D1','D2'])need(await f.admin.request(base+'/drivers','POST',{employeeCode:code,nameEn:'Driver '+code,nameAr:'سائق '+code,active:true,...pw}));
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:web.origin+'/staff'});await until('Boolean(document.querySelector("#staff-login"))');
 await fill('[name=login]','owner@safeer.local');await fill('[name=password]',f.password);await evaluate('document.querySelector("#staff-login").requestSubmit()');await until('Boolean(document.querySelector("[data-tab=companies]"))');
 await click('[data-tab=companies]');await until(`Boolean(document.querySelector('[data-company-open="${cid}"]'))`);await click(`[data-company-open="${cid}"]`);await until('Boolean(document.querySelector("[data-company-section=trips]"))');await click('[data-company-section=trips]');await until('Boolean(document.querySelector("[data-trip-create]"))');
 // Schedule: choosing a route fills the stop times; a date range makes one trip per chosen weekday.
 await click('[data-trip-create]');await until('Boolean(document.querySelector("[data-trip-route]"))');await fill('[data-trip-route]',route);await until('document.querySelectorAll("[name=offset]").length===2');await fill('#staff-dialog [name=date]',date);await fill('#staff-dialog [name=time]','08:30');await fill('#staff-dialog [name=fare]','1500.50');await password();await submit();await saved();
 let trips=need(await f.admin.request(base+'/trips')).items;assert.equal(trips.length,1);assert.equal(trips[0].fareMinor,150050);assert.equal(trips[0].time,'08:30');const tid=trips[0].id;
 // D72: a later "Show trips from" day leaves earlier trips out; clearing the day brings them back.
 await until(`Boolean(document.querySelector('[data-trip-view="${tid}"]'))`);await fill('#trip-from',new Date(Date.parse(date+'T12:00:00Z')+2*86400000).toISOString().slice(0,10));
 await until(`!document.querySelector('[data-trip-view="${tid}"]')&&Boolean(document.querySelector('#trip-from')?.value)`);await fill('#trip-from','');await until(`Boolean(document.querySelector('[data-trip-view="${tid}"]'))`);
 // Publishing too early explains itself in the form.
 await until(`Boolean(document.querySelector('[data-trip-publish="${tid}"]'))`);await click(`[data-trip-publish="${tid}"]`);await password();await submit();await until('Boolean(document.querySelector(".staff-dialog-error").textContent)');assert.match(await evaluate('document.querySelector(".staff-dialog-error").textContent'),/bus, a driver/i);await click('[data-dialog-cancel]');await until('!document.querySelector("#staff-dialog").firstChild');
 await click(`[data-trip-assign="${tid}"]`);await until('Boolean(document.querySelector("#staff-dialog [name=busId]"))');await password();await submit();await saved();
 await until(`Boolean(document.querySelector('[data-trip-publish="${tid}"]'))`);await click(`[data-trip-publish="${tid}"]`);await password();await submit();await saved();assert.equal(need(await f.admin.request(`${base}/trips/${tid}`)).trip.status,'published');
 await until(`!document.querySelector('[data-trip-edit="${tid}"]')&&Boolean(document.querySelector('[data-trip-assign="${tid}"]'))`);await click(`[data-trip-assign="${tid}"]`);await until('Boolean(document.querySelector("#staff-dialog [name=reason]"))');await fill('#staff-dialog [name=busId]',need(await f.admin.request(base+'/fleet')).buses[1].id);await fill('#staff-dialog [name=reason]','Fictional breakdown');await password();await submit();await saved();
 await until(`Boolean(document.querySelector('[data-trip-view="${tid}"]'))`);await click(`[data-trip-view="${tid}"]`);await until('document.querySelectorAll(".trip-assignment").length===2');assert.ok(await evaluate('document.querySelector("#staff-dialog").textContent.includes("Fictional breakdown")'));await click('[data-trip-close]');await until('!document.querySelector("#staff-dialog").firstChild');
 for(const theme of ['dark','light']){if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('[data-theme-toggle]');for(const lang of ['en','ar']){if(await evaluate('document.documentElement.lang')!==lang)await click('#staff-language');for(const [width,height]of [[1920,1080],[1366,768],[390,844],[320,740]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});for(const section of ['list','create','detail']){
  await click('[data-company-section=trips]');await until('Boolean(document.querySelector("[data-trip-view]"))');
  if(section==='create'){await click('[data-trip-create]');await until('Boolean(document.querySelector("[data-trip-route]"))');}
  if(section==='detail'){await click(`[data-trip-view="${tid}"]`);await until('Boolean(document.querySelector(".route-stop-list"))');}
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),`${theme}/${lang}/${section}/${width}`);assert.ok(await evaluate('!document.querySelector("#staff-dialog").open||document.querySelector("#staff-dialog").getBoundingClientRect().width<=innerWidth'),section);
  writeFileSync(join(shots,`${theme}-${lang}-${section}-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  if(section==='create')await click('[data-dialog-cancel]');if(section==='detail')await click('[data-trip-close]');await until('!document.querySelector("#staff-dialog").firstChild');
 }}}}
 assert.deepEqual(await evaluate('window.__errors'),[]);console.log(`Section 06 ${built?'built':'source'} browser passed: scheduling with stop times and fare, publish checks, assignment, publication, reassignment with history, 48 bilingual/theme/layout combinations and no browser or security-policy errors.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
