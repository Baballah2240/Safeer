import {randomUUID,randomBytes} from 'node:crypto';
import pg from 'pg';
import {databaseConfig,readMigrations,runMigrations} from '../../database/migrate.mjs';
import {grantIdentityRuntime} from '../../database/runtime-grants.mjs';
import {createIdentityApi} from '../../dist/api/app.js';

export async function identityFixture(action,{webOrigin='http://127.0.0.1:4320'}={}){
  if(!process.env.SAFEER_TEST_DATABASE_URL)throw Error('Set SAFEER_TEST_DATABASE_URL to a disposable loopback PostgreSQL instance. Tests do not skip.');
  const config=databaseConfig(process.env.SAFEER_TEST_DATABASE_URL),suffix=randomUUID().replaceAll('-',''),name='safeer_s02_'+suffix,role='safeer_'+suffix,pass=randomBytes(32).toString('hex');
  const owner=new pg.Client(config);await owner.connect();
  let migration,api;
  const ownerUrl=new URL(config.connectionString);ownerUrl.pathname='/'+name;
  try{
    await owner.query(`CREATE ROLE "${role}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${pass}'`);
    await owner.query(`CREATE DATABASE "${name}"`);
    migration=new pg.Client(databaseConfig(ownerUrl.href));await migration.connect();
    await runMigrations(migration,await readMigrations());await grantIdentityRuntime(migration,role);
    const runtimeUrl=new URL(ownerUrl);runtimeUrl.username=role;runtimeUrl.password=pass;process.env.SAFEER_AUTH_DATABASE_URL=runtimeUrl.href;
    api=await createIdentityApi({port:0,webOrigin});
    const initial=await api.identity.bootstrap('owner@safeer.local','Safeer Test Owner');
    const origin=webOrigin;
    function client(){
      let cookie='',csrfToken='';
      return {
        get cookie(){return cookie;},get csrf(){return csrfToken;},setCookie(value){cookie=value;},
        async request(path,method='GET',body,headers={}){
          const response=await fetch(api.origin+'/api/v1/'+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:origin,'X-CSRF-Token':csrfToken}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
          const raw=await response.text();let json;try{json=JSON.parse(raw);}catch{json={raw};}
          const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];if(json.data?.csrfToken)csrfToken=json.data.csrfToken;
          return {status:response.status,headers:response.headers,json,data:json.data,error:json.error,raw};
        },
        async signIn(login,password){return this.request('auth/login','POST',{login,password});}
      };
    }
    const admin=client();await admin.signIn(initial.login,initial.temporaryPassword);
    const password=randomBytes(24).toString('base64url');
    const changed=await admin.request('auth/password','POST',{currentPassword:initial.temporaryPassword,newPassword:password});
    if(changed.status!==201)throw Error('Fixture owner password change failed.');
    await action({api,migration,owner,runtimeUrl:runtimeUrl.href,ownerUrl:ownerUrl.href,admin,password,initial,client,disconnectSource:async()=>{await api?.close();api=undefined;await migration?.end();migration=undefined;}});
  }finally{
    await api?.close();await migration?.end();
    await owner.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await owner.query(`DROP ROLE IF EXISTS "${role}"`);await owner.end();delete process.env.SAFEER_AUTH_DATABASE_URL;
  }
}
