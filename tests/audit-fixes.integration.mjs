import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identityFixture} from './support/identity-db.mjs';
import {setup} from './support/boarding-fixture.mjs';

// D72 audit fixes that need the database: time zone names and calendar-checked dashboard days.
const company=(f,slug,timezone)=>f.admin.request('companies','POST',{nameEn:'Fictional '+slug,nameAr:'Fictional '+slug,slug,holdMinutes:30,timezone,locale:'en',currentPassword:f.password});

test('company time zones must be named regions both JavaScript and PostgreSQL read the same way',()=>identityFixture(async f=>{
 // PostgreSQL reads "+03:00" as POSIX (three hours west of UTC); JavaScript reads it as east. Refuse it.
 for(const zone of ['+03:00','-02:00','UTC+3','GMT+3','EST5EDT,M3.2.0,M11.1.0','Mars/Olympus_Mons']){
  const r=await company(f,'zone-'+Math.random().toString(36).slice(2,8),zone);assert.equal(r.status,400,zone+' '+r.raw);assert.equal(r.error.code,'INVALID_TIMEZONE',zone);
 }
 assert.equal((await f.migration.query('SELECT count(*)::int AS n FROM safeer.company_settings')).rows[0].n,0,'nothing saved');
 const made=await company(f,'zone-named','Africa/Khartoum');assert.equal(made.status,201,made.raw);
 const w=(await f.admin.request('companies/'+made.data.id)).data;
 const moved=await f.admin.request('companies/'+made.data.id,'PATCH',{...w.company,id:undefined,timezone:'+02:00',currentPassword:f.password});
 assert.equal(moved.error?.code,'INVALID_TIMEZONE',moved.raw);
 const fixed=await f.admin.request('companies/'+made.data.id,'PATCH',{...w.company,id:undefined,timezone:'Etc/GMT-2',currentPassword:f.password});assert.equal(fixed.status,200,fixed.raw);
}));

test('the operations day must be a real calendar date, not one JavaScript rolls over',()=>identityFixture(async f=>{
 const s=await setup(f,'ops-days');
 for(const day of ['2026-02-31','2026-04-31','2026-13-01','2026-1-1'])assert.equal((await f.admin.request(s.base+'/operations?day='+day)).status,400,day);
 assert.equal((await f.admin.request(s.base+'/operations?day=2028-02-29')).status,200,'leap day is valid');
}));

test('staff and counters can reach trips beyond the first 200 listed and the next 100 sold',()=>identityFixture(async f=>{
 const s=await setup(f,'many-trips'),route=(await f.migration.query('SELECT id FROM safeer.routes WHERE company_id=$1',[s.cid])).rows[0].id;
 const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10),ids=[];
 for(let batch=0;batch<7;batch++){const r=await f.admin.request(s.path,'POST',{routeId:route,dates:Array.from({length:31},(_,i)=>day(2+batch*31+i)),time:'09:00',offsets:[0,120],fareMinor:90000,...s.pw});assert.equal(r.status,201,r.raw);ids.push(...r.data.ids);}
 const first=(await f.admin.request(s.path)).data;assert.equal(first.items.length,200);assert.equal(first.more,true,'the list says it is incomplete');
 const last=day(2+7*31-1),later=(await f.admin.request(s.path+'?from='+last)).data;
 assert.equal(later.more,false);assert.equal(later.from,last);assert.ok(later.items.some(t=>t.date===last),'a later start date reaches the last trip');
 assert.equal((await f.admin.request(s.path+'?from=2026-02-31')).status,400);
 // Publish the drafts directly (fixture shortcut: assignment rules are covered elsewhere).
 await f.migration.query('SET session_replication_role=replica');
 try{await f.migration.query("UPDATE safeer.trips SET status='published',published_at=clock_timestamp() WHERE id=ANY($1::uuid[])",[ids]);}finally{await f.migration.query('SET session_replication_role=DEFAULT');}
 const overview=(await f.admin.request(s.base+'/counter')).data;assert.equal(overview.trips.length,100);assert.equal(overview.trips.some(t=>t.date===last),false);
 const reached=await f.admin.request(s.base+'/counter/trips?day='+last);assert.equal(reached.status,200,reached.raw);
 assert.deepEqual(reached.data.items.map(t=>t.date),[last]);assert.equal(reached.data.day,last);
 for(const bad of ['','2026-02-31','tomorrow'])assert.equal((await f.admin.request(s.base+'/counter/trips?day='+bad)).status,400,bad);
 // Without ticketing permission the day list is refused like the rest of the counter.
 const none=await (await import('./support/boarding-fixture.mjs')).staff(f,s,['company.profile.read']);
 assert.ok([403,404].includes((await none.c.request(s.base+'/counter/trips?day='+last)).status));
}));
