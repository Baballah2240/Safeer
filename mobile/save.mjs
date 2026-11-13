// D78: saves the signed Flutter release APKs (Safeer Passenger = sd.safeer.booking, Safeer Driver = sd.safeer.driver)
// to the ignored mobile/releases/ with .sha256 files and latest.json, and regenerates src/app-release.js, which the
// website uses for its download links. Run npm run mobile:build first. Usage: mobile:save [--driver-only|--passenger-only]
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const args=process.argv.slice(2);if(args.length>1||args.some(a=>!['--driver-only','--passenger-only'].includes(a)))throw Error('Use mobile:save [--driver-only|--passenger-only].');
const only=args[0]==='--driver-only'?'driver':args[0]==='--passenger-only'?'booking':null;
// The certificate of the private Safeer upload key: every published APK must carry it, or phones refuse the update.
const uploadCertificate='a19fb6c1832196283aa3cf342ac4c2aa78b56d736702f8bccca1d8fcf8df7205';
const here=fileURLToPath(new URL('./',import.meta.url)),root=join(here,'..'),out=join(here,'releases');mkdirSync(out,{recursive:true});
const apps={booking:{app:'safeer_passenger',name:'Booking'},driver:{app:'safeer_driver',name:'Driver'}};
const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT||join(process.env.LOCALAPPDATA||'','Android/Sdk');
const tools=existsSync(join(sdk,'build-tools'))?readdirSync(join(sdk,'build-tools')).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true})).map(v=>join(sdk,'build-tools',v)).find(p=>existsSync(join(p,'lib/apksigner.jar'))):null;
const jdks=join(process.env.USERPROFILE||'','.gradle/jdks');
const java=[process.env.JAVA_HOME,...(existsSync(jdks)?readdirSync(jdks).map(n=>join(jdks,n)):[])].filter(Boolean).map(p=>join(p,'bin',process.platform==='win32'?'java.exe':'java')).find(existsSync);
if(!tools||!java)throw Error('Install the Android SDK build tools and a JDK 17: they check the package, version and signing key before saving.');
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8',windowsHide:true}).trim(),dirty=Boolean(git('status','--porcelain','--','.')),saved=[];
for(const flavor of only?[only]:['driver','booking']){
 const {app,name}=apps[flavor],applicationId='sd.safeer.'+flavor,dir=join(here,'flutter/apps',app);
 const version=/^version:\s*(\d+\.\d+\.\d+)\+(\d+)\s*$/m.exec(readFileSync(join(dir,'pubspec.yaml'),'utf8'));
 if(!version)throw Error('No version: X.Y.Z+code line in '+app+'/pubspec.yaml.');
 const versionName=version[1],versionCode=Number(version[2]),source=join(dir,'build/app/outputs/flutter-apk/app-release.apk');
 // Settings shows the version from a constant in lib/src/app.dart; it must match what Android installs.
 const label=/const \w+Version = '([^']+)';/.exec(readFileSync(join(dir,'lib/src/app.dart'),'utf8'))?.[1];
 if(label!==`${versionName} (${versionCode})`)throw Error(`${app}: lib/src/app.dart shows '${label}' in Settings; set it to '${versionName} (${versionCode})' and rebuild.`);
 if(!existsSync(source))throw Error('Build the '+app+' release APK first (npm run mobile:build).');
 const bytes=readFileSync(source);if(bytes.length<1000||bytes.readUInt32LE(0)!==0x04034b50)throw Error('Invalid APK: '+source);
 const badging=execFileSync(join(tools,process.platform==='win32'?'aapt2.exe':'aapt2'),['dump','badging',source],{encoding:'utf8',windowsHide:true,maxBuffer:1<<24});
 const pkg=/^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/m.exec(badging);
 if(!pkg||pkg[1]!==applicationId||Number(pkg[2])!==versionCode||pkg[3]!==versionName)throw Error(`${app}: the APK is ${pkg?.slice(1).join(' ')||'unreadable'}, pubspec.yaml says ${applicationId} ${versionCode} ${versionName}. Rebuild it.`);
 const certs=execFileSync(java,['-jar',join(tools,'lib/apksigner.jar'),'verify','--print-certs',source],{encoding:'utf8',windowsHide:true});
 if(!certs.includes('certificate SHA-256 digest: '+uploadCertificate))throw Error(app+': not signed with the Safeer upload key. Release builds need %USERPROFILE%/.android/safeer-upload.properties.');
 const filename=`Safeer-${name}-${versionName}.apk`,sha256=createHash('sha256').update(bytes).digest('hex');
 copyFileSync(source,join(out,filename));writeFileSync(join(out,filename+'.sha256'),`${sha256}  ${filename}\n`);
 saved.push({applicationId,app,versionCode,versionName,filename,bytes:bytes.length,sha256});
}
const manifest=only?`latest-${only==='booking'?'passenger':'driver'}.json`:'latest.json';
writeFileSync(join(out,manifest),JSON.stringify({channel:'website',builtAt:new Date().toISOString(),sourceCommit:dirty?null:git('rev-parse','HEAD'),packagingCommit:git('rev-parse','HEAD'),sourceDirty:dirty,serverOrigin:'https://safeer.mohbaba.online',signingCertificateSha256:uploadCertificate,apps:saved},null,2)+'\n');
const previous=(await import(new URL('../src/app-release.js?save='+Date.now(),import.meta.url))).appRelease;
const entries=Object.fromEntries(saved.map(a=>{const flavor=a.applicationId.split('.').pop(),tag='v'+a.versionName;return[flavor,{versionName:a.versionName,versionCode:a.versionCode,tag,releasePage:'https://github.com/Baballah2240/Safeer/releases/tag/'+tag,url:'https://github.com/Baballah2240/Safeer/releases/download/'+tag+'/'+a.filename,sha256:a.sha256,bytes:a.bytes}];}));
// Keep the top-level fields on the Booking (Passenger) release: a Driver-only update must never change them.
const booking=entries.booking||previous.apps.booking,info={...previous,versionName:booking.versionName,versionCode:booking.versionCode,tag:booking.tag,releasePage:booking.releasePage,apps:{...previous.apps,...entries}};
writeFileSync(join(root,'src/app-release.js'),['// Generated by npm run mobile:save (D78: the Flutter apps). Per-app versions allow independent Passenger/Driver updates.','export const appRelease='+JSON.stringify(info,null,1)+';',''].join('\n'));
console.log('Saved '+saved.map(a=>`${a.applicationId} ${a.versionName} (${a.versionCode}, ${(a.bytes/1048576).toFixed(1)} MB)`).join(', ')+' with SHA-256 files and '+manifest+'; src/app-release.js updated.');
console.log('Next: commit src/app-release.js, push, then publish each tag: gh release create v<version> mobile/releases/Safeer-*-<version>.apk* --repo Baballah2240/Safeer --target main, and run npm run check:live.');
