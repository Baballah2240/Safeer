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
    const fill=async(selector,value)=>{await until(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);return evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}));})()`);};
    const submit=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`);
    const shot=async name=>writeFileSync(join(directory,name+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    const signIn=async(email,pass)=>{await until('Boolean(document.querySelector("#staff-login"))');await fill('[name=login]',email);await fill('[name=password]',pass);await submit('#staff-login');try{await until('Boolean(document.querySelector("#change-password"))');}catch(error){throw Error('Sign-in did not finish: '+await evaluate('document.querySelector("[role=alert]")?.textContent||document.querySelector(".staff-main").textContent')+'; JS errors: '+JSON.stringify(await evaluate('window.__errors')));}};
    const tab=async(name,ready)=>{await click(`[data-tab="${name}"]`);await until(`Boolean(document.querySelector(${JSON.stringify(ready)}))`);};
    await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:web.origin+'/staff'});
    await signIn('owner@safeer.local',f.password);
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
    await tab('roles','[data-create-role]');await click('[data-create-role]');await until('Boolean(document.querySelector("#staff-dialog [name=displayName]"))');
    await fill('#staff-dialog [name=displayName]','Audit reader');await evaluate(`document.querySelector('#staff-dialog input[value="identity.audit.read"]').checked=true`);
    await fill('#staff-dialog [name=currentPassword]',f.password);await submit('#staff-dialog form');await until('!document.querySelector("#staff-dialog").open&&document.querySelector(".staff-main").textContent.includes("Audit reader")');
    const role=(await f.admin.request('identity/roles')).data.items.find(r=>r.displayName==='Audit reader');
    await click(`[data-edit-role="${role.id}"]`);await fill('#staff-dialog [name=displayName]','Identity audit reader');await fill('#staff-dialog [name=currentPassword]',f.password);await submit('#staff-dialog form');await until('!document.querySelector("#staff-dialog").open&&document.querySelector(".staff-main").textContent.includes("Identity audit reader")');
    await click('#staff-logout');await signIn('browser-staff@safeer.local',temporaryPassword);
    assert.equal(await evaluate('document.querySelector("[data-tab=users]")'),null);
    const newPassword=randomBytes(24).toString('hex');await fill('#change-password [name=currentPassword]',temporaryPassword);await fill('[name=newPassword]',newPassword);await fill('[name=confirmPassword]',newPassword);await submit('#change-password');await until('Boolean(document.querySelector("[data-tab=users]"))');
    await tab('users','.staff-record');assert.equal(await evaluate('document.querySelector("[data-create-user]")'),null);assert.equal(await evaluate('document.querySelector("[data-tab=audit]")'),null);
    await tab('sessions','[data-revoke]');await click('[data-revoke]');await until('Boolean(document.querySelector("#staff-login"))');
    await signIn('owner@safeer.local',f.password);await tab('roles','[data-create-role]');
    for(const lang of ['en','ar']){
      if(await evaluate('document.documentElement.lang')!==lang)await click('#staff-language');
      for(const [width,height] of [[1920,1080],[1366,768],[390,844]]){
        await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
        assert.ok(await evaluate(`document.documentElement.scrollWidth<=${width+2}&&innerWidth<=${width+2}`));await shot(`roles-${lang}-${width}`);
      }
    }
    await click('[data-create-role]');await until('Boolean(document.querySelector("#staff-dialog form"))');assert.ok(await evaluate('document.querySelector("#staff-dialog").getBoundingClientRect().width<=innerWidth'));
    await shot('role-editor-ar-mobile');await click('[data-dialog-cancel]');
    if(await evaluate('document.documentElement.lang')!=='en')await click('#staff-language');
    await tab('users','[data-create-user]');await click('[data-create-user]');
    await fill('#staff-dialog [name=displayName]','Expired request');await fill('#staff-dialog [name=login]','expired@safeer.local');await fill('#staff-dialog [name=currentPassword]',f.password);
    const owner=(await f.admin.request('auth/me')).data;
    await f.migration.query('UPDATE safeer.sessions SET revoked_at=clock_timestamp() WHERE user_id=$1',[owner.id]);
    await submit('#staff-dialog form');await until('Boolean(document.querySelector("#staff-login"))');
    assert.equal((await f.migration.query("SELECT count(*)::int AS n FROM safeer.users WHERE normalized_login='expired@safeer.local'")).rows[0].n,0);
    assert.deepEqual(await evaluate('window.__errors'),[]);
    console.log(`Section 02 ${built?'built':'source'} browser checks passed: real sign-in, one-time credentials, role assignment/create/edit, password change, restricted support UI, session revocation, expired modal recovery, escaped names and six EN/AR desktop/mobile layouts.`);
  },{webOrigin:web.origin});
}finally{await browser?.close();await web.close();}
