// D135: the super administrator has full access to every part of Safeer, the staff site and the apps.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identityFixture} from './support/identity-db.mjs';
import {boardingSetup,ok} from './support/boarding-fixture.mjs';
test('super administrator reaches every staff, platform and driver-app endpoint',()=>identityFixture(async f=>{
 const s=await boardingSetup(f);await s.time();
 const me=ok(await f.admin.request('auth/me'),200);assert.equal(me.superAdministrator,true);
 const all=ok(await f.admin.request('identity/permissions'),200);const codes=(all.items||all).map(p=>p.code||p);
 for(const code of codes)assert.ok(me.permissions.includes(code),'super administrator lacks '+code);
 const route=(await f.migration.query('SELECT id FROM safeer.routes WHERE company_id=$1',[s.cid])).rows[0].id;
 const b=s.companyBase,paths=['auth/sessions','identity/users','identity/roles','identity/audit','companies',b,'cities',b+'/routes',`${b}/routes/${route}`,`${b}/routes/${route}/fares`,
  b+'/fleet',b+'/drivers',b+'/trips',`${b}/trips/${s.id}`,`${b}/trips/${s.id}/seats`,b+'/operations',`${b}/operations/trips/${s.id}`,b+'/shipments',b+'/shipments/options',b+'/luggage',
  b+'/counter',b+'/counter/trips',`${b}/counter/trips/${s.id}`,b+'/bookings',`${b}/bookings/${s.p.bid}`,b+'/billing',b+'/public-profile',b+'/finance',b+'/finance/options',
  'platform/dashboard','platform/settings','platform/country-prices','notifications','notifications/unread','driver/trips',`driver/companies/${s.cid}/trips/${s.id}`];
 const denied=[];for(const p of paths){const r=await f.admin.request(p);if(r.status===401||r.status===403)denied.push(p+' '+r.status+' '+r.raw?.slice(0,120));}
 assert.deepEqual(denied,[]);
 const capabilities=ok(await f.admin.request(b),200).capabilities;
 for(const [k,v] of Object.entries(capabilities))if(typeof v==='boolean')assert.equal(v,true,'capability '+k);
 // Driver app: the super administrator lists and runs any trip, without being its driver.
 const list=ok(await f.admin.request('driver/trips'),200).items;assert.ok(list.some(t=>t.id===s.id&&t.companyId===s.cid),'trip missing from the super administrator driver list');
 assert.equal(new Set(list.map(t=>t.id)).size,list.length);
 ok(await f.admin.request(s.base+'/board','POST',{token:s.code.token}));
 await s.time('-5 minutes');ok(await f.admin.request(s.base+'/events','POST',{event:'departed'}));
 // Drivers still see only their own assignments.
 const other=await s.trip([new Date(Date.now()+40*86400000).toISOString().slice(0,10)]);
 const driverList=ok(await s.driver.c.request('driver/trips'),200).items;assert.equal(driverList.some(t=>t.id===s.id),true);
 assert.ok(ok(await f.admin.request('driver/trips'),200).items.some(t=>t.id===other));
 const own=(await f.migration.query('SELECT a.trip_id::text id FROM safeer.trip_assignments a JOIN safeer.drivers d ON (d.company_id,d.id)=(a.company_id,a.driver_id) WHERE d.member_id=$1 AND a.replaced_at IS NULL',[s.member])).rows.map(r=>r.id);
 assert.ok(driverList.every(t=>own.includes(t.id)),'a driver sees a trip that is not assigned to them');
 assert.equal((await f.client().request('driver/trips')).status,401);
}));
