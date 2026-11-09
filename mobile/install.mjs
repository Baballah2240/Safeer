import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// USB is only the install cable. Website apps then use the internet; the
// development channel also needs the local server and adb reverse tunnel.
const saved=JSON.parse(readFileSync(new URL('./releases/latest.json',import.meta.url),'utf8'));
if(saved.channel==='debug-usb-local')await import('./usb.mjs');
const adb=(...a)=>execFileSync('adb',a,{encoding:'utf8',windowsHide:true});
const serial=adb('devices','-l').split(/\r?\n/).filter(s=>/^\S+\s+device\s/.test(s)&&!s.startsWith('emulator-')&&!s.split(/\s/)[0].includes(':'));
if(serial.length!==1)throw Error('Connect exactly one authorized USB Android phone, enable USB debugging and accept its prompt.');
const device=serial[0].split(/\s/)[0],release=new URL('./releases/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('latest.json',release),'utf8'));
if(!['website','debug-usb-local'].includes(manifest.channel)||manifest.apps.length!==2)throw Error('Save the two app builds first.');
const expected=new Set(['sd.safeer.driver','sd.safeer.booking']);
const apps=manifest.apps.map(app=>{
 if(!expected.delete(app.applicationId)||!/^Safeer-(Driver|Booking)-[a-zA-Z0-9.-]+\.apk$/.test(app.filename))throw Error('Unexpected app package.');
 const file=new URL(app.filename,release),bytes=readFileSync(file);
 if(createHash('sha256').update(bytes).digest('hex')!==app.sha256)throw Error('APK checksum mismatch. Rebuild/save first.');
 return {...app,file:fileURLToPath(file)};
});
if(expected.size)throw Error('Both apps are required.');
for(const app of apps){try{console.log(adb('-s',device,'install','-r',app.file).trim());}catch(error){if(/INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures do not match/i.test(String(error.stderr||error.message)))throw Error(app.applicationId+' is installed with a different signing key (the old USB test app). Uninstall it on the phone once, then rerun. Booking keys saved on that phone are removed; references still work.');throw error;}const info=adb('-s',device,'shell','dumpsys','package',app.applicationId);if(!info.includes('versionName='+app.versionName)||!info.includes('versionCode='+app.versionCode+' '))throw Error('Installed version did not match.');console.log(app.applicationId+' '+app.versionName+' verified installed.');}
