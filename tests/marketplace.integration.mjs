import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';

const ok=(r,status=201)=>{assert.equal(r.status,status,r.raw);return r.data;};
const future=(days=10)=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
async function setup(f,slug='market-demo',{publish=true,list=true}={}){
 const pw={currentPassword:f.password},cid=ok(await f.admin.request('companies','POST',{nameEn:'Fictional '+slug,nameAr:'Fictional '+slug,slug,holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).id;
 const w=ok(await f.admin.request('companies/'+cid),200);ok(await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',contactEmail:'private-office@safeer.local',phone:'+249 111 111 111',address:'Private office address',...pw}),200);
 const code=slug.toUpperCase(),cities=[];for(const c of ['AA','BB'])cities.push(ok(await f.admin.request('cities','POST',{code:code+'_'+c,nameEn:'City '+code+c,nameAr:'City '+code+c,countryCode:'SD',active:true,...pw})).id);
 const base='companies/'+cid,route=ok(await f.admin.request(base+'/routes','POST',{code:'R1',nameEn:'Fictional Route',nameAr:'Fictional Route',active:true,stops:cities.map(cityId=>({cityId})),...pw})).id;
 const layout=ok(await f.admin.request(base+'/fleet/layouts','POST',{code:'L1',nameEn:'Fictional Coach',nameAr:'Fictional Coach',active:true,rows:1,columns:2,seats:[{row:1,column:1,label:'1'},{row:1,column:2,label:'2'}],...pw})).id;
 const bus=ok(await f.admin.request(base+'/fleet/buses','POST',{code:'SECRET-BUS',registration:'SECRET-REG',layoutId:layout,layoutRevision:1,active:true,...pw})).id,driver=ok(await f.admin.request(base+'/drivers','POST',{employeeCode:'SECRET-EMP',nameEn:'Secret Driver',nameAr:'Secret Driver',phone:'+249 222 222 222',active:true,...pw})).id;
 const path=base+'/trips',trip=async(over={})=>{const id=ok(await f.admin.request(path,'POST',{routeId:route,dates:[future()],time:'07:00',offsets:[0,120],fareMinor:150000,...pw,...over})).ids[0];ok(await f.admin.request(`${path}/${id}/assignment`,'POST',{busId:bus,driverId:driver,version:1,...pw}));if(publish)ok(await f.admin.request(`${path}/${id}/publish`,'POST',{version:2,...pw}));return id;};
 const profile=(over={})=>f.admin.request(base+'/public-profile','PUT',{listed:true,aboutEn:'About us',aboutAr:'Fictional',phone:'+249 333 333 333',email:'hello@fictional.test',address:'Public address',version:0,...pw,...over});
 if(list)ok(await profile(),200);
 return {cid,base,w,path,trip,profile,code,slug,pw,cities,route};
}
const pub=(f,path)=>f.client().request('public/'+path);

test('anonymous visitors see only listed approved companies and published future trips',async()=>identityFixture(async f=>{
 const s=await setup(f),id=await s.trip();
 const hidden=await setup(f,'market-hidden',{list:false});await hidden.trip();
 const draft=await setup(f,'market-draft',{publish:false});await draft.trip();
 const names=ok(await pub(f,'companies'),200).items.map(c=>c.slug);assert.deepEqual(names.sort(),['market-demo','market-draft']);
 const trips=ok(await pub(f,'trips'),200).items;assert.deepEqual(trips.map(t=>t.id),[id],'Unlisted companies and drafts stay private.');
 const t=trips[0];assert.equal(t.fromCode,s.code+'_AA');assert.equal(t.toCode,s.code+'_BB');assert.equal(t.time,'07:00');assert.equal(t.arrivalTime,'09:00');assert.equal(t.durationMinutes,120);assert.equal(t.fareMinor,150000);assert.equal(t.seatCount,2);assert.equal(t.busTypeEn,'Fictional Coach');assert.equal(t.stops.length,2);
 assert.equal(ok(await pub(f,'cities'),200).items.length,2,'Only cities with public trips are offered.');
 assert.equal((await pub(f,'companies/market-hidden')).status,404);assert.equal((await pub(f,'companies/does-not-exist')).status,404);assert.equal((await pub(f,'companies/BAD_SLUG')).status,404);
 ok(await f.admin.request(`${s.path}/${id}/cancel`,'POST',{reason:'Fictional',version:3,...s.pw}));assert.equal(ok(await pub(f,'trips'),200).items.length,0,'Canceled trips disappear.');
 const w=ok(await f.admin.request('companies/'+s.cid),200);ok(await f.admin.request('companies/'+s.cid,'PATCH',{...w.company,id:undefined,status:'suspended',...s.pw}),200);assert.equal((await pub(f,'companies/market-demo')).status,404,'A suspended company vanishes.');
}));

test('public responses never contain private fields',async()=>identityFixture(async f=>{
 const s=await setup(f);await s.trip();
 const text=[(await pub(f,'trips')).raw,(await pub(f,'companies')).raw,(await pub(f,'companies/'+s.slug)).raw,(await pub(f,'cities')).raw].join(' ');
 for(const secret of ['SECRET-BUS','SECRET-REG','SECRET-EMP','Secret Driver','+249 222','+249 111','private-office','Private office','created_by','company_id','cancelReason',s.cid])assert.ok(!text.includes(secret),secret);
 const c=ok(await pub(f,'companies/'+s.slug),200).company;assert.equal(c.phone,'+249 333 333 333');assert.equal(c.email,'hello@fictional.test');assert.equal(c.address,'Public address');assert.equal(c.tripCount,1);
 const before=await f.client().request('public/trips',undefined,undefined,{Cookie:'safeer_session=not-a-real-session'});assert.equal(before.status,200,'A bad cookie does not block public reads.');
}));

test('search filters by endpoints, date and validates input',async()=>identityFixture(async f=>{
 const s=await setup(f),other=await setup(f,'market-two');const near=await s.trip({dates:[future(5)]}),far=await s.trip({dates:[future(9)],time:'12:00'}),theirs=await other.trip();
 const ids=async q=>ok(await pub(f,'trips?'+q),200).items.map(t=>t.id);
 assert.deepEqual(await ids('from='+s.code+'_AA'),[near,far]);assert.deepEqual(await ids('to='+other.code+'_BB'),[theirs]);assert.deepEqual(await ids(`from=${s.code}_BB`),[],'Direction matters: trips run first stop to last.');
 assert.deepEqual(await ids('date='+future(9)),[far]);assert.deepEqual(await ids(`from=${s.code}_AA&date=${future(5)}`),[near]);
 for(const q of ['date=2026-02-30','date=tomorrow','from=lower','to=%27%20OR%201=1','from=A&from=B'])assert.equal((await pub(f,'trips?'+q)).status,400,q);
 assert.equal(ok(await pub(f,'companies/'+s.slug),200).trips.length,2,'A company page lists only its own trips.');
}));

test('the runtime role reaches only the fixed projections and anonymous writes are refused',async()=>identityFixture(async f=>{
 const s=await setup(f);await s.trip();
 for(const table of ['trips','trip_assignments','company_public_profiles','drivers','companies'])assert.equal((await f.api.db.pool.query(`SELECT * FROM safeer.${table}`)).rowCount,0,table);
 assert.equal((await f.api.db.pool.query('SELECT safeer.public_trips(NULL,NULL,NULL,NULL)')).rowCount,1);
 const anon=f.client();assert.equal((await anon.request('public/trips','POST',{})).status>=400,true);assert.equal((await anon.request('companies/'+s.cid+'/public-profile')).status,401);
 assert.equal((await f.api.db.pool.query('UPDATE safeer.company_public_profiles SET listed=false')).rowCount,0,'Without a session, row security blocks changes.');
 assert.equal((await f.api.db.pool.query('SELECT safeer.public_companies(NULL)')).rowCount,1,'The listing is unchanged.');
}));

test('only company profile managers control the public page, with current password and stale protection',async()=>identityFixture(async f=>{
 const s=await setup(f,'market-page',{list:false});
 assert.equal(ok(await f.admin.request(s.base+'/public-profile'),200).listed,false,'New companies start private.');
 assert.equal((await s.profile({currentPassword:'wrong-password-value'})).status>=400,true);assert.equal((await s.profile({phone:'not a phone'})).status,400);assert.equal((await s.profile({email:'nope'})).status,400);assert.equal((await s.profile({aboutEn:'x'.repeat(1001)})).status,400);
 ok(await s.profile(),200);assert.equal((await s.profile()).status,409,'A second first-save conflicts.');assert.equal((await s.profile({version:5})).status,409);
 ok(await s.profile({version:1,listed:false}),200);assert.equal((await pub(f,'companies/'+s.slug)).status,404,'Unlisting takes effect at once.');
 const role=ok(await f.admin.request(`companies/${s.cid}/roles`,'POST',{displayName:'Fictional reader',scope:'company',permissions:['company.profile.read'],...s.pw})),created=ok(await f.admin.request(`companies/${s.cid}/members`,'POST',{login:randomUUID()+'@safeer.local',displayName:'Fictional Staff',existing:false,assignments:[{roleId:role.id}],...s.pw}));
 const user=f.client();ok(await user.signIn(created.user.login,created.temporaryPassword));const pass=randomBytes(24).toString('hex');ok(await user.request('auth/password','POST',{currentPassword:created.temporaryPassword,newPassword:pass}));
 assert.equal((await user.request(s.base+'/public-profile')).status,403);assert.equal((await user.request(s.base+'/public-profile','PUT',{listed:true,version:2,currentPassword:pass})).status,403);
 assert.ok(ok(await f.admin.request('companies/'+s.cid),200).audit.some(a=>a.action==='public_page.hidden'));
}));
