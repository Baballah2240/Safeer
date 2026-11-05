import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {identityFixture} from './support/identity-db.mjs';
import {ok,setup,staff} from './support/boarding-fixture.mjs';
import {ReservationService} from '../dist/api/reservation.service.js';
import {request as httpRequest} from 'node:http';
import {gzipSync} from 'node:zlib';
import {startServer} from '../server.mjs';

test('audit fixed database functions, public access and bounded operational inbox at representative volume',()=>identityFixture(async f=>{
 const exposed=(await f.migration.query("SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE n.nspname='safeer' AND a.grantee=0 AND a.privilege_type='EXECUTE'")).rows;
 assert.deepEqual(exposed,[],'Application helpers must not have PUBLIC execute.');
 const unsafe=(await f.migration.query("SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='safeer' AND p.prosecdef AND NOT coalesce(p.proconfig @> ARRAY['search_path=pg_catalog'],false)")).rows;assert.deepEqual(unsafe,[]);
 const s=await setup(f,'security-volume'),reader=await staff(f,s,['company.profile.read']);
 await f.migration.query("INSERT INTO safeer.notification_events(company_id,code,source_id,revision) SELECT $1,'company.status',$1,n FROM generate_series(100,5099) n",[s.cid]);
 await f.migration.query('ANALYZE safeer.notification_events');
 const measurements={};for(const [label,c] of [['super',f.admin],['restricted',reader.c]]){const at=performance.now(),r=ok(await c.request('notifications'),200);measurements[label]={milliseconds:Math.round(performance.now()-at),unread:r.unreadCount,items:r.items.length};}
 assert.equal(measurements.super.unread,5003);assert.equal(measurements.super.items,50);assert.equal(measurements.restricted.unread,0);
 mkdirSync('.qa',{recursive:true});writeFileSync('.qa/section-15-security-volume.json',JSON.stringify({passed:true,events:5003,measurements},null,2)+'\n');
}));

test('startup rejects removed RLS, raw/column grants, missing projections and unsafe/public function privileges',()=>identityFixture(async f=>{
 const role=new URL(f.runtimeUrl).username;
 const cases=[
  ['ALTER TABLE safeer.bookings DISABLE ROW LEVEL SECURITY','ALTER TABLE safeer.bookings ENABLE ROW LEVEL SECURITY'],
  [`GRANT SELECT ON safeer.payments TO "${role}"`,`REVOKE SELECT ON safeer.payments FROM "${role}"`],
  [`GRANT SELECT(amount_minor) ON safeer.payments TO "${role}"`,`REVOKE SELECT(amount_minor) ON safeer.payments FROM "${role}"`],
  ['ALTER FUNCTION safeer.platform_notice() RENAME TO platform_notice_missing','ALTER FUNCTION safeer.platform_notice_missing() RENAME TO platform_notice'],
  [`REVOKE EXECUTE ON FUNCTION safeer.notifications_list(bigint) FROM "${role}"`,`GRANT EXECUTE ON FUNCTION safeer.notifications_list(bigint) TO "${role}"`],
  [`GRANT EXECUTE ON FUNCTION safeer.notification_capture() TO "${role}"`,`REVOKE EXECUTE ON FUNCTION safeer.notification_capture() FROM "${role}"`],
  ['GRANT EXECUTE ON FUNCTION safeer.notification_capture() TO PUBLIC','REVOKE EXECUTE ON FUNCTION safeer.notification_capture() FROM PUBLIC'],
  ['ALTER FUNCTION safeer.company_super() SET search_path=public','ALTER FUNCTION safeer.company_super() SET search_path=pg_catalog']
 ];
 for(const [change,restore] of cases){await f.migration.query(change);try{await assert.rejects(f.api.db.ready(),/Database|database|required/);}finally{await f.migration.query(restore);}await f.api.db.ready();}
}));

test('maintenance failures are observable without SQL details, recover after retry and share concurrent work',()=>identityFixture(async f=>{
 const jobs=f.api.app.get(ReservationService);await jobs.erase();await jobs.sweep();
 const healthy=ok(await f.client().request('health'),200);assert.equal(healthy.maintenance.retention.state,'ok');assert.ok(healthy.maintenance.retention.lastSuccessAt);
 const role=new URL(f.runtimeUrl).username;
 await f.migration.query(`REVOKE EXECUTE ON FUNCTION safeer.erase_due_passenger_data() FROM "${role}"`);
 try{await jobs.erase();const h=ok(await f.client().request('health'),200);assert.equal(h.database,'connected');assert.equal(h.maintenance.retention.state,'failed');assert.equal(h.maintenance.retention.lastSuccessAt,healthy.maintenance.retention.lastSuccessAt);assert.equal(JSON.stringify(h).includes(role),false);assert.equal(JSON.stringify(h).includes('permission denied'),false);}finally{await f.migration.query(`GRANT EXECUTE ON FUNCTION safeer.erase_due_passenger_data() TO "${role}"`);}
 const a=jobs.erase(),b=jobs.erase();assert.equal(a,b,'Concurrent triggers share the same bounded worker.');await a;assert.equal(ok(await f.client().request('health'),200).maintenance.retention.state,'ok');
}));

test('HTTP proxy enforces body limits for chunked/compressed requests and preserves Origin, CSRF and safe headers',()=>identityFixture(async f=>{
 const web=await startServer({port:0,identityApiUrl:f.api.origin});
 const raw=(data,headers={})=>new Promise((resolve,reject)=>{const r=httpRequest(web.origin+'/api/v1/auth/login',{method:'POST',headers:{Origin:'http://127.0.0.1:4320','Content-Type':'application/json',...headers}},s=>{let body='';s.on('data',x=>body+=x);s.on('end',()=>resolve({status:s.statusCode,body}));});r.on('error',reject);r.end(data);});
 try{
  assert.equal((await raw(JSON.stringify({login:'fictional@safeer.local',password:'x'.repeat(9000)}),{'Transfer-Encoding':'chunked'})).status,413);
  assert.equal((await raw(gzipSync(JSON.stringify({login:'fictional@safeer.local',password:'x'.repeat(9000)})),{'Content-Encoding':'gzip'})).status,413);
  const foreign=await raw(JSON.stringify({login:'fictional@safeer.local',password:'fictional'}),{Origin:'https://foreign.invalid'});assert.equal(foreign.status,403);
  const h=await fetch(web.origin+'/api/v1/health');assert.equal(h.headers.get('x-powered-by'),null);assert.match(h.headers.get('permissions-policy'),/camera=\(\)/);assert.match(h.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(h.headers.get('cache-control'),'no-store');
  for(const p of ['/config/database-security.json','/database/runtime-grants.mjs','/runtime/backups/section-14-backup-receipt.json','/dist/api/main.js'])assert.equal((await fetch(web.origin+p)).status,404);
 }finally{await web.close();}
}));
