import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID, createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {databaseConfig, readMigrations, migrationStatus, runMigrations} from '../database/migrate.mjs';
import {hashPassword} from '../dist/api/security.js';

if (!process.env.SAFEER_TEST_DATABASE_URL) throw Error('Set SAFEER_TEST_DATABASE_URL for a disposable local PostgreSQL instance; no tests are skipped.');
const config = databaseConfig(process.env.SAFEER_TEST_DATABASE_URL);
const migrations = await readMigrations();

test('Section 14 upgrades thirteen migrations without changing identities, companies, role grants or financial history',async()=>fixture(async client=>{
 await runMigrations(client,migrations.slice(0,13));
 const uid=randomUUID();await client.query('INSERT INTO safeer.users(id,normalized_login,display_name,password_hash,must_change_password) VALUES($1,$2,$3,$4,false)',[uid,'platform-upgrade@safeer.local','Fictional Existing Owner',await hashPassword(randomUUID()+randomUUID())]);
 await client.query("INSERT INTO safeer.companies(id,slug,name_en,name_ar,status) VALUES($1,'platform-upgrade','Fictional Existing','Fictional Existing','archived')",[randomUUID()]);
 const tables=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='safeer' ORDER BY tablename")).rows.map(x=>x.tablename);
 const snapshot=async()=>{const result={};for(const t of tables)result[t]=(await client.query(`SELECT to_jsonb(x) AS row FROM safeer.${t} x ORDER BY to_jsonb(x)::text`)).rows;return result;};
 const before=await snapshot();await runMigrations(client,migrations);
 // D59 adds only shipment permissions to the template roles (and bumps those roles' versions).
 const shipment=x=>String(x.row.code??x.row.permission_code??'').startsWith('company.shipments.');
 const after=await snapshot();after.permissions=after.permissions.filter(x=>!shipment(x));after.role_permissions=after.role_permissions.filter(x=>!shipment(x));
 const unversioned=rows=>rows.map(x=>({...x.row,version:undefined})).sort((p,q)=>p.id<q.id?-1:1);
 assert.deepEqual(unversioned(after.roles),unversioned(before.roles));after.roles=before.roles;
 assert.deepEqual(after,before);
 assert.equal((await client.query('SELECT count(*)::integer n FROM safeer.notification_events')).rows[0].n,0,'No historical alerts are backfilled.');
 assert.equal((await client.query('SELECT notice_enabled FROM safeer.platform_settings')).rows[0].notice_enabled,false);
}));

test('Section 03 upgrades an existing identity database without changing users, credentials or sessions',async()=>fixture(async client=>{
  await runMigrations(client,migrations.slice(0,2));
  const id=randomUUID(),sid=randomUUID(),encoded=await hashPassword(randomUUID()+randomUUID()),tokenHash=createHash('sha256').update(randomUUID()).digest('hex');
  await client.query('INSERT INTO safeer.users(id,normalized_login,display_name,password_hash,must_change_password) VALUES($1,$2,$3,$4,false)',[id,'upgrade-fixture@safeer.local','Fictional Existing Owner',encoded]);
  await client.query("INSERT INTO safeer.platform_user_roles(user_id,role_id,assigned_by) VALUES($1,'00000000-0000-4000-8000-000000000001',$1)",[id]);
  await client.query("INSERT INTO safeer.sessions(id,user_id,token_hash,credential_version,expires_at) VALUES($1,$2,$3,1,clock_timestamp()+interval '1 hour')",[sid,id,tokenHash]);
  const before=(await client.query('SELECT row_to_json(u) AS record FROM safeer.users u WHERE id=$1',[id])).rows[0].record;
  await runMigrations(client,migrations);
  assert.deepEqual((await client.query('SELECT row_to_json(u) AS record FROM safeer.users u WHERE id=$1',[id])).rows[0].record,before);
  assert.equal((await client.query('SELECT token_hash FROM safeer.sessions WHERE id=$1',[sid])).rows[0].token_hash,tokenHash);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM safeer.companies')).rows[0].n,0);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM safeer.platform_user_roles WHERE user_id=$1',[id])).rows[0].n,1);
}));

async function fixture(action) {
  const admin = new pg.Client(config), name = 'safeer_s01_' + randomUUID().replaceAll('-', '');
  await admin.connect();
  const url = new URL(config.connectionString); url.pathname = '/' + name;
  let client;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    client = new pg.Client(databaseConfig(url.href)); await client.connect();
    await action(client, url.href);
  } finally {
    await client?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  }
}

test('Section 05 preserves existing companies, routes and role copies, and grants existing roles nothing',async()=>fixture(async client=>{
 await runMigrations(client,migrations.slice(0,4));
 const [user,cid,bid,sid,role,member,assignment,city,other,route]=Array.from({length:10},()=>randomUUID());
 await client.query('BEGIN');
 try{
  await client.query('INSERT INTO safeer.users(id,normalized_login,display_name,password_hash,must_change_password) VALUES($1,$2,$3,$4,false)',[user,'fleet-upgrade@safeer.local','Fictional Upgrade Owner',await hashPassword(randomUUID()+randomUUID())]);
  await client.query("INSERT INTO safeer.companies(id,slug,name_en,name_ar,status) VALUES($1,'fleet-upgrade','Fictional Company','Fictional Company','approved')",[cid]);
  await client.query('INSERT INTO safeer.company_settings(company_id) VALUES($1)',[cid]);
  await client.query("INSERT INTO safeer.cities(id,code,name_en,name_ar) VALUES($1,'UP_A','Fictional A','Fictional A'),($2,'UP_B','Fictional B','Fictional B')",[city,other]);
  await client.query("INSERT INTO safeer.branches(id,company_id,code,name_en,name_ar) VALUES($1,$2,'MAIN','Fictional Branch','Fictional Branch')",[bid,cid]);
  await client.query("INSERT INTO safeer.stations(id,company_id,branch_id,code,name_en,name_ar,city_id) VALUES($1,$2,$3,'MAIN','Fictional Station','Fictional Station',$4)",[sid,cid,bid,city]);
  await client.query("INSERT INTO safeer.company_roles(id,company_id,code,display_name,scope) VALUES($1,$2,'company_administrator','Existing Custom Name','company')",[role,cid]);
  await client.query("INSERT INTO safeer.company_role_permissions(company_id,role_id,permission_code) SELECT $1,$2,p.permission_code FROM safeer.role_permissions p JOIN safeer.roles r ON r.id=p.role_id WHERE r.code='company_administrator'",[cid,role]);
  await client.query("INSERT INTO safeer.company_users(id,company_id,user_id,display_name) VALUES($1,$2,$3,'Existing Local Name')",[member,cid,user]);
  await client.query("INSERT INTO safeer.company_user_roles(id,company_id,member_id,role_id,scope) VALUES($1,$2,$3,$4,'company')",[assignment,cid,member,role]);
  await client.query("INSERT INTO safeer.routes(id,company_id,code,name_en,name_ar,origin_city_id,destination_city_id) VALUES($1,$2,'KEEP','Fictional Route','Fictional Route',$3,$4)",[route,cid,city,other]);
  await client.query('INSERT INTO safeer.route_stops(company_id,route_id,stop_index,city_id,station_id) VALUES($1,$2,0,$3,$4),($1,$2,1,$5,NULL)',[cid,route,city,sid,other]);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}
 const snapshot=async()=>JSON.stringify((await client.query(`SELECT (SELECT json_agg(u) FROM (SELECT id,password_hash,version FROM safeer.users ORDER BY id) u) AS users,(SELECT json_agg(r) FROM (SELECT * FROM safeer.routes ORDER BY id) r) AS routes,(SELECT json_agg(s) FROM (SELECT * FROM safeer.route_stops ORDER BY route_id,stop_index) s) AS stops,(SELECT json_agg(p ORDER BY p.permission_code) FROM safeer.company_role_permissions p) AS copies,(SELECT json_agg(s) FROM (SELECT * FROM safeer.stations ORDER BY id) s) AS stations`)).rows[0]);
 const before=await snapshot();await runMigrations(client,migrations);assert.equal(await snapshot(),before,'Migration 0005 changes no existing record.');
 assert.equal((await client.query("SELECT count(*)::int AS n FROM safeer.company_role_permissions WHERE company_id=$1 AND permission_code LIKE 'company.fleet%' OR permission_code LIKE 'company.drivers%'",[cid])).rows[0].n,0,'Existing role copies gain no fleet or driver access.');
 assert.equal((await client.query("SELECT count(*)::int AS n FROM safeer.role_permissions p JOIN safeer.roles r ON r.id=p.role_id WHERE r.code='company_administrator' AND (p.permission_code LIKE 'company.fleet%' OR p.permission_code LIKE 'company.drivers%')")).rows[0].n,4,'New companies get them through the template.');
}));

test('Section 04 preserves existing company resources and tenant role copies while adding nullable station cities',async()=>fixture(async client=>{
 await runMigrations(client,migrations.slice(0,3));
 const [user,cid,bid,sid,role,member,assignment]=Array.from({length:7},()=>randomUUID());
 await client.query('BEGIN');
 try{
  await client.query('INSERT INTO safeer.users(id,normalized_login,display_name,password_hash,must_change_password) VALUES($1,$2,$3,$4,false)',[user,'company-upgrade@safeer.local','Fictional Upgrade Owner',await hashPassword(randomUUID()+randomUUID())]);
  await client.query("INSERT INTO safeer.companies(id,slug,name_en,name_ar,status) VALUES($1,'upgrade-company','Fictional Company','Fictional Company','approved')",[cid]);
  await client.query('INSERT INTO safeer.company_settings(company_id) VALUES($1)',[cid]);
  await client.query("INSERT INTO safeer.branches(id,company_id,code,name_en,name_ar) VALUES($1,$2,'MAIN','Fictional Branch','Fictional Branch')",[bid,cid]);
  await client.query("INSERT INTO safeer.stations(id,company_id,branch_id,code,name_en,name_ar,address) VALUES($1,$2,$3,'MAIN','Fictional Station','Fictional Station','Existing address')",[sid,cid,bid]);
  await client.query("INSERT INTO safeer.company_roles(id,company_id,code,display_name,scope) VALUES($1,$2,'company_administrator','Existing Custom Name','company')",[role,cid]);
  await client.query("INSERT INTO safeer.company_role_permissions(company_id,role_id,permission_code) SELECT $1,$2,p.permission_code FROM safeer.role_permissions p JOIN safeer.roles r ON r.id=p.role_id WHERE r.code='company_administrator'",[cid,role]);
  await client.query("INSERT INTO safeer.company_users(id,company_id,user_id,display_name) VALUES($1,$2,$3,'Existing Local Name')",[member,cid,user]);
  await client.query("INSERT INTO safeer.company_user_roles(id,company_id,member_id,role_id,scope) VALUES($1,$2,$3,$4,'company')",[assignment,cid,member,role]);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}
 const before=(await client.query('SELECT row_to_json(s) AS row FROM safeer.stations s WHERE id=$1',[sid])).rows[0].row;
 const membership=(await client.query('SELECT row_to_json(s) AS row FROM safeer.company_users s WHERE id=$1',[member])).rows[0].row;
 await runMigrations(client,migrations);
 assert.deepEqual((await client.query('SELECT row_to_json(s) AS row FROM safeer.stations s WHERE id=$1',[sid])).rows[0].row,{...before,city_id:null});
 assert.deepEqual((await client.query('SELECT row_to_json(s) AS row FROM safeer.company_users s WHERE id=$1',[member])).rows[0].row,membership);
 assert.equal((await client.query('SELECT count(*)::int AS n FROM safeer.company_role_permissions WHERE role_id=$1',[role])).rows[0].n,9);
 assert.equal((await client.query("SELECT count(*)::int AS n FROM safeer.role_permissions p JOIN safeer.roles r ON r.id=p.role_id WHERE r.code='company_administrator'")).rows[0].n,30);
 assert.equal((await client.query('SELECT count(*)::int AS n FROM safeer.cities')).rows[0].n,0);
}));

test('PostgreSQL baseline applies, records its checksum and reruns without changing history', async () => fixture(async client => {
  assert.equal((await migrationStatus(client, migrations))[0].state, 'pending');
  assert.deepEqual(await runMigrations(client, migrations), migrations.map(m=>m.name));
  assert.deepEqual(await runMigrations(client, migrations), []);
  assert.equal((await migrationStatus(client, migrations))[0].state, 'applied');
  assert.equal((await client.query('SELECT count(*)::int AS count FROM safeer_meta.schema_migrations')).rows[0].count, migrations.length);
  assert.ok((await client.query("SELECT to_regnamespace('safeer') AS namespace")).rows[0].namespace);
}));

test('PostgreSQL rejects migration checksum drift without applying later SQL', async () => fixture(async client => {
  await runMigrations(client, migrations);
  await assert.rejects(runMigrations(client, [{...migrations[0], checksum: 'a'.repeat(64)}]), /differs/);
  assert.equal((await migrationStatus(client, migrations))[0].state, 'applied');
}));

test('failed SQL rolls back namespace, ledger and partial DDL together', async () => fixture(async client => {
  await assert.rejects(runMigrations(client, [{...migrations[0], sql: migrations[0].sql + '\nSELECT 1 / 0;'}]), error => error.code === '22012');
  assert.equal((await client.query("SELECT to_regnamespace('safeer') AS namespace")).rows[0].namespace, null);
  assert.equal((await client.query("SELECT to_regclass('safeer_meta.schema_migrations') AS ledger")).rows[0].ledger, null);
}));

test('concurrent migration runners serialize on one PostgreSQL transaction lock', async () => fixture(async (client, url) => {
  const other = new pg.Client(databaseConfig(url)); await other.connect();
  try {
    const result = await Promise.all([runMigrations(client, migrations), runMigrations(other, migrations)]);
    assert.equal(result.flat().length, migrations.length);
    assert.equal((await client.query('SELECT count(*)::int AS count FROM safeer_meta.schema_migrations')).rows[0].count, migrations.length);
  } finally { await other.end(); }
}));

test('later migrations retain PostgreSQL primary key, foreign key and check constraints', async () => fixture(async client => {
  const sql = 'CREATE TABLE safeer.migration_probe (id integer PRIMARY KEY CHECK (id > 0), parent_id integer REFERENCES safeer.migration_probe(id));';
  const nextVersion=migrations.at(-1).version+1;
  const next = {version: nextVersion, name: String(nextVersion).padStart(4,'0')+'_qa_probe.sql', sql, checksum: createHash('sha256').update(sql).digest('hex')};
  await runMigrations(client, [...migrations, next]);
  await client.query('INSERT INTO safeer.migration_probe VALUES (1, NULL)');
  await assert.rejects(client.query('INSERT INTO safeer.migration_probe VALUES (1, NULL)'), error => error.code === '23505');
  await assert.rejects(client.query('INSERT INTO safeer.migration_probe VALUES (2, 99)'), error => error.code === '23503');
  await assert.rejects(client.query('INSERT INTO safeer.migration_probe VALUES (0, NULL)'), error => error.code === '23514');
}));

test('foundation schemas and migration ledger grant no public access', async () => fixture(async client => {
  await runMigrations(client, migrations);
  const result = await client.query("SELECT count(*)::int AS count FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) acl WHERE n.nspname IN ('safeer', 'safeer_meta') AND acl.grantee = 0");
  assert.equal(result.rows[0].count, 0);
  const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'safeer'");
  assert.deepEqual(tables.rows.map(r=>r.tablename).sort(), ['users','sessions','roles','permissions','role_permissions','platform_user_roles','identity_audit','auth_throttles','companies','company_settings','branches','stations','company_roles','company_role_permissions','company_users','company_user_roles','support_access_grants','support_access_grant_permissions','company_audit','cities','routes','route_stops','seat_layouts','seat_layout_revisions','seat_layout_seats','buses','drivers','trips','trip_stops','trip_assignments','company_public_profiles','bookings','seat_allocations','booking_events','booking_contacts','booking_passengers','company_payment_settings','station_counters','cash_sessions','document_sequences','payments','receipts','tickets','refunds','document_prints','luggage_records','luggage_tags','luggage_events','luggage_exceptions','ticket_credentials','boarding_records','journey_events','journey_incidents','platform_settings','notification_events','notification_reads','shipment_prices','shipments','shipment_items','shipment_tags','shipment_events','shipment_exceptions','shipment_payments'].sort());
}));

test('migration CLI reports pending/applied status without echoing credentials', async () => fixture(async (client, url) => {
  const run = command => execFileSync(process.execPath, ['database/migrate.mjs', command], {windowsHide: true, encoding: 'utf8', env: {...process.env, SAFEER_DATABASE_URL: url}});
  assert.equal(JSON.parse(run('status'))[0].state, 'pending');
  assert.equal(JSON.parse(run('up')).applied.length, migrations.length);
  const output = run('status');
  assert.equal(JSON.parse(output)[0].state, 'applied');
  assert.equal(output.includes(new URL(url).password), false);
}));
