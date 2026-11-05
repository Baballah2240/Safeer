import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {startServer} from '../server.mjs';
let apiOrigin='',browser;const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/section-05-browser-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-s05-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));document.addEventListener("securitypolicyviolation",e=>__errors.push("CSP "+e.violatedDirective));'});
 const click=s=>evaluate(`document.querySelector(${JSON.stringify(s)}).click()`);
 const fill=async(s,value)=>{await until(`Boolean(document.querySelector(${JSON.stringify(s)}))`);await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(s)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));})()`);};
 const submit=()=>evaluate('document.querySelector("#staff-dialog form").requestSubmit()');
 const saved=async()=>{try{await until('!document.querySelector("#staff-dialog").open');}catch{throw Error('Save failed: '+await evaluate('document.querySelector(".staff-dialog-error")?.textContent||document.body.textContent'));}};
 const password=()=>fill('#staff-dialog [name=currentPassword]',f.password);
 const requireOk=r=>{assert.ok(r.status<300,r.raw);return r.data;};
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:web.origin+'/staff'});await until('Boolean(document.querySelector("#staff-login"))');
 await fill('[name=login]','owner@safeer.local');await fill('[name=password]',f.password);await evaluate('document.querySelector("#staff-login").requestSubmit()');await until('Boolean(document.querySelector("[data-tab=companies]"))');
 const cid=requireOk(await f.admin.request('companies','POST',{nameEn:'Fictional Fleet Operator',nameAr:'شركة تجريبية',slug:'fleet-browser',holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',currentPassword:f.password})).id;
 const w=requireOk(await f.admin.request('companies/'+cid));requireOk(await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',currentPassword:f.password}));
 await click('[data-tab=companies]');await until(`Boolean(document.querySelector('[data-company-open="${cid}"]'))`);await click(`[data-company-open="${cid}"]`);await until('Boolean(document.querySelector("[data-company-section=fleet]"))');
 await click('[data-company-section=fleet]');await until('Boolean(document.querySelector("[data-layout-create]"))');assert.equal(await evaluate('Boolean(document.querySelector("[data-bus-create]"))'),false,'A bus needs a layout first.');
 // Create a layout from the starter map, removing one seat to make an extra aisle cell.
 await click('[data-layout-create]');await until('document.querySelectorAll("[data-seat-input]").length===50');assert.match(await evaluate('document.querySelector(".seat-count").textContent'),/^40/);
 await fill('#staff-dialog [name=code]','COACH-40');await fill('#staff-dialog [name=nameEn]','Fictional Coach');await fill('#staff-dialog [name=nameAr]','حافلة تجريبية');
 await fill('[data-seat-input][data-row="1"][data-column="1"]','');await click('[data-seat-number]');assert.match(await evaluate('document.querySelector(".seat-count").textContent'),/^39/);
 assert.ok(await evaluate('document.querySelector("[data-seat-grid]").style.getPropertyValue("--seat-columns")==="5"'));await password();await submit();await saved();
 let fleet=requireOk(await f.admin.request(`companies/${cid}/fleet`));const lid=fleet.layouts[0].id;assert.equal(fleet.layouts[0].revisions[0].seatCount,39);
 // Add a bus, revise the map, and confirm the bus stays on revision 1.
 await until('Boolean(document.querySelector("[data-bus-create]"))');await click('[data-bus-create]');await fill('#staff-dialog [name=code]','BUS-1');await fill('#staff-dialog [name=registration]','KRT 1234');await password();await submit();await saved();
 await until(`Boolean(document.querySelector('[data-layout-revise="${lid}"]'))`);await click(`[data-layout-revise="${lid}"]`);await until('document.querySelectorAll("[data-seat-input]").length===50');await fill('#staff-dialog [name=rows]','11');await until('document.querySelectorAll("[data-seat-input]").length===55');assert.match(await evaluate('document.querySelector(".seat-count").textContent'),/^39/,'Growing the grid keeps typed labels.');await fill('[data-seat-input][data-row="11"][data-column="1"]','X1');await password();await submit();await saved();
 fleet=requireOk(await f.admin.request(`companies/${cid}/fleet`));assert.equal(fleet.layouts[0].latestRevision,2);assert.equal(fleet.buses[0].layoutRevision,1);
 await until(`Boolean(document.querySelector('[data-layout-view="${lid}"]'))`);await click(`[data-layout-view="${lid}"]`);await until('Boolean(document.querySelector(".seat-map"))');assert.equal(await evaluate('document.querySelectorAll(".seat-map .seat-cell").length'),55);await fill('[data-layout-revision]','1');await until('document.querySelectorAll(".seat-map .seat-cell").length===50');assert.equal(await evaluate('document.querySelector(".seat-map").style.getPropertyValue("--seat-columns")'),'5');await click('[data-layout-close]');
 // Retiring a layout under an active bus explains itself in the form.
 await click(`[data-layout-edit="${lid}"]`);await until('Boolean(document.querySelector("#staff-dialog [name=active]"))');await evaluate('document.querySelector("#staff-dialog [name=active]").checked=false');await password();await submit();await until('Boolean(document.querySelector(".staff-dialog-error").textContent)');assert.match(await evaluate('document.querySelector(".staff-dialog-error").textContent'),/active buses/i);await click('[data-dialog-cancel]');
 // Drivers.
 await click('[data-company-section=drivers]');await until('Boolean(document.querySelector("[data-driver-create]"))');await click('[data-driver-create]');await fill('#staff-dialog [name=employeeCode]','DRV-1');await fill('#staff-dialog [name=nameEn]','Fictional Driver');await fill('#staff-dialog [name=nameAr]','سائق تجريبي');await fill('#staff-dialog [name=phone]','+249 900 000 000');await password();await submit();await saved();
 const did=requireOk(await f.admin.request(`companies/${cid}/drivers`)).items[0].id;await until(`Boolean(document.querySelector('[data-driver-edit="${did}"]'))`);assert.ok(await evaluate('document.body.textContent.includes("+249 900 000 000")'));
 await click('[data-company-section=fleet]');await until(`Boolean(document.querySelector('[data-layout-view="${lid}"]'))`);
 for(const theme of ['dark','light']){if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('[data-theme-toggle]');for(const lang of ['en','ar']){if(await evaluate('document.documentElement.lang')!==lang)await click('#staff-language');for(const [width,height]of [[1920,1080],[1366,768],[390,844],[320,740]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});for(const section of ['fleet','editor','map','drivers']){
  await click(`[data-company-section=${section==='drivers'?'drivers':'fleet'}]`);await until(section==='drivers'?'Boolean(document.querySelector("[data-driver-create]"))':'Boolean(document.querySelector("[data-layout-view]"))');
  if(section==='editor'){await click(`[data-layout-revise="${lid}"]`);await until('document.querySelectorAll("[data-seat-input]").length>0');}
  if(section==='map'){await click(`[data-layout-view="${lid}"]`);await until('Boolean(document.querySelector(".seat-map"))');}
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),`${theme}/${lang}/${section}/${width}`);assert.ok(await evaluate('!document.querySelector("#staff-dialog").open||document.querySelector("#staff-dialog").getBoundingClientRect().width<=innerWidth'),section);
  writeFileSync(join(shots,`${theme}-${lang}-${section}-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  if(section==='editor')await click('[data-dialog-cancel]');if(section==='map')await click('[data-layout-close]');
 }}}}
 assert.deepEqual(await evaluate('window.__errors'),[]);console.log(`Section 05 ${built?'built':'source'} browser passed: seat-map editing, revisions, bus assignment, layout protection, drivers, 64 bilingual/theme/layout combinations and no browser or security-policy errors.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
