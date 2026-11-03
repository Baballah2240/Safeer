import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';
import {ok,setup,paid,staff} from './support/boarding-fixture.mjs';
import {financeVolume} from './support/finance-volume.mjs';
const range=()=>{const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Khartoum'}).format(new Date());return {from:today,to:today};};
const report=(client,base,over={})=>client.request(base+'/finance?'+new URLSearchParams({...range(),...over}));
const fixture=fn=>identityFixture(async f=>{const s=await setup(f,'finance-demo'),tid=await s.trip();await fn(f,{...s,tid});});
const close=(f,s,countedMinor)=>f.admin.request(s.base+'/counter/sessions/'+s.sessionId+'/close','POST',{countedMinor,note:'Fictional difference',currentPassword:f.password});

test('finance totals count a multi-seat payment once, keep refunds separate and reconcile closed cash exactly',()=>fixture(async(f,s)=>{
 const p=await paid(f,s,s.tid,['1','2']);
 let r=ok(await report(f.admin,s.base),200);assert.equal(r.totals[0].salesMinor,'300000');assert.equal(r.totals[0].ticketsSold,2);assert.equal(r.movements.length,1);assert.equal(r.sessions[0].expectedMinor,'400000');
 ok(await f.admin.request(`${s.base}/bookings/${p.bid}/refund`,'POST',{reason:'Fictional',key:randomUUID(),currentPassword:f.password}));
 r=ok(await report(f.admin,s.base),200);assert.deepEqual([r.totals[0].salesMinor,r.totals[0].refundMinor,r.totals[0].netMinor],['300000','300000','0']);assert.equal(r.sessions[0].expectedMinor,'100000');assert.equal(r.totals[0].ticketsRefunded,2);
 s.sessionId=r.sessions[0].id;ok(await close(f,s,99900));
 r=ok(await report(f.admin,s.base),200);assert.equal(r.sessions[0].countedMinor,'99900');assert.equal(r.sessions[0].varianceMinor,'-100');assert.equal(r.sessions[0].recordedExpectedMinor,'100000');assert.equal(r.methods[0].salesMinor,'300000');
 const payload=JSON.stringify(r);for(const forbidden of ['0912345678','Fictional Traveler','currentPassword','method_reference','luggage_note','token'])assert.equal(payload.includes(forbidden),false,forbidden);
}));
test('finance scope follows each transaction counter, not the trip; other tenants and drivers receive nothing',()=>fixture(async(f,s)=>{
 await paid(f,s,s.tid);const permitted=await staff(f,s,['company.profile.read','company.finance.read'],{branchId:s.branch,stationId:s.station},'station');
 assert.equal(ok(await report(permitted.c,s.base),200).movementCount,1);
 const secondBranch=ok(await f.admin.request(s.base+'/branches','POST',{code:'B2',nameEn:'Other branch',nameAr:'فرع آخر',active:true,...s.pw})).id;
 const hidden=await staff(f,s,['company.profile.read','company.finance.read'],{branchId:secondBranch},'branch');assert.equal(ok(await report(hidden.c,s.base),200).movementCount,0);
 const noFinance=await staff(f,s,['company.profile.read','company.driver.operate']);assert.equal((await report(noFinance.c,s.base)).status,403);
 const other=await setup(f,'finance-other');assert.equal((await report(permitted.c,other.base)).status,403);
 await f.migration.query("UPDATE safeer.company_roles SET active=false WHERE company_id=$1 AND id IN (SELECT role_id FROM safeer.company_user_roles WHERE member_id=(SELECT id FROM safeer.company_users WHERE user_id=(SELECT id FROM safeer.users WHERE normalized_login=$2) AND company_id=$1))",[s.cid,ok(await permitted.c.request('auth/me'),200).login]);
 assert.equal((await report(permitted.c,s.base)).status,403);
 await assert.rejects(f.api.db.pool.query('SELECT * FROM safeer.payments'),{code:'42501'});
}));

test('finance readers cannot change money or close cash sessions and support grants cannot include finances',()=>fixture(async(f,s)=>{
 const p=await paid(f,s,s.tid),viewer=await staff(f,s,['company.profile.read','company.finance.read']);
 const r=ok(await report(viewer.c,s.base),200);assert.equal(r.sessions[0].counterName,'Counter 1');
 assert.equal((await viewer.c.request(`${s.base}/counter/sessions/${r.sessions[0].id}/close`,'POST',{countedMinor:250000,currentPassword:viewer.pass})).status,403);
 assert.equal((await viewer.c.request(`${s.base}/bookings/${p.bid}/refund`,'POST',{key:randomUUID(),reason:'Fictional',currentPassword:viewer.pass})).status,403);
 const created=ok(await f.admin.request('identity/users','POST',{displayName:'Fictional Support',login:'finance-support@safeer.local',currentPassword:f.password}));
 ok(await f.admin.request(`identity/users/${created.user.id}/roles`,'PUT',{roleIds:['00000000-0000-4000-8000-000000000002'],version:created.user.version,currentPassword:f.password}),200);
 const support=f.client();ok(await support.signIn(created.user.login,created.temporaryPassword));ok(await support.request('auth/password','POST',{currentPassword:created.temporaryPassword,newPassword:randomUUID()+randomUUID()}));
 const grant={login:created.user.login,reason:'Fictional investigation',hours:1,permissions:['company.profile.read','company.resources.read'],currentPassword:f.password};ok(await f.admin.request(s.base+'/support','POST',grant));
 assert.equal((await report(support,s.base)).status,403);assert.equal((await support.request(s.base+'/finance/export','POST',range())).status,403);
 assert.equal((await f.admin.request(s.base+'/support','POST',{...grant,permissions:['company.profile.read','company.finance.read']})).status,400);
}));
test('noncash methods never change drawer totals, filters keep session totals whole and currencies never combine',()=>fixture(async(f,s)=>{
 ok(await f.admin.request(s.base+'/payment-settings','PUT',{bankTransfer:true,mobileWallet:true,version:0,currentPassword:f.password}),200);
 const response=await f.admin.request(s.base+'/counter/sales','POST',{tripId:s.tid,seats:['1'],mobile:'0912345678',travelers:[{seat:'1',name:'Fictional transfer'}],method:'bank_transfer',reference:'FICT-TRANSFER',key:randomUUID()});ok(response);
 await paid(f,s,s.tid,['2']);const all=ok(await report(f.admin,s.base),200),cash=ok(await report(f.admin,s.base,{method:'bank_transfer'}),200);
 assert.equal(all.movementCount,2);assert.equal(cash.movementCount,1);assert.equal(cash.totals[0].salesMinor,'150000');assert.equal(cash.sessions[0].cashInMinor,'150000');assert.equal(cash.sessions[0].expectedMinor,'250000');
 // Currency settings are unchanged; simulate legacy multi-currency history in the isolated fixture.
 await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.payments SET currency='USD' WHERE method='bank_transfer'");await f.migration.query('SET session_replication_role=DEFAULT');
 const multi=ok(await report(f.admin,s.base),200);assert.deepEqual(multi.totals.map(x=>x.currency),['SDG','USD']);
}));
test('posting dates use company timezone; refunds on a later day produce negative net collections',()=>fixture(async(f,s)=>{
 const p=await paid(f,s,s.tid);ok(await f.admin.request(`${s.base}/bookings/${p.bid}/refund`,'POST',{reason:'Fictional',key:randomUUID(),currentPassword:f.password}));
 await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.payments SET created_at='2026-10-31T23:30:00Z'; UPDATE safeer.refunds SET created_at='2026-11-01T23:30:00Z'");await f.migration.query('SET session_replication_role=DEFAULT');
 const first=ok(await report(f.admin,s.base,{from:'2026-11-01',to:'2026-11-01'}),200),second=ok(await report(f.admin,s.base,{from:'2026-11-02',to:'2026-11-02'}),200);
 assert.equal(first.totals[0].salesMinor,'150000');assert.equal(second.totals[0].netMinor,'-150000');assert.equal(second.movements[0].kind,'refund');
}));
test('snapshots preserve microseconds across pagination and exports, and exports are audited without PII',()=>fixture(async(f,s)=>{
 await paid(f,s,s.tid);const first=ok(await report(f.admin,s.base),200);await paid(f,s,s.tid,['2']);
 const frozen=ok(await report(f.admin,s.base,{asOf:first.asOf}),200),fresh=ok(await report(f.admin,s.base),200);assert.equal(frozen.movementCount,1);assert.equal(frozen.asOf,first.asOf);assert.equal(fresh.movementCount,2);
 const exported=ok(await f.admin.request(s.base+'/finance/export','POST',{...range(),asOf:first.asOf}));assert.equal(exported.count,1);assert.ok(exported.csv.includes('RCP-'));assert.equal(exported.csv.includes('Fictional Traveler'),false);
 assert.ok((await f.migration.query("SELECT count(*)::integer n FROM safeer.company_audit WHERE action='finance.exported'")).rows[0].n>0);
 assert.equal((await report(f.admin,s.base,{from:'2026-10-01',to:'2026-11-03'})).status,400);assert.equal((await report(f.admin,s.base,{from:'0000-01-01'})).status,400);assert.equal((await report(f.admin,s.base,{asOf:'2999-01-01T00:00:00Z'})).status,409);
 assert.equal((await report(f.admin,s.base,{companyId:s.cid})).status,400);assert.equal((await report(f.admin,s.base,{page:'-1'})).status,400);
}));

test('large historical ledgers paginate without duplication and refuse oversized exports instead of truncating',()=>fixture(async(f,s)=>{
 await financeVolume(f,s);
 const a=ok(await report(f.admin,s.base),200),b=ok(await report(f.admin,s.base,{page:1,asOf:a.asOf}),200);
 assert.equal(a.movementCount,20002);assert.equal(a.movements.length,75);assert.equal(b.movements.length,75);
 const ids=new Set(a.movements.map(x=>x.id+':'+x.kind));assert.ok(b.movements.every(x=>!ids.has(x.id+':'+x.kind)));
 assert.equal(a.totals[0].netMinor,'0');assert.equal(a.totals[0].ticketsSold,10001);assert.equal(a.sessions[0].expectedMinor,'100000');
 const out=await f.admin.request(s.base+'/finance/export','POST',{...range(),asOf:a.asOf});assert.equal(out.status,409,out.raw);assert.equal(out.error.code,'EXPORT_LIMIT');assert.equal(out.data,undefined);
}));
