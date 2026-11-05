import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import {identityFixture} from './support/identity-db.mjs';
import {ok,setup,paid,boardingSetup,book} from './support/boarding-fixture.mjs';
import {createIdentityApi} from '../dist/api/app.js';
import {readMigrations,migrationStatus} from '../database/migrate.mjs';
import {grantIdentityRuntime} from '../database/runtime-grants.mjs';
const localRange=()=>{const d=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Khartoum'}).format(new Date());return {from:d,to:d};};
const globalRange=()=>{const d=new Date().toISOString().slice(0,10);return {from:d,to:d};};
const getReport=(f,base)=>f.admin.request(base+'/finance?'+new URLSearchParams(localRange()));
const cancel=async(f,s)=>{const version=(await f.migration.query('SELECT version FROM safeer.trips WHERE id=$1',[s.tid])).rows[0].version;return f.admin.request(`${s.path}/${s.tid}/cancel`,'POST',{version,reason:'Fictional race cancellation',currentPassword:f.password});};

test('a paid passenger and bag travel through boarding, journey, collection, counter close, company/global reports and alerts',()=>identityFixture(async f=>{
 const s=await boardingSetup(f),base=s.companyBase;
 let bag=ok(await f.admin.request(s.bags,'POST',{ticketNumber:s.p.ticket,category:'suitcase',quantity:1,weightGrams:12000,description:'Fictional travel bag',key:randomUUID()}));
 bag=ok(await f.admin.request(`${s.bags}/${bag.id}/tag`,'POST',{}));
 const move=async to=>{bag=ok(await f.admin.request(`${s.bags}/${bag.id}/move`,'POST',{to,version:bag.version}));};
 await move('loaded');await s.time();ok(await s.driver.c.request(s.base+'/board','POST',{token:s.code.token}));
 ok(await s.driver.c.request(s.base+'/incidents','POST',{kind:'delay',note:'Fictional private operational note',key:randomUUID()}));
 await s.time('-1 minute');ok(await s.driver.c.request(s.base+'/events','POST',{event:'departed'}));await move('in_transit');ok(await s.driver.c.request(s.base+'/events','POST',{event:'arrived'}));await move('unloaded');
 bag=ok(await f.admin.request(`${s.bags}/${bag.id}/collect`,'POST',{proof:s.p.ticket,version:bag.version}));assert.equal(bag.lifecycle,'collected');
 const passenger=ok(await f.client().request('public/holds/lookup','POST',{reference:s.p.reference,mobile:'0912345678'}));assert.equal(passenger.status,'confirmed');assert.equal(passenger.luggage[0].status,'collected');
 const session=(await f.migration.query('SELECT id FROM safeer.cash_sessions WHERE company_id=$1',[s.cid])).rows[0].id;
 ok(await f.admin.request(`${base}/counter/sessions/${session}/close`,'POST',{countedMinor:249900,note:'Fictional count difference',currentPassword:f.password}));
 const report=ok(await getReport(f,base),200),global=ok(await f.admin.request('platform/dashboard?'+new URLSearchParams(globalRange())),200);
 assert.equal(report.totals[0].netMinor,'150000');assert.equal(report.totals[0].ticketsSold,1);assert.equal(report.sessions[0].varianceMinor,'-100');assert.equal(global.totals[0].netMinor,'150000');
 const codes=ok(await f.admin.request('notifications'),200).items.map(n=>n.code);assert.ok(codes.includes('journey.incident'));assert.ok(codes.includes('cash.difference'));
 const manifest=ok(await s.driver.c.request(s.base),200);assert.equal(manifest.passengers[0].valid,true);assert.ok(manifest.passengers[0].boardedAt);
 assert.equal((await s.driver.c.request(base+'/finance?'+new URLSearchParams(localRange()))).status,403);assert.equal(JSON.stringify(global).includes('0912345678'),false);
}));

test('payment versus cancellation never leaves a partial sale or active seat on a canceled trip',()=>identityFixture(async f=>{
 const s=await setup(f,'connected-cancel');s.tid=await s.trip();const held=ok(await book(f,s.tid,['1'])),bid=(await f.migration.query('SELECT id FROM safeer.bookings WHERE reference=$1',[held.reference])).rows[0].id;
 const [payment,canceled]=await Promise.all([f.admin.request(`${s.base}/bookings/${bid}/pay`,'POST',{method:'cash',key:randomUUID()}),cancel(f,s)]);ok(canceled);
 const b=ok(await f.admin.request(`${s.base}/bookings/${bid}`),200);
 if(payment.status===201){assert.equal(b.status,'confirmed');assert.equal(b.tickets.length,1);assert.equal((await f.migration.query('SELECT count(*)::integer n FROM safeer.receipts WHERE company_id=$1',[s.cid])).rows[0].n,1);}
 else{assert.ok([409,403].includes(payment.status));assert.equal(b.status,'released');assert.equal((await f.migration.query('SELECT count(*)::integer n FROM safeer.payments WHERE company_id=$1',[s.cid])).rows[0].n,0);}
 assert.equal((await f.migration.query("SELECT count(*)::integer n FROM safeer.seat_allocations WHERE trip_id=$1 AND status='held'",[s.tid])).rows[0].n,0);
 assert.equal(ok(await f.client().request('public/trips'),200).items.some(x=>x.id===s.tid),false);
}));

test('boarding versus refund keeps recorded history but never a valid refunded ticket',()=>identityFixture(async f=>{
 const s=await boardingSetup(f);await s.time();
 const [board,refund]=await Promise.all([s.driver.c.request(s.base+'/board','POST',{token:s.code.token}),f.admin.request(`${s.companyBase}/bookings/${s.p.bid}/refund`,'POST',{reason:'Fictional refund race',key:randomUUID(),currentPassword:f.password})]);ok(refund);assert.ok([201,409].includes(board.status));
 const manifest=ok(await s.driver.c.request(s.base),200);assert.equal(manifest.passengers[0].valid,false);assert.equal((await s.driver.c.request(s.base+'/verify','POST',{token:s.code.token})).error.code,'TICKET_INVALID');
 const totals=ok(await getReport(f,s.companyBase),200).totals[0];assert.deepEqual([totals.salesMinor,totals.refundMinor,totals.netMinor],['150000','150000','0']);
}));

test('a consistent PostgreSQL clone preserves fictional users, money, ticket QR and idempotent payment identity',()=>identityFixture(async f=>{
 const s=await setup(f,'connected-restore'),tid=await s.trip(),key=randomUUID(),held=ok(await book(f,tid,['1'])),bid=(await f.migration.query('SELECT id FROM safeer.bookings WHERE reference=$1',[held.reference])).rows[0].id;
 const payment=ok(await f.admin.request(`${s.base}/bookings/${bid}/pay`,'POST',{method:'cash',key}));
 const originalPrint=ok(await f.admin.request(`${s.base}/bookings/${bid}/print`,'POST',{document:'tickets'}));
 const name='safeer_restore_'+randomUUID().replaceAll('-',''),source=new URL(f.ownerUrl).pathname.slice(1);
 const snapshotRows=async c=>{const result={};for(const {tablename:t} of (await c.query("SELECT tablename FROM pg_tables WHERE schemaname IN ('safeer','safeer_meta') ORDER BY schemaname,tablename")).rows){const schema=t==='schema_migrations'?'safeer_meta':'safeer';result[t]=createHash('sha256').update(JSON.stringify((await c.query(`SELECT to_jsonb(x) AS row FROM ${schema}.${t} x ORDER BY to_jsonb(x)::text`)).rows)).digest('hex');}return result;};
 let restored,api;
 try{
  const before=await snapshotRows(f.migration);await f.disconnectSource();
  // PostgreSQL requires the source database to have no sessions and makes a
  // consistent physical clone with its ACLs. This is not a pg_dump/off-site drill.
  assert.match(source,/^safeer_s02_[0-9a-f]{32}$/);await f.owner.query(`CREATE DATABASE "${name}" WITH TEMPLATE "${source}"`);
  const target=new URL(f.ownerUrl);target.pathname='/'+name;restored=new pg.Client({connectionString:target.href});await restored.connect();assert.deepEqual(await snapshotRows(restored),before);
  assert.ok((await migrationStatus(restored,await readMigrations())).every(m=>m.state==='applied'));await grantIdentityRuntime(restored,new URL(f.runtimeUrl).username);
  const runtime=new URL(f.runtimeUrl);runtime.pathname='/'+name;process.env.SAFEER_AUTH_DATABASE_URL=runtime.href;api=await createIdentityApi({port:0});
  const request=async(path,method='GET',data)=>{const response=await fetch(api.origin+'/api/v1/'+path,{method,headers:{Cookie:f.admin.cookie,Origin:'http://127.0.0.1:4320','Content-Type':'application/json','X-CSRF-Token':f.admin.csrf},...(data?{body:JSON.stringify(data)}:{})});return {status:response.status,...await response.json()};};
  assert.equal((await request('auth/me')).status,200);const retry=await request(`${s.base}/bookings/${bid}/pay`,'POST',{method:'cash',key});assert.equal(retry.status,201);assert.deepEqual(retry.data,payment);
  const copy=await request(`${s.base}/bookings/${bid}/print`,'POST',{document:'tickets'});assert.equal(copy.status,201);assert.equal(copy.data.codes[0].token,originalPrint.codes[0].token);
  const report=await request(s.base+'/finance?'+new URLSearchParams(localRange()));assert.equal(report.data.totals[0].netMinor,'150000');
 }finally{process.env.SAFEER_AUTH_DATABASE_URL=f.runtimeUrl;await api?.close();await restored?.end();await f.owner.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);}
}));
