import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';
import {setup,ok} from './support/boarding-fixture.mjs';
import {startServer} from '../server.mjs';
import {recoverHostedOwner} from '../database/hosted-owner-recovery.mjs';

test('maximum Arabic group booking passes API/proxy while other endpoints retain the small limit',()=>identityFixture(async f=>{
 const s=await setup(f,'arabic-size-regression'),tripId=await s.trip();
 const travelers=Array.from({length:10},(_,i)=>({seat:String(i+1),name:'\u0633'.repeat(100),luggage:'\u0628'.repeat(300)}));
 const data={tripId,seats:travelers.map(p=>p.seat),key:randomUUID(),mobile:'+249900000000',travelers},raw=JSON.stringify(data);
 assert.ok(Buffer.byteLength(raw)>8192);
 const direct=ok(await f.client().request('public/holds','POST',data));
 const web=await startServer({port:0,identityApiUrl:f.api.origin});
 try{
  const r=await fetch(web.origin+'/api/v1/public/holds',{method:'POST',headers:{origin:'http://127.0.0.1:4320','content-type':'application/json'},body:raw});
  assert.equal(r.status,201);assert.equal((await r.json()).data.reference,direct.reference);
  assert.equal((await fetch(web.origin+'/api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'x'.repeat(9000)})})).status,413);
  assert.equal((await fetch(web.origin+'/api/v1/public/holds',{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(65537)})).status,413);
 }finally{await web.close();}
}));

test('hosted origins use Secure cookies and the proxy preserves host/origin protection on loopback',()=>identityFixture(async f=>{
 const signed=await f.client().signIn('owner@safeer.local',f.password);assert.equal(signed.status,201);
 assert.match(signed.headers.get('set-cookie'),/; Secure/);assert.match(signed.headers.get('set-cookie'),/HttpOnly/);assert.match(signed.headers.get('set-cookie'),/SameSite=Strict/);
 const web=await startServer({port:0,identityApiUrl:f.api.origin,publicOrigin:'https://safeer.example',loopbackOnly:true});
 const request=(path,headers={},data)=>new Promise((resolve,reject)=>{
  const r=httpRequest(web.origin+path,{method:data?'POST':'GET',headers:{host:'safeer.example',...(data?{'content-type':'application/json'}:{}),...headers}},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,headers:new Headers(res.headers)}));});r.on('error',reject);r.end(data?JSON.stringify(data):undefined);
 });
 try{
  assert.equal(web.server.address().address,'127.0.0.1');
  assert.equal((await fetch(web.origin+'/staff')).status,403);
  const page=await request('/staff');assert.equal(page.status,200);assert.ok(page.headers.get('strict-transport-security'));
  const rejected=await request('/api/v1/auth/login',{origin:'https://foreign.invalid'},{login:'owner@safeer.local',password:f.password});assert.equal(rejected.status,403);
  const allowed=await request('/api/v1/auth/login',{origin:'https://safeer.example'},{login:'owner@safeer.local',password:f.password});assert.equal(allowed.status,201);assert.match(allowed.headers.get('set-cookie'),/; Secure/);
 }finally{await web.close();}
},{webOrigin:'https://safeer.example'}));

test('hosted recovery accepts a non-superuser table owner, rejects runtime, and rolls back conflicting emails',()=>identityFixture(async f=>{
 await assert.rejects(recoverHostedOwner({connectionString:f.runtimeUrl,email:'owner@safeer.local'}));
 const role='recovery_'+randomUUID().replaceAll('-',''),pass=randomBytes(32).toString('hex');
 const original=(await f.migration.query('SELECT current_user AS name')).rows[0].name;assert.match(original,/^[a-zA-Z0-9_]+$/);
 await f.migration.query(`CREATE ROLE "${role}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD '${pass}'`);
 try{
  await f.migration.query(`GRANT USAGE ON SCHEMA safeer TO "${role}"`);
  await f.migration.query(`GRANT SELECT ON safeer.platform_user_roles,safeer.roles,safeer.sessions,safeer.auth_throttles TO "${role}"`);
  await f.migration.query(`GRANT UPDATE ON safeer.sessions TO "${role}"`);
  await f.migration.query(`GRANT INSERT ON safeer.identity_audit TO "${role}"`);
  await f.migration.query(`GRANT DELETE ON safeer.auth_throttles TO "${role}"`);
  await f.migration.query(`ALTER TABLE safeer.users OWNER TO "${role}"`);
  const url=new URL(f.ownerUrl);url.username=role;url.password=pass;
  const made=ok(await f.admin.request('identity/users','POST',{login:'existing@safeer.local',displayName:'Fictional Existing',currentPassword:f.password}));assert.ok(made.user.id);
  const before=(await f.migration.query("SELECT version,password_hash FROM safeer.users WHERE normalized_login='owner@safeer.local'")).rows[0];
  await assert.rejects(recoverHostedOwner({connectionString:url.href,email:'owner@safeer.local',newEmail:'existing@safeer.local'}));
  assert.deepEqual((await f.migration.query("SELECT version,password_hash FROM safeer.users WHERE normalized_login='owner@safeer.local'")).rows[0],before);
  const recovered=await recoverHostedOwner({connectionString:url.href,email:'owner@safeer.local',newEmail:'recovered@safeer.local'});
  assert.equal((await f.admin.request('auth/me')).status,401);
  const signed=await f.client().signIn(recovered.login,recovered.temporaryPassword);assert.equal(signed.status,201);assert.equal(signed.data.user.mustChangePassword,true);
 }finally{
  await f.migration.query(`ALTER TABLE safeer.users OWNER TO "${original}"`);
  await f.migration.query(`DROP OWNED BY "${role}"`);await f.migration.query(`DROP ROLE "${role}"`);
 }
}));
