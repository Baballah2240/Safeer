import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';
import {setup,paid,staff,ok} from './support/boarding-fixture.mjs';

// 2026-11-19 security review: endpoints added after the D72 audit (billing, branding, invoices, contracts,
// stop-to-stop fares, counter manifests, payment proofs, staff alerts) must refuse anonymous callers,
// staff without the permission and staff of another company, and must never answer a hostile body with a server error.
const nasty=[null,true,0,-1,1e309,'',' ','x'.repeat(70000),'<script>alert(1)</script>',"' OR 1=1 --",'../../etc/passwd','%00','\u0000','𝕏'.repeat(50),[],[[[[[]]]]],{},{__proto__:{admin:true}},{constructor:{prototype:{admin:true}}},'data:image/svg+xml;base64,PHN2Zy8+','data:image/png;base64,AAAA','#zzzzzz',randomUUID(),'2026-02-31',9007199254740993];

test('new company endpoints refuse anonymous, unprivileged and other-company callers',()=>identityFixture(async f=>{
 const a=await setup(f,'probe-a'),b=await setup(f,'probe-b');
 const trip=await a.trip(),sale=await paid(f,a,trip);
 const route=(await f.migration.query('SELECT id FROM safeer.routes WHERE company_id=$1',[a.cid])).rows[0].id;
 const session=(await f.migration.query('SELECT id FROM safeer.cash_sessions WHERE company_id=$1 LIMIT 1',[a.cid])).rows[0].id;
 const reads=[`billing`,`branding/logo`,`routes/${route}/fares`,`counter/sessions/${session}/manifest`,`bookings/${sale.bid}/payment-proof`,`contracts/${randomUUID()}/pdf`,`invoices/${randomUUID()}/pdf`];
 const writes=[['PUT','billing',{}],['PUT','branding',{primaryColor:'#123456',secondaryColor:'#654321',version:0}],['POST','invoices',{}],['PUT',`routes/${route}/fares`,{fares:[]}],['POST',`contracts/${randomUUID()}/accept`,{}],['POST',`invoices/${randomUUID()}/paid`,{}]];
 const anonymous=f.client();
 for(const path of reads){const r=await anonymous.request(`${a.base}/${path}`);assert.ok([401,403].includes(r.status),`anonymous GET ${path} -> ${r.status} ${r.raw}`);}
 for(const [method,path,body] of writes){const r=await anonymous.request(`${a.base}/${path}`,method,body);assert.ok([401,403].includes(r.status),`anonymous ${method} ${path} -> ${r.status}`);}
 // A luggage handler of company A may not read billing, fares, manifests or payment proofs.
 const {c:handler}=await staff(f,a,['company.luggage.operate']);
 for(const path of reads){const r=await handler.request(`${a.base}/${path}`);assert.ok([403,404].includes(r.status),`luggage handler GET ${path} -> ${r.status} ${r.raw}`);}
 for(const [method,path,body] of writes){const r=await handler.request(`${a.base}/${path}`,method,{...body,currentPassword:'x'});assert.ok(r.status>=400&&r.status<500,`luggage handler ${method} ${path} -> ${r.status}`);}
 // A full manager of company B may not reach company A's records through B's or A's paths.
 const {c:other}=await staff(f,b,['company.bookings.read','company.bookings.manage','company.ticketing.operate','company.routes.read','company.routes.manage','company.finance.read','company.profile.read','company.profile.manage']);
 for(const path of reads){const r=await other.request(`${a.base}/${path}`);assert.ok([403,404].includes(r.status),`company B GET A/${path} -> ${r.status} ${r.raw}`);}
 for(const path of [`bookings/${sale.bid}/payment-proof`,`routes/${route}/fares`,`counter/sessions/${session}/manifest`]){const r=await other.request(`${b.base}/${path}`);assert.ok([403,404].includes(r.status),`A's ids through B's path ${path} -> ${r.status} ${r.raw}`);}
 // Notifications: read-all needs the CSRF token like every other write.
 const forged=await f.client().request('notifications/read-all','POST',{});assert.ok([401,403].includes(forged.status),forged.raw);
 const noCsrf=await fetch(f.api.origin+'/api/v1/notifications/read-all',{method:'POST',headers:{Cookie:f.admin.cookie,Origin:'http://127.0.0.1:4320','Content-Type':'application/json'},body:'{}'});assert.equal(noCsrf.status,403);
 const evil=await fetch(f.api.origin+'/api/v1/notifications/read-all',{method:'POST',headers:{Cookie:f.admin.cookie,Origin:'https://evil.example','X-CSRF-Token':f.admin.csrf,'Content-Type':'application/json'},body:'{}'});assert.equal(evil.status,403);
}));

test('hostile input to the new endpoints is refused without a server error',()=>identityFixture(async f=>{
 const a=await setup(f,'probe-fuzz'),trip=await a.trip(),sale=await paid(f,a,trip);
 const route=(await f.migration.query('SELECT id FROM safeer.routes WHERE company_id=$1',[a.cid])).rows[0].id;
 const targets=[
  ['PUT',`${a.base}/billing`,['planCode','monthlyFeeMinor','commissionBps','currency','startsOn','version','currentPassword']],
  ['PUT',`${a.base}/branding`,['primaryColor','secondaryColor','logo','removeLogo','version','currentPassword']],
  ['POST',`${a.base}/invoices`,['month','version','currentPassword']],
  ['PUT',`${a.base}/routes/${route}/fares`,['fares','version','currentPassword']],
  ['POST',`${a.base}/bookings/${sale.bid}/pay`,['method','reference','key','lateReason','proof']],
  ['POST',`${a.base}/counter/sales`,['tripId','seats','mobile','travelers','method','reference','key','fromIndex','toIndex','proof']],
  ['POST','notifications/read-all',['before','version']],
  ['POST','public/holds',['tripId','seats','key','mobile','travelers','fromIndex','toIndex']],
 ];
 let sent=0;const statuses={};
 for(const [method,path,fields] of targets)for(const field of fields)for(const value of nasty){
  const body={currentPassword:f.password,[field]:value};
  const r=path.startsWith('public/')?await f.client().request(path,method,body):await f.admin.request(path,method,body);sent++;
  statuses[r.status]=(statuses[r.status]||0)+1;
  assert.ok(r.status<500,`${method} ${path} ${field}=${JSON.stringify(value)?.slice(0,60)} -> ${r.status} ${r.raw.slice(0,200)}`);
  assert.ok(!/at .*\.(ts|js|mjs):\d+|stack|SELECT |INSERT |syntax error/i.test(r.raw),`no internals leak: ${path} ${field} ${r.raw.slice(0,200)}`);
 }
 // Not JSON, wrong content type, deeply nested and oversized bodies.
 for(const [type,raw] of [['text/plain','x=1'],['application/json','{"a":'],['application/json','['.repeat(5000)+']'.repeat(5000)],['application/json',JSON.stringify({logo:'A'.repeat(2_000_000)})]]){
  const r=await fetch(f.api.origin+`/api/v1/${a.base}/branding`,{method:'PUT',headers:{Cookie:f.admin.cookie,Origin:'http://127.0.0.1:4320','X-CSRF-Token':f.admin.csrf,'Content-Type':type},body:raw});sent++;
  assert.ok(r.status>=400&&r.status<500,`${type} ${raw.slice(0,20)} -> ${r.status}`);
 }
 // Public reads with hostile path and query values.
 for(const slug of ['..%2f..%2f','A'.repeat(200),"x' OR '1'='1",'%00','-','a--b'])for(const end of ['brand','logo']){const r=await f.client().request(`public/companies/${slug}/${end}`);sent++;assert.ok([400,404].includes(r.status),`${slug} ${end} -> ${r.status}`);}
 for(const q of ['from=-1','from=30','to=abc','from=1e3','from=0&to=0','from=%27','from[]=1'])for(const id of [trip,'not-a-uuid']){const r=await f.client().request(`public/trips/${id}?${q}`);sent++;assert.ok(r.status<500,`${id} ${q} -> ${r.status} ${r.raw.slice(0,120)}`);}
 assert.ok(sent>1000,'probe size '+sent);
 console.log('security probe requests',sent,JSON.stringify(statuses));
}));
