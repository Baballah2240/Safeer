import {Injectable} from '@nestjs/common';
import {randomBytes,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {Database} from './database.js';
import {IdentityService} from './identity.service.js';
import {body,digest,text,uuid,fail} from './security.js';
import {mobileNumber,saleTravelers,seatList} from './reservation.service.js';
import {ticketQr} from './ticket-qr.js';

const minor=(value:unknown,max:number)=>{if(!Number.isSafeInteger(value)||Number(value)<0||Number(value)>max)fail('INVALID_INPUT');return Number(value);};
const optional=(value:unknown,max:number)=>value===undefined||value===null||value===''?null:text(value,1,max);
const method=(value:unknown)=>{if(value!=='cash'&&value!=='bank_transfer'&&value!=='mobile_wallet')fail('INVALID_INPUT');return value;};
// A transfer or wallet payment is only as good as its reference. Cash has none.
const methodReference=(kind:string,value:unknown)=>{const reference=optional(value,100);if(kind!=='cash'&&!reference)fail('REFERENCE_REQUIRED');return kind==='cash'?null:reference;};
const alphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ',bookingReference=()=>'SF-'+[...randomBytes(8)].map(byte=>alphabet[byte%32]).join('');
// Keys are scoped to the company and purpose, so one cannot collide with a passenger's key or another operation.
const keyHash=(purpose:string,cid:string,value:unknown)=>digest(`safeer-${purpose}-v1:${cid}:${uuid(value)}`);

@Injectable()
export class TicketingService {
 constructor(private readonly db:Database,private readonly identity:IdentityService){}
 private staff<T>(token:string,cid:string,action:(c:PoolClient,actor:string)=>Promise<T>){uuid(cid);return this.db.transaction(async c=>{
  const p=await this.identity.principal(c,token);await c.query("SELECT set_config('safeer.session_token',$1,true)",[token]);
  if(!(await c.query('SELECT 1 FROM safeer.companies WHERE id=$1',[cid])).rowCount)fail('NOT_FOUND',404);
  return action(c,p.id);
 },false);}
 overview(token:string,cid:string){return this.staff(token,cid,async c=>(await c.query('SELECT safeer.counter_overview($1) AS row',[cid])).rows[0].row);}
 trip(token:string,cid:string,tid:string){uuid(tid);return this.staff(token,cid,async c=>{const row=(await c.query('SELECT safeer.counter_trip($1,$2) AS row',[cid,tid])).rows[0].row;if(!row)fail('NOT_FOUND',404);return row;});}
 // D72: departures on one company-local day, for walk-in sales beyond the overview's next 100.
 trips(token:string,cid:string,day:unknown){
  const valid=typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&!Number.isNaN(Date.parse(day+'T00:00:00Z'))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;
  if(!valid)fail('INVALID_INPUT');
  return this.staff(token,cid,async c=>(await c.query('SELECT safeer.counter_trips($1,$2::date) AS row',[cid,day])).rows[0].row);
 }
 async settings(token:string,cid:string,input:unknown){
  const data=body(input,['bankTransfer','mobileWallet','version','currentPassword']);
  if(typeof data.bankTransfer!=='boolean'||typeof data.mobileWallet!=='boolean'||!Number.isSafeInteger(data.version)||Number(data.version)<0)fail('INVALID_INPUT');
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.staff(token,cid,async(c,actor)=>{await c.query('SELECT safeer.save_payment_settings($1,$2,$3,$4,$5)',[cid,actor,data.bankTransfer,data.mobileWallet,data.version]);return {id:cid};});
 }
 async counter(token:string,cid:string,id:string|undefined,input:unknown){
  if(id)uuid(id);const data=body(input,id?['code','name','active','version','currentPassword']:['stationId','code','name','currentPassword']);
  const code=text(data.code,1,40).toUpperCase(),name=text(data.name,1,100),station=id?null:uuid(data.stationId);
  if(!/^[A-Z0-9_-]+$/.test(code))fail('INVALID_INPUT');if(id&&(typeof data.active!=='boolean'||!Number.isSafeInteger(data.version)||Number(data.version)<1))fail('INVALID_INPUT');
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.staff(token,cid,async(c,actor)=>{const row=(await c.query('SELECT safeer.save_counter($1,$2,$3,$4,$5,$6,$7,$8) AS id',[cid,actor,id??null,station,code,name,id?data.active:true,id?data.version:0])).rows[0].id;if(!row)fail('NOT_FOUND',404);return {id:row};});
 }
 openSession(token:string,cid:string,input:unknown){
  const data=body(input,['counterId','openingMinor']),counter=uuid(data.counterId),opening=minor(data.openingMinor,1000000000);
  return this.staff(token,cid,async(c,actor)=>(await c.query('SELECT safeer.open_session($1,$2,$3,$4) AS row',[cid,actor,counter,opening])).rows[0].row);
 }
 async closeSession(token:string,cid:string,sid:string,input:unknown){
  uuid(sid);const data=body(input,['countedMinor','note','currentPassword']),counted=minor(data.countedMinor,10000000000),note=optional(data.note,300);
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.staff(token,cid,async(c,actor)=>{const row=(await c.query('SELECT safeer.close_session($1,$2,$3,$4,$5) AS row',[cid,actor,sid,counted,note])).rows[0].row;if(!row)fail('NOT_FOUND',404);return row;});
 }
 pay(token:string,cid:string,bid:string,input:unknown){
  uuid(bid);const data=body(input,['method','reference','key','lateReason']),kind=method(data.method),reference=methodReference(kind,data.reference),late=optional(data.lateReason,300),key=keyHash('payment',cid,data.key);
  const request=digest(`safeer-payment-request-v1:${data.key}:`+JSON.stringify([bid,kind,reference]));
  return this.staff(token,cid,async(c,actor)=>{const row=(await c.query('SELECT safeer.counter_pay($1,$2,$3,$4,$5,$6,$7,$8) AS row',[cid,bid,actor,kind,reference,key,request,late])).rows[0].row;if(!row)fail('NOT_FOUND',404);return row;});
 }
 sale(token:string,cid:string,input:unknown){
  const data=body(input,['tripId','seats','mobile','travelers','method','reference','key']),tripId=uuid(data.tripId),labels=seatList(data.seats),mobile=mobileNumber(data.mobile),people=saleTravelers(data.travelers,labels),kind=method(data.method),reference=methodReference(kind,data.reference),access=keyHash('sale',cid,data.key),key=keyHash('payment',cid,data.key);
  const request=digest(`safeer-sale-request-v1:${data.key}:`+JSON.stringify([tripId,[...labels].sort(),mobile,people,kind,reference]));
  return this.staff(token,cid,async(c,actor)=>(await c.query('SELECT safeer.counter_sale($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) AS row',[cid,actor,tripId,labels,randomUUID(),bookingReference(),access,request,mobile,JSON.stringify(people),kind,reference,key])).rows[0].row);
 }
 async refund(token:string,cid:string,bid:string,input:unknown){
  uuid(bid);const data=body(input,['reason','reference','key','currentPassword']),reason=text(data.reason,1,300),reference=optional(data.reference,100),key=keyHash('refund',cid,data.key);
  const request=digest(`safeer-refund-request-v1:${data.key}:`+JSON.stringify([bid,reference]));
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.staff(token,cid,async(c,actor)=>{const row=(await c.query('SELECT safeer.counter_refund($1,$2,$3,$4,$5,$6,$7) AS row',[cid,bid,actor,reference,key,request,reason])).rows[0].row;if(!row)fail('NOT_FOUND',404);return row;});
 }
 print(token:string,cid:string,bid:string,input:unknown){
  uuid(bid);const data=body(input,['document']);if(data.document!=='tickets'&&data.document!=='receipt'&&data.document!=='refund')fail('INVALID_INPUT');
  return this.staff(token,cid,async(c,actor)=>{const earlier=(await c.query('SELECT safeer.record_print($1,$2,$3,$4) AS n',[cid,bid,actor,data.document])).rows[0].n;if(earlier===null)fail('NOT_FOUND',404);
   const codes=data.document==='tickets'?(await c.query('SELECT safeer.ticket_codes($1,$2) AS codes',[cid,bid])).rows[0].codes:[];
   return {copy:Number(earlier)>0,earlierPrints:Number(earlier),codes:codes.map((r:{number:string,token:string})=>({...r,qr:ticketQr(r.token)}))};});
 }
}
