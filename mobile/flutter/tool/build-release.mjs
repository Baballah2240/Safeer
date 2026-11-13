// D78: npm run mobile:build. Signed release APKs of the Flutter apps (the published Safeer apps) for ARM phones.
// Release builds use the live site and the private upload key in %USERPROFILE%\.android\safeer-upload.properties.
// Usage: mobile:build [--driver-only|--passenger-only]; then npm run mobile:save.
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2);if(args.length>1||args.some(a=>!['--driver-only','--passenger-only'].includes(a))){console.error('Use mobile:build [--driver-only|--passenger-only].');process.exit(1);}
const apps=args[0]==='--driver-only'?['safeer_driver']:args[0]==='--passenger-only'?['safeer_passenger']:['safeer_passenger','safeer_driver'];
const here=fileURLToPath(new URL('../apps/',import.meta.url)),windows=process.platform==='win32';
const properties=process.env.SAFEER_UPLOAD_PROPERTIES||join(process.env.USERPROFILE||process.env.HOME||'','.android/safeer-upload.properties');
if(!existsSync(properties)){console.error('No upload key found ('+properties+'). Release builds must carry the Safeer upload key; see mobile/PLAY_STORE.md.');process.exit(1);}
const flutter=[process.env.FLUTTER,process.env.FLUTTER_ROOT&&join(process.env.FLUTTER_ROOT,'bin','flutter'+(windows?'.bat':'')),join(process.env.USERPROFILE||process.env.HOME||'','dev/flutter/bin/flutter'+(windows?'.bat':''))].filter(Boolean).find(existsSync)||'flutter';
for(const app of apps){
 console.log('Building '+app+' (release, live site, ARM)...');
 const command=[flutter,'build','apk','--release','--target-platform','android-arm,android-arm64'];
 const result=windows?spawnSync(process.env.ComSpec||'cmd.exe',['/d','/s','/c','"'+command.map(p=>p.includes(' ')?`"${p}"`:p).join(' ')+'"'],{cwd:join(here,app),stdio:'inherit',windowsHide:true,windowsVerbatimArguments:true}):spawnSync(command[0],command.slice(1),{cwd:join(here,app),stdio:'inherit'});
 if(result.status!==0){console.error(app+' did not build.');process.exit(result.status??1);}
}
console.log('Built '+apps.join(' and ')+'. Next: npm run mobile:save'+(args[0]?' '+args[0]:'')+'.');
