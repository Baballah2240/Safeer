// D139: privacy, terms and deletion pages change with the country: its law and regulator, card payments only
// where cards are taken, and a "not yet available" note where Safeer has not launched. Every country, both languages.
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {startServer} from '../server.mjs';
import {countries} from '../src/countries.js';
const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built});let browser;
const shots=resolve('.qa/legal-countries-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
const open=async(b,path)=>{await b.send('Page.navigate',{url:web.origin+path});await b.until('Boolean(document.getElementById("legal-country"))');
 return b.evaluate(`({text:document.querySelector(".legal-body").innerText,heads:[...document.querySelectorAll(".legal-body h2")].map(h=>h.textContent),draft:Boolean(document.querySelector(".legal-draft")),country:document.getElementById("legal-country").value,title:document.title,fits:document.documentElement.scrollWidth<=innerWidth+2,links:[...document.querySelectorAll(".legal-links a")].map(a=>a.getAttribute("href"))})`);};
try{
 browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-legal-c-')));await browser.send('Page.enable');
 await browser.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 let p=await open(browser,'/privacy?lang=en');
 assert.equal(p.country,'SD');assert.equal(p.draft,false,'Sudan is live');assert.equal(p.heads.includes("Card payments"),false,"no cards in Sudan");assert.ok(p.text.includes('no general personal data law'));
 p=await open(browser,'/privacy?lang=en&country=EG');
 assert.equal(p.draft,true);assert.ok(p.heads.includes("Card payments"));assert.ok(p.text.includes('Law No. 151 of 2020'));assert.ok(p.text.includes('Personal Data Protection Center'));
 assert.ok(p.links.includes('/terms?lang=en&country=EG'),'links keep the country');
 p=await open(browser,'/privacy?lang=en');assert.equal(p.country,'EG','the last chosen country is remembered');
 p=await open(browser,'/terms?lang=ar&country=EG');assert.equal(p.title,'Safeer | شروط الاستخدام');assert.ok(p.text.includes('قانون حماية المستهلك رقم ١٨١'));assert.ok(p.text.includes('Paymob'));
 p=await open(browser,'/terms?lang=en&country=SD');assert.equal(p.text.includes('Paymob'),false);assert.ok(p.text.includes('The law in'));
 assert.deepEqual(Object.keys(countries).sort(),['CF','EG','ER','ET','KW','LY','QA','SA','SD','SS','TD'],'D140: Sudan, its neighbours, SA, QA and KW');
 for(const code of Object.keys(countries))for(const lang of ['en','ar'])for(const page of ['privacy','terms','account-deletion']){
  const r=await open(browser,`/${page}?lang=${lang}&country=${code}`);assert.equal(r.country,code);assert.ok(r.fits,`${page} ${lang} ${code} fits`);
  assert.equal(/undefined|null|\$\{/.test(r.text),false,`${page} ${lang} ${code} has no placeholder`);
 }
 await browser.evaluate('document.getElementById("legal-country").value="TD";document.getElementById("legal-country").dispatchEvent(new Event("change",{bubbles:true}))');
 await browser.until('location.search.includes("country=TD")&&Boolean(document.getElementById("legal-country"))');
 writeFileSync(join(shots,'legal-TD-390.png'),Buffer.from((await browser.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 console.log('legal countries ok');
}finally{await browser?.close();await web.close();}
