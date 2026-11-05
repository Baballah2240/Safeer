import {test} from 'node:test';
import assert from 'node:assert/strict';
import {get,createServer,Agent} from 'node:http';
import {readFile} from 'node:fs/promises';
import {startServer} from '../server.mjs';

test('proxy separates connection headers while rotating limited keepalive sockets',async()=>{
 const requests=[],perSocket=new WeakMap();let backendConnections=0,webConnections=0;
 const backend=createServer((req,res)=>{const count=(perSocket.get(req.socket)||0)+1;perSocket.set(req.socket,count);requests.push(req.headers);res.writeHead(200,{'Content-Type':'application/json',Connection:(count===3?'close':'keep-alive')+', x-response-hop','X-Response-Hop':'remove-me'});res.end('{"data":{"ok":true}}');});
 backend.on('connection',()=>backendConnections++);
 await new Promise(r=>backend.listen(0,'127.0.0.1',r));backend.maxRequestsPerSocket=3;
 const web=await startServer({port:0,identityApiUrl:'http://127.0.0.1:'+backend.address().port}),agent=new Agent({keepAlive:true,maxSockets:1});web.server.maxRequestsPerSocket=5;
 web.server.on('connection',()=>webConnections++);
 try{for(let i=0;i<12;i++){
  const result=await new Promise((resolve,reject)=>{get(web.origin+'/api/v1/health',{agent,headers:{Connection:'keep-alive, x-request-hop','X-Request-Hop':'remove-me',Cookie:'fictional=sent',Origin:web.origin,'X-CSRF-Token':'fictional-sent'}},res=>{let body='';res.on('data',x=>body+=x);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));}).on('error',reject);});
  assert.equal(result.status,200,'Request '+(i+1)+': '+JSON.stringify(result));assert.equal(result.headers['x-response-hop'],undefined);assert.deepEqual(JSON.parse(result.body),{data:{ok:true}});
 }
 assert.equal(requests.length,12);assert.ok(requests.every(r=>!r['x-request-hop']&&r.cookie==='fictional=sent'&&r.origin===web.origin&&r['x-csrf-token']==='fictional-sent'));
 assert.equal(backendConnections,4);assert.equal(webConnections,3);
 }finally{agent.destroy();await web.close();await new Promise(r=>backend.close(r));}
});

test('prototype serves only explicit public assets, locally, without a write API or private file access', async () => {
  const app=await startServer({port:0});
  try {
    assert.equal(app.server.address().address,'127.0.0.1');
    const page=await fetch(app.origin);assert.equal(page.status,200);assert.match(await page.text(),/Safeer/);
    assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    assert.equal((await fetch(app.origin+'/src/app.js')).status,200);
    for(const path of ['/package.json','/README.md','/.env','/server.mjs','/api/reservations','/src/../server.mjs','/database/migrate.mjs','/docs/CURRENT_STATE.md','/node_modules/pg/package.json','/runtime/first-login.txt','/runtime/local-settings.json','/apps/api/src/identity.service.ts'])assert.equal((await fetch(app.origin+path)).status,404);
    const health=await (await fetch(app.origin+'/api/v1/health')).json();
    assert.equal(health.data.mode,'local-prototype'); assert.equal(health.data.database,'not-connected');
    assert.equal(health.data.service,'safeer');
    const contract=JSON.parse(await readFile(new URL('../src/contracts/openapi.json',import.meta.url),'utf8'));
    assert.ok(Object.hasOwn(contract.paths,'/api/v1/health'));
    assert.ok(Object.hasOwn(contract.paths,'/api/v1/auth/login'));
    assert.ok(Object.hasOwn(contract.paths,'/api/v1/companies'));
    assert.ok(Object.hasOwn(contract.paths,'/api/v1/companies/{id}/members'));
    assert.equal(Object.keys(contract.paths).length,93);
    assert.equal((await fetch(app.origin+'/marketplace')).status,200);
    assert.equal((await fetch(app.origin+'/company/fictional-nile')).status,200);
    assert.equal((await fetch(app.origin+'/company/../server.mjs')).status,404);
    assert.equal((await fetch(app.origin+'/trip/00000000-0000-4000-8000-000000000000')).status,200);
    assert.equal((await fetch(app.origin+'/hold/SF-ABCD2345')).status,200);
    assert.equal((await fetch(app.origin+'/booking')).status,200);
    for(const path of ['/trip/not-a-trip','/hold/not-a-reference','/hold/SF-ABCD234O'])assert.equal((await fetch(app.origin+path)).status,404,path);
    assert.equal(contract.info.version,health.data.version);
    const schema=contract.paths['/api/v1/health'].get.responses['200'].content['application/json'].schema.properties.data;
    assert.deepEqual(Object.keys(health.data).sort(),schema.required.toSorted());
    assert.equal((await fetch(app.origin,{method:'POST'})).status,405);
    const wrongHost=await new Promise((accept,reject)=>{get(app.origin,{headers:{Host:'example.invalid'}},response=>{response.resume();accept(response.statusCode);}).on('error',reject);});
    assert.equal(wrongHost,403);
    const malformed=await new Promise((accept,reject)=>{const target=new URL(app.origin);get({hostname:target.hostname,port:target.port,path:'//[invalid'},response=>{response.resume();accept(response.statusCode);}).on('error',reject);});
    assert.equal(malformed,400);
    assert.equal((await fetch(app.origin)).status,200,'Malformed request must not stop the server');
  } finally { await app.close(); }
});
