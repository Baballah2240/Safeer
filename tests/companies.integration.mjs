import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';
const profile={nameEn:'Fictional Nile Transport',nameAr:'Fictional Arabic name',slug:'nile-demo',contactEmail:'',phone:'',address:'Invented office',holdMinutes:30,timezone:'Africa/Khartoum',locale:'en'};
const create=async(f,slug='nile-demo')=>{const r=await f.admin.request('companies','POST',{...profile,slug,currentPassword:f.password});assert.equal(r.status,201,r.raw);return r.data.id;};
const workspace=async(f,id)=>{const r=await f.admin.request('companies/'+id);assert.equal(r.status,200,r.raw);return r.data;};
const approve=async(f,id)=>{const w=await workspace(f,id);const r=await f.admin.request('companies/'+id,'PATCH',{...w.company,status:'approved',currentPassword:f.password,id:undefined});assert.equal(r.status,200,r.raw);return workspace(f,id);};
async function ready(f,created){const user=f.client();assert.equal((await user.signIn(created.user.login,created.temporaryPassword)).status,201);const pass=randomBytes(24).toString('hex');assert.equal((await user.request('auth/password','POST',{currentPassword:created.temporaryPassword,newPassword:pass})).status,201);return {user,pass};}
const member=async(f,id,role,fields={})=>{const r=await f.admin.request(`companies/${id}/members`,'POST',{login:'employee@safeer.local',displayName:'Fictional Employee',existing:false,assignments:[{roleId:role.id}],currentPassword:f.password,...fields});assert.equal(r.status,201,r.raw);return r.data;};

test('companies copy role templates, preserve identity, and require approval before staff access',async()=>identityFixture(async f=>{
 const id=await create(f);let w=await workspace(f,id);assert.equal(w.company.status,'pending');assert.equal(w.roles.length,5);assert.equal(w.members.length,1);
 const created=await member(f,id,w.roles.find(r=>r.code==='company_administrator'));const {user}=await ready(f,created);
 assert.equal((await user.request('companies')).data.items.length,0);await approve(f,id);
 assert.equal((await user.request('companies')).data.items[0].id,id);assert.equal((await user.request('companies/'+id)).status,200);
 assert.equal((await user.request('identity/users')).status,403);
 assert.equal((await f.api.db.pool.query('SELECT count(*)::int AS n FROM safeer.companies')).rows[0].n,0,'no tenant context must reveal nothing');
}));

test('company isolation rejects foreign resources, memberships and owner-lockout atomically',async()=>identityFixture(async f=>{
 const a=await create(f,'operator-a'),b=await create(f,'operator-b');let w=await approve(f,a);await approve(f,b);
 const created=await member(f,a,w.roles.find(r=>r.code==='company_administrator'));const {user,pass}=await ready(f,created);
 assert.deepEqual((await user.request('companies')).data.items.map(r=>r.id),[a]);assert.equal((await user.request('companies/'+b)).status,404);
 const platformRole=(await f.admin.request('identity/roles','POST',{displayName:'Company permission without membership',permissions:['company.profile.read'],currentPassword:f.password})).data;
 const identity=(await user.request('auth/me')).data;
 assert.equal((await f.admin.request(`identity/users/${identity.id}/roles`,'PUT',{roleIds:[platformRole.id],version:identity.version,currentPassword:f.password})).status,200);
 assert.deepEqual((await user.request('companies')).data.items.map(r=>r.id),[a],'platform company grants do not replace memberships');
 const before=(await workspace(f,b)).company;assert.equal((await user.request('companies/'+b,'PATCH',{...before,currentPassword:pass,id:undefined})).status,404);
 const m=w.members[0];const removal=await f.admin.request(`companies/${a}/members/${m.id}`,'PATCH',{displayName:m.displayName,active:false,assignments:[],version:m.version,currentPassword:f.password});assert.equal(removal.status,200,removal.raw);
 w=await workspace(f,a);const last=w.members.find(m=>m.login==='employee@safeer.local');
 assert.equal((await f.admin.request(`companies/${a}/members/${last.id}`,'PATCH',{displayName:last.displayName,active:false,assignments:[],version:last.version,currentPassword:f.password})).error.code,'LAST_COMPANY_ADMIN');
 assert.equal((await workspace(f,a)).members.find(m=>m.id===last.id).active,true);
}));
const resource=async(f,cid,kind,fields={})=>{const r=await f.admin.request(`companies/${cid}/${kind}`,'POST',{nameEn:'Fictional Resource',nameAr:'Fictional Arabic Resource',code:'RESOURCE',active:true,currentPassword:f.password,...fields});assert.equal(r.status,201,r.raw);return r.data.id;};
const saveMember=async(f,cid,m,fields={})=>f.admin.request(`companies/${cid}/members/${m.id}`,'PATCH',{displayName:m.displayName,active:m.active,assignments:m.assignments.map(({roleId,branchId,stationId})=>({roleId,branchId,stationId})),version:m.version,currentPassword:f.password,...fields});
const raw=client=>client.cookie.slice('safeer_session='.length);
async function topology(f){const a=await create(f,'scope-a'),b=await create(f,'scope-b');let w=await approve(f,a);await approve(f,b);const b1=await resource(f,a,'branches',{code:'B1'}),b2=await resource(f,a,'branches',{code:'B2'}),bx=await resource(f,b,'branches',{code:'BX'});const s1=await resource(f,a,'stations',{code:'S1',branchId:b1}),s2=await resource(f,a,'stations',{code:'S2',branchId:b1}),s3=await resource(f,a,'stations',{code:'S3',branchId:b2});w=await workspace(f,a);return {a,b,b1,b2,bx,s1,s2,s3,w};}

test('branch and station managers see only assigned resources and cannot broaden staff assignments',async()=>identityFixture(async f=>{
 const {a,b,b1,b2,s1,s2,s3,w}=await topology(f);const branchRole=w.roles.find(r=>r.code==='branch_manager'),stationRole=w.roles.find(r=>r.code==='station_manager');
 const branch=await member(f,a,branchRole,{login:'branch@safeer.local',assignments:[{roleId:branchRole.id,branchId:b1}]});const manager=await ready(f,branch);
 const station=await member(f,a,stationRole,{login:'station@safeer.local',assignments:[{roleId:stationRole.id,branchId:b1,stationId:s1}]});const counter=await ready(f,station);
 const bw=(await manager.user.request('companies/'+a)).data;assert.deepEqual(bw.branches.map(r=>r.id),[b1]);assert.deepEqual(bw.stations.map(r=>r.id).sort(),[s1,s2].sort());assert.equal(bw.capabilities.roleManage,false);
 const sw=(await counter.user.request('companies/'+a)).data;assert.deepEqual(sw.branches.map(r=>r.id),[b1]);assert.deepEqual(sw.stations.map(r=>r.id),[s1]);
 assert.equal((await manager.user.request(`companies/${a}/stations/${s3}`,'PATCH',{nameEn:'Intrusion',nameAr:'Intrusion',code:'X',active:true,branchId:b2,version:1,currentPassword:manager.pass})).status,404);
 assert.equal((await manager.user.request(`companies/${a}/members`,'POST',{displayName:'Escalation',login:'escalation@safeer.local',existing:false,assignments:[{roleId:w.roles.find(r=>r.scope==='company').id}],currentPassword:manager.pass})).status,403);
 assert.equal((await manager.user.request('companies/'+b)).status,404);
 const edited=await counter.user.request(`companies/${a}/stations/${s1}`,'PATCH',{nameEn:'Authorized edit',nameAr:'Authorized edit',code:'S1',active:true,branchId:b1,version:1,currentPassword:counter.pass});assert.equal(edited.status,200,edited.raw);
 const foreign=await member(f,a,branchRole,{login:'multi@safeer.local',assignments:[{roleId:branchRole.id,branchId:b1},{roleId:branchRole.id,branchId:b2}]});
 const view=(await manager.user.request('companies/'+a)).data.members.find(m=>m.id===foreign.id);assert.equal(view.assignments.length,1);assert.equal(view.canEdit,false);
 assert.equal((await manager.user.request(`companies/${a}/members/${foreign.id}`,'PATCH',{displayName:'Narrow takeover',active:true,assignments:[{roleId:branchRole.id,branchId:b1}],version:view.version,currentPassword:manager.pass})).status,403);
 assert.equal((await workspace(f,a)).members.find(m=>m.id===foreign.id).assignments.length,2);
}));

test('foreign-company roles/resources and unknown authority fields fail closed',async()=>identityFixture(async f=>{
 const {a,b,b1,bx,w}=await topology(f),other=await workspace(f,b);
 const attempt=await f.admin.request(`companies/${a}/stations`,'POST',{nameEn:'Bad',nameAr:'Bad',code:'BAD',active:true,branchId:bx,currentPassword:f.password});assert.equal(attempt.error.code,'INVALID_RESOURCE_SCOPE');
 const badRole=await f.admin.request(`companies/${a}/members`,'POST',{displayName:'Bad',login:'bad@safeer.local',existing:false,assignments:[{roleId:other.roles[0].id,branchId:bx}],currentPassword:f.password});assert.equal(badRole.error.code,'INVALID_ROLE_SCOPE');
 assert.equal((await f.admin.request('companies','POST',{...profile,slug:'bad-authority',superAdministrator:true,currentPassword:f.password})).status,400);
 await assert.rejects(f.api.db.transaction(async c=>{await c.query("SELECT set_config('safeer.session_token',$1,true)",[raw(f.admin)]);await c.query('INSERT INTO safeer.stations(id,company_id,branch_id,code,name_en,name_ar) VALUES(gen_random_uuid(),$1,$2,$3,$4,$4)',[a,bx,'BAD-FK','Fictional']);}),e=>e.code==='23503');
 await assert.rejects(f.api.db.transaction(async c=>{await c.query("SELECT set_config('safeer.session_token',$1,true)",[raw(f.admin)]);await c.query('UPDATE safeer.branches SET company_id=$1 WHERE id=$2',[b,b1]);}),e=>e.code==='42501');
}));

test('raw runtime queries require a valid session and RLS ignores invented actor/company/super flags',async()=>identityFixture(async f=>{
 const {a,b,b1,w}=await topology(f);const role=w.roles.find(r=>r.code==='branch_manager'),created=await member(f,a,role,{assignments:[{roleId:role.id,branchId:b1}]});const staff=await ready(f,created);const ownerId=(await f.admin.request('auth/me')).data.id;
 await f.api.db.transaction(async c=>{await c.query("SELECT set_config('safeer.session_token',$1,true),set_config('safeer.actor_id',$2,true),set_config('safeer.company_id',$3,true),set_config('safeer.is_super','true',true)",[raw(staff.user),ownerId,b]);assert.deepEqual((await c.query('SELECT id FROM safeer.companies')).rows.map(r=>r.id),[a]);assert.deepEqual((await c.query('SELECT id FROM safeer.branches')).rows.map(r=>r.id),[b1]);});
 assert.equal((await f.api.db.pool.query('SELECT count(*)::int AS n FROM safeer.companies')).rows[0].n,0);
 const hash=(await f.migration.query('SELECT token_hash FROM safeer.sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',[(await staff.user.request('auth/me')).data.id])).rows[0].token_hash;
 await f.api.db.transaction(async c=>{await c.query("SELECT set_config('safeer.session_token',$1,true)",[hash]);assert.equal((await c.query('SELECT count(*)::int AS n FROM safeer.companies')).rows[0].n,0);});
 await assert.rejects(f.api.db.pool.query("UPDATE safeer.company_audit SET action='forged'"),e=>e.code==='42501');
 const acl=await f.migration.query("SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE n.nspname='safeer' AND a.grantee=0");assert.equal(acl.rows[0].n,0);
}));

test('support access is explicit, read-only, time limited, revocable and tied to an active support role',async()=>identityFixture(async f=>{
 const a=await create(f,'support-a'),b=await create(f,'support-b');await approve(f,a);await approve(f,b);
 const created=(await f.admin.request('identity/users','POST',{displayName:'Fictional Support',login:'support@safeer.local',currentPassword:f.password})).data;
 assert.equal((await f.admin.request(`identity/users/${created.user.id}/roles`,'PUT',{roleIds:['00000000-0000-4000-8000-000000000002'],version:created.user.version,currentPassword:f.password})).status,200);
 const support=await ready(f,created);assert.equal((await support.user.request('companies')).data.items.length,0);
 const grant=async()=>{const r=await f.admin.request(`companies/${a}/support`,'POST',{login:created.user.login,reason:'Fictional support investigation',hours:24,permissions:['company.profile.read','company.resources.read'],currentPassword:f.password});assert.equal(r.status,201,r.raw);return r.data.id;};
 const id=await grant();assert.deepEqual((await support.user.request('companies')).data.items.map(r=>r.id),[a]);const w=(await support.user.request('companies/'+a)).data;assert.equal(w.members.length,0);assert.equal(w.roles.length,0);assert.equal(w.capabilities.profile,false);
 assert.equal((await support.user.request(`companies/${a}/branches`,'POST',{nameEn:'No',nameAr:'No',code:'NO',active:true,currentPassword:support.pass})).status,403);
 assert.equal((await f.admin.request(`companies/${a}/support/${id}`,'DELETE',{currentPassword:f.password})).status,200);assert.equal((await support.user.request('companies')).data.items.length,0);
 const expired=await grant();await f.migration.query("UPDATE safeer.support_access_grants SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' WHERE id=$1",[expired]);assert.equal((await support.user.request('companies')).data.items.length,0);
 await grant();const r=(await f.admin.request('identity/roles')).data.items.find(r=>r.code==='platform_support_administrator');await f.admin.request('identity/roles/'+r.id,'PATCH',{displayName:r.displayName,permissions:r.permissions,active:false,version:r.version,currentPassword:f.password});assert.equal((await support.user.request('companies')).data.items.length,0);
}));

test('company role edits take effect immediately, template copies stay independent and shared identities are protected',async()=>identityFixture(async f=>{
 const a=await create(f);let w=await approve(f,a);const adminRole=w.roles.find(r=>r.code==='company_administrator'),created=await member(f,a,adminRole);const manager=await ready(f,created);
 const global=(await f.admin.request('identity/roles')).data.items.find(r=>r.code==='company_administrator');assert.equal((await f.admin.request('identity/roles/'+global.id,'PATCH',{displayName:'New template name',permissions:[],active:true,version:global.version,currentPassword:f.password})).status,200);
 assert.equal((await workspace(f,a)).roles.find(r=>r.id===adminRole.id).permissions.length,30);
 const custom=(await manager.user.request(`companies/${a}/roles`,'POST',{displayName:'Profile reader',scope:'company',permissions:['company.profile.read'],currentPassword:manager.pass}));assert.equal(custom.status,201,custom.raw);
 const employee=(await manager.user.request(`companies/${a}/members`,'POST',{displayName:'Fictional Company Staff',login:'company-staff@safeer.local',existing:false,assignments:[{roleId:custom.data.id}],currentPassword:manager.pass}));assert.equal(employee.status,201,employee.raw);const staff=await ready(f,employee.data);assert.equal((await staff.user.request('companies')).data.items.length,1);
 let role=(await workspace(f,a)).roles.find(r=>r.id===custom.data.id);assert.equal((await manager.user.request(`companies/${a}/roles/${role.id}`,'PATCH',{displayName:role.displayName,permissions:[],active:true,version:role.version,currentPassword:manager.pass})).status,200);assert.equal((await staff.user.request('companies')).data.items.length,0);
 assert.equal((await manager.user.request(`companies/${a}/members`,'POST',{displayName:'Existing',login:'owner@safeer.local',existing:true,assignments:[{roleId:adminRole.id}],currentPassword:manager.pass})).status,403);
 assert.equal((await manager.user.request('identity/users')).status,403);
}));

test('company suspension, membership changes and resource deactivation revoke access without changing other companies',async()=>identityFixture(async f=>{
 const {a,b,b1,w}=await topology(f),role=w.roles.find(r=>r.code==='branch_manager'),created=await member(f,a,role,{assignments:[{roleId:role.id,branchId:b1}]});const staff=await ready(f,created);const wb=await workspace(f,b);
 const linked=await f.admin.request(`companies/${b}/members`,'POST',{displayName:'Shared Staff',login:'employee@safeer.local',existing:true,assignments:[{roleId:wb.roles.find(r=>r.code==='company_administrator').id}],currentPassword:f.password});assert.equal(linked.status,201,linked.raw);
 assert.equal((await staff.user.request('companies')).data.items.length,2);
 let branch=(await workspace(f,a)).branches.find(r=>r.id===b1);assert.equal((await f.admin.request(`companies/${a}/branches/${b1}`,'PATCH',{...branch,canEdit:undefined,id:undefined,active:false,currentPassword:f.password})).status,200);
 assert.deepEqual((await staff.user.request('companies')).data.items.map(r=>r.id),[b]);
 let memberRow=(await workspace(f,b)).members.find(m=>m.id===linked.data.id);assert.equal((await saveMember(f,b,memberRow,{active:false,assignments:[]})).status,200);
 assert.equal((await staff.user.request('companies')).data.items.length,0);assert.equal((await staff.user.request('auth/me')).status,200,'global identity remains active');
 const cb=(await workspace(f,b)).company;assert.equal((await f.admin.request(`companies/${b}`,'PATCH',{...cb,id:undefined,status:'suspended',currentPassword:f.password})).status,200);
}));

test('last-company-admin edits and concurrent removals serialize, including global user deactivation',async()=>identityFixture(async f=>{
 const a=await create(f);let w=await approve(f,a);const adminRole=w.roles.find(r=>r.code==='company_administrator'),created=await member(f,a,adminRole);const manager=await ready(f,created);w=await workspace(f,a);
 const root=w.members.find(m=>m.login==='owner@safeer.local'),other=w.members.find(m=>m.id===created.id);
 const results=await Promise.all([saveMember(f,a,root,{active:false,assignments:[]}),manager.user.request(`companies/${a}/members/${other.id}`,'PATCH',{displayName:other.displayName,active:false,assignments:[],version:other.version,currentPassword:manager.pass})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 w=await workspace(f,a);const last=w.members.find(m=>m.active);const u=(await f.admin.request('identity/users')).data.items.find(u=>u.id===last.userId);
 assert.equal((await f.admin.request('identity/users/'+u.id,'PATCH',{displayName:u.displayName,active:false,version:u.version,currentPassword:f.password})).error.code,last.login==='owner@safeer.local'?'LAST_OWNER':'LAST_COMPANY_ADMIN');
 const invalid=await f.admin.request(`companies/${a}/roles/${adminRole.id}`,'PATCH',{displayName:'Unsafe role',active:true,permissions:[],version:adminRole.version,currentPassword:f.password});assert.equal(invalid.error.code,'LAST_COMPANY_ADMIN');
}));

test('delegated member managers cannot grant privileges they lack through API or raw scoped SQL',async()=>identityFixture(async f=>{
 const {a,b1,w}=await topology(f),role=w.roles.find(r=>r.code==='branch_manager');
 const limited=await f.admin.request(`companies/${a}/roles`,'POST',{displayName:'Limited member manager',scope:'branch',permissions:['company.profile.read','company.resources.read','company.members.read','company.members.manage','company.roles.read'],currentPassword:f.password});assert.equal(limited.status,201,limited.raw);
 const created=await member(f,a,{id:limited.data.id},{assignments:[{roleId:limited.data.id,branchId:b1}]});const actor=await ready(f,created);
 const response=await actor.user.request(`companies/${a}/members`,'POST',{displayName:'Escalation',login:'higher@safeer.local',existing:false,assignments:[{roleId:role.id,branchId:b1}],currentPassword:actor.pass});assert.equal(response.error.code,'PRIVILEGE_ESCALATION');
 await assert.rejects(f.api.db.transaction(async c=>{await c.query("SELECT set_config('safeer.session_token',$1,true)",[raw(actor.user)]);await c.query("INSERT INTO safeer.company_user_roles(id,company_id,member_id,role_id,scope,branch_id) VALUES(gen_random_uuid(),$1,$2,$3,'branch',$4)",[a,created.id,role.id,b1]);}),e=>e.code==='42501');
}));
