import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2);
// Default: website apps signed with the private upload key, connected to the live HTTPS site.
// --usb: debug apps for development that reach this computer through adb reverse.
if(args.some(a=>!['--hosted-check','--usb'].includes(a)))throw Error('Use mobile:build (website) or mobile:build:usb.');
const hosted=!args.includes('--usb');
const uploadProperties=process.env.SAFEER_UPLOAD_PROPERTIES||join(process.env.USERPROFILE||'','.android/safeer-upload.properties');
if(hosted&&!existsSync(uploadProperties))throw Error('No upload key found. Run npm.cmd run mobile:upload-key once and back it up privately.');
const tasks=hosted?['-PsafeerOrigin=https://safeer.mohbaba.online','-PsafeerUploadProperties='+uploadProperties,'assembleDriverRelease','assembleBookingRelease','lintDriverRelease','lintBookingRelease']:['assembleDriverDebug','assembleBookingDebug','lintDriverDebug','lintBookingDebug'];
const android=fileURLToPath(new URL('./android/',import.meta.url));
const jdks=join(process.env.USERPROFILE||'','.gradle/jdks');
const candidates=[process.env.JAVA_HOME,...(existsSync(jdks)?readdirSync(jdks).map(n=>join(jdks,n)):[]),'C:/Program Files/Android/Android Studio/jbr'].filter(Boolean);
const javaHome=candidates.find(p=>existsSync(join(p,'bin/java.exe'))&&existsSync(join(p,'release'))&&/JAVA_VERSION="(?:17|21)(?:\.|\")/.test(readFileSync(join(p,'release'),'utf8')));
if(process.platform!=='win32')throw Error('Use mobile/android/gradlew assembleDriverDebug assembleBookingDebug on your Android build environment.');
if(!javaHome)throw Error('Set JAVA_HOME to a compatible JDK 17 or 21.');
const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT||join(process.env.LOCALAPPDATA||'','Android/Sdk');
if(!existsSync(join(sdk,'platforms/android-35/android.jar')))throw Error('Install Android SDK platform 35 first.');
const r=spawnSync(join(javaHome,'bin/java.exe'),['-classpath',join(android,'gradle/wrapper/gradle-wrapper.jar'),'org.gradle.wrapper.GradleWrapperMain','--offline','--no-daemon',...tasks],{cwd:android,windowsHide:true,stdio:'inherit',env:{...process.env,DEBUG:'',JAVA_HOME:javaHome,ANDROID_HOME:resolve(sdk)}});
process.exitCode=r.status??1;
