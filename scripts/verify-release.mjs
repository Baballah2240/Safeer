// Offline local verification. No persistent runtime access and no deployment.
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync,unlinkSync,realpathSync,lstatSync,readdirSync,rmSync} from 'node:fs';
import {resolve,join,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {databaseConfig} from '../database/migrate.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),qa=join(root,'.qa'),startedAt=new Date().toISOString(),steps=[];
const version=JSON.parse(readFileSync(join(root,'package.json'),'utf8')).version;
const args=process.argv.slice(2);if(args.length)throw Error('Use npm run verify:release without arguments; all release checks are required.');
mkdirSync(qa,{recursive:true});if(lstatSync(qa).isSymbolicLink())throw Error('Verification directory must not be a link.');
const workspace=join(qa,'release-'+randomUUID()),bin=join(root,'node_modules/@embedded-postgres/windows-x64/native/bin');
let owned=false,dbStarted=false,complete=false,databaseUrl=process.env.SAFEER_TEST_DATABASE_URL;
// Invalidate any older successful receipt before work starts.
writeFileSync(join(qa,'release-verification.json'),JSON.stringify({version,startedAt,passed:false,steps:[]},null,2)+'\n');
const run=(label,executable,arguments_,env={},timeout=600000)=>new Promise((accept,reject)=>{
 console.log('Checking: '+label);const before=Date.now(),child=spawn(executable,arguments_,{cwd:root,env:{...process.env,...env},windowsHide:true,stdio:'inherit'});
 const timer=setTimeout(()=>{if(process.platform==='win32'&&child.pid)spawnSync('taskkill.exe',['/pid',String(child.pid),'/t','/f'],{windowsHide:true,stdio:'ignore',timeout:10000});else child.kill();reject(Error('Verification timeout: '+label));},timeout);
 child.once('error',error=>{clearTimeout(timer);reject(Error('Could not start verification: '+label));});
 child.once('exit',code=>{clearTimeout(timer);steps.push({label,passed:code===0,milliseconds:Date.now()-before});code===0?accept():reject(Error('Verification failed: '+label));});
});
const ctl=args=>spawnSync(join(bin,'pg_ctl.exe'),args,{windowsHide:true,stdio:'ignore',timeout:45000}).status;
const noLinks=path=>{if(lstatSync(path).isSymbolicLink())throw Error('Linked verification path; retained for inspection.');if(lstatSync(path).isDirectory())for(const name of readdirSync(path))noLinks(join(path,name));};
try{
 if(process.platform==='win32')await run('unit, API/static build and documentation',process.env.ComSpec||'cmd.exe',['/d','/s','/c','npm.cmd run check']);
 else await run('unit, API/static build and documentation','npm',['run','check']);
 if(databaseUrl)databaseConfig(databaseUrl); // Enforces explicit loopback and no URL options.
 else{
  if(process.platform!=='win32'||!existsSync(join(bin,'initdb.exe')))throw Error('Use the pinned Windows PostgreSQL package or set an explicitly disposable loopback SAFEER_TEST_DATABASE_URL.');
  mkdirSync(workspace,{mode:0o700});owned=true;
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(root,'scripts/protect-runtime.ps1'),'-Path',workspace],{windowsHide:true,stdio:'ignore'});
  const password=randomBytes(32).toString('hex'),file=join(workspace,'password.txt'),directory=join(workspace,'postgres');writeFileSync(file,password,{flag:'wx',mode:0o600});
  try{execFileSync(join(bin,'initdb.exe'),['-D',directory,'-U','safeer_verify','--auth=scram-sha-256','--pwfile='+file,'--no-sync','--encoding=UTF8','--locale=C'],{windowsHide:true,stdio:'ignore',timeout:45000});}finally{unlinkSync(file);}
  const port=await new Promise((accept,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>accept(p));});});
  if(ctl(['-D',directory,'-l',join(workspace,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start'])!==0)throw Error('Disposable PostgreSQL did not start.');dbStarted=true;
  databaseUrl=`postgresql://safeer_verify:${password}@127.0.0.1:${port}/postgres`;
 }
 const env={SAFEER_TEST_DATABASE_URL:databaseUrl};
 const native=readdirSync(join(root,'tests')).filter(p=>p.endsWith('.integration.mjs')).sort().map(p=>'tests/'+p);
 await run('all native PostgreSQL integration, security, concurrency and recovery checks',process.execPath,['--test',...native],env);
 for(const [name,built] of [['platform',false],['identity',true],['reservations',true],['ticketing',true],['boarding',true],['platform',true]])await run(`${built?'built':'source'} ${name} browser workflow`,process.execPath,['tests/'+name+'.browser.mjs'],{...env,SAFEER_BROWSER_BUILT:built?'1':'0'},180000);
 complete=true;
}catch(error){console.error(error.message);process.exitCode=1;}
finally{
 try{if(owned){
  const directory=join(workspace,'postgres');
  // Never remove a cluster that may still be running, even after a failed check.
  const stopped=!dbStarted||ctl(['-D',directory,'-m','fast','-w','stop'])===0;
  if(!stopped||existsSync(join(directory,'postmaster.pid'))){complete=false;process.exitCode=1;console.error('Disposable cluster retained because clean stop was not verified.');}
  else{const target=realpathSync(workspace);if(dirname(target)!==realpathSync(qa)||!/^release-[0-9a-f-]{36}$/.test(basename(target)))throw Error('Unsafe verification cleanup path.');noLinks(target);rmSync(target,{recursive:true,maxRetries:5,retryDelay:500});}
 }}catch{complete=false;process.exitCode=1;console.error('Disposable verification cleanup was not confirmed. Inspect the retained private directory before removing it.');}
 const result={version,startedAt,finishedAt:new Date().toISOString(),passed:complete,scope:'Offline loopback verification; no deployment/native build or registry audit',usesPersistentRuntime:false,steps};
 writeFileSync(join(qa,'release-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(complete?'Local release verification passed.':'Local release verification did not pass.');
}
