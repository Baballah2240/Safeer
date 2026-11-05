import {Injectable} from '@nestjs/common';
import {randomBytes,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import qrcode from 'qrcode-generator';
import {Database} from './database.js';
import {IdentityService} from './identity.service.js';
import {body,digest,text,uuid,fail} from './security.js';
import {mobileNumber} from './reservation.service.js';

const optional=(value:unknown,max:number)=>value===undefined||value===null||value===''?null:text(value,1,max);
const oneOf=(value:unknown,allowed:string[])=>{if(typeof value!=='string'||!allowed.includes(value))fail('INVALID_INPUT');return value as string;};
const whole=(value:unknown,min:number,max:number)=>{if(!Number.isSafeInteger(value)||Number(value)<min||Number(value)>max)fail('INVALID_INPUT');return Number(value);};
const documentNumber=/^(TKT|TAG|LUG)-[0-9]{8}$|^SF-[2-9A-HJ-NP-Z]{8}$/,tokenPattern=/^LQ[2-9A-Z]{24}$/,alphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
// The QR holds only this random value. It says nothing about the bag, and only its hash is stored.
const newToken=()=>'LQ'+[...randomBytes(24)].map(byte=>alphabet[byte%32]).join(''),tokenHash=(token:string)=>digest('safeer-luggage-qr-v1:'+token);
const qrPath=(token:string)=>{const code=qrcode(0,'M');code.addData(token);code.make();const size=code.getModuleCount();let path='';for(let row=0;row<size;row++)for(let column=0;column<size;column++)if(code.isDark(row,column))path+=`M${column} ${row}h1v1h-1z`;return {size,path};};
const details=(data:Record<string,unknown>)=>({category:oneOf(data.category,['suitcase','bag','box','other']),quantity:whole(data.quantity,1,20),grams:whole(data.weightGrams,1,500000),description:optional(data.description,300),handling:optional(data.handling,200)});

@Injectable()
export class LuggageService {
 constructor(private readonly db:Database,private readonly identity:IdentityService){}
 // Numbers are sequential, so typed searches are limited per person to stop anyone walking through them.
 private readonly searches=new Map<string,{since:number,count:number}>();
 private limit(actor:string){const now=Date.now(),seen=this.searches.get(actor);if(!seen||now-seen.since>3600000){if(this.searches.size>10000)this.searches.clear();this.searches.set(actor,{since:now,count:1});return;}if(++seen.count>300)fail('RATE_LIMITED',429,'Too many searches. Try again later.');}
 private staff<T>(token:string,cid:string,action:(c:PoolClient,actor:string)=>Promise<T>){uuid(cid);return this.db.transaction(async c=>{
  const p=await this.identity.principal(c,token);await c.query("SELECT set_config('safeer.session_token',$1,true)",[token]);
  if(!(await c.query('SELECT 1 FROM safeer.companies WHERE id=$1',[cid])).rowCount)fail('NOT_FOUND',404);
  return action(c,p.id);
 },false);}
 private audit(c:PoolClient,cid:string,actor:string,action:string,target:string){return c.query('INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),cid,actor,action,target]);}
 // The audit records that a search happened, never what was typed.
 find(token:string,cid:string,query:unknown){
  const q=query===undefined||query===''?null:text(query,2,40).toUpperCase();if(q&&!documentNumber.test(q))fail('INVALID_INPUT');
  return this.staff(token,cid,async(c,actor)=>{if(q)this.limit(actor);const row=(await c.query('SELECT safeer.luggage_find($1,$2,NULL) AS row',[cid,q])).rows[0].row;await this.audit(c,cid,actor,q?'luggage.searched':'luggage.listed',row.items[0]?.id??cid);return row;});
 }
 // A scanned value arrives in the body, so it stays out of request logs.
 scan(token:string,cid:string,input:unknown){
  const data=body(input,['token']),value=text(data.token,2,40).toUpperCase();if(!tokenPattern.test(value))fail('TAG_UNKNOWN');
  return this.staff(token,cid,async(c,actor)=>{const row=(await c.query('SELECT safeer.luggage_find($1,NULL,$2) AS row',[cid,tokenHash(value)])).rows[0].row;await this.audit(c,cid,actor,'luggage.scanned',row.items[0]?.id??cid);return row;});
 }
 register(token:string,cid:string,input:unknown){
  const data=body(input,['ticketNumber','category','quantity','weightGrams','description','handling','key']),ticket=text(data.ticketNumber,2,16).toUpperCase(),d=details(data),key=digest(`safeer-luggage-v1:${cid}:${uuid(data.key)}`),request=digest(`safeer-luggage-request-v1:${data.key}:`+JSON.stringify([ticket,d]));
  return this.staff(token,cid,async(c,actor)=>(await c.query('SELECT safeer.luggage_register($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS row',[cid,actor,ticket,d.category,d.quantity,d.grams,d.description,d.handling,key,request])).rows[0].row);
 }
 update(token:string,cid:string,lid:string,input:unknown){
  uuid(lid);const data=body(input,['category','quantity','weightGrams','description','handling','version']),d=details(data),version=whole(data.version,1,2147483647);
  return this.staff(token,cid,async(c,actor)=>this.found((await c.query('SELECT safeer.luggage_update($1,$2,$3,$4,$5,$6,$7,$8,$9) AS row',[cid,actor,lid,d.category,d.quantity,d.grams,d.description,d.handling,version])).rows[0].row));
 }
 // The QR value is returned here and never again, so a lost print means a new tag.
 tag(token:string,cid:string,lid:string,input:unknown){
  uuid(lid);const data=body(input,['reason','version']),reason=optional(data.reason,300),version=data.version===undefined?null:whole(data.version,1,2147483647),value=newToken();
  return this.staff(token,cid,async(c,actor)=>{const row=this.found((await c.query('SELECT safeer.luggage_tag($1,$2,$3,$4,$5,$6) AS row',[cid,actor,lid,tokenHash(value),reason,version])).rows[0].row);return {...row.row,tagNumber:row.tagNumber,token:value,qr:qrPath(value)};});
 }
 move(token:string,cid:string,lid:string,input:unknown){
  uuid(lid);const data=body(input,['to','reason','version']),to=oneOf(data.to,['tagged','loaded','in_transit','unloaded']),reason=optional(data.reason,300),version=whole(data.version,1,2147483647);
  return this.staff(token,cid,async(c,actor)=>this.found((await c.query('SELECT safeer.luggage_move($1,$2,$3,$4,$5,$6) AS row',[cid,actor,lid,to,reason,version])).rows[0].row));
 }
 collect(token:string,cid:string,lid:string,input:unknown){
  uuid(lid);const data=body(input,['proof','reason','version']),proof=text(data.proof,2,40).toUpperCase(),reason=optional(data.reason,300),version=whole(data.version,1,2147483647);
  const ticket=proof.startsWith('TKT-')?proof:null,mobile=ticket?null:mobileNumber(proof,'COLLECTION_NOT_VERIFIED');
  return this.staff(token,cid,async(c,actor)=>this.found((await c.query('SELECT safeer.luggage_collect($1,$2,$3,$4,$5,$6,$7) AS row',[cid,actor,lid,ticket,mobile,reason,version])).rows[0].row));
 }
 report(token:string,cid:string,lid:string,input:unknown){
  uuid(lid);const data=body(input,['kind','note']),kind=oneOf(data.kind,['damaged','missing','wrong_bag','other']),note=optional(data.note,300);
  return this.staff(token,cid,async(c,actor)=>this.found((await c.query('SELECT safeer.luggage_report($1,$2,$3,$4,$5) AS row',[cid,actor,lid,kind,note])).rows[0].row));
 }
 async resolve(token:string,cid:string,lid:string,eid:string,input:unknown){
  uuid(lid);uuid(eid);const data=body(input,['outcome','note','currentPassword']),outcome=oneOf(data.outcome,['found','settled','closed']),note=optional(data.note,300);
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.staff(token,cid,async(c,actor)=>this.found((await c.query('SELECT safeer.luggage_resolve($1,$2,$3,$4,$5,$6) AS row',[cid,actor,lid,eid,outcome,note])).rows[0].row));
 }
 private found<T>(row:T){if(!row)fail('NOT_FOUND',404);return row;}
}
