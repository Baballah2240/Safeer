import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2);if(args.some(a=>!['--usb','--driver-only'].includes(a)))throw Error('Use mobile:save [--usb] [--driver-only].');
const usb=args.includes('--usb'),driverOnly=args.includes('--driver-only');
const root=fileURLToPath(new URL('../',import.meta.url)),out=new URL('./releases/',import.meta.url);mkdirSync(out,{recursive:true});
const gradle=readFileSync(new URL('./android/app/build.gradle',import.meta.url),'utf8'),defaults=/defaultConfig\s*\{([\s\S]*?)\}/.exec(gradle)?.[1]||'';
const versionFor=flavor=>{const block=new RegExp('\\b'+flavor+'\\s*\\{([\\s\\S]*?)\\}').exec(gradle)?.[1]||'';const code=Number(/versionCode (\d+)/.exec(block)?.[1]||/versionCode (\d+)/.exec(defaults)?.[1]),name=/versionName '([^']+)'/.exec(block)?.[1]||/versionName '([^']+)'/.exec(defaults)?.[1];if(!Number.isSafeInteger(code)||!name)throw Error('Invalid app version: '+flavor);return {versionCode:code,versionName:name+(usb?'-usb':'')};};
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8',windowsHide:true}).trim(),dirty=Boolean(git('status','--porcelain','--','.')),apps=[];
for(const flavor of driverOnly?['driver']:['driver','booking']){
 const version=versionFor(flavor),source=new URL(`./android/app/build/outputs/apk/${flavor}/${usb?'debug':'release'}/app-${flavor}-${usb?'debug':'release'}.apk`,import.meta.url);
 if(!existsSync(source))throw Error('Build the '+flavor+' APK first.');const bytes=readFileSync(source);if(bytes.length<1000||bytes.readUInt32LE(0)!==0x04034b50)throw Error('Invalid APK.');
 const filename=`Safeer-${flavor==='driver'?'Driver':'Booking'}-${version.versionName}.apk`,sha256=createHash('sha256').update(bytes).digest('hex');copyFileSync(source,new URL(filename,out));writeFileSync(new URL(filename+'.sha256',out),`${sha256}  ${filename}\n`);apps.push({applicationId:'sd.safeer.'+flavor,...version,filename,bytes:bytes.length,sha256});
}
const manifest=driverOnly?'latest-driver.json':'latest.json';writeFileSync(new URL(manifest,out),JSON.stringify({channel:usb?'debug-usb-local':'website',builtAt:new Date().toISOString(),sourceCommit:dirty?null:git('rev-parse','HEAD'),packagingCommit:git('rev-parse','HEAD'),sourceDirty:dirty,serverOrigin:usb?'http://127.0.0.1:4320':'https://safeer.mohbaba.online',requiresRunningComputerAndUsbTunnel:usb,apps},null,2)+'\n');
if(!usb){
 const previous=(await import(new URL('../src/app-release.js?save='+Date.now(),import.meta.url))).appRelease;
 const entries=Object.fromEntries(apps.map(a=>{const flavor=a.applicationId.split('.').pop(),tag='v'+a.versionName;return[flavor,{versionName:a.versionName,versionCode:a.versionCode,tag,releasePage:'https://github.com/Baballah2240/Safeer/releases/tag/'+tag,url:'https://github.com/Baballah2240/Safeer/releases/download/'+tag+'/'+a.filename,sha256:a.sha256,bytes:a.bytes}];}));
 // Keep legacy globals on the Booking baseline: a Driver-only update must never upgrade Booking.
 const booking=entries.booking||previous.apps.booking,info={...previous,versionName:booking.versionName||previous.versionName,versionCode:booking.versionCode||previous.versionCode,tag:booking.tag||previous.tag,releasePage:booking.releasePage||previous.releasePage,apps:{...previous.apps,...entries}};
 writeFileSync(new URL('../src/app-release.js',import.meta.url),['// Generated release metadata. Per-app versions preserve independent Driver/Booking updates.','export const appRelease='+JSON.stringify(info,null,1)+';',''].join('\n'));
}
console.log('Saved '+apps.map(a=>a.applicationId+' '+a.versionName).join(', ')+', SHA-256 files and '+manifest+'.');
