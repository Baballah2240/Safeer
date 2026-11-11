// Hosted start (Render): npm run build && node scripts/production.mjs
// Needs DATABASE_URL (migration owner), SAFEER_PUBLIC_ORIGIN (https://...), SAFEER_APP_DB_PASSWORD and PORT.
// Migrates, keeps a limited safeer_app runtime role, then serves the web app on PORT with the API on loopback.
import pg from 'pg';
import {readMigrations,runMigrations} from '../database/migrate.mjs';
import {grantIdentityRuntime} from '../database/runtime-grants.mjs';

const fail=message=>{console.error(message);process.exit(1);};
const {DATABASE_URL:owner,SAFEER_PUBLIC_ORIGIN:publicOrigin,SAFEER_APP_DB_PASSWORD:appPassword,SAFEER_OWNER_LOGIN:ownerLogin}=process.env;
if(!owner)fail('Set DATABASE_URL to the hosted PostgreSQL connection.');
let origin;try{origin=new URL(publicOrigin);}catch{fail('Set SAFEER_PUBLIC_ORIGIN, for example https://safeer.example.com');}
if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash)fail('SAFEER_PUBLIC_ORIGIN must be https:// with no path.');
if(!/^[A-Za-z0-9+/=_-]{32,128}$/.test(appPassword||''))fail('Set SAFEER_APP_DB_PASSWORD to a generated secret of 32 or more letters and digits.');
process.env.SAFEER_DATABASE_HOSTED='1';
const ownerUrl=new URL(owner);

const migration=new pg.Client({connectionString:ownerUrl.href,connectionTimeoutMillis:10000,application_name:'safeer-migrations'});
await migration.connect();
try{
  await runMigrations(migration,await readMigrations());
  // The password is a generated secret limited to safe characters above, so it can be quoted directly.
  const exists=(await migration.query("SELECT 1 FROM pg_roles WHERE rolname='safeer_app'")).rowCount;
  // Hosted owners are not superusers: create with the limited attributes, but later only refresh LOGIN/PASSWORD,
  // because restating SUPERUSER/BYPASSRLS/REPLICATION attributes needs superuser.
  // If the role already signs in with the current password, leave it alone (ALTER ROLE may be refused on hosted PostgreSQL).
  const signsIn=exists&&await (async()=>{const u=new URL(ownerUrl.href);u.username='safeer_app';u.password=appPassword;const c=new pg.Client({connectionString:u.href,connectionTimeoutMillis:10000});try{await c.connect();return true;}catch{return false;}finally{await c.end().catch(()=>{});}})();
  if(!signsIn)await migration.query(exists?`ALTER ROLE safeer_app WITH LOGIN PASSWORD '${appPassword}'`:`CREATE ROLE safeer_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${appPassword}'`);
  const role=(await migration.query("SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR rolreplication AS elevated FROM pg_roles WHERE rolname='safeer_app'")).rows[0];
  if(role.elevated)fail('Role safeer_app has elevated attributes; remove them before starting Safeer.');
  await migration.query(`GRANT CONNECT ON DATABASE "${ownerUrl.pathname.slice(1)}" TO safeer_app`);
  await grantIdentityRuntime(migration,'safeer_app');
}finally{await migration.end();}

const appUrl=new URL(ownerUrl.href);appUrl.username='safeer_app';appUrl.password=appPassword;
process.env.SAFEER_AUTH_DATABASE_URL=appUrl.href;
const {createIdentityApi}=await import('../dist/api/app.js');
const {startServer}=await import('../server.mjs');
const api=await createIdentityApi({port:0,webOrigin:origin.origin});
if(!(await api.db.pool.query('SELECT count(*)::int AS n FROM safeer.users')).rows[0].n){
  if(!ownerLogin)fail('Set SAFEER_OWNER_LOGIN to the first owner email, then redeploy.');
  const account=await api.identity.bootstrap(ownerLogin,'Safeer Owner');
  // Shown once in the private service log; it must be changed at first sign-in.
  console.log(`First owner created: ${account.login}. Temporary password: ${account.temporaryPassword}`);
}
// SAFEER_LOOPBACK_ONLY=1 is for the local production test only (tests/production.integration.mjs), so a
// developer machine never exposes the disposable instance to its network. Render leaves it unset.
const web=await startServer({port:Number(process.env.PORT||10000),built:true,identityApiUrl:api.origin,publicOrigin:origin.origin,loopbackOnly:process.env.SAFEER_LOOPBACK_ONLY==='1'});
console.log(`Safeer is serving ${origin.origin}`);
const stop=()=>web.close().then(()=>api.close()).finally(()=>process.exit(0));
process.once('SIGINT',stop);process.once('SIGTERM',stop);
