import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identityFixture} from './support/identity-db.mjs';
import {ok,staff,boardingSetup} from './support/boarding-fixture.mjs';

// D122: start (with passengers missing), each stop reached, destination, close; passengers follow it by booking reference.
test('journey steps run in order and passengers can follow the trip',()=>identityFixture(async(f)=>{
 const s=await boardingSetup(f),code=e=>e.error?.code;
 // Make the route three stops long: the setup's destination becomes an intermediate stop.
 await f.migration.query('SET session_replication_role=replica');
 try{await f.migration.query("INSERT INTO safeer.trip_stops(company_id,trip_id,stop_index,offset_minutes,city_id,city_name_en,city_name_ar) SELECT company_id,trip_id,2,180,city_id,'Fictional End','نهاية' FROM safeer.trip_stops WHERE trip_id=$1 AND stop_index=1",[s.id]);}
 finally{await f.migration.query('SET session_replication_role=DEFAULT');}
 const track=ref=>fetch(`${f.api.origin}/api/v1/public/track/trips/${ref}`).then(async r=>({status:r.status,data:r.status===200?(await r.json()).data:null}));
 let pub=await track(s.p.reference);assert.equal(pub.status,200);
 assert.equal(pub.data.departedAt,null);assert.equal(pub.data.stops.length,3);assert.ok(!JSON.stringify(pub.data).includes('Fictional Traveler'),'no passenger names');
 assert.ok(!('passengers' in pub.data));

 // Before departure time nothing can be recorded; a stop cannot be marked before the start.
 await s.time();
 assert.equal(code(await s.driver.c.request(s.base+'/events','POST',{event:'departed'})),'JOURNEY_STATE');
 await s.time('-1 minute');
 assert.equal(code(await s.driver.c.request(s.base+'/stops','POST',{stopIndex:1})),'JOURNEY_STATE');
 assert.equal(code(await s.driver.c.request(s.base+'/events','POST',{event:'closed'})),'JOURNEY_STATE');
 // Start with a passenger not boarded.
 const m=ok(await s.driver.c.request(s.base),200);assert.ok(m.passengers.some(x=>x.valid&&!x.boardedAt));assert.equal(m.progress.departedAt,null);
 ok(await s.driver.c.request(s.base+'/events','POST',{event:'departed'}));
 // Invalid stop indexes: the origin, the destination, out of range, wrong types.
 for(const stopIndex of [0,2,3,29,-1,1.5,'1',null])assert.ok((await s.driver.c.request(s.base+'/stops','POST',{stopIndex})).status>=400,String(stopIndex));
 const first=ok(await s.driver.c.request(s.base+'/stops','POST',{stopIndex:1}));assert.deepEqual(ok(await s.driver.c.request(s.base+'/stops','POST',{stopIndex:1})),first,'repeat returns the first time');
 pub=await track(s.p.reference);assert.ok(pub.data.departedAt);assert.ok(pub.data.stops[1].reachedAt);assert.equal(pub.data.stops[2].reachedAt,null);
 // Other staff: a luggage handler cannot record steps; the company's trip readers can see progress.
 const {c:other}=await staff(f,{...s,base:s.companyBase},['company.luggage.operate']);
 assert.ok([403,404].includes((await other.request(s.base+'/stops','POST',{stopIndex:1})).status));
 ok(await s.driver.c.request(s.base+'/events','POST',{event:'arrived'}));
 assert.equal(code(await s.driver.c.request(s.base+'/stops','POST',{stopIndex:1})),'JOURNEY_STATE','no stops after the destination');
 ok(await s.driver.c.request(s.base+'/events','POST',{event:'closed'}));
 const done=ok(await s.driver.c.request(s.base),200).progress;assert.ok(done.arrivedAt&&done.closedAt);assert.ok(done.stops[2].reachedAt);
 pub=await track(s.p.reference);assert.ok(pub.data.closedAt);
 // Unknown, malformed and hostile references look the same.
 for(const ref of ['SF-22222222','sf-xxxxxxxx','SF-1','..%2f',"SF-' OR 1=1"])assert.equal((await track(ref)).status,404,ref);
 const audit=(await f.migration.query("SELECT action FROM safeer.company_audit WHERE target_id=$1 AND action LIKE 'journey.%' AND action<>'journey.manifest' ORDER BY occurred_at",[s.id])).rows.map(x=>x.action);
 assert.deepEqual(audit,['journey.departed','journey.stop','journey.arrived','journey.closed']);
}));
