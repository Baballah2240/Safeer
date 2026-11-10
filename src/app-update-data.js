/** Accept only published Safeer app artifacts. Never turn remote JSON into arbitrary links/markup. */
export function validateAppRelease(info,previous){
 if(!info||typeof info!=='object'||!info.apps)throw Error('Invalid release metadata');
 const apps={};for(const flavor of ['driver','booking']){
  const file={versionName:info.versionName,versionCode:info.versionCode,tag:info.tag,releasePage:info.releasePage,...info.apps[flavor]};
  if(!info.apps[flavor]||!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?$/.test(file.versionName)||!Number.isSafeInteger(file.versionCode)||file.versionCode<1||file.versionCode>2147483647||file.tag!=='v'+file.versionName||!/^[a-f0-9]{64}$/.test(file.sha256)||!Number.isSafeInteger(file.bytes)||file.bytes<1000||file.bytes>100*1024*1024)throw Error('Invalid release metadata');
  const base='https://github.com/Baballah2240/Safeer/releases/',name='Safeer-'+(flavor==='driver'?'Driver':'Booking')+'-'+file.versionName+'.apk';
  if(file.releasePage!==base+'tag/'+file.tag||file.url!==base+'download/'+file.tag+'/'+name||previous?.apps?.[flavor]?.versionCode>file.versionCode)throw Error('Invalid release metadata');
  apps[flavor]={versionName:file.versionName,versionCode:file.versionCode,tag:file.tag,releasePage:file.releasePage,url:file.url,sha256:file.sha256,bytes:file.bytes};
 }
 return {...apps.booking,apps};
}
