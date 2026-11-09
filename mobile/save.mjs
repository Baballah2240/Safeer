import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=new URL('./releases/',import.meta.url);
mkdirSync(out,{recursive:true});
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8',windowsHide:true}).trim();
const dirty=Boolean(git('status','--porcelain','--','.'));
const apps=[];
for(const flavor of ['driver','booking']){
 const source=new URL(`./android/app/build/outputs/apk/${flavor}/debug/app-${flavor}-debug.apk`,import.meta.url),bytes=readFileSync(source);
 if(bytes.length<1000||bytes.readUInt32LE(0)!==0x04034b50)throw Error('Invalid built APK.');
 const filename=`Safeer-${flavor==='driver'?'Driver':'Booking'}-0.16.0-usb.6.apk`,sha256=createHash('sha256').update(bytes).digest('hex');
 copyFileSync(source,new URL(filename,out));writeFileSync(new URL(filename+'.sha256',out),`${sha256}  ${filename}\n`);
 apps.push({applicationId:'sd.safeer.'+flavor,versionName:'0.16.0-usb.6',versionCode:16006,filename,bytes:bytes.length,sha256});
}
writeFileSync(new URL('latest.json',out),JSON.stringify({channel:'debug-usb-local',builtAt:new Date().toISOString(),sourceCommit:dirty?null:git('rev-parse','HEAD'),packagingCommit:git('rev-parse','HEAD'),sourceDirty:dirty,serverOrigin:'http://127.0.0.1:4320',requiresRunningComputerAndUsbTunnel:true,apps},null,2)+'\n');
console.log('Saved both Safeer APKs, SHA-256 sidecars and mobile/releases/latest.json.');
