import {Injectable,OnModuleDestroy,OnModuleInit} from '@nestjs/common';
import {randomBytes,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {Database} from './database.js';
import {IdentityService} from './identity.service.js';
import {body,digest,text,uuid,version,fail} from './security.js';

const alphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ',referencePattern=/^SF-[2-9A-HJ-NP-Z]{8}$/;
const reference=()=>'SF-'+[...randomBytes(8)].map(byte=>alphabet[byte%32]).join('');
export const seatList=(value:unknown)=>seatLabels(value);
const seatLabels=(value:unknown)=>{
 if(!Array.isArray(value)||value.length<1||value.length>10)fail('INVALID_SEATS');
 const labels=value.map(label=>{if(typeof label!=='string'||label.length<1||label.length>8)fail('INVALID_SEATS');return label;});
 if(new Set(labels).size!==labels.length)fail('INVALID_SEATS');return labels;
};
// The passenger's browser creates the key and is the only holder of it. Only its hash is stored, so the reference alone cannot open or release a hold.
const accessHash=(value:unknown)=>digest('safeer-hold-v1:'+uuid(value));
const arabicDigits=(value:string)=>value.replace(/[\u0660-\u0669\u06f0-\u06f9]/g,c=>String(c.charCodeAt(0)%16));
// Local Sudanese numbers and Arabic digits are accepted, and everything is stored in international form.
export function mobileNumber(value:unknown,code='INVALID_MOBILE'){
 if(typeof value!=='string'||value.length>30)fail(code);
 let digits=arabicDigits(value).replace(/[\s()\-.\u200e\u200f]/g,'');
 if(digits.startsWith('00'))digits='+'+digits.slice(2);
 else if(/^0[0-9]{9}$/.test(digits))digits='+249'+digits.slice(1);
 else if(/^[19][0-9]{8}$/.test(digits))digits='+249'+digits;
 if(!/^\+[1-9][0-9]{7,14}$/.test(digits)||(digits.startsWith('+249')&&digits.length!==13))fail(code);
 return digits;
}
const fullName=(value:unknown)=>{
 if(typeof value!=='string'||/[\u0000-\u001f\u007f]/.test(value))fail('INVALID_PASSENGERS');
 const name=value.trim().replace(/\s+/g,' ');
 if(name.length<2||name.length>100||!/\p{L}/u.test(name))fail('INVALID_PASSENGERS');return name;
};
// What a traveler says they carry. Nothing is checked until staff register a bag.
const luggageNote=(value:unknown)=>{if(value===undefined||value===null)return null;if(typeof value!=='string'||value.length>1000||/[\u0000-\u001f\u007f]/.test(value))fail('INVALID_PASSENGERS');const note=value.trim();if(note.length>300)fail('INVALID_PASSENGERS');return note||null;};
const optionalMobile=(value:unknown)=>value===undefined||value===null||value===''?null:mobileNumber(value);
// One traveler for each requested seat, no more and no fewer.
function travelers(value:unknown,labels:string[]){
 if(!Array.isArray(value)||value.length!==labels.length)fail('INVALID_PASSENGERS');
 const rows=value.map(row=>{const data=body(row,['seat','name','mobile','luggage']);if(!labels.includes(data.seat as string))fail('INVALID_PASSENGERS');return {seat:data.seat as string,name:fullName(data.name),mobile:optionalMobile(data.mobile),luggage:luggageNote(data.luggage)};});
 if(new Set(rows.map(row=>row.seat)).size!==labels.length)fail('INVALID_PASSENGERS');
 return rows.sort((a,b)=>a.seat.localeCompare(b.seat));
}

export const saleTravelers=(value:unknown,labels:string[])=>travelers(value,labels);

@Injectable()
export class ReservationService implements OnModuleInit,OnModuleDestroy {
 private timer?:NodeJS.Timeout;
 private eraser?:NodeJS.Timeout;
 constructor(private readonly db:Database,private readonly identity:IdentityService){}
 // Holds stop counting the moment they expire. This job only tidies the records and releases the rows for reporting.
 onModuleInit(){void this.sweep();this.timer=setInterval(()=>void this.sweep(),30000);this.timer.unref();void this.erase();this.eraser=setInterval(()=>void this.erase(),3600000);this.eraser.unref();}
 onModuleDestroy(){clearInterval(this.timer);clearInterval(this.eraser);}
 // Retention: names and numbers go 90 days after the trip ends (D31). Runs on start and hourly. Short batches drain a backlog without one long transaction.
 async erase(){
  try{
   for(let batch=0;batch<200;batch++){if((await this.db.pool.query('SELECT safeer.erase_due_passenger_data() AS n')).rows[0].n<500)break;}
   await this.db.pool.query('DELETE FROM safeer.auth_throttles WHERE resets_at<=clock_timestamp()');
  }catch{/* The next run retries. */}
 }
 sweep(){return this.db.pool.query('SELECT safeer.expire_due_holds()').catch(()=>{/* The next run retries. Availability never depends on this job. */});}
 private one(sql:string,values:unknown[]){return this.db.pool.query(sql,values).then(result=>result.rows[0]?.row??null);}
 async trip(id:string){uuid(id);const row=await this.one('SELECT safeer.public_trip($1) AS row',[id]);if(!row)fail('NOT_FOUND',404);return row;}
 // Counts seats, not requests, so one client cannot hold whole buses a few requests at a time.
 private async throttle(client:string,seats:number){if(await this.spend('hold:'+client,seats)>120)fail('RATE_LIMITED',429,'Please wait and try again.');}
 private async spend(name:string,amount:number){
  const key=digest(name);
  return this.db.transaction(async c=>{
   await c.query('DELETE FROM safeer.auth_throttles WHERE key_hash=$1 AND resets_at<=clock_timestamp()',[key]);
   return (await c.query(`INSERT INTO safeer.auth_throttles(key_hash,attempts,resets_at) VALUES($1,$2,clock_timestamp()+interval '15 minutes') ON CONFLICT(key_hash) DO UPDATE SET attempts=safeer.auth_throttles.attempts+$2 RETURNING attempts`,[key,amount])).rows[0].attempts as number;
  },false);
 }
 // Both limits count before the answer is known, so a guess costs the same whether or not the booking exists. Successes give their attempt back.
 private async guarded<T>(reference:string,client:string,action:()=>Promise<T|null>){
  // The client limit comes first, so a client already over it cannot use up another booking's attempts.
  if(await this.spend('lookup:'+client,1)>30||await this.spend('lookup-ref:'+reference,1)>5)fail('RATE_LIMITED',429,'Please wait and try again.');
  const row=await action();if(!row)fail('NOT_FOUND',404);
  const key=digest('lookup-ref:'+reference);await this.db.pool.query('DELETE FROM safeer.auth_throttles WHERE key_hash=$1 AND attempts=1',[key]);await this.db.pool.query('UPDATE safeer.auth_throttles SET attempts=attempts-1 WHERE key_hash=$1 AND attempts>1',[key]);return row;
 }
 private static reference(value:unknown){const code=typeof value==='string'?value.trim().toUpperCase():'';if(!referencePattern.test(code))fail('NOT_FOUND',404);return code;}
 // Holds use the shared service lock so different trips never wait on each other. Each trip is serialized by its own row lock.
 async hold(input:unknown,client:string){
  const data=body(input,['tripId','seats','key','mobile','travelers']),tripId=uuid(data.tripId),labels=seatLabels(data.seats),access=accessHash(data.key),mobile=mobileNumber(data.mobile),people=travelers(data.travelers,labels);
  const request=digest('safeer-request-v1:'+data.key+JSON.stringify([tripId,[...labels].sort(),mobile,people]));
  // A retry of a hold that already exists costs nothing, so a lost reply can always be recovered.
  if(!await this.one('SELECT safeer.public_booking_by_key($1) AS row',[access]))await this.throttle(client,labels.length);
  return this.db.transaction(async c=>(await c.query('SELECT safeer.public_book($1,$2,$3,$4,$5,$6,$7,$8) AS row',[tripId,labels,randomUUID(),reference(),access,request,mobile,JSON.stringify(people)])).rows[0].row,false);
 }
 async booking(code:string,key:unknown){
  if(!referencePattern.test(code))fail('NOT_FOUND',404);
  const row=await this.one('SELECT safeer.public_booking($1,$2) AS row',[code,accessHash(key)]);if(!row)fail('NOT_FOUND',404);return row;
 }
 async current(key:unknown){const row=await this.one('SELECT safeer.public_booking_by_key($1) AS row',[accessHash(key)]);if(!row)fail('NOT_FOUND',404);return row;}
 async lookup(input:unknown,client:string){
  const data=body(input,['reference','mobile']),code=ReservationService.reference(data.reference),mobile=mobileNumber(data.mobile,'INVALID_INPUT');
  return this.guarded(code,client,()=>this.one('SELECT safeer.public_lookup($1,$2) AS row',[code,mobile]));
 }
 async release(code:string,input:unknown,client:string){
  if(!referencePattern.test(code))fail('NOT_FOUND',404);
  const data=body(input,['key','mobile']);
  if(data.mobile!==undefined){
   if(data.key!==undefined)fail('INVALID_INPUT');const mobile=mobileNumber(data.mobile,'INVALID_INPUT');
   return this.guarded(code,client,()=>this.db.transaction(async c=>(await c.query('SELECT safeer.public_release_by_mobile($1,$2) AS row',[code,mobile])).rows[0].row,false));
  }
  const access=accessHash(data.key);
  const row=await this.db.transaction(async c=>(await c.query('SELECT safeer.public_release($1,$2) AS row',[code,access])).rows[0].row,false);
  if(!row)fail('NOT_FOUND',404);return row;
 }
 async seats(token:string,cid:string,tid:string){uuid(cid);uuid(tid);return this.staff(token,cid,async(c,actor)=>{
  const row=(await c.query('SELECT safeer.staff_seat_map($1,$2) AS row',[cid,tid])).rows[0].row;if(!row)fail('NOT_FOUND',404);
  await this.audit(c,cid,actor,'booking.seats_viewed',tid);return row;
 });}
 private staff<T>(token:string,cid:string,action:(c:PoolClient,actor:string)=>Promise<T>){return this.db.transaction(async c=>{
  const p=await this.identity.principal(c,token);await c.query("SELECT set_config('safeer.session_token',$1,true)",[token]);
  if(!(await c.query('SELECT 1 FROM safeer.companies WHERE id=$1',[cid])).rowCount)fail('NOT_FOUND',404);
  return action(c,p.id);
 },false);}
 private audit(c:PoolClient,cid:string,actor:string,action:string,target:string){return c.query('INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),cid,actor,action,target]);}
 // The search box takes a reference, a number or part of a name. The audit records that a search happened, never what was typed.
 async bookings(token:string,cid:string,query:unknown){
  uuid(cid);const q=query===undefined||query===''?null:text(query,2,100);
  const upper=q?.toUpperCase()??'',isReference=referencePattern.test(upper),isNumber=Boolean(q)&&!isReference&&/^[+\s()\-.0-9\u0660-\u0669\u06f0-\u06f9\u200e\u200f]+$/.test(q as string);
  return this.staff(token,cid,async(c,actor)=>{
   const row=(await c.query('SELECT safeer.staff_bookings($1,$2,$3,$4) AS row',[cid,isReference?upper:null,isNumber?mobileNumber(q,'INVALID_INPUT'):null,q&&!isReference&&!isNumber?q:null])).rows[0].row;
   await this.audit(c,cid,actor,q?'booking.searched':'booking.listed',cid);return row;
  });
 }
 async bookingDetail(token:string,cid:string,bid:string){uuid(cid);uuid(bid);return this.staff(token,cid,async(c,actor)=>{
  const row=(await c.query('SELECT safeer.staff_booking($1,$2) AS row',[cid,bid])).rows[0].row;if(!row)fail('NOT_FOUND',404);
  await this.audit(c,cid,actor,'booking.viewed',bid);return row;
 });}
 async correct(token:string,cid:string,bid:string,input:unknown){
  uuid(cid);uuid(bid);const data=body(input,['mobile','travelers','seats','reason','version','currentPassword']),labels=seatLabels(data.seats),reason=text(data.reason,1,300),expected=version(data.version),mobile=mobileNumber(data.mobile),people=travelers(data.travelers,labels);
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.staff(token,cid,async(c,actor)=>{
   if(!(await c.query('SELECT safeer.staff_update_travelers($1,$2,$3,$4,$5,$6,$7) AS ok',[cid,bid,actor,expected,mobile,JSON.stringify(people),reason])).rows[0].ok)fail('NOT_FOUND',404);
   await this.audit(c,cid,actor,'booking.corrected',bid);return {id:bid};
  });
 }
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
