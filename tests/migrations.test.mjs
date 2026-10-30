import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {databaseConfig, readMigrations} from '../database/migrate.mjs';

test('database configuration fails closed for missing, remote or option-bearing URLs', () => {
  for (const value of [undefined, 'not-a-url', 'https://127.0.0.1/db', 'postgres://user:secret@remote.example/db', 'postgres://user:secret@127.0.0.1/db?sslmode=disable', 'postgres://127.0.0.1/']) {
    assert.throws(() => databaseConfig(value));
  }
  assert.equal(databaseConfig('postgresql://user:secret@127.0.0.1:55432/safeer_qa').connectionTimeoutMillis, 5000);
});

test('migration discovery normalizes Windows newlines and rejects gaps or invalid names', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'safeer-migration-files-'));
  await writeFile(join(directory, '0001_bootstrap.sql'), 'SELECT 1;\r\n');
  const first = await readMigrations(directory);
  await writeFile(join(directory, '0001_bootstrap.sql'), 'SELECT 1;\n');
  assert.equal((await readMigrations(directory))[0].checksum, first[0].checksum);
  await writeFile(join(directory, '0003_gap.sql'), 'SELECT 3;');
  await assert.rejects(readMigrations(directory), /sequential/);
  const invalid = await mkdtemp(join(tmpdir(), 'safeer-migration-invalid-'));
  await assert.rejects(readMigrations(invalid), /No SQL/);
  await writeFile(join(invalid, '0001_wrong.SQL'), 'SELECT 1;');
  await assert.rejects(readMigrations(invalid), /sequential/);
});
