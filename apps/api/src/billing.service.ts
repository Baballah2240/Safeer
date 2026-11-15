import {Injectable} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {Database} from './database.js';
import {IdentityService,type Principal} from './identity.service.js';
import {body,text,uuid,version,fail} from './security.js';
import {contractPdf} from './contract-pdf.js';

// D82: a Super Administrator sets each company's plan (monthly fee + commission); saving it issues a numbered
// contract that the company's profile managers and the Safeer owner receive as a PDF in their notifications.
// A company manager accepts it once. Each company also sets its own brand colors and logo.
const contractView=`id,number,plan_version AS "planVersion",monthly_fee_minor::text AS "monthlyFeeMinor",commission_bps AS "commissionBps",currency,to_char(starts_on,'YYYY-MM-DD') AS "startsOn",notes,issued_at AS "issuedAt",issued_by_name AS "issuedByName",accepted_at AS "acceptedAt",accepted_by_name AS "acceptedByName",superseded_at AS "supersededAt"`;
const hex=(value:unknown)=>{if(value===null||value===undefined||value==='')return null;if(typeof value!=='string'||!/^#[0-9a-fA-F]{6}$/.test(value))fail('INVALID_COLOR');return value.toLowerCase();};
// White text must stay readable on the brand color (WCAG AA, 4.5:1), because buttons and the page header use it.
const luminance=(color:string)=>{const [r,g,b]=[1,3,5].map(i=>{const c=parseInt(color.slice(i,i+2),16)/255;return c<=.03928?c/12.92:((c+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
const readable=(color:string|null)=>{if(color&&1.05/(luminance(color)+.05)<4.5)fail('LOW_CONTRAST');return color;};
const logoTypes:Record<string,(b:Buffer)=>boolean>={'image/png':b=>b.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])),'image/jpeg':b=>b[0]===0xff&&b[1]===0xd8&&b[2]===0xff,'image/webp':b=>b.subarray(0,4).toString('latin1')==='RIFF'&&b.subarray(8,12).toString('latin1')==='WEBP'};
function logo(value:unknown){
 if(typeof value!=='string')fail('INVALID_LOGO');const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);if(!match)fail('INVALID_LOGO');
 const data=Buffer.from(match[2],'base64');if(!data.length||data.length>98304)fail('LOGO_TOO_LARGE');if(!logoTypes[match[1]](data))fail('INVALID_LOGO');return {type:match[1],data};
}

@Injectable()
export class BillingService {
 constructor(private readonly db:Database,private readonly identity:IdentityService){}
 private run<T>(token:string,action:(c:PoolClient,p:Principal)=>Promise<T>,write=false){
  return this.db.transaction(async c=>{const p=await this.identity.principal(c,token);await c.query("SELECT set_config('safeer.session_token',$1,true)",[token]);return action(c,p);},write);
 }
 private async company(c:PoolClient,cid:string){const row=(await c.query('SELECT * FROM safeer.companies WHERE id=$1',[cid])).rows[0];if(!row)fail('NOT_FOUND',404);return row;}
 private async can(c:PoolClient,cid:string,perm:string){return Boolean((await c.query('SELECT safeer.company_can($1,$2) AS ok',[cid,perm])).rows[0].ok);}
 private async audit(c:PoolClient,p:Principal,cid:string,action:string,target:string){await c.query('INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),cid,p.id,action,target]);}
 private async member(c:PoolClient,cid:string,p:Principal){return Boolean((await c.query('SELECT 1 FROM safeer.company_users WHERE company_id=$1 AND user_id=$2 AND active',[cid,p.id])).rowCount);}

 async billing(token:string,cid:string){uuid(cid);return this.run(token,async(c,p)=>{
  await this.company(c,cid);if(!p.superAdministrator&&!await this.can(c,cid,'company.profile.manage'))fail('FORBIDDEN',403);
  const plan=(await c.query(`SELECT monthly_fee_minor::text AS "monthlyFeeMinor",commission_bps AS "commissionBps",currency,to_char(starts_on,'YYYY-MM-DD') AS "startsOn",notes,version,updated_at AS "updatedAt" FROM safeer.company_billing_plans WHERE company_id=$1`,[cid])).rows[0]||null;
  const contracts=(await c.query(`SELECT ${contractView} FROM safeer.company_contracts WHERE company_id=$1 ORDER BY issued_at DESC,id LIMIT 50`,[cid])).rows;
  return {plan,contracts,canEdit:p.superAdministrator,canAccept:!p.superAdministrator&&await this.can(c,cid,'company.profile.manage')&&await this.member(c,cid,p)};
 });}
 async saveBilling(token:string,cid:string,input:unknown){
  uuid(cid);const data=body(input,['monthlyFeeMinor','commissionBps','currency','startsOn','notes','version','currentPassword']);
  const fee=String(data.monthlyFeeMinor??'');if(!/^\d{1,12}$/.test(fee)||BigInt(fee)>100000000000n)fail('INVALID_FEE');
  const bps=data.commissionBps;if(typeof bps!=='number'||!Number.isSafeInteger(bps)||bps<0||bps>5000)fail('INVALID_COMMISSION');
  const currency=text(data.currency,3,3).toUpperCase();if(!/^[A-Z]{3}$/.test(currency))fail('INVALID_INPUT');
  const startsOn=text(data.startsOn,10,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)||new Date(startsOn+'T00:00:00Z').toISOString().slice(0,10)!==startsOn)fail('INVALID_INPUT');
  const notes=data.notes===undefined||data.notes===null?'':text(data.notes,0,500);if(/[\u0000-\u001f\u007f]/.test(notes))fail('INVALID_INPUT');
  const v=data.version===undefined||data.version===null?null:version(data.version);
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   if(!p.superAdministrator)fail('FORBIDDEN',403);const co=await this.company(c,cid);
   const saved=v===null?await c.query('INSERT INTO safeer.company_billing_plans(company_id,monthly_fee_minor,commission_bps,currency,starts_on,notes,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING version',[cid,fee,bps,currency,startsOn,notes,p.id])
    :await c.query('UPDATE safeer.company_billing_plans SET monthly_fee_minor=$2,commission_bps=$3,currency=$4,starts_on=$5,notes=$6,updated_by=$7,updated_at=clock_timestamp(),version=version+1 WHERE company_id=$1 AND version=$8 RETURNING version',[cid,fee,bps,currency,startsOn,notes,p.id,v]);
   if(!saved.rowCount)fail('STALE_VERSION',409);
   await c.query('UPDATE safeer.company_contracts SET superseded_at=clock_timestamp() WHERE company_id=$1 AND superseded_at IS NULL',[cid]);
   const id=randomUUID();
   const row=(await c.query(`INSERT INTO safeer.company_contracts(id,company_id,number,plan_version,company_name_en,company_name_ar,contact_email,phone,address,monthly_fee_minor,commission_bps,currency,starts_on,notes,issued_by,issued_by_name) VALUES($1,$2,'',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING number`,[id,cid,saved.rows[0].version,co.name_en,co.name_ar,co.contact_email,co.phone,co.address,fee,bps,currency,startsOn,notes,p.id,p.displayName])).rows[0];
   await this.audit(c,p,cid,'contract.issued',id);return {id,number:row.number};
  },true);
 }
 async accept(token:string,cid:string,id:string,input:unknown){
  uuid(cid);uuid(id);const data=body(input,['currentPassword']);await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   // The Safeer owner issues the contract, so cannot also accept it for the company.
   await this.company(c,cid);if(p.superAdministrator||!await this.can(c,cid,'company.profile.manage')||!await this.member(c,cid,p))fail('FORBIDDEN',403);
   const old=(await c.query('SELECT accepted_at,superseded_at FROM safeer.company_contracts WHERE company_id=$1 AND id=$2',[cid,id])).rows[0];if(!old)fail('NOT_FOUND',404);
   if(old.accepted_at)fail('CONTRACT_ACCEPTED',409);if(old.superseded_at)fail('CONTRACT_SUPERSEDED',409);
   const name=(await c.query('SELECT display_name FROM safeer.company_users WHERE company_id=$1 AND user_id=$2',[cid,p.id])).rows[0].display_name;
   await c.query('UPDATE safeer.company_contracts SET accepted_at=clock_timestamp(),accepted_by=$3,accepted_by_name=$4 WHERE company_id=$1 AND id=$2',[cid,id,p.id,name]);
   await this.audit(c,p,cid,'contract.accepted',id);return {id,accepted:true};
  },true);
 }
 // The Safeer owner gets the "Safeer copy" and the company the "Company copy"; the terms are identical.
 async pdf(token:string,cid:string,id:string){uuid(cid);uuid(id);return this.run(token,async(c,p)=>{
  await this.company(c,cid);
  const row=(await c.query(`SELECT number,company_name_en,contact_email,phone,address,monthly_fee_minor::text AS fee,commission_bps,currency,to_char(starts_on,'YYYY-MM-DD') AS starts_on,notes,issued_at,issued_by_name,accepted_at,accepted_by_name,superseded_at FROM safeer.company_contracts WHERE company_id=$1 AND id=$2`,[cid,id])).rows[0];
  if(!row)fail('NOT_FOUND',404);
  const iso=(v:Date|null)=>v?new Date(v).toISOString():null;
  return {name:`Safeer-contract-${row.number}.pdf`,data:contractPdf({number:row.number,copy:p.superAdministrator?'safeer':'company',companyNameEn:row.company_name_en,contactEmail:row.contact_email,phone:row.phone,address:row.address,monthlyFeeMinor:row.fee,commissionBps:row.commission_bps,currency:row.currency,startsOn:row.starts_on,notes:row.notes,issuedAt:iso(row.issued_at)!,issuedByName:row.issued_by_name,acceptedAt:iso(row.accepted_at),acceptedByName:row.accepted_by_name,supersededAt:iso(row.superseded_at)})};
 });}

 async saveBranding(token:string,cid:string,input:unknown){
  uuid(cid);const data=body(input,['primaryColor','secondaryColor','logo','removeLogo','version','currentPassword']);
  const primary=readable(hex(data.primaryColor)),secondary=readable(hex(data.secondaryColor)),image=data.logo===undefined||data.logo===null?null:logo(data.logo);
  if(data.removeLogo!==undefined&&typeof data.removeLogo!=='boolean')fail('INVALID_INPUT');const remove=data.removeLogo===true;if(remove&&image)fail('INVALID_INPUT');
  const v=data.version===undefined||data.version===null?null:version(data.version);
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   await this.company(c,cid);if(!await this.can(c,cid,'company.profile.manage'))fail('FORBIDDEN',403);
   const keep=!image&&!remove;
   const result=v===null?await c.query('INSERT INTO safeer.company_branding(company_id,primary_color,secondary_color,logo_type,logo) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING version',[cid,primary,secondary,image?.type||null,image?.data||null])
    :await c.query('UPDATE safeer.company_branding SET primary_color=$2,secondary_color=$3,logo_type=CASE WHEN $6 THEN logo_type ELSE $4 END,logo=CASE WHEN $6 THEN logo ELSE $5::bytea END,version=version+1 WHERE company_id=$1 AND version=$7 RETURNING version',[cid,primary,secondary,image?.type||null,image?.data||null,keep,v]);
   if(!result.rowCount)fail('STALE_VERSION',409);await this.audit(c,p,cid,'branding.saved',cid);return {version:result.rows[0].version};
  },true);
 }
 async logo(token:string,cid:string){uuid(cid);return this.run(token,async c=>{
  const row=(await c.query('SELECT logo_type,logo FROM safeer.company_branding WHERE company_id=$1 AND logo IS NOT NULL',[cid])).rows[0];if(!row)fail('NOT_FOUND',404);return {type:row.logo_type as string,data:row.logo as Buffer};
 });}
 async publicBrand(slug:string){if(slug.length>60||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))fail('NOT_FOUND',404);return (await this.db.pool.query('SELECT safeer.public_company_brand($1) AS row',[slug])).rows[0].row||null;}
 async publicLogo(slug:string){if(slug.length>60||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))fail('NOT_FOUND',404);const row=(await this.db.pool.query('SELECT * FROM safeer.public_company_logo($1)',[slug])).rows[0];if(!row)fail('NOT_FOUND',404);return {type:row.logo_type as string,data:row.logo as Buffer};}
}
