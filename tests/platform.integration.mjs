import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';
import {ok,setup,paid,staff,boardingSetup} from './support/boarding-fixture.mjs';
const range=()=>{const today=new Date().toISOString().slice(0,10);return {from:today,to:today};};
const dashboard=(c,extra={})=>c.request('platform/dashboard?'+new URLSearchParams({...range(),...extra}));
const inbox=async c=>ok(await c.request('notifications'),200);
const status=async(f,s,value)=>{const w=ok(await f.admin.request(s.base),200);return ok(await f.admin.request(s.base,'PATCH',{...w.company,id:undefined,status:value,currentPassword:f.password}),200);};
const cancel=async(f,s,tid)=>{const v=(await f.migration.query('SELECT version FROM safeer.trips WHERE id=$1',[tid])).rows[0].version;return ok(await f.admin.request(`${s.path}/${tid}/cancel`,'POST',{version:v,reason:'Fictional private cancellation note',currentPassword:f.password}));};

test('platform is Super-only, even when tenant permissions are broad; owner authority survives editable role grants',()=>identityFixture(async f=>{
 assert.equal((await dashboard(f.client())).status,401);
 const empty=ok(await dashboard(f.admin),200);assert.equal(empty.companyCount,0);assert.deepEqual(empty.totals,[]);
 const s=await setup(f,'platform-access'),u=await staff(f,s,['company.profile.read','company.finance.read','company.journeys.manage']);
 for(const path of ['platform/settings','platform/dashboard?'+new URLSearchParams(range())])assert.equal((await u.c.request(path)).status,403);
 assert.equal((await u.c.request('platform/settings','PUT',{enabled:false,textEn:'',textAr:'',version:1,currentPassword:u.pass})).status,403);
 await f.migration.query("DELETE FROM safeer.role_permissions WHERE role_id=(SELECT id FROM safeer.roles WHERE code='platform_super_administrator')");
 assert.equal(ok(await dashboard(f.admin),200).companyCount,1);
 for(const extra of [{from:'2026-02-30'},{from:'2026-01-01',to:'2026-03-01'},{page:'-1'},{page:'1000001'},{companyId:s.cid}])assert.equal((await dashboard(f.admin,extra)).status,400);
}));

test('global analytics count multi-seat payments once, separate refunds/currencies and include all company statuses',()=>identityFixture(async f=>{
 const s=await setup(f,'platform-money'),tid=await s.trip(),p=await paid(f,s,tid,['1','2']);
 await paid(f,s,tid,['3']);ok(await f.admin.request(`${s.base}/bookings/${p.bid}/refund`,'POST',{reason:'Fictional private refund',key:randomUUID(),currentPassword:f.password}));
 let r=ok(await dashboard(f.admin),200);assert.deepEqual(r.totals,[{currency:'SDG',salesMinor:'450000',refundMinor:'300000',netMinor:'150000'}]);assert.equal(r.summary.bookings,2);assert.equal(r.summary.departures,0);assert.equal(r.companies[0].totals[0].netMinor,'150000');
 // Simulate distinct legacy currencies only in this disposable fixture.
 await f.migration.query('SET session_replication_role=replica');try{await f.migration.query("UPDATE safeer.refunds SET currency='USD'");await f.migration.query("UPDATE safeer.companies SET status='archived' WHERE id=$1",[s.cid]);}finally{await f.migration.query('SET session_replication_role=DEFAULT');}
 r=ok(await dashboard(f.admin),200);assert.deepEqual(r.totals.map(x=>[x.currency,x.netMinor]),[['SDG','450000'],['USD','-300000']]);assert.equal(r.companies[0].status,'archived');assert.equal(r.summary.approved,0);assert.equal(r.summary.listed,0);
 for(const privateValue of ['0912345678','Fictional Traveler','Fictional private refund','password','token','method_reference','TQ'])assert.equal(JSON.stringify(r).includes(privateValue),false);
 // A refund's own UTC posting date determines its inclusion, independently of payment.
 await f.migration.query('SET session_replication_role=replica');try{await f.migration.query("UPDATE safeer.refunds SET created_at=(now() AT TIME ZONE 'UTC')::date::timestamp AT TIME ZONE 'UTC'-interval '1 microsecond'");}finally{await f.migration.query('SET session_replication_role=DEFAULT');}
 r=ok(await dashboard(f.admin),200);assert.deepEqual(r.totals.map(x=>x.currency),['SDG']);
 assert.ok((await f.migration.query("SELECT 1 FROM safeer.identity_audit WHERE action='platform.dashboard_read'")).rowCount);
}));

test('bilingual public notice is disabled initially, safely projected, reauthenticated, versioned and audited',()=>identityFixture(async f=>{
 const anon=f.client();assert.deepEqual(ok(await anon.request('public/notice'),200),{enabled:false});
 const d={enabled:true,textEn:'Fictional <script>alert(1)</script> notice',textAr:'إعلان تجريبي',version:1,currentPassword:f.password};
 assert.equal((await f.admin.request('platform/settings','PUT',{...d,currentPassword:'wrong-password'})).error.code,'REAUTHENTICATION_FAILED');
 const saved=ok(await f.admin.request('platform/settings','PUT',d),200);assert.equal(saved.version,2);assert.equal(saved.textAr,d.textAr);
 assert.deepEqual(ok(await anon.request('public/notice'),200),{enabled:true,textEn:d.textEn,textAr:d.textAr});
 assert.equal((await f.admin.request('platform/settings','PUT',d)).error.code,'STALE_VERSION');
 for(const over of [{textEn:'x'.repeat(501)},{textEn:''},{textAr:'x\n'},{actorId:randomUUID()}])assert.equal((await f.admin.request('platform/settings','PUT',{...d,...over,version:2})).status,400);
 assert.equal((await f.admin.request('platform/settings','PUT',{...d,version:2},{'X-CSRF-Token':'invalid'})).status,403);
 ok(await f.admin.request('platform/settings','PUT',{...d,enabled:false,version:2}),200);assert.deepEqual(ok(await anon.request('public/notice'),200),{enabled:false});
 const audit=(await f.migration.query("SELECT * FROM safeer.identity_audit WHERE action='platform.notice_changed'")).rows;assert.equal(audit.length,2);assert.equal(JSON.stringify(audit).includes(d.textEn),false);
}));

test('notification capture commits with the operation and receipt retries are user-specific and idempotent',()=>identityFixture(async f=>{
 const s=await setup(f,'platform-events');let feed=await inbox(f.admin);assert.deepEqual(new Set(feed.items.map(x=>x.code)),new Set(['company.registered','company.status','marketplace.changed']));
 const n=feed.items[0];const reads=await Promise.all(Array.from({length:4},()=>f.admin.request('notifications/'+n.id+'/read','POST',{})));reads.forEach(r=>ok(r));
 feed=await inbox(f.admin);assert.equal(feed.unreadCount,2);assert.equal(feed.items.find(x=>x.id===n.id).read,true);
 assert.equal((await f.migration.query('SELECT count(*)::integer n FROM safeer.notification_reads')).rows[0].n,1);
 const before=feed.items.length;await f.migration.query('BEGIN');await f.migration.query("SELECT set_config('safeer.session_token',$1,true)",[f.admin.cookie.slice('safeer_session='.length)]);await f.migration.query("UPDATE safeer.companies SET status='suspended',version=version+1 WHERE id=$1",[s.cid]);await f.migration.query('ROLLBACK');assert.equal((await inbox(f.admin)).items.length,before);
 await f.migration.query('UPDATE safeer.companies SET name_en=name_en,version=version+1 WHERE id=$1',[s.cid]);assert.equal((await inbox(f.admin)).items.length,before);
 const user=await staff(f,s,['company.profile.read']);assert.deepEqual((await inbox(user.c)).items,[]);assert.equal((await user.c.request('notifications/'+n.id+'/read','POST',{})).status,403);
 const listing={listed:false,aboutEn:'',aboutAr:'',version:1,currentPassword:f.password};
 ok(await f.admin.request(s.base+'/public-profile','PUT',listing),200);const changed=(await inbox(f.admin)).items.length;
 ok(await f.admin.request(s.base+'/public-profile','PUT',{...listing,aboutEn:'Fictional content-only change',version:2}),200);assert.equal((await inbox(f.admin)).items.length,changed);
 const fresh=ok(await f.admin.request('companies','POST',{nameEn:'Fictional unlisted',nameAr:'Fictional unlisted',slug:'platform-unlisted',holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',currentPassword:f.password})).id;
 ok(await f.admin.request('companies/'+fresh+'/public-profile','PUT',{...listing,version:0}),200);assert.equal((await inbox(f.admin)).items.filter(x=>x.companyId===fresh&&x.code==='marketplace.changed').length,0,'Creating an unlisted profile is not a listing change.');
 for(const value of ['0','-1','9223372036854775808','1.1','abc'])assert.equal((await f.admin.request('notifications?before='+value)).status,400);
 assert.equal((await f.admin.request('notifications/'+n.id+'/read','POST',{userId:randomUUID()})).status,400);
}));

test('inbox pagination is complete, unread counts span pages, and aged events disappear',()=>identityFixture(async f=>{
 const s=await setup(f,'platform-pages');
 await f.migration.query("INSERT INTO safeer.notification_events(company_id,code,source_id,revision) SELECT $1,'company.status',$1,n FROM generate_series(100,155) n ON CONFLICT DO NOTHING",[s.cid]);
 let feed=await inbox(f.admin);assert.equal(feed.items.length,50);assert.equal(feed.unreadCount,59);const ids=new Set(feed.items.map(x=>x.id));
 const last=ok(await f.admin.request('notifications?before='+feed.nextCursor),200);assert.equal(last.items.length,9);assert.equal(last.nextCursor,null);last.items.forEach(x=>assert.equal(ids.has(x.id),false));
 await f.migration.query("UPDATE safeer.notification_events SET created_at=now()-interval '91 days' WHERE id=$1",[last.items[0].id]);
 assert.equal((await f.admin.request('notifications/'+last.items[0].id+'/read','POST',{})).status,403);assert.equal((await inbox(f.admin)).unreadCount,58);
 // Company dashboard pagination has a complete count, without contact details.
 await f.migration.query("INSERT INTO safeer.companies(id,slug,name_en,name_ar,status) SELECT gen_random_uuid(),'fictional-page-'||n,'Fictional Company','Fictional Company','archived' FROM generate_series(1,51) n");
 const a=ok(await dashboard(f.admin),200),b=ok(await dashboard(f.admin,{page:1}),200);assert.equal(a.companyCount,52);assert.equal(a.companies.length,50);assert.equal(b.companies.length,2);const companies=new Set(a.companies.map(x=>x.id));b.companies.forEach(x=>assert.equal(companies.has(x.id),false));
}));

test('cash difference notifications follow current station finance scope; revoked or suspended access hides them',()=>identityFixture(async f=>{
 const s=await setup(f,'platform-cash'),other=await setup(f,'platform-other');
 const same=await staff(f,s,['company.finance.read'],{stationId:s.station,branchId:s.branch},'station'),foreign=await staff(f,other,['company.finance.read']);
 const session=(await f.migration.query('SELECT id FROM safeer.cash_sessions WHERE company_id=$1',[s.cid])).rows[0].id;
 ok(await f.admin.request(`${s.base}/counter/sessions/${session}/close`,'POST',{countedMinor:99900,note:'Private drawer note',currentPassword:f.password}));
 let feed=await inbox(same.c);assert.deepEqual(feed.items.map(x=>x.code),['cash.difference']);assert.deepEqual((await inbox(foreign.c)).items,[]);
 const payload=JSON.stringify(feed);for(const value of ['99900','100000','Private drawer note'])assert.equal(payload.includes(value),false);
 const id=feed.items[0].id;ok(await same.c.request('notifications/'+id+'/read','POST',{}));assert.equal((await inbox(same.c)).unreadCount,0);
 const observer=await staff(f,s,['company.finance.read'],{stationId:s.station,branchId:s.branch},'station');assert.equal((await inbox(observer.c)).unreadCount,1,'A newly authorized account has its own unread receipt state.');
 await status(f,s,'suspended');assert.deepEqual((await inbox(same.c)).items,[]);assert.equal((await same.c.request('notifications/'+id+'/read','POST',{})).status,403);
 await status(f,s,'approved');
 await f.migration.query('UPDATE safeer.company_users SET active=false WHERE user_id=(SELECT id FROM safeer.users WHERE normalized_login=$1)',[ok(await same.c.request('auth/me'),200).login]);assert.deepEqual((await inbox(same.c)).items,[]);
}));

test('cancellation reaches the current assigned driver and journey incidents reach current company-wide supervisors only',()=>identityFixture(async f=>{
 const s=await boardingSetup(f),scoped={...s,base:s.companyBase},supervisor=await staff(f,scoped,['company.journeys.manage']),narrow=await staff(f,scoped,['company.journeys.manage'],{branchId:s.branch},'branch');
 const incident={kind:'delay',note:'Fictional sensitive incident',key:randomUUID()};ok(await s.driver.c.request(s.base+'/incidents','POST',incident));ok(await s.driver.c.request(s.base+'/incidents','POST',incident));
 assert.equal((await inbox(supervisor.c)).items.filter(x=>x.code==='journey.incident').length,1);assert.deepEqual((await inbox(narrow.c)).items,[]);assert.deepEqual((await inbox(s.driver.c)).items,[]);
 await cancel(f,s,s.id);let d=await inbox(s.driver.c);assert.deepEqual(d.items.map(x=>x.code),['trip.canceled']);assert.equal(JSON.stringify(await inbox(supervisor.c)).includes(incident.note),false);
 await f.migration.query('UPDATE safeer.company_users SET active=false WHERE id=$1',[s.member]);assert.deepEqual((await inbox(s.driver.c)).items,[]);assert.equal((await s.driver.c.request('notifications/'+d.items[0].id+'/read','POST',{})).status,403);
 await f.migration.query('DELETE FROM safeer.company_role_permissions WHERE company_id=$1 AND permission_code=$2',[s.cid,'company.journeys.manage']);assert.deepEqual((await inbox(supervisor.c)).items,[]);
}));

test('luggage exception notifications require current company-wide resolution access and copy no passenger or problem notes',()=>identityFixture(async f=>{
 const s=await setup(f,'platform-luggage'),tid=await s.trip(),p=await paid(f,s,tid);
 const resolver=await staff(f,s,['company.luggage.resolve']),narrow=await staff(f,s,['company.luggage.resolve'],{branchId:s.branch},'branch'),operator=await staff(f,s,['company.luggage.operate']);
 const bag=ok(await f.admin.request(s.bags,'POST',{ticketNumber:p.ticket,category:'suitcase',quantity:1,weightGrams:18000,description:'Fictional private bag',handling:null,key:randomUUID()}));
 const path=`${s.bags}/${bag.id}/exceptions`;ok(await f.admin.request(path,'POST',{kind:'missing',note:'Fictional private luggage note'}));
 assert.equal((await f.admin.request(path,'POST',{kind:'missing'})).error.code,'LUGGAGE_EXCEPTION_OPEN');
 const feed=await inbox(resolver.c);assert.deepEqual(feed.items.map(x=>x.code),['luggage.exception']);assert.deepEqual((await inbox(narrow.c)).items,[]);assert.deepEqual((await inbox(operator.c)).items,[]);
 const payload=JSON.stringify(feed);for(const privateValue of ['Fictional Traveler','Fictional private bag','Fictional private luggage note',p.ticket,'0912345678'])assert.equal(payload.includes(privateValue),false);
 await f.migration.query('DELETE FROM safeer.company_role_permissions WHERE company_id=$1 AND permission_code=$2',[s.cid,'company.luggage.resolve']);assert.deepEqual((await inbox(resolver.c)).items,[]);
}));

test('restricted runtime has no raw platform table or visibility/trigger helper privileges and actor flags cannot authorize reads',()=>identityFixture(async f=>{
 for(const table of ['platform_settings','notification_events','notification_reads'])await assert.rejects(f.api.db.pool.query('SELECT * FROM safeer.'+table),{code:'42501'});
 for(const call of ['safeer.notification_capture()','safeer.notification_visible(NULL::safeer.notification_events)'])await assert.rejects(f.api.db.pool.query('SELECT '+call),{code:'42501'});
 await assert.rejects(f.api.db.pool.query('SELECT safeer.platform_settings_read()'),{code:'42501'});
 await assert.rejects(f.api.db.pool.query('SELECT safeer.notifications_list(NULL)'),{code:'42501'});
 const c=await f.api.db.pool.connect();try{await c.query('BEGIN');await c.query("SELECT set_config('safeer.actor_id',$1,true),set_config('safeer.is_super','true',true)",[ok(await f.admin.request('auth/me'),200).id]);await assert.rejects(c.query('SELECT safeer.platform_dashboard(current_date,current_date,0)'),{code:'42501'});}finally{await c.query('ROLLBACK');c.release();}
}));
