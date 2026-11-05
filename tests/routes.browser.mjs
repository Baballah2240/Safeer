import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {startServer} from '../server.mjs';
let apiOrigin='',browser;const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/section-04-browser-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-s04-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));'});
 const click=s=>evaluate(`document.querySelector(${JSON.stringify(s)}).click()`);
 const fill=async(s,value)=>{await until(`Boolean(document.querySelector(${JSON.stringify(s)}))`);await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(s)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));})()`);};
 const submit=()=>evaluate('document.querySelector("#staff-dialog form").requestSubmit()');
 const saved=async()=>{try{await until('!document.querySelector("#staff-dialog").open');}catch{throw Error('Save failed: '+await evaluate('document.querySelector(".staff-dialog-error")?.textContent||document.body.textContent'));}};
 const password=()=>fill('#staff-dialog [name=currentPassword]',f.password);
 const requireOk=r=>{assert.ok(r.status<300,r.raw);return r.data;};
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:web.origin+'/staff'});await until('Boolean(document.querySelector("#staff-login"))');
 await fill('[name=login]','owner@safeer.local');await fill('[name=password]',f.password);await evaluate('document.querySelector("#staff-login").requestSubmit()');await until('Boolean(document.querySelector("[data-tab=cities]"))');
 await click('[data-tab=cities]');await until('Boolean(document.querySelector("[data-city-create]"))');
 for(const code of ['AA','BB','CC']){await click('[data-city-create]');await fill('#staff-dialog [name=code]',code);await fill('#staff-dialog [name=nameEn]','Fictional City '+code);await fill('#staff-dialog [name=nameAr]','\u0645\u062f\u064a\u0646\u0629 \u062a\u062c\u0631\u064a\u0628\u064a\u0629 '+code);await password();await submit();await saved();}
 const cities=requireOk(await f.admin.request('cities')).items;assert.equal(cities.length,3);
 await click(`[data-city-edit="${cities[0].id}"]`);await fill('#staff-dialog [name=nameEn]','Fictional City Alpha');await password();await submit();await saved();
 const profile={nameEn:'Fictional Route Operator',nameAr:'\u0634\u0631\u0643\u0629 \u062a\u062c\u0631\u064a\u0628\u064a\u0629',slug:'route-browser',holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',currentPassword:f.password};
 const cid=requireOk(await f.admin.request('companies','POST',profile)).id;
 let w=requireOk(await f.admin.request('companies/'+cid));requireOk(await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',currentPassword:f.password}));
 const branch=requireOk(await f.admin.request(`companies/${cid}/branches`,'POST',{code:'MAIN',nameEn:'Fictional Branch',nameAr:'Fictional Branch',active:true,currentPassword:f.password})).id;
 const station=requireOk(await f.admin.request(`companies/${cid}/stations`,'POST',{code:'STATION',branchId:branch,nameEn:'Fictional Station',nameAr:'Fictional Station',active:true,currentPassword:f.password})).id;
 await click('[data-tab=companies]');await until(`Boolean(document.querySelector('[data-company-open="${cid}"]'))`);await click(`[data-company-open="${cid}"]`);await until('Boolean(document.querySelector("[data-company-section=resources]"))');
 await click('[data-company-section=resources]');await click(`[data-resource-edit="stations:${station}"]`);await fill('#staff-dialog [name=cityId]',cities[0].id);await password();await submit();await saved();
 assert.equal(requireOk(await f.admin.request('companies/'+cid)).stations[0].cityId,cities[0].id);
 await click('[data-company-section=routes]');await click('[data-route-create]');await fill('#staff-dialog [name=code]','THREE-STOPS');await fill('#staff-dialog [name=nameEn]','Fictional Three City Route');await fill('#staff-dialog [name=nameAr]','\u0645\u0633\u0627\u0631 \u062a\u062c\u0631\u064a\u0628\u064a');
 await click('[data-stop-add]');
 for(let i=0;i<3;i++)await fill(`#staff-dialog [data-route-stop]:nth-child(${i+1}) [name=cityId]`,cities[i].id);
 await fill('#staff-dialog [data-route-stop]:nth-child(1) [name=stationId]',station);
 await click('#staff-dialog [data-route-stop]:nth-child(3) [data-stop-up]');await password();await submit();await saved();
 const route=requireOk(await f.admin.request(`companies/${cid}/routes`)).items[0],rid=route.id;
 assert.deepEqual(requireOk(await f.admin.request(`companies/${cid}/routes/${rid}`)).stops.map(s=>s.cityId),[cities[0].id,cities[2].id,cities[1].id]);
 await click(`[data-route-view="${rid}"]`);await until('Boolean(document.querySelector(".route-stop-list"))');assert.equal(await evaluate('document.querySelectorAll(".route-stop-list li").length'),3);await click('[data-route-close]');
 await click(`[data-route-edit="${rid}"]`);await until('Boolean(document.querySelector("[data-route-stops]"))');await fill('#staff-dialog [data-route-stop]:nth-child(3) [name=cityId]',cities[0].id);await password();await submit();await until('Boolean(document.querySelector(".staff-dialog-error").textContent)');assert.match(await evaluate('document.querySelector(".staff-dialog-error").textContent'),/2 to 30/);assert.equal(await evaluate('document.querySelector("[data-route-stop] [data-stop-up]").disabled'),true);await click('[data-dialog-cancel]');
 for(const theme of ['dark','light']){if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('[data-theme-toggle]');for(const lang of ['en','ar']){if(await evaluate('document.documentElement.lang')!==lang)await click('#staff-language');for(const [width,height]of [[1920,1080],[1366,768],[390,844],[320,740]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});for(const section of ['routes','editor','cities']){
  if(section==='cities'){await click('[data-tab=cities]');await until('Boolean(document.querySelector("[data-city-create]"))');}
  else {if(!await evaluate('Boolean(document.querySelector(".company-nav"))')){await click('[data-tab=companies]');await until('Boolean(document.querySelector(".company-nav"))');}await click('[data-company-section=routes]');if(section==='editor'){await click(`[data-route-edit="${rid}"]`);await until('Boolean(document.querySelector("[data-route-stops]"))');}}
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),`${theme}/${lang}/${section}/${width}`);assert.ok(await evaluate('!document.querySelector("#staff-dialog").open||document.querySelector("#staff-dialog").getBoundingClientRect().width<=innerWidth'),section);
  writeFileSync(join(shots,`${theme}-${lang}-${section}-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  if(section==='editor')await click('[data-dialog-cancel]');
 }}}}
 assert.deepEqual(await evaluate('window.__errors'),[]);console.log(`Section 04 ${built?'built':'source'} browser passed: city create/edit, station city assignment, route creation, stop selection/reorder/details, inline validation, 48 bilingual/theme/layout combinations and no browser errors.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
