import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';
import {grantIdentityRuntime} from '../database/runtime-grants.mjs';

const ok=(r,status=201)=>{assert.equal(r.status,status,r.raw);return r.data;};
const future=(days=10)=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
async function setup(f,slug='people-demo'){
 const pw={currentPassword:f.password},cid=ok(await f.admin.request('companies','POST',{nameEn:'Fictional '+slug,nameAr:'Fictional '+slug,slug,holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).id;
 const w=ok(await f.admin.request('companies/'+cid),200);ok(await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',...pw}),200);
 const code=slug.toUpperCase().replaceAll('-','_'),cities=[];for(const c of ['AA','BB'])cities.push(ok(await f.admin.request('cities','POST',{code:code+'_'+c,nameEn:'City '+c,nameAr:'City '+c,countryCode:'SD',active:true,...pw})).id);
 const base='companies/'+cid,route=ok(await f.admin.request(base+'/routes','POST',{code:'R1',nameEn:'Fictional Route',nameAr:'Fictional Route',active:true,stops:cities.map(cityId=>({cityId})),...pw})).id;
 const layout=ok(await f.admin.request(base+'/fleet/layouts','POST',{code:'L1',nameEn:'Coach',nameAr:'Coach',active:true,rows:2,columns:4,seats:Array.from({length:8},(_,i)=>({row:Math.floor(i/4)+1,column:i%4+1,label:String(i+1)})),...pw})).id;
 const bus=ok(await f.admin.request(base+'/fleet/buses','POST',{code:'B1',registration:'REG B1',layoutId:layout,layoutRevision:1,active:true,...pw})).id,driver=ok(await f.admin.request(base+'/drivers','POST',{employeeCode:'D1',nameEn:'Driver',nameAr:'Driver',active:true,...pw})).id;
 const path=base+'/trips',id=ok(await f.admin.request(path,'POST',{routeId:route,dates:[future()],time:'07:00',offsets:[0,120],fareMinor:150000,...pw})).ids[0];ok(await f.admin.request(`${path}/${id}/assignment`,'POST',{busId:bus,driverId:driver,version:1,...pw}));ok(await f.admin.request(`${path}/${id}/publish`,'POST',{version:2,...pw}));
 ok(await f.admin.request(base+'/public-profile','PUT',{listed:true,aboutEn:'',aboutAr:'',version:0,...pw}),200);
 return {cid,base,id,pw,w};
}
const book=(f,tripId,seats,{mobile='0912345678',names,key=randomUUID()}={})=>f.client().request('public/holds','POST',{tripId,seats,key,mobile,travelers:seats.map((seat,i)=>({seat,name:names?.[i]??`Fictional Traveler ${seat}`}))});
const lookup=(f,reference,mobile)=>f.client().request('public/holds/lookup','POST',{reference,mobile});

test('a hold commits with every traveler and one mobile, or not at all',async()=>identityFixture(async f=>{
 const s=await setup(f),key=randomUUID(),a=ok(await book(f,s.id,['1','2'],{key,names:['Fictional Amna Osman','طفل تجريبي']}));
 assert.equal(a.mobile,'+249912345678','Local Sudanese numbers are stored in international form.');assert.deepEqual(a.travelers.map(t=>[t.seat,t.name]),[['1','Fictional Amna Osman'],['2','طفل تجريبي']]);
 for(const [value,stored] of [['+249 912 345 678','+249912345678'],['00249912345678','+249912345678'],['٠٩١٢٣٤٥٦٧٨','+249912345678'],['912345678','+249912345678'],['+974 5512 3456','+97455123456']]){const key=randomUUID();assert.equal(ok(await book(f,s.id,['3'],{mobile:value,key})).mobile,stored,value);ok(await f.client().request('public/trips/'+s.id),200);const reference=(await f.migration.query("SELECT reference FROM safeer.bookings WHERE status='held' ORDER BY created_at DESC LIMIT 1")).rows[0].reference;ok(await f.client().request('public/holds/'+reference+'/release','POST',{key}));}
 const before=(await f.migration.query('SELECT count(*)::int AS n FROM safeer.bookings')).rows[0].n;
 for(const mobile of ['','123','0912','+24991234567','+0912345678','not a phone'])assert.equal((await book(f,s.id,['4'],{mobile})).error?.code,'INVALID_MOBILE',mobile);
 for(const names of [[''],['A'],['12345'],['x'.repeat(101)],['Bad\u0007Name']])assert.equal((await book(f,s.id,['4'],{names})).error?.code,'INVALID_PASSENGERS',names[0]);
 const held=(body)=>f.client().request('public/holds','POST',{tripId:s.id,seats:['4','5'],key:randomUUID(),mobile:'0912345678',...body});
 for(const travelers of [undefined,[],[{seat:'4',name:'Fictional One'}],[{seat:'4',name:'Fictional One'},{seat:'4',name:'Fictional Two'}],[{seat:'4',name:'Fictional One'},{seat:'9',name:'Fictional Two'}]])assert.equal((await held({travelers})).error?.code,'INVALID_PASSENGERS',JSON.stringify(travelers));
 assert.equal((await held({travelers:[{seat:'4',name:'Fictional One',age:9},{seat:'5',name:'Fictional Two'}]})).status,400,'Age is not collected.');
 assert.equal((await f.migration.query('SELECT count(*)::int AS n FROM safeer.bookings')).rows[0].n,before,'A refused hold takes no seats.');
 // A retry with the same key must also carry the same details.
 assert.equal(ok(await book(f,s.id,['1','2'],{key,names:['Fictional Amna Osman','طفل تجريبي']})).reference,a.reference);
 assert.equal((await book(f,s.id,['1','2'],{key,names:['Someone Else','طفل تجريبي']})).error?.code,'IDEMPOTENCY_CONFLICT');
 const optional=ok(await f.client().request('public/holds','POST',{tripId:s.id,seats:['6'],key:randomUUID(),mobile:'0912345678',travelers:[{seat:'6',name:'Fictional Six',mobile:'0999999999'}]}));assert.equal(optional.travelers[0].mobile,'+249999999999','A traveler can add their own number.');
 assert.equal(JSON.stringify(ok(await f.client().request('public/trips/'+s.id),200)).includes('Fictional Amna'),false,'The public seat map names nobody.');
 // The stored fingerprint needs the secret key, so it cannot be tested against guessed names and numbers.
 const fingerprint=(await f.migration.query('SELECT request_hash FROM safeer.bookings WHERE reference=$1',[a.reference])).rows[0].request_hash,guess=createHash('sha256').update(JSON.stringify([s.id,['1','2'],'+249912345678',[{seat:'1',name:'Fictional Amna Osman',mobile:null},{seat:'2',name:'طفل تجريبي',mobile:null}]])).digest('hex');assert.notEqual(fingerprint,guess);
 // A retry of a hold that exists is free, even at the limit, so a lost reply can be recovered.
 await f.migration.query('UPDATE safeer.auth_throttles SET attempts=120');assert.equal(ok(await book(f,s.id,['1','2'],{key,names:['Fictional Amna Osman','طفل تجريبي']})).reference,a.reference);assert.equal((await book(f,s.id,['7'])).status,429);await f.migration.query('DELETE FROM safeer.auth_throttles');
}));

test('reference and mobile reopen a booking with masked details, and guesses are limited',async()=>identityFixture(async f=>{
 const s=await setup(f),a=ok(await book(f,s.id,['1','2'],{names:['Fictional Amna Osman Ali','Fictional']}));
 const found=ok(await lookup(f,a.reference,'0912345678'));
 assert.equal(found.reference,a.reference);assert.equal(found.retrieved,true);assert.equal(found.mobile,'+249•••••678','The number is masked.');assert.deepEqual(found.travelers.map(t=>t.name),['Fictional A.','Fictional'],'Names are shortened.');assert.equal(JSON.stringify(found).includes('912345678'),false);
 assert.equal(ok(await lookup(f,a.reference.toLowerCase(),'+249 912 345 678')).reference,a.reference,'Entry style does not matter.');
 assert.equal((await lookup(f,a.reference,'0999999999')).status,404);assert.equal((await lookup(f,'SF-ZZZZZZZZ','0912345678')).status,404,'A wrong reference and a wrong number look the same.');assert.equal((await lookup(f,'nonsense','0912345678')).status,404);
 assert.equal((await f.client().request('public/holds/lookup','POST',{reference:a.reference})).status,400);
 assert.equal((await f.client().request('public/holds/'+a.reference,'GET',undefined,{'X-Booking-Mobile':'0912345678'})).status,400,'Reading by key cannot be replaced by a number.');
 for(let i=0;i<3;i++)ok(await lookup(f,a.reference,'0912345678'));
 const wrong=await f.client().request(`public/holds/${a.reference}/release`,'POST',{mobile:'0999999999'});assert.equal(wrong.status,404);assert.equal(ok(await f.client().request('public/trips/'+s.id),200).seatsLeft,6,'A wrong number releases nothing.');
 assert.equal((await f.client().request(`public/holds/${a.reference}/release`,'POST',{mobile:'0912345678',key:randomUUID()})).status,400);
 const released=ok(await f.client().request(`public/holds/${a.reference}/release`,'POST',{mobile:'0912345678'}));assert.equal(released.status,'released');assert.equal(released.mobile,'+249•••••678','Release replies stay masked.');
 assert.equal(ok(await f.client().request('public/trips/'+s.id),200).seatsLeft,8);
 // Guesses against one reference stop at five failures, successes do not use them up, and other bookings are unaffected.
 const b=ok(await book(f,s.id,['3'])),c=ok(await book(f,s.id,['4']));
 await f.migration.query('DELETE FROM safeer.auth_throttles');
 for(let i=0;i<5;i++)assert.equal((await lookup(f,b.reference,'0900000'+String(100+i))).status,404);
 const blocked=await lookup(f,b.reference,'0912345678');assert.equal(blocked.status,429);assert.equal(blocked.error.code,'RATE_LIMITED');
 assert.equal(ok(await lookup(f,c.reference,'0912345678')).reference,c.reference);
 // A success gives its attempt back in full: 1 success, then 5 failures are allowed before the block.
 await f.migration.query('DELETE FROM safeer.auth_throttles');ok(await lookup(f,c.reference,'0912345678'));
 for(let i=0;i<5;i++)assert.equal((await lookup(f,c.reference,'0900000'+String(100+i))).status,404,String(i));
 assert.equal((await lookup(f,c.reference,'0912345678')).status,429);
 // A client over its limit cannot use up another booking's attempts.
 await f.migration.query('DELETE FROM safeer.auth_throttles');for(let i=0;i<30;i++)await lookup(f,'SF-ZZZZZZZZ','0912345678');
 for(let i=0;i<8;i++)assert.equal((await lookup(f,b.reference,'0900000111')).status,429);
 assert.equal((await f.migration.query('SELECT count(*)::int AS n FROM safeer.auth_throttles')).rows[0].n,2,'Only the client counter and the guessed reference counter were written.');
 // A single address cannot sweep many references.
 await f.migration.query('DELETE FROM safeer.auth_throttles');
 for(let i=0;i<30;i++)await lookup(f,c.reference.slice(0,-1)+'ABCDEFGHJKLMNPQRSTUVWXYZ234567'[i],'0912345678');
 assert.equal((await lookup(f,c.reference,'0912345678')).status,429);
}));

test('a reply lost before the key was stored can be recovered by key alone',async()=>identityFixture(async f=>{
 const s=await setup(f),key=randomUUID(),a=ok(await book(f,s.id,['1'],{key}));
 const current=(k,extra={})=>f.client().request('public/holds/current','GET',undefined,{'X-Booking-Key':k,...extra});
 assert.equal(ok(await current(key),200).reference,a.reference);assert.equal((await current(randomUUID())).status,404);assert.equal((await f.client().request('public/holds/current')).status,400);
}));

test('staff search, open and correct bookings only with permission, and each access is audited',async()=>identityFixture(async f=>{
 const s=await setup(f),a=ok(await book(f,s.id,['1','2'],{names:['Fictional Amna Osman','Fictional Child'],mobile:'0912345678'})),other=ok(await book(f,s.id,['3'],{names:['Fictional Bashir'],mobile:'0922222222'})),url=s.base+'/bookings';
 assert.equal((await f.client().request(url)).status,401);
 const all=ok(await f.admin.request(url),200);assert.equal(all.items.length,2);assert.equal(all.canManage,true);
 const search=async q=>ok(await f.admin.request(url+'?q='+encodeURIComponent(q)),200).items.map(row=>row.reference);
 assert.deepEqual(await search(a.reference),[a.reference]);assert.deepEqual(await search(a.reference.toLowerCase()),[a.reference]);assert.deepEqual(await search('0912345678'),[a.reference]);assert.deepEqual(await search('+249 922 222 222'),[other.reference]);assert.deepEqual(await search('amna'),[a.reference]);assert.deepEqual(await search('fictional').then(r=>r.sort()),[a.reference,other.reference].sort());assert.deepEqual(await search('%'+'%'),[],'Search text is not a pattern.');
 assert.equal((await f.admin.request(url+'?q=x')).status,400);
 const audits=(await f.migration.query("SELECT count(*)::int AS n FROM safeer.company_audit WHERE action='booking.searched'")).rows[0].n;assert.ok(audits>=6);
 assert.equal(JSON.stringify((await f.migration.query('SELECT * FROM safeer.company_audit')).rows).includes('amna'),false,'The audit does not keep search text.');
 assert.equal((await f.migration.query("SELECT count(*)::int AS n FROM safeer.company_audit WHERE action='booking.listed'")).rows[0].n,1,'Listing bookings is audited too.');
 const bid=all.items.find(row=>row.reference===a.reference).id,detail=ok(await f.admin.request(`${url}/${bid}`),200);
 assert.equal(detail.mobile,'+249912345678','Staff see the full number.');assert.equal(detail.travelers.length,2);assert.deepEqual(detail.events.map(e=>e.event),['held']);assert.equal((await f.migration.query("SELECT count(*)::int AS n FROM safeer.company_audit WHERE action='booking.viewed' AND target_id=$1",[bid])).rows[0].n,1);
 const map=ok(await f.admin.request(`${s.base}/trips/${s.id}/seats`),200);assert.equal(map.bookings.find(row=>row.id===bid).travelers[0].name,'Fictional Amna Osman','The seat view names travelers too.');assert.equal((await f.migration.query("SELECT count(*)::int AS n FROM safeer.company_audit WHERE action='booking.seats_viewed' AND target_id=$1",[s.id])).rows[0].n,1,'So it is audited.');
 // Correcting details: password, reason and version all apply, and old values are not kept.
 const change=(c=f.admin,over={})=>c.request(`${url}/${bid}`,'PATCH',{mobile:'0933333333',seats:['1','2'],travelers:[{seat:'1',name:'Fictional Amna Corrected'},{seat:'2',name:'Fictional Child'}],reason:'Fictional typo',version:detail.version,...s.pw,...over});
 assert.equal((await change(f.admin,{currentPassword:'wrong-password-value'})).status>=400,true);assert.equal((await change(f.admin,{reason:''})).status,400);assert.equal((await change(f.admin,{travelers:[{seat:'1',name:'Only One'}]})).error.code,'INVALID_PASSENGERS');
 assert.equal((await change(f.admin,{version:99})).error.code,'STALE_VERSION');ok(await change(),200);
 const fixed=ok(await f.admin.request(`${url}/${bid}`),200);assert.equal(fixed.mobile,'+249933333333');assert.equal(fixed.travelers[0].name,'Fictional Amna Corrected');assert.deepEqual(fixed.events.map(e=>[e.event,e.reason]),[['held',null],['changed','Fictional typo']]);
 assert.equal((await lookup(f,a.reference,'0912345678')).status,404,'The old number stops working.');assert.equal(ok(await lookup(f,a.reference,'0933333333')).reference,a.reference);
 assert.equal(JSON.stringify((await f.migration.query('SELECT * FROM safeer.booking_events')).rows).includes('Amna Osman'),false,'History does not keep the old name.');
 // Permissions and other companies.
 const role=async(displayName,permissions)=>ok(await f.admin.request(`${s.base}/roles`,'POST',{displayName,scope:'company',permissions,...s.pw}));
 const person=async(login,roleId)=>{const made=ok(await f.admin.request(`${s.base}/members`,'POST',{login,displayName:'Fictional Staff',existing:false,assignments:[{roleId}],...s.pw}));const c=f.client();ok(await c.signIn(made.user.login,made.temporaryPassword));const pass=randomBytes(24).toString('hex');ok(await c.request('auth/password','POST',{currentPassword:made.temporaryPassword,newPassword:pass}));return {c,pass};};
 const reader=await person('reader@safeer.local',(await role('Booking reader',['company.profile.read','company.bookings.read'])).id),none=await person('none@safeer.local',(await role('No bookings',['company.profile.read'])).id);
 assert.equal((await none.c.request(url)).status,403);assert.equal((await none.c.request(`${url}/${bid}`)).status,403);
 assert.equal(ok(await reader.c.request(url),200).canManage,false);assert.equal((await change(reader.c,{currentPassword:reader.pass,version:fixed.version})).status,403);
 const rival=await setup(f,'people-rival');assert.equal((await f.admin.request(`${rival.base}/bookings/${bid}`)).status,404,'A booking cannot be reached through another company.');assert.equal(ok(await f.admin.request(rival.base+'/bookings'),200).items.length,0);
 assert.equal((await f.admin.request(`${rival.base}/bookings/${bid}`,'PATCH',{mobile:'0933333333',seats:['1','2'],travelers:[{seat:'1',name:'Intruder Name'},{seat:'2',name:'Intruder Name'}],reason:'x',version:fixed.version,...s.pw})).status,404);
 // Closed holds can no longer be corrected.
 ok(await f.admin.request(`${s.base}/trips/${s.id}/holds/${bid}/release`,'POST',{reason:'Fictional',...s.pw}));
 assert.equal((await change(f.admin,{version:fixed.version})).error.code,'HOLD_CLOSED');
}));

test('names and numbers are erased 90 days after the trip, and the booking stays',async()=>identityFixture(async f=>{
 const s=await setup(f),key=randomUUID(),a=ok(await book(f,s.id,['1','2'],{key,names:['Fictional Amna Osman','Fictional Child']})),keep=ok(await book(f,s.id,['3']));
 // Staff reasons can contain names, so they go too.
 const bid=(await f.migration.query('SELECT id FROM safeer.bookings WHERE reference=$1',[a.reference])).rows[0].id;ok(await f.admin.request(`${s.base}/bookings/${bid}`,'PATCH',{mobile:'0912345678',seats:['1','2'],travelers:[{seat:'1',name:'Fictional Amna Osman'},{seat:'2',name:'Fictional Child'}],reason:'Was Fictional Amna Old',version:1,...s.pw}),200);ok(await f.admin.request(`${s.base}/trips/${s.id}/holds/${bid}/release`,'POST',{reason:'Asked by Fictional Amna',...s.pw}));
 const row=(await f.migration.query("SELECT c.erase_at,t.arrival_at FROM safeer.booking_contacts c JOIN safeer.bookings b ON b.id=c.booking_id JOIN safeer.trips t ON t.id=b.trip_id WHERE b.reference=$1",[a.reference])).rows[0];
 assert.equal(row.erase_at.getTime()-row.arrival_at.getTime(),90*86400000,'The date follows the trip, not the booking.');
 assert.equal((await f.api.db.pool.query('SELECT safeer.erase_due_passenger_data() AS n')).rows[0].n,0,'Nothing is erased early.');
 await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.booking_contacts c SET erase_at=clock_timestamp()-interval '1 minute' FROM safeer.bookings b WHERE b.id=c.booking_id AND b.reference=$1",[a.reference]);await f.migration.query('SET session_replication_role=DEFAULT');
 assert.equal((await f.api.db.pool.query('SELECT safeer.erase_due_passenger_data() AS n')).rows[0].n,1);assert.equal((await f.api.db.pool.query('SELECT safeer.erase_due_passenger_data() AS n')).rows[0].n,0);
 const leftovers=JSON.stringify((await f.migration.query('SELECT b.release_reason,e.reason,b.status,b.released_by_kind FROM safeer.bookings b JOIN safeer.booking_events e ON e.booking_id=b.id WHERE b.reference=$1',[a.reference])).rows);assert.equal(leftovers.includes('Amna'),false,'Staff reasons are erased.');assert.ok(leftovers.includes('released'),'That the release happened stays.');
 assert.equal(JSON.stringify(ok(await f.admin.request(`${s.base}/bookings/${bid}`),200)).includes('Amna'),false);
 const stored=JSON.stringify((await f.migration.query('SELECT p.*,c.* FROM safeer.booking_passengers p JOIN safeer.booking_contacts c USING(company_id,booking_id) JOIN safeer.bookings b ON b.id=c.booking_id WHERE b.reference=$1',[a.reference])).rows);
 assert.equal(stored.includes('Amna'),false);assert.equal(stored.includes('912345678'),false);
 const view=ok(await f.client().request('public/holds/'+a.reference,'GET',undefined,{'X-Booking-Key':key}),200);assert.equal(view.detailsErased,true);assert.equal(view.mobile,null);assert.deepEqual(view.seats,['1','2'],'The booking itself stays.');assert.equal(view.amountMinor,300000);assert.equal(view.travelers[0].name,null);
 assert.equal((await lookup(f,a.reference,'0912345678')).status,404,'Erased details can no longer open a booking.');
 const list=ok(await f.admin.request(s.base+'/bookings'),200).items;assert.equal(list.find(r=>r.reference===a.reference).detailsErased,true);assert.equal(list.find(r=>r.reference===keep.reference).detailsErased,false,'Other bookings keep their details until their own date.');
 assert.equal(ok(await f.admin.request(`${s.base}/bookings?q=${encodeURIComponent('Amna')}`),200).items.length,0);
 const events=(await f.migration.query("SELECT e.event,e.actor_kind FROM safeer.booking_events e JOIN safeer.bookings b ON b.id=e.booking_id WHERE b.reference=$1 ORDER BY e.created_at",[a.reference])).rows;assert.deepEqual(events.at(-1),{event:'erased',actor_kind:'system'},'The erasure itself is recorded.');
 await assert.rejects(f.migration.query("UPDATE safeer.booking_passengers SET full_name='Back Again'"),e=>e.code==='42501','Erased details cannot be restored.');
}));

test('the database protects personal details directly',async()=>identityFixture(async f=>{
 const s=await setup(f),a=ok(await book(f,s.id,['1']));
 for(const table of ['booking_contacts','booking_passengers'])await assert.rejects(f.api.db.pool.query(`SELECT * FROM safeer.${table}`),e=>e.code==='42501',table);
 // A database upgraded from Section 08 loses the old detail-free route.
 const role=decodeURIComponent(new URL(f.runtimeUrl).username);await f.migration.query(`GRANT EXECUTE ON FUNCTION safeer.public_hold(uuid,text[],uuid,text,text,text) TO "${role}"`);await grantIdentityRuntime(f.migration,role);
 for(const call of ["SELECT safeer.public_hold(gen_random_uuid(),ARRAY['1'],gen_random_uuid(),'SF-ABCD2345',repeat('a',64),repeat('b',64))","SELECT safeer.mask_booking('{}')","SELECT safeer.booking_travelers(gen_random_uuid(),gen_random_uuid())"])await assert.rejects(f.api.db.pool.query(call),e=>e.code==='42501',call);
 for(const call of ["SELECT safeer.staff_bookings($1,NULL,NULL,NULL)","SELECT safeer.staff_booking($1,gen_random_uuid())"])await assert.rejects(f.api.db.pool.query(call,[s.cid]),e=>e.code==='42501','Without a session, staff functions refuse: '+call);
 for(const sql of ['DELETE FROM safeer.booking_contacts','DELETE FROM safeer.booking_passengers',"UPDATE safeer.booking_contacts SET erase_at=clock_timestamp()+interval '10 years'"])await assert.rejects(f.migration.query(sql),e=>e.code==='42501',sql);
 for(const sql of ["UPDATE safeer.booking_events SET reason='changed'","UPDATE safeer.booking_events SET actor_kind='staff',reason=NULL"])await assert.rejects(f.migration.query(sql),e=>e.code==='42501',sql);
 assert.ok(a.reference);
}));
