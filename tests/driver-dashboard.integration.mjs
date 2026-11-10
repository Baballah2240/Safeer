import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identityFixture} from './support/identity-db.mjs';
import {boardingSetup,paid,ok} from './support/boarding-fixture.mjs';
test('dashboard manifest is assigned-only and duplicate outcomes are atomic',()=>identityFixture(async f=>{
 const s=await boardingSetup(f);await s.time();const m=ok(await s.driver.c.request(s.base),200);
 assert.equal(m.timezone,'Africa/Khartoum');assert.equal(m.stops.length,2);assert.equal(m.estimatedArrivalAt,null);assert.equal(m.boardingOpen,true);assert.equal(m.passengers[0].bookingReference,s.p.reference);assert.equal(JSON.stringify(m).includes(s.code.token),false);
 const results=await Promise.all(Array.from({length:5},()=>s.driver.c.request(s.base+'/board','POST',{token:s.code.token})));const data=results.map(r=>ok(r));assert.equal(data.filter(r=>!r.alreadyBoarded).length,1);assert.equal(data.filter(r=>r.alreadyBoarded).length,4);
 assert.equal((await f.migration.query("SELECT count(*)::int n FROM safeer.company_audit WHERE action='journey.boarded'")).rows[0].n,1);
 const other=await s.trip([new Date(Date.now()+32*86400000).toISOString().slice(0,10)]);const p=await paid(f,{...s,base:s.companyBase},other);const printed=ok(await f.admin.request(s.companyBase+'/bookings/'+p.bid+'/print','POST',{document:'tickets'}));
 const wrong=await s.driver.c.request(s.base+'/board','POST',{token:printed.codes[0].token});assert.equal(wrong.error.code,'TICKET_WRONG_TRIP');assert.equal(wrong.data,undefined);assert.equal(JSON.stringify(wrong.error).includes(p.reference),false);
 assert.equal((await s.driver.c.request(s.base+'/board','POST',{ticketNumber:p.ticket})).error.code,'TICKET_INVALID');assert.equal((await f.migration.query('SELECT count(*)::int n FROM safeer.boarding_records')).rows[0].n,1);
 await assert.rejects(f.api.db.pool.query('SELECT safeer.driver_manifest_before_shipments($1,$2)',[s.cid,s.id]),{code:'42501'});
}));
