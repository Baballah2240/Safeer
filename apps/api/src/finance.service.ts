import {Injectable} from '@nestjs/common';
import {Database} from './database.js';
import {IdentityService} from './identity.service.js';
import {body,text,uuid,fail} from './security.js';
import type {PoolClient} from 'pg';

const date=(value:unknown)=>{const s=text(value,10,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||s.startsWith('0000')||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)fail('INVALID_REPORT');return s;};
const page=(value:unknown)=>{if(value===undefined)return 0;const n=String(value);if(!/^\d{1,7}$/.test(n)||Number(n)>1000000)fail('INVALID_REPORT');return Number(n);};
const optionalId=(value:unknown)=>value===undefined||value===''?null:uuid(value);
const snapshot=(value:unknown)=>{if(value===undefined||value==='')return null;const s=text(value,20,35);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(s)||!Number.isFinite(Date.parse(s)))fail('INVALID_REPORT');return s;};
// Quote every cell and neutralize spreadsheet formulas in arbitrary labels. Numeric minor
// amounts are validated separately so a legitimate negative amount remains numeric.
export function financeCsv(rows:Record<string,unknown>[]){
 const headers=['Document','Kind','Posted at','Method','Currency','Amount minor','Employee','Station English','Station Arabic','Trip English','Trip Arabic','Tickets'];
 const cell=(value:unknown,numeric=false)=>{let s=String(value??'');if(numeric){if(!/^-?\d+$/.test(s))throw Error('Invalid numeric export');}else if(/^[\s\u0000-\u001f]*[=+\-@]|^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return [headers.map(x=>cell(x)).join(','),...rows.map(r=>[r.document,r.kind,r.at,r.method,r.currency,r.kind==='refund'?'-'+r.amountMinor:r.amountMinor,r.employee,r.stationEn,r.stationAr,r.routeEn,r.routeAr,r.tickets].map((x,i)=>cell(x,i===5||i===11)).join(','))].join('\r\n')+'\r\n';
}
@Injectable()
export class FinanceService {
 constructor(private readonly db:Database,private readonly identity:IdentityService){}
 private run<T>(token:string,cid:string,action:(c:PoolClient)=>Promise<T>){uuid(cid);return this.db.transaction(async c=>{
  await this.identity.principal(c,token);await c.query("SELECT set_config('safeer.session_token',$1,true)",[token]);return action(c);
 });}
 options(token:string,cid:string){return this.run(token,cid,async c=>(await c.query('SELECT safeer.finance_options($1) AS row',[cid])).rows[0].row);}
 report(token:string,cid:string,input:unknown,exporting=false){
  const d=body(input,['from','to','stationId','employeeId','method','page','sessionPage','asOf']),from=date(d.from),to=date(d.to);
  const days=(Date.parse(to)-Date.parse(from))/86400000;if(days<0||days>30)fail('INVALID_REPORT');
  const method=d.method===undefined||d.method===''?null:text(d.method,1,20);if(method&&!['cash','bank_transfer','mobile_wallet'].includes(method))fail('INVALID_REPORT');
  const values=[cid,from,to,optionalId(d.stationId),optionalId(d.employeeId),method,page(d.page),page(d.sessionPage),snapshot(d.asOf),exporting];
  return this.run(token,cid,async c=>{
   const result=(await c.query('SELECT safeer.finance_report($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS row',values)).rows[0].row;
   if(exporting&&result.movementCount>10000)fail('EXPORT_LIMIT',409);
   // Finance permission itself can be scoped; do not require a separate profile permission
   // just to record this read. The fixed helper below supplies the audit's valid scope.
   await c.query('SELECT safeer.finance_audit($1,$2)',[cid,exporting?'finance.exported':'finance.reported']);
   return exporting?{csv:financeCsv(result.movements),filename:`safeer-finance-${from}-${to}.csv`,count:result.movementCount,asOf:result.asOf}:result;
  });
 }
}
