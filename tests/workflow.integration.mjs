import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';
import {startServer} from '../server.mjs';

// Whole-workflow regression: every call goes through the hosted web proxy (server.mjs with an
// https public origin, as on Render) to the API and a disposable PostgreSQL. Staff use their own
// company roles, never the platform owner, except where only the owner may act. Fictional data only.
const HOST='safeer.example',ORIGIN='https://'+HOST;
const ok=(r,status=201)=>{assert.equal(r.status,status,`${r.status} ${r.raw}`);return r.data;};
const fail=(r,status,code)=>{assert.equal(r.status,status,`${r.status} ${r.raw}`);if(code)assert.equal(r.error?.code,code,r.raw);return r.error;};
const future=(days=10)=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
const khartoumDay=(at=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Khartoum'}).format(at);

// A browser-like visitor: its own cookie jar, CSRF token and client address (X-Forwarded-For from the edge).
function visitor(web,ip){
 const jar=new Map();let csrf='';
 const send=(path,{method='GET',body,headers={}}={})=>new Promise((resolve,reject)=>{
  const raw=body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body),cookie=[...jar].map(([k,v])=>k+'='+v).join('; ');
  const r=httpRequest(web.origin+path,{method,headers:{host:HOST,'x-forwarded-for':ip,...(cookie?{cookie}:{}),...(method!=='GET'?{origin:ORIGIN,...(csrf?{'x-csrf-token':csrf}:{})}:{}),...(raw!==undefined?{'content-type':'application/json','content-length':Buffer.byteLength(raw)}:{}),...headers}},res=>{
   let text='';res.setEncoding('utf8');res.on('data',c=>text+=c);res.on('end',()=>{
    for(const c of res.headers['set-cookie']||[]){const [pair]=c.split(';'),i=pair.indexOf('='),k=pair.slice(0,i),v=pair.slice(i+1);if(v)jar.set(k,v);else jar.delete(k);}
    let json;try{json=JSON.parse(text);}catch{json={};}
    if(typeof json.data?.csrfToken==='string')csrf=json.data.csrfToken;
    resolve({status:res.statusCode,headers:res.headers,json,data:json.data,error:json.error,raw:text});
   });
  });
  r.on('error',reject);r.end(raw);
 });
 const api=(path,method='GET',body,headers)=>send('/api/v1/'+path,{method,body,headers});
 return {send,api,jar,get csrf(){return csrf;}};
}
async function hosted(f,action){
 const web=await startServer({port:0,identityApiUrl:f.api.origin,publicOrigin:ORIGIN,loopbackOnly:true});
 try{await action(web);}finally{await web.close();}
}
// New staff arrive with a temporary password and must replace it before anything else.
async function employee(web,ip,made){
 const v=visitor(web,ip),signed=ok(await v.api('auth/login','POST',{login:made.user.login,password:made.temporaryPassword}));
 assert.equal(signed.user.mustChangePassword,true);
 fail(await v.api('companies'),403,'PASSWORD_CHANGE_REQUIRED');
 const password=randomBytes(18).toString('base64url');
 ok(await v.api('auth/password','POST',{currentPassword:made.temporaryPassword,newPassword:password}));
 return {v,password,pw:{currentPassword:password}};
}
const time=async(f,trip,offset)=>{
 await f.migration.query('SET session_replication_role=replica');
 try{await f.migration.query("UPDATE safeer.trips SET departure_at=clock_timestamp()+$2::interval,arrival_at=clock_timestamp()+$2::interval+interval '240 minutes' WHERE id=$1",[trip,offset]);}
 finally{await f.migration.query('SET session_replication_role=DEFAULT');}
};

test('hosted proxy: company setup, guest booking, counter payment, luggage, driver boarding, shipment, journey and reports',()=>identityFixture(async f=>hosted(f,async web=>{
 // Platform owner: sign in through the edge, create the shared city catalog and approve the operator.
 const owner=visitor(web,'198.51.100.1');
 const signed=await owner.api('auth/login','POST',{login:'owner@safeer.local',password:f.password});ok(signed);
 const sessionCookie=signed.headers['set-cookie'].find(c=>c.startsWith('safeer_session='));
 for(const flag of ['HttpOnly','SameSite=Strict','Secure','Path=/api/v1'])assert.ok(sessionCookie.includes(flag),'session cookie lacks '+flag);
 assert.ok(signed.headers['strict-transport-security']);
 const opw={currentPassword:f.password},cities={};
 for(const [key,en] of [['NORTH','Fictional North'],['MID','Fictional Middle'],['SOUTH','Fictional South']])cities[key]=ok(await owner.api('cities','POST',{code:'WF_'+key,nameEn:en,nameAr:'مدينة '+en,countryCode:'SD',active:true,...opw})).id;
 const cid=ok(await owner.api('companies','POST',{nameEn:'Fictional Workflow Coaches',nameAr:'حافلات تجريبية',slug:'workflow-coaches',holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...opw})).id,base='companies/'+cid;
 let w=ok(await owner.api(base),200);assert.equal(w.company.status,'pending');
 ok(await owner.api(base,'PATCH',{...w.company,id:undefined,status:'approved',...opw}),200);
 w=ok(await owner.api(base),200);const role=code=>w.roles.find(r=>r.code===code);
 assert.ok(role('company_administrator'),'company administrator template copied: '+w.roles.map(r=>r.code));
 const adminMade=ok(await owner.api(base+'/members','POST',{login:'wf.admin@safeer.local',displayName:'Fictional Company Admin',existing:false,assignments:[{roleId:role('company_administrator').id}],...opw}));

 // Company administrator builds the network, fleet, staff and timetable.
 const admin=await employee(web,'198.51.100.2',adminMade),A=admin.v,apw=admin.pw;
 assert.deepEqual(ok(await A.api('companies'),200).items.map(c=>c.id),[cid]);
 fail(await A.api('identity/users'),403);
 const branch=ok(await A.api(base+'/branches','POST',{nameEn:'Fictional Branch',nameAr:'فرع',code:'BR1',active:true,...apw})).id;
 const station=async(code,city)=>ok(await A.api(base+'/stations','POST',{nameEn:'Fictional '+code+' Office',nameAr:'مكتب '+code,code,branchId:branch,cityId:cities[city],active:true,...apw})).id;
 const north=await station('NST','NORTH'),south=await station('SST','SOUTH');
 const route=ok(await A.api(base+'/routes','POST',{code:'WF1',nameEn:'North to South',nameAr:'الشمال إلى الجنوب',active:true,stops:[{cityId:cities.NORTH,stationId:north},{cityId:cities.MID},{cityId:cities.SOUTH,stationId:south}],...apw})).id;
 const layout=ok(await A.api(base+'/fleet/layouts','POST',{code:'L12',nameEn:'Coach 12',nameAr:'حافلة 12',active:true,rows:3,columns:4,seats:Array.from({length:12},(_,i)=>({row:Math.floor(i/4)+1,column:i%4+1,label:String(i+1)})),...apw})).id;
 const bus=ok(await A.api(base+'/fleet/buses','POST',{code:'B1',registration:'WF 101',layoutId:layout,layoutRevision:1,active:true,...apw})).id;
 const member=async(login,roleCode,extra={})=>ok(await A.api(base+'/members','POST',{login,displayName:'Fictional '+login.split('@')[0],existing:false,assignments:[{roleId:role(roleCode).id,...extra}],...apw}));
 const cashierMade=await member('wf.cashier@safeer.local','ticketing_employee',{branchId:branch,stationId:north});
 const driverRole=w.roles.find(r=>r.code==='assigned_driver')||ok(await A.api(base+'/roles','POST',{displayName:'Workflow driver',scope:'company',permissions:['company.driver.operate'],...apw}));
 const driverMade=ok(await A.api(base+'/members','POST',{login:'wf.driver@safeer.local',displayName:'Fictional Driver',jobTitle:'Driver',phone:'0911111111',existing:false,assignments:[{roleId:driverRole.id}],...apw}));
 const bagRole=ok(await A.api(base+'/roles','POST',{displayName:'Workflow luggage',scope:'company',permissions:['company.luggage.operate'],...apw}));
 const bagsMade=ok(await A.api(base+'/members','POST',{login:'wf.bags@safeer.local',displayName:'Fictional Luggage Handler',existing:false,assignments:[{roleId:bagRole.id}],...apw}));
 w=ok(await A.api(base),200);
 const driverMember=w.members.find(m=>m.login==='wf.driver@safeer.local');assert.ok(driverMember,'driver membership listed');
 const driver=ok(await A.api(base+'/drivers','POST',{employeeCode:'D1',nameEn:'Fictional Driver',nameAr:'سائق',phone:'0911111111',memberId:driverMember.id,active:true,...apw})).id;
 const counter=ok(await A.api(base+'/counters','POST',{stationId:north,code:'N1',name:'North counter 1',...apw})).id;
 ok(await A.api(base+'/payment-settings','PUT',{bankTransfer:true,mobileWallet:false,version:0,...apw}),200);
 ok(await A.api(base+'/public-profile','PUT',{listed:true,aboutEn:'Fictional operator',aboutAr:'شركة تجريبية',phone:'+249 911 000000',version:0,...apw}),200);
 const date=future(10),tripId=ok(await A.api(base+'/trips','POST',{routeId:route,dates:[date],time:'07:30',offsets:[0,150,300],fareMinor:250000,...apw})).ids[0];
 fail(await A.api(`${base}/trips/${tripId}/publish`,'POST',{version:1,...apw}),409,'TRIP_NOT_READY');
 ok(await A.api(`${base}/trips/${tripId}/assignment`,'POST',{busId:bus,driverId:driver,version:1,...apw}));
 ok(await A.api(`${base}/trips/${tripId}/publish`,'POST',{version:2,...apw}));
 for(const [category,priceMinor] of [['envelope',20000],['small',50000]])ok(await A.api(base+'/shipments/prices','POST',{category,priceMinor,active:true}));

 // Anonymous passengers find the trip on the public marketplace and hold seats as guests.
 const amna=visitor(web,'203.0.113.10'),omar=visitor(web,'203.0.113.11');
 assert.ok(ok(await amna.api('public/companies'),200).items.some(c=>c.slug==='workflow-coaches'));
 const found=ok(await amna.api('public/trips?'+new URLSearchParams({from:'WF_NORTH',to:'WF_SOUTH',date})),200).items;
 assert.deepEqual(found.map(t=>t.id),[tripId]);assert.equal(found[0].seatsLeft,12);
 assert.equal(found[0].stops[0].stationNameEn,'Fictional NST Office','pickup office shown');
 const seatMap=ok(await amna.api('public/trips/'+tripId),200);assert.equal(seatMap.seats.filter(s=>s.available).length,12);
 const amnaKey=randomUUID();
 const amnaHold=ok(await amna.api('public/holds','POST',{tripId,seats:['1','2'],key:amnaKey,mobile:'0912 345 678',travelers:[{seat:'1',name:'آمنة التجريبية',luggage:'حقيبة زرقاء كبيرة'},{seat:'2',name:'Fictional Child Traveler',mobile:'+249 900 000 001'}]}));
 assert.equal(amnaHold.status,'held');assert.equal(amnaHold.amountMinor,500000);assert.match(amnaHold.reference,/^SF-[2-9A-HJ-NP-Z]{8}$/);
 // The same request again (a lost reply) returns the same hold; a different body with the key is refused.
 assert.equal(ok(await amna.api('public/holds','POST',{tripId,seats:['1','2'],key:amnaKey,mobile:'0912 345 678',travelers:[{seat:'1',name:'آمنة التجريبية',luggage:'حقيبة زرقاء كبيرة'},{seat:'2',name:'Fictional Child Traveler',mobile:'+249 900 000 001'}]})).reference,amnaHold.reference);
 // Two guests racing for the same seat: exactly one wins, and the loser holds nothing.
 const race=await Promise.all([amna,omar].map(v=>v.api('public/holds','POST',{tripId,seats:['5'],key:randomUUID(),mobile:'0923456789',travelers:[{seat:'5',name:'Fictional Racer'}]})));
 assert.deepEqual(race.map(r=>r.status).sort(),[201,409]);
 const raceWinner=race.find(r=>r.status===201).data;
 ok(await (race[0].status===201?amna:omar).api(`public/holds/${raceWinner.reference}/release`,'POST',{mobile:'0923456789'}));
 // A guest on another device sees a masked booking with no ticket QR.
 const lookedUp=ok(await omar.api('public/holds/lookup','POST',{reference:amnaHold.reference,mobile:'+249912345678'}));
 assert.equal(lookedUp.retrieved,true);assert.ok(!JSON.stringify(lookedUp).includes('912345678'),'mobile is masked');
 const omarKey=randomUUID(),omarHold=ok(await omar.api('public/holds','POST',{tripId,seats:['3'],key:omarKey,mobile:'0998765432',travelers:[{seat:'3',name:'Fictional Omar'}]}));

 // Cashier at the north counter: open a session, find the booking, take cash, print tickets.
 const cashier=await employee(web,'198.51.100.3',cashierMade),C=cashier.v;
 const overview=ok(await C.api(base+'/counter'),200);assert.deepEqual(overview.counters.map(c=>c.id),[counter]);
 const session=ok(await C.api(base+'/counter/sessions','POST',{counterId:counter,openingMinor:100000})).id;
 const search=ok(await C.api(base+'/bookings?q='+amnaHold.reference.toLowerCase()),200).items;assert.equal(search.length,1);
 const amnaBid=search[0].id;
 const payKey=randomUUID(),paid=ok(await C.api(`${base}/bookings/${amnaBid}/pay`,'POST',{method:'cash',key:payKey}));
 assert.deepEqual(ok(await C.api(`${base}/bookings/${amnaBid}/pay`,'POST',{method:'cash',key:payKey})),paid,'retried payment returns the original');
 fail(await C.api(`${base}/bookings/${amnaBid}/pay`,'POST',{method:'cash',key:randomUUID()}),409,'ALREADY_PAID');
 const tickets=ok(await C.api(`${base}/bookings/${amnaBid}/print`,'POST',{document:'tickets'}));assert.equal(tickets.copy,false);assert.equal(tickets.codes.length,2);
 assert.equal(ok(await C.api(`${base}/bookings/${amnaBid}/print`,'POST',{document:'tickets'})).copy,true,'second print is a copy');
 ok(await C.api(`${base}/bookings/${amnaBid}/print`,'POST',{document:'receipt'}));
 const detail=ok(await C.api(`${base}/bookings/${amnaBid}`),200);assert.equal(detail.status,'confirmed');
 const ticketBySeat=Object.fromEntries(detail.tickets.map(t=>[t.seat,t.number]));
 // The guest's own device now shows the confirmed tickets with QR; the lookup view never does.
 const mine=ok(await amna.api('public/holds/'+amnaHold.reference,'GET',undefined,{'x-booking-key':amnaKey}),200);
 assert.equal(mine.status,'confirmed');assert.equal(mine.tickets.length,2);assert.ok(mine.tickets.every(t=>t.qr));
 assert.ok(ok(await omar.api('public/holds/lookup','POST',{reference:amnaHold.reference,mobile:'0912345678'})).tickets.every(t=>!t.qr));
 // A walk-in buys at the counter by bank transfer; it needs a transfer reference.
 fail(await C.api(base+'/counter/sales','POST',{tripId,seats:['7'],mobile:'0934567890',travelers:[{seat:'7',name:'Fictional Walk-in'}],method:'bank_transfer',key:randomUUID()}),400,'REFERENCE_REQUIRED');
 const sale=ok(await C.api(base+'/counter/sales','POST',{tripId,seats:['7'],mobile:'0934567890',travelers:[{seat:'7',name:'Fictional Walk-in'}],method:'bank_transfer',reference:'BT-WF-0001',key:randomUUID()}));
 assert.equal(ok(await C.api(`${base}/bookings/${sale.id}`),200).status,'confirmed',JSON.stringify(sale));
 const totals=ok(await C.api(base+'/counter'),200).session.totals;assert.equal(totals.cashIn,500000);assert.equal(totals.otherIn,250000);

 // Luggage handler registers and tags the declared bag on Amna's paid ticket.
 const bags=await employee(web,'198.51.100.4',bagsMade),L=bags.v;
 let bag=ok(await L.api(base+'/luggage','POST',{ticketNumber:ticketBySeat['1'],category:'suitcase',quantity:1,weightGrams:18000,description:'Fictional blue suitcase',key:randomUUID()}));
 bag=ok(await L.api(`${base}/luggage/${bag.id}/tag`,'POST',{}));assert.match(bag.token,/^LQ/);
 const scanned=ok(await L.api(base+'/luggage/scan','POST',{token:bag.token}),201).items;assert.equal(scanned[0].id,bag.id);
 const moveBag=async to=>{bag=ok(await L.api(`${base}/luggage/${bag.id}/move`,'POST',{to,version:bag.version}));assert.equal(bag.lifecycle,to);};
 await moveBag('loaded');
 fail(await L.api(`${base}/luggage/${bag.id}/move`,'POST',{to:'in_transit',version:bag.version}),409,'LUGGAGE_NOT_DEPARTED');

 // Shipments: the cashier takes a parcel for the south office on this trip.
 const shipment=ok(await C.api(base+'/shipments','POST',{tripId,destinationId:south,senderName:'Fictional Sender',senderMobile:'0911222333',receiverName:'Fictional Receiver',receiverMobile:'0999888777',items:[{category:'small',description:'Fictional books',weightGrams:3000},{category:'envelope',weightGrams:100}],method:'cash',declared:true,key:randomUUID()}));
 assert.equal(shipment.amountMinor,70000,JSON.stringify(shipment));assert.match(shipment.trackingCode,/^SH-/);
 let parcel=ok(await C.api(`${base}/shipments/${shipment.id}/tag`,'POST',{}));
 const moveParcel=async to=>{parcel=ok(await C.api(`${base}/shipments/${parcel.id}/move`,'POST',{to,version:parcel.version}));assert.equal(parcel.status,to);};
 await moveParcel('loaded');
 const tracked=ok(await visitor(web,'203.0.113.12').api('public/shipments/'+shipment.trackingCode.toLowerCase()),200);
 assert.equal(tracked.status,'loaded');assert.ok(!JSON.stringify(tracked).includes('Fictional Receiver'),'tracking hides people');

 // The trip is about to leave: the assigned driver signs in, sees only this trip and boards passengers.
 await time(f,tripId,'45 minutes');
 const drv=await employee(web,'198.51.100.5',driverMade),D=drv.v,dbase=`driver/companies/${cid}/trips/${tripId}`;
 assert.deepEqual(ok(await D.api('driver/trips'),200).items.map(t=>t.id),[tripId]);
 assert.ok([403,404].includes((await D.api(base+'/counter')).status),'drivers have no counter access');
 let manifest=ok(await D.api(dbase),200);assert.equal(manifest.passengers.length,3,'three valid tickets');
 assert.ok(!JSON.stringify(manifest).includes('0912345678'),'manifest has no passenger mobile');
 const qr=tickets.codes.find(c=>c.number===ticketBySeat['1']).token;
 const checked=ok(await D.api(dbase+'/verify','POST',{token:qr}));assert.equal(checked.boardedAt??null,null,'checking is not boarding');
 const boarded=ok(await D.api(dbase+'/board','POST',{token:qr}));assert.ok(boarded.boardedAt);
 assert.equal(ok(await D.api(dbase+'/board','POST',{token:qr})).boardedAt,boarded.boardedAt,'repeat scan is idempotent');
 ok(await D.api(dbase+'/board','POST',{ticketNumber:ticketBySeat['2'].toLowerCase()}));
 // Omar never paid: his hold has no ticket, so there is nothing to scan; a made-up token is refused.
 fail(await D.api(dbase+'/board','POST',{token:'TQ'+'0'.repeat(64)}),409,'TICKET_INVALID');
 const opsDay=khartoumDay(new Date(Date.now()+45*60000)),ops=ok(await A.api(`${base}/operations?day=${opsDay}`),200);
 const row=ops.departures.find(d=>d.id===tripId);assert.ok(row,'trip on the operations board');assert.equal(row.booked,3);assert.equal(row.boarded,2);

 // Departure: luggage and parcels go in transit, then arrive and are handed over with proof.
 await time(f,tripId,'-2 minutes');
 ok(await D.api(dbase+'/events','POST',{event:'departed'}));
 await moveBag('in_transit');await moveParcel('in_transit');
 ok(await D.api(dbase+'/incidents','POST',{kind:'delay',note:'Fictional checkpoint delay',key:randomUUID()}));
 ok(await D.api(dbase+'/events','POST',{event:'arrived'}));
 await moveBag('unloaded');await moveParcel('arrived');
 fail(await L.api(`${base}/luggage/${bag.id}/collect`,'POST',{proof:'0900000009',version:bag.version}),409,'COLLECTION_NOT_VERIFIED');
 bag=ok(await L.api(`${base}/luggage/${bag.id}/collect`,'POST',{proof:'0912345678',version:bag.version}));assert.equal(bag.lifecycle,'collected');
 fail(await C.api(`${base}/shipments/${parcel.id}/deliver`,'POST',{receiverName:'Someone Else',receiverMobile:'0999888777',version:parcel.version}),409,'RECEIVER_NOT_VERIFIED');
 parcel=ok(await C.api(`${base}/shipments/${parcel.id}/deliver`,'POST',{receiverName:'fictional receiver',receiverMobile:'+249999888777',version:parcel.version}));assert.equal(parcel.status,'delivered');

 // A refund of a boarded, travelled ticket is closed after departure.
 fail(await C.api(`${base}/bookings/${amnaBid}/refund`,'POST',{reason:'Fictional late refund',key:randomUUID(),...cashier.pw}),409);

 // Counter close with a counted difference, then reports for the company and the platform.
 const counted=100000+500000+70000-1000;
 const closed=ok(await C.api(`${base}/counter/sessions/${session}/close`,'POST',{countedMinor:counted,note:'Fictional count difference',...cashier.pw}));
 assert.equal(Number(closed.countedMinor)-Number(closed.expectedMinor),-1000,JSON.stringify(closed));assert.ok(closed.closedAt);
 const day=khartoumDay(),report=ok(await A.api(`${base}/finance?`+new URLSearchParams({from:day,to:day})),200);
 const net=report.totals.reduce((n,t)=>n+Number(t.netMinor),0);assert.equal(net,500000+250000+70000,JSON.stringify(report.totals));
 fail(await C.api(`${base}/finance?`+new URLSearchParams({from:day,to:day})),403);
 const platform=ok(await owner.api('platform/dashboard?'+new URLSearchParams({from:new Date().toISOString().slice(0,10),to:new Date().toISOString().slice(0,10)})),200);
 assert.ok(!JSON.stringify(platform).includes('0912345678'),'no passenger data on the platform dashboard');
 const alerts=ok(await A.api('notifications'),200).items.map(n=>n.code);assert.ok(alerts.includes('journey.incident'),alerts.join());

 // The passenger's own view after the journey.
 const after=ok(await amna.api('public/holds/'+amnaHold.reference,'GET',undefined,{'x-booking-key':amnaKey}),200);
 assert.equal(after.luggage[0].status,'collected');
 // Omar's unpaid hold expires on the database clock and his seat returns.
 await f.migration.query("UPDATE safeer.bookings SET expires_at=clock_timestamp()-interval '1 second' WHERE reference=$1",[omarHold.reference]).catch(async()=>{
  await f.migration.query('SET session_replication_role=replica');try{await f.migration.query("UPDATE safeer.bookings SET expires_at=clock_timestamp()-interval '1 second' WHERE reference=$1",[omarHold.reference]);}finally{await f.migration.query('SET session_replication_role=DEFAULT');}
 });
 assert.equal(ok(await omar.api('public/holds/'+omarHold.reference,'GET',undefined,{'x-booking-key':omarKey}),200).status,'expired');
}),{webOrigin:ORIGIN}));

test('hosted proxy: public lookup and hold limits are counted per visitor, not shared by everyone behind the proxy',()=>identityFixture(async f=>hosted(f,async web=>{
 const crowd=visitor(web,'203.0.113.50'),neighbour=visitor(web,'203.0.113.51');
 const guess=()=>'SF-'+Array.from({length:8},()=>'23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random()*32)]).join('');
 for(let i=0;i<30;i++)fail(await crowd.api('public/holds/lookup','POST',{reference:guess(),mobile:'0912345678'}),404,'NOT_FOUND');
 fail(await crowd.api('public/holds/lookup','POST',{reference:guess(),mobile:'0912345678'}),429,'RATE_LIMITED');
 // Another passenger elsewhere must not be locked out by the first visitor's attempts.
 fail(await neighbour.api('public/holds/lookup','POST',{reference:guess(),mobile:'0912345678'}),404,'NOT_FOUND');
}),{webOrigin:ORIGIN}));
