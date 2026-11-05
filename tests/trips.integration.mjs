import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';

const ok=(r,status=201)=>{assert.equal(r.status,status,r.raw);return r.data;};
const future=(days=10)=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
async function setup(f,slug='trip-demo'){
 const pw={currentPassword:f.password},cid=ok(await f.admin.request('companies','POST',{nameEn:'Fictional Transport',nameAr:'Fictional Arabic',slug,holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).id;
 let w=ok(await f.admin.request('companies/'+cid),200);ok(await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',...pw}),200);
 const cities=[];for(const code of ['AA','BB','CC'])cities.push(ok(await f.admin.request('cities','POST',{code:slug.toUpperCase()+'_'+code,nameEn:'City '+code,nameAr:'City '+code,countryCode:'SD',active:true,...pw})).id);
 const base=`companies/${cid}`,route=ok(await f.admin.request(base+'/routes','POST',{code:'DIRECT',nameEn:'Fictional Route',nameAr:'Fictional Route',active:true,stops:cities.map(cityId=>({cityId})),...pw})).id;
 const seats=[];for(let n=1;n<=4;n++)seats.push({row:n,column:1,label:'S'+n});
 const layout=ok(await f.admin.request(base+'/fleet/layouts','POST',{code:'COACH',nameEn:'Fictional Coach',nameAr:'Fictional Coach',active:true,rows:4,columns:1,seats,...pw})).id;
 const bus=async code=>ok(await f.admin.request(base+'/fleet/buses','POST',{code,registration:'REG-'+code,layoutId:layout,layoutRevision:1,active:true,...pw})).id;
 const driver=async code=>ok(await f.admin.request(base+'/drivers','POST',{employeeCode:code,nameEn:'Driver '+code,nameAr:'Driver '+code,phone:'+249900000000',active:true,...pw})).id;
 w=ok(await f.admin.request('companies/'+cid),200);
 return {cid,cities,route,layout,w,bus,driver,base,path:base+'/trips',pw,trip:(over={})=>({routeId:route,dates:[future()],time:'07:00',offsets:[0,60,180],fareMinor:150000,...pw,...over})};
}
async function staff(f,s,role,scope={}){
 const created=ok(await f.admin.request(`companies/${s.cid}/members`,'POST',{login:randomUUID()+'@safeer.local',displayName:'Fictional Staff',existing:false,assignments:[{roleId:role.id,...scope}],currentPassword:f.password}));
 const user=f.client();ok(await user.signIn(created.user.login,created.temporaryPassword));const pass=randomBytes(24).toString('hex');ok(await user.request('auth/password','POST',{currentPassword:created.temporaryPassword,newPassword:pass}));return {user,pass};
}
const raw=client=>client.cookie.slice(client.cookie.indexOf('=')+1);
const context=(f,client,action)=>f.api.db.transaction(async c=>{await c.query("SELECT set_config('safeer.session_token',$1,true)",[raw(client)]);return action(c);});
const one=async(f,s,over)=>ok(await f.admin.request(s.path,'POST',s.trip(over))).ids[0];
const get=async(f,s,id)=>ok(await f.admin.request(`${s.path}/${id}`),200);
const assign=(f,s,id,version,busId,driverId,reason)=>f.admin.request(`${s.path}/${id}/assignment`,'POST',{busId,driverId,reason,version,...s.pw});

test('a trip snapshots its route and later route edits cannot rewrite it',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await one(f,s);let d=await get(f,s,id);
 assert.equal(d.trip.status,'draft');assert.equal(d.trip.date,future());assert.equal(d.trip.time,'07:00');assert.equal(d.trip.routeCode,'DIRECT');assert.deepEqual(d.stops.map(x=>x.offsetMinutes),[0,60,180]);assert.equal(d.stops[1].cityNameEn,'City BB');
 assert.equal(Date.parse(d.trip.arrivalAt)-Date.parse(d.trip.departureAt),180*60000);
 ok(await f.admin.request(s.base+'/routes/'+s.route,'PATCH',{code:'RENAMED',nameEn:'Renamed Route',nameAr:'Renamed Route',active:true,stops:[{cityId:s.cities[2]},{cityId:s.cities[0]}],version:1,...s.pw}),200);
 d=await get(f,s,id);assert.equal(d.trip.routeNameEn,'Fictional Route');assert.equal(d.stops.length,3,'The trip keeps its original stops.');
 assert.equal((await f.admin.request(s.path,'POST',s.trip())).error.code,'INVALID_TRIP_STOPS','New trips must match the current route.');
 for(const bad of [[0],[5,60,180],[0,60,60],[0,200,100]])assert.ok((await f.admin.request(s.path+'/'+id,'PATCH',{date:future(),time:'08:00',offsets:bad,fareMinor:1,version:1,...s.pw})).status>=400,JSON.stringify(bad));
 assert.equal((await f.admin.request(s.path,'POST',s.trip({dates:['2026-02-30']}))).status,400);assert.equal((await f.admin.request(s.path,'POST',s.trip({time:'25:00'}))).status,400);
}));

test('repeating dates save together, in the company timezone, or not at all',async()=>identityFixture(async f=>{
 const s=await setup(f),dates=[future(5),future(6),future(7)],ids=ok(await f.admin.request(s.path,'POST',s.trip({dates}))).ids;assert.equal(ids.length,3);
 const d=await get(f,s,ids[0]);assert.equal(d.trip.timezone,'Africa/Khartoum');assert.equal(new Date(d.trip.departureAt).toISOString().slice(11,16),'05:00','07:00 in Khartoum is 05:00 UTC.');
 assert.equal((await f.admin.request(s.path,'POST',s.trip({dates:Array.from({length:32},(_,i)=>future(i+1))}))).status,400);assert.equal((await f.admin.request(s.path,'POST',s.trip({dates:[future(1),future(1)]}))).status,400);
 const before=ok(await f.admin.request(s.path),200).items.length;
 const bulk="INSERT INTO safeer.trips(id,company_id,route_id,route_version,route_code,route_name_en,route_name_ar,stop_count,timezone,departure_at,arrival_at,created_by) SELECT gen_random_uuid(),$1,$2,1,'X','X','X',2,'UTC',clock_timestamp()-interval '3 days',clock_timestamp()-interval '2 days',(SELECT id FROM safeer.users LIMIT 1) FROM generate_series(1,$3::int)";
 await assert.rejects(f.migration.query(bulk,[s.cid,s.route,1]),e=>e.message==='INVALID_TRIP_STOPS','A trip without stops is rejected even for the owner.');assert.equal(ok(await f.admin.request(s.path),200).items.length,before);
 await f.migration.query('BEGIN');try{await f.migration.query("SET LOCAL session_replication_role='replica'");await f.migration.query(bulk,[s.cid,s.route,4997]);await f.migration.query('COMMIT');}catch(error){await f.migration.query('ROLLBACK');throw error;}
 assert.equal((await f.admin.request(s.path,'POST',s.trip())).error.code,'CATALOG_LIMIT','Each company is bounded to 5000 trips.');
}));

test('a trip publishes only when ready, and then keeps its time and fare',async()=>identityFixture(async f=>{
 const s=await setup(f),bus=await s.bus('B1'),driver=await s.driver('D1'),id=await one(f,s,{fareMinor:0}),publish=v=>f.admin.request(`${s.path}/${id}/publish`,'POST',{version:v,...s.pw});
 assert.equal((await publish(1)).error.code,'TRIP_NOT_READY','No bus, no driver and no fare.');
 ok(await assign(f,s,id,1,bus,driver));assert.equal((await publish(2)).error.code,'TRIP_NOT_READY','Still no fare.');
 ok(await f.admin.request(`${s.path}/${id}`,'PATCH',{date:future(),time:'07:30',offsets:[0,60,180],fareMinor:90000,version:2,...s.pw}),200);
 assert.equal((await publish(2)).status,409,'A stale publish is rejected.');ok(await publish(3));
 let d=await get(f,s,id);assert.equal(d.trip.status,'published');assert.ok(d.trip.publishedAt);assert.equal(d.trip.time,'07:30');assert.equal(d.assignments[0].seatCount,4);assert.equal(d.assignments[0].driverNameEn,'Driver D1');
 assert.equal((await f.admin.request(`${s.path}/${id}`,'PATCH',{date:future(),time:'09:00',offsets:[0,60,180],fareMinor:1,version:4,...s.pw})).error.code,'TRIP_NOT_DRAFT');
 assert.equal((await publish(4)).error.code,'TRIP_NOT_DRAFT');
 const past=await one(f,s,{dates:[new Date(Date.now()-86400000*3).toISOString().slice(0,10)]});const bus2=await s.bus('B2'),driver2=await s.driver('D2');ok(await assign(f,s,past,1,bus2,driver2));assert.equal((await f.admin.request(`${s.path}/${past}/publish`,'POST',{version:2,...s.pw})).error.code,'TRIP_NOT_READY','A past trip cannot publish.');
 assert.equal((await f.admin.request(`${s.path}/${id}/cancel`,'POST',{reason:'',version:4,...s.pw})).status,400,'Cancelling needs a reason.');
 ok(await f.admin.request(`${s.path}/${id}/cancel`,'POST',{reason:'Fictional road closure',version:4,...s.pw}));d=await get(f,s,id);assert.equal(d.trip.status,'canceled');assert.equal(d.trip.cancelReason,'Fictional road closure');
 assert.equal((await f.admin.request(`${s.path}/${id}/cancel`,'POST',{reason:'Again',version:5,...s.pw})).error.code,'TRIP_NOT_DRAFT','A canceled trip stays canceled.');assert.equal((await assign(f,s,id,5,bus,driver,'x')).error.code,'TRIP_NOT_DRAFT');
 const audit=ok(await f.admin.request('companies/'+s.cid),200).audit.map(a=>a.action);for(const action of ['trip.created','trip.updated','trip.assigned','trip.published','trip.canceled'])assert.ok(audit.includes(action),action);
}));

test('a bus or driver cannot overlap, replacements keep history, and canceling frees them',async()=>identityFixture(async f=>{
 const s=await setup(f),b1=await s.bus('B1'),b2=await s.bus('B2'),d1=await s.driver('D1'),d2=await s.driver('D2');
 const first=await one(f,s),overlap=await one(f,s,{time:'08:00'}),later=await one(f,s,{time:'10:00'});ok(await assign(f,s,first,1,b1,d1));
 assert.equal((await assign(f,s,overlap,1,b1,d2)).error.code,'ASSIGNMENT_CONFLICT','Same bus.');assert.equal((await assign(f,s,overlap,1,b2,d1)).error.code,'ASSIGNMENT_CONFLICT','Same driver.');
 ok(await assign(f,s,later,1,b1,d1),201);assert.equal((await get(f,s,later)).trip.version,2,'Back-to-back trips (arrival 10:00, departure 10:00) are allowed.');
 assert.equal((await f.admin.request(`${s.path}/${later}`,'PATCH',{date:future(),time:'09:00',offsets:[0,60,180],fareMinor:1,version:2,...s.pw})).error.code,'ASSIGNMENT_CONFLICT','Moving a trip rechecks overlap.');
 assert.equal((await assign(f,s,first,2,b2,d2)).error.code,'REASON_REQUIRED');ok(await assign(f,s,first,2,b2,d2,'Fictional breakdown'));
 const d=await get(f,s,first);assert.equal(d.assignments.length,2);assert.equal(d.assignments.find(a=>a.replacedAt).replacedReason,'Fictional breakdown');assert.equal(d.assignments.filter(a=>!a.replacedAt)[0].busCode,'B2');
 ok(await f.admin.request(`${s.path}/${later}/cancel`,'POST',{reason:'Fictional',version:2,...s.pw}));ok(await assign(f,s,overlap,1,b1,d1));assert.equal((await get(f,s,overlap)).assignments[0].busCode,'B1','Canceling frees the bus and driver.');
}));

test('active assignments protect buses and drivers until the trip is canceled',async()=>identityFixture(async f=>{
 const s=await setup(f),bus=await s.bus('B1'),driver=await s.driver('D1'),id=await one(f,s);ok(await assign(f,s,id,1,bus,driver));
 const busBody={code:'B1',registration:'REG-B1',layoutId:s.layout,layoutRevision:1,active:false,version:1,...s.pw},driverBody={employeeCode:'D1',nameEn:'Driver D1',nameAr:'Driver D1',active:false,version:1,...s.pw};
 assert.equal((await f.admin.request(`${s.base}/fleet/buses/${bus}`,'PATCH',busBody)).error.code,'TRIP_RESOURCE_IN_USE');assert.equal((await f.admin.request(`${s.base}/drivers/${driver}`,'PATCH',driverBody)).error.code,'TRIP_RESOURCE_IN_USE');
 ok(await f.admin.request(`${s.path}/${id}/cancel`,'POST',{reason:'Fictional',version:2,...s.pw}));ok(await f.admin.request(`${s.base}/fleet/buses/${bus}`,'PATCH',busBody),200);ok(await f.admin.request(`${s.base}/drivers/${driver}`,'PATCH',driverBody),200);
 const next=await one(f,s);assert.equal((await assign(f,s,next,1,bus,await s.driver('D2'))).error.code,'INACTIVE_ASSIGNMENT');
 const retired=ok(await f.admin.request(s.base+'/routes/'+s.route),200).route;ok(await f.admin.request(s.base+'/routes/'+s.route,'PATCH',{code:retired.code,nameEn:retired.nameEn,nameAr:retired.nameAr,active:false,stops:s.cities.map(cityId=>({cityId})),version:retired.version,...s.pw}),200);
 assert.equal((await f.admin.request(s.path,'POST',s.trip())).error.code,'INACTIVE_ROUTE_RESOURCE');
}));

test('trip grants are separate and company-wide; other companies and narrower grants get nothing',async()=>identityFixture(async f=>{
 const s=await setup(f),other=await setup(f,'trip-other'),id=await one(f,s),bus=await s.bus('B1'),driver=await s.driver('D1');
 const role=async(permissions,scope='company')=>ok(await f.admin.request(`companies/${s.cid}/roles`,'POST',{displayName:'Fictional '+randomUUID().slice(0,8),scope,permissions:['company.profile.read',...permissions],...s.pw}));
 const reader=await staff(f,s,await role(['company.trips.read']));assert.equal(ok(await reader.user.request(s.path),200).canManage,false);assert.ok(!JSON.stringify(ok(await reader.user.request(`${s.path}/${id}`),200)).includes('+249'),'Trip readers never see driver contact details.');
 assert.equal((await reader.user.request(s.path,'POST',s.trip({currentPassword:reader.pass}))).status,403);
 const partial=await staff(f,s,await role(['company.trips.read','company.trips.manage']));assert.equal((await partial.user.request(s.path,'POST',s.trip({currentPassword:partial.pass}))).status,403,'Managing trips also needs route, fleet and driver reads.');
 const branch=await staff(f,s,await role(['company.trips.read','company.trips.manage','company.resources.read'],'branch'),{branchId:ok(await f.admin.request(`${s.base}/branches`,'POST',{code:'MAIN',nameEn:'Fictional',nameAr:'Fictional',active:true,...s.pw})).id});assert.equal((await branch.user.request(s.path)).status,403);assert.equal(ok(await branch.user.request('companies/'+s.cid),200).capabilities.tripsRead,false);
 const admin=await staff(f,s,s.w.roles.find(r=>r.code==='company_administrator'));ok(await admin.user.request(s.path),200);assert.equal((await admin.user.request(other.path)).status,404);assert.equal((await admin.user.request(`${other.path}/${id}`)).status,404);
 const otherBus=await other.bus('X1'),otherDriver=await other.driver('X1');assert.equal((await assign(f,s,id,1,otherBus,driver)).status>=400,true,"Another company's bus is rejected.");assert.equal((await assign(f,s,id,1,bus,otherDriver)).status>=400,true,"Another company's driver is rejected.");assert.equal((await f.admin.request(s.path,'POST',s.trip({routeId:other.route}))).status>=400,true,"Another company's route is rejected.");
 assert.equal((await get(f,s,id)).assignments.length,0);
 assert.ok((await f.admin.request(`${s.base}/support`,'POST',{login:'nobody@safeer.local',reason:'Fictional',hours:1,permissions:['company.trips.read'],...s.pw})).status>=400,'Support grants cannot include trips.');
}));

test('raw SQL cannot read across companies, delete history or forge snapshots',async()=>identityFixture(async f=>{
 const s=await setup(f),other=await setup(f,'raw-trip'),bus=await s.bus('B1'),driver=await s.driver('D1'),id=await one(f,s);ok(await assign(f,s,id,1,bus,driver));const outsider=await staff(f,other,other.w.roles.find(r=>r.code==='company_administrator'));
 for(const table of ['trips','trip_stops','trip_assignments'])assert.equal((await f.api.db.pool.query(`SELECT * FROM safeer.${table}`)).rowCount,0,table);
 await context(f,outsider.user,async c=>{for(const table of ['trips','trip_stops','trip_assignments'])assert.equal((await c.query(`SELECT * FROM safeer.${table} WHERE company_id=$1`,[s.cid])).rowCount,0,table);});
 for(const sql of ['DELETE FROM safeer.trips','DELETE FROM safeer.trip_stops','DELETE FROM safeer.trip_assignments'])await assert.rejects(context(f,f.admin,c=>c.query(sql)),e=>e.code==='42501',sql);
 await assert.rejects(context(f,f.admin,c=>c.query('UPDATE safeer.trips SET route_code=$1 WHERE id=$2',['FORGED',id])),e=>e.code==='42501','The route snapshot cannot change.');
 await assert.rejects(context(f,f.admin,c=>c.query('UPDATE safeer.trip_stops SET city_name_en=$1 WHERE trip_id=$2',['FORGED',id])),e=>e.code==='42501','Stop names cannot change.');
 await assert.rejects(context(f,f.admin,c=>c.query('UPDATE safeer.trip_assignments SET bus_code=$1 WHERE trip_id=$2',['FORGED',id])),e=>e.code==='42501','Assignment history cannot change.');
 await assert.rejects(f.migration.query('DELETE FROM safeer.trip_assignments WHERE trip_id=$1',[id]),e=>e.code==='42501','Even the owner cannot delete history.');
 const unready=await one(f,s,{fareMinor:0,time:'20:00'});await assert.rejects(context(f,f.admin,c=>c.query("UPDATE safeer.trips SET status='published' WHERE id=$1",[unready])),e=>e.message==='TRIP_NOT_READY','SQL has no shortcut past the publish checks.');
 await assert.rejects(context(f,f.admin,async c=>{await c.query('UPDATE safeer.trip_stops SET offset_minutes=999 WHERE trip_id=$1 AND stop_index=2',[id]);await c.query('SET CONSTRAINTS ALL IMMEDIATE');}),e=>e.message==='INVALID_TRIP_STOPS','Arrival must match the last stop.');
 assert.equal((await get(f,s,id)).stops[2].offsetMinutes,180);
}));

test('simultaneous saves keep one winner and never double-book',async()=>identityFixture(async f=>{
 const s=await setup(f),b=await s.bus('B1'),d=await s.driver('D1'),first=await one(f,s),second=await one(f,s);
 const race=await Promise.all([assign(f,s,first,1,b,d),assign(f,s,second,1,b,d)]);assert.deepEqual(race.map(r=>r.status).sort(),[201,409],'Only one trip gets the bus.');
 const winner=race[0].status===201?first:second,publish=()=>f.admin.request(`${s.path}/${winner}/publish`,'POST',{version:2,...s.pw});
 assert.deepEqual((await Promise.all([publish(),publish()])).map(r=>r.status).sort(),[201,409],'Only one publish applies.');
}));
