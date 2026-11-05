import {Injectable} from '@nestjs/common';
import {Database} from './database.js';
import {IdentityService} from './identity.service.js';
import {body,digest,text,uuid,fail} from './security.js';
import type {PoolClient} from 'pg';

@Injectable()
export class BoardingService {
 constructor(private readonly db:Database,private readonly identity:IdentityService){}
 private run<T>(token:string,action:(c:PoolClient)=>Promise<T>){
  // Exclusive application lock also serializes membership/reassignment changes with boarding.
  return this.db.transaction(async c=>{await this.identity.principal(c,token);await c.query("SELECT set_config('safeer.session_token',$1,true)",[token]);return action(c);});
 }
 trips(token:string){return this.run(token,async c=>(await c.query('SELECT safeer.driver_trips() AS row')).rows[0].row);}
 manifest(token:string,cid:string,tid:string){uuid(cid);uuid(tid);return this.run(token,async c=>{
  const row=(await c.query('SELECT safeer.driver_manifest($1,$2) AS row',[cid,tid])).rows[0].row;if(!row)fail('NOT_FOUND',404);return row;
 });}
 verify(token:string,cid:string,tid:string,input:unknown,board=false){
  uuid(cid);uuid(tid);const data=body(input,['token','ticketNumber']);
  if(('token' in data)===('ticketNumber' in data))fail('INVALID_INPUT');
  const manual='ticketNumber' in data,qr=manual?text(data.ticketNumber,1,16).toUpperCase():text(data.token,2,66);
  if(manual){if(!/^TKT-[0-9]{8,12}$/.test(qr))fail('INVALID_INPUT');}
  else if(!/^TQ[0-9a-f]{64}$/.test(qr))fail('TICKET_INVALID',409);
  return this.run(token,async c=>(await c.query('SELECT safeer.driver_verify($1,$2,$3,$4) AS row',[cid,tid,qr,board])).rows[0].row);
 }
 event(token:string,cid:string,tid:string,input:unknown){
  uuid(cid);uuid(tid);const data=body(input,['event']);if(!['departed','arrived'].includes(String(data.event)))fail('INVALID_INPUT');
  return this.run(token,async c=>(await c.query('SELECT safeer.driver_event($1,$2,$3) AS row',[cid,tid,data.event])).rows[0].row);
 }
 incident(token:string,cid:string,tid:string,input:unknown){
  uuid(cid);uuid(tid);const data=body(input,['kind','note','key']),kind=text(data.kind,1,10),note=text(data.note,1,500),key=uuid(data.key);
  if(!['delay','breakdown','safety','other'].includes(kind))fail('INVALID_INPUT');
  return this.run(token,async c=>(await c.query('SELECT safeer.driver_incident($1,$2,$3,$4,$5,$6) AS row',[cid,tid,kind,note,digest(`safeer-incident-v1:${cid}:${key}`),digest(JSON.stringify([tid,kind,note]))])).rows[0].row);
 }
}
