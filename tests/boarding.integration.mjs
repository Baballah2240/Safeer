import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import jsQR from 'jsqr';
import {identityFixture} from './support/identity-db.mjs';
import {ok,setup,paid,staff,boardingSetup} from './support/boarding-fixture.mjs';


const fixture=fn=>identityFixture(async f=>fn(f,await boardingSetup(f)));
const decode=qr=>{const scale=5,side=(qr.size+8)*scale,pixels=new Uint8ClampedArray(side*side*4).fill(255);for(const [,x,y] of qr.path.matchAll(/M(\d+) (\d+)h1v1h-1z/g))for(let a=0;a<scale;a++)for(let b=0;b<scale;b++){const at=(((Number(y)+4)*scale+a)*side+(Number(x)+4)*scale+b)*4;pixels[at]=pixels[at+1]=pixels[at+2]=0;}return jsQR(pixels,side,side)?.data;};

test('reassignment, role revocation and narrow grants cannot leak driver manifests',()=>fixture(async(f,s)=>{
 const assignment=(await f.migration.query('SELECT bus_id FROM safeer.trip_assignments WHERE trip_id=$1 AND replaced_at IS NULL',[s.id])).rows[0];
 const replacement=ok(await f.admin.request(s.companyBase+'/drivers','POST',{employeeCode:'D2',nameEn:'Replacement driver',nameAr:'سائق بديل',active:true,currentPassword:f.password}));
 const version=(await f.migration.query('SELECT version FROM safeer.trips WHERE id=$1',[s.id])).rows[0].version;
 ok(await f.admin.request(`${s.path}/${s.id}/assignment`,'POST',{busId:assignment.bus_id,driverId:replacement.id,version,reason:'Fictional reassignment',currentPassword:f.password}));
 assert.deepEqual(ok(await s.driver.c.request('driver/trips'),200).items,[]);assert.equal((await s.driver.c.request(s.base)).status,403);
 const supervisor=await staff(f,{...s,base:s.companyBase},['company.journeys.manage']);assert.equal(ok(await supervisor.c.request(s.base),200).tripId,s.id);
 const narrow=await staff(f,{...s,base:s.companyBase},['company.journeys.manage'],{branchId:s.branch},'branch');assert.equal((await narrow.c.request(s.base)).status,403);
 await f.migration.query("DELETE FROM safeer.company_role_permissions WHERE company_id=$1 AND role_id IN (SELECT r.role_id FROM safeer.company_user_roles r JOIN safeer.company_users u ON u.id=r.member_id WHERE u.user_id=(SELECT id FROM safeer.users WHERE normalized_login=$2))",[s.cid,ok(await supervisor.c.request('auth/me'),200).login]);
 assert.equal((await supervisor.c.request(s.base)).status,403);
}));

test('ticket QR is opaque, independently readable and identical on copy prints',()=>fixture(async(f,s)=>{
 assert.equal(decode(s.code.qr),s.code.token);assert.match(s.code.token,/^TQ[0-9a-f]{64}$/);
 const second=ok(await f.admin.request(`${s.base.replace('driver/','').split('/trips/')[0]}/bookings/${s.p.bid}/print`,'POST',{document:'tickets'}));
 assert.equal(second.copy,true);assert.equal(second.codes[0].token,s.code.token);
 assert.equal((await s.driver.c.request(`companies/${s.cid}/bookings/${s.p.bid}/print`,'POST',{document:'tickets'})).status,404);
 await assert.rejects(f.api.db.pool.query('SELECT * FROM safeer.ticket_credentials'),{code:'42501'});
}));
test('drivers see only current assigned trips and a minimal manifest; revocations take effect immediately',()=>fixture(async(f,s)=>{
 assert.equal(ok(await s.driver.c.request('driver/trips'),200).items.length,1);
 const unrelated=await staff(f,{...s,base:s.companyBase},['company.driver.operate']);assert.deepEqual(ok(await unrelated.c.request('driver/trips'),200).items,[]);
 assert.equal((await unrelated.c.request(s.base)).status,403);
 const m=ok(await s.driver.c.request(s.base),200);assert.equal(m.passengers[0].name,'Fictional Traveler 1');
 assert.equal(JSON.stringify(m).includes('0912345678'),false);assert.equal(m.passengers[0].mobile,undefined);
 const other=await setup(f,'boarding-other');assert.equal((await s.driver.c.request(`driver/companies/${other.cid}/trips/${s.id}`)).status,403);
 await f.migration.query('UPDATE safeer.company_users SET active=false WHERE id=$1',[s.member]);
 assert.deepEqual(ok(await s.driver.c.request('driver/trips'),200).items,[]);assert.equal((await s.driver.c.request(s.base)).status,403);
 await f.migration.query('UPDATE safeer.company_users SET active=true WHERE id=$1',[s.member]);
 await assert.rejects(f.migration.query('UPDATE safeer.drivers SET active=false WHERE company_id=$1',[s.cid]),{message:'TRIP_RESOURCE_IN_USE'});
 // Simulate a disabled resource independently of scheduling's earlier deactivation guard.
 await f.migration.query('SET session_replication_role=replica');await f.migration.query('UPDATE safeer.drivers SET active=false WHERE company_id=$1',[s.cid]);await f.migration.query('SET session_replication_role=DEFAULT');
 assert.equal((await s.driver.c.request(s.base)).status,403);
}));
test('checking is not boarding; concurrent boarding is idempotent and invalid QRs do not authorize it',()=>fixture(async(f,s)=>{
 assert.equal((await s.driver.c.request(s.base+'/verify','POST',{token:s.code.token})).error.code,'BOARDING_CLOSED');
 await s.time();const input={token:s.code.token};assert.equal(ok(await s.driver.c.request(s.base+'/verify','POST',input)).boardedAt,null);
 assert.equal((await f.migration.query('SELECT count(*)::int n FROM safeer.boarding_records')).rows[0].n,0);
 const all=await Promise.all(Array.from({length:4},()=>s.driver.c.request(s.base+'/board','POST',input)));all.forEach(r=>ok(r));
 assert.equal(new Set(all.map(r=>r.data.boardedAt)).size,1);assert.equal((await f.migration.query('SELECT count(*)::int n FROM safeer.boarding_records')).rows[0].n,1);
 for(const token of ['LQ'+ 'A'.repeat(24),'TQ'+'0'.repeat(64),'TKT-00000001'])assert.equal((await s.driver.c.request(s.base+'/verify','POST',{token})).error.code,'TICKET_INVALID');
 assert.equal((await s.driver.c.request(s.base+'/board','POST',{...input,companyId:s.cid})).status,400);
 await assert.rejects(f.api.db.pool.query('DELETE FROM safeer.boarding_records'),{code:'42501'});
}));
test('refund and cancellation invalidate previously checked or boarded tickets without changing refund policy',()=>fixture(async(f,s)=>{
 await s.time();ok(await s.driver.c.request(s.base+'/board','POST',{token:s.code.token}));
 ok(await f.admin.request(`${s.path.split('/trips')[0]}/bookings/${s.p.bid}/refund`,'POST',{reason:'Fictional refund',key:randomUUID(),currentPassword:f.password}));
 assert.equal((await s.driver.c.request(s.base+'/board','POST',{token:s.code.token})).error.code,'TICKET_INVALID');assert.equal(ok(await s.driver.c.request(s.base),200).passengers[0].valid,false);
 const p2=await paid(f,{...s,base:s.companyBase},s.id,['2']);const c2=ok(await f.admin.request(`${s.path.split('/trips')[0]}/bookings/${p2.bid}/print`,'POST',{document:'tickets'})).codes[0];
 const trip=(await f.migration.query('SELECT version FROM safeer.trips WHERE id=$1',[s.id])).rows[0];
 ok(await f.admin.request(`${s.path}/${s.id}/cancel`,'POST',{version:trip.version,reason:'Fictional canceled',currentPassword:f.password}));
 assert.equal((await s.driver.c.request(s.base+'/verify','POST',{token:c2.token})).error.code,'TICKET_INVALID');
}));
test('journey events are ordered and idempotent, close boarding and protect completed trips',()=>fixture(async(f,s)=>{
 await s.time();assert.equal((await s.driver.c.request(s.base+'/events','POST',{event:'departed'})).error.code,'JOURNEY_STATE');
 await s.time('-1 minute');assert.equal((await s.driver.c.request(s.base+'/events','POST',{event:'arrived'})).error.code,'JOURNEY_STATE');
 const first=ok(await s.driver.c.request(s.base+'/events','POST',{event:'departed'}));assert.deepEqual(ok(await s.driver.c.request(s.base+'/events','POST',{event:'departed'})),first);
 assert.equal((await s.driver.c.request(s.base+'/board','POST',{token:s.code.token})).error.code,'BOARDING_CLOSED');
 ok(await s.driver.c.request(s.base+'/events','POST',{event:'arrived'}));
 await assert.rejects(f.migration.query("UPDATE safeer.trips SET status='canceled',cancel_reason='Fictional',canceled_at=clock_timestamp() WHERE id=$1",[s.id]),{message:'JOURNEY_STATE'});
 await assert.rejects(f.migration.query("UPDATE safeer.trip_assignments SET replaced_at=clock_timestamp(),replaced_reason='Fictional' WHERE trip_id=$1",[s.id]),{message:'JOURNEY_STATE'});
}));
test('incidents retry safely, reject mismatched keys and erase notes under the existing retention policy',()=>fixture(async(f,s)=>{
 const input={kind:'delay',note:'Fictional road delay',key:randomUUID()},a=ok(await s.driver.c.request(s.base+'/incidents','POST',input));
 assert.deepEqual(ok(await s.driver.c.request(s.base+'/incidents','POST',input)),a);assert.equal((await s.driver.c.request(s.base+'/incidents','POST',{...input,note:'Changed'})).error.code,'IDEMPOTENCY_CONFLICT');
 assert.equal((await s.driver.c.request(s.base+'/incidents','POST',{...input,key:randomUUID(),note:'x'.repeat(501)})).status,400);
 await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.trips SET departure_at=clock_timestamp()-interval '93 days',arrival_at=clock_timestamp()-interval '92 days' WHERE id=$1",[s.id]);await f.migration.query('SET session_replication_role=DEFAULT');
 await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.booking_contacts SET erase_at=clock_timestamp()-interval '1 day' WHERE booking_id=$1",[s.p.bid]);await f.migration.query('SET session_replication_role=DEFAULT');
 const before=ok(await s.driver.c.request(s.base),200);assert.equal(before.passengers[0].name,null);assert.equal(before.incidents[0].note,null);
 await f.api.db.pool.query('SELECT safeer.erase_due_passenger_data()');assert.equal((await f.migration.query('SELECT note FROM safeer.journey_incidents WHERE id=$1',[a.id])).rows[0].note,null);
}));
