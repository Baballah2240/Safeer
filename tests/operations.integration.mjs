import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identityFixture} from './support/identity-db.mjs';
import {seedOperations} from './support/demo-operations.mjs';
import {staff} from './support/boarding-fixture.mjs';

// D65 operations dashboard data, with fictional records only.
const ok=(r,status=200)=>{assert.equal(r.status,status,r.raw);return r.data;};
export async function linkDriver(f,s){
 const driver=await staff(f,s,['company.driver.operate']);
 const login=(await driver.c.request('auth/me')).data.login;
 const member=(await f.migration.query('SELECT id FROM safeer.company_users WHERE user_id=(SELECT id FROM safeer.users WHERE normalized_login=$1)',[login])).rows[0].id;
 await f.migration.query('UPDATE safeer.drivers SET member_id=$1 WHERE id=$2',[member,s.drivers.d1]);
 return driver;
}

test('today shows departures, booked and boarded counts, and what needs attention',async()=>identityFixture(async f=>{
 const s=await seedOperations(f),view=ok(await f.admin.request(s.base+'/operations'));
 assert.deepEqual(view.summary,{departures:3,booked:6,boarded:0,attention:1});
 assert.deepEqual(view.departures.map(d=>[d.id,d.status,d.booked,d.boarded,d.seatCount]),[[s.trips.soon,'scheduled',4,0,12],[s.trips.later,'scheduled',2,0,12],[s.trips.unassigned,'unassigned',0,0,null]]);
 assert.equal(view.departures[0].driverEn,'Omar Ali');assert.equal(view.departures[0].busRegistration,'REG B12');
 assert.deepEqual(view.attention.map(a=>[a.id,a.kind]),[[s.trips.unassigned,'unassigned']]);
 assert.equal((await f.admin.request(s.base+'/operations?day=2026-13-40')).status,400);
 assert.equal(ok(await f.admin.request(s.base+'/operations?day=2020-01-01')).departures.length,0,'Another day has its own list.');
 // A late departure without a departed event is delayed.
 await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.trips SET departure_at=clock_timestamp()-interval '25 minutes',arrival_at=clock_timestamp()+interval '200 minutes' WHERE id=$1",[s.trips.later]);await f.migration.query('SET session_replication_role=DEFAULT');
 const late=ok(await f.admin.request(s.base+'/operations'));
 const delayed=late.attention.find(a=>a.kind==='delayed');assert.equal(delayed.id,s.trips.later);assert.ok(delayed.minutesLate>=24);assert.equal(late.summary.attention,2);
}));

test('a validated driver scan counts once; repeated scans and retries never raise the count',async()=>identityFixture(async f=>{
 const s=await seedOperations(f),driver=await linkDriver(f,s),path=`driver/companies/${s.cid}/trips/${s.trips.soon}`;
 const token=s.bookings[0].codes[0].token,trip=async()=>ok(await f.admin.request(`${s.base}/operations/trips/${s.trips.soon}`));
 const before=await trip();assert.equal(before.boarded,0);assert.equal(before.passengers.length,4);
 const first=await driver.c.request(path+'/board','POST',{token});assert.equal(first.status,201,first.raw);
 const retries=await Promise.all([1,2,3].map(()=>driver.c.request(path+'/board','POST',{token})));
 retries.forEach(r=>assert.equal(r.data.boardedAt,first.data.boardedAt,'A retry returns the original boarding.'));
 const after=await trip();assert.equal(after.boarded,1,'Exactly one boarding is recorded.');
 assert.equal(after.recentScans.length,1);assert.equal(after.recentScans[0].seat,first.data.seat);
 assert.equal(after.passengers.filter(p=>p.boardedAt).length,1);
 assert.equal(ok(await f.admin.request(s.base+'/operations')).summary.boarded,1);
 const wrong=await driver.c.request(`driver/companies/${s.cid}/trips/${s.trips.soon}/board`,'POST',{token:s.bookings[2].codes[0].token});
 assert.equal(wrong.error.code,'TICKET_WRONG_TRIP','A ticket for another trip is refused.');
 assert.equal((await trip()).boarded,1);
}));

test('trip readers without booking access see counts but not passengers',async()=>identityFixture(async f=>{
 const s=await seedOperations(f);
 const reader=await staff(f,s,['company.profile.read','company.trips.read']);
 const view=ok(await reader.c.request(`${s.base}/operations/trips/${s.trips.soon}`));
 assert.equal(view.canSeePassengers,false);assert.equal(view.passengers,null);assert.equal(view.recentScans,null);assert.equal(view.booked,4);
 assert.equal(JSON.stringify(view).includes('Fictional Traveler'),false);
 const none=await staff(f,s,['company.profile.read']);
 assert.equal((await none.c.request(s.base+'/operations')).status,403);
 const other=await seedOperations(f,'fictional-other-ops');
 assert.equal((await f.admin.request(`${other.base}/operations/trips/${s.trips.soon}`)).status,404,'Trips never cross companies.');
}));
