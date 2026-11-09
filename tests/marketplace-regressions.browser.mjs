import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {chrome} from './support/chrome.mjs';import {startServer} from '../server.mjs';
const web=await startServer({port:0,built:process.env.SAFEER_BROWSER_BUILT==='1'});let browser;
try{
 browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-gap-probes-')));const {send,evaluate,until}=browser;await send('Page.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`
 window.__requests={};const nativeFetch=fetch.bind(window);const reply=data=>new Response(JSON.stringify({data}),{headers:{'content-type':'application/json'}});
 const row=label=>({id:'00000000-0000-4000-8000-000000000001',companySlug:'fictional',companyNameEn:label,companyNameAr:label,fromNameEn:'A',fromNameAr:'A',toNameEn:'B',toNameAr:'B',date:'2026-11-12',time:'10:00',arrivalTime:'12:00',arrivalDate:'2026-11-12',durationMinutes:120,fareMinor:10000,currency:'SDG',seatsLeft:3,stops:[],busTypeEn:'Fictional bus',busTypeAr:'Fictional bus'});
 window.fetch=async(input,options)=>{const url=new URL(input,location.href);if(!url.pathname.startsWith('/api/v1/public/'))return nativeFetch(input,options);
 if(url.pathname.endsWith('/notice'))return reply({enabled:false});
 if(url.pathname.endsWith('/cities'))return reply({items:[{code:'A',nameEn:'A',nameAr:'A'},{code:'B',nameEn:'B',nameAr:'B'}]});
 if(url.pathname.endsWith('/companies'))return reply({items:[]});
 if(url.pathname.endsWith('/trips')){const from=url.searchParams.get('from');if(!from)return reply({items:[]});await new Promise(resolve=>window.__requests[from]=resolve);return reply({items:[row(from==='A'?'OLD RESULT':'NEW RESULT')]});}
 return reply({});};
 `});
 await send('Page.navigate',{url:web.origin+'/marketplace'});await until('Boolean(document.querySelector("#market-from option[value=A]"))');
 await evaluate(`document.querySelector('#market-from').value='A';document.querySelector('#market-search').requestSubmit()`);await until('Boolean(window.__requests.A)');
 await evaluate(`document.querySelector('#market-from').value='B';document.querySelector('#market-search').requestSubmit()`);await until('Boolean(window.__requests.B)');
 await evaluate('window.__requests.B()');await until('document.body.textContent.includes("NEW RESULT")');
 await evaluate('window.__requests.A()');await evaluate('new Promise(resolve=>setTimeout(resolve,100))');
 const stale=await evaluate(`({filter:new URL(location.href).searchParams.get('from'),hasOld:document.body.textContent.includes('OLD RESULT'),hasNew:document.body.textContent.includes('NEW RESULT')})`);
 assert.equal(stale.filter,'B');assert.equal(stale.hasOld,false);assert.equal(stale.hasNew,true);
 await send('Page.navigate',{url:web.origin+'/marketplace'});await until('Boolean(document.querySelector("#market-from option[value=A]"))');
 await evaluate(`document.querySelector('#market-from').value='A';document.querySelector('#market-from').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#market-date').value='2026-11-12';document.querySelector('#market-date').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#market-menu-toggle').click()`);
 const languageSelector=await evaluate(`[...document.querySelectorAll('button')].find(b=>b.id.includes('language'))?.id||''`);
 await evaluate(`document.querySelector('#'+${JSON.stringify(languageSelector)}).click()`);
 const draft=await evaluate(`({from:document.querySelector('#market-from').value,date:document.querySelector('#market-date').value})`);
 assert.equal(draft.from,'A');assert.equal(draft.date,'2026-11-12');
 console.log('Marketplace regressions passed: latest search wins; language changes preserve city/date drafts.');
}finally{await browser?.close();await web.close();}
