import {test} from 'node:test';
import assert from 'node:assert/strict';
import {get} from 'node:http';
import {readFile} from 'node:fs/promises';
import {startServer} from '../server.mjs';

test('prototype serves only explicit public assets, locally, without a write API or private file access', async () => {
  const app=await startServer({port:0});
  try {
    assert.equal(app.server.address().address,'127.0.0.1');
    const page=await fetch(app.origin);assert.equal(page.status,200);assert.match(await page.text(),/Safeer/);
    assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    assert.equal((await fetch(app.origin+'/src/app.js')).status,200);
    for(const path of ['/package.json','/README.md','/.env','/server.mjs','/api/reservations','/src/../server.mjs','/database/migrate.mjs','/docs/CURRENT_STATE.md','/node_modules/pg/package.json'])assert.equal((await fetch(app.origin+path)).status,404);
    const health=await (await fetch(app.origin+'/api/v1/health')).json();
    assert.equal(health.data.mode,'local-prototype'); assert.equal(health.data.database,'not-connected');
    assert.equal(health.data.service,'safeer');
    const contract=JSON.parse(await readFile(new URL('../src/contracts/openapi.json',import.meta.url),'utf8'));
    assert.deepEqual(Object.keys(contract.paths),['/api/v1/health']);
    assert.equal(contract.info.version,health.data.version);
    const schema=contract.paths['/api/v1/health'].get.responses['200'].content['application/json'].schema.properties.data;
    assert.deepEqual(Object.keys(health.data).sort(),schema.required.toSorted());
    assert.equal((await fetch(app.origin,{method:'POST'})).status,405);
    const wrongHost=await new Promise((accept,reject)=>{get(app.origin,{headers:{Host:'example.invalid'}},response=>{response.resume();accept(response.statusCode);}).on('error',reject);});
    assert.equal(wrongHost,403);
  } finally { await app.close(); }
});
