import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';

// D68: optional passenger accounts. Exercised through the limited runtime role, as the API will be.
const ok=(r,status=201)=>{assert.equal(r.status,status,r.raw);return r.data;};
const sha=v=>createHash('sha256').update(v).digest('hex');
const future=(days=10)=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
async function trip(f){
 const pw={currentPassword:f.password},cid=ok(await f.admin.request('companies','POST',{nameEn:'Fictional Accounts',nameAr:'Fictional Accounts',slug:'accounts-demo',holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).id;
 const w=ok(await f.admin.request('companies/'+cid),200);ok(await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',...pw}),200);
 const cities=[];for(const c of ['AA','BB'])cities.push(ok(await f.admin.request('cities','POST',{code:'ACC_'+c,nameEn:'City '+c,nameAr:'City '+c,countryCode:'SD',active:true,...pw})).id);
 const base='companies/'+cid,route=ok(await f.admin.request(base+'/routes','POST',{code:'R1',nameEn:'Fictional Route',nameAr:'Fictional Route',active:true,stops:cities.map(cityId=>({cityId})),...pw})).id;
 const layout=ok(await f.admin.request(base+'/fleet/layouts','POST',{code:'L1',nameEn:'Coach',nameAr:'Coach',active:true,rows:1,columns:4,seats:Array.from({length:4},(_,i)=>({row:1,column:i+1,label:String(i+1)})),...pw})).id;
 const bus=ok(await f.admin.request(base+'/fleet/buses','POST',{code:'B1',registration:'REG B1',layoutId:layout,layoutRevision:1,active:true,...pw})).id,driver=ok(await f.admin.request(base+'/drivers','POST',{employeeCode:'D1',nameEn:'Driver',nameAr:'Driver',active:true,...pw})).id;
 const id=ok(await f.admin.request(base+'/trips','POST',{routeId:route,dates:[future()],time:'07:00',offsets:[0,120],fareMinor:150000,...pw})).ids[0];
 ok(await f.admin.request(`${base}/trips/${id}/assignment`,'POST',{busId:bus,driverId:driver,version:1,...pw}));ok(await f.admin.request(`${base}/trips/${id}/publish`,'POST',{version:2,...pw}));
 ok(await f.admin.request(base+'/public-profile','PUT',{listed:true,aboutEn:'',aboutAr:'',version:0,...pw}),200);
 return id;
}

test('passenger accounts sign in, save details, link proven bookings and delete without touching guest bookings',async()=>identityFixture(async f=>{
 const db=f.api.db.pool,q=async(sql,args)=>(await db.query(sql,args)).rows[0].r;
 const tid=await trip(f),key=randomUUID(),hold=ok(await f.client().request('public/holds','POST',{tripId:tid,seats:['1'],key,mobile:'0912345678',travelers:[{seat:'1',name:'Fictional Amna Osman'}]}));
 const access=sha('safeer-hold-v1:'+key),token=sha(randomBytes(32).toString('hex')),other=sha(randomBytes(32).toString('hex'));
 const signIn=(sub,t,name='Fictional Amna')=>q('SELECT safeer.passenger_sign_in($1,$2,$3,$4,$5,$6,30) AS r',[sub,'Amna@Example.com',name,'https://example.com/a.png',randomUUID(),t]);
 const me=await signIn('google-sub-1',token);
 assert.equal(me.email,'amna@example.com');assert.equal(me.bookingCount,0);assert.deepEqual(me.travelers,[]);
 // A second sign-in with the same Google account reuses it and keeps the name the passenger chose.
 const again=await signIn('google-sub-1',other,'Changed By Google');assert.equal(again.id,me.id);assert.equal(again.displayName,'Fictional Amna');
 for(const table of ['passenger_accounts','passenger_sessions','passenger_travelers','passenger_booking_links'])await assert.rejects(db.query('SELECT * FROM safeer.'+table),{code:'42501'},table);
 assert.equal(await q('SELECT safeer.passenger_me($1) AS r',[sha('unknown')]),null,'An unknown session reads nothing.');

 const saved=await q('SELECT safeer.passenger_save_profile($1,$2,$3,$4,$5) AS r',[token,me.version,'Fictional Amna Osman','+249912345678',JSON.stringify([{fullName:'Fictional Child',mobile:''}])]);
 assert.equal(saved.mobile,'+249912345678');assert.deepEqual(saved.travelers,[{fullName:'Fictional Child',mobile:null}]);
 await assert.rejects(db.query('SELECT safeer.passenger_save_profile($1,$2,$3,$4,$5)',[token,me.version,'Stale','',JSON.stringify([])]),{code:'40001'},'A stale version is refused.');

 assert.equal(await q('SELECT safeer.passenger_link_booking($1,$2,$3) AS r',[token,hold.reference,sha('wrong')]),'not_found','The device key is required.');
 assert.equal(await q('SELECT safeer.passenger_link_booking($1,$2,$3) AS r',[token,hold.reference,access]),'linked');
 assert.equal(await q('SELECT safeer.passenger_link_booking($1,$2,$3) AS r',[token,hold.reference,access]),'linked','Linking twice is harmless.');
 const stranger=sha(randomBytes(32).toString('hex'));await signIn('google-sub-2',stranger);
 assert.equal(await q('SELECT safeer.passenger_link_booking($1,$2,$3) AS r',[stranger,hold.reference,access]),'other_account','A booking has one owner.');
 const trips=await q('SELECT safeer.passenger_trips($1) AS r',[token]);
 assert.equal(trips.items.length,1);assert.equal(trips.items[0].reference,hold.reference);
 assert.deepEqual((await q('SELECT safeer.passenger_trips($1) AS r',[stranger])).items,[]);

 assert.equal(await q('SELECT safeer.passenger_sign_out($1,false) AS r',[other]),true);
 assert.equal(await q('SELECT safeer.passenger_me($1) AS r',[other]),null,'A signed-out session is dead.');
 assert.equal((await q('SELECT safeer.passenger_me($1) AS r',[token])).bookingCount,1,'Other sessions stay signed in.');
 assert.equal(await q('SELECT safeer.passenger_delete_account($1) AS r',[token]),true);
 assert.equal(await q('SELECT safeer.passenger_me($1) AS r',[token]),null);
 assert.equal((await q('SELECT safeer.public_booking_by_key($1) AS r',[access])).reference,hold.reference,'The guest booking still works with its device key.');
 assert.equal((await f.migration.query('SELECT count(*)::int n FROM safeer.passenger_accounts WHERE provider_subject=$1',['google-sub-1'])).rows[0].n,0);
}));
