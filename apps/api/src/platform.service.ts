import {Injectable} from '@nestjs/common';
import type {PoolClient} from 'pg';
import {Database} from './database.js';
import {IdentityService} from './identity.service.js';
import {body,text,version,fail} from './security.js';

const day=(value:unknown)=>{const s=text(value,10,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||s.startsWith('0000')||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)fail('INVALID_REPORT');return s;};
const eventId=(value:unknown)=>{if(typeof value!=='string'||!/^[1-9]\d{0,18}$/.test(value)||BigInt(value)>9223372036854775807n)fail('INVALID_INPUT');return value;};
@Injectable()
export class PlatformService {
 constructor(private readonly db:Database,private readonly identity:IdentityService){}
 private run<T>(token:string,superOnly:boolean,action:(c:PoolClient)=>Promise<T>){return this.db.transaction(async c=>{
  const p=await this.identity.principal(c,token);if(superOnly&&!p.superAdministrator)fail('FORBIDDEN',403);
  await c.query("SELECT set_config('safeer.session_token',$1,true)",[token]);return action(c);
 });}
 notice(){return this.db.pool.query('SELECT safeer.platform_notice() AS row').then(r=>r.rows[0].row);}
 settings(token:string){return this.run(token,true,async c=>(await c.query('SELECT safeer.platform_settings_read() AS row')).rows[0].row);}
 async save(token:string,input:unknown){
  const d=body(input,['enabled','textEn','textAr','version','currentPassword']);if(typeof d.enabled!=='boolean')fail('INVALID_INPUT');
  const en=text(d.textEn,0,500),ar=text(d.textAr,0,500),v=version(d.version);if(d.enabled&&(!en||!ar))fail('INVALID_INPUT');
  await this.identity.reauthenticate(token,d.currentPassword);
  return this.run(token,true,async c=>(await c.query('SELECT safeer.platform_settings_save($1,$2,$3,$4) AS row',[d.enabled,en,ar,v])).rows[0].row);
 }
 dashboard(token:string,query:unknown){
  const d=body(query,['from','to','page']),from=day(d.from),to=day(d.to),p=d.page===undefined?'0':String(d.page);
  if(!/^\d{1,7}$/.test(p)||Number(p)>1000000||Date.parse(to)<Date.parse(from)||Date.parse(to)-Date.parse(from)>30*86400000)fail('INVALID_REPORT');
  return this.run(token,true,async c=>(await c.query('SELECT safeer.platform_dashboard($1,$2,$3) AS row',[from,to,Number(p)])).rows[0].row);
 }
 notifications(token:string,before:unknown){const id=before===undefined?null:eventId(before);return this.run(token,false,async c=>(await c.query('SELECT safeer.notifications_list($1) AS row',[id])).rows[0].row);}
 read(token:string,id:string,input:unknown){body(input,[]);eventId(id);return this.run(token,false,async c=>(await c.query('SELECT safeer.notification_read($1) AS row',[id])).rows[0].row);}
}
