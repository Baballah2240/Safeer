// Run while the local launcher is stopped, before an upgrade. Stops only a database left running, copies runtime/
// privately, then proves that a separate copy of the backup starts and holds the data. Never an HTTP route.
import {execFileSync,spawnSync} from 'node:child_process';
import {cpSync,existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {basename,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {createServer} from 'node:net';

const root=fileURLToPath(new URL('../',import.meta.url)),label=process.argv[2]||'manual',runtime=resolve(process.argv[3]||join(root,'runtime'));
if(!/^[A-Za-z0-9-]{1,40}$/.test(label))throw Error('Use a short backup label such as Section-05.');
const bin=join(root,'node_modules/@embedded-postgres/windows-x64/native/bin'),directory=join(runtime,'postgres');
if(!existsSync(join(directory,'PG_VERSION')))throw Error('No local database found. Nothing was copied.');
// Do not follow junctions/symlinks while copying a private database or cleaning a restore.
function checkTree(path){
 if(lstatSync(path).isSymbolicLink())throw Error('A database backup path contains a link. Nothing was removed.');
 for(const entry of readdirSync(path,{withFileTypes:true})){
  const child=join(path,entry.name);if(lstatSync(child).isSymbolicLink())throw Error('A database backup path contains a link. Nothing was removed.');
  if(entry.isDirectory())checkTree(child);
 }
}
checkTree(directory);
const ctl=args=>spawnSync(join(bin,'pg_ctl.exe'),args,{windowsHide:true,stdio:'ignore',timeout:60000}).status;
if(ctl(['-D',directory,'status'])===0&&ctl(['-D',directory,'-m','fast','-w','stop'])!==0)throw Error('The database did not stop cleanly. Nothing was copied.');
if(existsSync(join(directory,'postmaster.pid')))throw Error('The database still looks open. Nothing was copied.');
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(join(dir,entry.name)):[join(dir,entry.name)]),hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const date=new Date().toISOString().slice(0,10),name=`Safeer-before-${label}-${date}-${randomUUID()}`,backup=join(runtime,'backups',name);
mkdirSync(backup,{recursive:true,mode:0o700});
for(const item of ['postgres','local-settings.json','first-login.txt'])if(existsSync(join(runtime,item)))cpSync(join(runtime,item),join(backup,item),{recursive:true});
const files=walk(backup),manifest=Object.fromEntries(files.map(file=>[relative(backup,file),hash(file)]));
for(const file of files)if(manifest[relative(backup,file)]!==hash(join(runtime,relative(backup,file))))throw Error('The backup differs from the source: '+relative(backup,file));
writeFileSync(join(backup,'BACKUP-MANIFEST.json'),JSON.stringify({label,createdAt:new Date().toISOString(),files:manifest},null,1));
// Verify on a copy: starting PostgreSQL changes its files, and the backup itself must stay exact.
const scratch=mkdtempSync(join(tmpdir(),'safeer-restore-')),copy=join(scratch,'postgres');
try{execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(root,'scripts/protect-runtime.ps1'),'-Path',scratch],{windowsHide:true,stdio:'ignore'});}
catch{throw Error('Could not protect the private restore-check directory. The backup was retained.');}
cpSync(join(backup,'postgres'),copy,{recursive:true});
const settings=JSON.parse(readFileSync(join(backup,'local-settings.json'),'utf8')),counts={};
const port=await new Promise((accept,reject)=>{const probe=createServer();probe.once('error',reject);probe.listen(0,'127.0.0.1',()=>{const value=probe.address().port;probe.close(()=>accept(value));});});
if(ctl(['-D',copy,'-l',join(scratch,'log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start'])!==0)throw Error('The restored copy did not start. Keep the original runtime/ and do not upgrade.');
try{
 const client=new pg.Client({connectionString:`postgresql://safeer_owner:${settings.ownerPassword}@127.0.0.1:${port}/safeer`});await client.connect();
 try{for(const {tablename} of (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='safeer' ORDER BY tablename")).rows)if(!['sessions','auth_throttles','identity_audit','company_audit'].includes(tablename))counts[tablename]=(await client.query(`SELECT count(*)::int AS n FROM safeer."${tablename}"`)).rows[0].n;}finally{await client.end();}
}finally{
 if(ctl(['-D',copy,'-m','fast','-w','stop'])!==0||existsSync(join(copy,'postmaster.pid')))throw Error('The restore-check database did not stop. Its private copy and the backup were retained.');
 const target=realpathSync(scratch),parent=realpathSync(tmpdir());
 if(!target.toLowerCase().startsWith(parent.toLowerCase()+sep)||!/^safeer-restore-[a-zA-Z0-9]+$/.test(basename(target)))throw Error('Unsafe restore-check cleanup path. Nothing was removed.');
 checkTree(target);
 rmSync(target,{recursive:true,force:false,maxRetries:5,retryDelay:500});
}
if(!counts.users)throw Error('The restored copy has no accounts. Keep the original runtime/ and do not upgrade.');
const receipt={backup:name,verifiedFiles:files.length,cleanStop:true,restoreStarted:true,counts};
writeFileSync(join(runtime,'backups',`${label.toLowerCase()}-backup-receipt.json`),JSON.stringify(receipt,null,2)+'\n');
console.log(`Backup verified: ${name}\n${files.length} files match. A restored copy started with ${counts.users} account(s), ${counts.companies??0} company(ies). Now run npm.cmd run local to upgrade.`);
