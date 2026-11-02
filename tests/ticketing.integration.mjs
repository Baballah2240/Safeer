import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';

const ok=(r,status=201)=>{assert.equal(r.status,status,r.raw);return r.data;};
const future=(days=10)=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
async function setup(f,slug='till-demo'){
 const pw={currentPassword:f.password},cid=ok(await f.admin.request('companies','POST',{nameEn:'Fictional '+slug,nameAr:'Fictional '+slug,slug,holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).id;
 const w=ok(await f.admin.request('companies/'+cid),200);ok(await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',...pw}),200);
 const code=slug.toUpperCase().replaceAll('-','_'),cities=[];for(const c of ['AA','BB'])cities.push(ok(await f.admin.request('cities','POST',{code:code+'_'+c,nameEn:'City '+c,nameAr:'City '+c,countryCode:'SD',active:true,...pw})).id);
 const base='companies/'+cid,route=ok(await f.admin.request(base+'/routes','POST',{code:'R1',nameEn:'Fictional Route',nameAr:'Fictional Route',active:true,stops:cities.map(cityId=>({cityId})),...pw})).id;
 const layout=ok(await f.admin.request(base+'/fleet/layouts','POST',{code:'L1',nameEn:'Coach',nameAr:'Coach',active:true,rows:3,columns:4,seats:Array.from({length:12},(_,i)=>({row:Math.floor(i/4)+1,column:i%4+1,label:String(i+1)})),...pw})).id;
 const bus=ok(await f.admin.request(base+'/fleet/buses','POST',{code:'B1',registration:'REG B1',layoutId:layout,layoutRevision:1,active:true,...pw})).id,driver=ok(await f.admin.request(base+'/drivers','POST',{employeeCode:'D1',nameEn:'Driver',nameAr:'Driver',active:true,...pw})).id;
 const path=base+'/trips',trip=async(dates=[future()])=>{const id=ok(await f.admin.request(path,'POST',{routeId:route,dates,time:'07:00',offsets:[0,120],fareMinor:150000,...pw})).ids[0];ok(await f.admin.request(`${path}/${id}/assignment`,'POST',{busId:bus,driverId:driver,version:1,...pw}));ok(await f.admin.request(`${path}/${id}/publish`,'POST',{version:2,...pw}));return id;};
 ok(await f.admin.request(base+'/public-profile','PUT',{listed:true,aboutEn:'',aboutAr:'',version:0,...pw}),200);
 const branch=ok(await f.admin.request(base+'/branches','POST',{nameEn:'Branch',nameAr:'Branch',code:'BR1',active:true,...pw})).id;
 const station=ok(await f.admin.request(base+'/stations','POST',{nameEn:'Station',nameAr:'Station',code:'ST1',branchId:branch,active:true,...pw})).id,station2=ok(await f.admin.request(base+'/stations','POST',{nameEn:'Station Two',nameAr:'Station Two',code:'ST2',branchId:branch,active:true,...pw})).id;
 const counter=ok(await f.admin.request(base+'/counters','POST',{stationId:station,code:'c1',name:'Counter 1',...pw})).id,counter2=ok(await f.admin.request(base+'/counters','POST',{stationId:station2,code:'c2',name:'Counter 2',...pw})).id;
 return {cid,base,w:ok(await f.admin.request('companies/'+cid),200),trip,pw,path,branch,station,station2,counter,counter2,bus,driver};
}
const book=(f,tripId,seats,key=randomUUID())=>f.client().request('public/holds','POST',{tripId,seats,key,mobile:'0912345678',travelers:seats.map(seat=>({seat,name:'Fictional Traveler '+seat}))});
const open=(f,s,c=f.admin,counterId=s.counter,openingMinor=100000)=>c.request(s.base+'/counter/sessions','POST',{counterId,openingMinor});
const bookingId=async(f,reference)=>(await f.migration.query('SELECT id FROM safeer.bookings WHERE reference=$1',[reference])).rows[0].id;
const pay=(f,s,bid,over={},c=f.admin)=>c.request(`${s.base}/bookings/${bid}/pay`,'POST',{method:'cash',key:randomUUID(),...over});
const refund=(f,s,bid,over={},c=f.admin)=>c.request(`${s.base}/bookings/${bid}/refund`,'POST',{reason:'Fictional change of plans',key:randomUUID(),currentPassword:f.password,...over});
const view=(f,s,bid)=>f.admin.request(`${s.base}/bookings/${bid}`);
const seatsLeft=async(f,id)=>ok(await f.client().request('public/trips/'+id),200).seatsLeft;
const age=async(f,reference)=>{await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.bookings SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 minute' WHERE reference=$1",[reference]);await f.migration.query("UPDATE safeer.seat_allocations a SET expires_at=clock_timestamp()-interval '1 minute' FROM safeer.bookings b WHERE b.id=a.booking_id AND b.reference=$1",[reference]);await f.migration.query('SET session_replication_role=DEFAULT');};
const staff=async(f,s,permissions,assign={},scope='company')=>{
 const role=ok(await f.admin.request(s.base+'/roles','POST',{displayName:'Role '+randomUUID().slice(0,8),scope,permissions,...s.pw}));
 const made=ok(await f.admin.request(s.base+'/members','POST',{login:`staff${randomUUID().slice(0,8)}@safeer.local`,displayName:'Fictional Staff',existing:false,assignments:[{roleId:role.id,...assign}],...s.pw}));
 const c=f.client();ok(await c.signIn(made.user.login,made.temporaryPassword));const pass=randomBytes(24).toString('hex');ok(await c.request('auth/password','POST',{currentPassword:made.temporaryPassword,newPassword:pass}));return {c,pass};
};
const count=async(f,table)=>(await f.migration.query(`SELECT count(*)::int AS n FROM safeer.${table}`)).rows[0].n;

test('a payment confirms the seats and issues tickets and a receipt, all at once',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip(),key=randomUUID(),a=ok(await book(f,id,['1','2'],key)),bid=await bookingId(f,a.reference);
 assert.equal((await pay(f,s,bid)).error.code,'NO_OPEN_SESSION','No payment without an open session.');
 const session=ok(await open(f,s));assert.equal(session.openingMinor,100000);assert.equal(session.totals.cashIn,0);
 const paid=await pay(f,s,bid);ok(paid);
 const row=ok(await view(f,s,bid),200);assert.equal(row.status,'confirmed');assert.equal(row.payment.amountMinor,300000,'The amount comes from the booking, not the request.');assert.equal(row.payment.method,'cash');assert.match(row.payment.receiptNumber,/^RCP-0{7}1$/);
 assert.deepEqual(row.tickets.map(t=>[t.seat,t.number,t.status]),[['1','TKT-00000001','valid'],['2','TKT-00000002','valid']]);assert.deepEqual(row.events.map(e=>e.event),['held','paid']);
 const passenger=ok(await f.client().request('public/holds/'+a.reference,'GET',undefined,{'X-Booking-Key':key}),200);assert.equal(passenger.status,'confirmed');assert.equal(passenger.tickets.length,2);assert.equal(JSON.stringify(passenger).includes('receiptNumber'),false,'Passengers do not see how the money moved.');
 assert.equal(await seatsLeft(f,id),10,'Paid seats stay taken.');
 // A paid hold never lapses: the job and a passenger release leave it alone.
 await age(f,a.reference);assert.equal((await f.api.db.pool.query('SELECT safeer.expire_due_holds() AS n')).rows[0].n,0);assert.equal(await seatsLeft(f,id),10);
 assert.equal(ok(await f.client().request(`public/holds/${a.reference}/release`,'POST',{key})).status,'confirmed');assert.equal(await seatsLeft(f,id),10);
 // Non-cash and bad payments.
 const b=ok(await book(f,id,['3'])),bb=await bookingId(f,b.reference);
 assert.equal((await pay(f,s,bb,{method:'bank_transfer',reference:'TX-1'})).error.code,'METHOD_DISABLED','Only cash until the company enables others.');
 for(const over of [{method:'bitcoin'},{amountMinor:1},{key:'nope'}])assert.equal((await pay(f,s,bb,over)).status,400,JSON.stringify(over));
 ok(await f.admin.request(s.base+'/payment-settings','PUT',{bankTransfer:true,mobileWallet:false,version:0,...s.pw}),200);
 assert.equal((await pay(f,s,bb,{method:'bank_transfer'})).error.code,'REFERENCE_REQUIRED');assert.equal((await pay(f,s,bb,{method:'mobile_wallet',reference:'W-1'})).error.code,'METHOD_DISABLED');
 const before=[await count(f,'payments'),await count(f,'tickets'),await count(f,'receipts')];assert.deepEqual(before,[1,2,1],'Refused payments create nothing.');
 ok(await pay(f,s,bb,{method:'bank_transfer',reference:'TX-1'}));
 assert.equal((await pay(f,s,bb)).error.code,'ALREADY_PAID');assert.equal((await pay(f,s,randomUUID())).status,404);
 const totals=ok(await f.admin.request(s.base+'/counter'),200).session.totals;assert.equal(totals.cashIn,300000);assert.equal(totals.otherIn,150000,'Transfers do not count as cash.');
 assert.equal(await count(f,'company_audit')>0,true);
 // A released hold cannot be paid.
 const key3=randomUUID(),c=ok(await book(f,id,['4'],key3)),cb=await bookingId(f,c.reference);ok(await f.client().request(`public/holds/${c.reference}/release`,'POST',{key:key3}));assert.equal((await pay(f,s,cb)).error.code,'HOLD_CLOSED');
}));

test('repeating a payment or refund key records money once, even at the same moment',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip(),a=ok(await book(f,id,['1'])),bid=await bookingId(f,a.reference);ok(await open(f,s));
 const key=randomUUID(),both=await Promise.all(Array.from({length:8},()=>pay(f,s,bid,{key})));
 assert.ok(both.every(r=>r.status===201),both.map(r=>r.status).join());assert.deepEqual([await count(f,'payments'),await count(f,'tickets'),await count(f,'receipts')],[1,1,1]);
 assert.equal((await pay(f,s,bid,{key,method:'bank_transfer',reference:'X'})).error.code,'IDEMPOTENCY_CONFLICT','A key cannot be reused for a different payment.');
 const racers=await Promise.all(Array.from({length:6},()=>pay(f,s,bid)));assert.ok(racers.every(r=>r.status===409));assert.equal(await count(f,'payments'),1,'Different keys cannot pay twice.');
 assert.equal(ok(await f.admin.request(s.base+'/counter'),200).session.totals.cashIn,150000);
 const refundKey=randomUUID(),twice=await Promise.all(Array.from({length:2},()=>refund(f,s,bid,{key:refundKey})));assert.ok(twice.every(r=>r.status===201),twice.map(r=>r.raw).join());assert.equal(await count(f,'refunds'),1);
 assert.equal((await refund(f,s,bid)).error.code,'ALREADY_REFUNDED');assert.equal(ok(await f.admin.request(s.base+'/counter'),200).session.totals.cashOut,150000);
}));

test('refunds are full, until departure, or any time on a canceled trip, and free the seats',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip(),key=randomUUID(),a=ok(await book(f,id,['1','2'],key)),bid=await bookingId(f,a.reference);ok(await open(f,s));
 assert.equal((await refund(f,s,bid)).error.code,'NOT_PAID');ok(await pay(f,s,bid));assert.equal(await seatsLeft(f,id),10);
 assert.equal((await refund(f,s,bid,{currentPassword:'wrong-password-value'})).status>=400,true);assert.equal((await refund(f,s,bid,{reason:''})).status,400);
 assert.equal((await f.admin.request(`${s.base}/bookings/${bid}/refund`,'POST',{reason:'x',key:randomUUID(),amountMinor:5,...s.pw})).status,400,'There are no partial refunds.');
 ok(await refund(f,s,bid));
 const row=ok(await view(f,s,bid),200);assert.equal(row.status,'refunded');assert.equal(row.refund.amountMinor,300000);assert.match(row.refund.number,/^RFD-0{7}1$/);assert.equal(row.refund.reason,'Fictional change of plans');assert.deepEqual(row.tickets.map(t=>t.status),['refunded','refunded']);assert.equal(row.refundable,false);
 assert.equal(await seatsLeft(f,id),12,'Refunded seats go back on sale.');ok(await book(f,id,['1']));
 assert.equal(ok(await f.client().request('public/holds/'+a.reference,'GET',undefined,{'X-Booking-Key':key}),200).status,'refunded');
 // After departure there is no refund.
 const b=ok(await book(f,id,['3'])),bb=await bookingId(f,b.reference);ok(await pay(f,s,bb));
 await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.trips SET departure_at=clock_timestamp()-interval '1 minute',arrival_at=clock_timestamp()+interval '119 minutes' WHERE id=$1",[id]);await f.migration.query('SET session_replication_role=DEFAULT');
 assert.equal((await refund(f,s,bb)).error.code,'REFUND_CLOSED');assert.equal(ok(await view(f,s,bb),200).refundable,false);
 const late=ok(await book(f,await s.trip([future(11)]),['1'])),lb=await bookingId(f,late.reference);
 await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.trips SET departure_at=clock_timestamp()-interval '1 minute',arrival_at=clock_timestamp()+interval '119 minutes' WHERE id=(SELECT trip_id FROM safeer.bookings WHERE id=$1)",[lb]);await f.migration.query('SET session_replication_role=DEFAULT');
 assert.equal((await pay(f,s,lb)).error.code,'TRIP_NOT_BOOKABLE','A departed trip cannot be paid for.');
 // A canceled trip keeps paid tickets refundable, even after its departure time.
 const other=await s.trip([future(12)]),c=ok(await book(f,other,['1'])),cb=await bookingId(f,c.reference);ok(await pay(f,s,cb));
 ok(await f.admin.request(`${s.path}/${other}/cancel`,'POST',{reason:'Fictional closure',version:3,...s.pw}));
 const canceled=ok(await view(f,s,cb),200);assert.equal(canceled.status,'confirmed','Canceling the trip does not silently move money.');assert.equal(canceled.tripCanceled,true);assert.equal(canceled.refundable,true);
 await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.trips SET departure_at=clock_timestamp()-interval '3 days',arrival_at=clock_timestamp()-interval '3 days'+interval '120 minutes' WHERE id=$1",[other]);await f.migration.query('SET session_replication_role=DEFAULT');
 ok(await refund(f,s,cb));assert.equal(ok(await view(f,s,cb),200).status,'refunded');
 // Non-cash refunds need their own reference and leave the drawer alone.
 ok(await f.admin.request(s.base+'/payment-settings','PUT',{bankTransfer:false,mobileWallet:true,version:0,...s.pw}),200);
 const t4=await s.trip([future(13)]),d=ok(await book(f,t4,['1'])),db=await bookingId(f,d.reference);ok(await pay(f,s,db,{method:'mobile_wallet',reference:'W-9'}));
 const cashOutBefore=ok(await f.admin.request(s.base+'/counter'),200).session.totals.cashOut;
 assert.equal((await refund(f,s,db)).error.code,'REFERENCE_REQUIRED');ok(await refund(f,s,db,{reference:'W-REV-9'}));assert.equal(ok(await view(f,s,db),200).refund.method,'mobile_wallet');assert.equal(ok(await f.admin.request(s.base+'/counter'),200).session.cashOut,undefined);assert.equal(ok(await f.admin.request(s.base+'/counter'),200).session.totals.cashOut,cashOutBefore);
}));

test('late payment needs its own permission, a reason and seats that are still free',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip(),key=randomUUID(),a=ok(await book(f,id,['1','2'],key)),bid=await bookingId(f,a.reference);await age(f,a.reference);
 const seller=await staff(f,s,['company.profile.read','company.ticketing.operate','company.bookings.read']);ok(await open(f,s,seller.c));
 assert.equal((await pay(f,s,bid,{lateReason:'Fictional'},seller.c)).error.code,'HOLD_ENDED','Ordinary staff cannot take late payment.');
 ok(await open(f,s,f.admin,s.counter2));
 assert.equal((await pay(f,s,bid)).error.code,'LATE_REASON_REQUIRED');
 const rival=ok(await book(f,id,['2'])),paid=await pay(f,s,bid,{lateReason:'Fictional bus delay'});assert.equal(paid.error.code,'SEATS_UNAVAILABLE','Someone else now holds a seat.');
 assert.equal(await count(f,'payments'),0);const rb=await bookingId(f,rival.reference);ok(await f.admin.request(`${s.base}/trips/${id}/holds/${rb}/release`,'POST',{reason:'Fictional',...s.pw}));
 ok(await pay(f,s,bid,{lateReason:'Fictional bus delay'}));
 const row=ok(await view(f,s,bid),200);assert.equal(row.status,'confirmed');assert.equal(row.payment.late,true);assert.equal(row.payment.lateReason,'Fictional bus delay');assert.deepEqual(row.events.map(e=>e.event),['held','expired','paid']);assert.equal(await seatsLeft(f,id),10);
 assert.equal((await f.migration.query("SELECT count(*)::int AS n FROM safeer.company_audit WHERE action='payment.recorded_late'")).rows[0].n,1);
 // A paid seat cannot be taken, by the application or the database.
 assert.equal((await book(f,id,['1'])).error.code,'SEATS_UNAVAILABLE');
 const row1=(await f.migration.query("SELECT * FROM safeer.seat_allocations WHERE booking_id=$1 AND label='1'",[bid])).rows[0],other=ok(await book(f,id,['5'])),ob=await bookingId(f,other.reference);
 await assert.rejects(f.migration.query('INSERT INTO safeer.seat_allocations(id,company_id,trip_id,booking_id,layout_id,layout_revision,row_number,column_number,label,segment,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::int4range,$11)',[randomUUID(),row1.company_id,row1.trip_id,ob,row1.layout_id,row1.layout_revision,row1.row_number,row1.column_number,row1.label,'[0,1)',row1.expires_at]),e=>e.code==='23P01');
 // A seat map cannot change under paid seats, and a late payment cannot land on a changed map.
 const fresh=await s.trip([future(11)]),layout=ok(await f.admin.request(s.base+'/fleet/layouts','POST',{code:'L2',nameEn:'Small',nameAr:'Small',active:true,rows:1,columns:2,seats:[{row:1,column:1,label:'A'},{row:1,column:2,label:'B'}],...s.pw})).id,bus2=ok(await f.admin.request(s.base+'/fleet/buses','POST',{code:'B2',registration:'REG B2',layoutId:layout,layoutRevision:1,active:true,...s.pw})).id;
 const held=ok(await book(f,fresh,['1'])),hb=await bookingId(f,held.reference);ok(await pay(f,s,hb));
 assert.equal((await f.admin.request(`${s.path}/${fresh}/assignment`,'POST',{busId:bus2,driverId:s.driver,reason:'Fictional',version:3,...s.pw})).error.code,'SEATS_HELD');
 const t3=await s.trip([future(12)]),h3=ok(await book(f,t3,['1'])),b3=await bookingId(f,h3.reference);await age(f,h3.reference);ok(await f.admin.request(`${s.path}/${t3}/assignment`,'POST',{busId:bus2,driverId:s.driver,reason:'Fictional',version:3,...s.pw}));
 assert.equal((await pay(f,s,b3,{lateReason:'Fictional'})).error.code,'SEATS_UNAVAILABLE');
}));

test('sessions tie money to a person and counter, and closing keeps any difference',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip();
 const station=await staff(f,s,['company.profile.read','company.ticketing.operate','company.bookings.read'],{branchId:s.branch,stationId:s.station},'station');
 assert.equal(ok(await station.c.request(s.base+'/counter'),200).counters.map(c=>c.id).join(),s.counter,'Scoped staff see only their own counters.');
 assert.equal((await open(f,s,station.c,s.counter2)).status,403,'Another station is refused.');
 const mine=ok(await open(f,s,station.c));assert.equal((await open(f,s,station.c)).error.code,'SESSION_OPEN','One session per person.');assert.equal((await open(f,s,f.admin)).error.code,'SESSION_OPEN','One session per counter.');
 assert.equal((await f.admin.request(`${s.base}/counters/${s.counter}`,'PATCH',{code:'C1',name:'Counter 1',active:false,version:1,...s.pw})).error.code,'COUNTER_BUSY');
 // A second concurrent open cannot slip through.
 const openers=await Promise.all([1,2,3,4].map(()=>open(f,s,f.admin,s.counter2)));assert.equal(openers.filter(r=>r.status===201).length,1,openers.map(r=>r.status).join());
 const a=ok(await book(f,id,['1'])),bid=await bookingId(f,a.reference);ok(await pay(f,s,bid,{},station.c));assert.equal(ok(await view(f,s,bid),200).payment.sessionId,mine.id);
 const close=(c,sid,over={},pass=f.password)=>c.request(`${s.base}/counter/sessions/${sid}/close`,'POST',{countedMinor:250000,currentPassword:pass,...over});
 assert.equal((await close(station.c,mine.id,{countedMinor:249000},station.pass)).error.code,'NOTE_REQUIRED','A difference needs an explanation.');
 const plain=await staff(f,s,['company.profile.read','company.ticketing.operate'],{branchId:s.branch,stationId:s.station2},'station');assert.equal((await close(plain.c,mine.id,{},plain.pass)).status,403,'Someone else\'s session cannot be closed.');
 const done=ok(await close(station.c,mine.id,{countedMinor:249000,note:'Fictional short'},station.pass));assert.equal(done.expectedMinor,250000);assert.equal(done.countedMinor,249000,'The difference stays on record.');assert.equal(done.closeNote,'Fictional short');
 assert.equal((await close(station.c,mine.id,{},station.pass)).error.code,'SESSION_CLOSED');assert.equal((await pay(f,s,bid,{},station.c)).error.code,'NO_OPEN_SESSION');
 assert.ok(ok(await f.admin.request(s.base+'/counter'),200).sessions.some(x=>x.id===mine.id),'Managers see sessions.');assert.equal(ok(await station.c.request(s.base+'/counter'),200).sessions.length,0,'Ordinary staff do not.');
 // A manager can close a session left open.
 const left=ok(await open(f,s,station.c));ok(await close(f.admin,left.id,{countedMinor:100000}));
 // Another company's records stay out of reach.
 const rival=await setup(f,'till-rival');assert.equal((await f.admin.request(`${rival.base}/counters/${s.counter}`,'PATCH',{code:'X',name:'X',active:true,version:1,...rival.pw})).status,404);assert.equal((await close(f.admin,left.id,{countedMinor:1})).status,409);assert.equal((await f.admin.request(`${rival.base}/counter/sessions/${left.id}/close`,'POST',{countedMinor:1,...rival.pw})).status,404);
 assert.equal((await pay(f,rival,bid)).status===404||(await pay(f,rival,bid)).error.code==='NO_OPEN_SESSION',true);
}));

test('a walk-in sale holds and pays together, or leaves nothing behind',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip(),sale=(over={})=>f.admin.request(s.base+'/counter/sales','POST',{tripId:id,seats:['1','2'],mobile:'0912345678',travelers:[{seat:'1',name:'Fictional Walker'},{seat:'2',name:'Fictional Child'}],method:'cash',key:randomUUID(),...over});
 assert.equal((await sale()).error.code,'NO_OPEN_SESSION');assert.equal(await count(f,'bookings'),0);ok(await open(f,s));
 assert.equal((await sale({method:'bank_transfer',reference:'X'})).error.code,'METHOD_DISABLED');assert.equal(await count(f,'bookings'),0,'A refused payment takes no seats.');assert.equal(await seatsLeft(f,id),12);
 const key=randomUUID(),made=ok(await sale({key}));assert.match(made.reference,/^SF-/);assert.equal(ok(await sale({key})).reference,made.reference,'A retry returns the same sale.');assert.equal(await count(f,'bookings'),1);assert.equal(await count(f,'payments'),1);
 assert.equal((await sale({key,mobile:'0999999999'})).error.code,'IDEMPOTENCY_CONFLICT');
 const row=ok(await view(f,s,made.id),200);assert.equal(row.status,'confirmed');assert.equal(row.travelers[0].name,'Fictional Walker');assert.equal(row.tickets.length,2);assert.equal(await seatsLeft(f,id),10);
 assert.equal((await sale()).error.code,'SEATS_UNAVAILABLE');
 const map=ok(await f.admin.request(`${s.base}/counter/trips/${id}`),200);assert.equal(map.seats.find(x=>x.label==='1').available,false);assert.equal(JSON.stringify(map).includes('Fictional Walker'),false);
 // Unlisted companies still sell at their own counter, and the passenger can reopen the booking.
 const w=ok(await f.admin.request(s.base+'/public-profile'),200);ok(await f.admin.request(s.base+'/public-profile','PUT',{...w,listed:false,...s.pw}),200);
 ok(await sale({seats:['3'],travelers:[{seat:'3',name:'Fictional Third'}]}));assert.equal((await f.client().request('public/trips/'+id)).status,404);
 assert.equal(ok(await f.client().request('public/holds/lookup','POST',{reference:made.reference,mobile:'0912345678'})).status,'confirmed');
}));

test('copies are marked, and refunded bookings print no valid ticket',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip(),a=ok(await book(f,id,['1'])),bid=await bookingId(f,a.reference),print=document=>f.admin.request(`${s.base}/bookings/${bid}/print`,'POST',{document});ok(await open(f,s));
 assert.equal((await print('receipt')).error.code,'NOT_PAID','Nothing prints before payment.');assert.equal((await print('tickets')).error.code,'NOT_PAID');ok(await pay(f,s,bid));
 assert.equal(ok(await print('receipt')).copy,false,'The first print is the original.');assert.equal(ok(await print('receipt')).copy,true);assert.equal(ok(await print('tickets')).copy,false);
 assert.equal(ok(await view(f,s,bid),200).payment.prints,2);assert.equal((await print('refund')).error.code,'NOT_PAID');assert.equal((await print('nonsense')).status,400);
 ok(await refund(f,s,bid));assert.equal((await print('tickets')).error.code,'ALREADY_REFUNDED');assert.equal(ok(await print('refund')).copy,false);assert.equal(ok(await print('receipt')).copy,true,'The receipt stays available.');
 assert.equal((await f.admin.request(`${s.base}/bookings/${randomUUID()}/print`,'POST',{document:'receipt'})).status,404);
}));

test('money records are permanent, permissions hold and erasure keeps the finances',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip(),a=ok(await book(f,id,['1','2'])),bid=await bookingId(f,a.reference);ok(await open(f,s));
 const none=await staff(f,s,['company.profile.read','company.bookings.read']);
 assert.equal((await pay(f,s,bid,{},none.c)).status,403);assert.equal((await open(f,s,none.c)).status,403);assert.equal((await refund(f,s,bid,{currentPassword:none.pass},none.c)).status,403);assert.equal((await none.c.request(s.base+'/counter')).status,403);
 assert.equal((await f.client().request(s.base+'/counter')).status,401);assert.equal((await f.client().request(`${s.base}/bookings/${bid}/pay`,'POST',{method:'cash',key:randomUUID()})).status,401);
 const profile=await staff(f,s,['company.profile.read','company.ticketing.operate']);assert.equal((await profile.c.request(s.base+'/payment-settings','PUT',{bankTransfer:true,mobileWallet:true,version:0,currentPassword:profile.pass})).status,403);assert.equal((await profile.c.request(s.base+'/counters','POST',{stationId:s.station,code:'NO',name:'No',currentPassword:profile.pass})).status,403);
 ok(await pay(f,s,bid));ok(await refund(f,s,bid,{reason:'Asked by Fictional Traveler'}));
 for(const table of ['payments','receipts','tickets','refunds','cash_sessions','station_counters','document_sequences','company_payment_settings','document_prints'])await assert.rejects(f.api.db.pool.query(`SELECT * FROM safeer.${table}`),e=>e.code==='42501',table);
 for(const call of ["SELECT safeer.next_document(gen_random_uuid(),'ticket','T')","SELECT safeer.hold_seats(gen_random_uuid(),ARRAY['1'],gen_random_uuid(),'SF-ABCD2345',repeat('a',64),repeat('b',64),false,NULL)","SELECT safeer.session_totals(gen_random_uuid(),gen_random_uuid())"])await assert.rejects(f.api.db.pool.query(call),e=>e.code==='42501',call);
 await assert.rejects(f.api.db.pool.query('SELECT safeer.counter_overview($1)',[s.cid]),e=>e.code==='42501','Without a session, station functions refuse.');
 for(const sql of ['UPDATE safeer.payments SET amount_minor=1','DELETE FROM safeer.payments','UPDATE safeer.receipts SET receipt_number=$$X$$','DELETE FROM safeer.tickets',"UPDATE safeer.tickets SET status='valid'",'UPDATE safeer.refunds SET amount_minor=1','DELETE FROM safeer.refunds','DELETE FROM safeer.cash_sessions',"UPDATE safeer.bookings SET status='held'","UPDATE safeer.seat_allocations SET status='confirmed'"])await assert.rejects(f.migration.query(sql),e=>e.code==='42501',sql);
 await assert.rejects(f.migration.query("UPDATE safeer.cash_sessions SET opening_minor=0"),e=>e.code==='42501','Even an open session cannot be rewritten.');
 // After 90 days the names and staff reasons go. The money stays.
 await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.booking_contacts SET erase_at=clock_timestamp()-interval '1 minute'");await f.migration.query('SET session_replication_role=DEFAULT');
 assert.equal((await f.api.db.pool.query('SELECT safeer.erase_due_passenger_data() AS n')).rows[0].n,1);
 const row=ok(await view(f,s,bid),200);assert.equal(row.detailsErased,true);assert.equal(row.payment.amountMinor,300000);assert.equal(row.refund.amountMinor,300000);assert.equal(row.tickets.length,2);assert.equal(row.refund.reason,null);assert.equal(JSON.stringify(row).includes('Fictional Traveler'),false);
}));

test('review findings: station staff search only, finished trips stay closed, and history and notes are honest',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip(),a=ok(await book(f,id,['1'])),bid=await bookingId(f,a.reference);ok(await open(f,s));
 // Station staff find a booking by reference or number, never a list or a seat map full of passengers.
 const scoped=await staff(f,s,['company.profile.read','company.bookings.read','company.ticketing.operate'],{branchId:s.branch,stationId:s.station},'station');
 const blank=ok(await scoped.c.request(s.base+'/bookings'),200);assert.equal(blank.searchOnly,true);assert.equal(blank.items.length,0);
 assert.equal(ok(await scoped.c.request(s.base+'/bookings?q='+a.reference),200).items.length,1);assert.equal(ok(await scoped.c.request(s.base+'/bookings?q=Fictional'),200).items.length,0);
 assert.equal((await scoped.c.request(`${s.path}/${id}/seats`)).status,403);assert.equal(ok(await f.admin.request(s.base+'/bookings'),200).searchOnly,false);
 // Only ticketing staff use up the original print.
 ok(await pay(f,s,bid));const viewer=await staff(f,s,['company.profile.read','company.bookings.read']);
 assert.equal((await viewer.c.request(`${s.base}/bookings/${bid}/print`,'POST',{document:'tickets'})).status,403);
 assert.equal(ok(await f.admin.request(`${s.base}/bookings/${bid}/print`,'POST',{document:'tickets'})).copy,false);
 // A walk-in's history names staff, and a retry after the session closed still returns the sale.
 const walk={tripId:id,seats:['2'],mobile:'0912345678',travelers:[{seat:'2',name:'Fictional Walk In'}],method:'cash',key:randomUUID()},sold=ok(await f.admin.request(s.base+'/counter/sales','POST',walk));
 assert.equal(ok(await view(f,s,sold.id),200).events[0].actorKind,'staff');
 const session=ok(await f.admin.request(s.base+'/counter'),200).session,closed=ok(await f.admin.request(`${s.base}/counter/sessions/${session.id}/close`,'POST',{countedMinor:0,note:'Fictional shortage note',...s.pw}));
 assert.equal(ok(await f.admin.request(s.base+'/counter/sales','POST',walk)).id,sold.id);
 // Money events can be read by the station's managers.
 assert.equal((await f.migration.query("SELECT count(*)::int AS n FROM safeer.company_audit WHERE action IN ('session.closed','payment.recorded') AND station_id=$1",[s.station])).rows[0].n,3);
 // A finished journey cannot be canceled to reopen refunds.
 const done=await s.trip([future(14)]);await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.trips SET departure_at=clock_timestamp()-interval '1 day',arrival_at=clock_timestamp()-interval '22 hours' WHERE id=$1",[done]);await f.migration.query('SET session_replication_role=DEFAULT');
 const finished=await f.admin.request(`${s.path}/${done}/cancel`,'POST',{reason:'Fictional',version:3,...s.pw});assert.equal(finished.error.code,'TRIP_FINISHED');
 // Session notes and reasons written after erasure are cleared too.
 await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.cash_sessions SET closed_at=clock_timestamp()-interval '91 days' WHERE id=$1",[closed.id]);await f.migration.query('SET session_replication_role=DEFAULT');
 await f.api.db.pool.query('SELECT safeer.erase_due_passenger_data()');assert.equal((await f.migration.query('SELECT close_note FROM safeer.cash_sessions WHERE id=$1',[closed.id])).rows[0].close_note,null);
 await assert.rejects(f.migration.query("UPDATE safeer.cash_sessions SET counted_minor=1 WHERE id=$1",[closed.id]),e=>e.code==='42501');
 // Nobody can act as someone else by naming them.
 await assert.rejects(f.api.db.pool.query('SELECT safeer.close_session($1,gen_random_uuid(),gen_random_uuid(),0::bigint,NULL)',[s.cid]),e=>e.code==='42501');
}));
