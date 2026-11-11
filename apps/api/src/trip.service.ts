import {Injectable} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {Database} from './database.js';
import {IdentityService,type Principal} from './identity.service.js';
import {body,text,uuid,version,fail} from './security.js';

const day=(value:unknown)=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)fail('INVALID_INPUT');return value;};
const clock=(value:unknown)=>{if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))fail('INVALID_INPUT');return value;};
const fare=(value:unknown)=>{if(!Number.isSafeInteger(value)||Number(value)<0||Number(value)>100000000)fail('INVALID_INPUT');return Number(value);};
const offsets=(value:unknown)=>{
 if(!Array.isArray(value)||value.length<2||value.length>30)fail('INVALID_TRIP_STOPS');
 value.forEach((minutes,i)=>{if(!Number.isInteger(minutes)||minutes<0||minutes>10080||(i===0&&minutes!==0)||(i>0&&minutes<=value[i-1]))fail('INVALID_TRIP_STOPS');});
 return value as number[];
};
const tripFields=`t.id,t.route_id AS "routeId",t.route_version AS "routeVersion",t.route_code AS "routeCode",t.route_name_en AS "routeNameEn",t.route_name_ar AS "routeNameAr",t.status,t.timezone,t.departure_at AS "departureAt",t.arrival_at AS "arrivalAt",to_char(t.departure_at AT TIME ZONE t.timezone,'YYYY-MM-DD') AS date,to_char(t.departure_at AT TIME ZONE t.timezone,'HH24:MI') AS time,t.fare_minor AS "fareMinor",t.currency,t.cancel_reason AS "cancelReason",t.published_at AS "publishedAt",t.canceled_at AS "canceledAt",t.version`;
const assignmentFields='id,bus_id AS "busId",driver_id AS "driverId",layout_id AS "layoutId",layout_revision AS "layoutRevision",seat_count AS "seatCount",bus_code AS "busCode",bus_registration AS "busRegistration",driver_name_en AS "driverNameEn",driver_name_ar AS "driverNameAr",assigned_at AS "assignedAt",replaced_at AS "replacedAt",replaced_reason AS "replacedReason"';

@Injectable()
export class TripService {
 constructor(private readonly db:Database,private readonly identity:IdentityService){}
 private async run<T>(token:string,action:(c:PoolClient,p:Principal)=>Promise<T>,write=false){
  return this.db.transaction(async c=>{const p=await this.identity.principal(c,token);await c.query("SELECT set_config('safeer.session_token',$1,true)",[token]);return action(c,p);},write);
 }
 private async access(c:PoolClient,cid:string,manage=false){
  if(!(await c.query('SELECT 1 FROM safeer.companies WHERE id=$1',[cid])).rowCount)fail('NOT_FOUND',404);
  const {rows}=await c.query(manage?'SELECT safeer.trip_manage($1) AS ok':"SELECT safeer.company_can($1,'company.trips.read') AS ok",[cid]);
  if(!rows[0].ok)fail('FORBIDDEN',403);
 }
 private audit(c:PoolClient,cid:string,p:Principal,action:string,target:string){return c.query('INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),cid,p.id,action,target]);}
 // D72: the list holds at most 200 trips from the chosen day; "more" tells staff to pick a later day
 // instead of silently hiding departures they still need to manage.
 async trips(token:string,cid:string,rawFrom?:string){uuid(cid);const from=rawFrom===undefined||rawFrom===''?null:day(rawFrom);return this.run(token,async c=>{
  await this.access(c,cid);
  const rows=(await c.query(`SELECT ${tripFields},(SELECT row_to_json(a) FROM (SELECT ${assignmentFields} FROM safeer.trip_assignments x WHERE x.company_id=t.company_id AND x.trip_id=t.id AND x.replaced_at IS NULL) a) AS assignment FROM safeer.trips t WHERE t.company_id=$1 AND t.arrival_at>=COALESCE(($2::date)::timestamp AT TIME ZONE t.timezone,clock_timestamp()-interval '1 day') ORDER BY t.departure_at,t.id LIMIT 201`,[cid,from])).rows;
  return {items:rows.slice(0,200),more:rows.length>200,from,canManage:(await c.query('SELECT safeer.trip_manage($1) AS ok',[cid])).rows[0].ok};
 });}
 async detail(token:string,cid:string,id:string){uuid(cid);uuid(id);return this.run(token,async c=>{
  await this.access(c,cid);const trip=(await c.query(`SELECT ${tripFields} FROM safeer.trips t WHERE t.company_id=$1 AND t.id=$2`,[cid,id])).rows[0];if(!trip)fail('NOT_FOUND',404);
  const stops=(await c.query('SELECT stop_index AS "stopIndex",offset_minutes AS "offsetMinutes",city_id AS "cityId",station_id AS "stationId",city_name_en AS "cityNameEn",city_name_ar AS "cityNameAr",station_name_en AS "stationNameEn",station_name_ar AS "stationNameAr" FROM safeer.trip_stops WHERE company_id=$1 AND trip_id=$2 ORDER BY stop_index',[cid,id])).rows;
  const assignments=(await c.query(`SELECT ${assignmentFields} FROM safeer.trip_assignments WHERE company_id=$1 AND trip_id=$2 ORDER BY assigned_at DESC,id`,[cid,id])).rows;
  return {trip,stops,assignments};
 });}
 // Repeating dates save together or not at all.
 async create(token:string,cid:string,input:unknown){
  uuid(cid);const data=body(input,['routeId','dates','time','offsets','fareMinor','currency','currentPassword']);
  const routeId=uuid(data.routeId),time=clock(data.time),minutes=offsets(data.offsets),amount=fare(data.fareMinor),currency=text(data.currency??'SDG',3,3).toUpperCase();
  if(!/^[A-Z]{3}$/.test(currency)||!Array.isArray(data.dates)||data.dates.length<1||data.dates.length>31)fail('INVALID_INPUT');
  const dates=data.dates.map(day);if(new Set(dates).size!==dates.length)fail('INVALID_INPUT');
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   await this.access(c,cid,true);
   const zone=(await c.query('SELECT timezone FROM safeer.company_settings WHERE company_id=$1',[cid])).rows[0]?.timezone;if(!zone)fail('NOT_FOUND',404);
   const count=(await c.query('SELECT count(*)::int AS n FROM safeer.route_stops WHERE company_id=$1 AND route_id=$2',[cid,routeId])).rows[0].n;
   if(count&&count!==minutes.length)fail('INVALID_TRIP_STOPS');
   const ids:string[]=[];
   for(const date of dates){
    const id=randomUUID();
    await c.query(`INSERT INTO safeer.trips(id,company_id,route_id,route_version,route_code,route_name_en,route_name_ar,stop_count,timezone,departure_at,arrival_at,fare_minor,currency,created_by) SELECT $1,$2,$3,0,'','','',2,$4,d,d+make_interval(mins=>$5::int),$6,$7,$8 FROM (SELECT ($9::date+$10::time) AT TIME ZONE $4::text AS d) x`,[id,cid,routeId,zone,minutes.at(-1),amount,currency,p.id,date,time]);
    for(const [index,value] of minutes.entries())await c.query("INSERT INTO safeer.trip_stops(company_id,trip_id,stop_index,offset_minutes,city_id,city_name_en,city_name_ar) SELECT $1,$2,$3,$4,s.city_id,'','' FROM safeer.route_stops s WHERE s.company_id=$1 AND s.route_id=$5 AND s.stop_index=$3",[cid,id,index,value,routeId]);
    await this.audit(c,cid,p,'trip.created',id);ids.push(id);
   }
   await c.query('SET CONSTRAINTS ALL IMMEDIATE');return {ids};
  },true);
 }
 async update(token:string,cid:string,id:string,input:unknown){
  uuid(cid);uuid(id);const data=body(input,['date','time','offsets','fareMinor','version','currentPassword']);
  const date=day(data.date),time=clock(data.time),minutes=offsets(data.offsets),amount=fare(data.fareMinor),v=version(data.version);
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   await this.access(c,cid,true);
   const result=await c.query(`UPDATE safeer.trips t SET departure_at=($1::date+$2::time) AT TIME ZONE t.timezone,arrival_at=(($1::date+$2::time) AT TIME ZONE t.timezone)+make_interval(mins=>$3::int),fare_minor=$4,version=version+1 WHERE t.company_id=$5 AND t.id=$6 AND t.version=$7 RETURNING t.id`,[date,time,minutes.at(-1),amount,cid,id,v]);
   if(!result.rowCount)fail('STALE_VERSION',409);
   for(const [index,value] of minutes.entries()){const stop=await c.query('UPDATE safeer.trip_stops SET offset_minutes=$1 WHERE company_id=$2 AND trip_id=$3 AND stop_index=$4',[value,cid,id,index]);if(!stop.rowCount)fail('INVALID_TRIP_STOPS');}
   await c.query('SET CONSTRAINTS ALL IMMEDIATE');await this.audit(c,cid,p,'trip.updated',id);return {id};
  },true);
 }
 // Replacing a bus or driver closes the previous assignment with a reason, so its history survives.
 async assign(token:string,cid:string,id:string,input:unknown){
  uuid(cid);uuid(id);const data=body(input,['busId','driverId','reason','version','currentPassword']);
  const busId=uuid(data.busId),driverId=uuid(data.driverId),reason=data.reason===undefined||data.reason===null||data.reason===''?null:text(data.reason,1,300),v=version(data.version);
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   await this.access(c,cid,true);
   const trip=await c.query('UPDATE safeer.trips SET version=version+1 WHERE company_id=$1 AND id=$2 AND version=$3 RETURNING id',[cid,id,v]);if(!trip.rowCount)fail('STALE_VERSION',409);
   const current=await c.query('SELECT id FROM safeer.trip_assignments WHERE company_id=$1 AND trip_id=$2 AND replaced_at IS NULL',[cid,id]);
   if(current.rowCount){if(!reason)fail('REASON_REQUIRED');await c.query('UPDATE safeer.trip_assignments SET replaced_at=clock_timestamp(),replaced_reason=$1 WHERE id=$2',[reason,current.rows[0].id]);}
   await c.query("INSERT INTO safeer.trip_assignments(id,company_id,trip_id,bus_id,driver_id,layout_id,layout_revision,seat_count,bus_code,bus_registration,driver_name_en,driver_name_ar,assigned_by) SELECT $1,$2,$3,$4,$5,b.layout_id,b.layout_revision,0,'','','','',$6 FROM safeer.buses b WHERE b.company_id=$2 AND b.id=$4",[randomUUID(),cid,id,busId,driverId,p.id]).then(result=>{if(!result.rowCount)fail('INVALID_RESOURCE_SCOPE');});
   await this.audit(c,cid,p,current.rowCount?'trip.reassigned':'trip.assigned',id);return {id};
  },true);
 }
 async publish(token:string,cid:string,id:string,input:unknown){
  uuid(cid);uuid(id);const data=body(input,['version','currentPassword']),v=version(data.version);
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   await this.access(c,cid,true);
   const result=await c.query("UPDATE safeer.trips SET status='published',published_at=clock_timestamp(),version=version+1 WHERE company_id=$1 AND id=$2 AND version=$3 RETURNING id",[cid,id,v]);if(!result.rowCount)fail('STALE_VERSION',409);
   await this.audit(c,cid,p,'trip.published',id);return {id};
  },true);
 }
 async cancel(token:string,cid:string,id:string,input:unknown){
  uuid(cid);uuid(id);const data=body(input,['reason','version','currentPassword']),reason=text(data.reason,1,300),v=version(data.version);
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   await this.access(c,cid,true);
   const result=await c.query("UPDATE safeer.trips SET status='canceled',cancel_reason=$1,canceled_at=clock_timestamp(),version=version+1 WHERE company_id=$2 AND id=$3 AND version=$4 RETURNING id",[reason,cid,id,v]);if(!result.rowCount)fail('STALE_VERSION',409);
   await this.audit(c,cid,p,'trip.canceled',id);return {id};
  },true);
 }
}
