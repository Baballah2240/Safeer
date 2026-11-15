import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';

// D89: passengers book from any stop to a later stop. Prices come from the route's price list (the whole trip keeps
// the trip fare); a seat freed at a middle stop is sold again; overlapping journeys never share a seat.
const ok=(r,status=201)=>{assert.equal(r.status,status,r.raw);return r.data;};
const future=(days=10)=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);

async function setup(f){
 const pw={currentPassword:f.password},cid=ok(await f.admin.request('companies','POST',{nameEn:'Fictional Stops Co',nameAr:'Fictional Stops Co',slug:'stops-co',holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).id,base='companies/'+cid;
 const w=ok(await f.admin.request(base),200);ok(await f.admin.request(base,'PATCH',{...w.company,id:undefined,status:'approved',...pw}),200);
 const cities=[];for(const c of ['AA','BB','CC'])cities.push(ok(await f.admin.request('cities','POST',{code:'STP_'+c,nameEn:'City '+c,nameAr:'مدينة '+c,countryCode:'SD',active:true,...pw})).id);
 const route=ok(await f.admin.request(base+'/routes','POST',{code:'R3',nameEn:'Three Stops',nameAr:'Three Stops',active:true,stops:cities.map(cityId=>({cityId})),...pw})).id;
 const layout=ok(await f.admin.request(base+'/fleet/layouts','POST',{code:'L1',nameEn:'Coach',nameAr:'Coach',active:true,rows:1,columns:3,seats:[1,2,3].map(i=>({row:1,column:i,label:String(i)})),...pw})).id;
 const bus=ok(await f.admin.request(base+'/fleet/buses','POST',{code:'B1',registration:'REG B1',layoutId:layout,layoutRevision:1,active:true,...pw})).id,driver=ok(await f.admin.request(base+'/drivers','POST',{employeeCode:'D1',nameEn:'Driver',nameAr:'Driver',active:true,...pw})).id;
 const trip=ok(await f.admin.request(base+'/trips','POST',{routeId:route,dates:[future()],time:'07:00',offsets:[0,60,120],fareMinor:300000,...pw})).ids[0];
 ok(await f.admin.request(`${base}/trips/${trip}/assignment`,'POST',{busId:bus,driverId:driver,version:1,...pw}));ok(await f.admin.request(`${base}/trips/${trip}/publish`,'POST',{version:2,...pw}));
 ok(await f.admin.request(base+'/public-profile','PUT',{listed:true,aboutEn:'',aboutAr:'',version:0,...pw}),200);
 return {cid,base,pw,route,trip,cities};
}
const hold=(f,tripId,seats,from,to)=>f.client().request('public/holds','POST',{tripId,seats,key:randomUUID(),mobile:'0912345678',travelers:seats.map(seat=>({seat,name:'Fictional Traveler '+seat})),...(from===undefined?{}:{fromIndex:from,toIndex:to})});

test('stop-to-stop journeys use the price list, reuse seats after a drop-off and never overlap',async()=>identityFixture(async f=>{
 const s=await setup(f),fares=s.base+`/routes/${s.route}/fares`;
 let list=ok(await f.admin.request(fares),200);assert.equal(list.stops.length,3);assert.deepEqual(list.fares,[]);assert.equal(list.canManage,true);
 // Without a price, only the whole trip is sold.
 assert.equal(ok(await f.client().request('public/trips?from=STP_AA&to=STP_BB'),200).items.length,0);
 assert.equal((await hold(f,s.trip,['1'],0,1)).error?.code,'SEGMENT_NOT_PRICED');
 assert.equal((await f.admin.request(fares,'PUT',{fares:[{from:1,to:1,fareMinor:5}],...s.pw})).error?.code,'INVALID_FARES');
 assert.equal((await f.admin.request(fares,'PUT',{fares:[{from:0,to:3,fareMinor:5}],...s.pw})).error?.code,'INVALID_FARES','A stop beyond the route is refused.');
 ok(await f.admin.request(fares,'PUT',{fares:[{from:0,to:1,fareMinor:100000},{from:1,to:2,fareMinor:150000}],...s.pw}),200);
 // Search finds a journey between any two stops, with its own price and time.
 const ab=ok(await f.client().request('public/trips?from=STP_AA&to=STP_BB'),200).items[0];
 assert.deepEqual([ab.fromIndex,ab.toIndex,ab.fareMinor,ab.time,ab.arrivalTime,ab.partial,ab.toNameEn],[0,1,100000,'07:00','08:00',true,'City BB']);
 const bc=ok(await f.client().request('public/trips?from=STP_BB&to=STP_CC'),200).items[0];
 assert.deepEqual([bc.fromIndex,bc.toIndex,bc.fareMinor,bc.time,bc.durationMinutes],[1,2,150000,'08:00',60]);
 assert.equal(ok(await f.client().request('public/trips?from=STP_AA&to=STP_CC'),200).items[0].fareMinor,300000,'The whole trip keeps the trip fare.');
 assert.equal(ok(await f.client().request('public/trips?from=STP_BB&to=STP_AA'),200).items.length,0,'A journey never runs backwards.');
 // Seat 1 from AA to BB, then the same seat from BB to CC; AA to CC on seat 1 overlaps both.
 const first=ok(await hold(f,s.trip,['1'],0,1));assert.equal(first.amountMinor,100000);assert.equal(first.fromNameEn,'City AA');assert.equal(first.toNameEn,'City BB');assert.equal(first.time,'07:00');
 let page=ok(await f.client().request(`public/trips/${s.trip}?from=1&to=2`),200);assert.equal(page.seats.find(x=>x.label==='1').available,true,'Seat 1 is free after the drop-off at BB.');
 assert.equal(page.fareMinor,150000);assert.equal(page.fares.length,3);
 const second=ok(await hold(f,s.trip,['1'],1,2));assert.equal(second.amountMinor,150000);assert.equal(second.time,'08:00');
 assert.equal((await hold(f,s.trip,['1'])).error?.code,'SEATS_UNAVAILABLE','The whole trip overlaps both journeys.');
 assert.equal((await hold(f,s.trip,['1'],0,2)).error?.code,'SEATS_UNAVAILABLE');
 page=ok(await f.client().request(`public/trips/${s.trip}?from=0&to=1`),200);assert.equal(page.seats.find(x=>x.label==='1').available,false);
 assert.equal(ok(await f.client().request('public/trips?from=STP_AA&to=STP_BB'),200).items[0].seatsLeft,2);
 assert.equal((await hold(f,s.trip,['2'],2,1)).error?.code,'INVALID_SEGMENT');
 assert.equal((await f.client().request(`public/trips/${s.trip}?from=9&to=x`)).error?.code,'INVALID_SEGMENT');
 // The counter sells a journey too, paid at the journey's price.
 const branch=ok(await f.admin.request(s.base+'/branches','POST',{nameEn:'Branch',nameAr:'Branch',code:'BR1',active:true,...s.pw})).id;
 const station=ok(await f.admin.request(s.base+'/stations','POST',{nameEn:'Station',nameAr:'Station',code:'ST1',branchId:branch,active:true,...s.pw})).id;
 const counter=ok(await f.admin.request(s.base+'/counters','POST',{stationId:station,code:'c1',name:'Counter 1',...s.pw})).id;ok(await f.admin.request(s.base+'/counter/sessions','POST',{counterId:counter,openingMinor:0}));
 const desk=ok(await f.admin.request(`${s.base}/counter/trips/${s.trip}?from=1&to=2`),200);assert.equal(desk.fareMinor,150000);assert.equal(desk.stops.length,3);assert.equal(desk.seats.find(x=>x.label==='1').available,false);
 const sale=ok(await f.admin.request(s.base+'/counter/sales','POST',{tripId:s.trip,seats:['2'],mobile:'0912345678',travelers:[{seat:'2',name:'Fictional Walk-in'}],method:'cash',key:randomUUID(),fromIndex:1,toIndex:2}));
 const sold=ok(await f.admin.request(`${s.base}/bookings/${sale.id}`),200);assert.equal(sold.amountMinor,150000);assert.equal(sold.fromNameEn,'City BB');
 // Operations shows where each passenger travels and the load on each stretch.
 const ops=ok(await f.admin.request(`${s.base}/operations/trips/${s.trip}`),200);
 assert.deepEqual(ops.legs.map(l=>l.occupied),[0,1],'Only the paid counter ticket counts (holds are not sold yet).');
 assert.equal(ops.passengers[0].boardsEn,'City BB');assert.equal(ops.passengers[0].leavesEn,'City CC');
 // Renaming the route keeps the price list; changing its stops clears it.
 const detail=ok(await f.admin.request(`${s.base}/routes/${s.route}`),200);
 ok(await f.admin.request(`${s.base}/routes/${s.route}`,'PATCH',{code:'R3',nameEn:'Three Stops Renamed',nameAr:'Three Stops',active:true,stops:s.cities.map(cityId=>({cityId})),version:detail.route.version,...s.pw}),200);
 assert.equal(ok(await f.admin.request(fares),200).fares.length,2);
 const again=ok(await f.admin.request(`${s.base}/routes/${s.route}`),200);
 ok(await f.admin.request(`${s.base}/routes/${s.route}`,'PATCH',{code:'R3',nameEn:'Two Stops',nameAr:'Two Stops',active:true,stops:[s.cities[0],s.cities[2]].map(cityId=>({cityId})),version:again.route.version,...s.pw}),200);
 assert.equal(ok(await f.admin.request(fares),200).fares.length,0,'New stops clear the old prices.');
 assert.equal(ok(await f.client().request('public/trips?from=STP_BB&to=STP_CC'),200).items.length,0,'The existing trip no longer matches the route, so its middle journeys are not priced.');
}));
