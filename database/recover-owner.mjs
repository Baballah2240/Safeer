import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {databaseConfig} from './migrate.mjs';
import {login,secret,hashPassword} from '../dist/api/security.js';
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--email')throw Error('Use: npm run identity:recover -- --email owner@safeer.local');
const email=login(args[1]),temporaryPassword=secret().slice(0,24),hash=await hashPassword(temporaryPassword);
const client=new pg.Client(databaseConfig(process.env.SAFEER_DATABASE_URL));
try{
  await client.connect();
  const elevated=(await client.query('SELECT rolsuper FROM pg_roles WHERE rolname=current_user')).rows[0]?.rolsuper;
  if(!elevated)throw Error('Recovery requires the private local database owner connection.');
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(94106,2)');
  const user=(await client.query(`SELECT u.id FROM safeer.users u JOIN safeer.platform_user_roles a ON a.user_id=u.id JOIN safeer.roles r ON r.id=a.role_id WHERE u.normalized_login=$1 AND r.code='platform_super_administrator'`,[email])).rows[0];
  if(!user)throw Error('No protected owner account found.');
  await client.query('UPDATE safeer.users SET password_hash=$1,active=true,must_change_password=true,credential_version=credential_version+1,version=version+1,updated_at=clock_timestamp() WHERE id=$2',[hash,user.id]);
  await client.query('UPDATE safeer.sessions SET revoked_at=clock_timestamp() WHERE user_id=$1 AND revoked_at IS NULL',[user.id]);
  await client.query("INSERT INTO safeer.identity_audit(id,action,target_id) VALUES($1,'owner.recovered',$2)",[randomUUID(),user.id]);
  await client.query('COMMIT');console.log(JSON.stringify({login:email,temporaryPassword},null,2));
}catch{await client.query('ROLLBACK').catch(()=>{});console.error('Owner recovery failed. Verify the local owner connection and target account.');process.exitCode=1;}
finally{await client.end();}
