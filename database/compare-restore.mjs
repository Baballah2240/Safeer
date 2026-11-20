// D128: proves a hosted backup can be restored. Restore a Render backup into a NEW database (Render dashboard:
// safeer-db > Recovery > Restore), then run, with both external connection URLs:
//   SAFEER_SOURCE_DATABASE_URL=... SAFEER_RESTORED_DATABASE_URL=... npm run backup:compare
// Both connections are read-only (every statement runs in a read-only transaction); nothing is changed or
// copied. It prints, per table, the row count in the live and the restored database. The restored copy is
// from an earlier moment, so it may have fewer rows, but every table must exist and hold data where the live
// one does. Exit code 1 when the restored database is missing tables or is empty where the live one is not.
import pg from 'pg';

const source=process.env.SAFEER_SOURCE_DATABASE_URL,restored=process.env.SAFEER_RESTORED_DATABASE_URL;
if(!source||!restored)throw Error('Set SAFEER_SOURCE_DATABASE_URL (live) and SAFEER_RESTORED_DATABASE_URL (restored copy).');
if(source===restored)throw Error('The two URLs are the same database. Point SAFEER_RESTORED_DATABASE_URL at the restored copy.');

async function census(url){
 const client=new pg.Client({connectionString:url,ssl:/sslmode=disable|localhost|127\.0\.0\.1/.test(url)?false:{rejectUnauthorized:false},statement_timeout:60000});
 await client.connect();
 try{
  await client.query('BEGIN READ ONLY');
  const {rows:tables}=await client.query(`SELECT table_schema AS s,table_name AS t FROM information_schema.tables
   WHERE table_type='BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema') ORDER BY 1,2`);
  const counts=new Map();
  for(const {s,t} of tables){
   const {rows}=await client.query(`SELECT count(*)::bigint AS n FROM ${client.escapeIdentifier(s)}.${client.escapeIdentifier(t)}`);
   counts.set(`${s}.${t}`,Number(rows[0].n));
  }
  await client.query('ROLLBACK');
  return counts;
 }finally{await client.end();}
}

const [live,copy]=await Promise.all([census(source),census(restored)]);
let problems=0;
const width=Math.max(...[...live.keys()].map(k=>k.length),10);
console.log(`${'table'.padEnd(width)}  ${'live'.padStart(9)}  ${'restored'.padStart(9)}`);
for(const [table,n] of live){
 const r=copy.get(table);
 const bad=r===undefined||(n>0&&r===0);
 if(bad)problems++;
 console.log(`${table.padEnd(width)}  ${String(n).padStart(9)}  ${String(r??'MISSING').padStart(9)}${bad?'  <- problem':''}`);
}
const liveRows=[...live.values()].reduce((a,b)=>a+b,0),copyRows=[...copy.values()].reduce((a,b)=>a+b,0);
console.log(`\n${live.size} tables, ${liveRows} rows live; ${copy.size} tables, ${copyRows} rows restored.`);
console.log(problems?`FAIL: ${problems} table(s) missing or empty in the restored copy.`:'PASS: the restored backup has every table and its data. Delete the restored database in Render when done.');
process.exit(problems?1:0);
