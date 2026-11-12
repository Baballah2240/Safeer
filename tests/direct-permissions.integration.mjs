import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';

// D73: permissions given directly to one person are kept as that person's own (personal) company role.
const ok=(r,status=201)=>{assert.equal(r.status,status,r.raw);return r.data;};
const refused=(r,status,code)=>{assert.equal(r.status,status,r.raw);assert.equal(r.error?.code,code,r.raw);};
async function setup(f){
 const pw={currentPassword:f.password};
 const cid=ok(await f.admin.request('companies','POST',{nameEn:'Fictional Direct Co',nameAr:'Fictional Direct Co',slug:'direct-access',holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).id,base='companies/'+cid;
 const w=ok(await f.admin.request(base),200);ok(await f.admin.request(base,'PATCH',{...w.company,id:undefined,status:'approved',...pw}),200);
 const branch=ok(await f.admin.request(base+'/branches','POST',{code:'MAIN',nameEn:'Fictional Main',nameAr:'Fictional Main',active:true,...pw})).id;
 const station=async code=>ok(await f.admin.request(base+'/stations','POST',{code,nameEn:'Fictional '+code,nameAr:'Fictional '+code,branchId:branch,active:true,...pw})).id;
 const north=await station('NORTH'),south=await station('SOUTH');
 const workspace=async(c=f.admin)=>ok(await c.request(base),200);
 const access=async id=>{const w=await workspace(),m=w.members.find(x=>x.id===id);return {m,w,roles:m.assignments.map(a=>({...a,role:w.roles.find(r=>r.id===a.roleId)}))};};
 const role=async code=>(await workspace()).roles.find(r=>r.code===code);
 const signIn=async(login,temporary)=>{const c=f.client(),password=randomBytes(24).toString('hex');ok(await c.signIn(login,temporary));ok(await c.request('auth/password','POST',{currentPassword:temporary,newPassword:password}));return {c,pw:{currentPassword:password}};};
 return {cid,base,pw,branch,north,south,workspace,access,role,signIn};
}

test('custom permissions become a personal role for that person, reused while its scope stays and switched off when unused',async()=>identityFixture(async f=>{
 const s=await setup(f),add=(login,assignments,c=f.admin,pw=s.pw)=>c.request(s.base+'/members','POST',{login,displayName:'Fictional '+login.split('@')[0],existing:false,assignments,...pw});
 // Account and company access in one step, as Users > Create user does.
 const made=ok(await add('direct.agent@safeer.local',[{permissions:['company.ticketing.operate','company.bookings.read'],branchId:s.branch,stationId:s.north}]));
 assert.equal(made.user.login,'direct.agent@safeer.local');assert.ok(made.temporaryPassword.length>=24,'A one-time password is returned.');
 let a=await s.access(made.id);const first=a.roles[0].role;
 assert.equal(a.roles.length,1);assert.equal(a.roles[0].scope,'station');assert.equal(a.roles[0].stationId,s.north);
 assert.ok(first.personal&&first.code.startsWith('personal_'),'Kept as a personal role.');assert.equal(first.displayName,'Custom permissions');
 assert.deepEqual(first.permissions,['company.bookings.read','company.profile.read','company.ticketing.operate'],'Company profile: read is added so the person can open the workspace.');
 assert.ok(a.w.roles.filter(r=>!r.personal).every(r=>!r.code.startsWith('personal_')),'Ready roles are not marked personal.');
 const agent=await s.signIn('direct.agent@safeer.local',made.temporaryPassword);
 let cap=(await s.workspace(agent.c)).capabilities;assert.equal(cap.ticketing,true);assert.equal(cap.stationScreen,true);assert.equal(cap.memberCreate,false,'Nothing beyond the ticked permissions.');

 // Changing the ticks at the same place updates the same personal role.
 ok(await f.admin.request(s.base+'/members/'+made.id,'PATCH',{displayName:'Fictional agent',active:true,assignments:[{permissions:['company.luggage.operate'],branchId:s.branch,stationId:s.north}],version:a.m.version,...s.pw}),200);
 a=await s.access(made.id);assert.equal(a.roles[0].roleId,first.id,'Same personal role reused.');assert.deepEqual(a.roles[0].role.permissions,['company.luggage.operate','company.profile.read']);
 cap=(await s.workspace(agent.c)).capabilities;assert.equal(cap.ticketing,false,'Removed permissions stop working.');assert.equal(cap.luggage,true);

 // Company-wide custom permissions need a company-scope role; the station one is switched off.
 ok(await f.admin.request(s.base+'/members/'+made.id,'PATCH',{displayName:'Fictional agent',active:true,assignments:[{permissions:['company.trips.read']}],version:a.m.version,...s.pw}),200);
 a=await s.access(made.id);const wide=a.roles[0].role;assert.equal(a.roles[0].scope,'company');assert.notEqual(wide.id,first.id);
 const old=a.w.roles.find(r=>r.id===first.id);assert.equal(old.active,false);assert.deepEqual(old.permissions,[],'An unused personal role grants nothing.');

 // Keeping it by its id leaves it unchanged; nobody else can be given it; the roles endpoint cannot edit it.
 ok(await f.admin.request(s.base+'/members/'+made.id,'PATCH',{displayName:'Fictional agent',active:true,assignments:[{roleId:wide.id}],version:a.m.version,...s.pw}),200);
 a=await s.access(made.id);assert.equal(a.roles[0].roleId,wide.id);assert.deepEqual(a.roles[0].role.permissions,['company.profile.read','company.trips.read']);
 refused(await add('other.agent@safeer.local',[{roleId:wide.id}]),400,'INVALID_ROLE_SCOPE');
 refused(await f.admin.request(s.base+'/roles/'+wide.id,'PATCH',{displayName:'Taken over',active:true,permissions:['company.finance.read'],version:wide.version,...s.pw}),400,'INVALID_ROLE_SCOPE');

 // Input checks.
 refused(await add('bad1@safeer.local',[{roleId:wide.id,permissions:['company.trips.read']}]),400,'INVALID_INPUT');
 refused(await add('bad2@safeer.local',[{permissions:['company.trips.read'],stationId:s.north}]),400,'INVALID_RESOURCE_SCOPE');
 refused(await add('bad3@safeer.local',[{permissions:[]}]),400,'INVALID_PERMISSION');
 refused(await add('bad4@safeer.local',[{permissions:['company.everything']}]),400,'INVALID_PERMISSION');
 refused(await add('bad5@safeer.local',[{permissions:['company.trips.read'],branchId:s.branch},{permissions:['company.fleet.read'],branchId:s.branch}]),400,'INVALID_INPUT');
 const driver=ok(await add('direct.driver@safeer.local',[{permissions:['company.driver.operate']}]));
 assert.deepEqual((await s.access(driver.id)).roles[0].role.permissions,['company.driver.operate'],'Driver-only sets stay driver-only.');

 // Branch-wide plus a second place in one membership, then back to a ready role.
 const two=ok(await add('two.places@safeer.local',[{permissions:['company.trips.read'],branchId:s.branch},{permissions:['company.ticketing.operate'],branchId:s.branch,stationId:s.south}]));
 a=await s.access(two.id);assert.deepEqual(a.roles.map(x=>x.scope).sort(),['branch','station']);
 const ticketing=await s.role('ticketing_employee');
 ok(await f.admin.request(s.base+'/members/'+two.id,'PATCH',{displayName:'Fictional two',active:true,assignments:[{roleId:ticketing.id,branchId:s.branch,stationId:s.north}],version:a.m.version,...s.pw}),200);
 const after=await s.access(two.id);assert.deepEqual(after.roles.map(x=>x.roleId),[ticketing.id]);
 for(const r of a.roles)assert.equal(after.w.roles.find(x=>x.id===r.roleId).active,false,'Both personal roles are switched off.');
 assert.ok(after.w.audit.some(x=>x.action==='member.saved'&&x.targetId===two.id),'Changes stay in the company audit.');
}));

test('only company-wide role managers set custom permissions, never beyond their own; managers can keep or remove them',async()=>identityFixture(async f=>{
 const s=await setup(f),add=(c,pw,login,assignments)=>c.request(s.base+'/members','POST',{login,displayName:'Fictional '+login.split('@')[0],existing:false,assignments,...pw});
 const managerRole=await s.role('station_manager'),ticketing=await s.role('ticketing_employee');
 const managerMade=ok(await add(f.admin,s.pw,'north.manager@safeer.local',[{roleId:managerRole.id,branchId:s.branch,stationId:s.north}]));
 const manager=await s.signIn('north.manager@safeer.local',managerMade.temporaryPassword);
 refused(await add(manager.c,manager.pw,'by.manager@safeer.local',[{permissions:['company.bookings.read'],branchId:s.branch,stationId:s.north}]),403,'FORBIDDEN');
 ok(await add(manager.c,manager.pw,'ready.role@safeer.local',[{roleId:ticketing.id,branchId:s.branch,stationId:s.north}]));

 // A manager keeps someone's custom permissions while editing other details, and may remove them.
 const x=ok(await add(f.admin,s.pw,'custom.north@safeer.local',[{permissions:['company.ticketing.operate','company.bookings.read'],branchId:s.branch,stationId:s.north}]));
 let a=await s.access(x.id);const personal=a.roles[0].roleId;
 ok(await manager.c.request(s.base+'/members/'+x.id,'PATCH',{displayName:'Fictional custom',phone:'0912345678',active:true,assignments:[{roleId:personal,branchId:s.branch,stationId:s.north}],version:a.m.version,...manager.pw}),200);
 a=await s.access(x.id);assert.equal(a.roles[0].roleId,personal);assert.equal(a.m.phone,'+249912345678');
 refused(await manager.c.request(s.base+'/members/'+x.id,'PATCH',{displayName:'Fictional custom',active:true,assignments:[{permissions:['company.ticketing.operate'],branchId:s.branch,stationId:s.north}],version:a.m.version,...manager.pw}),403,'FORBIDDEN');
 ok(await manager.c.request(s.base+'/members/'+x.id,'PATCH',{displayName:'Fictional custom',active:true,assignments:[{roleId:ticketing.id,branchId:s.branch,stationId:s.north}],version:a.m.version,...manager.pw}),200);
 a=await s.access(x.id);assert.deepEqual(a.roles.map(r=>r.roleId),[ticketing.id]);
 refused(await f.admin.request(s.base+'/members/'+x.id,'PATCH',{displayName:'Fictional custom',active:true,assignments:[{roleId:personal,branchId:s.branch,stationId:s.north}],version:a.m.version,...s.pw}),400,'INVALID_ROLE_SCOPE');

 // A company-wide staff manager can grant only what they hold company-wide. (Without resources.read they
 // could not see branches at all, which is refused as INVALID_RESOURCE_SCOPE before any permission check.)
 const hr=ok(await f.admin.request(s.base+'/roles','POST',{displayName:'Fictional HR',scope:'company',permissions:['company.members.read','company.members.manage','company.roles.read','company.roles.manage','company.resources.read'],...s.pw}));
 const hrMade=ok(await add(f.admin,s.pw,'hr@safeer.local',[{roleId:hr.id}])),person=await s.signIn('hr@safeer.local',hrMade.temporaryPassword);
 refused(await add(person.c,person.pw,'finance.reader@safeer.local',[{permissions:['company.finance.read']}]),403,'PRIVILEGE_ESCALATION');
 refused(await add(person.c,person.pw,'north.seller@safeer.local',[{permissions:['company.ticketing.operate'],branchId:s.branch,stationId:s.north}]),403,'PRIVILEGE_ESCALATION');
 const reader=ok(await add(person.c,person.pw,'staff.reader@safeer.local',[{permissions:['company.members.read']}]));
 assert.deepEqual((await s.access(reader.id)).roles[0].role.permissions,['company.members.read','company.profile.read']);
}));
