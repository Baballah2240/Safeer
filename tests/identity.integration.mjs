import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {identityFixture} from './support/identity-db.mjs';
import {createIdentityApi} from '../dist/api/app.js';
const ownerRole='00000000-0000-4000-8000-000000000001',supportRole='00000000-0000-4000-8000-000000000002',companyRole='00000000-0000-4000-8000-000000000003';
const create=async(f,email='staff@safeer.local')=>{const r=await f.admin.request('identity/users','POST',{login:email,displayName:'Fictional Staff',currentPassword:f.password});assert.equal(r.status,201);return r.data;};
const assign=async(f,u,roles)=>f.admin.request('identity/users/'+u.id+'/roles','PUT',{roleIds:roles,version:u.version,currentPassword:f.password});
async function readyStaff(f,created){const user=f.client();assert.equal((await user.signIn(created.user.login,created.temporaryPassword)).status,201);const pass=randomBytes(24).toString('hex');assert.equal((await user.request('auth/password','POST',{currentPassword:created.temporaryPassword,newPassword:pass})).status,201);return {user,pass};}

test('real PostgreSQL runtime is restricted, identities persist and no business modules are created',async()=>identityFixture(async f=>{
  const r=(await f.api.db.pool.query('SELECT current_user')).rows[0];assert.match(r.current_user,/^safeer_/);
  await assert.rejects(f.api.db.pool.query('CREATE TABLE safeer.unwanted(id integer)'),e=>e.code==='42501');
  await assert.rejects(f.api.db.pool.query("DELETE FROM safeer.identity_audit"),e=>e.code==='42501');
  await assert.rejects(f.api.db.pool.query("UPDATE safeer.permissions SET module='x'"),e=>e.code==='42501');
  assert.equal((await f.admin.request('identity/roles')).data.items.length,8);
  assert.equal((await f.admin.request('identity/permissions')).data.items.length,21);
  assert.equal((await f.migration.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='safeer' AND tablename IN ('bookings','payments')")).rows[0].n,0);
  const hashes=(await f.migration.query('SELECT password_hash FROM safeer.users')).rows;
  assert.ok(hashes.every(r=>r.password_hash.startsWith('scrypt$')));
  assert.equal((await f.api.db.pool.query('SELECT count(*)::int AS n FROM safeer.users')).rows[0].n,1);
}));
test('cookies are opaque/HttpOnly/SameSite, passwords rotate sessions and first-use restrictions hold',async()=>identityFixture(async f=>{
  const created=await create(f),user=f.client(),first=await user.signIn(created.user.login,created.temporaryPassword);
  assert.match(first.headers.get('set-cookie'),/HttpOnly/);assert.match(first.headers.get('set-cookie'),/SameSite=Strict/);assert.match(first.headers.get('set-cookie'),/Path=\/api\/v1/);
  assert.equal((await user.request('identity/users')).error.code,'PASSWORD_CHANGE_REQUIRED');
  const oldCookie=user.cookie;
  const changed=await user.request('auth/password','POST',{currentPassword:created.temporaryPassword,newPassword:'A new long fictional password'});assert.equal(changed.status,201);assert.notEqual(user.cookie,oldCookie);
  const old=f.client();old.setCookie(oldCookie);assert.equal((await old.request('auth/me')).status,401);
  assert.equal((await user.request('identity/users')).status,403);
  const stored=(await f.migration.query('SELECT token_hash FROM safeer.sessions')).rows;
  assert.ok(stored.every(row=>/^[0-9a-f]{64}$/.test(row.token_hash)&&!user.cookie.includes(row.token_hash)));
  assert.equal((await user.request('auth/logout','POST',{})).status,201);assert.equal((await user.request('auth/me')).status,401);
}));
test('cross-origin/CSRF attacks, unknown DTO authority fields and malformed requests fail closed',async()=>identityFixture(async f=>{
  assert.equal((await f.admin.request('identity/users','POST',{}, {Origin:'http://evil.invalid'})).status,403);
  assert.equal((await f.admin.request('identity/users','POST',{}, {'X-CSRF-Token':'guess'})).status,403);
  assert.equal((await f.admin.request('identity/users','POST',{login:'x@safeer.local',displayName:'X',currentPassword:f.password,companyId:randomUUID(),superAdministrator:true})).status,400);
  assert.equal((await f.admin.request('identity/users','POST','{')).status,400);
  assert.equal((await f.admin.request('identity/users','POST',{large:'x'.repeat(9000)})).status,413);
  assert.equal((await f.admin.request('identity/users','GET',undefined,{Authorization:'Bearer guess'})).status,403);
  assert.equal((await f.admin.request('identity/users','GET',undefined,{'Sec-Fetch-Site':'cross-site'})).status,403);
  const empty=f.client();assert.equal((await empty.request('auth/me')).status,401);
}));
test('login uses generic errors for unknown/disabled users and durable throttling',async()=>identityFixture(async f=>{
  const a=f.client();const wrong=await a.signIn('missing@safeer.local','A fictional wrong password');assert.equal(wrong.status,401);
  const created=await create(f);await f.admin.request('identity/users/'+created.user.id,'PATCH',{displayName:created.user.displayName,active:false,version:created.user.version,currentPassword:f.password});
  const disabled=await a.signIn(created.user.login,created.temporaryPassword);assert.deepEqual(disabled.error,wrong.error);
  for(let i=1;i<8;i++)assert.equal((await a.signIn('missing@safeer.local','A fictional wrong password')).status,401);
  assert.equal((await a.signIn('missing@safeer.local','A fictional wrong password')).status,429);
  assert.equal((await f.migration.query('SELECT count(*)::int AS n FROM safeer.auth_throttles')).rows[0].n>0,true);
}));
test('super administrators edit every role without losing authority or removing the last owner',async()=>identityFixture(async f=>{
  const me=(await f.admin.request('auth/me')).data;
  assert.equal((await f.admin.request('identity/users/'+me.id,'PATCH',{displayName:'Owner',active:false,version:me.version,currentPassword:f.password})).error.code,'LAST_OWNER');
  assert.equal((await assign(f,me,[])).error.code,'LAST_OWNER');
  assert.equal((await f.admin.request('identity/roles/'+ownerRole,'PATCH',{displayName:'Owner',active:false,permissions:[],version:1,currentPassword:f.password})).error.code,'LAST_OWNER');
  let roles=(await f.admin.request('identity/roles')).data.items;const initialVersions=Object.fromEntries(roles.map(r=>[r.id,r.version]));
  assert.equal(roles.find(r=>r.id===ownerRole).version,1,'failed edits roll back');
  for(const role of roles){
    const edit={displayName:'Updated '+role.code,active:true,permissions:[],version:role.version,currentPassword:f.password};
    assert.equal((await f.admin.request('identity/roles/'+role.id,'PATCH',edit)).status,200,role.code);
    assert.equal((await f.admin.request('identity/roles/'+role.id,'PATCH',edit)).error.code,'STALE_VERSION');
  }
  const after=(await f.admin.request('auth/me')).data;
  assert.equal(after.superAdministrator,true);
  assert.equal(after.permissions.length,21,'owner authority survives clearing its editable grants');
  roles=(await f.admin.request('identity/roles')).data.items;
  assert.ok(roles.every(r=>r.version===initialVersions[r.id]+1&&r.permissions.length===0&&r.displayName.startsWith('Updated ')));
  assert.equal((await f.admin.request('identity/audit')).data.items.filter(r=>r.action==='role.updated').length,8);
  const staff=await create(f);
  assert.equal((await assign(f,staff.user,[companyRole])).error.code,'INVALID_ROLE_SCOPE');
  await assert.rejects(f.api.db.pool.query('INSERT INTO safeer.platform_user_roles(user_id,role_id) VALUES($1,$2)',[staff.user.id,companyRole]),e=>e.code==='23503');
  assert.equal((await f.admin.request('identity/roles/'+companyRole,'PATCH',{displayName:'Company role',active:false,permissions:[],version:initialVersions[companyRole]+1,currentPassword:f.password})).status,200);
}));
test('configurable role changes apply immediately and delegated administrators cannot escalate',async()=>identityFixture(async f=>{
  const created=await create(f),role=(await f.admin.request('identity/roles','POST',{displayName:'Identity reader',permissions:['identity.roles.read'],currentPassword:f.password})).data;
  assert.equal((await assign(f,created.user,[role.id])).status,200);
  const {user,pass}=await readyStaff(f,created);assert.equal((await user.request('identity/roles')).status,200);assert.equal((await user.request('identity/users')).status,403);
  const roles=(await f.admin.request('identity/roles')).data.items,r=roles.find(x=>x.id===role.id);
  assert.equal((await f.admin.request('identity/roles/'+r.id,'PATCH',{displayName:r.displayName,permissions:[],active:true,version:r.version,currentPassword:f.password})).status,200);
  assert.equal((await user.request('identity/roles')).status,403);
  const changed=(await f.admin.request('identity/roles')).data.items.find(x=>x.id===r.id);
  await f.admin.request('identity/roles/'+r.id,'PATCH',{displayName:r.displayName,permissions:['identity.roles.read','identity.roles.manage'],active:true,version:changed.version,currentPassword:f.password});
  assert.equal((await user.request('identity/roles','POST',{displayName:'Escalation',permissions:['identity.users.manage'],currentPassword:pass})).error.code,'PRIVILEGE_ESCALATION');
  for(const id of [ownerRole,companyRole]){
    const target=(await f.admin.request('identity/roles')).data.items.find(r=>r.id===id);
    const result=await user.request('identity/roles/'+id,'PATCH',{displayName:'Forbidden change',permissions:[],active:true,version:target.version,currentPassword:pass});
    assert.equal(result.error.code,id===ownerRole?'PROTECTED_OWNER':'FORBIDDEN');
  }
}));
test('support has no mutation/financial access; stale edits and duplicate logins are safe',async()=>identityFixture(async f=>{
  const created=await create(f);assert.equal((await assign(f,created.user,[supportRole])).status,200);const {user,pass}=await readyStaff(f,created);
  assert.equal((await user.request('identity/users')).status,200);
  assert.equal((await user.request('identity/users','POST',{displayName:'X',login:'x@safeer.local',currentPassword:pass})).status,403);
  assert.equal((await user.request('identity/audit')).status,403);
  assert.equal((await user.request('auth/me')).data.permissions.some(p=>p.startsWith('finance')),false);
  const duplicate=await f.admin.request('identity/users','POST',{login:created.user.login,displayName:'Duplicate',currentPassword:f.password});assert.equal(duplicate.status,409);
  assert.equal((await f.admin.request('identity/users/'+created.user.id,'PATCH',{displayName:'Stale',active:true,version:1,currentPassword:f.password})).error.code,'STALE_VERSION');
}));
test('disable/reset revoke sessions; self-session IDs cannot revoke other users',async()=>identityFixture(async f=>{
  const created=await create(f),{user}=await readyStaff(f,created);
  const ownerSession=(await f.admin.request('auth/me')).data.sessionId;
  assert.equal((await user.request('auth/sessions/'+ownerSession,'DELETE')).status,404);
  let target=(await f.admin.request('identity/users')).data.items.find(x=>x.id===created.user.id);
  const reset=await f.admin.request('identity/users/'+target.id+'/password','POST',{version:target.version,currentPassword:f.password});assert.equal(reset.status,201);assert.equal((await user.request('auth/me')).status,401);
  await user.signIn(target.login,reset.data.temporaryPassword);assert.equal((await user.request('auth/me')).data.mustChangePassword,true);
  target=reset.data.user;assert.equal((await f.admin.request('identity/users/'+target.id,'PATCH',{displayName:target.displayName,active:false,version:target.version,currentPassword:f.password})).status,200);
  assert.equal((await user.request('auth/me')).status,401);
}));
test('absolute/idle expiry are authoritative and logout leaves a credential-free audit trail',async()=>identityFixture(async f=>{
  const other=f.client();await other.signIn('owner@safeer.local',f.password);let p=(await other.request('auth/me')).data;
  await f.migration.query("UPDATE safeer.sessions SET last_seen_at=clock_timestamp()-interval '31 minutes' WHERE id=$1",[p.sessionId]);assert.equal((await other.request('auth/me')).status,401);
  await other.signIn('owner@safeer.local',f.password);p=(await other.request('auth/me')).data;
  await f.migration.query("UPDATE safeer.sessions SET created_at=clock_timestamp()-interval '13 hours',expires_at=clock_timestamp()-interval '1 minute' WHERE id=$1",[p.sessionId]);assert.equal((await other.request('auth/me')).status,401);
  const audit=(await f.admin.request('identity/audit')).raw;
  for(const sensitive of [f.password,f.initial.temporaryPassword,'scrypt$',f.admin.cookie.slice(15)])assert.equal(audit.includes(sensitive),false);
}));
test('concurrent owner demotions serialize and cannot remove the last active owner',async()=>identityFixture(async f=>{
  const created=await create(f,'second-owner@safeer.local');await assign(f,created.user,[ownerRole]);const {user,pass}=await readyStaff(f,created);
  const a=(await f.admin.request('auth/me')).data,b=(await user.request('auth/me')).data;
  const results=await Promise.all([f.admin.request('identity/users/'+a.id+'/roles','PUT',{roleIds:[],version:a.version,currentPassword:f.password}),user.request('identity/users/'+b.id+'/roles','PUT',{roleIds:[],version:b.version,currentPassword:pass})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal((await f.migration.query(`SELECT count(*)::int AS n FROM safeer.users u JOIN safeer.platform_user_roles a ON a.user_id=u.id WHERE u.active AND a.role_id=$1`,[ownerRole])).rows[0].n,1);
}));
test('bootstrap is one-time and owner recovery is a local privileged audited command',async()=>identityFixture(async f=>{
  await assert.rejects(f.api.identity.bootstrap('other@safeer.local','Other'));
  const output=execFileSync(process.execPath,['database/recover-owner.mjs','--email','owner@safeer.local'],{windowsHide:true,encoding:'utf8',env:{...process.env,SAFEER_DATABASE_URL:f.ownerUrl}});
  const recovery=JSON.parse(output);assert.equal((await f.admin.request('auth/me')).status,401);
  const owner=f.client();assert.equal((await owner.signIn(recovery.login,recovery.temporaryPassword)).status,201);assert.equal((await owner.request('auth/me')).data.mustChangePassword,true);
  assert.equal((await f.migration.query("SELECT count(*)::int AS n FROM safeer.identity_audit WHERE action='owner.recovered'")).rows[0].n,1);
}));
test('reauthentication is rate limited and the API refuses an elevated database owner',async()=>identityFixture(async f=>{
  for(let i=0;i<8;i++)assert.equal((await f.admin.request('identity/users','POST',{displayName:'No access',login:'no@safeer.local',currentPassword:'A wrong long fictional password'})).error.code,'REAUTHENTICATION_FAILED');
  assert.equal((await f.admin.request('identity/users','POST',{displayName:'No access',login:'no@safeer.local',currentPassword:f.password})).status,429);
  process.env.SAFEER_AUTH_DATABASE_URL=f.ownerUrl;
  try{await assert.rejects(createIdentityApi({port:0}));}finally{process.env.SAFEER_AUTH_DATABASE_URL=f.runtimeUrl;}
}));
