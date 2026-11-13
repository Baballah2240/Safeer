// D78: RETIRED with the WebView apps. Kept for reference only; Flutter debug builds use --dart-define=SAFEER_ORIGIN (mobile/flutter/README.md).
import {execFileSync} from 'node:child_process';
const adb=(...a)=>execFileSync('adb',a,{encoding:'utf8',windowsHide:true});
const devices=adb('devices','-l').split(/\r?\n/).filter(s=>/^\S+\s+device\s/.test(s)&&/\busb:|\bproduct:/.test(s)&&!s.startsWith('emulator-')&&!s.split(/\s/)[0].includes(':')).map(s=>s.split(/\s/)[0]);
if(devices.length!==1)throw Error('Connect exactly one authorized USB Android phone, enable USB debugging and accept its prompt.');
const health=await fetch('http://127.0.0.1:4320/api/v1/health',{signal:AbortSignal.timeout(5000)}).then(r=>r.json());
if(health.data?.service!=='safeer'||health.data?.database!=='connected')throw Error('Start the local Safeer service first.');
adb('-s',devices[0],'reverse','tcp:4320','tcp:4320');
console.log('Safeer USB tunnel ready on port 4320. Keep the computer/server/cable connected.');
