// D78: RETIRED. Built Play bundles of the old WebView apps; kept for reference. Flutter Play bundles: mobile/PLAY_STORE.md.
// Google Play bundles: npm.cmd run mobile:release -- --origin https://your.domain
// Builds signed Driver and Booking .aab files into ignored mobile/releases/play/. Uploading is a manual Play Console step.
import {existsSync,readdirSync,readFileSync,mkdirSync,copyFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=fileURLToPath(new URL('./',import.meta.url)),android=join(here,'android'),root=join(here,'..');
const fail=message=>{console.error(message);process.exit(1);};
const at=process.argv.indexOf('--origin'),raw=at>0?process.argv[at+1]:'';
let origin;try{origin=new URL(raw);}catch{fail('Pass the public server: --origin https://your.domain');}
if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||['localhost','127.0.0.1'].includes(origin.hostname))fail('The origin must be a public https:// address with no path, for example https://app.example.com');
if(/SUPPORT_CONTACT='';/.test(readFileSync(join(root,'src/legal.js'),'utf8')))fail('Set SUPPORT_CONTACT in src/legal.js first: Play requires a working privacy and deletion contact.');
const properties=process.env.SAFEER_UPLOAD_PROPERTIES||join(process.env.USERPROFILE||'','.android/safeer-upload.properties');
if(!existsSync(properties))fail('No upload key found. Run npm.cmd run mobile:upload-key once and back the key up.');
const jdks=join(process.env.USERPROFILE||'','.gradle/jdks');
const candidates=[process.env.JAVA_HOME,...(existsSync(jdks)?readdirSync(jdks).map(n=>join(jdks,n)):[]),'C:/Program Files/Android/Android Studio/jbr'].filter(Boolean);
const javaHome=candidates.find(p=>existsSync(join(p,'bin/java.exe'))&&existsSync(join(p,'release'))&&/JAVA_VERSION="(?:17|21)(?:\.|")/.test(readFileSync(join(p,'release'),'utf8')));
if(!javaHome)fail('Set JAVA_HOME to a compatible JDK 17 or 21.');
const origin_=origin.origin,sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT||join(process.env.LOCALAPPDATA||'','Android/Sdk');
if(!existsSync(join(sdk,'platforms/android-35/android.jar')))fail('Install Android SDK platform 35 first.');
const r=spawnSync(process.env.ComSpec||'cmd.exe',['/d','/c','gradlew.bat','--offline','--no-daemon','-PsafeerOrigin='+origin_,'-PsafeerUploadProperties='+properties,'bundleDriverRelease','bundleBookingRelease','lintDriverRelease','lintBookingRelease'],{cwd:android,windowsHide:true,stdio:'inherit',env:{...process.env,JAVA_HOME:javaHome,ANDROID_HOME:sdk}});
if(r.status!==0)process.exit(r.status??1);
const out=join(here,'releases/play');mkdirSync(out,{recursive:true});
const gradle=readFileSync(join(android,'app/build.gradle'),'utf8'),defaults=/defaultConfig\s*\{([\s\S]*?)\}/.exec(gradle)?.[1]||'';
const versionFor=flavor=>Number(/versionCode (\d+)/.exec(new RegExp('\\b'+flavor+'\\s*\\{([\\s\\S]*?)\\}').exec(gradle)?.[1]||'')?.[1]||/versionCode (\d+)/.exec(defaults)?.[1]);
const files=[];
for(const flavor of ['driver','booking']){
 const version=versionFor(flavor);if(!Number.isSafeInteger(version))fail('Invalid version: '+flavor);
 const source=join(android,`app/build/outputs/bundle/${flavor}Release/app-${flavor}-release.aab`);
 if(!existsSync(source))fail('Missing bundle: '+source);
 const target=join(out,`safeer-${flavor}-${version}.aab`);copyFileSync(source,target);
 const sha256=createHash('sha256').update(readFileSync(target)).digest('hex');writeFileSync(target+'.sha256',sha256+'\n');files.push({flavor,versionCode:version,file:target,sha256});
}
writeFileSync(join(out,'latest.json'),JSON.stringify({origin:origin_,builtAt:new Date().toISOString(),files},null,2)+'\n');
console.log('Signed Play bundles in mobile/releases/play/. Upload them in Play Console; this script uploads nothing.');
