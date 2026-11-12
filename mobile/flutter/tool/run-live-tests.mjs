// Runs the Flutter live-API tests (D74) against a disposable local Safeer server:
//   SAFEER_TEST_DATABASE_URL=<disposable PostgreSQL> npm run test:flutter:live
// Needs `flutter` on PATH and a built API (npm run build:api). Fictional data only; the throwaway
// database is dropped afterwards. Never point these tests at the hosted site.
import {spawn, spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

if (!process.env.SAFEER_TEST_DATABASE_URL) throw Error('Set SAFEER_TEST_DATABASE_URL to a disposable loopback PostgreSQL instance.');
const here = fileURLToPath(new URL('./', import.meta.url));
const flutterRoot = join(here, '..');
const work = mkdtempSync(join(tmpdir(), 'safeer-flutter-live-'));
const config = join(work, 'config.json'), stop = join(work, 'stop');
const server = spawn(process.execPath, [join(here, 'live-server.mjs'), config, stop], {stdio: ['ignore', 'pipe', 'inherit'], env: process.env});
const ready = new Promise((resolve, reject) => {
  let out = '';
  server.stdout.on('data', (chunk) => { out += chunk; if (out.includes('READY')) resolve(); });
  server.once('exit', (code) => reject(Error('The live server stopped early (' + code + ').')));
});
const ended = new Promise((resolve) => server.once('exit', resolve));
let failed = false;
try {
  await Promise.race([ready, new Promise((_, reject) => setTimeout(() => reject(Error('The live server did not start in 120 s.')), 120000))]);
  for (const [dir, file] of [['packages/safeer_core', 'tool/live_api_test.dart'], ['apps/safeer_driver', 'tool/live_boarding_test.dart']]) {
    console.log(`\n== ${dir} ${file}`);
    const r = spawnSync('flutter', ['test', file], {cwd: join(flutterRoot, dir), stdio: 'inherit', shell: process.platform === 'win32', env: {...process.env, SAFEER_LIVE_CONFIG: config}});
    if (r.status !== 0) failed = true;
  }
} catch (e) {
  console.error(e.message);
  failed = true;
} finally {
  writeFileSync(stop, '');
  await Promise.race([ended, new Promise((r) => setTimeout(r, 15000))]);
  rmSync(work, {recursive: true, force: true});
}
console.log(failed ? '\nFlutter live-API tests failed.' : '\nFlutter live-API tests passed.');
process.exitCode = failed ? 1 : 0;
