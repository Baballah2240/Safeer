import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
const ok=(r,status=201)=>{assert.equal(r.status,status,r.raw);return r.data;};
const future=(days=10)=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
async function setup(f,slug='boarding-demo'){
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
const staff=async(f,s,permissions,assign={},scope='company')=>{
 const role=ok(await f.admin.request(s.base+'/roles','POST',{displayName:'Role '+randomUUID().slice(0,8),scope,permissions,...s.pw}));
 const made=ok(await f.admin.request(s.base+'/members','POST',{login:`bags${randomUUID().slice(0,8)}@safeer.local`,displayName:'Fictional Staff',existing:false,assignments:[{roleId:role.id,...assign}],...s.pw}));
 const c=f.client();ok(await c.signIn(made.user.login,made.temporaryPassword));const pass=randomBytes(24).toString('hex');ok(await c.request('auth/password','POST',{currentPassword:made.temporaryPassword,newPassword:pass}));return {c,pass};
};

export {ok,setup,book,paid,staff};

export async function boardingSetup(f){
 const s=await setup(f),id=await s.trip(),p=await paid(f,s,id);
 const printed=ok(await f.admin.request(`${s.base}/bookings/${p.bid}/print`,'POST',{document:'tickets'}));
 const code=printed.codes[0],base=`driver/companies/${s.cid}/trips/${id}`;
 const driver=await staff(f,s,['company.driver.operate']);
 const member=(await f.migration.query('SELECT id FROM safeer.company_users WHERE user_id=(SELECT id FROM safeer.users WHERE normalized_login=$1)',[(await driver.c.request('auth/me')).data.login])).rows[0].id;
 await f.migration.query('UPDATE safeer.drivers SET member_id=$1 WHERE company_id=$2',[member,s.cid]);
 const time=async(offset='1 hour')=>{await f.migration.query('SET session_replication_role=replica');try{await f.migration.query("UPDATE safeer.trips SET departure_at=now()+$2::interval,arrival_at=now()+$2::interval+interval '120 minutes' WHERE id=$1",[id,offset]);}finally{await f.migration.query('SET session_replication_role=DEFAULT');}};
 return {...s,id,p,code,base,companyBase:s.base,driver,member,time};
}
