import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {request as httpRequest} from 'node:http';
import {createServer} from 'node:net';
import {randomBytes,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {databaseConfig} from '../database/migrate.mjs';
import {appRelease} from '../src/app-release.js';

// Production start test (D72): runs scripts/production.mjs - the exact Render start command - against a
// disposable database owned by a non-superuser role, as on Render, then talks to it only the way the
// hosting edge does (public Host header, X-Forwarded-For). Fictional data only; nothing leaves loopback.
const root=fileURLToPath(new URL('../',import.meta.url)),HOST='safeer.example',ORIGIN='https://'+HOST;
const freePort=()=>new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
function launch(env){
 const child=spawn(process.execPath,['scripts/production.mjs'],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let log='';const ready=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Production start timed out:\n'+log)),90000);
  const take=chunk=>{log+=chunk;if(log.includes('Safeer is serving')){clearTimeout(timer);resolve();}};
  child.stdout.on('data',take);child.stderr.on('data',take);
  child.once('exit',code=>{clearTimeout(timer);reject(Error(`Production start exited ${code}:\n${log}`));});
 });
 return {child,ready,get log(){return log;},stop:()=>new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);child.kill();})};
}
function edge(port,ip){
 const jar=new Map();let csrf='';
 const send=(path,{method='GET',body,host=HOST,headers={}}={})=>new Promise((resolve,reject)=>{
  const raw=body===undefined?undefined:JSON.stringify(body),cookie=[...jar].map(([k,v])=>k+'='+v).join('; ');
  const r=httpRequest({host:'127.0.0.1',port,path,method,headers:{host,'x-forwarded-for':ip,...(cookie?{cookie}:{}),...(method!=='GET'?{origin:ORIGIN,...(csrf?{'x-csrf-token':csrf}:{})}:{}),...(raw!==undefined?{'content-type':'application/json','content-length':Buffer.byteLength(raw)}:{}),...headers}},res=>{
   let text='';res.setEncoding('utf8');res.on('data',c=>text+=c);res.on('end',()=>{
    for(const c of res.headers['set-cookie']||[]){const [pair]=c.split(';'),i=pair.indexOf('='),k=pair.slice(0,i),v=pair.slice(i+1);if(v)jar.set(k,v);else jar.delete(k);}
    let json;try{json=JSON.parse(text);}catch{json={};}if(typeof json.data?.csrfToken==='string')csrf=json.data.csrfToken;
    resolve({status:res.statusCode,headers:res.headers,data:json.data,error:json.error,raw:text});
   });
  });r.on('error',reject);r.end(raw);
 });
 return {send,api:(path,method='GET',body)=>send('/api/v1/'+path,{method,body})};
}
const ok=(r,status=201)=>{assert.equal(r.status,status,`${r.status} ${r.raw.slice(0,400)}`);return r.data;};

test('production start: Render command migrates, limits its runtime role, serves the built site securely and restarts cleanly',{timeout:300000},async()=>{
 if(!process.env.SAFEER_TEST_DATABASE_URL)throw Error('Set SAFEER_TEST_DATABASE_URL to a disposable loopback PostgreSQL instance. Tests do not skip.');
 const config=databaseConfig(process.env.SAFEER_TEST_DATABASE_URL),admin=new pg.Client(config);await admin.connect();
 const suffix=randomUUID().replaceAll('-',''),ownerRole='prod_owner_'+suffix,db='safeer_prod_'+suffix,ownerPass=randomBytes(24).toString('hex');
 const leftover=(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='safeer_app'")).rowCount;
 assert.equal(leftover,0,'A safeer_app role already exists in the test cluster; use a fresh disposable cluster.');
 let app,again;
 try{
  // Like Render: the database owner is not a superuser, but may create the runtime role.
  await admin.query(`CREATE ROLE "${ownerRole}" LOGIN CREATEROLE NOSUPERUSER NOCREATEDB NOINHERIT PASSWORD '${ownerPass}'`);
  await admin.query(`CREATE DATABASE "${db}" OWNER "${ownerRole}"`);
  const url=new URL(config.connectionString);url.username=ownerRole;url.password=ownerPass;url.pathname='/'+db;
  const port=await freePort(),appPassword=randomBytes(30).toString('base64url');
  const env={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP,DATABASE_URL:url.href,SAFEER_PUBLIC_ORIGIN:ORIGIN,SAFEER_APP_DB_PASSWORD:appPassword,SAFEER_OWNER_LOGIN:'owner@safeer.example',PORT:String(port),SAFEER_LOOPBACK_ONLY:'1'};
  app=launch(env);await app.ready;
  const first=/First owner created: (\S+)\. Temporary password: (\S+)/.exec(app.log);assert.ok(first,'first owner bootstrap is logged once:\n'+app.log);
  assert.equal(first[1],'owner@safeer.example');
  assert.ok(!/DATABASE_URL|postgres(ql)?:\/\//i.test(app.log),'no connection strings in the service log');

  // The runtime role is limited exactly as on Render.
  const role=(await admin.query("SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,rolcanlogin FROM pg_roles WHERE rolname='safeer_app'")).rows[0];
  assert.deepEqual(role,{rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolcanlogin:true});
  const ledger=new pg.Client({...config,connectionString:url.href});await ledger.connect();
  try{
   const applied=(await ledger.query('SELECT count(*)::int AS n FROM safeer_meta.schema_migrations')).rows[0].n;
   assert.equal(applied,(await (await import('../database/migrate.mjs')).readMigrations()).length,'every migration applied');
  }finally{await ledger.end();}

  const owner=edge(port,'198.51.100.21'),guest=edge(port,'203.0.113.21'),neighbour=edge(port,'203.0.113.22');
  // Render's health check reaches the service by its internal address; everything else needs the public host.
  const health=await owner.send('/api/v1/health',{host:'10.0.0.8:'+port});const h=ok(health,200);
  assert.equal(h.database,'connected');assert.equal(h.mode,'local-identity');
  assert.equal((await owner.send('/staff',{host:'safeer.onrender.example'})).status,403);
  for(const page of ['/','/demo','/staff','/marketplace','/booking','/driver','/track','/privacy','/account-deletion']){
   const r=await owner.send(page);assert.equal(r.status,200,page);
   assert.match(r.headers['strict-transport-security']||'',/max-age=31536000/,page+' HSTS');
   assert.match(r.headers['content-security-policy']||'',/default-src 'self'; script-src 'self'/,page+' CSP');
   assert.equal(r.headers['x-content-type-options'],'nosniff');assert.equal(r.headers['cache-control'],'no-store',page);
   assert.equal(r.headers['permissions-policy'],page==='/driver'?'camera=(self), microphone=(), geolocation=(), payment=(), usb=()':'camera=(), microphone=(), geolocation=(), payment=(), usb=()',page);
  }
  const asset=await owner.send('/src/marketplace.js');assert.equal(asset.status,200);assert.equal(asset.headers['cache-control'],'no-cache');
  assert.equal((await owner.send('/src/marketplace.js',{headers:{'if-none-match':asset.headers.etag}})).status,304,'unchanged assets revalidate');
  assert.equal((await owner.send('/src/../server.mjs')).status,404);assert.equal((await owner.send('/.env')).status,404);assert.equal((await owner.send('/runtime/postgres.log')).status,404);
  assert.deepEqual(JSON.parse((await owner.send('/mobile/releases')).raw),appRelease,'the update notice serves the committed release data');
  // Without Google credentials, account sign-in says it is unavailable instead of failing.
  const google=await owner.send('/api/v1/passenger/google/start');assert.equal(google.status,302);assert.equal(google.headers.location,'/marketplace?view=profile&signin=unavailable');

  // First sign-in uses the logged temporary password and must replace it; cookies are Secure.
  const signed=await owner.api('auth/login','POST',{login:first[1],password:first[2]});ok(signed);
  assert.match(signed.headers['set-cookie'].join(';'),/Secure/);assert.equal(signed.data.user.mustChangePassword,true);
  assert.equal((await owner.send('/api/v1/auth/login',{method:'POST',body:{login:first[1],password:first[2]},headers:{origin:'https://foreign.example'}})).status,403,'foreign origins are refused');
  const password=randomBytes(18).toString('base64url'),pw={currentPassword:password};
  ok(await owner.api('auth/password','POST',{currentPassword:first[2],newPassword:password}));

  // A short real workflow through the edge: publish a trip, a guest holds, the owner takes cash.
  const cities=[];for(const c of ['N','S'])cities.push(ok(await owner.api('cities','POST',{code:'PROD_'+c,nameEn:'Fictional '+c,nameAr:'مدينة '+c,countryCode:'SD',active:true,...pw})).id);
  const cid=ok(await owner.api('companies','POST',{nameEn:'Fictional Production Lines',nameAr:'خطوط تجريبية',slug:'production-lines',holdMinutes:30,timezone:'Africa/Khartoum',locale:'ar',...pw})).id,base='companies/'+cid;
  const w=ok(await owner.api(base),200);ok(await owner.api(base,'PATCH',{...w.company,id:undefined,status:'approved',...pw}),200);
  const route=ok(await owner.api(base+'/routes','POST',{code:'P1',nameEn:'North to South',nameAr:'الشمال إلى الجنوب',active:true,stops:cities.map(cityId=>({cityId})),...pw})).id;
  const layout=ok(await owner.api(base+'/fleet/layouts','POST',{code:'L4',nameEn:'Coach',nameAr:'حافلة',active:true,rows:1,columns:4,seats:[1,2,3,4].map(i=>({row:1,column:i,label:String(i)})),...pw})).id;
  const bus=ok(await owner.api(base+'/fleet/buses','POST',{code:'B1',registration:'PROD 1',layoutId:layout,layoutRevision:1,active:true,...pw})).id;
  const driver=ok(await owner.api(base+'/drivers','POST',{employeeCode:'D1',nameEn:'Fictional Driver',nameAr:'سائق',active:true,...pw})).id;
  const date=new Date(Date.now()+5*86400000).toISOString().slice(0,10),trip=ok(await owner.api(base+'/trips','POST',{routeId:route,dates:[date],time:'06:45',offsets:[0,180],fareMinor:120000,...pw})).ids[0];
  ok(await owner.api(`${base}/trips/${trip}/assignment`,'POST',{busId:bus,driverId:driver,version:1,...pw}));ok(await owner.api(`${base}/trips/${trip}/publish`,'POST',{version:2,...pw}));
  ok(await owner.api(base+'/public-profile','PUT',{listed:true,aboutEn:'',aboutAr:'',version:0,...pw}),200);
  const listed=ok(await guest.api('public/trips?'+new URLSearchParams({from:'PROD_N',to:'PROD_S',date})),200).items;assert.deepEqual(listed.map(t=>t.id),[trip]);
  assert.equal(listed[0].time,'06:45','company-local departure time');
  const key=randomUUID(),hold=ok(await guest.api('public/holds','POST',{tripId:trip,seats:['2'],key,mobile:'0912345678',travelers:[{seat:'2',name:'مسافرة تجريبية'}]}));
  const branch=ok(await owner.api(base+'/branches','POST',{nameEn:'Branch',nameAr:'فرع',code:'BR',active:true,...pw})).id,station=ok(await owner.api(base+'/stations','POST',{nameEn:'Office',nameAr:'مكتب',code:'ST',branchId:branch,cityId:cities[0],active:true,...pw})).id;
  const counter=ok(await owner.api(base+'/counters','POST',{stationId:station,code:'C1',name:'Counter',...pw})).id;ok(await owner.api(base+'/counter/sessions','POST',{counterId:counter,openingMinor:0}));
  const bid=ok(await owner.api(base+'/bookings?q='+hold.reference),200).items[0].id;ok(await owner.api(`${base}/bookings/${bid}/pay`,'POST',{method:'cash',key:randomUUID()}));
  assert.equal(ok(await guest.send('/api/v1/public/holds/'+hold.reference,{headers:{'x-booking-key':key}}),200).status,'confirmed');
  // Limits belong to each visitor at the edge.
  const guess=()=>'SF-'+Array.from({length:8},()=>'23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[randomBytes(1)[0]%32]).join('');
  for(let i=0;i<30;i++)assert.equal((await guest.api('public/holds/lookup','POST',{reference:guess(),mobile:'0912345678'})).status,404);
  assert.equal((await guest.api('public/holds/lookup','POST',{reference:guess(),mobile:'0912345678'})).status,429);
  assert.equal((await neighbour.api('public/holds/lookup','POST',{reference:hold.reference,mobile:'0912345678'})).status,201,'another visitor still finds their booking');

  // A redeploy runs the same command again: no second owner, the runtime role is reused, data stays.
  await app.stop();app=null;
  again=launch(env);await again.ready;assert.ok(!again.log.includes('First owner created'),again.log);
  const back=edge(port,'198.51.100.21');ok(await back.api('auth/login','POST',{login:first[1],password}));
  assert.equal(ok(await back.api(`${base}/bookings/${bid}`),200).status,'confirmed');
 }finally{
  await app?.stop();await again?.stop();
  await admin.query(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`);
  await admin.query('DROP ROLE IF EXISTS safeer_app');await admin.query(`DROP ROLE IF EXISTS "${ownerRole}"`);await admin.end();
 }
});
