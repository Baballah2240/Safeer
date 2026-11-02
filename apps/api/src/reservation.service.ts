import {Injectable,OnModuleDestroy,OnModuleInit} from '@nestjs/common';
import {randomBytes,randomUUID} from 'node:crypto';
import {Database} from './database.js';
import {IdentityService} from './identity.service.js';
import {body,digest,text,uuid,fail} from './security.js';

const alphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ',referencePattern=/^SF-[2-9A-HJ-NP-Z]{8}$/;
const reference=()=>'SF-'+[...randomBytes(8)].map(byte=>alphabet[byte%32]).join('');
const seatLabels=(value:unknown)=>{
 if(!Array.isArray(value)||value.length<1||value.length>10)fail('INVALID_SEATS');
 const labels=value.map(label=>{if(typeof label!=='string'||label.length<1||label.length>8)fail('INVALID_SEATS');return label;});
 if(new Set(labels).size!==labels.length)fail('INVALID_SEATS');return labels;
};
// The passenger's browser creates the key and is the only holder of it. Only its hash is stored, so the reference alone cannot open or release a hold.
const accessHash=(value:unknown)=>digest('safeer-hold-v1:'+uuid(value));

@Injectable()
export class ReservationService implements OnModuleInit,OnModuleDestroy {
 private timer?:NodeJS.Timeout;
 constructor(private readonly db:Database,private readonly identity:IdentityService){}
 // Holds stop counting the moment they expire. This job only tidies the records and releases the rows for reporting.
 onModuleInit(){void this.sweep();this.timer=setInterval(()=>void this.sweep(),30000);this.timer.unref();}
 onModuleDestroy(){clearInterval(this.timer);}
 sweep(){return this.db.pool.query('SELECT safeer.expire_due_holds()').catch(()=>{/* The next run retries. Availability never depends on this job. */});}
 private one(sql:string,values:unknown[]){return this.db.pool.query(sql,values).then(result=>result.rows[0]?.row??null);}
 async trip(id:string){uuid(id);const row=await this.one('SELECT safeer.public_trip($1) AS row',[id]);if(!row)fail('NOT_FOUND',404);return row;}
 // Counts seats, not requests, so one client cannot hold whole buses a few requests at a time.
 private async throttle(client:string,seats:number){
  const key=digest('hold:'+client);
  const attempts=await this.db.transaction(async c=>{
   await c.query('DELETE FROM safeer.auth_throttles WHERE key_hash=$1 AND resets_at<=clock_timestamp()',[key]);
   return (await c.query(`INSERT INTO safeer.auth_throttles(key_hash,attempts,resets_at) VALUES($1,$2,clock_timestamp()+interval '15 minutes') ON CONFLICT(key_hash) DO UPDATE SET attempts=safeer.auth_throttles.attempts+$2 RETURNING attempts`,[key,seats])).rows[0].attempts;
  },false);
  if(attempts>120)fail('RATE_LIMITED',429,'Please wait and try again.');
 }
 // Holds use the shared service lock so different trips never wait on each other. Each trip is serialized by its own row lock.
 async hold(input:unknown,client:string){
  const data=body(input,['tripId','seats','key']),tripId=uuid(data.tripId),labels=seatLabels(data.seats),access=accessHash(data.key);
  const request=digest(JSON.stringify([tripId,[...labels].sort()]));
  await this.throttle(client,labels.length);
  return this.db.transaction(async c=>(await c.query('SELECT safeer.public_hold($1,$2,$3,$4,$5,$6) AS row',[tripId,labels,randomUUID(),reference(),access,request])).rows[0].row,false);
 }
 async booking(code:string,key:unknown){
  if(!referencePattern.test(code))fail('NOT_FOUND',404);
  const row=await this.one('SELECT safeer.public_booking($1,$2) AS row',[code,accessHash(key)]);if(!row)fail('NOT_FOUND',404);return row;
 }
 async release(code:string,input:unknown){
  if(!referencePattern.test(code))fail('NOT_FOUND',404);
  const data=body(input,['key']),access=accessHash(data.key);
  const row=await this.db.transaction(async c=>(await c.query('SELECT safeer.public_release($1,$2) AS row',[code,access])).rows[0].row,false);
  if(!row)fail('NOT_FOUND',404);return row;
 }
 async seats(token:string,cid:string,tid:string){uuid(cid);uuid(tid);return this.db.transaction(async c=>{
  await this.identity.principal(c,token);await c.query("SELECT set_config('safeer.session_token',$1,true)",[token]);
  if(!(await c.query('SELECT 1 FROM safeer.companies WHERE id=$1',[cid])).rowCount)fail('NOT_FOUND',404);
  const row=(await c.query('SELECT safeer.staff_seat_map($1,$2) AS row',[cid,tid])).rows[0].row;if(!row)fail('NOT_FOUND',404);return row;
 },false);}
 async staffRelease(token:string,cid:string,tid:string,bid:string,input:unknown){
  uuid(cid);uuid(tid);uuid(bid);const data=body(input,['reason','currentPassword']),reason=text(data.reason,1,300);
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.db.transaction(async c=>{
   const p=await this.identity.principal(c,token);await c.query("SELECT set_config('safeer.session_token',$1,true)",[token]);
   if(!(await c.query('SELECT 1 FROM safeer.companies WHERE id=$1',[cid])).rowCount)fail('NOT_FOUND',404);
   if(!(await c.query('SELECT safeer.staff_release($1,$2,$3,$4,$5) AS ok',[cid,tid,bid,p.id,reason])).rows[0].ok)fail('NOT_FOUND',404);
   await c.query('INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),cid,p.id,'booking.released',bid]);return {id:bid};
  },false);
 }
}
