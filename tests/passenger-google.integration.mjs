import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fakeGoogle} from './support/fake-google.mjs';
import {identityFixture} from './support/identity-db.mjs';

// D68 step 2: Google sign-in through the API against a loopback stand-in for Google (own RSA key).
const ok=(r,status=201)=>{assert.equal(r.status,status,r.raw);return r.data;};
const future=(days=10)=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
async function trip(f){
 const pw={currentPassword:f.password},cid=ok(await f.admin.request('companies','POST',{nameEn:'Fictional Google Co',nameAr:'Fictional Google Co',slug:'google-demo',holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).id;
 const w=ok(await f.admin.request('companies/'+cid),200);ok(await f.admin.request('companies/'+cid,'PATCH',{...w.company,id:undefined,status:'approved',...pw}),200);
 const cities=[];for(const c of ['AA','BB'])cities.push(ok(await f.admin.request('cities','POST',{code:'GG_'+c,nameEn:'City '+c,nameAr:'City '+c,countryCode:'SD',active:true,...pw})).id);
 const base='companies/'+cid,route=ok(await f.admin.request(base+'/routes','POST',{code:'R1',nameEn:'Fictional Route',nameAr:'Fictional Route',active:true,stops:cities.map(cityId=>({cityId})),...pw})).id;
 const layout=ok(await f.admin.request(base+'/fleet/layouts','POST',{code:'L1',nameEn:'Coach',nameAr:'Coach',active:true,rows:1,columns:4,seats:Array.from({length:4},(_,i)=>({row:1,column:i+1,label:String(i+1)})),...pw})).id;
 const bus=ok(await f.admin.request(base+'/fleet/buses','POST',{code:'B1',registration:'REG B1',layoutId:layout,layoutRevision:1,active:true,...pw})).id,driver=ok(await f.admin.request(base+'/drivers','POST',{employeeCode:'D1',nameEn:'Driver',nameAr:'Driver',active:true,...pw})).id;
 const id=ok(await f.admin.request(base+'/trips','POST',{routeId:route,dates:[future()],time:'07:00',offsets:[0,120],fareMinor:150000,...pw})).ids[0];
 ok(await f.admin.request(`${base}/trips/${id}/assignment`,'POST',{busId:bus,driverId:driver,version:1,...pw}));ok(await f.admin.request(`${base}/trips/${id}/publish`,'POST',{version:2,...pw}));
 ok(await f.admin.request(base+'/public-profile','PUT',{listed:true,aboutEn:'',aboutAr:'',version:0,...pw}),200);
 return id;
}

test('Google sign-in verifies the ID token, opens a passenger session and links proven bookings',async()=>{
 const g=await fakeGoogle();Object.assign(process.env,{SAFEER_GOOGLE_CLIENT_ID:'test-client.apps',SAFEER_GOOGLE_CLIENT_SECRET:'test-secret-value',SAFEER_GOOGLE_TEST_BASE:g.base});
 try{await identityFixture(async f=>{
  const origin='http://127.0.0.1:4320',api=f.api.origin+'/api/v1/passenger/';
  const go=(path,{cookie='',headers={},...init}={})=>fetch(api+path,{redirect:'manual',...init,headers:{...(cookie?{Cookie:cookie}:{}),...headers}});
  const cookieOf=(r,name)=>r.headers.getSetCookie().find(c=>c.startsWith(name+'='))?.split(';')[0];
  async function signIn(back='/booking'){
   const start=await go('google/start?return='+encodeURIComponent(back));assert.equal(start.status,302);
   const auth=start.headers.get('location');assert.ok(auth.startsWith(g.base+'/auth?'));
   const u=new URL(auth);assert.equal(u.searchParams.get('redirect_uri'),origin+'/api/v1/passenger/google/callback');assert.equal(u.searchParams.get('code_challenge_method'),'S256');
   const {code,state}=g.consent(auth),stateCookie=cookieOf(start,'safeer_google');
   const done=await go(`google/callback?code=${code}&state=${state}`,{cookie:stateCookie,headers:{'Sec-Fetch-Site':'cross-site'}});
   return {done,code,state,stateCookie,session:cookieOf(done,'safeer_passenger')};
  }
  const anon=ok(await (await go('me')).json().then(j=>({status:200,data:j.data,raw:''})),200);assert.equal(anon.account,null);assert.equal(anon.googleEnabled,true);

  const first=await signIn('/hold/SF-ABCDEFGH');
  assert.equal(first.done.status,302);assert.equal(first.done.headers.get('location'),'/hold/SF-ABCDEFGH?signin=ok');assert.match(first.session,/^safeer_passenger=[A-Za-z0-9_-]{43}$/);
  const me=(await (await go('me',{cookie:first.session})).json()).data;
  assert.equal(me.account.email,'amna@example.com');assert.equal(me.account.displayName,'Fictional Amna');assert.match(me.csrfToken,/^[0-9a-f]{64}$/);

  // A replayed code and a state that does not match the cookie both fail closed.
  const replay=await go(`google/callback?code=${first.code}&state=${first.state}`,{cookie:first.stateCookie});assert.equal(replay.headers.get('location'),'/marketplace?view=profile&signin=failed');assert.equal(cookieOf(replay,'safeer_passenger'),undefined);
  const start=await go('google/start');const {code}=g.consent(start.headers.get('location'));
  const forged=await go(`google/callback?code=${code}&state=forged`,{cookie:cookieOf(start,'safeer_google')});assert.equal(forged.headers.get('location'),'/marketplace?view=profile&signin=failed');
  assert.equal((await go('google/start?return=https://evil.example')).status,302);

  // Wrong audience, a foreign issuer and an unverified email are all refused.
  for(const [claims,result] of [[{aud:'someone-else'},'failed'],[{iss:'https://evil.example'},'failed'],[{email_verified:false},'unverified'],[{exp:Math.floor(Date.now()/1000)-3600},'failed']]){
   g.state.claims=claims;const r=await signIn();assert.equal(r.done.headers.get('location'),'/marketplace?view=profile&signin='+result,JSON.stringify(claims));assert.equal(r.session,undefined);
  }
  g.state.claims={};

  // Writes need the passenger CSRF token and the web origin.
  const write=(path,method,data,csrf=me.csrfToken)=>go(path,{method,cookie:first.session,headers:{Origin:origin,'Content-Type':'application/json','X-CSRF-Token':csrf},body:data===undefined?undefined:JSON.stringify(data)});
  assert.equal((await write('profile','PUT',{displayName:'X',mobile:'',travelers:[],version:me.account.version},'0'.repeat(64))).status,403);
  const saved=await write('profile','PUT',{displayName:'Fictional Amna Osman',mobile:'0912345678',travelers:[{fullName:'Fictional Child',mobile:''}],version:me.account.version});
  assert.equal(saved.status,200,await saved.clone().text());const profile=(await saved.json()).data;assert.equal(profile.mobile,'+249912345678');

  const tid=await trip(f),key=randomUUID(),hold=ok(await f.client().request('public/holds','POST',{tripId:tid,seats:['1'],key,mobile:'0912345678',travelers:[{seat:'1',name:'Fictional Amna Osman'}]}));
  assert.equal((await write('bookings','POST',{reference:hold.reference,key:randomUUID()})).status,404,'The device key is required.');
  assert.equal((await write('bookings','POST',{reference:hold.reference,key})).status,201);
  const trips=(await (await go('trips',{cookie:first.session})).json()).data;assert.deepEqual(trips.items.map(b=>b.reference),[hold.reference]);
  // Another Google account cannot take the same booking.
  g.state.claims={sub:'g-other',email:'other@example.com',picture:'https://lh3.googleusercontent.com/a/fictional-photo'};const other=await signIn();g.state.claims={};
  const otherCsrf=(await (await go('me',{cookie:other.session})).json()).data.csrfToken;
  assert.equal((await go('bookings',{method:'POST',cookie:other.session,headers:{Origin:origin,'Content-Type':'application/json','X-CSRF-Token':otherCsrf},body:JSON.stringify({reference:hold.reference,key})})).status,409);
  // D75: the Google photo address is not kept, and a passenger deletes their own account over HTTP.
  const otherRow=async()=>(await f.migration.query("SELECT picture_url FROM safeer.passenger_accounts WHERE provider_subject='g-other'")).rows;
  assert.deepEqual(await otherRow(),[{picture_url:null}],'The Google profile photo address is not stored.');
  const remove=csrf=>go('account',{method:'DELETE',cookie:other.session,headers:{Origin:origin,'X-CSRF-Token':csrf}});
  assert.equal((await remove('0'.repeat(64))).status,403,'Deleting needs the passenger CSRF token.');
  const gone=await remove(otherCsrf);assert.equal(gone.status,200,await gone.clone().text());assert.equal((await gone.json()).data.deleted,true);
  assert.match(gone.headers.getSetCookie().find(c=>c.startsWith('safeer_passenger='))||'',/^safeer_passenger=; .*Max-Age=0/,'The session cookie is cleared.');
  assert.equal((await (await go('me',{cookie:other.session})).json()).data.account,null,'The session ends with the account.');
  assert.deepEqual(await otherRow(),[],'The account row is gone.');
  assert.deepEqual((await (await go('trips',{cookie:first.session})).json()).data.items.map(b=>b.reference),[hold.reference],'Other accounts keep their bookings.');

  assert.equal((await write('logout','POST',{})).status,201);
  assert.equal((await (await go('me',{cookie:first.session})).json()).data.account,null,'Signing out ends the session.');
  assert.equal((await go('trips',{cookie:first.session})).status,401);
 });}finally{await g.close();for(const k of ['SAFEER_GOOGLE_CLIENT_ID','SAFEER_GOOGLE_CLIENT_SECRET','SAFEER_GOOGLE_TEST_BASE'])delete process.env[k];}
});

test('without Google credentials sign-in reports unavailable instead of failing',async()=>identityFixture(async f=>{
 const r=await fetch(f.api.origin+'/api/v1/passenger/google/start',{redirect:'manual'});
 assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/marketplace?view=profile&signin=unavailable');
 assert.equal((await (await fetch(f.api.origin+'/api/v1/passenger/me')).json()).data.googleEnabled,false);
}));
