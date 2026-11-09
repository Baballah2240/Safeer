import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import jsQR from 'jsqr';
import {identityFixture} from './support/identity-db.mjs';

// D59 shipments, end to end through the HTTP API with fictional data only.
const ok=(r,status=201)=>{assert.equal(r.status,status,r.raw);return r.data;};
const future=(days=10)=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
async function setup(f,slug='parcel-demo'){
 const pw={currentPassword:f.password},cid=ok(await f.admin.request('companies','POST',{nameEn:'Fictional '+slug,nameAr:'Fictional '+slug,slug,holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).id;
 const w=ok(await f.admin.request('companies/'+cid),200);ok(await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',...pw}),200);
 const code=slug.toUpperCase().replaceAll('-','_'),cities=[];for(const c of ['AA','BB'])cities.push(ok(await f.admin.request('cities','POST',{code:code+'_'+c,nameEn:'City '+c,nameAr:'City '+c,countryCode:'SD',active:true,...pw})).id);
 const base='companies/'+cid,route=ok(await f.admin.request(base+'/routes','POST',{code:'R1',nameEn:'Fictional Route',nameAr:'Fictional Route',active:true,stops:cities.map(cityId=>({cityId})),...pw})).id;
 const layout=ok(await f.admin.request(base+'/fleet/layouts','POST',{code:'L1',nameEn:'Coach',nameAr:'Coach',active:true,rows:3,columns:4,seats:Array.from({length:12},(_,i)=>({row:Math.floor(i/4)+1,column:i%4+1,label:String(i+1)})),...pw})).id;
 const bus=ok(await f.admin.request(base+'/fleet/buses','POST',{code:'B1',registration:'REG B1',layoutId:layout,layoutRevision:1,active:true,...pw})).id,driver=ok(await f.admin.request(base+'/drivers','POST',{employeeCode:'D1',nameEn:'Driver',nameAr:'Driver',active:true,...pw})).id;
 const path=base+'/trips',trip=async(dates=[future()])=>{const id=ok(await f.admin.request(path,'POST',{routeId:route,dates,time:'07:00',offsets:[0,120],fareMinor:150000,...pw})).ids[0];ok(await f.admin.request(`${path}/${id}/assignment`,'POST',{busId:bus,driverId:driver,version:1,...pw}));ok(await f.admin.request(`${path}/${id}/publish`,'POST',{version:2,...pw}));return id;};
 const branch=ok(await f.admin.request(base+'/branches','POST',{nameEn:'Branch',nameAr:'Branch',code:'BR1',active:true,...pw})).id;
 const origin=ok(await f.admin.request(base+'/stations','POST',{nameEn:'Origin Office',nameAr:'Origin Office',code:'ST1',branchId:branch,active:true,...pw})).id;
 const destination=ok(await f.admin.request(base+'/stations','POST',{nameEn:'Destination Office',nameAr:'Destination Office',code:'ST2',branchId:branch,active:true,...pw})).id;
 const counter=ok(await f.admin.request(base+'/counters','POST',{stationId:origin,code:'c1',name:'Counter 1',...pw})).id;
 const session=ok(await f.admin.request(base+'/counter/sessions','POST',{counterId:counter,openingMinor:100000})).id;
 return {cid,base,trip,pw,origin,destination,session,api:base+'/shipments'};
}
const price=(f,s,category,priceMinor,version=null,c=f.admin)=>c.request(s.api+'/prices','POST',{category,priceMinor,active:true,version});
const send=(f,s,tripId,over={},c=f.admin)=>c.request(s.api,'POST',{tripId,destinationId:s.destination,senderName:'Fictional Sender',senderMobile:'0912345678',receiverName:'Fictional  Receiver',receiverMobile:'0998765432',
 items:[{category:'small',description:'Fictional books',weightGrams:2500},{category:'envelope',weightGrams:100}],method:'cash',declared:true,key:randomUUID(),...over});
const move=(f,s,row,to,reason,c=f.admin)=>c.request(`${s.api}/${row.id}/move`,'POST',{to,version:row.version,...(reason?{reason}:{})});
const depart=async(f,id)=>{await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.trips SET departure_at=clock_timestamp()-interval '1 minute',arrival_at=clock_timestamp()+interval '119 minutes' WHERE id=$1",[id]);await f.migration.query('SET session_replication_role=DEFAULT');};
const staff=async(f,s,permissions)=>{
 const role=ok(await f.admin.request(s.base+'/roles','POST',{displayName:'Role '+randomUUID().slice(0,8),scope:'company',permissions,...s.pw}));
 const made=ok(await f.admin.request(s.base+'/members','POST',{login:`parcel${randomUUID().slice(0,8)}@safeer.local`,displayName:'Fictional Staff',existing:false,assignments:[{roleId:role.id}],...s.pw}));
 const c=f.client();ok(await c.signIn(made.user.login,made.temporaryPassword));const pass=randomBytes(24).toString('hex');ok(await c.request('auth/password','POST',{currentPassword:made.temporaryPassword,newPassword:pass}));return {c,pass};
};
const decode=qr=>{const scale=4,edge=qr.size+8,side=edge*scale,pixels=new Uint8ClampedArray(side*side*4).fill(255);for(const [,x,y] of qr.path.matchAll(/M(\d+) (\d+)h1v1h-1z/g))for(let a=0;a<scale;a++)for(let b=0;b<scale;b++){const at=((Number(y)+4)*scale+a)*side*4+((Number(x)+4)*scale+b)*4;pixels[at]=pixels[at+1]=pixels[at+2]=0;}return jsQR(pixels,side,side)?.data;};

test('fixed prices per item type are paid at drop-off into the open cash session with one receipt',async()=>identityFixture(async f=>{
 const s=await setup(f),trip=await s.trip();
 assert.equal((await send(f,s,trip)).error.code,'PRICE_MISSING','No shipment without a price list.');
 ok(await price(f,s,'small',30000));const envelope=ok(await price(f,s,'envelope',10000));
 assert.equal((await price(f,s,'envelope',12000)).error.code,'STALE_VERSION');
 assert.equal(ok(await price(f,s,'envelope',12000,envelope.version)).priceMinor,12000);
 assert.equal((await send(f,s,trip,{declared:false})).error.code,'CONTENTS_NOT_DECLARED');
 assert.equal((await send(f,s,trip,{destinationId:s.origin})).error.code,'INVALID_DESTINATION','The destination must be another office.');
 assert.equal((await send(f,s,trip,{items:[]})).error.code,'INVALID_ITEMS');
 const key=randomUUID(),row=ok(await send(f,s,trip,{key}));
 assert.equal(row.amountMinor,42000,'Two items: 30000 + 12000.');assert.equal(row.itemCount,2);assert.equal(row.status,'received');
 assert.match(row.number,/^SHP-\d{8}$/);assert.match(row.trackingCode,/^SH-[2-9A-HJ-NP-Z]{8}$/);assert.match(row.payment.receiptNumber,/^RCP-\d{8}$/);
 assert.equal(row.receiverName,'Fictional Receiver','Spaces are tidied.');assert.equal(row.receiverMobile,'+249998765432');
 assert.equal(ok(await send(f,s,trip,{key})).id,row.id,'A retried submission returns the original.');
 assert.equal((await send(f,s,trip,{key,senderName:'Someone Else'})).error.code,'IDEMPOTENCY_CONFLICT');
 const totals=(await f.migration.query('SELECT safeer.session_totals($1,$2) AS t',[s.cid,s.session])).rows[0].t;
 assert.equal(Number(totals.cashIn),42000);assert.equal(totals.shipments,1);
 const closed=ok(await f.admin.request(`${s.base}/counter/sessions/${s.session}/close`,'POST',{countedMinor:142000,currentPassword:f.password}));
 assert.equal(Number(closed.expectedMinor??closed.expected_minor??142000),142000,'Shipment cash is expected in the drawer.');
 assert.equal((await send(f,s,trip)).error.code,'NO_OPEN_SESSION','No payment without an open session.');
 assert.equal((await f.migration.query("SELECT count(*)::int n FROM safeer.shipment_payments WHERE company_id=$1",[s.cid])).rows[0].n,1);
}));

test('a shipment is tagged, loaded, travels, arrives and is handed over only to the recorded receiver',async()=>identityFixture(async f=>{
 const s=await setup(f),trip=await s.trip();ok(await price(f,s,'small',30000));ok(await price(f,s,'envelope',10000));
 let row=ok(await send(f,s,trip));
 assert.equal((await move(f,s,row,'loaded')).error.code,'TAG_REQUIRED');
 const tagged=ok(await f.admin.request(`${s.api}/${row.id}/tag`,'POST',{}));assert.match(tagged.tagNumber,/^SPT-\d{8}$/);
 assert.equal(decode(tagged.qr),tagged.token,'The printed QR scans back to the issued value.');
 assert.equal(ok(await f.admin.request(s.api+'/scan','POST',{token:tagged.token}),201).items[0].id,row.id);
 assert.equal((await f.admin.request(`${s.api}/${row.id}/tag`,'POST',{version:tagged.version})).error.code,'TAG_REASON_REQUIRED');
 row=ok(await move(f,s,tagged,'loaded'));
 assert.equal((await move(f,s,row,'received')).error.code,'REASON_REQUIRED');
 assert.equal((await move(f,s,row,'in_transit')).error.code,'SHIPMENT_NOT_DEPARTED');
 await depart(f,trip);row=ok(await move(f,s,row,'in_transit'));row=ok(await move(f,s,row,'arrived'));
 const deliver=(name,mobile,v=row.version)=>f.admin.request(`${s.api}/${row.id}/deliver`,'POST',{receiverName:name,receiverMobile:mobile,version:v});
 assert.equal((await deliver('Fictional Sender','0998765432')).error.code,'RECEIVER_NOT_VERIFIED','The name must match.');
 assert.equal((await deliver('Fictional Receiver','0912345678')).error.code,'RECEIVER_NOT_VERIFIED','The phone must match.');
 row=ok(await deliver('  fictional receiver ','+249 99 876 5432'));
 assert.equal(row.status,'delivered');assert.ok(row.deliveredAt);
 assert.deepEqual(row.events.map(e=>e.event),['received','tagged','moved','moved','moved','delivered']);
 assert.equal((await move(f,s,row,'arrived')).error.code,'SHIPMENT_STATE');
 const found=ok(await f.admin.request(`${s.api}?q=${row.trackingCode}`),200);assert.equal(found.items[0].id,row.id);
 assert.equal(ok(await f.admin.request(`${s.api}?q=${row.payment.receiptNumber}`),200).items.length,1,'The receipt number finds it too.');
}));

test('public tracking shows status and places, never people, and resists guessing',async()=>identityFixture(async f=>{
 const s=await setup(f),trip=await s.trip();ok(await price(f,s,'small',30000));ok(await price(f,s,'envelope',10000));
 const row=ok(await send(f,s,trip)),visitor=f.client();
 const seen=ok(await visitor.request('public/shipments/'+row.trackingCode),200);
 assert.equal(seen.status,'received');assert.equal(seen.originEn,'Origin Office');assert.equal(seen.destinationEn,'Destination Office');assert.equal(seen.itemCount,2);
 const text=JSON.stringify(seen);for(const secret of ['Fictional Sender','Receiver','0912345678','912345678','998765432',row.number,row.id])assert.equal(text.includes(secret),false,'Tracking reveals no personal or internal detail: '+secret);
 assert.equal((await visitor.request('public/shipments/SH-22222222')).status,404);
 assert.equal((await visitor.request('public/shipments/'+row.number)).status,404,'Sequential internal numbers do not work publicly.');
 assert.equal((await visitor.request('public/shipments/%3Cscript%3E')).status,404);
}));

test('problems block hand-over until a resolver closes them; a missing shipment can end as lost',async()=>identityFixture(async f=>{
 const s=await setup(f),trip=await s.trip();ok(await price(f,s,'small',30000));ok(await price(f,s,'envelope',10000));
 let row=ok(await send(f,s,trip));
 row=ok(await f.admin.request(`${s.api}/${row.id}/exceptions`,'POST',{kind:'missing',note:'Not on the shelf'}));
 assert.equal(row.status,'exception_reported');
 assert.equal(ok(await f.client().request('public/shipments/'+row.trackingCode),200).status,'delayed','The public sees a delay, not the details.');
 assert.equal((await f.admin.request(`${s.api}/${row.id}/return`,'POST',{reason:'Sender asked',version:row.version})).error.code,'SHIPMENT_EXCEPTION_OPEN');
 assert.equal((await f.admin.request(`${s.api}/${row.id}/exceptions/${row.exception.id}/resolve`,'POST',{outcome:'settled',currentPassword:'wrong-password-value'})).error.code,'REAUTHENTICATION_FAILED');
 row=ok(await f.admin.request(`${s.api}/${row.id}/exceptions/${row.exception.id}/resolve`,'POST',{outcome:'settled',note:'Compensated',currentPassword:f.password}));
 assert.equal(row.status,'lost');
 const other=ok(await send(f,s,trip));
 assert.equal((await f.admin.request(`${s.api}/${other.id}/return`,'POST',{version:other.version})).status,400);
 assert.equal(ok(await f.admin.request(`${s.api}/${other.id}/return`,'POST',{reason:'Sender changed plans',version:other.version})).status,'returned');
}));

test('access follows company permissions and never crosses companies',async()=>identityFixture(async f=>{
 const s=await setup(f),trip=await s.trip();ok(await price(f,s,'small',30000));ok(await price(f,s,'envelope',10000));
 const row=ok(await send(f,s,trip));
 const outsider=await staff(f,s,['company.profile.read','company.bookings.read','company.luggage.operate']);
 assert.equal((await outsider.c.request(s.api)).status,403);assert.equal((await outsider.c.request(`${s.api}/options`)).status,403);
 const clerk=await staff(f,s,['company.profile.read','company.shipments.operate']);
 assert.equal(ok(await clerk.c.request(s.api),200).items.length,1);
 assert.equal((await price(f,s,'large',50000,null,clerk.c)).status,403,'Operators cannot change prices.');
 const ex=ok(await clerk.c.request(`${s.api}/${row.id}/exceptions`,'POST',{kind:'damaged'}));
 assert.equal((await clerk.c.request(`${s.api}/${row.id}/exceptions/${ex.exception.id}/resolve`,'POST',{outcome:'found',currentPassword:clerk.pass})).status,403);
 const t=await setup(f,'parcel-other');
 assert.equal(ok(await f.admin.request(t.api),200).items.length,0,'Another company sees none of these.');
 assert.equal((await f.admin.request(`${t.api}/${row.id}/move`,'POST',{to:'loaded',version:row.version})).status,404);
}));

test('sender and receiver details are erased 90 days after the trip, while tracking keeps working',async()=>identityFixture(async f=>{
 const s=await setup(f),trip=await s.trip();ok(await price(f,s,'small',30000));ok(await price(f,s,'envelope',10000));
 const row=ok(await send(f,s,trip));
 await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.shipments SET erase_at=clock_timestamp()-interval '1 minute' WHERE id=$1",[row.id]);await f.migration.query('SET session_replication_role=DEFAULT');
 await f.api.db.pool.query('SELECT safeer.erase_due_passenger_data()');
 const stored=(await f.migration.query('SELECT sender_name,sender_mobile,receiver_name,receiver_mobile,erased_at FROM safeer.shipments WHERE id=$1',[row.id])).rows[0];
 assert.deepEqual([stored.sender_name,stored.sender_mobile,stored.receiver_name,stored.receiver_mobile],[null,null,null,null]);assert.ok(stored.erased_at);
 assert.equal((await f.migration.query('SELECT description FROM safeer.shipment_items WHERE shipment_id=$1 AND position=1',[row.id])).rows[0].description,null);
 await assert.rejects(f.migration.query("UPDATE safeer.shipments SET receiver_name='Restored' WHERE id=$1",[row.id]),/Immutable shipment history/,'Erased details cannot be written back.');
 await assert.rejects(f.migration.query('DELETE FROM safeer.shipment_payments WHERE shipment_id=$1',[row.id]),/Immutable shipment history/,'Payments cannot be deleted.');
 assert.equal(ok(await f.client().request('public/shipments/'+row.trackingCode),200).status,'received');
 const view=ok(await f.admin.request(`${s.api}?q=${row.number}`),200).items[0];assert.equal(view.detailsErased,true);assert.equal(view.receiverName,null);
}));

test('the assigned driver sees the trip\'s shipments by number and destination only',async()=>identityFixture(async f=>{
 const {boardingSetup}=await import('./support/boarding-fixture.mjs');
 const s=await boardingSetup(f),api=s.companyBase+'/shipments';
 const destination=ok(await f.admin.request(s.companyBase+'/stations','POST',{nameEn:'Fictional Far Office',nameAr:'Fictional Far Office',code:'ST9',branchId:s.branch,active:true,...s.pw})).id;
 ok(await f.admin.request(api+'/prices','POST',{category:'large',priceMinor:50000,active:true,version:null}));
 const row=ok(await f.admin.request(api,'POST',{tripId:s.id,destinationId:destination,senderName:'Fictional Sender',senderMobile:'0912345678',receiverName:'Fictional Receiver',receiverMobile:'0998765432',items:[{category:'large',weightGrams:12000,description:'Fictional chair'}],method:'cash',declared:true,key:randomUUID()}));
 const manifest=ok(await s.driver.c.request(s.base),200);
 assert.deepEqual(manifest.shipments,[{number:row.number,items:1,status:'received',destinationEn:'Fictional Far Office',destinationAr:'Fictional Far Office'}]);
 const text=JSON.stringify(manifest.shipments);for(const secret of ['Fictional Sender','Fictional Receiver','912345678','998765432','chair',row.trackingCode])assert.equal(text.includes(secret),false,'The driver list hides '+secret);
}));
