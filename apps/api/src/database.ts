import {Injectable,OnModuleDestroy} from '@nestjs/common';
import pg,{type PoolClient} from 'pg';

export function localDatabase(value: string|undefined): string {
  if(!value)throw Error('Set SAFEER_AUTH_DATABASE_URL for the local identity runtime role.');
  const url=new URL(value);
  if(!['postgres:','postgresql:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.search||url.hash||!/^\/[a-zA-Z0-9_]+$/.test(url.pathname))throw Error('Identity database must use an explicit loopback PostgreSQL URL without options.');
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
    await this.pool.query('SELECT id FROM safeer.users LIMIT 0');
    const security=await this.pool.query("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='safeer' AND c.relrowsecurity AND c.relname IN ('companies','company_settings','branches','stations','company_roles','company_role_permissions','company_users','company_user_roles','support_access_grants','support_access_grant_permissions','company_audit','cities','routes','route_stops')");
    if(security.rows[0].n!==14)throw Error('Apply the Section 04 migration with row security before starting the API.');
    const boarding=await this.pool.query("SELECT count(*)::int AS n,bool_or(has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE')) AS direct_access FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='safeer' AND c.relrowsecurity AND c.relname IN ('ticket_credentials','boarding_records','journey_events','journey_incidents')");
    if(boarding.rows[0].n!==4||boarding.rows[0].direct_access)throw Error('Apply the Section 12 migration and restricted journey function grants before starting the API.');
    const finance=await this.pool.query("SELECT has_function_privilege(current_user,to_regprocedure('safeer.finance_report(uuid,date,date,uuid,uuid,text,integer,integer,timestamptz,boolean)'),'EXECUTE') AS ready");
    if(finance.rows[0].ready!==true)throw Error('Apply the Section 13 migration and restricted financial projection grants before starting the API.');
    const platform=await this.pool.query("SELECT count(*)::int AS n,bool_or(has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE')) AS direct_access FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='safeer' AND c.relrowsecurity AND c.relname IN ('platform_settings','notification_events','notification_reads')");
    if(platform.rows[0].n!==3||platform.rows[0].direct_access)throw Error('Apply the Section 14 migration with restricted platform/notification access before starting the API.');
    const projections=await this.pool.query("SELECT bool_and(has_function_privilege(current_user,to_regprocedure(signature),'EXECUTE')) AS ready FROM unnest(ARRAY['safeer.platform_notice()','safeer.platform_dashboard(date,date,integer)','safeer.platform_settings_read()','safeer.platform_settings_save(boolean,text,text,integer)','safeer.notifications_list(bigint)','safeer.notification_read(bigint)']) signature");
    if(projections.rows[0].ready!==true)throw Error('Apply restricted Section 14 function grants before starting the API.');
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
