import {createIdentityApi} from './app.js';
try{
  const api=await createIdentityApi({port:Number(process.env.SAFEER_AUTH_PORT||4321),webOrigin:process.env.SAFEER_WEB_ORIGIN||'http://127.0.0.1:4320'});
  console.log(`Safeer local identity API: ${api.origin}`);
  const stop=()=>api.close().then(()=>process.exit(0));process.once('SIGINT',stop);process.once('SIGTERM',stop);
}catch{console.error('Identity startup failed. Review local database configuration, runtime permissions and migrations.');process.exitCode=1;}
