import jsQR from 'jsqr';
﻿import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';
import {setup,ok} from './support/boarding-fixture.mjs';

test('passenger itinerary is proof-checked; real QR is paid/device-only and revoked on refund/cancellation',()=>identityFixture(async f=>{
  const decode=qr=>{const scale=5,side=(qr.size+8)*scale,pixels=new Uint8ClampedArray(side*side*4).fill(255);for(const [,x,y]of qr.path.matchAll(/M(\d+) (\d+)h1v1h-1z/g))for(let a=0;a<scale;a++)for(let b=0;b<scale;b++){const at=((Number(y)+4)*scale+a)*side*4+((Number(x)+4)*scale+b)*4;pixels[at]=pixels[at+1]=pixels[at+2]=0;}return jsQR(pixels,side,side)?.data;};
 const s=await setup(f,'passenger-proof'),id=await s.trip(),key=randomUUID(),b=ok(await f.client().request('public/holds','POST',{tripId:id,seats:['1'],key,mobile:'0912345678',travelers:[{seat:'1',name:'Fictional Proof Traveler'}]}));
 assert.ok(b.departureAt&&b.arrivalAt&&b.timezone);assert.equal(b.fromNameEn,'City AA');assert.equal(b.toNameEn,'City BB');assert.equal(b.stops.length,2);assert.equal(b.tickets.length,0,'An unpaid reservation has no ticket QR');
 const read=()=>f.client().request('public/holds/'+b.reference,'GET',undefined,{'X-Booking-Key':key});
 assert.equal((await f.client().request('public/holds/'+b.reference,'GET',undefined,{'X-Booking-Key':randomUUID()})).status,404);
 assert.equal((await f.client().request('public/holds/lookup','POST',{reference:b.reference,mobile:'0999999999'})).status,404);
 const bid=(await f.migration.query('SELECT id FROM safeer.bookings WHERE reference=$1',[b.reference])).rows[0].id;
 ok(await f.admin.request(s.base+'/bookings/'+bid+'/pay','POST',{method:'cash',key:randomUUID()}));
 const paid=ok(await read(),200);assert.equal(paid.status,'confirmed');assert.ok(paid.tickets[0].qr?.path);const printed=ok(await f.admin.request(s.base+'/bookings/'+bid+'/print','POST',{document:'tickets'}));assert.equal(decode(paid.tickets[0].qr),printed.codes[0].token,'An independent decoder reads the existing actual ticket credential');assert.equal(paid.tickets[0].qrToken,undefined,'Raw tokens are never copied into API properties');
 const recovered=ok(await f.client().request('public/holds/lookup','POST',{reference:b.reference,mobile:'0912345678'}));assert.equal(recovered.retrieved,true);assert.notEqual(recovered.travelers[0].name,'Fictional Proof Traveler');assert.equal(recovered.tickets[0].qr,undefined,'Reference/mobile does not grant QR access');assert.equal(recovered.tickets[0].qrToken,undefined);assert.ok(recovered.departureAt);
 const direct=await f.api.db.pool.query('SELECT safeer.passenger_booking($1,NULL,NULL) AS row',[b.reference]);assert.equal(direct.rows[0].row,null);
 await assert.rejects(f.api.db.pool.query('SELECT * FROM safeer.ticket_credentials'),/permission denied/);
 ok(await f.admin.request(s.base+'/bookings/'+bid+'/refund','POST',{key:randomUUID(),reason:'Fictional test refund',currentPassword:f.password}));assert.equal(ok(await read(),200).tickets[0].qr,undefined,'A refund removes QR presentation');
 const otherKey=randomUUID(),other=ok(await f.client().request('public/holds','POST',{tripId:id,seats:['2'],key:otherKey,mobile:'0922222222',travelers:[{seat:'2',name:'Fictional Cancelled'}]}));const otherId=(await f.migration.query('SELECT id FROM safeer.bookings WHERE reference=$1',[other.reference])).rows[0].id;ok(await f.admin.request(s.base+'/bookings/'+otherId+'/pay','POST',{method:'cash',key:randomUUID()}));const trip=ok(await f.admin.request(s.path+'/'+id),200).trip;ok(await f.admin.request(s.path+'/'+id+'/cancel','POST',{version:trip.version,reason:'Fictional cancellation',...s.pw}));const cancelled=ok(await f.client().request('public/holds/'+other.reference,'GET',undefined,{'X-Booking-Key':otherKey}),200);assert.equal(cancelled.tripCanceled,true);assert.equal(cancelled.tickets[0].qr,undefined);assert.equal(cancelled.fromNameEn,'City AA','Historical/cancelled snapshots remain available to their booking owner');
}));
