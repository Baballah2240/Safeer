// D141: standard prices per country. Only the Super Administrator reads or sets them, only for served
// countries (D140), with reauthentication and versions; a company without a plan is offered its country's price.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identityFixture} from './support/identity-db.mjs';
import {setup,staff,ok} from './support/boarding-fixture.mjs';
test('country prices: super administrator only, served countries, versioned, offered to new companies',()=>identityFixture(async f=>{
 const s=await setup(f,'price-a'),pw=f.password;
 let r=ok(await f.admin.request('platform/country-prices'),200);assert.deepEqual(r.items,[]);assert.ok(r.countries.includes('SD')&&r.countries.includes('KW')&&!r.countries.includes('AE'));
 r=ok(await f.admin.request('platform/country-prices/SD','PUT',{monthlyFeeMinor:'2500000',commissionBps:350,currency:'sdg',version:0,currentPassword:pw}),200);
 assert.deepEqual(r.items.map(x=>[x.countryCode,x.monthlyFeeMinor,x.commissionBps,x.currency,x.version]),[['SD','2500000',350,'SDG',1]]);
 assert.equal((await f.admin.request('platform/country-prices/SD','PUT',{monthlyFeeMinor:'1',commissionBps:1,currency:'SDG',version:0,currentPassword:pw})).status,409,'creating twice is stale');
 assert.equal((await f.admin.request('platform/country-prices/SD','PUT',{monthlyFeeMinor:'1',commissionBps:1,currency:'SDG',version:7,currentPassword:pw})).status,409,'wrong version is stale');
 r=ok(await f.admin.request('platform/country-prices/SD','PUT',{monthlyFeeMinor:'3000000',commissionBps:400,currency:'SDG',version:1,currentPassword:pw}),200);assert.equal(r.items[0].version,2);
 assert.equal((await f.admin.request('platform/country-prices/AE','PUT',{monthlyFeeMinor:'1',commissionBps:1,currency:'AED',version:0,currentPassword:pw})).error.code,'INVALID_COUNTRY');
 assert.equal((await f.admin.request('platform/country-prices/SD','PUT',{monthlyFeeMinor:'1',commissionBps:1,currency:'SDG',version:2,currentPassword:'wrong-password'})).status,403,'needs the current password');
 for(const bad of [{monthlyFeeMinor:'-1'},{monthlyFeeMinor:'1.5'},{monthlyFeeMinor:'x'.repeat(70000)},{commissionBps:5001},{commissionBps:'3'},{currency:'SUDAN'},{currency:"' OR 1=1"},{extra:true},{version:-1}]){
  const res=await f.admin.request('platform/country-prices/SD','PUT',{monthlyFeeMinor:'1',commissionBps:1,currency:'SDG',version:2,currentPassword:pw,...bad});
  assert.ok(res.status>=400&&res.status<500,JSON.stringify(bad).slice(0,60)+' -> '+res.status);}
 // A company without a plan: the Super Administrator's billing view offers its country's price.
 let b=ok(await f.admin.request(s.base+'/billing'),200);assert.equal(b.plan,null);assert.deepEqual(b.countryPrice,{countryCode:'SD',monthlyFeeMinor:'3000000',commissionBps:400,currency:'SDG'});
 // D145: the Countries panel lists every served country with its setup, company counts and price.
 const list=ok(await f.admin.request('platform/countries'),200).items,sd=list.find(x=>x.countryCode==='SD'),kw=list.find(x=>x.countryCode==='KW'),eg=list.find(x=>x.countryCode==='EG'),td=list.find(x=>x.countryCode==='TD');
 assert.equal(list.length,11);assert.deepEqual([sd.currency,sd.calling,sd.timezone,sd.digits],['SDG','249','Africa/Khartoum',2]);assert.equal(sd.companies,1);assert.equal(sd.approved,1);assert.equal(sd.price.monthlyFeeMinor,'3000000');
 assert.deepEqual([kw.currency,kw.digits,kw.cardProvider,kw.cardReady,kw.companies,kw.price],['KWD',3,'myfatoorah',false,0,null]);assert.deepEqual([eg.cardProvider,td.cardProvider,td.digits],['paymob',null,0]);
 // D146: one country's companies.
 const sdCompanies=ok(await f.admin.request('platform/countries/SD/companies'),200).items;assert.equal(sdCompanies.length,1);assert.equal(sdCompanies[0].id,s.cid);
 assert.deepEqual([sdCompanies[0].status,sdCompanies[0].currency,sdCompanies[0].branches>=1,sdCompanies[0].staff>=0],['approved','SDG',true,true]);
 assert.deepEqual(ok(await f.admin.request('platform/countries/KW/companies'),200).items,[]);
 assert.equal((await f.admin.request('platform/countries/AE/companies')).error.code,'INVALID_COUNTRY');
 // Company staff never see Safeer's price list, even with every company permission.
 const all=(await f.migration.query("SELECT code FROM safeer.permissions WHERE code LIKE 'company.%'")).rows.map(x=>x.code);
 const {c:manager}=await staff(f,s,all);
 assert.equal((await manager.request('platform/country-prices')).status,403);assert.equal((await manager.request('platform/countries')).status,403);assert.equal((await manager.request('platform/countries/SD/companies')).status,403);
 assert.equal((await manager.request('platform/country-prices/SD','PUT',{monthlyFeeMinor:'1',commissionBps:1,currency:'SDG',version:2,currentPassword:'x'})).status>=400,true);
 b=ok(await manager.request(s.base+'/billing'),200);assert.equal(b.countryPrice,null);
 assert.equal((await f.client().request('platform/country-prices')).status,401);
 await assert.rejects(f.api.db.pool.query('SELECT safeer.country_prices_read()'),{code:'42501'});
 assert.equal((await f.migration.query("SELECT count(*)::int n FROM safeer.identity_audit WHERE action='platform.country_price_changed'")).rows[0].n,2);
}));
