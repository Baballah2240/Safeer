import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Connection setup fails closed unless one authorized physical USB phone and
// the existing local Safeer server are available. It does not open a firewall.
await import('./usb.mjs');
const adb=(...a)=>execFileSync('adb',a,{encoding:'utf8',windowsHide:true});
const serial=adb('devices','-l').split(/\r?\n/).filter(s=>/^\S+\s+device\s/.test(s)&&!s.startsWith('emulator-')&&!s.split(/\s/)[0].includes(':'));
if(serial.length!==1)throw Error('USB device selection changed. Installation stopped.');
const device=serial[0].split(/\s/)[0],release=new URL('./releases/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('latest.json',release),'utf8'));
if(manifest.channel!=='debug-usb-local'||manifest.apps.length!==2)throw Error('Save the two local test builds first.');
const expected=new Set(['sd.safeer.driver','sd.safeer.booking']);
const apps=manifest.apps.map(app=>{
 if(!expected.delete(app.applicationId)||!/^Safeer-(Driver|Booking)-[a-zA-Z0-9.-]+\.apk$/.test(app.filename))throw Error('Unexpected app package.');
 const file=new URL(app.filename,release),bytes=readFileSync(file);
 if(createHash('sha256').update(bytes).digest('hex')!==app.sha256)throw Error('APK checksum mismatch. Rebuild/save first.');
 return {...app,file:fileURLToPath(file)};
});
if(expected.size)throw Error('Both apps are required.');
for(const app of apps){console.log(adb('-s',device,'install','-r',app.file).trim());const info=adb('-s',device,'shell','dumpsys','package',app.applicationId);if(!info.includes('versionName='+app.versionName)||!info.includes('versionCode='+app.versionCode+' '))throw Error('Installed version did not match.');console.log(app.applicationId+' '+app.versionName+' verified installed.');}
