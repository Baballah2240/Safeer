import {Injectable} from '@nestjs/common';
import {randomBytes,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import qrcode from 'qrcode-generator';
import {Database} from './database.js';
import {IdentityService} from './identity.service.js';
import {body,digest,text,uuid,fail} from './security.js';
import {mobileNumber} from './reservation.service.js';

// D59 shipments. The database functions own every rule; this layer validates shape,
// generates secrets (QR value, tracking code) and keeps searches and tracking bounded.
const categories=['envelope','small','large','other'],methods=['cash','bank_transfer','mobile_wallet'];
const alphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ',trackingAlphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ'.replace(/[IO]/g,'');
const documentNumber=/^(SHP|SPT|RCP)-[0-9]{8}$/,trackingPattern=/^SH-[2-9A-HJ-NP-Z]{8}$/,tokenPattern=/^SQ[2-9A-Z]{24}$/;
const optional=(value:unknown,max:number)=>value===undefined||value===null||value===''?null:text(value,1,max);
const oneOf=(value:unknown,allowed:string[])=>{if(typeof value!=='string'||!allowed.includes(value))fail('INVALID_INPUT');return value as string;};
const whole=(value:unknown,min:number,max:number)=>{if(!Number.isSafeInteger(value)||Number(value)<min||Number(value)>max)fail('INVALID_INPUT');return Number(value);};
const version=(value:unknown)=>whole(value,1,2147483647);
// The QR holds only this random value; only its hash is stored.
const newToken=()=>'SQ'+[...randomBytes(24)].map(byte=>alphabet[byte%32]).join(''),tokenHash=(token:string)=>digest('safeer-shipment-qr-v1:'+token);
const newTrackingCode=()=>'SH-'+[...randomBytes(8)].map(byte=>trackingAlphabet[byte%trackingAlphabet.length]).join('');
const qrPath=(token:string)=>{const code=qrcode(0,'M');code.addData(token);code.make();const size=code.getModuleCount();let path='';for(let row=0;row<size;row++)for(let column=0;column<size;column++)if(code.isDark(row,column))path+=`M${column} ${row}h1v1h-1z`;return {size,path};};
const personName=(value:unknown)=>{const name=text(value,2,100).replace(/\s+/g,' ');if(/[<>]/.test(name))fail('INVALID_INPUT');return name;};

export class Limiter {
 private readonly seen=new Map<string,{since:number,count:number}>();
 constructor(private readonly max:number,private readonly windowMs:number){}
 take(key:string){const now=Date.now(),entry=this.seen.get(key);if(!entry||now-entry.since>this.windowMs){if(this.seen.size>20000)this.seen.clear();this.seen.set(key,{since:now,count:1});return;}if(++entry.count>this.max)fail('RATE_LIMITED',429,'Too many requests. Try again later.');}
}

@Injectable()
export class ShipmentService {
 constructor(private readonly db:Database,private readonly identity:IdentityService){}
 private readonly searches=new Limiter(300,3600000);
 private readonly tracking=new Limiter(60,3600000);
 private staff<T>(token:string,cid:string,action:(c:PoolClient,actor:string)=>Promise<T>){uuid(cid);return this.db.transaction(async c=>{
  const p=await this.identity.principal(c,token);await c.query("SELECT set_config('safeer.session_token',$1,true)",[token]);
  if(!(await c.query('SELECT 1 FROM safeer.companies WHERE id=$1',[cid])).rowCount)fail('NOT_FOUND',404);
  return action(c,p.id);
 },false);}
 private found<T>(row:T){if(!row)fail('NOT_FOUND',404);return row;}
 private one(c:PoolClient,sql:string,values:unknown[]){return c.query(sql,values).then(r=>r.rows[0].row);}

 options(token:string,cid:string){return this.staff(token,cid,c=>this.one(c,'SELECT safeer.shipment_options($1) AS row',[cid]));}
 savePrice(token:string,cid:string,input:unknown){
  const data=body(input,['category','priceMinor','active','version']),category=oneOf(data.category,categories),price=whole(data.priceMinor,1,100000000);
  if(typeof data.active!=='boolean')fail('INVALID_INPUT');const v=data.version===undefined||data.version===null?null:version(data.version);
  return this.staff(token,cid,(c,actor)=>this.one(c,'SELECT safeer.shipment_price_save($1,$2,$3,$4,$5,$6) AS row',[cid,actor,category,price,data.active,v]));
 }
 // Audit records that a search happened, never what was typed.
 find(token:string,cid:string,query:unknown,trip:unknown){
  const q=query===undefined||query===''?null:text(query,2,40).toUpperCase();if(q&&!documentNumber.test(q)&&!trackingPattern.test(q))fail('INVALID_INPUT');
  const tid=trip===undefined||trip===''?null:uuid(trip);
  return this.staff(token,cid,async(c,actor)=>{if(q)this.searches.take(actor);const row=await this.one(c,'SELECT safeer.shipment_find($1,$2,NULL,$3) AS row',[cid,q,tid]);await c.query('INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),cid,actor,q?'shipment.searched':'shipment.listed',row.items[0]?.id??cid]);return row;});
 }
 // A scanned value arrives in the body so it stays out of request logs.
 scan(token:string,cid:string,input:unknown){
  const data=body(input,['token']),value=text(data.token,2,40).toUpperCase();if(!tokenPattern.test(value))fail('TAG_UNKNOWN');
  return this.staff(token,cid,async(c,actor)=>{this.searches.take(actor);return this.one(c,'SELECT safeer.shipment_find($1,NULL,$2,NULL) AS row',[cid,tokenHash(value)]);});
 }
 create(token:string,cid:string,input:unknown){
  const data=body(input,['tripId','destinationId','senderName','senderMobile','receiverName','receiverMobile','items','method','reference','declared','key']);
  const trip=uuid(data.tripId),destination=uuid(data.destinationId),senderName=personName(data.senderName),receiverName=personName(data.receiverName);
  const senderMobile=mobileNumber(data.senderMobile),receiverMobile=mobileNumber(data.receiverMobile),method=oneOf(data.method,methods),reference=method==='cash'?null:text(data.reference,2,100);
  if(data.declared!==true)fail('CONTENTS_NOT_DECLARED');
  if(!Array.isArray(data.items)||data.items.length<1||data.items.length>20)fail('INVALID_ITEMS');
  const items=data.items.map(raw=>{const item=body(raw,['category','description','weightGrams']);return {category:oneOf(item.category,categories),description:optional(item.description,200),grams:whole(item.weightGrams,1,500000)};});
  const keyValue=uuid(data.key),key=digest(`safeer-shipment-v1:${cid}:${keyValue}`),request=digest(`safeer-shipment-request-v1:${keyValue}:`+JSON.stringify([trip,destination,senderName,senderMobile,receiverName,receiverMobile,items,method,reference]));
  return this.staff(token,cid,async(c,actor)=>{
   // A tracking-code collision is astronomically unlikely; one retry inside a savepoint covers it.
   for(let attempt=0;;attempt++){
    await c.query('SAVEPOINT shipment_code');
    try{const row=await this.one(c,'SELECT safeer.shipment_create($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13,$14) AS row',[cid,actor,trip,destination,senderName,senderMobile,receiverName,receiverMobile,JSON.stringify(items),method,reference,newTrackingCode(),key,request]);await c.query('RELEASE SAVEPOINT shipment_code');return row;}
    catch(error){await c.query('ROLLBACK TO SAVEPOINT shipment_code');if(attempt<1&&(error as {constraint?:string}).constraint==='shipments_tracking_code_key')continue;throw error;}
   }
  });
 }
 // The QR value is returned here and never again; a lost print means a replacement tag.
 tag(token:string,cid:string,sid:string,input:unknown){
  uuid(sid);const data=body(input,['reason','version']),reason=optional(data.reason,300),v=data.version===undefined?null:version(data.version),value=newToken();
  return this.staff(token,cid,async(c,actor)=>{const row=this.found(await this.one(c,'SELECT safeer.shipment_tag($1,$2,$3,$4,$5,$6) AS row',[cid,actor,sid,tokenHash(value),reason,v]));return {...row.row,tagNumber:row.tagNumber,token:value,qr:qrPath(value)};});
 }
 move(token:string,cid:string,sid:string,input:unknown){
  uuid(sid);const data=body(input,['to','reason','version']),to=oneOf(data.to,['received','loaded','in_transit','arrived']),reason=optional(data.reason,300);
  return this.staff(token,cid,async(c,actor)=>this.found(await this.one(c,'SELECT safeer.shipment_move($1,$2,$3,$4,$5,$6) AS row',[cid,actor,sid,to,reason,version(data.version)])));
 }
 deliver(token:string,cid:string,sid:string,input:unknown){
  uuid(sid);const data=body(input,['receiverName','receiverMobile','version']),name=personName(data.receiverName),mobile=mobileNumber(data.receiverMobile,'RECEIVER_NOT_VERIFIED');
  return this.staff(token,cid,async(c,actor)=>this.found(await this.one(c,'SELECT safeer.shipment_deliver($1,$2,$3,$4,$5,$6) AS row',[cid,actor,sid,name,mobile,version(data.version)])));
 }
 returnToSender(token:string,cid:string,sid:string,input:unknown){
  uuid(sid);const data=body(input,['reason','version']),reason=text(data.reason,2,300);
  return this.staff(token,cid,async(c,actor)=>this.found(await this.one(c,'SELECT safeer.shipment_return($1,$2,$3,$4,$5) AS row',[cid,actor,sid,reason,version(data.version)])));
 }
 report(token:string,cid:string,sid:string,input:unknown){
  uuid(sid);const data=body(input,['kind','note']),kind=oneOf(data.kind,['damaged','missing','wrong_bus','other']),note=optional(data.note,300);
  return this.staff(token,cid,async(c,actor)=>this.found(await this.one(c,'SELECT safeer.shipment_report($1,$2,$3,$4,$5) AS row',[cid,actor,sid,kind,note])));
 }
 async resolve(token:string,cid:string,sid:string,eid:string,input:unknown){
  uuid(sid);uuid(eid);const data=body(input,['outcome','note','currentPassword']),outcome=oneOf(data.outcome,['found','settled','closed']),note=optional(data.note,300);
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.staff(token,cid,async(c,actor)=>this.found(await this.one(c,'SELECT safeer.shipment_resolve($1,$2,$3,$4,$5,$6) AS row',[cid,actor,sid,eid,outcome,note])));
 }
 // Public: the random code from the receipt. Unknown and malformed codes look the same.
 async track(code:unknown,client:string){
  this.tracking.take(client);
  const value=typeof code==='string'?code.trim().toUpperCase():'';
  if(!trackingPattern.test(value))fail('NOT_FOUND',404);
  const row=(await this.db.pool.query('SELECT safeer.public_shipment($1) AS row',[value])).rows[0].row;
  return this.found(row);
 }
}
