import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';
import {ok,setup,paid,staff,boardingSetup} from './support/boarding-fixture.mjs';
const fixture=fn=>identityFixture(async f=>fn(f,await boardingSetup(f)));

test('manual ticket checking shares QR validity and boarding is explicit and idempotent',()=>fixture(async(f,s)=>{
 const input={ticketNumber:s.p.ticket.toLowerCase()};
 assert.equal((await s.driver.c.request(s.base+'/verify','POST',input)).error.code,'BOARDING_CLOSED');
 await s.time();const result=ok(await s.driver.c.request(s.base+'/verify','POST',input));
 assert.equal(result.ticket,s.p.ticket);assert.equal(result.boardedAt,null);assert.equal(result.name,'Fictional Traveler 1');assert.equal(result.seat,'1');
 assert.equal((await f.migration.query('SELECT count(*)::int n FROM safeer.boarding_records')).rows[0].n,0);
 const responses=await Promise.all([input,input,{token:s.code.token},input].map(body=>s.driver.c.request(s.base+'/board','POST',body)));
 assert.equal(new Set(responses.map(r=>ok(r).boardedAt)).size,1);
 assert.equal((await f.migration.query('SELECT count(*)::int n FROM safeer.boarding_records')).rows[0].n,1);
 assert.ok(ok(await s.driver.c.request(s.base+'/verify','POST',input)).boardedAt);
 const rows=(await f.migration.query("SELECT action FROM safeer.company_audit WHERE company_id=$1 AND action='journey.boarded'",[s.cid])).rows;assert.equal(rows.length,1);
}));

test('fallback validates exactly one credential without weakening QR validation',()=>fixture(async(f,s)=>{
 await s.time();
 for(const body of [{},{token:s.code.token,ticketNumber:s.p.ticket},{ticketNumber:null},{ticketNumber:'x'},{ticketNumber:'TKT-1234567'},{ticketNumber:'TKT-1234567890123'},{ticketNumber:s.p.ticket,companyId:s.cid}])assert.equal((await s.driver.c.request(s.base+'/verify','POST',body)).status,400);
 assert.equal((await s.driver.c.request(s.base+'/verify','POST',{token:s.p.ticket})).error.code,'TICKET_INVALID');
 assert.equal((await s.driver.c.request(s.base+'/verify','POST',{ticketNumber:'TKT-99999999'})).error.code,'TICKET_INVALID');
}));

test('manual tickets cannot cross trips/companies and do not disclose other passenger data',()=>fixture(async(f,s)=>{
 await s.time();const tid=await s.trip([new Date(Date.now()+11*86400000).toISOString().slice(0,10)]),other=await paid(f,{...s,base:s.companyBase},tid,['1']);
 const wrong=await s.driver.c.request(s.base+'/verify','POST',{ticketNumber:other.ticket});assert.equal(wrong.error.code,'TICKET_INVALID');assert.equal(wrong.data,undefined);
 const company=await setup(f,'manual-other');const theirTrip=await company.trip(),their=await paid(f,company,theirTrip,['1']);
 assert.equal((await s.driver.c.request(`driver/companies/${company.cid}/trips/${theirTrip}/verify`,'POST',{ticketNumber:their.ticket})).status,403);
 // Independent companies may use the same printed number. Resolve only the authorized trip.
 assert.equal(their.ticket,s.p.ticket);assert.equal(ok(await s.driver.c.request(s.base+'/verify','POST',{ticketNumber:their.ticket})).ticket,s.p.ticket);
}));

test('unassigned and revoked drivers cannot use manual verification or boarding',()=>fixture(async(f,s)=>{
 await s.time();const stranger=await staff(f,{...s,base:s.companyBase},['company.driver.operate']);
 for(const operation of ['verify','board'])assert.equal((await stranger.c.request(s.base+'/'+operation,'POST',{ticketNumber:s.p.ticket})).status,403);
 await f.migration.query('UPDATE safeer.company_users SET active=false WHERE id=$1',[s.member]);
 for(const operation of ['verify','board'])assert.equal((await s.driver.c.request(s.base+'/'+operation,'POST',{ticketNumber:s.p.ticket})).status,403);
}));

test('refund/cancel and departure revalidate manual boarding after a successful check',()=>fixture(async(f,s)=>{
 await s.time();ok(await s.driver.c.request(s.base+'/verify','POST',{ticketNumber:s.p.ticket}));
 ok(await f.admin.request(`${s.companyBase}/bookings/${s.p.bid}/refund`,'POST',{reason:'Fictional refund',key:randomUUID(),currentPassword:f.password}));
 assert.equal((await s.driver.c.request(s.base+'/board','POST',{ticketNumber:s.p.ticket})).error.code,'TICKET_INVALID');
 const p2=await paid(f,{...s,base:s.companyBase},s.id,['2']);await s.time('-1 minute');
 ok(await s.driver.c.request(s.base+'/verify','POST',{ticketNumber:p2.ticket}));ok(await s.driver.c.request(s.base+'/events','POST',{event:'departed'}));
 assert.equal((await s.driver.c.request(s.base+'/board','POST',{ticketNumber:p2.ticket})).error.code,'BOARDING_CLOSED');
 const version=(await f.migration.query('SELECT version FROM safeer.trips WHERE id=$1',[s.id])).rows[0].version;
 ok(await f.admin.request(`${s.path}/${s.id}/cancel`,'POST',{version,reason:'Fictional cancellation',currentPassword:f.password}));
 assert.equal((await s.driver.c.request(s.base+'/verify','POST',{ticketNumber:p2.ticket})).error.code,'TICKET_INVALID');
}));
