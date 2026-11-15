import {Injectable} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {Database} from './database.js';
import {IdentityService,type Principal} from './identity.service.js';
import {body,text,uuid,version,fail,stopIndex} from './security.js';

const code=(value:unknown)=>{const result=text(value,1,40).toUpperCase();if(!/^[A-Z0-9_-]+$/.test(result))fail('INVALID_INPUT');return result;};
const enabled=(value:unknown)=>{if(typeof value!=='boolean')fail('INVALID_INPUT');return value;};
const cityFields='id,code,name_en AS "nameEn",name_ar AS "nameAr",country_code AS "countryCode",active,version';
const routeFields='r.id,r.code,r.name_en AS "nameEn",r.name_ar AS "nameAr",r.origin_city_id AS "originCityId",r.destination_city_id AS "destinationCityId",r.active,r.version';
type Stop={cityId:string;stationId:string|null};

@Injectable()
export class RouteService {
 constructor(private readonly db:Database,private readonly identity:IdentityService){}
 private async run<T>(token:string,action:(c:PoolClient,p:Principal)=>Promise<T>,write=false){
  return this.db.transaction(async c=>{const p=await this.identity.principal(c,token);await c.query("SELECT set_config('safeer.session_token',$1,true)",[token]);return action(c,p);},write);
 }
 private async access(c:PoolClient,cid:string,manage=false){
  if(!(await c.query('SELECT 1 FROM safeer.companies WHERE id=$1',[cid])).rowCount)fail('NOT_FOUND',404);
  const {rows}=await c.query(manage?'SELECT safeer.route_manage($1) AS ok':"SELECT safeer.company_can($1,'company.routes.read') AS ok",[cid]);
  if(!rows[0].ok)fail('FORBIDDEN',403);
 }
 async cities(token:string){return this.run(token,async(c,p)=>({items:(await c.query(`SELECT ${cityFields} FROM safeer.cities ORDER BY name_en,id`)).rows,canManage:p.superAdministrator}));}
 async city(token:string,id:string|undefined,input:unknown){
  if(id)uuid(id);const data=body(input,['code','nameEn','nameAr','countryCode','active','currentPassword',...(id?['version']:[])]);
  const values=[code(data.code),text(data.nameEn),text(data.nameAr),text(data.countryCode,2,2).toUpperCase(),enabled(data.active)];
  if(!/^[A-Z]{2}$/.test(String(values[3])))fail('INVALID_INPUT');const v=id?version(data.version):1;
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   if(!p.superAdministrator)fail('FORBIDDEN',403);const target=id||randomUUID();
   if(id){const result=await c.query('UPDATE safeer.cities SET code=$1,name_en=$2,name_ar=$3,country_code=$4,active=$5,version=version+1 WHERE id=$6 AND version=$7 RETURNING id',[...values,id,v]);if(!result.rowCount)fail('STALE_VERSION',409);}
   else await c.query('INSERT INTO safeer.cities(code,name_en,name_ar,country_code,active,id) VALUES($1,$2,$3,$4,$5,$6)',[...values,target]);
   await c.query('INSERT INTO safeer.identity_audit(id,actor_id,action,target_id) VALUES($1,$2,$3,$4)',[randomUUID(),p.id,id?'catalog.city.updated':'catalog.city.created',target]);return {id:target};
  },true);
 }
 async routes(token:string,cid:string){uuid(cid);return this.run(token,async(c)=>{
  await this.access(c,cid);
  const items=(await c.query(`SELECT ${routeFields},(SELECT count(*)::int FROM safeer.route_stops s WHERE s.company_id=r.company_id AND s.route_id=r.id) AS "stopCount" FROM safeer.routes r WHERE company_id=$1 ORDER BY code,id`,[cid])).rows;
  const canManage=(await c.query('SELECT safeer.route_manage($1) AS ok',[cid])).rows[0].ok;
  await this.access(c,cid);return {items,canManage};
 });}
 async detail(token:string,cid:string,id:string){uuid(cid);uuid(id);return this.run(token,async(c)=>{
  await this.access(c,cid);const route=(await c.query(`SELECT ${routeFields} FROM safeer.routes r WHERE company_id=$1 AND id=$2`,[cid,id])).rows[0];if(!route)fail('NOT_FOUND',404);
  const stops=(await c.query('SELECT stop_index AS "stopIndex",city_id AS "cityId",station_id AS "stationId" FROM safeer.route_stops WHERE company_id=$1 AND route_id=$2 ORDER BY stop_index',[cid,id])).rows;
  await this.access(c,cid);return {route,stops};
 });}
 // D89: the price list for journeys between stops (the whole route keeps each trip's own fare).
 async fares(token:string,cid:string,id:string){uuid(cid);uuid(id);return this.run(token,async c=>{
  await this.access(c,cid);if(!(await c.query('SELECT 1 FROM safeer.routes WHERE company_id=$1 AND id=$2',[cid,id])).rowCount)fail('NOT_FOUND',404);
  const stops=(await c.query('SELECT s.stop_index AS "index",ci.name_en AS "cityNameEn",ci.name_ar AS "cityNameAr",st.name_en AS "stationNameEn",st.name_ar AS "stationNameAr" FROM safeer.route_stops s JOIN safeer.cities ci ON ci.id=s.city_id LEFT JOIN safeer.stations st ON st.company_id=s.company_id AND st.id=s.station_id WHERE s.company_id=$1 AND s.route_id=$2 ORDER BY s.stop_index',[cid,id])).rows;
  const fares=(await c.query('SELECT from_index AS "from",to_index AS "to",fare_minor AS "fareMinor" FROM safeer.route_fares WHERE company_id=$1 AND route_id=$2 ORDER BY from_index,to_index',[cid,id])).rows;
  const canManage=Boolean((await c.query('SELECT safeer.route_manage($1) AS ok',[cid])).rows[0].ok);
  return {stops,fares,canManage};
 });}
 async saveFares(token:string,cid:string,id:string,input:unknown){
  uuid(cid);uuid(id);const data=body(input,['fares','currentPassword']);
  if(!Array.isArray(data.fares)||data.fares.length>435)fail('INVALID_FARES');
  const fares=data.fares.map(value=>{const x=body(value,['from','to','fareMinor']),from=stopIndex(x.from),to=stopIndex(x.to),fare=x.fareMinor;
   if(from===null||to===null||from>=to||typeof fare!=='number'||!Number.isSafeInteger(fare)||fare<1||fare>100000000)fail('INVALID_FARES');return {from,to,fare};});
  if(new Set(fares.map(f=>f.from+':'+f.to)).size!==fares.length)fail('INVALID_FARES');
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   await this.access(c,cid,true);
   const count=(await c.query('SELECT count(*)::int AS n FROM safeer.route_stops WHERE company_id=$1 AND route_id=$2',[cid,id])).rows[0].n as number;
   if(!count)fail('NOT_FOUND',404);if(fares.some(f=>f.to>count-1))fail('INVALID_FARES');
   // Lock the route so two saves of the same price list cannot interleave.
   await c.query('SELECT 1 FROM safeer.routes WHERE company_id=$1 AND id=$2 FOR UPDATE',[cid,id]);
   await c.query('DELETE FROM safeer.route_fares WHERE company_id=$1 AND route_id=$2',[cid,id]);
   for(const f of fares)await c.query('INSERT INTO safeer.route_fares(company_id,route_id,from_index,to_index,fare_minor) VALUES($1,$2,$3,$4,$5)',[cid,id,f.from,f.to,f.fare]);
   await c.query('INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),cid,p.id,'route.fares_saved',id]);
   return {id,count:fares.length};
  },true);
 }
 async save(token:string,cid:string,id:string|undefined,input:unknown){
  uuid(cid);if(id)uuid(id);const data=body(input,['code','nameEn','nameAr','active','stops','currentPassword',...(id?['version']:[])]);
  const routeCode=code(data.code),nameEn=text(data.nameEn),nameAr=text(data.nameAr),active=enabled(data.active),v=id?version(data.version):1;
  if(!Array.isArray(data.stops)||data.stops.length<2||data.stops.length>30)fail('INVALID_ROUTE_STOPS');
  const stops:Stop[]=data.stops.map(value=>{const s=body(value,['cityId','stationId']);return {cityId:uuid(s.cityId),stationId:s.stationId===undefined||s.stationId===null?null:uuid(s.stationId)};});
  if(stops[0].cityId===stops.at(-1)!.cityId||new Set(stops.map(s=>s.cityId+':'+s.stationId)).size!==stops.length)fail('INVALID_ROUTE_STOPS');
  await this.identity.reauthenticate(token,data.currentPassword);
  return this.run(token,async(c,p)=>{
   await this.access(c,cid,true);
   // A stop's station must be in that stop's city; report it clearly instead of failing on the foreign key.
   for(const stop of stops)if(stop.stationId&&!(await c.query('SELECT 1 FROM safeer.stations WHERE company_id=$1 AND id=$2 AND city_id=$3',[cid,stop.stationId,stop.cityId])).rowCount)fail('ROUTE_STATION_CITY');
   const target=id||randomUUID(),values=[routeCode,nameEn,nameAr,stops[0].cityId,stops.at(-1)!.cityId,active,cid,target];
   if(id){const result=await c.query('UPDATE safeer.routes SET code=$1,name_en=$2,name_ar=$3,origin_city_id=$4,destination_city_id=$5,active=$6,version=version+1 WHERE company_id=$7 AND id=$8 AND version=$9 RETURNING id',[...values,v]);if(!result.rowCount)fail('STALE_VERSION',409);
    const old=(await c.query('SELECT city_id AS "cityId",station_id AS "stationId" FROM safeer.route_stops WHERE company_id=$1 AND route_id=$2 ORDER BY stop_index',[cid,id])).rows as Stop[];
    if(JSON.stringify(old)!==JSON.stringify(stops))await c.query('DELETE FROM safeer.route_fares WHERE company_id=$1 AND route_id=$2',[cid,id]);
    await c.query('DELETE FROM safeer.route_stops WHERE company_id=$1 AND route_id=$2',[cid,id]);}
   else await c.query('INSERT INTO safeer.routes(code,name_en,name_ar,origin_city_id,destination_city_id,active,company_id,id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',values);
   for(const [index,stop] of stops.entries())await c.query('INSERT INTO safeer.route_stops(company_id,route_id,stop_index,city_id,station_id) VALUES($1,$2,$3,$4,$5)',[cid,target,index,stop.cityId,stop.stationId]);
   await c.query('SET CONSTRAINTS ALL IMMEDIATE');
   await c.query('INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),cid,p.id,id?'route.updated':'route.created',target]);return {id:target};
  },true);
 }
}
