// Fictional operations data for the D65 browser checks: one approved company, two routes,
// several departures today (one unassigned), paid bookings and printed tickets.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

const need=r=>{assert.ok(r.status<300,r.raw);return r.data;};
const today=(tz='Africa/Khartoum')=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
// Departures must stay on today's Khartoum date: fit the three trips between "more than an hour away"
// (so the first is still scheduled, not boarding) and midnight, keeping their order and gaps.
const minutesLeftToday=()=>{const [h,m]=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Khartoum',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).split(':').map(Number);return 24*60-(h*60+m)-1;};
export function departureOffsets(left=minutesLeftToday()){
 const first=65,gap=Math.min(105,Math.floor((left-first)/2));
 if(gap<2)throw Error('Operations fixtures need about 75 minutes left in the Khartoum day; rerun after midnight Africa/Khartoum.');
 return [first,first+gap,first+2*gap];
}
const laterToday=minutes=>{const d=new Date(Date.now()+minutes*60000);return new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Khartoum',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d);};

export async function seedOperations(f,slug='fictional-nile-ops'){
 const pw={currentPassword:f.password};
 const cid=need(await f.admin.request('companies','POST',{nameEn:'Fictional Nile',nameAr:'شركة النيل',slug,holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).id;
 const w=need(await f.admin.request('companies/'+cid));need(await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',...pw}));
 const base='companies/'+cid,cities={};
 for(const [code,en,ar] of [['KRT','Khartoum','الخرطوم'],['PZU','Port Sudan','بورتسودان'],['WMD','Wad Madani','ود مدني']])cities[code]=need(await f.admin.request('cities','POST',{code:code+slug.length,nameEn:en,nameAr:ar,countryCode:'SD',active:true,...pw})).id;
 const route=async(code,en,ar,stops)=>need(await f.admin.request(base+'/routes','POST',{code,nameEn:en,nameAr:ar,active:true,stops:stops.map(cityId=>({cityId})),...pw})).id;
 const r1=await route('R1','Khartoum to Port Sudan','الخرطوم إلى بورتسودان',[cities.KRT,cities.PZU]),r2=await route('R2','Khartoum to Wad Madani','الخرطوم إلى ود مدني',[cities.KRT,cities.WMD]);
 const seats=Array.from({length:12},(_,i)=>({row:Math.floor(i/4)+1,column:i%4+1,label:String(i+1)}));
 const layout=need(await f.admin.request(base+'/fleet/layouts','POST',{code:'L1',nameEn:'12-seat coach',nameAr:'حافلة ١٢ مقعداً',active:true,rows:3,columns:4,seats,...pw})).id;
 const bus=async code=>need(await f.admin.request(base+'/fleet/buses','POST',{code,registration:'REG '+code,layoutId:layout,layoutRevision:1,active:true,...pw})).id;
 const driver=async(code,name)=>need(await f.admin.request(base+'/drivers','POST',{employeeCode:code,nameEn:name,nameAr:name,active:true,...pw})).id;
 const b1=await bus('B12'),b2=await bus('B08'),d1=await driver('D1','Omar Ali'),d2=await driver('D2','Hassan Eid');
 const trip=async(routeId,time,assign,date=today())=>{const id=need(await f.admin.request(base+'/trips','POST',{routeId,dates:[date],time,offsets:[0,240],fareMinor:150000,...pw})).ids[0];if(assign){need(await f.admin.request(`${base}/trips/${id}/assignment`,'POST',{busId:assign[0],driverId:assign[1],version:1,...pw}));need(await f.admin.request(`${base}/trips/${id}/publish`,'POST',{version:2,...pw}));}return id;};
 const branch=need(await f.admin.request(base+'/branches','POST',{nameEn:'Central Branch',nameAr:'الفرع الرئيسي',code:'BR1',active:true,...pw})).id;
 const station=need(await f.admin.request(base+'/stations','POST',{nameEn:'Khartoum Station',nameAr:'محطة الخرطوم',code:'ST1',branchId:branch,active:true,...pw})).id;
 const counter=need(await f.admin.request(base+'/counters','POST',{stationId:station,code:'c1',name:'Counter 1',...pw})).id;need(await f.admin.request(base+'/counter/sessions','POST',{counterId:counter,openingMinor:0}));
 need(await f.admin.request(base+'/public-profile','PUT',{listed:true,aboutEn:'',aboutAr:'',version:0,...pw}));
 const [o1,o2,o3]=departureOffsets(),soon=await trip(r1,laterToday(o1),[b1,d1]),later=await trip(r2,laterToday(o2),[b2,d2]),unassigned=await trip(r1,laterToday(o3),null);
 const pay=async(tripId,labels)=>{const key=randomUUID(),hold=need(await f.client().request('public/holds','POST',{tripId,seats:labels,key,mobile:'0912345678',travelers:labels.map(seat=>({seat,name:'Fictional Traveler '+seat}))}));
  const bid=(await f.migration.query('SELECT id FROM safeer.bookings WHERE reference=$1',[hold.reference])).rows[0].id;need(await f.admin.request(`${base}/bookings/${bid}/pay`,'POST',{method:'cash',key:randomUUID()}));
  const printed=need(await f.admin.request(`${base}/bookings/${bid}/print`,'POST',{document:'tickets'}));return {bid,reference:hold.reference,key,codes:printed.codes};};
 const bookings=[await pay(soon,['1','2','3']),await pay(soon,['4']),await pay(later,['1','2'])];
 return {cid,base,trips:{soon,later,unassigned},drivers:{d1,d2},buses:{b1,b2},station,bookings,pw};
}
