import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {ok,setup} from './support/boarding-fixture.mjs';
import {startServer} from '../server.mjs';

// D82: the Safeer owner sets a plan in Plan & contract (which issues a contract PDF to both notification centers),
// and a company sets its colors and logo in Brand & theme, which its workspace and public page then use.
let apiOrigin='',browser;const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/d82-billing-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;const s=await setup(f,'brand-browser');
 browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-d82-')));const {send,evaluate,until}=browser;
 await send('Page.enable');await send('Runtime.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));'});
 const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`),fill=(selector,value)=>evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const submit=async()=>{await fill('#staff-dialog [name=currentPassword]',f.password);await evaluate('document.querySelector("#staff-dialog form").requestSubmit()');await until('!document.querySelector("#staff-dialog").open');};
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:web.origin+'/staff'});await until('Boolean(document.querySelector("#staff-login"))');
 await fill('[name=login]','owner@safeer.local');await fill('[name=password]',f.password);await evaluate('document.querySelector("#staff-login").requestSubmit()');await until('Boolean(document.querySelector("#staff-logout"))');
 await click('[data-tab=companies]');await until('Boolean(document.querySelector("[data-company-open]"))');await click('[data-company-open]');await until('Boolean(document.querySelector("[data-company-section=billing]"))');
 // Plan & contract: set a plan, which lists the contract with a PDF link.
 await click('[data-company-section=billing]');await until('Boolean(document.querySelector("[data-billing-edit]"))');
 assert.ok(await evaluate('document.querySelector(".billing-empty").textContent.includes("No plan yet")'));
 await click('[data-billing-edit]');await until('document.querySelector("#staff-dialog").open');
 // D84: the page behind an open card does not scroll.
 assert.equal(await evaluate('getComputedStyle(document.documentElement).overflowY'),'hidden','The page is locked while a card is open.');
 await fill('#staff-dialog [name=fee]','25,000.50');await fill('#staff-dialog [name=commission]','3.5');await fill('#staff-dialog [name=startsOn]','2026-12-01');await submit();
 assert.notEqual(await evaluate('getComputedStyle(document.documentElement).overflowY'),'hidden','The page scrolls again once the card closes.');
 await until('document.querySelectorAll(".billing-table tbody tr").length===1');
 assert.ok(await evaluate('document.querySelector(".billing-summary").textContent.includes("25,000.50")&&document.querySelector(".billing-summary").textContent.includes("3.5%")'));
 const pdfHref=await evaluate('document.querySelector(".billing-table a[download]").getAttribute("href")');assert.match(pdfHref,/^\/api\/v1\/companies\/[0-9a-f-]+\/contracts\/[0-9a-f-]+\/pdf\?lang=en$/);
 assert.equal(await evaluate(`fetch(${JSON.stringify(pdfHref)}).then(r=>r.headers.get('content-type'))`),'application/pdf');
 assert.equal(await evaluate('document.querySelectorAll("[data-contract-accept]").length'),0,'The Safeer owner cannot accept the contract it issued.');
 // D87: invoices start once the company accepts the contract.
 assert.ok(await evaluate('document.querySelector(".billing-invoices").textContent.includes("Invoices start once a contract is accepted.")'));
 assert.equal(await evaluate('document.querySelectorAll("[data-invoice-issue]").length'),0);
 // Stand in for the company manager's acceptance, then issue last month's invoice from the form.
 await f.migration.query('ALTER TABLE safeer.company_contracts DISABLE TRIGGER contract_guard');
 await f.migration.query(`UPDATE safeer.company_contracts SET accepted_at=now(),accepted_by=issued_by,accepted_by_name='Fictional Manager',starts_on='2020-01-01'`);
 await f.migration.query('ALTER TABLE safeer.company_contracts ENABLE TRIGGER contract_guard');
 await click('#staff-refresh, [data-tab=companies]');await until('Boolean(document.querySelector("[data-company-open]"))').catch(()=>{});
 if(await evaluate('Boolean(document.querySelector("[data-company-open]"))'))await click('[data-company-open]');
 await until('Boolean(document.querySelector("[data-company-section=billing]"))');await click('[data-company-section=billing]');await until('Boolean(document.querySelector("[data-invoice-issue]"))');
 await click('[data-invoice-issue]');await until('document.querySelector("#staff-dialog").open');await submit();
 await until('document.querySelectorAll(".billing-invoices tbody tr").length===1');
 assert.ok(await evaluate('document.querySelector(".billing-invoices tbody").textContent.includes("Awaiting payment")'));
 assert.match(await evaluate('document.querySelector(".billing-invoices a[download]").getAttribute("href")'),/\/invoices\/[0-9a-f-]+\/pdf\?lang=en$/);
 await evaluate('document.querySelector(".billing-invoices").scrollIntoView({block:"start"})');await new Promise(r=>setTimeout(r,900));
 writeFileSync(join(shots,'invoices-en.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 writeFileSync(join(shots,'billing-en.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 // The contract arrives in Notifications with a download link.
 await click('[data-tab=notifications]');await until('Boolean(document.querySelector(".notification-item a[download]"))');
 assert.ok(await evaluate(`[...document.querySelectorAll(".notification-item a[download]")].some(a=>a.getAttribute("href")===${JSON.stringify(pdfHref)})`),'The contract notification links to its PDF.');
 assert.ok(await evaluate('[...document.querySelectorAll(".notification-item a[download]")].some(a=>/\\/invoices\\/[0-9a-f-]+\\/pdf/.test(a.getAttribute("href")))'),'The invoice notification links to its PDF.');
 // Brand & theme: colors and a logo, used by the workspace.
 await click('[data-tab=companies]');await until('Boolean(document.querySelector("[data-company-section=branding]"))');await click('[data-company-section=branding]');await until('Boolean(document.querySelector("[data-brand-edit]"))');
 await click('[data-brand-edit]');await until('document.querySelector("#staff-dialog").open');
 await fill('#staff-dialog [name=primaryColor]','#7a1f3d');await fill('#staff-dialog [name=secondaryColor]','#22313f');
 await evaluate(`(()=>{const bytes=Uint8Array.from(atob(${JSON.stringify(png)}),c=>c.charCodeAt(0)),t=new DataTransfer();t.items.add(new File([bytes],'logo.png',{type:'image/png'}));document.querySelector('#staff-dialog [name=logo]').files=t.files;})()`);
 await submit();await until('Boolean(document.querySelector(".company-side-name img"))');
 assert.equal(await evaluate('getComputedStyle(document.querySelector(".staff-shell")).getPropertyValue("--accent").trim()'),'#7a1f3d');
 assert.equal(await evaluate('getComputedStyle(document.querySelector(".brand-preview-button")).backgroundColor'),'rgb(122, 31, 61)');
 assert.equal(await evaluate('getComputedStyle(document.querySelector("[data-brand-edit]")).backgroundColor'),'rgb(122, 31, 61)','Main buttons use the company color.');
 let layouts=0;
 for(const section of ['billing','branding'])for(const lang of ['en','ar'])for(const [width,height] of [[1366,900],[390,844],[320,740]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
  if(await evaluate('document.documentElement.lang')!==lang)await click('#staff-language');
  await click(`[data-company-section=${section}]`);
  await until(section==='billing'?'Boolean(document.querySelector(".billing-panel"))':'Boolean(document.querySelector(".brand-panel"))');
  await new Promise(r=>setTimeout(r,700));
  if(section==='billing')assert.ok(await evaluate(`document.querySelector(".billing-table a[download]").getAttribute("href").endsWith("?lang=${lang}")`),'The contract PDF follows the page language.');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),`${section}/${lang}/${width} overflow`);assert.deepEqual(await evaluate('__errors'),[]);
  writeFileSync(join(shots,`${section}-${lang}-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));layouts++;
 }
 // The public page shows the logo and the header color.
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:web.origin+'/company/brand-browser?lang=en'});await until('Boolean(document.querySelector(".market-company-logo"))');
 assert.equal(await evaluate('getComputedStyle(document.querySelector(".market-band-brand")).backgroundColor'),'rgb(34, 49, 63)');
 assert.ok(await evaluate('document.querySelector(".market-company-logo").complete&&document.querySelector(".market-company-logo").naturalWidth===1'));
 writeFileSync(join(shots,'public-company.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 assert.deepEqual(await evaluate('__errors'),[]);ok({status:200},200);
 writeFileSync(join(shots,'result.json'),JSON.stringify({passed:true,built,layouts}));
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
