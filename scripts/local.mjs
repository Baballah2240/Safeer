import {existsSync,mkdirSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import pg from 'pg';
import {readMigrations,runMigrations} from '../database/migrate.mjs';
import {grantIdentityRuntime} from '../database/runtime-grants.mjs';
import {createIdentityApi} from '../dist/api/app.js';
import {startServer} from '../server.mjs';

if(process.platform!=='win32')throw Error('The bundled local launcher is Windows-only. Configure loopback PostgreSQL and use the documented manual startup on other systems.');
const root=fileURLToPath(new URL('../',import.meta.url)),runtime=join(root,'runtime'),bin=join(root,'node_modules/@embedded-postgres/windows-x64/native/bin');
if(!existsSync(join(bin,'postgres.exe')))throw Error('Install the pinned optional Windows PostgreSQL package with npm ci first.');
mkdirSync(runtime,{recursive:true,mode:0o700});
// Restrict inherited Windows access before creating any local credentials or databases.
try{execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(root,'scripts/protect-runtime.ps1'),'-Path',runtime],{windowsHide:true,stdio:'ignore'});}
catch{throw Error('Could not verify private runtime permissions. Keep runtime/ intact and check its owner.');}
const settingsFile=join(runtime,'local-settings.json');
let settings;
if(existsSync(settingsFile)){try{settings=JSON.parse(readFileSync(settingsFile,'utf8'));}catch{throw Error('Could not read private local database settings. Keep runtime/ intact for recovery.');}}
else{
  const port=await new Promise((accept,reject)=>{const probe=createServer();probe.once('error',reject);probe.listen(0,'127.0.0.1',()=>{const port=probe.address().port;probe.close(()=>accept(port));});});
  settings={port,ownerPassword:randomBytes(32).toString('hex'),appPassword:randomBytes(32).toString('hex')};
  writeFileSync(settingsFile,JSON.stringify(settings,null,2)+'\n',{flag:'wx',mode:0o600});
}
if(!Number.isInteger(settings.port)||settings.port<1024||settings.port>65535||![settings.ownerPassword,settings.appPassword].every(p=>typeof p==='string'&&/^[0-9a-f]{64}$/.test(p)))throw Error('Invalid private local database settings.');
const directory=join(runtime,'postgres'),passwordFile=join(runtime,'init-password-'+randomUUID()+'.txt');
const control=args=>spawnSync(join(bin,'pg_ctl.exe'),args,{windowsHide:true,timeout:45000,stdio:'ignore'});
let started=false,api,web,stopping=false;
async function stop(code=0){
  if(stopping)return;stopping=true;
  await web?.close();await api?.close();
  if(started){const result=control(['-D',directory,'-m','fast','-w','stop']);if(result.status!==0){console.error('The local database did not stop cleanly; keep runtime/ intact for recovery.');code=1;}}
  process.exitCode=code;
}
try{
  if(!existsSync(join(directory,'PG_VERSION'))){
    writeFileSync(passwordFile,settings.ownerPassword,{flag:'wx',mode:0o600});
    try{execFileSync(join(bin,'initdb.exe'),['-D',directory,'-U','safeer_owner','--auth=scram-sha-256','--pwfile='+passwordFile,'--encoding=UTF8','--locale=C'],{windowsHide:true,stdio:'ignore',timeout:45000});}
    finally{unlinkSync(passwordFile);}
  }
  if(control(['-D',directory,'status']).status!==0){
    const result=control(['-D',directory,'-l',join(runtime,'postgres.log'),'-o',`-h 127.0.0.1 -p ${settings.port}`,'-w','start']);
    if(result.status!==0)throw Error('Could not start the private local PostgreSQL instance.');started=true;
  }
  const ownerBase=`postgresql://safeer_owner:${settings.ownerPassword}@127.0.0.1:${settings.port}`;
  const admin=new pg.Client({connectionString:ownerBase+'/postgres',connectionTimeoutMillis:5000});await admin.connect();
  try{
    if(!(await admin.query("SELECT 1 FROM pg_database WHERE datname='safeer'")).rowCount)await admin.query('CREATE DATABASE safeer');
    if(!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='safeer_app'")).rowCount)await admin.query(`CREATE ROLE safeer_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${settings.appPassword}'`);
  }finally{await admin.end();}
  const migration=new pg.Client({connectionString:ownerBase+'/safeer'});await migration.connect();
  try{await runMigrations(migration,await readMigrations());await grantIdentityRuntime(migration,'safeer_app');}finally{await migration.end();}
  process.env.SAFEER_AUTH_DATABASE_URL=`postgresql://safeer_app:${settings.appPassword}@127.0.0.1:${settings.port}/safeer`;
  const webPort=Number(process.env.SAFEER_PORT||4320);
  api=await createIdentityApi({port:Number(process.env.SAFEER_AUTH_PORT||4321),webOrigin:`http://127.0.0.1:${webPort}`});
  const count=(await api.db.pool.query('SELECT count(*)::int AS n FROM safeer.users')).rows[0].n;
  if(!count){const account=await api.identity.bootstrap('owner@safeer.local','Safeer Owner');writeFileSync(join(runtime,'first-login.txt'),`Safeer local development only\nLogin: ${account.login}\nTemporary password: ${account.temporaryPassword}\nChange this password at first sign-in. Do not share or commit this file.\n`,{mode:0o600});console.log('First sign-in details saved privately to runtime/first-login.txt.');}
  web=await startServer({port:webPort,built:true,identityApiUrl:api.origin});
  console.log(`Safeer staff access: ${web.origin}/staff`);console.log(`Passenger demonstration: ${web.origin}`);
  process.once('SIGINT',()=>void stop());process.once('SIGTERM',()=>void stop());
  // Private parent-process control for local supervision/tests; never an HTTP route.
  if(process.send){process.send({type:'safeer:ready',origin:web.origin});process.on('message',message=>{if(message==='safeer:shutdown')void stop().finally(()=>process.disconnect());});}
}catch{
  console.error('Local startup failed. Check that the configured ports are free, dependencies are installed and runtime/ belongs to this user. Do not delete runtime/ to fix a login problem.');
  await stop(1);
}
