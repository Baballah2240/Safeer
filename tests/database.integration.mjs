import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID, createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {databaseConfig, readMigrations, migrationStatus, runMigrations} from '../database/migrate.mjs';

if (!process.env.SAFEER_TEST_DATABASE_URL) throw Error('Set SAFEER_TEST_DATABASE_URL for a disposable local PostgreSQL instance; no tests are skipped.');
const config = databaseConfig(process.env.SAFEER_TEST_DATABASE_URL);
const migrations = await readMigrations();

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
  const next = {version: 3, name: '0003_qa_probe.sql', sql, checksum: createHash('sha256').update(sql).digest('hex')};
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
  assert.deepEqual(tables.rows.map(r=>r.tablename).sort(), ['users','sessions','roles','permissions','role_permissions','platform_user_roles','identity_audit','auth_throttles'].sort());
}));

test('migration CLI reports pending/applied status without echoing credentials', async () => fixture(async (client, url) => {
  const run = command => execFileSync(process.execPath, ['database/migrate.mjs', command], {windowsHide: true, encoding: 'utf8', env: {...process.env, SAFEER_DATABASE_URL: url}});
  assert.equal(JSON.parse(run('status'))[0].state, 'pending');
  assert.equal(JSON.parse(run('up')).applied.length, migrations.length);
  const output = run('status');
  assert.equal(JSON.parse(output)[0].state, 'applied');
  assert.equal(output.includes(new URL(url).password), false);
}));
