import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';

const ok=(r,status=201)=>{assert.equal(r.status,status,r.raw);return r.data;};
const future=(days=10)=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
const seatsOf=count=>Array.from({length:count},(_,i)=>({row:Math.floor(i/4)+1,column:i%4+1,label:String(i+1)}));
async function setup(f,slug='hold-demo',{publish=true,list=true,hold=30}={}){
 const pw={currentPassword:f.password},cid=ok(await f.admin.request('companies','POST',{nameEn:'Fictional '+slug,nameAr:'Fictional '+slug,slug,holdMinutes:hold,timezone:'Africa/Khartoum',locale:'en',...pw})).id;
 const w=ok(await f.admin.request('companies/'+cid),200);ok(await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',...pw}),200);
 const code=slug.toUpperCase().replaceAll('-','_'),cities=[];for(const c of ['AA','BB','CC'])cities.push(ok(await f.admin.request('cities','POST',{code:code+'_'+c,nameEn:'City '+code+c,nameAr:'City '+code+c,countryCode:'SD',active:true,...pw})).id);
 const base='companies/'+cid,route=ok(await f.admin.request(base+'/routes','POST',{code:'R1',nameEn:'Fictional Route',nameAr:'Fictional Route',active:true,stops:cities.map(cityId=>({cityId})),...pw})).id;
 const layout=async(code,count)=>ok(await f.admin.request(base+'/fleet/layouts','POST',{code,nameEn:'Coach '+code,nameAr:'Coach '+code,active:true,rows:Math.ceil(count/4),columns:4,seats:seatsOf(count),...pw})).id;
 const big=await layout('BIG',12),small=await layout('SMALL',8);
 const bus=async(code,layoutId)=>ok(await f.admin.request(base+'/fleet/buses','POST',{code,registration:'REG '+code,layoutId,layoutRevision:1,active:true,...pw})).id;
 const driver=ok(await f.admin.request(base+'/drivers','POST',{employeeCode:'D1',nameEn:'Secret Driver',nameAr:'Secret Driver',active:true,...pw})).id;
 const buses={one:await bus('B1',big),same:await bus('B2',big),other:await bus('B3',small)};
 const path=base+'/trips',trip=async()=>{const id=ok(await f.admin.request(path,'POST',{routeId:route,dates:[future()],time:'07:00',offsets:[0,120,300],fareMinor:150000,...pw})).ids[0];ok(await f.admin.request(`${path}/${id}/assignment`,'POST',{busId:buses.one,driverId:driver,version:1,...pw}));if(publish)ok(await f.admin.request(`${path}/${id}/publish`,'POST',{version:2,...pw}));return id;};
 if(list)ok(await f.admin.request(base+'/public-profile','PUT',{listed:true,aboutEn:'',aboutAr:'',phone:'+249 333 333 333',version:0,...pw}),200);
 return {cid,base,w,path,trip,pw,buses,driver,slug};
}
const hold=(f,tripId,seats,key=randomUUID())=>f.client().request('public/holds','POST',{tripId,seats,key});
const view=(f,reference,key)=>f.client().request('public/holds/'+reference,'GET',undefined,key?{'X-Booking-Key':key}:{});
const seatMap=async(f,id)=>ok(await f.client().request('public/trips/'+id),200);
const free=map=>map.seats.filter(s=>s.available).map(s=>s.label);
// Tests move time by editing stored timestamps with triggers off. No route or runtime role can do this.
const age=async(f,reference)=>{await f.migration.query("SET session_replication_role=replica");await f.migration.query("UPDATE safeer.bookings SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 minute' WHERE reference=$1",[reference]);await f.migration.query("UPDATE safeer.seat_allocations a SET expires_at=clock_timestamp()-interval '1 minute' FROM safeer.bookings b WHERE b.id=a.booking_id AND b.reference=$1",[reference]);await f.migration.query("SET session_replication_role=DEFAULT");};
const count=async(f,table)=>(await f.migration.query(`SELECT count(*)::int AS n FROM safeer.${table}`)).rows[0].n;

test('a hold takes every requested seat or none, snapshots its terms and updates availability',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip();
 const before=await seatMap(f,id);assert.equal(before.seatsLeft,12);assert.equal(before.holdMinutes,30);assert.equal(before.rows,3);assert.equal(free(before).length,12);
 const started=Date.now(),a=ok(await hold(f,id,['2','1','3']));
 assert.match(a.reference,/^SF-[2-9A-HJ-NP-Z]{8}$/);assert.equal(a.status,'held');assert.deepEqual(a.seats,['1','2','3']);assert.equal(a.amountMinor,450000);assert.equal(a.currency,'SDG');
 const minutes=(Date.parse(a.expiresAt)-started)/60000;assert.ok(minutes>29.9&&minutes<30.1,'The company decides the hold length.');
 const after=await seatMap(f,id);assert.equal(after.seatsLeft,9);assert.equal(after.seats.find(x=>x.label==='1').available,false);assert.equal(JSON.stringify(after).includes(a.reference),false,'The public map never names a hold.');
 assert.equal(ok(await f.client().request('public/trips?'),200).items[0].seatsLeft,9,'Search shows the same availability.');
 // One taken seat refuses the whole request and leaves nothing behind.
 const counts=[await count(f,'bookings'),await count(f,'seat_allocations'),await count(f,'booking_events')];
 const taken=await hold(f,id,['4','3','5']);assert.equal(taken.status,409);assert.equal(taken.error.code,'SEATS_UNAVAILABLE');
 assert.deepEqual([await count(f,'bookings'),await count(f,'seat_allocations'),await count(f,'booking_events')],counts);assert.equal((await seatMap(f,id)).seatsLeft,9);
 for(const bad of [[],['1','1'],['99'],Array.from({length:11},(_,i)=>String(i+1)),'1',[1]])assert.equal((await hold(f,id,bad)).error?.code,'INVALID_SEATS',JSON.stringify(bad));
 assert.equal((await f.client().request('public/holds','POST',{tripId:id,seats:['6'],key:'not-a-uuid'})).status,400);
 assert.equal((await f.client().request('public/holds','POST',{tripId:id,seats:['6'],key:randomUUID(),extra:1})).status,400,'Passenger details are not accepted yet.');
}));

test('competing requests never share a seat',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip();
 const same=await Promise.all(Array.from({length:20},()=>hold(f,id,['1'])));
 assert.equal(same.filter(r=>r.status===201).length,1,'Exactly one request wins a contested seat.');
 for(const r of same.filter(r=>r.status!==201)){assert.equal(r.status,409);assert.equal(r.error.code,'SEATS_UNAVAILABLE');}
 // Overlapping groups in opposite orders must not deadlock or split: each seat ends up with one owner.
 const groups=await Promise.all([['2','3'],['3','2'],['3','4'],['4','5'],['5','6'],['6','2']].map(seats=>hold(f,id,seats)));
 assert.ok(groups.every(r=>[201,409].includes(r.status)),groups.map(r=>r.status).join());
 const won=groups.filter(r=>r.status===201).flatMap(r=>r.data.seats);assert.equal(new Set(won).size,won.length);
 assert.equal((await seatMap(f,id)).seatsLeft,12-1-won.length,'Availability matches the winners exactly.');
 assert.equal((await f.migration.query("SELECT count(*)::int AS n FROM safeer.seat_allocations a JOIN safeer.bookings b ON b.id=a.booking_id WHERE a.status='held' AND b.status<>'held'")).rows[0].n,0);
}));

test('a retry returns the original hold, and a reused key for other seats is refused',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip(),key=randomUUID();
 const first=ok(await hold(f,id,['1','2'],key));
 const again=ok(await hold(f,id,['2','1'],key));assert.equal(again.reference,first.reference,'Seat order does not make a new request.');assert.equal(await count(f,'bookings'),1);
 const conflict=await hold(f,id,['3'],key);assert.equal(conflict.status,409);assert.equal(conflict.error.code,'IDEMPOTENCY_CONFLICT');
 const parallelKey=randomUUID(),both=await Promise.all(Array.from({length:6},()=>hold(f,id,['5'],parallelKey)));
 assert.ok(both.every(r=>r.status===201),both.map(r=>r.status).join());assert.equal(new Set(both.map(r=>r.data.reference)).size,1,'Concurrent retries share one hold.');
 assert.equal(await count(f,'bookings'),2);
}));

test('expiry is decided by the database clock, not by the job or the browser',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip(),key=randomUUID(),a=ok(await hold(f,id,['1','2'],key));
 await age(f,a.reference);
 // The job has not run: the stored row still says held, yet the seat is free and the hold reads as expired.
 assert.equal((await f.migration.query('SELECT status FROM safeer.bookings WHERE reference=$1',[a.reference])).rows[0].status,'held');
 assert.equal(ok(await view(f,a.reference,key),200).status,'expired');assert.equal((await seatMap(f,id)).seatsLeft,12);
 const next=ok(await hold(f,id,['1']));assert.notEqual(next.reference,a.reference,'A new hold can take a seat whose hold has lapsed.');
 assert.equal((await f.migration.query('SELECT status,closed_at IS NOT NULL AS closed FROM safeer.bookings WHERE reference=$1',[a.reference])).rows[0].status,'expired');
 const events=(await f.migration.query('SELECT e.event,e.actor_kind FROM safeer.booking_events e JOIN safeer.bookings b ON b.id=e.booking_id WHERE b.reference=$1 ORDER BY e.created_at',[a.reference])).rows;assert.deepEqual(events,[{event:'held',actor_kind:'passenger'},{event:'expired',actor_kind:'system'}],'History is kept.');
 // The job closes holds nobody else touched, and is safe to run repeatedly.
 const key2=randomUUID(),b=ok(await hold(f,id,['8'],key2));await age(f,b.reference);
 assert.equal((await f.api.db.pool.query('SELECT safeer.expire_due_holds() AS n')).rows[0].n,1);assert.equal((await f.api.db.pool.query('SELECT safeer.expire_due_holds() AS n')).rows[0].n,0);
 assert.equal((await f.migration.query('SELECT status FROM safeer.bookings WHERE reference=$1',[b.reference])).rows[0].status,'expired');
 assert.equal(ok(await f.client().request(`public/holds/${b.reference}/release`,'POST',{key:key2})).status,'expired','An expired hold cannot be released into another state.');
 // A hold can never outlast its departure.
 await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.trips SET departure_at=clock_timestamp()+interval '10 minutes',arrival_at=clock_timestamp()+interval '310 minutes' WHERE id=$1",[id]);await f.migration.query('SET session_replication_role=DEFAULT');
 const soon=ok(await hold(f,id,['9']));assert.ok(Date.parse(soon.expiresAt)<=Date.now()+10*60000+2000,'The hold ends by departure even though the company allows 30 minutes.');
}));

test('only the browser that made a hold can open or release it',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip(),key=randomUUID(),a=ok(await hold(f,id,['1'],key));
 assert.equal((await view(f,a.reference,key)).data.reference,a.reference);assert.equal((await view(f,a.reference,key)).data.phone,'+249 333 333 333');
 assert.equal((await view(f,a.reference)).status,400,'The reference alone opens nothing.');assert.equal((await view(f,a.reference,randomUUID())).status,404);assert.equal((await view(f,'SF-ZZZZZZZZ',key)).status,404);
 await f.migration.query('SET session_replication_role=replica');await f.migration.query('UPDATE safeer.company_public_profiles SET listed=false WHERE company_id=$1',[s.cid]);await f.migration.query('SET session_replication_role=DEFAULT');
 assert.equal((await view(f,a.reference,key)).data.phone,null,'A hidden company stops showing contact details.');
 await f.migration.query('SET session_replication_role=replica');await f.migration.query('UPDATE safeer.company_public_profiles SET listed=true WHERE company_id=$1',[s.cid]);await f.migration.query('SET session_replication_role=DEFAULT');
 const text=JSON.stringify((await view(f,a.reference,key)).data);for(const secret of ['Secret Driver','REG B1','access','request_hash',key])assert.equal(text.includes(secret),false,secret);
 assert.equal((await f.client().request(`public/holds/${a.reference}/release`,'POST',{key:randomUUID()})).status,404);assert.equal((await seatMap(f,id)).seatsLeft,11);
 const closed=ok(await f.client().request(`public/holds/${a.reference}/release`,'POST',{key}));assert.equal(closed.status,'released');assert.equal(closed.releasedBy,'passenger');assert.equal((await seatMap(f,id)).seatsLeft,12);
 assert.equal(ok(await f.client().request(`public/holds/${a.reference}/release`,'POST',{key})).status,'released','Releasing twice is harmless.');
 const origin=await fetch(f.api.origin+'/api/v1/public/holds',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:9'},body:JSON.stringify({tripId:id,seats:['2'],key:randomUUID()})});assert.equal(origin.status,403,'Other sites cannot create holds.');
 assert.equal((await fetch(f.api.origin+'/api/v1/public/holds',{method:'POST',headers:{'Content-Type':'text/plain',Origin:'http://127.0.0.1:4320'},body:'{}'})).status,415);
 await f.migration.query("UPDATE safeer.auth_throttles SET attempts=120");const limited=await hold(f,id,['2']);assert.equal(limited.status,429);assert.equal(limited.error.code,'RATE_LIMITED');
}));

test('holds follow the trip: drafts, unlisted and past trips refuse, cancellation releases, and seat maps cannot change under a hold',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip(),a=ok(await hold(f,id,['12']));
 const draft=await setup(f,'hold-draft',{publish:false}),d=await draft.trip();assert.equal((await hold(f,d,['1'])).error.code,'TRIP_NOT_BOOKABLE');assert.equal((await f.client().request('public/trips/'+d)).status,404);
 const hidden=await setup(f,'hold-hidden',{list:false}),h=await hidden.trip();assert.equal((await hold(f,h,['1'])).error.code,'TRIP_NOT_BOOKABLE');assert.equal((await f.client().request('public/trips/'+h)).status,404);
 assert.equal((await hold(f,randomUUID(),['1'])).error.code,'TRIP_NOT_BOOKABLE');assert.equal((await f.client().request('public/trips/not-a-uuid')).status,400);
 const change=(busId,version)=>f.admin.request(`${s.path}/${id}/assignment`,'POST',{busId,driverId:s.driver,reason:'Fictional swap',version,...s.pw});
 let refused=await change(s.buses.other,3);assert.equal(refused.status,409);assert.equal(refused.error.code,'SEATS_HELD');
 ok(await change(s.buses.same,3));assert.equal((await seatMap(f,id)).seatsLeft,11,'A bus with the same seat map keeps its holds.');
 await age(f,a.reference);ok(await change(s.buses.other,4));assert.equal((await seatMap(f,id)).seatCount,8,'A lapsed hold does not block a change.');
 assert.equal((await hold(f,id,['9'])).error.code,'INVALID_SEATS','Only seats on the current map exist.');
 const key=randomUUID(),b=ok(await hold(f,id,['1'],key));
 ok(await f.admin.request(`${s.path}/${id}/cancel`,'POST',{reason:'Fictional closure',version:5,...s.pw}));
 const closed=ok(await view(f,b.reference,key),200);assert.equal(closed.status,'released');assert.equal(closed.releasedBy,'trip_canceled');assert.equal(closed.tripOpen,false);
 assert.equal((await f.migration.query('SELECT status FROM safeer.bookings WHERE reference=$1',[a.reference])).rows[0].status,'expired','Canceling does not rewrite a hold that had already lapsed.');
 assert.equal((await hold(f,id,['2'])).error.code,'TRIP_NOT_BOOKABLE');
}));

test('staff see holds and release them only with the booking permission',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip(),key=randomUUID(),a=ok(await hold(f,id,['1','2'],key)),url=`${s.base}/trips/${id}`;
 assert.equal((await f.client().request(url+'/seats')).status,401);
 const map=ok(await f.admin.request(url+'/seats'),200);assert.equal(map.canManage,true);assert.equal(map.seats.find(x=>x.label==='1').reference,a.reference);assert.equal(map.seats.find(x=>x.label==='3').reference,null);assert.equal(map.bookings[0].reference,a.reference);assert.deepEqual(map.bookings[0].seats,['1','2']);
 const roleWith=async(code,permissions)=>ok(await f.admin.request(`${s.base}/roles`,'POST',{displayName:code,scope:'company',permissions,currentPassword:f.password}));
 const person=async(login,roleId)=>{const made=ok(await f.admin.request(`${s.base}/members`,'POST',{login,displayName:'Fictional Staff',existing:false,assignments:[{roleId}],currentPassword:f.password}));const c=f.client();ok(await c.signIn(made.user.login,made.temporaryPassword));const pass=randomBytes(24).toString('hex');ok(await c.request('auth/password','POST',{currentPassword:made.temporaryPassword,newPassword:pass}));return {c,pass};};
 const reader=await person('reader@safeer.local',(await roleWith('BOOK_READ',['company.profile.read','company.bookings.read'])).id),none=await person('none@safeer.local',(await roleWith('NOTHING',['company.profile.read'])).id);
 assert.equal((await none.c.request(url+'/seats')).status,403);
 const readerMap=ok(await reader.c.request(url+'/seats'),200);assert.equal(readerMap.canManage,false);
 const hid=map.bookings[0].id,release=(c,currentPassword,reason='Fictional reason')=>c.request(`${url}/holds/${hid}/release`,'POST',{reason,currentPassword});
 assert.equal((await release(reader.c,reader.pass)).status,403);assert.equal((await release(f.admin,'wrong-password')).status>=400,true);assert.equal((await release(f.admin,f.password,'')).status,400);
 assert.equal((await seatMap(f,id)).seatsLeft,10,'Refused attempts change nothing.');
 const other=await setup(f,'hold-other'),foreign=await other.trip();assert.equal((await f.admin.request(`${other.base}/trips/${foreign}/holds/${hid}/release`,'POST',{reason:'x',...other.pw})).status,404,'A hold cannot be reached through another company.');
 ok(await release(f.admin,f.password));assert.equal((await seatMap(f,id)).seatsLeft,12);
 const row=(await f.migration.query('SELECT status,released_by_kind,release_reason FROM safeer.bookings WHERE id=$1',[hid])).rows[0];assert.deepEqual(row,{status:'released',released_by_kind:'staff',release_reason:'Fictional reason'});
 assert.equal((await f.migration.query("SELECT count(*)::int AS n FROM safeer.company_audit WHERE action='booking.released' AND target_id=$1",[hid])).rows[0].n,1);
 assert.equal((await release(f.admin,f.password)).error.code,'HOLD_CLOSED');
 assert.equal(ok(await view(f,a.reference,key),200).releasedBy,'staff');
 assert.equal(ok(await f.admin.request(url+'/seats'),200).bookings[0].releaseReason,'Fictional reason');
 // A live hold stays reachable however much closed history piles up on the trip.
 const live=ok(await hold(f,id,['12']));const seen=ok(await f.admin.request(url+'/seats'),200);assert.equal(seen.bookingTotal,2);assert.equal(seen.bookings.some(row=>row.reference===live.reference),true);
}));

test('the database itself protects seats and history',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip(),a=ok(await hold(f,id,['1','2']));
 for(const table of ['bookings','seat_allocations','booking_events'])await assert.rejects(f.api.db.pool.query(`SELECT * FROM safeer.${table}`),e=>e.code==='42501',table);
 await assert.rejects(f.api.db.pool.query("UPDATE safeer.bookings SET status='released'"),e=>e.code==='42501');
 await assert.rejects(f.api.db.pool.query("SELECT safeer.close_booking(NULL,NULL,'released','staff',NULL,NULL)"),e=>e.code==='42501','Runtime cannot call internal steps.');
 await assert.rejects(f.api.db.pool.query("SELECT safeer.staff_release($1,$2,$3,$4,'x')",[s.cid,id,randomUUID(),randomUUID()]),e=>e.code==='42501','Without a session, staff functions refuse.');
 assert.equal(await f.api.db.pool.query("SELECT safeer.staff_seat_map($1,$2)",[s.cid,id]).then(()=>'ran',e=>e.code),'42501');
 for(const sql of ["UPDATE safeer.bookings SET amount_minor=1,fare_minor=1,seat_count=1","UPDATE safeer.bookings SET expires_at=expires_at+interval '1 day'","DELETE FROM safeer.bookings","UPDATE safeer.seat_allocations SET label='X'","DELETE FROM safeer.seat_allocations","UPDATE safeer.booking_events SET reason='x'","DELETE FROM safeer.booking_events"])await assert.rejects(f.migration.query(sql),e=>e.code==='42501',sql);
 // A stop-range claim: overlapping parts of a journey conflict, and adjacent parts can share a seat.
 const row=(await f.migration.query("SELECT a.*,b.company_id AS c FROM safeer.seat_allocations a JOIN safeer.bookings b ON b.id=a.booking_id WHERE b.reference=$1 AND a.label='1'",[a.reference])).rows[0];
 const other=(await f.migration.query("SELECT label,row_number,column_number FROM safeer.seat_layout_seats WHERE company_id=$1 AND layout_id=$2 AND revision=$3 AND label='5'",[row.company_id,row.layout_id,row.layout_revision])).rows[0];
 const claim=lower=>f.migration.query("INSERT INTO safeer.seat_allocations(id,company_id,trip_id,booking_id,layout_id,layout_revision,row_number,column_number,label,segment,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,int4range($10,$10+1),$11)",[randomUUID(),row.company_id,row.trip_id,row.booking_id,row.layout_id,row.layout_revision,other.row_number,other.column_number,other.label,lower,row.expires_at]);
 await claim(0);await assert.rejects(claim(0),e=>e.code==='23505'||e.code==='23P01');
 const second=ok(await hold(f,id,['8'])),secondId=(await f.migration.query('SELECT id FROM safeer.bookings WHERE reference=$1',[second.reference])).rows[0].id;
 const copy=segment=>f.migration.query('INSERT INTO safeer.seat_allocations(id,company_id,trip_id,booking_id,layout_id,layout_revision,row_number,column_number,label,segment,expires_at) SELECT $1,company_id,trip_id,$2,layout_id,layout_revision,row_number,column_number,label,$3::int4range,expires_at FROM safeer.seat_allocations WHERE id=$4',[randomUUID(),secondId,segment,row.id]);
 await assert.rejects(copy('[0,2)'),e=>e.code==='23P01','Overlapping parts of a journey conflict, even if the application misses it.');
 await assert.rejects(copy('[1,2)'),e=>e.code==='23P01');
}));
