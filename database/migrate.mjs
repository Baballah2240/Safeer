import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import pg from 'pg';

export async function readMigrations(directory = new URL('./migrations/', import.meta.url)) {
  const names = (await readdir(directory)).filter(name => name.toLowerCase().endsWith('.sql')).sort();
  if (!names.length) throw Error('No SQL migrations found.');
  const migrations = [];
  for (const [index, name] of names.entries()) {
    if (!/^\d{4}_[a-z0-9_]+\.sql$/.test(name) || Number(name.slice(0, 4)) !== index + 1) {
      throw Error('Migrations must be sequential: 0001_name.sql, 0002_name.sql.');
    }
    const path = typeof directory === 'string' ? resolve(directory, name) : new URL(name, directory);
    const sql = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
    if (!sql.trim()) throw Error('Empty migration: ' + name);
    migrations.push({version: index + 1, name, sql, checksum: createHash('sha256').update(sql).digest('hex')});
  }
  return migrations;
}

export function databaseConfig(value) {
  if (!value) throw Error('Set SAFEER_DATABASE_URL for an isolated local PostgreSQL database.');
  let url;
  try { url = new URL(value); } catch { throw Error('Invalid database URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw Error('Section 01 database tooling accepts loopback PostgreSQL only.');
  }
  if (url.search || url.hash || !/^\/[a-zA-Z0-9_]+$/.test(url.pathname)) throw Error('Use a local database name without URL options.');
  return {connectionString: url.href, connectionTimeoutMillis: 5000, application_name: 'safeer-migrations'};
}

function validateHistory(rows, migrations) {
  for (const [index, row] of rows.entries()) {
    const migration = migrations[index];
    if (!migration || row.version !== migration.version || row.name !== migration.name || row.checksum !== migration.checksum) {
      throw Error('Migration history differs from source. Restore the original migration; do not edit applied SQL.');
    }
  }
}

export async function migrationStatus(client, migrations) {
  const exists = await client.query("SELECT to_regclass('safeer_meta.schema_migrations') AS ledger");
  const rows = exists.rows[0].ledger ? (await client.query('SELECT version, name, checksum FROM safeer_meta.schema_migrations ORDER BY version')).rows : [];
  validateHistory(rows, migrations);
  return migrations.map(migration => ({version: migration.version, name: migration.name, state: rows.some(row => row.version === migration.version) ? 'applied' : 'pending'}));
}

export async function runMigrations(client, migrations) {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query('SELECT pg_advisory_xact_lock(94106, 1)');
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS safeer_meta;
      REVOKE ALL ON SCHEMA safeer_meta FROM PUBLIC;
      CREATE TABLE IF NOT EXISTS safeer_meta.schema_migrations (
        version integer PRIMARY KEY CHECK (version > 0),
        name text NOT NULL UNIQUE,
        checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
        applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
      );
      REVOKE ALL ON safeer_meta.schema_migrations FROM PUBLIC;
    `);
    const rows = (await client.query('SELECT version, name, checksum FROM safeer_meta.schema_migrations ORDER BY version')).rows;
    validateHistory(rows, migrations);
    const applied = [];
    for (const migration of migrations.slice(rows.length)) {
      await client.query(migration.sql);
      await client.query('INSERT INTO safeer_meta.schema_migrations(version, name, checksum) VALUES ($1, $2, $3)', [migration.version, migration.name, migration.checksum]);
      applied.push(migration.name);
    }
    await client.query('COMMIT');
    return applied;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], 'Migration failed and rollback could not be verified.');
    }
    throw error;
  }
}

async function main() {
  const command = process.argv[2];
  if (!['up', 'status'].includes(command)) throw Error('Use: node database/migrate.mjs up|status');
  const migrations = await readMigrations();
  const client = new pg.Client(databaseConfig(process.env.SAFEER_DATABASE_URL));
  try {
    await client.connect();
    console.log(JSON.stringify(command === 'up' ? {applied: await runMigrations(client, migrations)} : await migrationStatus(client, migrations), null, 2));
  } finally { await client.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    // Never echo credentials, connection strings or server query details to logs.
    console.error('Database operation failed: ' + (error.code || (error.message.includes('URL') || error.message.includes('Section 01') || error.message.startsWith('Use:') ? error.message : 'review configuration, permissions and migration history.')));
    process.exitCode = 1;
  });
}
