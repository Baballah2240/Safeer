import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identityFixture} from './support/identity-db.mjs';
import {setup,staff,ok} from './support/boarding-fixture.mjs';

// D121: the Super Administrator sets one photo per city; passengers see it on popular route cards.
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=','base64');
const url=b=>'data:image/png;base64,'+b.toString('base64');

test('city photos: owner sets and removes, others are refused, passengers read active cities only',()=>identityFixture(async f=>{
 const s=await setup(f,'photo-a');await s.trip();
 const city=(await f.migration.query("SELECT id,code FROM safeer.cities WHERE code='PHOTO_A_BB'")).rows[0];
 const photo=`cities/${city.id}/photo`,pub=()=>fetch(`${f.api.origin}/api/v1/public/cities/${city.code}/photo`);
 assert.equal((await pub()).status,404);
 // Refused: no password, not an image, SVG, a PNG label on other bytes, too large, both photo and remove, unknown fields.
 for(const body of [{photo:url(png)},{photo:'hello',...s.pw},{photo:'data:image/svg+xml;base64,PHN2Zy8+',...s.pw},{photo:'data:image/png;base64,'+Buffer.from('GIF89a....').toString('base64'),...s.pw},{photo:url(Buffer.concat([png,Buffer.alloc(131072)])),...s.pw},{photo:url(png),removePhoto:true,...s.pw},{removePhoto:false,...s.pw},{photo:url(png),admin:true,...s.pw}]){
  const r=await f.admin.request(photo,'PUT',body);assert.ok(r.status>=400&&r.status<500,`${JSON.stringify(body).slice(0,60)} -> ${r.status} ${r.raw}`);
 }
 const {c:manager,pass}=await staff(f,s,['company.routes.read','company.routes.manage','company.profile.manage']);
 assert.equal((await manager.request(photo,'PUT',{photo:url(png),currentPassword:pass})).status,403,'Only the Super Administrator changes city photos.');
 assert.ok([401,403].includes((await f.client().request(photo,'PUT',{photo:url(png),...s.pw})).status));
 ok(await f.admin.request(photo,'PUT',{photo:url(png),...s.pw}),200);
 let r=await pub();assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await r.arrayBuffer()),png);
 const listed=ok(await f.client().request('public/cities'),200).items.find(c=>c.code===city.code);assert.equal(listed.photoVersion,1);
 assert.equal(ok(await manager.request('cities'),200).items.find(c=>c.id===city.id).photoVersion,1);
 ok(await f.admin.request(photo,'PUT',{photo:url(png),...s.pw}),200);assert.equal(ok(await f.client().request('public/cities'),200).items.find(c=>c.code===city.code).photoVersion,2);
 // An inactive city's photo is not public.
 const spare=ok(await f.admin.request('cities','POST',{code:'PHOTO_SPARE',nameEn:'Spare',nameAr:'Spare',countryCode:'SD',active:true,...s.pw})).id;
 ok(await f.admin.request(`cities/${spare}/photo`,'PUT',{photo:url(png),...s.pw}),200);assert.equal((await fetch(`${f.api.origin}/api/v1/public/cities/PHOTO_SPARE/photo`)).status,200);
 ok(await f.admin.request(`cities/${spare}`,'PATCH',{code:'PHOTO_SPARE',nameEn:'Spare',nameAr:'Spare',countryCode:'SD',active:false,version:1,...s.pw}),200);
 assert.equal((await fetch(`${f.api.origin}/api/v1/public/cities/PHOTO_SPARE/photo`)).status,404);
 ok(await f.admin.request(photo,'PUT',{removePhoto:true,...s.pw}),200);assert.equal((await pub()).status,404);
 for(const code of ['..%2f','a','X'.repeat(41),"X' OR '1'='1"])assert.equal((await fetch(`${f.api.origin}/api/v1/public/cities/${code}/photo`)).status,404);
 const audit=(await f.migration.query("SELECT action FROM safeer.identity_audit WHERE target_id=$1 AND action LIKE 'catalog.city.photo%' ORDER BY occurred_at",[city.id])).rows.map(x=>x.action);
 assert.deepEqual(audit,['catalog.city.photo_set','catalog.city.photo_set','catalog.city.photo_removed']);
 // The runtime role cannot bypass the API: a company manager's session cannot write the table directly.
 assert.equal((await f.migration.query("SELECT has_function_privilege('public','safeer.public_city_photo(text)','EXECUTE') AS p")).rows[0].p,false);
}));
