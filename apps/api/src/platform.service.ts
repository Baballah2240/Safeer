import {Injectable} from '@nestjs/common';
import type {PoolClient} from 'pg';
import {Database} from './database.js';
import {IdentityService} from './identity.service.js';
import {body,text,version,fail} from './security.js';
import {countries} from './countries.js';
import {cardReady} from './reservation.service.js';
import {currencyDigits} from './contract-pdf.js';

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
 // D141: one standard price per country (monthly fee, commission, currency), Super Administrator only.
 prices(token:string){return this.run(token,true,async c=>({...(await c.query('SELECT safeer.country_prices_read() AS row')).rows[0].row,countries:Object.keys(countries)}));}
 async savePrice(token:string,code:string,input:unknown){
  const d=body(input,['monthlyFeeMinor','commissionBps','currency','version','currentPassword']);
  if(!(code in countries))fail('INVALID_COUNTRY');
  const fee=String(d.monthlyFeeMinor??''),bps=d.commissionBps,cur=text(d.currency,3,3).toUpperCase(),v=d.version===0?0:version(d.version);
  if(!/^\d{1,12}$/.test(fee)||Number(fee)>100000000000||!Number.isInteger(bps)||(bps as number)<0||(bps as number)>5000||!/^[A-Z]{3}$/.test(cur))fail('INVALID_INPUT');
  await this.identity.reauthenticate(token,d.currentPassword);
  return this.run(token,true,async c=>({...(await c.query('SELECT safeer.country_price_save($1,$2,$3,$4,$5) AS row',[code,fee,bps,cur,v])).rows[0].row,countries:Object.keys(countries)}));
 }
 // D145: every served country with its setup (currency, phone code, time zone, card provider and whether its
 // keys are configured), company counts and standard price, for the Super Administrator's Countries panel.
 countries(token:string){return this.run(token,true,async c=>{
  const counts=(await c.query('SELECT safeer.platform_countries() AS row')).rows[0].row.items as {countryCode:string,companies:number,approved:number}[];
  const prices=(await c.query('SELECT safeer.country_prices_read() AS row')).rows[0].row.items as {countryCode:string}[];
  const provider=(code:string)=>code==='EG'?'paymob':['KW','SA','QA'].includes(code)?'myfatoorah':null;
  return {items:Object.entries(countries).map(([code,x])=>{const n=counts.find(r=>r.countryCode===code);return {countryCode:code,calling:x.calling,currency:x.currency,digits:currencyDigits(x.currency),timezone:x.zone,
   companies:n?.companies??0,approved:n?.approved??0,cardProvider:provider(code),cardReady:provider(code)?cardReady(code):false,price:prices.find(p=>p.countryCode===code)||null};})};
 });}
 // D146: the companies set to one served country.
 countryCompanies(token:string,code:string){if(!(code in countries))fail('INVALID_COUNTRY');return this.run(token,true,async c=>(await c.query('SELECT safeer.platform_country_companies($1) AS row',[code])).rows[0].row);}
 dashboard(token:string,query:unknown){
  const d=body(query,['from','to','page']),from=day(d.from),to=day(d.to),p=d.page===undefined?'0':String(d.page);
  if(!/^\d{1,7}$/.test(p)||Number(p)>1000000||Date.parse(to)<Date.parse(from)||Date.parse(to)-Date.parse(from)>30*86400000)fail('INVALID_REPORT');
  return this.run(token,true,async c=>(await c.query('SELECT safeer.platform_dashboard($1,$2,$3) AS row',[from,to,Number(p)])).rows[0].row);
 }
 notifications(token:string,before:unknown){const id=before===undefined?null:eventId(before);return this.run(token,false,async c=>(await c.query('SELECT safeer.notifications_list($1) AS row',[id])).rows[0].row);}
 // D98: the staff header badge and live pop-up.
 unread(token:string){return this.run(token,false,async c=>(await c.query('SELECT safeer.notifications_unread() AS row')).rows[0].row);}
 readAll(token:string,input:unknown){body(input,[]);return this.run(token,false,async c=>(await c.query('SELECT safeer.notifications_read_all() AS row')).rows[0].row);}
 read(token:string,id:string,input:unknown){body(input,[]);eventId(id);return this.run(token,false,async c=>(await c.query('SELECT safeer.notification_read($1) AS row',[id])).rows[0].row);}
}
