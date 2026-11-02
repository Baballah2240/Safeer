import {Injectable} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {Database} from './database.js';
import {IdentityService,type Principal} from './identity.service.js';
import {body,text,uuid,version,fail} from './security.js';

const code=(value:unknown)=>{const result=text(value,1,40).toUpperCase();if(!/^[A-Z0-9_-]+$/.test(result))fail('INVALID_INPUT');return result;};
const enabled=(value:unknown)=>{if(typeof value!=='boolean')fail('INVALID_INPUT');return value;};
const whole=(value:unknown,min:number,max:number)=>{if(!Number.isInteger(value)||Number(value)<min||Number(value)>max)fail('INVALID_SEAT_LAYOUT');return Number(value);};
const layoutFields='l.id,l.code,l.name_en AS "nameEn",l.name_ar AS "nameAr",l.active,l.version,l.latest_revision AS "latestRevision"';
const busFields='id,code,registration,layout_id AS "layoutId",layout_revision AS "layoutRevision",active,version';
const driverFields='id,employee_code AS "employeeCode",name_en AS "nameEn",name_ar AS "nameAr",phone,member_id AS "memberId",active,version';
type Seat={row:number;column:number;label:string};
function seatMap(data:Record<string,unknown>){
 const rows=whole(data.rows,1,20),columns=whole(data.columns,1,7);
 if(!Array.isArray(data.seats)||data.seats.length<1||data.seats.length>100)fail('INVALID_SEAT_LAYOUT');
 const seats:Seat[]=data.seats.map(value=>{const s=body(value,['row','column','label']);return {row:whole(s.row,1,rows),column:whole(s.column,1,columns),label:text(s.label,1,8)};});
 if(new Set(seats.map(s=>s.row+':'+s.column)).size!==seats.length||new Set(seats.map(s=>s.label.toLowerCase())).size!==seats.length)fail('INVALID_SEAT_LAYOUT');
 return {rows,columns,seats};
}

@Injectable()
export class FleetService {
 constructor(private readonly db:Database,private readonly identity:IdentityService){}
 private async run<T>(token:string,action:(c:PoolClient,p:Principal)=>Promise<T>,write=false){
  return this.db.transaction(async c=>{const p=await this.identity.principal(c,token);await c.query("SELECT set_config('safeer.session_token',$1,true)",[token]);return action(c,p);},write);
 }
 private async access(c:PoolClient,cid:string,kind:'fleet'|'driver',manage=false){
  if(!(await c.query('SELECT 1 FROM safeer.companies WHERE id=$1',[cid])).rowCount)fail('NOT_FOUND',404);
  const permission=kind==='fleet'?'company.fleet.read':'company.drivers.read',{rows}=await c.query(manage?`SELECT safeer.${kind}_manage($1) AS ok`:'SELECT safeer.company_can($1,$2) AS ok',manage?[cid]:[cid,permission]);
  if(!rows[0].ok)fail('FORBIDDEN',403);
 }
 private audit(c:PoolClient,cid:string,p:Principal,action:string,target:string){return c.query('INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),cid,p.id,action,target]);}
 private async insertRevision(c:PoolClient,cid:string,lid:string,revision:number,p:Principal,map:ReturnType<typeof seatMap>){
  await c.query('INSERT INTO safeer.seat_layout_revisions(company_id,layout_id,revision,row_count,column_count,seat_count,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[cid,lid,revision,map.rows,map.columns,map.seats.length,p.id]);
  for(const seat of map.seats)await c.query('INSERT INTO safeer.seat_layout_seats(company_id,layout_id,revision,row_number,column_number,label) VALUES($1,$2,$3,$4,$5,$6)',[cid,lid,revision,seat.row,seat.column,seat.label]);
  await c.query('SET CONSTRAINTS ALL IMMEDIATE');
 }
 async fleet(token:string,cid:string){uuid(cid);return this.run(token,async c=>{
  await this.access(c,cid,'fleet');
  const layouts=(await c.query(`SELECT ${layoutFields},(SELECT COALESCE(json_agg(json_build_object('revision',r.revision,'rows',r.row_count,'columns',r.column_count,'seatCount',r.seat_count) ORDER BY r.revision DESC),'[]') FROM safeer.seat_layout_revisions r WHERE r.company_id=l.company_id AND r.layout_id=l.id) AS revisions FROM safeer.seat_layouts l WHERE l.company_id=$1 ORDER BY l.code,l.id`,[cid])).rows;
  const buses=(await c.query(`SELECT ${busFields} FROM safeer.buses WHERE company_id=$1 ORDER BY code,id`,[cid])).rows;
  const canManage=(await c.query('SELECT safeer.fleet_manage($1) AS ok',[cid])).rows[0].ok;
  return {layouts,buses,canManage};
 });}
 async revision(token:string,cid:string,lid:string,rawRevision:string){uuid(cid);uuid(lid);const revision=Number(rawRevision);if(!Number.isSafeInteger(revision)||revision<1)fail('INVALID_INPUT');return this.run(token,async c=>{
  await this.access(c,cid,'fleet');
  const row=(await c.query('SELECT revision,row_count AS rows,column_count AS columns,seat_count AS "seatCount",created_at AS "createdAt" FROM safeer.seat_layout_revisions WHERE company_id=$1 AND layout_id=$2 AND revision=$3',[cid,lid,revision])).rows[0];if(!row)fail('NOT_FOUND',404);
  const seats=(await c.query('SELECT row_number AS row,column_number AS column,label FROM safeer.seat_layout_seats WHERE company_id=$1 AND layout_id=$2 AND revision=$3 ORDER BY row_number,column_number',[cid,lid,revision])).rows;
  return {...row,seats};
 });}
 async createLayout(token:string,cid:string,input:unknown){
  uuid(cid);const data=body(input,['code','nameEn','nameAr','active','rows','columns','seats','currentPassword']);
  const values=[code(data.code),text(data.nameEn),text(data.nameAr),enabled(data.active)],map=seatMap(data);
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   await this.access(c,cid,'fleet',true);const id=randomUUID();
   await c.query('INSERT INTO safeer.seat_layouts(code,name_en,name_ar,active,company_id,id) VALUES($1,$2,$3,$4,$5,$6)',[...values,cid,id]);
   await this.insertRevision(c,cid,id,1,p,map);await this.audit(c,cid,p,'seat_layout.created',id);return {id,revision:1};
  },true);
 }
 // Name and activation only: geometry and labels change through a new revision.
 async updateLayout(token:string,cid:string,lid:string,input:unknown){
  uuid(cid);uuid(lid);const data=body(input,['nameEn','nameAr','active','version','currentPassword']);
  const values=[text(data.nameEn),text(data.nameAr),enabled(data.active),cid,lid,version(data.version)];
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   await this.access(c,cid,'fleet',true);
   const result=await c.query('UPDATE safeer.seat_layouts SET name_en=$1,name_ar=$2,active=$3,version=version+1 WHERE company_id=$4 AND id=$5 AND version=$6 RETURNING id',values);if(!result.rowCount)fail('STALE_VERSION',409);
   await this.audit(c,cid,p,'seat_layout.updated',lid);return {id:lid};
  },true);
 }
 async revise(token:string,cid:string,lid:string,input:unknown){
  uuid(cid);uuid(lid);const data=body(input,['rows','columns','seats','expectedRevision','currentPassword']);
  const map=seatMap(data),expected=version(data.expectedRevision);
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   await this.access(c,cid,'fleet',true);
   const result=await c.query('UPDATE safeer.seat_layouts SET latest_revision=latest_revision+1 WHERE company_id=$1 AND id=$2 AND latest_revision=$3 RETURNING latest_revision',[cid,lid,expected]);if(!result.rowCount)fail('STALE_VERSION',409);
   const revision=result.rows[0].latest_revision as number;await this.insertRevision(c,cid,lid,revision,p,map);await this.audit(c,cid,p,'seat_layout.revised',lid);return {id:lid,revision};
  },true);
 }
 async saveBus(token:string,cid:string,id:string|undefined,input:unknown){
  uuid(cid);if(id)uuid(id);const data=body(input,['code','registration','layoutId','layoutRevision','active','currentPassword',...(id?['version']:[])]);
  const values=[code(data.code),text(data.registration,1,40),uuid(data.layoutId),version(data.layoutRevision),enabled(data.active)],v=id?version(data.version):1;
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   await this.access(c,cid,'fleet',true);const target=id||randomUUID();
   if(id){const result=await c.query('UPDATE safeer.buses SET code=$1,registration=$2,layout_id=$3,layout_revision=$4,active=$5,version=version+1 WHERE company_id=$6 AND id=$7 AND version=$8 RETURNING id',[...values,cid,id,v]);if(!result.rowCount)fail('STALE_VERSION',409);}
   else await c.query('INSERT INTO safeer.buses(code,registration,layout_id,layout_revision,active,company_id,id) VALUES($1,$2,$3,$4,$5,$6,$7)',[...values,cid,target]);
   await this.audit(c,cid,p,id?'bus.updated':'bus.created',target);return {id:target};
  },true);
 }
 async drivers(token:string,cid:string){uuid(cid);return this.run(token,async c=>{
  await this.access(c,cid,'driver');
  const items=(await c.query(`SELECT ${driverFields} FROM safeer.drivers WHERE company_id=$1 ORDER BY employee_code,id`,[cid])).rows;
  return {items,canManage:(await c.query('SELECT safeer.driver_manage($1) AS ok',[cid])).rows[0].ok};
 });}
 // A linked membership is only an identity reference: it creates no login and grants nothing.
 async saveDriver(token:string,cid:string,id:string|undefined,input:unknown){
  uuid(cid);if(id)uuid(id);const data=body(input,['employeeCode','nameEn','nameAr','phone','memberId','active','currentPassword',...(id?['version']:[])]);
  const phone=data.phone===undefined||data.phone===null||data.phone===''?null:text(data.phone,5,30);if(phone&&!/^[+0-9 ()-]{5,30}$/.test(phone))fail('INVALID_INPUT');
  const memberId=data.memberId===undefined||data.memberId===null||data.memberId===''?null:uuid(data.memberId);
  const values=[code(data.employeeCode),text(data.nameEn),text(data.nameAr),phone,memberId,enabled(data.active)],v=id?version(data.version):1;
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   await this.access(c,cid,'driver',true);const target=id||randomUUID();
   if(id){const result=await c.query('UPDATE safeer.drivers SET employee_code=$1,name_en=$2,name_ar=$3,phone=$4,member_id=$5,active=$6,version=version+1 WHERE company_id=$7 AND id=$8 AND version=$9 RETURNING id',[...values,cid,id,v]);if(!result.rowCount)fail('STALE_VERSION',409);}
   else await c.query('INSERT INTO safeer.drivers(employee_code,name_en,name_ar,phone,member_id,active,company_id,id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[...values,cid,target]);
   await this.audit(c,cid,p,id?'driver.updated':'driver.created',target);return {id:target};
  },true);
 }
}
