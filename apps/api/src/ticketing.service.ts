import {Injectable} from '@nestjs/common';
import {cardReady} from './reservation.service.js';
import {randomBytes,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {Database} from './database.js';
import {IdentityService} from './identity.service.js';
import {body,digest,text,uuid,fail,stopIndex} from './security.js';
import {mobileNumber,saleTravelers,seatList} from './reservation.service.js';
import {ticketQr} from './ticket-qr.js';

const minor=(value:unknown,max:number)=>{if(!Number.isSafeInteger(value)||Number(value)<0||Number(value)>max)fail('INVALID_INPUT');return Number(value);};
// D93: a bank transfer needs a photo of the transfer, sent as a data URL (JPEG, PNG or WebP, at most 384 KB).
const proofTypes:Record<string,(b:Buffer)=>boolean>={'image/png':b=>b.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])),'image/jpeg':b=>b[0]===0xff&&b[1]===0xd8&&b[2]===0xff,'image/webp':b=>b.subarray(0,4).toString('latin1')==='RIFF'&&b.subarray(8,12).toString('latin1')==='WEBP'};
const paymentProof=(kind:string,value:unknown)=>{
 if(kind!=='bank_transfer'){if(value!==undefined&&value!==null)fail('INVALID_INPUT');return null;}
 if(typeof value!=='string'||!value)fail('PROOF_REQUIRED');
 const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value as string);if(!match)fail('INVALID_PROOF');
 const data=Buffer.from(match![2],'base64');if(!data.length||data.length>393216)fail('PROOF_TOO_LARGE');if(!proofTypes[match![1]](data))fail('INVALID_PROOF');return {type:match![1],data};
};
const attachProof=async(c:PoolClient,cid:string,bid:string,actor:string,proof:{type:string;data:Buffer}|null)=>{if(proof)await c.query('SELECT safeer.payment_proof_attach($1,$2,$3,$4,$5)',[cid,bid,actor,proof.type,proof.data]);};
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
 overview(token:string,cid:string){return this.staff(token,cid,async c=>{const row=(await c.query('SELECT safeer.counter_overview($1) AS row',[cid])).rows[0].row;row.recentClosed=(await c.query('SELECT safeer.my_closed_sessions($1) AS row',[cid])).rows[0].row;if(row.settings){row.settings.card=(await c.query('SELECT safeer.company_card($1) AS on',[cid])).rows[0].on;}row.cardAvailable=cardReady((await c.query('SELECT safeer.company_country($1) AS row',[cid])).rows[0].row);return row;});}
 trip(token:string,cid:string,tid:string,from?:unknown,to?:unknown){uuid(tid);const f=stopIndex(from),l=stopIndex(to);return this.staff(token,cid,async c=>{const row=(await c.query('SELECT safeer.counter_trip($1,$2,$3::integer,$4::integer) AS row',[cid,tid,f,l])).rows[0].row;if(!row)fail('NOT_FOUND',404);return row;});}
 // D72: departures on one company-local day, for walk-in sales beyond the overview's next 100.
 trips(token:string,cid:string,day:unknown){
  const valid=typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&!Number.isNaN(Date.parse(day+'T00:00:00Z'))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;
  if(!valid)fail('INVALID_INPUT');
  return this.staff(token,cid,async c=>(await c.query('SELECT safeer.counter_trips($1,$2::date) AS row',[cid,day])).rows[0].row);
 }
 async settings(token:string,cid:string,input:unknown){
  const data=body(input,['bankTransfer','mobileWallet','card','version','currentPassword']);if(data.card!==undefined&&typeof data.card!=='boolean')fail('INVALID_INPUT');
  if(typeof data.bankTransfer!=='boolean'||typeof data.mobileWallet!=='boolean'||!Number.isSafeInteger(data.version)||Number(data.version)<0)fail('INVALID_INPUT');
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.staff(token,cid,async(c,actor)=>{await c.query('SELECT safeer.save_payment_settings($1,$2,$3,$4,$5)',[cid,actor,data.bankTransfer,data.mobileWallet,data.version]);if(typeof data.card==='boolean')await c.query('SELECT safeer.save_card_payments($1,$2,$3)',[cid,actor,data.card]);return {id:cid};});
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
 // D114: everything sold and refunded in a closed session, for the printed manifest.
 manifest(token:string,cid:string,sid:string){uuid(sid);return this.staff(token,cid,async c=>{const row=(await c.query('SELECT safeer.session_manifest($1,$2) AS row',[cid,sid])).rows[0].row;if(!row)fail('NOT_FOUND',404);return row;});}
 async closeSession(token:string,cid:string,sid:string,input:unknown){
  uuid(sid);const data=body(input,['countedMinor','note','currentPassword']),counted=minor(data.countedMinor,10000000000),note=optional(data.note,300);
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.staff(token,cid,async(c,actor)=>{const row=(await c.query('SELECT safeer.close_session($1,$2,$3,$4,$5) AS row',[cid,actor,sid,counted,note])).rows[0].row;if(!row)fail('NOT_FOUND',404);return row;});
 }
 pay(token:string,cid:string,bid:string,input:unknown){
  uuid(bid);const data=body(input,['method','reference','key','lateReason','proof']),kind=method(data.method),reference=methodReference(kind,data.reference),proof=paymentProof(kind,data.proof),late=optional(data.lateReason,300),key=keyHash('payment',cid,data.key);
  const request=digest(`safeer-payment-request-v1:${data.key}:`+JSON.stringify([bid,kind,reference]));
  return this.staff(token,cid,async(c,actor)=>{const row=(await c.query('SELECT safeer.counter_pay($1,$2,$3,$4,$5,$6,$7,$8) AS row',[cid,bid,actor,kind,reference,key,request,late])).rows[0].row;if(!row)fail('NOT_FOUND',404);await attachProof(c,cid,bid,actor,proof);return row;});
 }
 async proof(token:string,cid:string,bid:string){uuid(bid);return this.staff(token,cid,async c=>{const row=(await c.query('SELECT * FROM safeer.payment_proof($1,$2)',[cid,bid])).rows[0];if(!row)fail('NOT_FOUND',404);return {type:row.content_type as string,data:row.data as Buffer};});}
 sale(token:string,cid:string,input:unknown){
  const data=body(input,['tripId','seats','mobile','travelers','method','reference','key','fromIndex','toIndex','proof']),proofInput=data.proof,from=stopIndex(data.fromIndex),to=stopIndex(data.toIndex),tripId=uuid(data.tripId),labels=seatList(data.seats),mobile=mobileNumber(data.mobile),people=saleTravelers(data.travelers,labels),kind=method(data.method),reference=methodReference(kind,data.reference),access=keyHash('sale',cid,data.key),key=keyHash('payment',cid,data.key);
  const proof=paymentProof(kind,proofInput);
  const request=digest(`safeer-sale-request-v1:${data.key}:`+JSON.stringify([tripId,[...labels].sort(),mobile,people,kind,reference,...(from===null&&to===null?[]:[[from,to]])]));
  return this.staff(token,cid,async(c,actor)=>{const made=(await c.query('SELECT safeer.counter_sale($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::integer,$15::integer) AS row',[cid,actor,tripId,labels,randomUUID(),bookingReference(),access,request,mobile,JSON.stringify(people),kind,reference,key,from,to])).rows[0].row as {id:string};await attachProof(c,cid,made.id,actor,proof);return made;});
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
