// Load test (not part of verify:release). Runs the real API against a disposable local PostgreSQL
// (SAFEER_TEST_DATABASE_URL, same as the integration tests) with the production pool limits, and
// simulates N people at the same moment: signing in, searching and opening a trip, racing for the
// same seat, a driver board request burst on one ticket, and all of these mixed together.
//   SAFEER_TEST_DATABASE_URL=... node tests/load-test.mjs [50,100,200]
// Each simulated person sends its own client address (x-safeer-client), like separate phones.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';
import {ok,setup,staff,paid} from './support/boarding-fixture.mjs';

// Like Render's front door, reuse up to 128 connections to the API instead of opening one per request
// (Windows refuses bursts of new connections much sooner than the Linux host does).
let open=0;const line=[];const gate=async()=>{if(open<128){open++;return;}await new Promise(r=>line.push(r));};const leave=()=>{const n=line.shift();if(n)n();else open--;};
const levels=(process.argv[2]||'50,100,200').split(',').map(Number);
const ip=i=>`10.${(i>>16)&255}.${(i>>8)&255}.${i&255}`;
const pct=(list,p)=>{const s=[...list].sort((a,b)=>a-b);return s.length?Math.round(s[Math.min(s.length-1,Math.floor(p/100*s.length))]):0;};

async function timed(fn){const t=performance.now();await gate();try{const r=await fn();return {ms:performance.now()-t,status:r.status,code:r.error?.code,r};}catch(e){return {ms:performance.now()-t,status:0,code:'NETWORK:'+(e.cause?.code||e.cause?.message||e.message)};}finally{leave();}}
function report(name,results,extra=''){
 const by={};for(const r of results){const k=r.status+(r.code&&(r.status>=400||r.status===0)?' '+r.code:'');by[k]=(by[k]||0)+1;}
 const ms=results.map(r=>r.ms),crashes=results.filter(r=>r.status===0||r.status>=500).length;
 console.log(`  ${name.padEnd(30)} ${String(results.length).padStart(4)} req  median ${String(pct(ms,50)).padStart(5)} ms  p95 ${String(pct(ms,95)).padStart(5)} ms  max ${String(pct(ms,100)).padStart(5)} ms  server errors ${crashes}  ${JSON.stringify(by)}${extra?'  '+extra:''}`);
 return crashes;
}

await identityFixture(async f=>{
 const s=await setup(f,'load-demo'),max=Math.max(...levels);
 let day=10;const newTrip=()=>s.trip([new Date(Date.now()+(day++)*86400000).toISOString().slice(0,10)]);
 // People who sign in: one role, max members (temporary passwords are enough to sign in).
 const role=ok(await f.admin.request(s.base+'/roles','POST',{displayName:'Load role',scope:'company',permissions:['company.driver.operate'],...s.pw}));
 const people=[];for(let i=0;i<max;i++){if(i%100===99)await f.migration.query('DELETE FROM safeer.auth_throttles');const m=ok(await f.admin.request(s.base+'/members','POST',{login:`load${i}@safeer.local`,displayName:'Load '+i,existing:false,assignments:[{roleId:role.id}],...s.pw}));people.push({login:m.user.login,password:m.temporaryPassword});}
 // Driver with a printed ticket on a trip that is boarding now.
 await f.migration.query('DELETE FROM safeer.auth_throttles');const driver=await staff(f,s,['company.driver.operate']);
 const member=(await f.migration.query('SELECT id FROM safeer.company_users WHERE user_id=(SELECT id FROM safeer.users WHERE normalized_login=$1)',[(await driver.c.request('auth/me')).data.login])).rows[0].id;
 await f.migration.query('UPDATE safeer.drivers SET member_id=$1 WHERE company_id=$2',[member,s.cid]);
 const boardTrip=async()=>{const id=await newTrip();const p=await paid(f,s,id);const code=ok(await f.admin.request(`${s.base}/bookings/${p.bid}/print`,'POST',{document:'tickets'})).codes[0];
  await f.migration.query('SET session_replication_role=replica');try{await f.migration.query("UPDATE safeer.trips SET departure_at=now()+interval '1 hour',arrival_at=now()+interval '3 hours' WHERE id=$1",[id]);}finally{await f.migration.query('SET session_replication_role=DEFAULT');}
  return {id,base:`driver/companies/${s.cid}/trips/${id}`,token:code.token};};
 console.log(`Setup done: ${max} accounts, API at ${f.api.origin}, database pool ${f.api.db?.pool?.options?.max??'?'} connections.\n`);

 const login=i=>timed(()=>f.client().request('auth/login','POST',{login:people[i].login,password:people[i].password},{'x-safeer-client':ip(i)}));
 const browse=(i,trip)=>{const c=f.client(),h={'x-safeer-client':ip(10000+i)};return [timed(()=>c.request('public/cities','GET',undefined,h)),timed(()=>c.request('public/trips?','GET',undefined,h)),timed(()=>c.request(`public/trips/${trip}?from=0&to=1`,'GET',undefined,h))];};
 const hold=(i,trip)=>timed(()=>f.client().request('public/holds','POST',{tripId:trip,seats:['1'],key:randomUUID(),mobile:'0912345678',travelers:[{seat:'1',name:'Load Traveler '+i,luggage:null}]},{'x-safeer-client':ip(20000+i)}));
 const board=(b)=>timed(()=>driver.c.request(b.base+'/board','POST',{token:b.token}));

 let crashes=0;const failures=[];
 for(const n of levels){
  console.log(`=== ${n} people at the same moment ===`);
  const race=await newTrip(),b=await boardTrip();
  crashes+=report('sign in',await Promise.all(Array.from({length:n},(_,i)=>login(i))));
  crashes+=report('search + open trip',await Promise.all(Array.from({length:n},(_,i)=>browse(i,race)).flat()));
  const held=await Promise.all(Array.from({length:n},(_,i)=>hold(i,race)));
  const won=held.filter(r=>r.status===201).length,seat1=(await f.migration.query("SELECT count(*)::int n FROM safeer.seat_allocations WHERE trip_id=$1 AND label='1' AND status='held'",[race]).catch(()=>({rows:[{n:'?'}]}))).rows[0].n;
  crashes+=report('book the same seat',held,`winners ${won}, seat 1 rows ${seat1}`);if(won!==1)failures.push(`${n}: ${won} people got seat 1`);
  const scans=await Promise.all(Array.from({length:n},()=>board(b)));
  const boardedAt=new Set(scans.filter(r=>r.status===201).map(r=>r.r.data.boardedAt)),records=(await f.migration.query('SELECT count(*)::int n FROM safeer.boarding_records WHERE trip_id=$1',[b.id]).catch(e=>({rows:[{n:e.message}]}))).rows[0].n;
  crashes+=report('driver boards one ticket',scans,`one boarding time: ${boardedAt.size===1}, boarding records ${records}`);if(boardedAt.size!==1||records!==1)failures.push(`${n}: ticket boarded at ${boardedAt.size} different times`);
  const race2=await newTrip(),b2=await boardTrip(),t=performance.now();
  const mixed=await Promise.all([...Array.from({length:n},(_,i)=>login(i)),...Array.from({length:n},(_,i)=>browse(i,race2)).flat(),...Array.from({length:n},(_,i)=>hold(i,race2)),...Array.from({length:n},()=>board(b2))]);
  crashes+=report('all mixed together',mixed,`${mixed.length} requests in ${Math.round(performance.now()-t)} ms`);
  if(mixed.filter(r=>r.status===201&&r.r?.data?.reference).length>1)failures.push(`${n} mixed: more than one hold won seat 1`);
  const alive=await timed(()=>f.client().request('public/cities'));assert.equal(alive.status,200,'server still answers');console.log(`  server still answering: ${alive.status} in ${Math.round(alive.ms)} ms\n`);
 }
 console.log(`Server errors or dropped connections: ${crashes}. Wrong results: ${failures.length?failures.join('; '):'none'}.`);
 if(crashes||failures.length)process.exitCode=1;
});
