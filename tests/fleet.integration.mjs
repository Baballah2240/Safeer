import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';

const ok=(r,status=201)=>{assert.equal(r.status,status,r.raw);return r.data;};
const grid=(rows=2,columns=3,skipColumn=2)=>{const seats=[];let n=0;for(let row=1;row<=rows;row++)for(let column=1;column<=columns;column++)if(column!==skipColumn)seats.push({row,column,label:'S'+ ++n});return {rows,columns,seats};};
async function setup(f,slug='fleet-demo'){
 const cid=ok(await f.admin.request('companies','POST',{nameEn:'Fictional Transport',nameAr:'Fictional Arabic',slug,holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',currentPassword:f.password})).id;
 const w=ok(await f.admin.request('companies/'+cid),200);
 ok(await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',currentPassword:f.password}),200);
 const branch=ok(await f.admin.request(`companies/${cid}/branches`,'POST',{code:'CENTRAL',nameEn:'Fictional Branch',nameAr:'Fictional Branch',active:true,currentPassword:f.password})).id;
 const fleet=`companies/${cid}/fleet`,layout={code:'COACH',nameEn:'Fictional Coach',nameAr:'Fictional Coach',active:true,...grid(),currentPassword:f.password};
 return {cid,branch,w:ok(await f.admin.request('companies/'+cid),200),fleet,drivers:`companies/${cid}/drivers`,layout};
}
async function staff(f,s,role,scope={}){
 const created=ok(await f.admin.request(`companies/${s.cid}/members`,'POST',{login:randomUUID()+'@safeer.local',displayName:'Fictional Staff',existing:false,assignments:[{roleId:role.id,...scope}],currentPassword:f.password}));
 const user=f.client();ok(await user.signIn(created.user.login,created.temporaryPassword));const pass=randomBytes(24).toString('hex');ok(await user.request('auth/password','POST',{currentPassword:created.temporaryPassword,newPassword:pass}));return {user,pass,member:created};
}
const raw=client=>client.cookie.slice(client.cookie.indexOf('=')+1);
async function context(f,client,action){return f.api.db.transaction(async c=>{await c.query("SELECT set_config('safeer.session_token',$1,true)",[raw(client)]);return action(c);});}
const roleWith=async(f,s,permissions,scope='company')=>ok(await f.admin.request(`companies/${s.cid}/roles`,'POST',{displayName:'Fictional role '+randomUUID().slice(0,8),scope,permissions:['company.profile.read',...permissions],currentPassword:f.password}));

test('every seat-map save creates an immutable revision and never moves a bus',async()=>identityFixture(async f=>{
 const s=await setup(f),{id}=ok(await f.admin.request(s.fleet+'/layouts','POST',s.layout));
 const bus=ok(await f.admin.request(s.fleet+'/buses','POST',{code:'BUS-1',registration:'REG 1',layoutId:id,layoutRevision:1,active:true,currentPassword:f.password})).id;
 const first=ok(await f.admin.request(`${s.fleet}/layouts/${id}/revisions/1`),200);assert.equal(first.seatCount,4);assert.deepEqual(first.seats[0],{row:1,column:1,label:'S1'});
 const next=ok(await f.admin.request(`${s.fleet}/layouts/${id}/revisions`,'POST',{...grid(3,3),expectedRevision:1,currentPassword:f.password}));assert.equal(next.revision,2);
 assert.equal((await f.admin.request(`${s.fleet}/layouts/${id}/revisions`,'POST',{...grid(4,3),expectedRevision:1,currentPassword:f.password})).status,409,'A stale editor cannot overwrite the newer map.');
 assert.deepEqual(ok(await f.admin.request(`${s.fleet}/layouts/${id}/revisions/1`),200),first,'Revision 1 is unchanged.');
 const list=ok(await f.admin.request(s.fleet),200);assert.equal(list.layouts[0].latestRevision,2);assert.deepEqual(list.layouts[0].revisions.map(r=>r.revision),[2,1]);assert.equal(list.buses[0].layoutRevision,1,'Revising does not reassign buses.');
 ok(await f.admin.request(`${s.fleet}/buses/${bus}`,'PATCH',{code:'BUS-1',registration:'REG 1',layoutId:id,layoutRevision:2,active:true,version:1,currentPassword:f.password}),200);
 for(const map of [grid(21,1,0),grid(1,8,0),{rows:2,columns:2,seats:[]},{rows:1,columns:1,seats:[{row:2,column:1,label:'A'}]},{rows:1,columns:2,seats:[{row:1,column:1,label:'A'},{row:1,column:2,label:'a'}]},{rows:1,columns:2,seats:[{row:1,column:1,label:'A'},{row:1,column:1,label:'B'}]},{rows:1,columns:1,seats:[{row:1,column:1,label:'TOOLONGLABEL'}]}])
  assert.ok((await f.admin.request(`${s.fleet}/layouts/${id}/revisions`,'POST',{...map,expectedRevision:2,currentPassword:f.password})).status>=400,JSON.stringify(map).slice(0,60));
 ok(await f.admin.request(`${s.fleet}/layouts/${id}/revisions`,'POST',{...grid(15,7,0),seats:grid(15,7,0).seats.slice(0,100),expectedRevision:2,currentPassword:f.password}));
 assert.ok((await f.admin.request(`${s.fleet}/layouts/${id}/revisions`,'POST',{...grid(15,7,0),expectedRevision:3,currentPassword:f.password})).status>=400,'105 seats exceeds the limit.');
 const audit=ok(await f.admin.request('companies/'+s.cid),200).audit.map(a=>a.action);for(const action of ['seat_layout.created','seat_layout.revised','bus.created','bus.updated'])assert.ok(audit.includes(action),action);
}));

test('active buses need an active layout, and layouts cannot retire under active buses',async()=>identityFixture(async f=>{
 const s=await setup(f),{id}=ok(await f.admin.request(s.fleet+'/layouts','POST',s.layout)),meta={nameEn:'Fictional Coach',nameAr:'Fictional Coach',currentPassword:f.password};
 const body={code:'BUS-1',registration:'REG 1',layoutId:id,layoutRevision:1,active:true,currentPassword:f.password},bus=ok(await f.admin.request(s.fleet+'/buses','POST',body)).id;
 assert.equal((await f.admin.request(`${s.fleet}/layouts/${id}`,'PATCH',{...meta,active:false,version:1})).error.code,'LAYOUT_IN_USE');
 assert.equal((await f.admin.request(s.fleet+'/buses','POST',{...body})).error.code,'DUPLICATE_RECORD');assert.equal((await f.admin.request(s.fleet+'/buses','POST',{...body,code:'BUS-2'})).error.code,'DUPLICATE_RECORD','Registration is unique in a company.');
 ok(await f.admin.request(`${s.fleet}/buses/${bus}`,'PATCH',{...body,active:false,version:1}),200);ok(await f.admin.request(`${s.fleet}/layouts/${id}`,'PATCH',{...meta,active:false,version:1}),200);
 assert.equal((await f.admin.request(`${s.fleet}/buses/${bus}`,'PATCH',{...body,version:2})).error.code,'INACTIVE_LAYOUT');
 assert.equal((await f.admin.request(s.fleet+'/buses','POST',{...body,code:'BUS-3',registration:'REG 3'})).error.code,'INACTIVE_LAYOUT');
 assert.equal((await f.admin.request(`${s.fleet}/layouts/${id}`,'PATCH',{...meta,active:true,version:1})).status,409,'Stale layout details are rejected.');
 ok(await f.admin.request(`${s.fleet}/layouts/${id}`,'PATCH',{...meta,active:true,version:2}),200);
 assert.equal(ok(await f.admin.request(`${s.fleet}/layouts/${id}/revisions/1`),200).seatCount,4,'Activation leaves geometry alone.');
}));

test('company-wide fleet and driver grants stay separate; narrower grants, other companies and support get nothing',async()=>identityFixture(async f=>{
 const s=await setup(f),other=await setup(f,'other-fleet');const {id}=ok(await f.admin.request(s.fleet+'/layouts','POST',s.layout)),foreign=ok(await f.admin.request(other.fleet+'/layouts','POST',other.layout)).id;
 const dbody={employeeCode:'D1',nameEn:'Fictional Driver',nameAr:'Fictional Driver',phone:'+249 900 000 000',active:true,currentPassword:f.password};ok(await f.admin.request(s.drivers,'POST',dbody));
 const fleetOnly=await staff(f,s,await roleWith(f,s,['company.fleet.read']));ok(await fleetOnly.user.request(s.fleet),200);assert.equal((await fleetOnly.user.request(s.drivers)).status,403,'Fleet access does not reveal driver contacts.');
 assert.equal((await fleetOnly.user.request(s.fleet+'/layouts','POST',{...s.layout,code:'NOPE',currentPassword:fleetOnly.pass})).status,403);
 const driversOnly=await staff(f,s,await roleWith(f,s,['company.drivers.read']));assert.equal(ok(await driversOnly.user.request(s.drivers),200).items[0].phone,'+249 900 000 000');assert.equal((await driversOnly.user.request(s.fleet)).status,403);
 assert.equal((await driversOnly.user.request(s.drivers,'POST',{...dbody,employeeCode:'D2',currentPassword:driversOnly.pass})).status,403);
 const branch=await staff(f,s,await roleWith(f,s,['company.resources.read','company.fleet.read','company.fleet.manage','company.drivers.read','company.drivers.manage'],'branch'),{branchId:s.branch});
 assert.equal((await branch.user.request(s.fleet)).status,403);assert.equal((await branch.user.request(s.drivers)).status,403);const caps=ok(await branch.user.request('companies/'+s.cid),200).capabilities;assert.equal(caps.fleetRead,false);assert.equal(caps.driversRead,false);
 const admin=await staff(f,s,s.w.roles.find(r=>r.code==='company_administrator'));const adminCaps=ok(await admin.user.request('companies/'+s.cid),200).capabilities;assert.equal(adminCaps.fleetRead,true);assert.equal(adminCaps.driversRead,true);
 assert.equal((await admin.user.request(other.fleet)).status,404);
 assert.equal((await f.admin.request(s.fleet+'/buses','POST',{code:'X',registration:'X',layoutId:foreign,layoutRevision:1,active:true,currentPassword:f.password})).status,400,"Another company's layout is rejected.");
 const otherMember=await staff(f,other,other.w.roles.find(r=>r.code==='company_administrator'));
 assert.equal((await f.admin.request(s.drivers,'POST',{...dbody,employeeCode:'D3',memberId:otherMember.member.memberId||otherMember.member.id})).status,400,"Another company's member is rejected.");
 assert.equal((await f.admin.request(`companies/${s.cid}/support`,'POST',{login:'nobody@safeer.local',reason:'Fictional',hours:1,permissions:['company.fleet.read'],currentPassword:f.password})).status>=400,true,'Support grants cannot include fleet access.');
 assert.ok((await f.admin.request(`${s.fleet}/layouts/${id}/revisions/1`)).status===200);
}));

test('drivers: unique codes, optional contact and member link, deactivation and stale edits',async()=>identityFixture(async f=>{
 const s=await setup(f),member=await staff(f,s,s.w.roles.find(r=>r.code==='company_administrator')),memberId=ok(await f.admin.request('companies/'+s.cid),200).members[0].id;
 const body={employeeCode:'d-1',nameEn:'Fictional Driver',nameAr:'Fictional Driver',active:true,currentPassword:f.password},id=ok(await f.admin.request(s.drivers,'POST',body)).id;
 let row=ok(await f.admin.request(s.drivers),200).items[0];assert.equal(row.employeeCode,'D-1');assert.equal(row.phone,null);assert.equal(row.memberId,null);
 assert.equal((await f.admin.request(s.drivers,'POST',body)).error.code,'DUPLICATE_RECORD');assert.equal((await f.admin.request(s.drivers,'POST',{...body,employeeCode:'D-2',phone:'not a phone'})).status,400);
 const roles=(await f.migration.query('SELECT count(*)::int AS n FROM safeer.company_user_roles WHERE company_id=$1',[s.cid])).rows[0].n;
 ok(await f.admin.request(`${s.drivers}/${id}`,'PATCH',{...body,memberId,version:1}),200);row=ok(await f.admin.request(s.drivers),200).items[0];assert.equal(row.memberId,memberId);
 assert.equal((await f.migration.query('SELECT count(*)::int AS n FROM safeer.company_user_roles WHERE company_id=$1',[s.cid])).rows[0].n,roles,'A link grants no role.');
 assert.equal((await f.admin.request(`${s.drivers}/${id}`,'PATCH',{...body,version:1})).status,409);
 ok(await f.admin.request(`${s.drivers}/${id}`,'PATCH',{...body,memberId,active:false,version:2}),200);assert.equal(ok(await f.admin.request(s.drivers),200).items[0].active,false,'Deactivated records remain.');
 assert.equal((await member.user.request(s.drivers,'POST',{...body,employeeCode:'D-9',currentPassword:'wrong-password-value'})).status>=400,true,'Writes need the current password.');
 assert.ok(ok(await f.admin.request('companies/'+s.cid),200).audit.some(a=>a.action==='driver.updated'));
}));

test('raw RLS and SQL guards protect revisions and fleet records without the API',async()=>identityFixture(async f=>{
 const s=await setup(f),other=await setup(f,'raw-other'),{id}=ok(await f.admin.request(s.fleet+'/layouts','POST',s.layout));ok(await f.admin.request(s.drivers,'POST',{employeeCode:'D1',nameEn:'Fictional',nameAr:'Fictional',active:true,currentPassword:f.password}));
 for(const table of ['seat_layouts','seat_layout_revisions','seat_layout_seats','buses','drivers'])assert.equal((await f.api.db.pool.query(`SELECT * FROM safeer.${table}`)).rowCount,0,table+' without a session');
 const member=await staff(f,other,other.w.roles.find(r=>r.code==='company_administrator'));
 await context(f,member.user,async c=>{for(const table of ['seat_layouts','seat_layout_revisions','seat_layout_seats','drivers'])assert.equal((await c.query(`SELECT * FROM safeer.${table} WHERE company_id=$1`,[s.cid])).rowCount,0,'Another company reads nothing from '+table);});
 await assert.rejects(context(f,f.admin,c=>c.query('UPDATE safeer.seat_layout_revisions SET seat_count=1 WHERE layout_id=$1',[id])),e=>e.code==='42501','Runtime role has no UPDATE.');
 await assert.rejects(context(f,f.admin,c=>c.query('DELETE FROM safeer.seat_layout_seats WHERE layout_id=$1',[id])),e=>e.code==='42501','Runtime role has no DELETE.');
 await assert.rejects(context(f,f.admin,c=>c.query('DELETE FROM safeer.buses')),e=>e.code==='42501');await assert.rejects(context(f,f.admin,c=>c.query('DELETE FROM safeer.drivers')),e=>e.code==='42501');
 await assert.rejects(f.migration.query('UPDATE safeer.seat_layout_seats SET label=$1 WHERE layout_id=$2',['X',id]),e=>e.message==='IMMUTABLE_REVISION','Even the owner cannot edit a revision.');
 await assert.rejects(f.migration.query('DELETE FROM safeer.seat_layout_revisions WHERE layout_id=$1',[id]),e=>e.message==='IMMUTABLE_REVISION');
 await assert.rejects(f.migration.query('TRUNCATE safeer.seat_layout_seats'),e=>e.code==='0A000','Seat allocations now reference these seats, so truncation is refused by the foreign key.');
 await assert.rejects(context(f,f.admin,c=>c.query('INSERT INTO safeer.seat_layout_seats(company_id,layout_id,revision,row_number,column_number,label) VALUES($1,$2,1,1,2,$3)',[s.cid,id,'LATE'])),e=>e.message==='IMMUTABLE_REVISION','A sealed revision takes no new seats.');
 await assert.rejects(context(f,f.admin,async c=>{await c.query('INSERT INTO safeer.seat_layouts(id,company_id,code,name_en,name_ar) VALUES($1,$2,$3,$4,$4)',[randomUUID(),s.cid,'EMPTY','Fictional']);await c.query('SET CONSTRAINTS ALL IMMEDIATE');}),e=>e.message==='INVALID_SEAT_LAYOUT','A layout needs a revision.');
 await assert.rejects(context(f,f.admin,c=>c.query('UPDATE safeer.seat_layouts SET code=$1 WHERE id=$2',['RENAMED',id])),e=>e.message==='INVALID_SEAT_LAYOUT','The layout code is stable.');
 await assert.rejects(context(f,f.admin,c=>c.query('UPDATE safeer.seat_layouts SET id=$1 WHERE id=$2',[randomUUID(),id])),e=>e.code==='42501');
 assert.equal(ok(await f.admin.request(`${s.fleet}/layouts/${id}/revisions/1`),200).seats.length,4);
}));

test('concurrent saves keep one winner and cannot strand an active bus',async()=>identityFixture(async f=>{
 const s=await setup(f),{id}=ok(await f.admin.request(s.fleet+'/layouts','POST',s.layout));
 const revise=()=>f.admin.request(`${s.fleet}/layouts/${id}/revisions`,'POST',{...grid(),expectedRevision:1,currentPassword:f.password});
 const results=await Promise.all([revise(),revise()]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
 const list=ok(await f.admin.request(s.fleet),200).layouts[0];assert.equal(list.latestRevision,2);assert.equal(list.revisions.length,2,'No lost or duplicate revision.');
 const outcome=await Promise.all([f.admin.request(s.fleet+'/buses','POST',{code:'RACE',registration:'RACE',layoutId:id,layoutRevision:2,active:true,currentPassword:f.password}),f.admin.request(`${s.fleet}/layouts/${id}`,'PATCH',{nameEn:'Fictional Coach',nameAr:'Fictional Coach',active:false,version:1,currentPassword:f.password})]);
 assert.deepEqual(outcome.map(r=>r.status).sort(),outcome[0].status===201?[201,409]:[200,409]);
 const final=ok(await f.admin.request(s.fleet),200);assert.ok(final.layouts[0].active||!final.buses.some(b=>b.active),'An active bus never sits on an inactive layout.');
}));

test('company capacities fail explicitly at 200 buses, drivers and layout revisions',async()=>identityFixture(async f=>{
 const s=await setup(f),{id}=ok(await f.admin.request(s.fleet+'/layouts','POST',s.layout));
 await f.migration.query("INSERT INTO safeer.drivers(id,company_id,employee_code,name_en,name_ar) SELECT gen_random_uuid(),$1,'D'||n,'Fictional','Fictional' FROM generate_series(1,200) n",[s.cid]);
 assert.equal((await f.admin.request(s.drivers,'POST',{employeeCode:'OVER',nameEn:'Fictional',nameAr:'Fictional',active:true,currentPassword:f.password})).error.code,'CATALOG_LIMIT');
 await f.migration.query("INSERT INTO safeer.buses(id,company_id,code,registration,layout_id,layout_revision) SELECT gen_random_uuid(),$1,'B'||n,'R'||n,$2,1 FROM generate_series(1,200) n",[s.cid,id]);
 assert.equal((await f.admin.request(s.fleet+'/buses','POST',{code:'OVER',registration:'OVER',layoutId:id,layoutRevision:1,active:true,currentPassword:f.password})).error.code,'CATALOG_LIMIT');
 let revision=1;const user=(await f.migration.query("SELECT id FROM safeer.users WHERE normalized_login='owner@safeer.local'")).rows[0].id;
 await f.migration.query('BEGIN');
 try{for(;revision<200;){revision++;await f.migration.query('UPDATE safeer.seat_layouts SET latest_revision=$1 WHERE id=$2',[revision,id]);await f.migration.query('INSERT INTO safeer.seat_layout_revisions(company_id,layout_id,revision,row_count,column_count,seat_count,created_by) VALUES($1,$2,$3,1,1,1,$4)',[s.cid,id,revision,user]);await f.migration.query("INSERT INTO safeer.seat_layout_seats(company_id,layout_id,revision,row_number,column_number,label) VALUES($1,$2,$3,1,1,'A')",[s.cid,id,revision]);}await f.migration.query('COMMIT');}catch(error){await f.migration.query('ROLLBACK');throw error;}
 assert.equal((await f.admin.request(`${s.fleet}/layouts/${id}/revisions`,'POST',{...grid(),expectedRevision:200,currentPassword:f.password})).error.code,'CATALOG_LIMIT');
 assert.equal(ok(await f.admin.request(s.fleet),200).layouts[0].latestRevision,200,'The rejected save changed nothing.');
}));
