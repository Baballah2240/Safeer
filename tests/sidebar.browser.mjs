import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {startServer} from '../server.mjs';

let apiOrigin='',browser;
const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const shots=resolve('.qa/sidebar-'+(built?'built':'source'));mkdirSync(shots,{recursive:true});
try{await identityFixture(async f=>{
 apiOrigin=f.api.origin;browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-sidebar-')));
 const {send,evaluate,until}=browser;await send('Page.enable');await send('Network.enable');
 const cookie=f.admin.cookie,i=cookie.indexOf('=');await send('Network.setCookie',{name:cookie.slice(0,i),value:cookie.slice(i+1),url:web.origin,httpOnly:true,sameSite:'Strict'});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));'});
 const settle=()=>evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 const key=async(key,code,virtual)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtual,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual});};
 let layouts=0;
 for(const [path,ready,languageButton,content,field] of [['/staff','.staff-shortcuts','#staff-language','.staff-content','#change-password [name=currentPassword]'],['/','.metrics','#language-button','.workspace','#company-select']]){
  for(const language of ['en','ar'])for(const theme of ['light','dark'])for(const [width,height] of [[1920,1080],[1366,768],[390,844],[320,740]]){
   const name=`${path}/${language}/${theme}/${width}`;
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
   await send('Page.navigate',{url:web.origin+path+'?lang='+language});await until(`Boolean(document.querySelector('${ready}'))`);
   if(await evaluate('document.documentElement.dataset.theme')!==theme)await evaluate('document.querySelector("[data-theme-toggle]").click()');
   if(await evaluate('document.documentElement.dataset.sidebarHidden')==='true')await evaluate('document.querySelector("[data-sidebar-toggle]").click()');
   await settle();
   assert.ok(await evaluate(`(()=>{const b=document.querySelector('[data-sidebar-toggle]'),s=document.getElementById(b.getAttribute('aria-controls'));return b.getBoundingClientRect().bottom<=s.getBoundingClientRect().top+1&&!b.closest('header');})()`),name+' toggle above sidebar');
   const before=await evaluate(`document.querySelector('${content}').getBoundingClientRect().width`);
   await evaluate(`window.__field=document.querySelector('${field}');window.__value=__field.value;window.__expected=__field.tagName==='SELECT'?__value:'unchanged';window.__field.value=__expected;document.querySelector('[data-sidebar-toggle]').focus()`);
   await key('Enter','Enter',13);await settle();
   assert.equal(await evaluate('document.querySelector("[data-sidebar-toggle]").getAttribute("aria-expanded")'),'false',name);
   assert.ok(await evaluate(`(()=>{const b=document.querySelector('[data-sidebar-toggle]'),s=document.getElementById(b.getAttribute('aria-controls'));return getComputedStyle(s).display==='none'&&s.getClientRects().length===0&&b.getBoundingClientRect().width>=44&&document.activeElement===b;})()`),name+' hidden navigation / keyboard');
   assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),name+' hidden overflow');
   assert.ok(await evaluate(`(()=>{const b=document.querySelector('[data-sidebar-toggle]'),r=b.getBoundingClientRect();return r.top>=0&&r.left>=0&&r.right<=innerWidth&&document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('[data-sidebar-toggle]')===b;})()`),name+' restore button visible and clickable');
   assert.ok(await evaluate(`document.querySelector('${field}')===window.__field&&__field.value===window.__expected`),name+' preserve form');
   await evaluate('window.__field.value=window.__value');
   if(width>760)assert.ok(await evaluate(`document.querySelector('${content}').getBoundingClientRect().width`)>before+150,name+' workspace expands');
   await key('Tab','Tab',9);
   assert.ok(await evaluate('!document.activeElement.closest(".staff-sidebar,.sidebar")'),name+' hidden navigation not tabbable');
   await evaluate(`document.querySelector('${languageButton}').click()`);await settle();
   assert.equal(await evaluate('document.querySelector("[data-sidebar-toggle]").getAttribute("aria-expanded")'),'false',name+' rerender');
   assert.equal(await evaluate('document.querySelector("[data-sidebar-toggle]").getAttribute("aria-label")'),language==='en'?'إظهار القائمة الجانبية':'Show sidebar',name+' translated restore');
   await send('Page.reload');await until(`Boolean(document.querySelector('${ready}'))`);
   assert.equal(await evaluate('document.documentElement.dataset.sidebarHidden'),'true',name+' saved after reload');
   await evaluate('document.querySelector("[data-sidebar-toggle]").focus()');await key(' ','Space',32);await settle();
   assert.equal(await evaluate('document.querySelector("[data-sidebar-toggle]").getAttribute("aria-expanded")'),'true',name+' restore with Space');
   assert.ok(await evaluate('document.querySelector(".staff-sidebar,.sidebar").getClientRects().length>0'),name+' visible again');
   assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),name+' restored overflow');
   if(width===1366&&theme==='dark'&&language==='en')writeFileSync(join(shots,path==='/staff'?'staff.png':'preview.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
   assert.deepEqual(await evaluate('__errors'),[],name);layouts++;
  }
 }
 // A storage change in another tab must move focus out of the hidden sidebar.
 await evaluate(`document.querySelector('.sidebar button').focus();dispatchEvent(new StorageEvent('storage',{key:'safeer.sidebar.hidden',newValue:'1'}))`);
 assert.ok(await evaluate('document.activeElement.matches("[data-sidebar-toggle]")'));
 await send('Emulation.setEmulatedMedia',{media:'print'});
 assert.equal(await evaluate('getComputedStyle(document.querySelector("[data-sidebar-toggle]")).display'),'none');
 writeFileSync(join(shots,'result.json'),JSON.stringify({passed:true,built,layouts,keyboard:true,persistence:true,formPreservation:true,languageRerender:true,crossTabFocus:true,printIsolation:true},null,2)+'\n');
 console.log(`Sidebar toggle: ${layouts} layouts, keyboard hide/restore, saved preference, preserved forms, translated re-renders, focus and print passed.`);
},{webOrigin:web.origin});}finally{await browser?.close();await web.close();}
