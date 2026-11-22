// D136: the Super Administrator gives and removes any access: platform permissions for one person (no role
// needed), platform roles, and company access (add, change, remove) for any user, and sees all of it in one view.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';
import {setup,staff,ok} from './support/boarding-fixture.mjs';
test('super administrator gives, sees and removes any access for any user',()=>identityFixture(async f=>{
 const s=await setup(f,'access-a'),pw=f.password;
 // A plain platform account with no access at all.
 const made=ok(await f.admin.request('identity/users','POST',{displayName:'Fictional Helper',login:'helper@safeer.local',currentPassword:pw}));
 const uid=made.user.id,c=f.client();ok(await c.signIn('helper@safeer.local',made.temporaryPassword));const pass=randomBytes(24).toString('hex');
 ok(await c.request('auth/password','POST',{currentPassword:made.temporaryPassword,newPassword:pass}));
 assert.equal((await c.request('identity/audit')).status,403);
 let a=ok(await f.admin.request(`identity/users/${uid}/access`),200);
 assert.deepEqual([a.roles,a.permissions,a.companies],[[],[],[]]);assert.ok(a.choices.includes('identity.audit.read'));assert.equal(a.choices.some(x=>x.startsWith('company.')),false);
 // Give one platform permission directly.
 ok(await f.admin.request(`identity/users/${uid}/permissions`,'PUT',{permissions:['identity.audit.read','identity.users.read'],version:a.user.version,currentPassword:pw}),200);
 assert.equal((await c.request('identity/audit')).status,200,'the permission works at once');
 a=ok(await f.admin.request(`identity/users/${uid}/access`),200);assert.deepEqual(a.permissions,['identity.audit.read','identity.users.read']);
 assert.equal(ok(await f.admin.request('identity/roles'),200).items.some(r=>r.code.startsWith('personal_')),false,'personal roles stay out of the role list');
 // Changing platform roles keeps the personal permissions.
 const roles=ok(await f.admin.request('identity/roles'),200).items.filter(r=>r.scope==='platform'&&r.code!=='platform_super_administrator'&&r.active);
 if(roles.length){ok(await f.admin.request(`identity/users/${uid}/roles`,'PUT',{roleIds:[roles[0].id],version:a.user.version,currentPassword:pw}),200);
  a=ok(await f.admin.request(`identity/users/${uid}/access`),200);assert.deepEqual(a.roleIds,[roles[0].id]);assert.equal(a.permissions.length,2);}
 // Company permissions cannot be given as platform permissions; bad input never errors the server.
 for(const bad of [['company.trips.read'],['nope.nope'],'identity.audit.read',[1],null])
  assert.ok([400,409].includes((await f.admin.request(`identity/users/${uid}/permissions`,'PUT',{permissions:bad,version:a.user.version,currentPassword:pw})).status),JSON.stringify(bad));
 // Add to a company, see it, remove it.
 const roleId=(await f.migration.query("SELECT id FROM safeer.company_roles WHERE company_id=$1 AND scope='company' AND active AND code='company_administrator'",[s.cid])).rows[0].id;
 const member=ok(await f.admin.request(`${s.base}/members`,'POST',{displayName:'Fictional Helper',login:'helper@safeer.local',existing:true,assignments:[{roleId}],currentPassword:pw}));
 assert.equal((await c.request(s.base)).status,200,'company access works');
 a=ok(await f.admin.request(`identity/users/${uid}/access`),200);assert.equal(a.companies.length,1);assert.equal(a.companies[0].memberId,member.id);assert.equal(a.companies[0].active,true);assert.ok(a.companies[0].assignments[0].permissions.length>0);
 const m=ok(await f.admin.request(s.base),200).members.find(x=>x.userId===uid);
 ok(await f.admin.request(`${s.base}/members/${m.id}`,'PATCH',{displayName:m.displayName,jobTitle:m.jobTitle,phone:m.phone,active:false,assignments:[],version:m.version,currentPassword:pw}),200);
 assert.ok([403,404].includes((await c.request(s.base)).status),'company access removed');
 a=ok(await f.admin.request(`identity/users/${uid}/access`),200);assert.equal(a.companies[0].active,false);assert.deepEqual(a.companies[0].assignments,[]);
 // Remove the platform permissions.
 ok(await f.admin.request(`identity/users/${uid}/permissions`,'PUT',{permissions:[],version:a.user.version,currentPassword:pw}),200);
 assert.equal((await c.request('identity/audit')).status,403,'permission removed');
 // Only the Super Administrator may do this, and only with the current password.
 const {c:manager}=await staff(f,s,['company.members.manage','company.members.read','company.roles.read']);
 assert.equal((await manager.request(`identity/users/${uid}/access`)).status,403);
 assert.equal((await c.request(`identity/users/${uid}/access`)).status,403);
 assert.equal((await f.client().request(`identity/users/${uid}/access`)).status,401);
 a=ok(await f.admin.request(`identity/users/${uid}/access`),200);
 assert.equal((await f.admin.request(`identity/users/${uid}/permissions`,'PUT',{permissions:[],version:a.user.version,currentPassword:'wrong-password'})).status,403);
 assert.equal((await f.admin.request('identity/users/00000000-0000-4000-8000-00000000abcd/access')).status,404);
}));
