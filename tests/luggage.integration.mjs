import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import jsQR from 'jsqr';
import {identityFixture} from './support/identity-db.mjs';

const ok=(r,status=201)=>{assert.equal(r.status,status,r.raw);return r.data;};
const future=(days=10)=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
async function setup(f,slug='bag-demo'){
 const pw={currentPassword:f.password},cid=ok(await f.admin.request('companies','POST',{nameEn:'Fictional '+slug,nameAr:'Fictional '+slug,slug,holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).id;
 const w=ok(await f.admin.request('companies/'+cid),200);ok(await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',...pw}),200);
 const code=slug.toUpperCase().replaceAll('-','_'),cities=[];for(const c of ['AA','BB'])cities.push(ok(await f.admin.request('cities','POST',{code:code+'_'+c,nameEn:'City '+c,nameAr:'City '+c,countryCode:'SD',active:true,...pw})).id);
 const base='companies/'+cid,route=ok(await f.admin.request(base+'/routes','POST',{code:'R1',nameEn:'Fictional Route',nameAr:'Fictional Route',active:true,stops:cities.map(cityId=>({cityId})),...pw})).id;
 const layout=ok(await f.admin.request(base+'/fleet/layouts','POST',{code:'L1',nameEn:'Coach',nameAr:'Coach',active:true,rows:3,columns:4,seats:Array.from({length:12},(_,i)=>({row:Math.floor(i/4)+1,column:i%4+1,label:String(i+1)})),...pw})).id;
 const bus=ok(await f.admin.request(base+'/fleet/buses','POST',{code:'B1',registration:'REG B1',layoutId:layout,layoutRevision:1,active:true,...pw})).id,driver=ok(await f.admin.request(base+'/drivers','POST',{employeeCode:'D1',nameEn:'Driver',nameAr:'Driver',active:true,...pw})).id;
 const path=base+'/trips',trip=async(dates=[future()])=>{const id=ok(await f.admin.request(path,'POST',{routeId:route,dates,time:'07:00',offsets:[0,120],fareMinor:150000,...pw})).ids[0];ok(await f.admin.request(`${path}/${id}/assignment`,'POST',{busId:bus,driverId:driver,version:1,...pw}));ok(await f.admin.request(`${path}/${id}/publish`,'POST',{version:2,...pw}));return id;};
 ok(await f.admin.request(base+'/public-profile','PUT',{listed:true,aboutEn:'',aboutAr:'',version:0,...pw}),200);
 const branch=ok(await f.admin.request(base+'/branches','POST',{nameEn:'Branch',nameAr:'Branch',code:'BR1',active:true,...pw})).id;
 const station=ok(await f.admin.request(base+'/stations','POST',{nameEn:'Station',nameAr:'Station',code:'ST1',branchId:branch,active:true,...pw})).id;
 const counter=ok(await f.admin.request(base+'/counters','POST',{stationId:station,code:'c1',name:'Counter 1',...pw})).id;ok(await f.admin.request(base+'/counter/sessions','POST',{counterId:counter,openingMinor:100000}));
 return {cid,base,trip,pw,path,branch,station,bags:base+'/luggage'};
}
const book=(f,tripId,seats,luggage=null)=>f.client().request('public/holds','POST',{tripId,seats,key:randomUUID(),mobile:'0912345678',travelers:seats.map(seat=>({seat,name:'Fictional Traveler '+seat,luggage}))});
const bookingId=async(f,reference)=>(await f.migration.query('SELECT id FROM safeer.bookings WHERE reference=$1',[reference])).rows[0].id;
const paid=async(f,s,tripId,seats=['1'])=>{const a=ok(await book(f,tripId,seats)),bid=await bookingId(f,a.reference);ok(await f.admin.request(`${s.base}/bookings/${bid}/pay`,'POST',{method:'cash',key:randomUUID()}));const row=ok(await f.admin.request(`${s.base}/bookings/${bid}`),200);return {bid,reference:a.reference,ticket:row.tickets[0].number};};
const register=(f,s,ticketNumber,over={},c=f.admin)=>c.request(s.bags,'POST',{ticketNumber,category:'suitcase',quantity:1,weightGrams:18500,description:'Blue',handling:null,key:randomUUID(),...over});
const tag=(f,s,id,reason,c=f.admin,version)=>c.request(`${s.bags}/${id}/tag`,'POST',{...(reason?{reason}:{}),...(version?{version}:{})});
const depart=async(f,id)=>{await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.trips SET departure_at=clock_timestamp()-interval '1 minute',arrival_at=clock_timestamp()+interval '119 minutes' WHERE id=$1",[id]);await f.migration.query('SET session_replication_role=DEFAULT');};
const move=(f,s,row,to,reason)=>f.admin.request(`${s.bags}/${row.id}/move`,'POST',{to,version:row.version,...(reason?{reason}:{})});
const collect=(f,s,row,proof,reason)=>f.admin.request(`${s.bags}/${row.id}/collect`,'POST',{proof,version:row.version,...(reason?{reason}:{})});
const staff=async(f,s,permissions,assign={},scope='company')=>{
 const role=ok(await f.admin.request(s.base+'/roles','POST',{displayName:'Role '+randomUUID().slice(0,8),scope,permissions,...s.pw}));
 const made=ok(await f.admin.request(s.base+'/members','POST',{login:`bags${randomUUID().slice(0,8)}@safeer.local`,displayName:'Fictional Staff',existing:false,assignments:[{roleId:role.id,...assign}],...s.pw}));
 const c=f.client();ok(await c.signIn(made.user.login,made.temporaryPassword));const pass=randomBytes(24).toString('hex');ok(await c.request('auth/password','POST',{currentPassword:made.temporaryPassword,newPassword:pass}));return {c,pass};
};
// Reads the printed shape back with an independent decoder, as a scanner would.
const decode=qr=>{const scale=4,edge=qr.size+8,side=edge*scale,pixels=new Uint8ClampedArray(side*side*4).fill(255);for(const [,x,y] of qr.path.matchAll(/M(\d+) (\d+)h1v1h-1z/g))for(let a=0;a<scale;a++)for(let b=0;b<scale;b++){const at=((Number(y)+4)*scale+a)*side*4+((Number(x)+4)*scale+b)*4;pixels[at]=pixels[at+1]=pixels[at+2]=0;}return jsQR(pixels,side,side)?.data;};

test('travelers can declare luggage, which is only their word and goes with their name',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip(),a=ok(await book(f,id,['1'],'  Two suitcases  '));
 assert.equal(a.travelers[0].luggage,'Two suitcases');assert.deepEqual(a.luggage,[],'Saying so does not create a bag.');
 assert.equal(ok(await f.client().request('public/holds/lookup','POST',{reference:a.reference,mobile:'0912345678'})).travelers[0].luggage,undefined,'A reference and number do not reveal it.');
 assert.equal((await book(f,id,['2'],'x'.repeat(301))).error.code,'INVALID_PASSENGERS');
 assert.equal(ok(await book(f,id,['3'],'   ')).travelers[0].luggage,null,'Blank means none.');
 const bid=await bookingId(f,a.reference);await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.booking_contacts SET erase_at=clock_timestamp()-interval '1 minute' WHERE booking_id=$1",[bid]);await f.migration.query('SET session_replication_role=DEFAULT');
 await f.api.db.pool.query('SELECT safeer.erase_due_passenger_data()');assert.equal((await f.migration.query('SELECT luggage_note FROM safeer.booking_passengers WHERE booking_id=$1',[bid])).rows[0].luggage_note,null);
}));

test('bags go on paid tickets only, and follow the journey one step at a time',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip(),held=ok(await book(f,id,['5']));
 assert.equal((await register(f,s,'TKT-99999999')).error.code,'TICKET_REQUIRED','An unknown ticket has no bags.');
 const p=await paid(f,s,id),key=randomUUID(),first=ok(await register(f,s,p.ticket,{key}));assert.equal(first.lifecycle,'registered');assert.equal(first.weightGrams,18500);assert.equal(first.busRegistration,'REG B1');assert.match(first.number,/^LUG-/);
 assert.equal(ok(await register(f,s,p.ticket,{key})).id,first.id,'A repeat records one bag.');assert.equal((await register(f,s,p.ticket,{key,weightGrams:1})).error.code,'IDEMPOTENCY_CONFLICT');
 for(const over of [{weightGrams:0},{weightGrams:500001},{quantity:0},{quantity:21},{category:'crate'}])assert.equal((await register(f,s,p.ticket,over)).status,400,JSON.stringify(over));
 assert.ok(held.reference);
 assert.equal((await move(f,s,first,'loaded')).error.code,'LUGGAGE_STATE','No loading before tagging.');
 const tagged=ok(await tag(f,s,first.id));assert.equal(tagged.lifecycle,'tagged');assert.match(tagged.tagNumber,/^TAG-/);
 const changed=ok(await f.admin.request(`${s.bags}/${first.id}`,'PATCH',{category:'bag',quantity:2,weightGrams:9000,description:null,handling:'Fragile',version:tagged.version}),200);assert.equal(changed.handling,'Fragile');
 const loaded=ok(await move(f,s,changed,'loaded'));
 assert.equal((await f.admin.request(`${s.bags}/${first.id}`,'PATCH',{category:'bag',quantity:2,weightGrams:9000,version:loaded.version})).error.code,'LUGGAGE_STATE','Details freeze once loaded.');
 assert.equal((await move(f,s,loaded,'unloaded')).error.code,'LUGGAGE_STATE','No skipping.');
 assert.equal((await move(f,s,loaded,'tagged')).error.code,'REASON_REQUIRED');assert.equal((await move(f,s,changed,'tagged','x')).error.code,'STALE_VERSION');
 const back=ok(await move(f,s,loaded,'tagged','Fictional wrong bus'));assert.equal(back.events.at(-1).event,'corrected');assert.equal(back.events.at(-1).reason,'Fictional wrong bus');
 const on=ok(await move(f,s,back,'loaded'));assert.equal((await move(f,s,on,'in_transit')).error.code,'LUGGAGE_NOT_DEPARTED','A bag cannot travel before its bus.');await depart(f,id);const go=ok(await move(f,s,on,'in_transit')),off=ok(await move(f,s,go,'unloaded'));assert.equal(off.lifecycle,'unloaded');
 assert.deepEqual(off.events.map(e=>e.event),['registered','tagged','updated','moved','corrected','moved','moved','moved']);
 // The passenger sees where the bag is, not staff notes.
 const own=ok(await f.client().request('public/holds/lookup','POST',{reference:p.reference,mobile:'0912345678'}));assert.deepEqual(own.luggage.map(b=>b.status),['unloaded']);assert.equal(JSON.stringify(own).includes('Fragile'),false);
 const gone=await s.trip([future(20)]),left=await paid(f,s,gone);await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.trips SET departure_at=clock_timestamp()-interval '1 minute',arrival_at=clock_timestamp()+interval '119 minutes' WHERE id=$1",[gone]);await f.migration.query('SET session_replication_role=DEFAULT');
 assert.equal((await register(f,s,left.ticket)).error.code,'TRIP_NOT_BOOKABLE','No new bags once the bus has left.');
}));

test('a tag holds an opaque value shown once, and printing again retires the old one',async()=>identityFixture(async f=>{
 const s=await setup(f),p=await paid(f,s,await s.trip()),bag=ok(await register(f,s,p.ticket)),one=ok(await tag(f,s,bag.id));
 assert.match(one.token,/^LQ[2-9A-Z]{24}$/);assert.equal(decode(one.qr),one.token,'A real decoder reads the printed QR.');
 const stored=(await f.migration.query('SELECT qr_hash FROM safeer.luggage_tags')).rows[0].qr_hash;assert.notEqual(stored,one.token);assert.match(stored,/^[0-9a-f]{64}$/);
 assert.equal(ok(await f.admin.request(`${s.bags}/scan`,'POST',{token:one.token.toLowerCase()})).items[0].id,bag.id);
 const found=ok(await f.admin.request(`${s.bags}?q=${one.tagNumber}`),200).items[0];assert.equal(found.token,undefined,'The value is never shown again.');assert.equal(JSON.stringify(found).includes(one.token),false);
 assert.equal((await tag(f,s,bag.id)).error.code,'TAG_REASON_REQUIRED');
 assert.equal((await tag(f,s,bag.id,'Fictional stale screen',f.admin,one.version+5)).error.code,'STALE_VERSION','Replacing says which tag was meant.');const two=ok(await tag(f,s,bag.id,'Fictional torn tag',f.admin,one.version));assert.notEqual(two.token,one.token);assert.notEqual(two.tagNumber,one.tagNumber);assert.equal(two.lifecycle,'tagged');
 assert.equal((await f.admin.request(`${s.bags}/scan`,'POST',{token:one.token})).error.code,'TAG_REPLACED');assert.equal(ok(await f.admin.request(`${s.bags}/scan`,'POST',{token:two.token})).items[0].id,bag.id);
 assert.equal(ok(await f.admin.request(`${s.bags}?q=${one.tagNumber}`),200).items.length,0);
 assert.equal((await f.admin.request(`${s.bags}/scan`,'POST',{token:'LQ'+'2'.repeat(24)})).error.code,'TAG_UNKNOWN');assert.equal((await f.admin.request(`${s.bags}/scan`,'POST',{token:'nonsense'})).error.code,'TAG_UNKNOWN');
 // Another company's tag means nothing here.
 const rival=await setup(f,'bag-rival');assert.equal((await f.admin.request(`${rival.bags}/scan`,'POST',{token:two.token})).error.code,'TAG_UNKNOWN');
}));

test('collection needs the ticket or mobile, and an open problem blocks it until resolved',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip(),p=await paid(f,s,id),bag=ok(await register(f,s,p.ticket));ok(await tag(f,s,bag.id));
 const row=async()=>ok(await f.admin.request(`${s.bags}?q=${bag.number}`),200).items[0];
 let at=await row();at=ok(await move(f,s,at,'loaded'));
 assert.equal((await collect(f,s,at,p.ticket)).error.code,'LUGGAGE_STATE','A bag on the bus cannot be handed over.');
 await depart(f,id);at=ok(await move(f,s,at,'in_transit'));at=ok(await move(f,s,at,'unloaded'));
 assert.equal((await collect(f,s,at,'TKT-00000000')).error.code,'COLLECTION_NOT_VERIFIED');assert.equal((await collect(f,s,at,'0999999999')).error.code,'COLLECTION_NOT_VERIFIED');assert.equal((await collect(f,s,at,'not a number')).error.code,'COLLECTION_NOT_VERIFIED');
 // Any luggage staff can report. Resolving takes its own permission and the password.
 const reporter=await staff(f,s,['company.profile.read','company.luggage.operate']);
 const open=ok(await reporter.c.request(`${s.bags}/${bag.id}/exceptions`,'POST',{kind:'damaged',note:'Fictional torn handle'}));assert.equal(open.status,'exception_reported');assert.equal(open.lifecycle,'unloaded','The journey record stays.');
 assert.equal((await reporter.c.request(`${s.bags}/${bag.id}/exceptions`,'POST',{kind:'other'})).error.code,'LUGGAGE_EXCEPTION_OPEN');
 assert.equal((await collect(f,s,at,p.ticket)).error.code,'LUGGAGE_EXCEPTION_OPEN');
 assert.equal(ok(await f.client().request('public/holds/lookup','POST',{reference:p.reference,mobile:'0912345678'})).luggage[0].status,'exception_reported');
 const eid=open.exception.id,resolve=(c,currentPassword)=>c.request(`${s.bags}/${bag.id}/exceptions/${eid}/resolve`,'POST',{outcome:'settled',note:'Fictional repair',currentPassword});
 assert.equal((await resolve(reporter.c,reporter.pass)).status,403,'Reporting does not give resolving.');assert.equal((await resolve(f.admin,'wrong')).error.code,'REAUTHENTICATION_FAILED');
 const manager=await staff(f,s,['company.profile.read','company.luggage.resolve']),done=ok(await resolve(manager.c,manager.pass));assert.equal(done.status,'unloaded');assert.equal(done.exception,null);
 assert.equal((await resolve(f.admin,f.password)).error.code,'LUGGAGE_STATE','A problem is resolved once.');
 assert.equal((await manager.c.request(`${s.bags}/${bag.id}/move`,'POST',{to:'loaded',version:1})).status,403,'Resolving does not give handling.');
 at=await row();const given=ok(await collect(f,s,at,'+249912345678'));assert.equal(given.lifecycle,'collected');assert.equal(given.events.at(-1).event,'collected');
 assert.equal((await tag(f,s,bag.id,'x')).error.code,'LUGGAGE_STATE');
}));

test('a ticket cannot be refunded while its bags are with the company',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip(),p=await paid(f,s,id),refund=key=>f.admin.request(`${s.base}/bookings/${p.bid}/refund`,'POST',{reason:'Fictional change',key,currentPassword:f.password});
 const before=(await f.migration.query('SELECT count(*)::int AS n FROM safeer.document_sequences WHERE document_type=$1',['refund'])).rows[0].n;
 const bag=ok(await register(f,s,p.ticket));assert.equal((await refund(randomUUID())).error.code,'LUGGAGE_HELD');
 assert.equal((await f.migration.query('SELECT count(*)::int AS n FROM safeer.document_sequences WHERE document_type=$1',['refund'])).rows[0].n,before,'A refused refund uses no number.');
 assert.equal((await collect(f,s,bag,p.ticket)).error.code,'REASON_REQUIRED','Giving a bag back before travel needs a reason.');
 const back=ok(await collect(f,s,bag,p.ticket,'Fictional change of plans'));assert.equal(back.events.at(-1).event,'returned');
 ok(await refund(randomUUID()));assert.equal((await register(f,s,p.ticket)).error.code,'TICKET_REQUIRED','No bags on a refunded ticket.');
 // A canceled trip still gets its bags back: off the bus, then returned, then refunded.
 const t2=await s.trip([future(21)]),q=await paid(f,s,t2),b2=ok(await register(f,s,q.ticket));ok(await tag(f,s,b2.id));let at=ok(await f.admin.request(`${s.bags}?q=${b2.number}`),200).items[0];at=ok(await move(f,s,at,'loaded'));
 ok(await f.admin.request(`${s.path}/${t2}/cancel`,'POST',{reason:'Fictional closure',version:3,...s.pw}));
 assert.equal((await move(f,s,at,'in_transit')).error.code,'LUGGAGE_STATE','No bag travels on a canceled trip.');
 assert.equal((await f.admin.request(`${s.base}/bookings/${q.bid}/refund`,'POST',{reason:'Canceled',key:randomUUID(),currentPassword:f.password})).error.code,'LUGGAGE_HELD');
 at=ok(await move(f,s,at,'tagged','Fictional trip canceled'));ok(await collect(f,s,at,'0912345678','Fictional trip canceled'));
 ok(await f.admin.request(`${s.base}/bookings/${q.bid}/refund`,'POST',{reason:'Canceled',key:randomUUID(),currentPassword:f.password}));
 // A bag the company lost ends there, and does not hold up the refund. No false handover is needed.
 const t3=await s.trip([future(22)]),l=await paid(f,s,t3),b3=ok(await register(f,s,l.ticket)),missing=ok(await f.admin.request(`${s.bags}/${b3.id}/exceptions`,'POST',{kind:'missing'}));
 assert.equal((await f.admin.request(`${s.base}/bookings/${l.bid}/refund`,'POST',{reason:'Lost',key:randomUUID(),currentPassword:f.password})).error.code,'LUGGAGE_HELD');
 const lost=ok(await f.admin.request(`${s.bags}/${b3.id}/exceptions/${missing.exception.id}/resolve`,'POST',{outcome:'settled',currentPassword:f.password}));assert.equal(lost.lifecycle,'lost');assert.equal(lost.events.at(-1).to,'lost');assert.equal((await collect(f,s,lost,l.ticket,'x')).error.code,'LUGGAGE_STATE');
 ok(await f.admin.request(`${s.base}/bookings/${l.bid}/refund`,'POST',{reason:'Lost',key:randomUUID(),currentPassword:f.password}));
}));

test('access, company isolation, permanent history and erasure',async()=>identityFixture(async f=>{
 const s=await setup(f),rival=await setup(f,'bag-other'),p=await paid(f,s,await s.trip()),bag=ok(await register(f,s,p.ticket,{description:'Fictional owner Amna',handling:'Call 0912345678'}));
 assert.equal((await f.client().request(s.bags)).status,401);
 const none=await staff(f,s,['company.profile.read','company.bookings.read']);assert.equal((await none.c.request(s.bags)).status,403);assert.equal((await register(f,s,p.ticket,{},none.c)).status,403);assert.equal((await tag(f,s,bag.id,undefined,none.c)).status,403);
 assert.equal((await register(f,rival,p.ticket)).error.code,'TICKET_REQUIRED','A ticket from another company is unknown here.');assert.equal((await f.admin.request(`${rival.bags}/${bag.id}/tag`,'POST',{})).status,404);
 assert.equal(ok(await f.admin.request(`${rival.bags}?q=${bag.number}`),200).items.length,0);
 // Station staff need a number. Lists are company-wide.
 const scoped=await staff(f,s,['company.profile.read','company.luggage.operate'],{branchId:s.branch,stationId:s.station},'station');
 const blank=ok(await scoped.c.request(s.bags),200);assert.equal(ok(await scoped.c.request(`${s.bags}?q=${p.ticket}`),200).ticket.reference,null,'Search-only staff get no route into the booking.');assert.equal(blank.searchOnly,true);assert.equal(blank.items.length,0);
 const byTicket=ok(await scoped.c.request(`${s.bags}?q=${p.ticket}`),200);assert.equal(byTicket.items[0].id,bag.id);assert.equal(byTicket.ticket.number,p.ticket);assert.equal(byTicket.items[0].reference,undefined);assert.equal(ok(await scoped.c.request(`${s.bags}?q=${p.reference}`),200).items.length,1);
 assert.equal(ok(await f.admin.request(s.bags),200).items.length,1);assert.equal((await f.admin.request(`${s.bags}?q=whatever`)).status,400);
 const actions=(await f.migration.query("SELECT DISTINCT action FROM safeer.company_audit WHERE action LIKE 'luggage.%'")).rows.map(r=>r.action);for(const a of ['luggage.registered','luggage.listed','luggage.searched'])assert.ok(actions.includes(a),a);
 for(const table of ['luggage_records','luggage_tags','luggage_events','luggage_exceptions'])await assert.rejects(f.api.db.pool.query(`SELECT * FROM safeer.${table}`),e=>e.code==='42501',table);
 await assert.rejects(f.api.db.pool.query("SELECT safeer.luggage_find($1,NULL,NULL)",[s.cid]),e=>e.code==='42501','Without a session, luggage functions refuse.');
 await assert.rejects(f.api.db.pool.query("SELECT safeer.luggage_status(NULL::safeer.luggage_records)"),e=>e.code==='42501');
 for(const sql of ['DELETE FROM safeer.luggage_records','DELETE FROM safeer.luggage_events',"UPDATE safeer.luggage_events SET event='moved'","UPDATE safeer.luggage_records SET luggage_number='X'",'UPDATE safeer.luggage_records SET ticket_id=gen_random_uuid()'])await assert.rejects(f.migration.query(sql),e=>e.code==='42501',sql);
 ok(await f.admin.request(`${s.bags}/${bag.id}/exceptions`,'POST',{kind:'other',note:'Fictional note'}));
 await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.booking_contacts SET erase_at=clock_timestamp()-interval '1 minute'");await f.migration.query('SET session_replication_role=DEFAULT');
 await f.api.db.pool.query('SELECT safeer.erase_due_passenger_data()');
 const row=ok(await f.admin.request(`${s.bags}?q=${bag.number}`),200).items[0];assert.equal(row.description,null);
 const edited=ok(await f.admin.request(`${s.bags}/${bag.id}`,'PATCH',{category:'bag',quantity:1,weightGrams:9000,description:'Fictional name added later',handling:'Call later',version:row.version}),200);assert.equal(edited.description,null,'Text cannot return after erasure.');assert.equal(edited.handling,null);assert.equal(edited.events.at(-1).before.weightGrams,18500,'The old weight stays on record.');
 // Typed numbers are limited, so nobody can walk through them.
 let refused=0;for(let i=0;i<305&&!refused;i++)if((await scoped.c.request(`${s.bags}?q=TKT-${String(i).padStart(8,'0')}`)).status===429)refused=i+1;assert.ok(refused>0,'The search limit applies.');assert.equal(row.handling,null);assert.equal(row.traveler,null);assert.equal(row.exception.note,null);assert.equal(row.weightGrams,18500,'The record of the bag stays.');assert.equal(row.events.some(e=>e.reason),false);
}));
