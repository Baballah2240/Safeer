// 2026-11-22 security review of D135-D146 (super administrator access, user access, global work, countries):
// every new endpoint refuses anonymous callers and company staff where it is Super Administrator only, and hostile
// input in paths, queries and bodies never produces a server error or leaks one.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';
import {setup,staff,ok} from './support/boarding-fixture.mjs';

const nasty=[null,true,0,-1,1e309,'',' ','x'.repeat(70000),'<script>alert(1)</script>',"' OR 1=1 --",'../../etc/passwd','%00','\u0000','𝕏'.repeat(50),[],[[[[[]]]]],{},{__proto__:{admin:true}},{constructor:{prototype:{admin:true}}}];
const pathJunk=["'","%27%20OR%201%3D1","..%2F..%2Fetc","<svg>","00000000-0000-0000-0000-000000000000","zz",'a'.repeat(300),'%00'];

test('global and super administrator endpoints refuse outsiders and survive hostile input',()=>identityFixture(async f=>{
 const s=await setup(f,'sec-a'),pw=f.password;
 const uid=ok(await f.admin.request('identity/users','POST',{displayName:'Fictional Target',login:'target@safeer.local',currentPassword:pw})).user.id;
 const superReads=['platform/countries','platform/countries/SD/companies','platform/country-prices',`identity/users/${uid}/access`];
 const superWrites=[['PUT','platform/country-prices/SD',{monthlyFeeMinor:'1',commissionBps:1,currency:'SDG',version:0}],['PUT',`identity/users/${uid}/permissions`,{permissions:['identity.audit.read'],version:1}]];
 // Anonymous: always refused.
 const anonymous=f.client();
 for(const p of superReads)assert.equal((await anonymous.request(p)).status,401,'anonymous GET '+p);
 for(const [m,p,b] of superWrites)assert.ok([401,403].includes((await anonymous.request(p,m,b)).status),'anonymous '+m+' '+p);
 // A company manager with every company permission: refused, and cannot raise their own access.
 const all=(await f.migration.query("SELECT code FROM safeer.permissions WHERE code LIKE 'company.%'")).rows.map(x=>x.code);
 const {c:manager}=await staff(f,s,all);const meId=ok(await manager.request('auth/me'),200).id;
 for(const p of superReads)assert.equal((await manager.request(p)).status,403,'manager GET '+p);
 for(const [m,p,b] of superWrites)assert.equal((await manager.request(p,m,{...b,currentPassword:'x'})).status>=400,true,'manager '+m+' '+p);
 assert.equal((await manager.request(`identity/users/${meId}/permissions`,'PUT',{permissions:['identity.users.manage'],version:1,currentPassword:'x'})).status>=400,true,'no self-promotion');
 assert.equal(ok(await manager.request('auth/me'),200).superAdministrator,false);
 assert.equal((await f.migration.query("SELECT count(*)::int n FROM safeer.roles WHERE code LIKE 'personal_%'")).rows[0].n,0,'nothing was granted');
 // Hostile path segments: a client error, never a server error.
 for(const j of pathJunk){
  for(const p of [`platform/countries/${j}/companies`,`identity/users/${j}/access`]){const r=await f.admin.request(p);assert.ok(r.status>=400&&r.status<500,p+' -> '+r.status);}
  const r=await f.admin.request(`platform/country-prices/${j}`,'PUT',{monthlyFeeMinor:'1',commissionBps:1,currency:'SDG',version:0,currentPassword:pw});assert.ok(r.status>=400&&r.status<500,'price '+j+' -> '+r.status);
 }
 // Hostile bodies on every new write.
 for(const v of nasty){
  for(const [p,body] of [[`identity/users/${uid}/permissions`,{permissions:v,version:1,currentPassword:pw}],[`identity/users/${uid}/permissions`,{permissions:[],version:v,currentPassword:pw}],
   ['platform/country-prices/SD',{monthlyFeeMinor:v,commissionBps:1,currency:'SDG',version:0,currentPassword:pw}],['platform/country-prices/SD',{monthlyFeeMinor:'1',commissionBps:v,currency:'SDG',version:0,currentPassword:pw}],['platform/country-prices/SD',{monthlyFeeMinor:'1',commissionBps:1,currency:v,version:0,currentPassword:pw}]]){
   const r=await f.admin.request(p,'PUT',body);assert.ok(r.status<500,p+' '+JSON.stringify(v)?.slice(0,40)+' -> '+r.status);
   assert.equal(JSON.stringify(r.data??r.error).includes('stack'),false);
  }
 }
 // Public payment endpoints: junk is answered calmly and confirms nothing.
 const host={host:new URL(f.api.origin).host};
 for(const q of [{},{c:'KW'},{c:'KW',paymentId:"' OR 1=1"},{c:"<script>",paymentId:'1'},{c:'KW',paymentId:'x'.repeat(5000)},{paymentId:['1','2']}]){
  const r=await fetch(f.api.origin+'/api/v1/payments/myfatoorah/return?'+new URLSearchParams(q),{redirect:'manual',headers:host});
  assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/booking?card=unknown');
 }
 // Oversized bodies are refused (413); everything else is answered "not received". Never a server error.
 const calm=r=>r.status===413||(r.status<300&&r.data?.received===false);
 for(const v of nasty.slice(0,12)){const r=await f.client().request('payments/myfatoorah/webhook','POST',{Data:{InvoiceId:v}});assert.ok(calm(r),'webhook '+JSON.stringify(v)?.slice(0,30)+' -> '+r.status);}
 for(const v of nasty.slice(0,12)){const r=await f.client().request('payments/paymob/callback?hmac=00','POST',{obj:v});assert.ok(calm(r),'paymob '+JSON.stringify(v)?.slice(0,30)+' -> '+r.status);}
 const plain=await fetch(f.api.origin+'/api/v1/payments/myfatoorah/webhook',{method:'POST',headers:{...host,'Content-Type':'text/plain'},body:'hello'});assert.equal(plain.status,415,'webhook takes JSON only');
 // Card checkout for a company without a ready provider (Sudan): refused, nothing recorded.
 const trip=await s.trip(),key=randomUUID();
 const held=ok(await f.client().request('public/holds','POST',{tripId:trip,seats:['1'],key,mobile:'0912345678',travelers:[{seat:'1',name:'Fictional Traveler',luggage:null}]}));
 assert.equal((await f.client().request(`public/holds/${held.reference}/card`,'POST',{key})).error.code,'METHOD_DISABLED');
 assert.equal((await f.migration.query('SELECT count(*)::int n FROM safeer.card_checkouts')).rows[0].n,0);
 // The runtime database role cannot call the Super Administrator functions without a super session.
 for(const sql of ['SELECT safeer.platform_countries()',"SELECT safeer.platform_country_companies('SD')",'SELECT safeer.country_prices_read()'])
  await assert.rejects(f.api.db.pool.query(sql),{code:'42501'},sql);
}));
