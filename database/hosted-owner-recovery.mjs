import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {login,secret,hashPassword,digest} from '../dist/api/security.js';

/** Operator-only recovery, never exposed as an HTTP endpoint. */
export async function recoverHostedOwner({connectionString,email,newEmail=email}) {
 const oldLogin=login(email),nextLogin=login(newEmail);
 if(!connectionString)throw Error('Use the private migration-owner DATABASE_URL.');
 const temporaryPassword=secret().slice(0,24),hash=await hashPassword(temporaryPassword);
 const db=new pg.Client({connectionString,connectionTimeoutMillis:10000});
 try{
  await db.connect();await db.query('BEGIN');
  await db.query("SET LOCAL lock_timeout='5s'");await db.query("SET LOCAL statement_timeout='10s'");
  const {rows}=await db.query("SELECT current_user=pg_get_userbyid(c.relowner) AS owns, r.rolsuper FROM pg_class c CROSS JOIN pg_roles r WHERE c.oid='safeer.users'::regclass AND r.rolname=current_user");
  if(!rows[0]||(!rows[0].owns&&!rows[0].rolsuper))throw Error('Recovery requires the database migration owner, not the application runtime role.');
  await db.query('SELECT pg_advisory_xact_lock(94106,2)');
  const target=await db.query("SELECT DISTINCT u.id FROM safeer.users u JOIN safeer.platform_user_roles a ON a.user_id=u.id JOIN safeer.roles r ON r.id=a.role_id WHERE u.normalized_login=$1 AND r.code='platform_super_administrator' AND r.active",[oldLogin]);
  if(target.rows.length!==1)throw Error('No matching protected owner account.');
  const id=target.rows[0].id;
  await db.query('UPDATE safeer.users SET normalized_login=$1,password_hash=$2,active=true,must_change_password=true,credential_version=credential_version+1,version=version+1,updated_at=clock_timestamp() WHERE id=$3',[nextLogin,hash,id]);
  await db.query('UPDATE safeer.sessions SET revoked_at=clock_timestamp() WHERE user_id=$1 AND revoked_at IS NULL',[id]);
  await db.query('DELETE FROM safeer.auth_throttles WHERE key_hash=ANY($1::text[])',[[digest('login:'+oldLogin),digest('login:'+nextLogin)]]);
  await db.query("INSERT INTO safeer.identity_audit(id,action,target_id) VALUES($1,'owner.recovered',$2)",[randomUUID(),id]);
  await db.query('COMMIT');return {login:nextLogin,temporaryPassword};
 }catch(error){await db.query('ROLLBACK').catch(()=>{});throw error;}finally{await db.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2),values={};
 for(let i=0;i<args.length;i++){const key=args[i];if(key==='--confirm-reset'){values.confirm=true;continue;}if(!['--email','--new-email'].includes(key)||!args[i+1]||values[key])throw Error('Use --email existing@example.com [--new-email new@example.com] --confirm-reset');values[key]=args[++i];}
 if(!values.confirm||!values['--email'])throw Error('Specify the existing owner email and --confirm-reset. All its sessions will be revoked.');
 try{console.log(JSON.stringify(await recoverHostedOwner({connectionString:process.env.DATABASE_URL,email:values['--email'],newEmail:values['--new-email']||values['--email']}),null,2));}
 catch{console.error('Owner recovery failed. Verify the target email, uniqueness and private migration-owner connection. No changes committed.');process.exitCode=1;}
}
