import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';

// D69: staff contact details, working roles that can open their workspace, and clear route-station errors.
const ok=(r,status=201)=>{assert.equal(r.status,status,r.raw);return r.data;};
async function company(f){
 const pw={currentPassword:f.password},cid=ok(await f.admin.request('companies','POST',{nameEn:'Fictional Staff Co',nameAr:'Fictional Staff Co',slug:'staff-details',holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).id;
 const w=ok(await f.admin.request('companies/'+cid),200);ok(await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',...pw}),200);
 return {cid,base:'companies/'+cid,pw};
}

test('members store optional job title and phone; a bad phone is refused',async()=>identityFixture(async f=>{
 const s=await company(f),role=ok(await f.admin.request(s.base+'/roles','POST',{displayName:'Agent',scope:'company',permissions:['company.bookings.read'],...s.pw}));
 const add=fields=>f.admin.request(s.base+'/members','POST',{login:`m${randomBytes(4).toString('hex')}@safeer.local`,displayName:'Fictional Agent',existing:false,assignments:[{roleId:role.id}],...fields,...s.pw});
 const made=ok(await add({jobTitle:'Station agent',phone:'0912345678'}));
 let m=ok(await f.admin.request(s.base),200).members.find(x=>x.id===made.id);
 assert.equal(m.jobTitle,'Station agent');assert.equal(m.phone,'+249912345678','Local numbers are stored in international form.');
 assert.equal((await add({phone:'12'})).error?.code,'INVALID_PHONE');
 const bare=ok(await add({}));assert.equal(ok(await f.admin.request(s.base),200).members.find(x=>x.id===bare.id).phone,null,'Both fields stay optional.');
 ok(await f.admin.request(s.base+'/members/'+made.id,'PATCH',{displayName:'Fictional Agent',jobTitle:'',phone:'+974 5512 3456',active:true,assignments:[{roleId:role.id}],version:m.version,...s.pw}),200);
 m=ok(await f.admin.request(s.base),200).members.find(x=>x.id===made.id);assert.equal(m.jobTitle,null);assert.equal(m.phone,'+97455123456');
}));

test('working roles always include company profile read so staff can open their workspace',async()=>identityFixture(async f=>{
 const s=await company(f),roles=()=>f.admin.request(s.base).then(r=>r.data.roles);
 const agent=ok(await f.admin.request(s.base+'/roles','POST',{displayName:'Agent',scope:'company',permissions:['company.bookings.read'],...s.pw}));
 const driver=ok(await f.admin.request(s.base+'/roles','POST',{displayName:'Driver only',scope:'company',permissions:['company.driver.operate'],...s.pw}));
 let list=await roles();
 assert.deepEqual(list.find(r=>r.id===agent.id).permissions,['company.bookings.read','company.profile.read']);
 assert.deepEqual(list.find(r=>r.id===driver.id).permissions,['company.driver.operate'],'Driver-only roles are unchanged.');
 const made=ok(await f.admin.request(s.base+'/members','POST',{login:'agent@safeer.local',displayName:'Fictional Agent',existing:false,assignments:[{roleId:agent.id}],...s.pw}));
 const c=f.client();ok(await c.signIn('agent@safeer.local',made.temporaryPassword));ok(await c.request('auth/password','POST',{currentPassword:made.temporaryPassword,newPassword:randomBytes(24).toString('hex')}));
 assert.equal((await c.request(s.base)).status,200,'The agent can open the company workspace.');
 const row=list.find(r=>r.id===agent.id);ok(await f.admin.request(s.base+'/roles/'+agent.id,'PATCH',{displayName:'Agent',active:true,permissions:['company.trips.read'],version:row.version,...s.pw}),200);
 assert.ok((await roles()).find(r=>r.id===agent.id).permissions.includes('company.profile.read'),'Editing keeps it too.');
}));

test('a route stop station must be in that stop city and is reported clearly',async()=>identityFixture(async f=>{
 const s=await company(f),city=async code=>ok(await f.admin.request('cities','POST',{code,nameEn:'City '+code,nameAr:'City '+code,countryCode:'SD',active:true,...s.pw})).id;
 const a=await city('SDA'),b=await city('SDB');
 const branch=ok(await f.admin.request(s.base+'/branches','POST',{nameEn:'Branch',nameAr:'Branch',code:'BR1',active:true,...s.pw})).id;
 const noCity=ok(await f.admin.request(s.base+'/stations','POST',{nameEn:'No city',nameAr:'No city',code:'ST0',branchId:branch,active:true,...s.pw})).id;
 const inA=ok(await f.admin.request(s.base+'/stations','POST',{nameEn:'In A',nameAr:'In A',code:'STA',branchId:branch,cityId:a,active:true,...s.pw})).id;
 const save=stationId=>f.admin.request(s.base+'/routes','POST',{code:'R'+randomBytes(2).toString('hex'),nameEn:'Route',nameAr:'Route',active:true,stops:[{cityId:a,stationId},{cityId:b}],...s.pw});
 assert.equal((await save(noCity)).error?.code,'ROUTE_STATION_CITY','A station without a city cannot be used.');
 assert.equal((await save(inA)).status,201,'A station in the stop city works.');
 const wrong=await f.admin.request(s.base+'/routes','POST',{code:'RX',nameEn:'Route',nameAr:'Route',active:true,stops:[{cityId:a},{cityId:b,stationId:inA}],...s.pw});
 assert.equal(wrong.error?.code,'ROUTE_STATION_CITY','A station from another city is refused.');
}));
