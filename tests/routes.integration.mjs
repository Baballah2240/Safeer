import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';

const ok=(r,status=201)=>{assert.equal(r.status,status,r.raw);return r.data;};
async function setup(f,slug='route-demo'){
 const cid=ok(await f.admin.request('companies','POST',{nameEn:'Fictional Transport',nameAr:'Fictional Arabic',slug,holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',currentPassword:f.password})).id;
 let w=ok(await f.admin.request('companies/'+cid),200);
 ok(await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',currentPassword:f.password}),200);
 const cities=[];for(const code of ['AA','BB','CC'])cities.push(ok(await f.admin.request('cities','POST',{code:slug.toUpperCase()+'_'+code,nameEn:'Fictional '+code,nameAr:'Fictional '+code,countryCode:'SD',active:true,currentPassword:f.password})).id);
 const branch=ok(await f.admin.request(`companies/${cid}/branches`,'POST',{code:'CENTRAL',nameEn:'Fictional Branch',nameAr:'Fictional Branch',active:true,currentPassword:f.password})).id;
 const stations=[];for(const [i,cityId]of cities.entries())stations.push(ok(await f.admin.request(`companies/${cid}/stations`,'POST',{code:'S'+i,nameEn:'Fictional Station '+i,nameAr:'Fictional Station '+i,branchId:branch,cityId,active:true,currentPassword:f.password})).id);
 w=ok(await f.admin.request('companies/'+cid),200);
 const payload={code:'DIRECT',nameEn:'Fictional Route',nameAr:'Fictional Route',active:true,stops:cities.map((cityId,i)=>({cityId,stationId:stations[i]})),currentPassword:f.password};
 return {cid,cities,branch,stations,w,payload,path:`companies/${cid}/routes`};
}
async function staff(f,s,role,scope={}){
 const created=ok(await f.admin.request(`companies/${s.cid}/members`,'POST',{login:randomUUID()+'@safeer.local',displayName:'Fictional Staff',existing:false,assignments:[{roleId:role.id,...scope}],currentPassword:f.password}));
 const user=f.client();ok(await user.signIn(created.user.login,created.temporaryPassword));const pass=randomBytes(24).toString('hex');ok(await user.request('auth/password','POST',{currentPassword:created.temporaryPassword,newPassword:pass}));return {user,pass};
}
const raw=client=>client.cookie.slice(client.cookie.indexOf('=')+1);
async function context(f,client,action){return f.api.db.transaction(async c=>{await c.query("SELECT set_config('safeer.session_token',$1,true)",[raw(client)]);return action(c);});}

test('global city catalog is authenticated, bilingual, versioned and Super Admin-only',async()=>identityFixture(async f=>{
 const s=await setup(f),employee=await staff(f,s,s.w.roles.find(r=>r.code==='company_administrator'));
 assert.equal((await f.client().request('cities')).status,401);
 const catalog=ok(await employee.user.request('cities'),200);assert.equal(catalog.canManage,false);assert.equal(catalog.items.length,3);
 const city=catalog.items[0],body={...city,id:undefined,currentPassword:employee.pass};assert.equal((await employee.user.request('cities/'+city.id,'PATCH',body)).status,403);
 ok(await f.admin.request('cities/'+city.id,'PATCH',{...body,nameEn:'Renamed Fictional City',currentPassword:f.password}),200);
 assert.equal((await f.admin.request('cities/'+city.id,'PATCH',{...body,currentPassword:f.password})).status,409);
 assert.equal((await f.admin.request('cities','POST',{...body,version:undefined,companyId:s.cid,currentPassword:f.password})).status,400);
 assert.equal((await f.admin.request('cities','POST',{...body,version:undefined,countryCode:'SUD',currentPassword:f.password})).status,400);
 assert.ok((await f.admin.request('identity/audit')).data.items.some(a=>a.action==='catalog.city.updated'));
}));

test('routes save ordered stops and endpoints atomically with station-city validation and audit',async()=>identityFixture(async f=>{
 const s=await setup(f),id=ok(await f.admin.request(s.path,'POST',s.payload)).id;
 let d=ok(await f.admin.request(s.path+'/'+id),200);assert.equal(d.route.originCityId,s.cities[0]);assert.equal(d.route.destinationCityId,s.cities[2]);assert.deepEqual(d.stops.map(x=>x.stopIndex),[0,1,2]);
 const update={...s.payload,version:d.route.version,stops:[s.payload.stops[2],s.payload.stops[1],s.payload.stops[0]]};ok(await f.admin.request(s.path+'/'+id,'PATCH',update),200);
 d=ok(await f.admin.request(s.path+'/'+id),200);assert.equal(d.route.originCityId,s.cities[2]);assert.equal(d.route.version,2);
 for(const stops of [[s.payload.stops[0]],Array(31).fill(s.payload.stops[0]),[s.payload.stops[0],s.payload.stops[0]],[{cityId:s.cities[0],stationId:s.stations[1]},s.payload.stops[2]]])assert.ok((await f.admin.request(s.path+'/'+id,'PATCH',{...s.payload,version:2,stops})).status>=400);
 assert.deepEqual(ok(await f.admin.request(s.path+'/'+id),200),d,'failed replacement must preserve all stops and version');
 const cityOnly=ok(await f.admin.request(s.path,'POST',{...s.payload,code:'CITY-ONLY',stops:[{cityId:s.cities[0]},{cityId:s.cities[2]}]}));assert.equal(ok(await f.admin.request(s.path+'/'+cityOnly.id),200).stops[0].stationId,null);
 const extra=ok(await f.admin.request(`companies/${s.cid}/stations`,'POST',{code:'EXTRA',nameEn:'Fictional Extra Station',nameAr:'Fictional Extra Station',branchId:s.branch,cityId:s.cities[0],active:true,currentPassword:f.password})).id;
 ok(await f.admin.request(s.path,'POST',{...s.payload,code:'MULTI-STATION',stops:[s.payload.stops[0],{cityId:s.cities[0],stationId:extra},s.payload.stops[2]]}));
 assert.ok(ok(await f.admin.request('companies/'+s.cid),200).audit.some(a=>a.action==='route.updated'));
}));

test('cross-company references, forged ownership and branch-only route grants cannot bypass scope',async()=>identityFixture(async f=>{
 const s=await setup(f),other=await setup(f,'other-demo');const id=ok(await f.admin.request(s.path,'POST',s.payload)).id;
 const admin=await staff(f,s,s.w.roles.find(r=>r.code==='company_administrator'));
 assert.equal((await admin.user.request(other.path)).status,404);assert.equal((await admin.user.request(other.path+'/'+id)).status,404);
 assert.equal((await f.admin.request(s.path,'POST',{...s.payload,code:'FOREIGN',stops:[{cityId:other.cities[0],stationId:other.stations[0]},s.payload.stops[2]]})).status,400);
 assert.equal((await admin.user.request(s.path,'POST',{...s.payload,currentPassword:admin.pass,companyId:other.cid})).status,400);
 const role=ok(await f.admin.request(`companies/${s.cid}/roles`,'POST',{displayName:'Branch route attempt',scope:'branch',permissions:['company.profile.read','company.resources.read','company.routes.read','company.routes.manage'],currentPassword:f.password}));
 const branch=await staff(f,s,role,{branchId:s.branch});assert.equal((await branch.user.request(s.path)).status,403);
 assert.equal((await branch.user.request(s.path,'POST',{...s.payload,currentPassword:branch.pass})).status,403);
 assert.equal(ok(await branch.user.request('companies/'+s.cid),200).capabilities.routesRead,false);
}));

test('active routes protect cities, stations and branches; historical station-city links stay consistent',async()=>identityFixture(async f=>{
 const s=await setup(f),id=ok(await f.admin.request(s.path,'POST',s.payload)).id;
 const city=ok(await f.admin.request('cities'),200).items.find(c=>c.id===s.cities[0]);
 const changeCity=()=>f.admin.request('cities/'+city.id,'PATCH',{...city,id:undefined,active:false,currentPassword:f.password});
 assert.equal((await changeCity()).error.code,'RESOURCE_IN_USE');
 const station=s.w.stations[0],stationPath=`companies/${s.cid}/stations/${station.id}`,stationBody={...station,id:undefined,canEdit:undefined,currentPassword:f.password};
 assert.equal((await f.admin.request(stationPath,'PATCH',{...stationBody,active:false})).error.code,'RESOURCE_IN_USE');
 assert.equal((await f.admin.request(stationPath,'PATCH',{...stationBody,cityId:s.cities[2]})).error.code,'STATION_CITY_IN_USE');
 const branch=s.w.branches[0];assert.equal((await f.admin.request(`companies/${s.cid}/branches/${branch.id}`,'PATCH',{...branch,id:undefined,canEdit:undefined,active:false,currentPassword:f.password})).error.code,'RESOURCE_IN_USE');
 ok(await f.admin.request(s.path+'/'+id,'PATCH',{...s.payload,version:1,active:false}),200);ok(await changeCity(),200);
 assert.equal((await f.admin.request(s.path+'/'+id,'PATCH',{...s.payload,version:2})).error.code,'INACTIVE_ROUTE_RESOURCE');
 assert.equal((await f.admin.request(stationPath,'PATCH',{...stationBody,cityId:s.cities[2]})).error.code,'STATION_CITY_IN_USE');
 ok(await f.admin.request(s.path+'/'+id,'PATCH',{...s.payload,version:2,active:false,stops:s.cities.map(cityId=>({cityId}))}),200);
 ok(await f.admin.request(stationPath,'PATCH',{...stationBody,cityId:s.cities[2]}),200);
}));

test('raw RLS and SQL constraints protect routes even without the API',async()=>identityFixture(async f=>{
 const s=await setup(f),id=ok(await f.admin.request(s.path,'POST',s.payload)).id,member=await staff(f,s,s.w.roles.find(r=>r.code==='company_administrator'));
 assert.equal((await f.api.db.pool.query('SELECT * FROM safeer.cities')).rowCount,0);assert.equal((await f.api.db.pool.query('SELECT * FROM safeer.routes')).rowCount,0);
 await context(f,member.user,async c=>{assert.equal((await c.query('SELECT * FROM safeer.routes')).rowCount,1);});
 assert.equal((await context(f,member.user,c=>c.query('UPDATE safeer.cities SET name_en=$1 WHERE id=$2',['Unauthorized',s.cities[0]]))).rowCount,0);
 await assert.rejects(context(f,f.admin,c=>c.query('INSERT INTO safeer.routes(id,company_id,code,name_en,name_ar,origin_city_id,destination_city_id) VALUES($1,$2,$3,$4,$4,$5,$6)',[randomUUID(),s.cid,'NO-STOPS','Fictional',s.cities[0],s.cities[2]])),e=>e.message==='INVALID_ROUTE_STOPS');
 await assert.rejects(context(f,f.admin,c=>c.query('DELETE FROM safeer.route_stops WHERE company_id=$1 AND route_id=$2 AND stop_index=1',[s.cid,id])),e=>e.message==='INVALID_ROUTE_STOPS');
 await assert.rejects(context(f,f.admin,c=>c.query('UPDATE safeer.routes SET id=$1 WHERE id=$2',[randomUUID(),id])),e=>e.code==='42501');
 assert.equal(ok(await f.admin.request(s.path+'/'+id),200).stops.length,3);
}));

test('concurrent route edits and resource deactivation cannot leave an invalid active route',async()=>identityFixture(async f=>{
 const s=await setup(f),id=ok(await f.admin.request(s.path,'POST',{...s.payload,active:false})).id;
 let results=await Promise.all(['First','Second'].map(nameEn=>f.admin.request(s.path+'/'+id,'PATCH',{...s.payload,active:false,nameEn,version:1})));
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const city=ok(await f.admin.request('cities'),200).items.find(c=>c.id===s.cities[0]);
 results=await Promise.all([f.admin.request(s.path+'/'+id,'PATCH',{...s.payload,version:2}),f.admin.request('cities/'+city.id,'PATCH',{...city,id:undefined,active:false,currentPassword:f.password})]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const final=ok(await f.admin.request(s.path+'/'+id),200),lastCity=ok(await f.admin.request('cities'),200).items.find(c=>c.id===city.id);assert.ok(!final.route.active||lastCity.active);
}));

test('support route access is explicitly read-only, revocable and expired against database time',async()=>identityFixture(async f=>{
 const s=await setup(f),support=ok(await f.admin.request('identity/users','POST',{login:'support-routes@safeer.local',displayName:'Fictional Support',currentPassword:f.password}));
 ok(await f.admin.request(`identity/users/${support.user.id}/roles`,'PUT',{roleIds:['00000000-0000-4000-8000-000000000002'],version:support.user.version,currentPassword:f.password}),200);
 const user=f.client();ok(await user.signIn(support.user.login,support.temporaryPassword));const pass=randomBytes(24).toString('hex');ok(await user.request('auth/password','POST',{currentPassword:support.temporaryPassword,newPassword:pass}));
 assert.equal((await user.request(s.path)).status,404);
 const grant=ok(await f.admin.request(`companies/${s.cid}/support`,'POST',{login:support.user.login,reason:'Fictional route review',hours:1,permissions:['company.profile.read','company.routes.read'],currentPassword:f.password}));
 ok(await user.request(s.path),200);assert.equal((await user.request(s.path,'POST',{...s.payload,currentPassword:pass})).status,403);
 await f.migration.query("UPDATE safeer.support_access_grants SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' WHERE id=$1",[grant.id]);assert.equal((await user.request(s.path)).status,404);
}));

test('city and route capacities fail explicitly without silently truncating catalogs',async()=>identityFixture(async f=>{
 const s=await setup(f);
 await f.migration.query("INSERT INTO safeer.cities(id,code,name_en,name_ar) SELECT gen_random_uuid(),'CAP_'||n,'Fictional City '||n,'Fictional City '||n FROM generate_series(1,997) n");
 assert.equal(ok(await f.admin.request('cities'),200).items.length,1000);
 assert.equal((await f.admin.request('cities','POST',{code:'OVER',nameEn:'Fictional Overflow',nameAr:'Fictional Overflow',countryCode:'SD',active:true,currentPassword:f.password})).error.code,'CATALOG_LIMIT');
 await f.migration.query('BEGIN');
 try{
  await f.migration.query("INSERT INTO safeer.routes(id,company_id,code,name_en,name_ar,origin_city_id,destination_city_id) SELECT gen_random_uuid(),$1,'CAP_'||n,'Fictional Route '||n,'Fictional Route '||n,$2,$3 FROM generate_series(1,500) n",[s.cid,s.cities[0],s.cities[2]]);
  await f.migration.query('INSERT INTO safeer.route_stops(company_id,route_id,stop_index,city_id) SELECT r.company_id,r.id,n,CASE WHEN n=0 THEN r.origin_city_id ELSE r.destination_city_id END FROM safeer.routes r CROSS JOIN generate_series(0,1) n WHERE company_id=$1',[s.cid]);
  await f.migration.query('COMMIT');
 }catch(error){await f.migration.query('ROLLBACK');throw error;}
 assert.equal(ok(await f.admin.request(s.path),200).items.length,500);
 assert.equal((await f.admin.request(s.path,'POST',s.payload)).error.code,'CATALOG_LIMIT');
}));
