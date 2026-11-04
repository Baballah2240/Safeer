import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chrome} from './support/chrome.mjs';
import {identityFixture} from './support/identity-db.mjs';
import {startServer} from '../server.mjs';
let apiOrigin='',browser;
const built=process.env.SAFEER_BROWSER_BUILT==='1',web=await startServer({port:0,built,identityApiUrl:()=>apiOrigin});
const directory=resolve('.qa/section-02-browser-'+(built?'built':'source'));mkdirSync(directory,{recursive:true});
try{
  await identityFixture(async f=>{
    apiOrigin=f.api.origin;
    browser=await chrome(mkdtempSync(join(tmpdir(),'safeer-s02-browser-')));
    const {send,evaluate,until}=browser;
    await send('Page.enable');await send('Page.bringToFront');
    await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>window.__errors.push(e.message));addEventListener("unhandledrejection",e=>window.__errors.push(String(e.reason)));'});
    const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const fill=async(selector,value)=>{await until(`Boolean(document.querySelector(${JSON.stringify(selector)}))${selector.startsWith('#staff-dialog')?'&&document.querySelector("#staff-dialog").open':''}`);return evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}));})()`);};
    const submit=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`);
    const shot=async name=>writeFileSync(join(directory,name+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    const signIn=async(email,pass)=>{await until('Boolean(document.querySelector("#staff-login"))');await fill('[name=login]',email);await fill('[name=password]',pass);await submit('#staff-login');try{await until('Boolean(document.querySelector("#change-password"))');}catch(error){throw Error('Sign-in did not finish: '+await evaluate('document.querySelector("[role=alert]")?.textContent||document.querySelector(".staff-main").textContent')+'; JS errors: '+JSON.stringify(await evaluate('window.__errors')));}};
    const tab=async(name,ready)=>{await click(`[data-tab="${name}"]`);await until(`Boolean(document.querySelector(${JSON.stringify(ready)}))`);};
    await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:web.origin+'/staff'});
    await signIn('owner@safeer.local',f.password);
    assert.equal(await evaluate('document.documentElement.dataset.theme'),'dark');
    await click('[data-theme-toggle]');assert.equal(await evaluate('document.documentElement.dataset.theme'),'light');
    await send('Page.reload');await until('Boolean(document.querySelector("#change-password"))');
    assert.equal(await evaluate('document.documentElement.dataset.theme'),'light');
    await click('[data-theme-toggle]');assert.equal(await evaluate('document.documentElement.dataset.theme'),'dark');
    assert.equal(await evaluate('document.querySelectorAll(".staff-summary article").length'),3);
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".staff-shortcuts button")].map(b=>b.dataset.tab).sort()'),['audit','cities','companies','notifications','platform','roles','sessions','users']);
    await click('.staff-shortcuts [data-tab=users]');await until('Boolean(document.querySelector("[data-create-user]"))');
    await tab('users','[data-create-user]');await click('[data-create-user]');
    await fill('#staff-dialog [name=displayName]','Fictional <img src=x onerror="window.__xss=true">');
    await fill('#staff-dialog [name=login]','browser-staff@safeer.local');await fill('#staff-dialog [name=currentPassword]',f.password);await submit('#staff-dialog form');
    await until('Boolean(document.querySelector(".staff-secret"))');
    const temporaryPassword=await evaluate('document.querySelector(".staff-secret").textContent');
    assert.ok(temporaryPassword.length>=20);await click('[data-close-secret]');
    await until('!document.querySelector("#staff-dialog").open');
    assert.equal(await evaluate('document.querySelector(".staff-record img")'),null);
    assert.equal(await evaluate('Boolean(window.__xss)'),false);
    const user=(await f.admin.request('identity/users')).data.items.find(u=>u.login==='browser-staff@safeer.local');
    await click(`[data-assign-user="${user.id}"]`);await until('Boolean(document.querySelector("#staff-dialog input[name=roleIds]"))');
    await evaluate(`document.querySelector('#staff-dialog input[value="00000000-0000-4000-8000-000000000002"]').checked=true`);
    await fill('#staff-dialog [name=currentPassword]',f.password);await submit('#staff-dialog form');await until('!document.querySelector("#staff-dialog").open');
    await fill('#staff-search','browser-staff@safeer.local');
    assert.equal(await evaluate('document.querySelectorAll(".staff-record:not([hidden])").length'),1);
    assert.ok(await evaluate('document.querySelector(".staff-record:not([hidden]) .staff-role-link").textContent.includes("support")'));
    await click('.staff-record:not([hidden]) .staff-role-link');await until('Boolean(document.querySelector("#staff-scope"))');
    await evaluate('(()=>{const n=document.querySelector("#staff-scope");n.value="company";n.dispatchEvent(new Event("change"));})()');
    const currentRoles=(await f.admin.request('identity/roles')).data.items;
    assert.equal(await evaluate('document.querySelectorAll(".staff-record:not([hidden])").length'),currentRoles.filter(r=>r.scope==='company').length);
    await fill('#staff-search','no such role');assert.equal(await evaluate('document.querySelectorAll(".staff-record:not([hidden])").length'),0);
    await fill('#staff-search','');await evaluate('(()=>{const n=document.querySelector("#staff-scope");n.value="all";n.dispatchEvent(new Event("change"));})()');
    await tab('roles','[data-create-role]');
    assert.deepEqual(await evaluate('[...document.querySelectorAll("[data-edit-role]")].map(b=>b.dataset.editRole).sort()'),currentRoles.map(r=>r.id).sort());
    for(const [id,name] of [['00000000-0000-4000-8000-000000000001','Platform owner'],['00000000-0000-4000-8000-000000000003','Company team administrator']]){
      await click(`[data-edit-role="${id}"]`);await until('document.querySelector("#staff-dialog").open&&Boolean(document.querySelector("#staff-dialog [name=displayName]"))');
      if(id.endsWith('1'))assert.equal(await evaluate('document.querySelector("#staff-dialog [name=active]").disabled'),true);
      await fill('#staff-dialog [name=displayName]',name);
      await evaluate('document.querySelectorAll("#staff-dialog [name=permissions]").forEach(n=>n.checked=false)');
      await fill('#staff-dialog [name=currentPassword]',f.password);await submit('#staff-dialog form');
      await until(`!document.querySelector("#staff-dialog").open&&document.querySelector(".staff-main").textContent.includes(${JSON.stringify(name)})`);
    }
    await click('[data-create-role]');await until('Boolean(document.querySelector("#staff-dialog [name=displayName]"))');
    await fill('#staff-dialog [name=displayName]','Audit reader');await evaluate(`document.querySelector('#staff-dialog input[value="identity.audit.read"]').checked=true`);
    await fill('#staff-dialog [name=currentPassword]',f.password);await submit('#staff-dialog form');await until('!document.querySelector("#staff-dialog").open&&document.querySelector(".staff-main").textContent.includes("Audit reader")');
    const role=(await f.admin.request('identity/roles')).data.items.find(r=>r.displayName==='Audit reader');
    await click(`[data-edit-role="${role.id}"]`);await fill('#staff-dialog [name=displayName]','Identity audit reader');await fill('#staff-dialog [name=currentPassword]',f.password);await submit('#staff-dialog form');await until('!document.querySelector("#staff-dialog").open&&document.querySelector(".staff-main").textContent.includes("Identity audit reader")');
    await click('#staff-logout');await signIn('browser-staff@safeer.local',temporaryPassword);
    assert.equal(await evaluate('document.querySelector("[data-tab=users]")'),null);
    const newPassword=randomBytes(24).toString('hex');await fill('#change-password [name=currentPassword]',temporaryPassword);await fill('[name=newPassword]',newPassword);await fill('[name=confirmPassword]',newPassword);await submit('#change-password');await until('Boolean(document.querySelector("[data-tab=users]"))');
    await tab('users','.staff-record');assert.equal(await evaluate('document.querySelector("[data-create-user]")'),null);assert.equal(await evaluate('document.querySelector("[data-tab=audit]")'),null);
    await tab('roles','.staff-record');assert.equal(await evaluate('document.querySelector("[data-edit-role]")'),null);
    await tab('sessions','[data-revoke]');await click('[data-revoke]');await until('Boolean(document.querySelector("#staff-login"))');
    await signIn('owner@safeer.local',f.password);await tab('roles','[data-create-role]');
    for(const theme of ['dark','light']){
      if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('[data-theme-toggle]');
      for(const lang of ['en','ar']){
      if(await evaluate('document.documentElement.lang')!==lang)await click('#staff-language');
      assert.equal(await evaluate('new URL(document.querySelector(\'.staff-preview[href^="/?lang="]\').href).searchParams.get("lang")'),lang);
      for(const [name,ready] of [['profile','#change-password'],['users','[data-create-user]'],['roles','[data-create-role]'],['sessions','[data-revoke]'],['audit','.staff-table']]){
        await tab(name,ready);
        for(const [width,height] of [[1920,1080],[1366,768],[390,844]]){
          await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
          assert.ok(await evaluate(`document.documentElement.scrollWidth<=${width+2}&&innerWidth<=${width+2}`),theme+' '+name+' '+lang+' '+width);await shot(`${theme==='light'?'light-':''}${name}-${lang}-${width}`);
        }
      }
    }
    }
    if(await evaluate('document.documentElement.dataset.theme')!=='dark')await click('[data-theme-toggle]');
    await click('.staff-preview[href^="/?lang="]');await until('Boolean(document.querySelector("#app .metrics"))');
    assert.equal(await evaluate('document.documentElement.lang'),'ar');
    assert.equal(await evaluate('document.documentElement.dataset.theme'),'dark');
    await click('a[href^="/staff"]');await until('Boolean(document.querySelector("#change-password"))');
    assert.equal(await evaluate('document.documentElement.lang'),'ar');
    await tab('roles','[data-create-role]');
    await click('[data-create-role]');await until('Boolean(document.querySelector("#staff-dialog form"))');assert.ok(await evaluate('document.querySelector("#staff-dialog").getBoundingClientRect().width<=innerWidth'));
    await shot('role-editor-ar-mobile');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await until('!document.querySelector("#staff-dialog").open');
    if(await evaluate('document.documentElement.lang')!=='en')await click('#staff-language');
    await tab('users','[data-create-user]');await click('[data-create-user]');
    await fill('#staff-dialog [name=displayName]','Expired request');await fill('#staff-dialog [name=login]','expired@safeer.local');await fill('#staff-dialog [name=currentPassword]',f.password);
    const owner=(await f.admin.request('auth/me')).data;
    await f.migration.query('UPDATE safeer.sessions SET revoked_at=clock_timestamp() WHERE user_id=$1',[owner.id]);
    await submit('#staff-dialog form');await until('Boolean(document.querySelector("#staff-login"))');
    assert.equal((await f.migration.query("SELECT count(*)::int AS n FROM safeer.users WHERE normalized_login='expired@safeer.local'")).rows[0].n,0);
    assert.deepEqual(await evaluate('window.__errors'),[]);
    console.log(`Safeer ${built?'built':'source'} browser checks passed: sign-in, overview shortcuts, user-role links, search/scope filters, role editing, password changes, support restrictions, sessions, expired modal recovery, escaped names, keyboard dialog dismissal, language-preserving round trip and 60 dark/light EN/AR staff layouts.`);
  },{webOrigin:web.origin});
}finally{await browser?.close();await web.close();}
