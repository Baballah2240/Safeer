import {Injectable,OnModuleDestroy} from '@nestjs/common';
import pg,{type PoolClient} from 'pg';
import {verifyDatabaseSecurity} from './database-security.js';

export function localDatabase(value: string|undefined): string {
  if(!value)throw Error('Set SAFEER_AUTH_DATABASE_URL for the local identity runtime role.');
  const url=new URL(value);
  if(!['postgres:','postgresql:'].includes(url.protocol)||!(process.env.SAFEER_DATABASE_HOSTED==='1'||['127.0.0.1','localhost','[::1]'].includes(url.hostname))||url.search||url.hash||!/^\/[a-zA-Z0-9_]+$/.test(url.pathname))throw Error('Identity database must use an explicit loopback PostgreSQL URL without options.');
  return url.href;
}
@Injectable()
export class Database implements OnModuleDestroy {
  readonly pool: pg.Pool;
  constructor(){
    this.pool=new pg.Pool({connectionString:localDatabase(process.env.SAFEER_AUTH_DATABASE_URL),max:8,connectionTimeoutMillis:5000,statement_timeout:8000,idle_in_transaction_session_timeout:10000,application_name:'safeer-identity'});
    this.pool.on('error',()=>{/* Do not log credentials or server SQL details. Subsequent requests fail closed. */});
  }
  async ready(){
    const {rows}=await this.pool.query(`SELECT r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,
      has_schema_privilege(current_user,'safeer','CREATE') AS ddl,
      EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid) AS membership,
      EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname='safeer' AND n.nspowner=r.oid) AS schema_owner,
      EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='safeer' AND c.relowner=r.oid) AS object_owner
      FROM pg_roles r WHERE r.rolname=current_user`);
    if(!rows[0]||Object.values(rows[0]).some(Boolean))throw Error('The identity API requires a limited non-owner runtime database role without inherited memberships.');
    await verifyDatabaseSecurity(this.pool);
  }
  async transaction<T>(action:(client:PoolClient)=>Promise<T>,write=true):Promise<T>{
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='5s'");
      await client.query(write?'SELECT pg_advisory_xact_lock(94106,2)':'SELECT pg_advisory_xact_lock_shared(94106,2)');
      const result=await action(client);await client.query('COMMIT');return result;
    }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
  }
  async onModuleDestroy(){await this.pool.end();}
}
