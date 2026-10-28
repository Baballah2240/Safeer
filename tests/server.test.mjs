import {test} from 'node:test';
import assert from 'node:assert/strict';
import {get} from 'node:http';
import {startServer} from '../server.mjs';

test('prototype serves only explicit public assets, locally, without a write API or private file access', async () => {
  const app=await startServer({port:0});
  try {
    assert.equal(app.server.address().address,'127.0.0.1');
    const page=await fetch(app.origin);assert.equal(page.status,200);assert.match(await page.text(),/Safeer/);
    assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    assert.equal((await fetch(app.origin+'/src/app.js')).status,200);
    for(const path of ['/package.json','/README.md','/.env','/server.mjs','/api/reservations','/src/../server.mjs'])assert.equal((await fetch(app.origin+path)).status,404);
    assert.equal((await fetch(app.origin,{method:'POST'})).status,405);
    const wrongHost=await new Promise((accept,reject)=>{get(app.origin,{headers:{Host:'example.invalid'}},response=>{response.resume();accept(response.statusCode);}).on('error',reject);});
    assert.equal(wrongHost,403);
  } finally { await app.close(); }
});
