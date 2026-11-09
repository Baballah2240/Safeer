import {Injectable} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {Database} from './database.js';
import {IdentityService,type Principal} from './identity.service.js';
import {body,text,login,uuid,version,list,secret,hashPassword,fail} from './security.js';

const permissionCodes=['company.profile.read','company.profile.manage','company.resources.read','company.resources.manage','company.members.read','company.members.manage','company.roles.read','company.roles.manage','company.audit.read','company.routes.read','company.routes.manage','company.fleet.read','company.fleet.manage','company.drivers.read','company.drivers.manage','company.trips.read','company.trips.manage','company.bookings.read','company.bookings.manage','company.luggage.operate','company.luggage.resolve','company.shipments.operate','company.shipments.resolve','company.shipments.prices','company.ticketing.operate','company.payments.late','company.sessions.manage','company.driver.operate','company.journeys.manage','company.finance.read'];
const supportCodes=['company.profile.read','company.resources.read','company.audit.read','company.routes.read'];
type Assignment={roleId:string;branchId:string|null;stationId:string|null;scope:string};
const optional=(value:unknown,max:number)=>value===undefined?'':text(value,0,max);
const active=(value:unknown)=>{if(typeof value!=='boolean')fail('INVALID_INPUT');return value;};
const code=(value:unknown)=>{const s=text(value,1,40).toUpperCase();if(!/^[A-Z0-9_-]+$/.test(s))fail('INVALID_INPUT');return s;};
function settings(data:Record<string,unknown>){
 const holdMinutes=data.holdMinutes;if(typeof holdMinutes!=='number'||!Number.isSafeInteger(holdMinutes)||holdMinutes<5||holdMinutes>1440)fail('INVALID_INPUT');
 const timezone=text(data.timezone,1,80);try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{fail('INVALID_INPUT');}
 if(typeof data.locale!=='string'||!['en','ar'].includes(data.locale))fail('INVALID_INPUT');return {holdMinutes,timezone,locale:String(data.locale)};
}
function permissions(value:unknown){const result=list(value,x=>text(x,1,80));if(result.some(p=>!permissionCodes.includes(p)))fail('INVALID_PERMISSION');return result;}

@Injectable()
export class CompanyService {
 constructor(private readonly db:Database,private readonly identity:IdentityService){}
 private async run<T>(token:string,action:(c:PoolClient,p:Principal)=>Promise<T>,write=false){
  return this.db.transaction(async c=>{const p=await this.identity.principal(c,token);await c.query("SELECT set_config('safeer.session_token',$1,true)",[token]);return action(c,p);},write);
 }
 private async can(c:PoolClient,cid:string,perm:string,bid:string|null=null,sid:string|null=null){return Boolean((await c.query('SELECT safeer.company_can($1,$2,$3,$4) AS ok',[cid,perm,bid,sid])).rows[0].ok);}
 private async has(c:PoolClient,cid:string,perm:string){return Boolean((await c.query('SELECT safeer.company_has($1,$2) AS ok',[cid,perm])).rows[0].ok);}
 private async need(c:PoolClient,cid:string,perm:string,bid:string|null=null,sid:string|null=null){if(!await this.can(c,cid,perm,bid,sid))fail('FORBIDDEN',403);}
 private async company(c:PoolClient,id:string){const row=(await c.query('SELECT * FROM safeer.companies WHERE id=$1',[id])).rows[0];if(!row)fail('NOT_FOUND',404);return row;}
 private async audit(c:PoolClient,p:Principal,cid:string,action:string,target:string,bid:string|null=null,sid:string|null=null){await c.query('SET CONSTRAINTS ALL IMMEDIATE');if(!p.superAdministrator&&!await this.has(c,cid,'company.profile.read'))fail('SELF_ACCESS_CHANGE',409);await c.query('INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id,branch_id,station_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),cid,p.id,action,target,bid,sid]);}
 async companies(token:string){return this.run(token,async(c,p)=>({items:(await c.query('SELECT id,slug,name_en AS "nameEn",name_ar AS "nameAr",status,version FROM safeer.companies ORDER BY name_en,id')).rows,canCreate:p.superAdministrator}));}
 async workspace(token:string,cid:string){uuid(cid);return this.run(token,async(c,p)=>{
  await this.company(c,cid);
  const company=(await c.query(`SELECT co.id,co.slug,co.name_en AS "nameEn",co.name_ar AS "nameAr",co.status,co.version,co.contact_email AS "contactEmail",co.phone,co.address,s.hold_minutes AS "holdMinutes",s.timezone,s.locale FROM safeer.companies co JOIN safeer.company_settings s ON s.company_id=co.id WHERE co.id=$1`,[cid])).rows[0];if(!company)fail('NOT_FOUND',404);
  const branches=(await c.query(`SELECT id,code,name_en AS "nameEn",name_ar AS "nameAr",active,version,safeer.company_can(company_id,'company.resources.manage',id) AS "canEdit" FROM safeer.branches WHERE company_id=$1 ORDER BY code`,[cid])).rows;
  const stations=(await c.query(`SELECT id,branch_id AS "branchId",code,name_en AS "nameEn",name_ar AS "nameAr",address,city_id AS "cityId",active,version,safeer.company_can(company_id,'company.resources.manage',branch_id,id) AS "canEdit" FROM safeer.stations WHERE company_id=$1 ORDER BY code`,[cid])).rows;
  const roles=await this.has(c,cid,'company.roles.read')?(await c.query(`SELECT r.id,r.code,r.display_name AS "displayName",r.scope,r.active,r.version,COALESCE(array_agg(p.permission_code ORDER BY p.permission_code) FILTER(WHERE p.permission_code IS NOT NULL),'{}') AS permissions FROM safeer.company_roles r LEFT JOIN safeer.company_role_permissions p ON (p.company_id,p.role_id)=(r.company_id,r.id) WHERE r.company_id=$1 GROUP BY r.id ORDER BY r.code`,[cid])).rows:[];
  const members=await this.has(c,cid,'company.members.read')?(await c.query(`SELECT m.id,m.user_id AS "userId",m.display_name AS "displayName",u.normalized_login AS login,m.active,u.active AS "accountActive",m.version,safeer.member_visible(m.company_id,m.id,true) AS "canEdit",COALESCE((SELECT json_agg(json_build_object('roleId',a.role_id,'scope',a.scope,'branchId',a.branch_id,'stationId',a.station_id) ORDER BY a.id) FROM safeer.company_user_roles a WHERE (a.company_id,a.member_id)=(m.company_id,m.id)),'[]') AS assignments FROM safeer.company_users m JOIN safeer.users u ON u.id=m.user_id WHERE m.company_id=$1 ORDER BY m.display_name,m.id`,[cid])).rows:[];
  const audit=await this.has(c,cid,'company.audit.read')?(await c.query(`SELECT id,actor_id AS "actorId",action,target_id AS "targetId",occurred_at AS "occurredAt" FROM safeer.company_audit WHERE company_id=$1 ORDER BY occurred_at DESC,id LIMIT 100`,[cid])).rows:[];
  const grants=await this.can(c,cid,'company.members.manage')?(await c.query(`SELECT g.id,u.normalized_login AS login,g.reason,g.expires_at AS "expiresAt",g.revoked_at AS "revokedAt",g.expires_at>clock_timestamp() AND g.revoked_at IS NULL AS active,COALESCE((SELECT array_agg(permission_code ORDER BY permission_code) FROM safeer.support_access_grant_permissions p WHERE (p.company_id,p.grant_id)=(g.company_id,g.id)),'{}') AS permissions FROM safeer.support_access_grants g JOIN safeer.users u ON u.id=g.support_user_id WHERE g.company_id=$1 ORDER BY g.created_at DESC,g.id`,[cid])).rows:[];
  const managedBranches=[],memberBranches=[],memberStations=[];for(const b of branches){if(await this.can(c,cid,'company.resources.manage',b.id))managedBranches.push(b.id);if(await this.can(c,cid,'company.members.manage',b.id))memberBranches.push(b.id);}for(const st of stations)if(await this.can(c,cid,'company.members.manage',st.branchId,st.id))memberStations.push(st.id);
  await this.company(c,cid);
  const cities=(await c.query('SELECT id,code,name_en AS "nameEn",name_ar AS "nameAr",active FROM safeer.cities ORDER BY name_en,id')).rows;
  return {company,branches,stations,cities,roles,members,audit,grants,permissions:permissionCodes,capabilities:{financeRead:await this.has(c,cid,'company.finance.read'),superAdministrator:p.superAdministrator,profile:await this.can(c,cid,'company.profile.manage'),branchCreate:await this.can(c,cid,'company.resources.manage'),managedBranches,memberBranches,memberStations,memberCompanyScope:await this.can(c,cid,'company.members.manage'),membersRead:await this.has(c,cid,'company.members.read'),rolesRead:await this.has(c,cid,'company.roles.read'),auditRead:await this.has(c,cid,'company.audit.read'),supportRead:await this.can(c,cid,'company.members.manage'),memberCreate:await this.has(c,cid,'company.members.manage')&&await this.has(c,cid,'company.roles.read'),roleManage:await this.can(c,cid,'company.roles.manage'),routesRead:await this.can(c,cid,'company.routes.read'),routesManage:Boolean((await c.query('SELECT safeer.route_manage($1) AS ok',[cid])).rows[0].ok),fleetRead:await this.can(c,cid,'company.fleet.read'),driversRead:await this.can(c,cid,'company.drivers.read'),bookingsRead:await this.has(c,cid,'company.bookings.read'),ticketing:await this.has(c,cid,'company.ticketing.operate'),luggage:await this.has(c,cid,'company.luggage.operate'),luggageResolve:await this.has(c,cid,'company.luggage.resolve'),shipments:await this.has(c,cid,'company.shipments.operate'),shipmentsResolve:await this.has(c,cid,'company.shipments.resolve'),shipmentPrices:await this.has(c,cid,'company.shipments.prices'),stationScreen:await this.has(c,cid,'company.ticketing.operate')||await this.has(c,cid,'company.sessions.manage')||await this.has(c,cid,'company.resources.manage')||await this.can(c,cid,'company.profile.manage'),tripsRead:await this.can(c,cid,'company.trips.read'),supportManage:p.superAdministrator}};
 });}
 async create(token:string,input:unknown){
  const data=body(input,['nameEn','nameAr','slug','contactEmail','phone','address','holdMinutes','timezone','locale','currentPassword']);
  const nameEn=text(data.nameEn),nameAr=text(data.nameAr),slug=text(data.slug,1,60).toLowerCase();if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))fail('INVALID_INPUT');
  const conf=settings(data),email=data.contactEmail===undefined||data.contactEmail===''?'':login(data.contactEmail),phone=optional(data.phone,40),address=optional(data.address,300);
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   if(!p.superAdministrator)fail('FORBIDDEN',403);
   const templates=(await c.query("SELECT * FROM safeer.roles WHERE scope IN ('company','branch','station') AND builtin AND active ORDER BY code")).rows;
   const template=templates.find(r=>r.code==='company_administrator');
   const adminPermissions=template?(await c.query('SELECT permission_code FROM safeer.role_permissions WHERE role_id=$1',[template.id])).rows.map(r=>r.permission_code):[];
   if(!['company.profile.read','company.members.read','company.members.manage','company.roles.read','company.roles.manage'].every(code=>adminPermissions.includes(code)))fail('COMPANY_ADMIN_TEMPLATE',409);
   const id=randomUUID();await c.query('INSERT INTO safeer.companies(id,slug,name_en,name_ar,contact_email,phone,address) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,slug,nameEn,nameAr,email,phone,address]);
   await c.query('INSERT INTO safeer.company_settings(company_id,hold_minutes,timezone,locale) VALUES($1,$2,$3,$4)',[id,conf.holdMinutes,conf.timezone,conf.locale]);
   let adminRole='';for(const r of templates){const rid=randomUUID();if(r.code==='company_administrator')adminRole=rid;await c.query('INSERT INTO safeer.company_roles(id,company_id,code,display_name,scope) VALUES($1,$2,$3,$4,$5)',[rid,id,r.code,r.display_name,r.scope]);await c.query("INSERT INTO safeer.company_role_permissions(company_id,role_id,permission_code) SELECT $1,$2,permission_code FROM safeer.role_permissions WHERE role_id=$3 AND permission_code LIKE 'company.%'",[id,rid,r.id]);}
   const member=randomUUID();await c.query('INSERT INTO safeer.company_users(id,company_id,user_id,display_name) VALUES($1,$2,$3,$4)',[member,id,p.id,p.displayName]);await c.query("INSERT INTO safeer.company_user_roles(id,company_id,member_id,role_id,scope) VALUES($1,$2,$3,$4,'company')",[randomUUID(),id,member,adminRole]);
   await this.audit(c,p,id,'company.created',id);return {id};
  },true);
 }
 async update(token:string,cid:string,input:unknown){
  uuid(cid);const data=body(input,['nameEn','nameAr','slug','status','contactEmail','phone','address','holdMinutes','timezone','locale','version','currentPassword']);
  const nameEn=text(data.nameEn),nameAr=text(data.nameAr),conf=settings(data),v=version(data.version),email=data.contactEmail===undefined||data.contactEmail===''?'':login(data.contactEmail),phone=optional(data.phone,40),address=optional(data.address,300);
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   const old=await this.company(c,cid);await this.need(c,cid,'company.profile.manage');
   if(!p.superAdministrator&&(data.status!==undefined||data.slug!==undefined))fail('FORBIDDEN',403);
   const status=data.status===undefined?old.status:text(data.status,1,20),slug=data.slug===undefined?old.slug:text(data.slug,1,60).toLowerCase();
   if(!['pending','approved','suspended','archived'].includes(status)||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))fail('INVALID_INPUT');
   const result=await c.query('UPDATE safeer.companies SET name_en=$1,name_ar=$2,slug=$3,status=$4,contact_email=$5,phone=$6,address=$7,version=version+1 WHERE id=$8 AND version=$9 RETURNING id',[nameEn,nameAr,slug,status,email,phone,address,cid,v]);if(!result.rowCount)fail('STALE_VERSION',409);
   await c.query('UPDATE safeer.company_settings SET hold_minutes=$1,timezone=$2,locale=$3 WHERE company_id=$4',[conf.holdMinutes,conf.timezone,conf.locale,cid]);await this.audit(c,p,cid,'company.updated',cid);return {id:cid};
  },true);
 }
 async resource(token:string,cid:string,kind:'branches'|'stations',id:string|undefined,input:unknown){
  uuid(cid);if(id)uuid(id);const data=body(input,['code','nameEn','nameAr','active','currentPassword',...(id?['version']:[]),...(kind==='stations'?['branchId','address','cityId']:[])]);
  const nameEn=text(data.nameEn),nameAr=text(data.nameAr),resourceCode=code(data.code),enabled=active(data.active),v=id?version(data.version):1;
  const cityId=data.cityId===undefined||data.cityId===null?null:uuid(data.cityId);
  const branchId=kind==='stations'?uuid(data.branchId):null,address=optional(data.address,300);await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   await this.company(c,cid);let bid=branchId;
   if(id){const old=(await c.query(`SELECT * FROM safeer.${kind} WHERE company_id=$1 AND id=$2`,[cid,id])).rows[0];if(!old)fail('NOT_FOUND',404);if(kind==='stations'&&old.branch_id!==branchId)fail('INVALID_RESOURCE_SCOPE');}
   if(kind==='branches')bid=id||null;
   await this.need(c,cid,'company.resources.manage',bid,kind==='stations'?id||null:null);
   if(branchId&&!(await c.query('SELECT 1 FROM safeer.branches WHERE company_id=$1 AND id=$2 AND (active OR $3::boolean)',[cid,branchId,Boolean(id)])).rowCount)fail('INVALID_RESOURCE_SCOPE');
   const rid=id||randomUUID();let result;
   if(kind==='branches')result=id?await c.query('UPDATE safeer.branches SET code=$1,name_en=$2,name_ar=$3,active=$4,version=version+1 WHERE company_id=$5 AND id=$6 AND version=$7 RETURNING id',[resourceCode,nameEn,nameAr,enabled,cid,id,v]):await c.query('INSERT INTO safeer.branches(id,company_id,code,name_en,name_ar,active) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[rid,cid,resourceCode,nameEn,nameAr,enabled]);
   else result=id?await c.query('UPDATE safeer.stations SET code=$1,name_en=$2,name_ar=$3,address=$4,active=$5,city_id=CASE WHEN $9::boolean THEN $10::uuid ELSE city_id END,version=version+1 WHERE company_id=$6 AND id=$7 AND version=$8 RETURNING id',[resourceCode,nameEn,nameAr,address,enabled,cid,id,v,data.cityId!==undefined,cityId]):await c.query('INSERT INTO safeer.stations(id,company_id,branch_id,code,name_en,name_ar,address,active,city_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',[rid,cid,branchId,resourceCode,nameEn,nameAr,address,enabled,cityId]);
   if(!result.rowCount)fail('STALE_VERSION',409);await this.audit(c,p,cid,kind==='branches'?'branch.saved':'station.saved',rid,kind==='branches'?rid:branchId,kind==='stations'?rid:null);return {id:rid};
  },true);
 }
 private async assignments(c:PoolClient,cid:string,value:unknown){
  if(!Array.isArray(value)||value.length>10)fail('INVALID_INPUT');const assignments:Assignment[]=[],unique=new Set();
  for(const input of value){const data=body(input,['roleId','branchId','stationId']);const rid=uuid(data.roleId),role=(await c.query('SELECT * FROM safeer.company_roles WHERE company_id=$1 AND id=$2 AND active',[cid,rid])).rows[0];if(!role)fail('INVALID_ROLE_SCOPE');
   const bid=data.branchId===undefined||data.branchId===null?null:uuid(data.branchId),sid=data.stationId===undefined||data.stationId===null?null:uuid(data.stationId);
   if((role.scope==='company'&&(bid||sid))||(role.scope==='branch'&&(!bid||sid))||(role.scope==='station'&&(!bid||!sid)))fail('INVALID_RESOURCE_SCOPE');
   if(bid&&!(await c.query('SELECT 1 FROM safeer.branches WHERE company_id=$1 AND id=$2 AND active',[cid,bid])).rowCount)fail('INVALID_RESOURCE_SCOPE');
   if(sid&&!(await c.query('SELECT 1 FROM safeer.stations WHERE company_id=$1 AND branch_id=$2 AND id=$3 AND active',[cid,bid,sid])).rowCount)fail('INVALID_RESOURCE_SCOPE');
   await this.need(c,cid,'company.members.manage',bid,sid);
   const perms=(await c.query('SELECT permission_code FROM safeer.company_role_permissions WHERE company_id=$1 AND role_id=$2',[cid,rid])).rows.map(r=>r.permission_code as string);
   for(const perm of perms)if(!await this.can(c,cid,perm,bid,sid))fail('PRIVILEGE_ESCALATION',403);
   const key=[rid,bid,sid].join(':');if(unique.has(key))fail('INVALID_INPUT');unique.add(key);assignments.push({roleId:rid,branchId:bid,stationId:sid,scope:role.scope});
  }return assignments;
 }
 async member(token:string,cid:string,id:string|undefined,input:unknown){
  uuid(cid);if(id)uuid(id);const data=body(input,id?['displayName','active','assignments','version','currentPassword']:['displayName','login','existing','assignments','currentPassword']);
  const displayName=text(data.displayName),enabled=id?active(data.active):true,v=id?version(data.version):1,email=id?'':login(data.login);
  if(!id&&typeof data.existing!=='boolean')fail('INVALID_INPUT');await this.identity.reauthenticate(token,data.currentPassword);
  await this.run(token,async(c)=>{await this.company(c,cid);if(!await this.has(c,cid,'company.members.manage'))fail('FORBIDDEN',403);});
  const temporaryPassword=!id&&!data.existing?secret().slice(0,24):null,encoded=temporaryPassword?await hashPassword(temporaryPassword):null;
  return this.run(token,async(c,p)=>{
   await this.company(c,cid);if(!await this.has(c,cid,'company.members.manage'))fail('FORBIDDEN',403);
   const assignments=await this.assignments(c,cid,data.assignments);if(enabled&&!assignments.length)fail('INVALID_ROLE_SCOPE');
   const mid=id||randomUUID();let uid='';
   if(id){const old=(await c.query('SELECT * FROM safeer.company_users WHERE company_id=$1 AND id=$2',[cid,id])).rows[0];if(!old)fail('NOT_FOUND',404);
    if(!(await c.query('SELECT safeer.member_visible($1,$2,true) AS ok',[cid,id])).rows[0].ok)fail('FORBIDDEN',403);
    uid=old.user_id;const result=await c.query('UPDATE safeer.company_users SET display_name=$1,active=$2,version=version+1 WHERE company_id=$3 AND id=$4 AND version=$5 RETURNING id',[displayName,enabled,cid,id,v]);if(!result.rowCount)fail('STALE_VERSION',409);
    await c.query('DELETE FROM safeer.company_user_roles WHERE company_id=$1 AND member_id=$2',[cid,id]);
   }else{
    if(data.existing){if(!p.superAdministrator)fail('FORBIDDEN',403);const u=(await c.query('SELECT id FROM safeer.users WHERE normalized_login=$1 AND active',[email])).rows[0];if(!u)fail('NOT_FOUND',404);uid=u.id;}
    else{uid=randomUUID();await c.query('INSERT INTO safeer.users(id,normalized_login,display_name,password_hash) VALUES($1,$2,$3,$4)',[uid,email,displayName,encoded]);}
    await c.query('INSERT INTO safeer.company_users(id,company_id,user_id,display_name) VALUES($1,$2,$3,$4)',[mid,cid,uid,displayName]);
   }
   for(const a of assignments)await c.query('INSERT INTO safeer.company_user_roles(id,company_id,member_id,role_id,scope,branch_id,station_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),cid,mid,a.roleId,a.scope,a.branchId,a.stationId]);
   const single=assignments.length===1?assignments[0]:null;await this.audit(c,p,cid,'member.saved',mid,single?.branchId||null,single?.stationId||null);
   return {id:mid,...(temporaryPassword?{user:{login:email},temporaryPassword}:{})};
  },true);
 }
 async role(token:string,cid:string,id:string|undefined,input:unknown){
  uuid(cid);if(id)uuid(id);const data=body(input,id?['displayName','active','permissions','version','currentPassword']:['displayName','scope','permissions','currentPassword']);
  const name=text(data.displayName),perms=permissions(data.permissions),enabled=id?active(data.active):true,v=id?version(data.version):1;
  const scope=id?'':text(data.scope,1,20);if(!id&&!['company','branch','station'].includes(scope))fail('INVALID_ROLE_SCOPE');await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   await this.company(c,cid);await this.need(c,cid,'company.roles.manage');for(const perm of perms)await this.need(c,cid,perm);
   const rid=id||randomUUID();if(id){const result=await c.query('UPDATE safeer.company_roles SET display_name=$1,active=$2,version=version+1 WHERE company_id=$3 AND id=$4 AND version=$5 RETURNING id',[name,enabled,cid,id,v]);if(!result.rowCount){const exists=(await c.query('SELECT id FROM safeer.company_roles WHERE company_id=$1 AND id=$2',[cid,id])).rowCount;fail(exists?'STALE_VERSION':'NOT_FOUND',exists?409:404);}}
   else await c.query('INSERT INTO safeer.company_roles(id,company_id,code,display_name,scope) VALUES($1,$2,$3,$4,$5)',[rid,cid,'custom_'+rid.replaceAll('-',''),name,scope]);
   await c.query('DELETE FROM safeer.company_role_permissions WHERE company_id=$1 AND role_id=$2',[cid,rid]);for(const perm of perms)await c.query('INSERT INTO safeer.company_role_permissions(company_id,role_id,permission_code) VALUES($1,$2,$3)',[cid,rid,perm]);
   await this.audit(c,p,cid,'company_role.saved',rid);return {id:rid};
  },true);
 }
 async support(token:string,cid:string,id:string|undefined,input:unknown){
  uuid(cid);if(id)uuid(id);const data=body(input,id?['currentPassword']:['login','reason','hours','permissions','currentPassword']);
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   if(!p.superAdministrator)fail('FORBIDDEN',403);await this.company(c,cid);
   const gid=id||randomUUID();if(id){const result=await c.query('UPDATE safeer.support_access_grants SET revoked_at=clock_timestamp() WHERE company_id=$1 AND id=$2 AND revoked_at IS NULL RETURNING id',[cid,id]);if(!result.rowCount)fail('NOT_FOUND',404);}
   else{
    const email=login(data.login),reason=text(data.reason,1,300),hours=data.hours,perms=permissions(data.permissions);
    if(typeof hours!=='number'||!Number.isSafeInteger(hours)||hours<1||hours>24||!perms.includes('company.profile.read')||perms.some(code=>!supportCodes.includes(code)))fail('INVALID_PERMISSION');
    const user=(await c.query("SELECT u.id FROM safeer.users u JOIN safeer.platform_user_roles a ON a.user_id=u.id JOIN safeer.roles r ON r.id=a.role_id WHERE u.normalized_login=$1 AND u.active AND r.code='platform_support_administrator' AND r.active",[email])).rows[0];if(!user)fail('INVALID_SUPPORT_USER');
    await c.query("WITH instant AS MATERIALIZED(SELECT clock_timestamp() AS now) INSERT INTO safeer.support_access_grants(id,company_id,support_user_id,approved_by,reason,created_at,expires_at) SELECT $1,$2,$3,$4,$5,now,now+$6*interval '1 hour' FROM instant",[gid,cid,user.id,p.id,reason,hours]);
    for(const perm of perms)await c.query('INSERT INTO safeer.support_access_grant_permissions(company_id,grant_id,permission_code) VALUES($1,$2,$3)',[cid,gid,perm]);
   }
   await this.audit(c,p,cid,id?'support.revoked':'support.granted',gid);return {id:gid};
  },true);
 }
}
