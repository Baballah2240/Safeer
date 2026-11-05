// Creates the private Google Play upload key once, outside Git: %USERPROFILE%/.android/safeer-upload.{jks,properties}.
// Back both files up privately. Losing them means asking Google to reset the upload key.
import {existsSync,readdirSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const folder=join(process.env.USERPROFILE||'','.android'),store=join(folder,'safeer-upload.jks'),properties=join(folder,'safeer-upload.properties');
if(existsSync(store)||existsSync(properties)){console.error('An upload key already exists; it was not replaced: '+store);process.exit(1);}
const jdks=join(process.env.USERPROFILE||'','.gradle/jdks');
const candidates=[process.env.JAVA_HOME,...(existsSync(jdks)?readdirSync(jdks).map(n=>join(jdks,n)):[]),'C:/Program Files/Android/Android Studio/jbr'].filter(Boolean);
const javaHome=candidates.find(p=>existsSync(join(p,'bin/keytool.exe')));
if(!javaHome){console.error('Set JAVA_HOME to a JDK that includes keytool.');process.exit(1);}
mkdirSync(folder,{recursive:true});
const password=randomBytes(24).toString('base64url');
const r=spawnSync(join(javaHome,'bin/keytool.exe'),['-genkeypair','-keystore',store,'-storetype','PKCS12','-alias','safeer-upload','-keyalg','RSA','-keysize','4096','-validity','10000','-dname','CN=Safeer Upload, O=Safeer, C=SD','-storepass:env','SAFEER_KEY_PASS','-keypass:env','SAFEER_KEY_PASS'],{windowsHide:true,stdio:['ignore','ignore','inherit'],env:{...process.env,SAFEER_KEY_PASS:password}});
if(r.status!==0){console.error('keytool failed.');process.exit(1);}
// PKCS12 uses one password for the store and the key.
writeFileSync(properties,`storeFile=${store.replaceAll('\\','/')}\nstorePassword=${password}\nkeyAlias=safeer-upload\nkeyPassword=${password}\n`,{flag:'wx'});
if(process.platform==='win32')for(const file of [store,properties])spawnSync('icacls.exe',[file,'/inheritance:r','/grant:r',`${process.env.USERNAME}:F`],{windowsHide:true,stdio:'ignore'});
console.log('Upload key created (only your Windows user can read it):\n  '+store+'\n  '+properties+'\nBack up both files somewhere private. Never commit or share them.');
