import {Injectable} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {Database} from './database.js';
import {IdentityService,type Principal} from './identity.service.js';
import {body,text,uuid,fail} from './security.js';

const filter=(value:unknown,pattern:RegExp)=>{if(value===undefined||value==='')return null;if(typeof value!=='string'||!pattern.test(value))fail('INVALID_INPUT');return value;};
const date=(value:unknown)=>{const result=filter(value,/^\d{4}-\d{2}-\d{2}$/);if(result&&(Number.isNaN(Date.parse(result+'T00:00:00Z'))||new Date(result+'T00:00:00Z').toISOString().slice(0,10)!==result))fail('INVALID_INPUT');return result;};
const slugPattern=/^[a-z0-9]+(-[a-z0-9]+)*$/,codePattern=/^[A-Z0-9_-]{1,40}$/;
const optional=(value:unknown,max:number)=>value===undefined||value===null||value===''?null:text(value,1,max);
const about=(value:unknown)=>{if(value===undefined||value===null)return '';if(typeof value!=='string'||value.length>1000||/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/.test(value))fail('INVALID_INPUT');return value.trim();};

@Injectable()
export class PublicService {
 constructor(private readonly db:Database,private readonly identity:IdentityService){}
 private rows(sql:string,values:unknown[]){return this.db.pool.query(sql,values).then(result=>result.rows.map(row=>Object.values(row)[0]));}
 // Anonymous reads use the fixed database projections and never receive a session or see a table.
 cities(){return this.rows('SELECT safeer.public_cities() AS row',[]).then(items=>({items}));}
 companies(){return this.rows('SELECT safeer.public_companies(NULL) AS row',[]).then(items=>({items}));}
 async company(slug:string){
  if(slug.length>60||!slugPattern.test(slug))fail('NOT_FOUND',404);
  const [company]=await this.rows('SELECT safeer.public_companies($1) AS row',[slug]);if(!company)fail('NOT_FOUND',404);
  return {company,trips:await this.rows('SELECT safeer.public_trips(NULL,NULL,NULL,$1) AS row',[slug])};
 }
 async trips(query:Record<string,unknown>){
  const from=filter(query.from,codePattern),to=filter(query.to,codePattern),day=date(query.date);
  return {items:await this.rows('SELECT safeer.public_trips($1,$2,$3::date,NULL) AS row',[from,to,day])};
 }
 private async run<T>(token:string,cid:string,action:(c:PoolClient,p:Principal)=>Promise<T>,write=false){
  return this.db.transaction(async c=>{
   const p=await this.identity.principal(c,token);await c.query("SELECT set_config('safeer.session_token',$1,true)",[token]);
   if(!(await c.query('SELECT 1 FROM safeer.companies WHERE id=$1',[cid])).rowCount)fail('NOT_FOUND',404);
   if(!(await c.query("SELECT safeer.company_can($1,'company.profile.manage') AS ok",[cid])).rows[0].ok)fail('FORBIDDEN',403);
   return action(c,p);
  },write);
 }
 async profile(token:string,cid:string){uuid(cid);return this.run(token,cid,async c=>{
  const row=(await c.query('SELECT p.listed,p.about_en AS "aboutEn",p.about_ar AS "aboutAr",p.public_phone AS phone,p.public_email AS email,p.public_address AS address,p.version FROM safeer.company_public_profiles p WHERE p.company_id=$1',[cid])).rows[0];
  return row||{listed:false,aboutEn:'',aboutAr:'',phone:null,email:null,address:null,version:0};
 });}
 async saveProfile(token:string,cid:string,input:unknown){
  uuid(cid);const data=body(input,['listed','aboutEn','aboutAr','phone','email','address','version','currentPassword']);
  if(typeof data.listed!=='boolean'||!Number.isSafeInteger(data.version)||Number(data.version)<0)fail('INVALID_INPUT');
  const phone=optional(data.phone,30),email=optional(data.email,254);
  if(phone&&!/^[+0-9 ()-]{5,30}$/.test(phone))fail('INVALID_INPUT');if(email&&!/^[^\s@]+@[^\s@]+$/.test(email))fail('INVALID_INPUT');
  const values=[data.listed,about(data.aboutEn),about(data.aboutAr),phone,email,optional(data.address,300),cid];
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,cid,async(c,p)=>{
   if(data.version===0)await c.query('INSERT INTO safeer.company_public_profiles(listed,about_en,about_ar,public_phone,public_email,public_address,company_id) VALUES($1,$2,$3,$4,$5,$6,$7)',values);
   else{const result=await c.query('UPDATE safeer.company_public_profiles SET listed=$1,about_en=$2,about_ar=$3,public_phone=$4,public_email=$5,public_address=$6,version=version+1 WHERE company_id=$7 AND version=$8 RETURNING company_id',[...values,data.version]);if(!result.rowCount)fail('STALE_VERSION',409);}
   await c.query('INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),cid,p.id,data.listed?'public_page.listed':'public_page.hidden',cid]);return {id:cid};
  },true);
 }
}
