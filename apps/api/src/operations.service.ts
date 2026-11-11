import {Injectable} from '@nestjs/common';
import type {PoolClient} from 'pg';
import {Database} from './database.js';
import {IdentityService} from './identity.service.js';
import {uuid,fail} from './security.js';

// D65 operations dashboard. Read-only: every figure comes from confirmed tickets and
// boarding records in the database, so retried or repeated scans cannot change it.
const dayPattern=/^\d{4}-\d{2}-\d{2}$/;
@Injectable()
export class OperationsService {
 constructor(private readonly db:Database,private readonly identity:IdentityService){}
 private staff<T>(token:string,cid:string,action:(c:PoolClient)=>Promise<T>){uuid(cid);return this.db.transaction(async c=>{
  await this.identity.principal(c,token);await c.query("SELECT set_config('safeer.session_token',$1,true)",[token]);
  if(!(await c.query('SELECT 1 FROM safeer.companies WHERE id=$1',[cid])).rowCount)fail('NOT_FOUND',404);
  return action(c);
 },false);}
 today(token:string,cid:string,day:unknown){
  // Date.parse rolls 2026-02-31 over to March, so the day must also round-trip unchanged.
  const value=day===undefined||day===''?null:String(day);if(value!==null&&(!dayPattern.test(value)||Number.isNaN(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value))fail('INVALID_INPUT');
  return this.staff(token,cid,async c=>(await c.query('SELECT safeer.operations_today($1,$2::date) AS row',[cid,value])).rows[0].row);
 }
 trip(token:string,cid:string,tid:string){
  uuid(tid);
  return this.staff(token,cid,async c=>{const row=(await c.query('SELECT safeer.operations_trip($1,$2) AS row',[cid,tid])).rows[0].row;if(!row)fail('NOT_FOUND',404);return row;});
 }
}
