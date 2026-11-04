import {readFileSync} from 'node:fs';
import type {Pool} from 'pg';

type Policy={tables:Record<string,{rls:boolean;privileges:string[]}>;functions:string[]};
const policy=JSON.parse(readFileSync(new URL('../../config/database-security.json',import.meta.url),'utf8')) as Policy;
const privileges=['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'];

/** Fail closed on missing/drifted security objects. This is configuration verification,
 * not an attempt to repair a database or trust its current grants as the policy. */
export async function verifyDatabaseSecurity(pool:Pool){
 const {rows:tables}=await pool.query(`SELECT c.relname AS name,c.relrowsecurity AS rls,
  ARRAY(SELECT p FROM unnest($1::text[]) p WHERE has_table_privilege(current_user,c.oid,p)) AS privileges,
  ARRAY(SELECT p FROM unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) p WHERE has_any_column_privilege(current_user,c.oid,p)) AS columns
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='safeer' AND c.relkind IN ('r','p') ORDER BY c.relname`,[privileges]);
 if(tables.length!==Object.keys(policy.tables).length)throw Error('Database security policy does not match the installed schema.');
 for(const row of tables){
  const expected=policy.tables[row.name],columns=expected?.privileges.filter(p=>['SELECT','INSERT','UPDATE','REFERENCES'].includes(p));
  if(!expected||row.rls!==expected.rls||JSON.stringify([...row.privileges].sort())!==JSON.stringify([...expected.privileges].sort())||JSON.stringify([...row.columns].sort())!==JSON.stringify(columns?.sort()))throw Error('Database row security or direct grants do not match the reviewed policy.');
 }
 const {rows:required}=await pool.query('SELECT signature,to_regprocedure(signature)::oid AS oid FROM unnest($1::text[]) signature',[policy.functions]);
 if(required.some(r=>!r.oid))throw Error('A required database projection is missing. Apply the reviewed migrations.');
 const {rows:functions}=await pool.query(`SELECT p.oid,has_function_privilege(current_user,p.oid,'EXECUTE') AS callable,
  p.proowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) AS owned,
  p.prosecdef AND NOT coalesce(p.proconfig @> ARRAY['search_path=pg_catalog'],false) AS unsafe_path,
  EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='safeer'`);
 const callable=new Set(required.map(r=>r.oid));
 if(functions.some(f=>f.owned||f.unsafe_path||f.public_execute||f.callable!==callable.has(f.oid))||required.some(r=>!functions.some(f=>f.oid===r.oid)))throw Error('Database function security does not match the reviewed policy.');
}
