// Read-only check of a deployed Safeer site (D72): GET/HEAD requests only, no sign-in, no data.
//   npm run check:live                       (origin from render.yaml)
//   npm run check:live -- https://example.org
// Compares the deployed static files with this checkout's build, so it also shows whether hosting runs
// the latest commit. It cannot prove that phones installed an update.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {publicAssets} from '../config/assets.mjs';
import {appRelease} from '../src/app-release.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const configured=/SAFEER_PUBLIC_ORIGIN\s*\n\s*value:\s*(\S+)/.exec(readFileSync(join(root,'render.yaml'),'utf8'))?.[1];
const origin=new URL(process.argv[2]||configured||'');
if(origin.protocol!=='https:'||origin.pathname!=='/')throw Error('Pass an https:// origin without a path.');
const results=[],note=(name,pass,detail='')=>{results.push({name,pass,detail});console.log(`${pass?'PASS':'FAIL'}  ${name}${detail?'  - '+detail:''}`);};
const get=async(path,init={})=>{try{return await fetch(new URL(path,origin),{redirect:'manual',cache:'no-store',headers:{'User-Agent':'safeer-check-live/1'},signal:AbortSignal.timeout(15000),...init});}catch(error){return {status:0,headers:new Headers(),text:async()=>String(error.cause?.code||error.message),json:async()=>({})};}};
const tag=content=>'"'+createHash('sha256').update(content).digest('base64url').slice(0,27)+'"';

const health=await get('/api/v1/health'),h=(await health.json().catch(()=>({}))).data||{};
note('health responds',health.status===200,`status ${health.status}, version ${h.version??'?'}, database ${h.database??'?'}`);
note('database connected',h.database==='connected');
for(const job of ['holds','retention'])note(`maintenance ${job}`,h.maintenance?.[job]?.state==='ok',`${h.maintenance?.[job]?.state??'?'}, last ${h.maintenance?.[job]?.lastSuccessAt??'never'}`);
for(const page of ['/','/demo','/marketplace','/booking','/staff','/driver','/track','/privacy','/account-deletion']){
 const r=await get(page),csp=r.headers.get('content-security-policy')||'',hsts=r.headers.get('strict-transport-security')||'';
 note('page '+page,r.status===200&&/script-src 'self'/.test(csp)&&/max-age=\d+/.test(hsts)&&r.headers.get('x-content-type-options')==='nosniff',`status ${r.status}${hsts?'':' no HSTS'}${csp?'':' no CSP'}`);
}
note('signed-out staff session is refused',(await get('/api/v1/auth/me')).status===401);
note('private files stay private',(await Promise.all(['/.env','/server.mjs','/runtime/','/src/../package.json'].map(p=>get(p)))).every(r=>r.status===404||r.status===400));
const passenger=(await (await get('/api/v1/passenger/me')).json().catch(()=>({}))).data;
note('passenger accounts endpoint',passenger!==undefined,`Google sign-in ${passenger?.googleEnabled?'configured':'not configured (button shows "not available yet")'}`);

// Deployed release data and files.
const releaseResponse=await get('/mobile/releases'),served=await releaseResponse.json().catch(()=>null);
const same=JSON.stringify(served)===JSON.stringify(appRelease);
note('update notice serves this checkout\'s release data',same,same?'':`deployed ${served?.apps?.booking?.versionName??'?'} / ${served?.apps?.driver?.versionName??'?'}, here ${appRelease.apps.booking.versionName} / ${appRelease.apps.driver.versionName}`);
for(const [flavor,file] of Object.entries((served||appRelease).apps||{})){
 const r=await get(file.url,{method:'HEAD',redirect:'follow'});
 note(`${flavor} APK download`,r.status===200,`${file.url} -> ${r.status}${r.status===404?' (create the GitHub release and attach this file)':''}`);
 // D78: the home page links to /mobile/download/<flavor>, which must lead to the same file.
 const link=await get('/mobile/download/'+flavor);
 note(`home page ${flavor} download link`,link.status===302&&link.headers.get('location')===file.url,`status ${link.status} -> ${link.headers.get('location')??'no redirect'}`);
}

// Static files: the server's ETag is a hash of the exact bytes it serves, and the build copies committed
// files unchanged, so matching ETags against git blobs (LF, as hosting checks them out) names the deployed
// commit. A Windows working copy may use CRLF, so it is not compared directly. Cloudflare marks ETags
// weak (W/) when it compresses a response; the hash inside is unchanged.
const deployed={};for(const [path,[,type]] of Object.entries(publicAssets))if(type!=='text/html')deployed[path]=((await get(path,{method:'HEAD'})).headers.get('etag')||'').replace(/^W\//,'');
const git=(...args)=>execFileSync('git',args,{cwd:root,windowsHide:true,maxBuffer:64*1024*1024});
let match=null,checked=0;const blobs=new Map();
try{
 const commits=git('rev-list','--max-count=60','HEAD').toString().trim().split('\n');
 for(const commit of commits){
  checked++;const tree=new Map(git('ls-tree','-r',commit).toString().trim().split('\n').map(line=>{const [meta,path]=line.split('\t');return [path,meta.split(' ')[2]];}));
  const all=Object.entries(publicAssets).filter(([,[,type]])=>type!=='text/html').every(([path,[file]])=>{const blob=tree.get(file);if(!blob)return false;if(!blobs.has(blob))blobs.set(blob,tag(git('cat-file','blob',blob)));return blobs.get(blob)===deployed[path];});
  if(all){match=commit;break;}
 }
}catch(error){note('git history available',false,error.message);}
const head=git('rev-parse','HEAD').toString().trim();
const subject=match?git('log','-1','--format=%h %s',match).toString().trim():'';
note('hosting serves the latest local commit',match===head,match?(match===head?`deployed ${subject}`:`deployed ${subject}; local HEAD is ${head.slice(0,7)} (${git('rev-list','--count',match+'..'+head).toString().trim()} commits newer)`):`no match in the last ${checked} commits (deployed files changed outside git, or older)`);

const failed=results.filter(r=>!r.pass).length;
console.log(`\n${results.length-failed}/${results.length} live checks passed for ${origin.origin}. Read-only: no sign-in, bookings or changes were made.`);
process.exitCode=failed?1:0;
