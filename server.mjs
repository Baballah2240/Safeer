import {createServer,request as upstreamRequest} from 'node:http';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {BlockList,isIP} from 'node:net';
import {publicAssets} from './config/assets.mjs';
import {appRelease} from './src/app-release.js';

const bodyLimits = JSON.parse(readFileSync(new URL('./config/http-limits.json', import.meta.url), 'utf8'));
const {version} = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// Connection options apply only to one hop. Each HTTP server owns its socket
// lifetime/framing; forwarding these fields can contradict its own close limit.
const forwardedHeaders=headers=>{
  const excluded=new Set(['connection','keep-alive','proxy-connection','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade',...String(headers.connection||'').split(',').map(x=>x.trim().toLowerCase())]);
  return Object.fromEntries(Object.entries(headers).filter(([name])=>!excluded.has(name.toLowerCase())));
};
// D72: the hosted site sits behind Cloudflare and then Render's edge, which appends the address it saw,
// so the last X-Forwarded-For entry is a Cloudflare server shared by many visitors. Only when that hop
// is one of Cloudflare's published ranges is Cloudflare's own CF-Connecting-IP taken as the visitor;
// a request that bypasses Cloudflare keeps its real last hop, so the header cannot be forged that way.
const cloudflare=new BlockList();
for(const range of ['173.245.48.0/20','103.21.244.0/22','103.22.200.0/22','103.31.4.0/22','141.101.64.0/18','108.162.192.0/18','190.93.240.0/20','188.114.96.0/20','197.234.240.0/22','198.41.128.0/17','162.158.0.0/15','104.16.0.0/13','104.24.0.0/14','172.64.0.0/13','131.0.72.0/22'])cloudflare.addSubnet(range.split('/')[0],Number(range.split('/')[1]),'ipv4');
for(const range of ['2400:cb00::/32','2606:4700::/32','2803:f800::/32','2405:b500::/32','2405:8100::/32','2a06:98c0::/29','2c0f:f248::/32'])cloudflare.addSubnet(range.split('/')[0],Number(range.split('/')[1]),'ipv6');
const fromCloudflare=address=>{const kind=isIP(address);return kind===4?cloudflare.check(address,'ipv4'):kind===6?cloudflare.check(address,'ipv6'):false;};
export function edgeClient(headers){
  const last=String(headers['x-forwarded-for']||'').split(',').map(x=>x.trim()).filter(Boolean).at(-1)||'',viaCloudflare=String(headers['cf-connecting-ip']||'').trim();
  return fromCloudflare(last)&&isIP(viaCloudflare)?viaCloudflare:last;
}

export async function startServer({port = 4320, built = false, identityApiUrl, publicOrigin, loopbackOnly = false} = {}) {
  const hosted = publicOrigin ? new URL(publicOrigin) : null;
  if (hosted && (hosted.protocol !== 'https:' || hosted.pathname !== '/' || hosted.search || hosted.username)) throw Error('The public origin must be https:// with no path.');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Choose a valid local port.');
  const server = createServer({headersTimeout:10000,requestTimeout:15000,connectionsCheckingInterval:1000},async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (hosted) response.setHeader('Strict-Transport-Security', 'max-age=31536000');
    // Hosting health checks reach the service by its internal address.
    const healthCheck = hosted && request.url === '/api/v1/health' && request.method === 'GET';
    if (!healthCheck && request.headers.host !== (hosted ? hosted.host : `127.0.0.1:${server.address().port}`)) {
      response.writeHead(403); response.end('Open the local 127.0.0.1 address.'); return;
    }
    let path;
    try{
      if(!request.url?.startsWith('/')||request.url.startsWith('//')||request.url.includes('\\'))throw Error('Invalid request target');
      path=new URL(request.url,'http://127.0.0.1').pathname;
    }catch{response.writeHead(400);response.end('Invalid request target');return;}
    // D66: only the Driver document may ask for local camera capture; audio remains disabled.
    if(path==='/driver')response.setHeader('Permissions-Policy','camera=(self), microphone=(), geolocation=(), payment=(), usb=()');
    const apiUrl=(typeof identityApiUrl==='function'?identityApiUrl():identityApiUrl)||process.env.SAFEER_AUTH_API_URL;
    if(path.startsWith('/api/v1/')&&apiUrl){
      let target;
      try{target=new URL(apiUrl);if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error();}
      catch{response.writeHead(503,{'Content-Type':'application/json'});response.end(JSON.stringify({error:{code:'IDENTITY_UNAVAILABLE',message:'Review the local identity API configuration.'}}));return;}
      const bodyLimit=request.method==='POST'&&path==='/api/v1/public/holds'?bodyLimits.bookingBodyBytes:bodyLimits.defaultBodyBytes;
      if(Number(request.headers['content-length']||0)>bodyLimit){response.writeHead(413);response.end('Request too large');return;}
      const upstream=upstreamRequest({hostname:target.hostname,port:target.port,method:request.method,path:request.url,headers:{...forwardedHeaders(request.headers),host:target.host,'x-safeer-client':hosted?edgeClient(request.headers):request.socket.remoteAddress}},incoming=>{
        response.writeHead(incoming.statusCode,forwardedHeaders(incoming.headers));incoming.pipe(response);
      });
      upstream.setTimeout(10000,()=>upstream.destroy());
      upstream.on('error',()=>{if(!response.headersSent){response.writeHead(503,{'Content-Type':'application/json'});response.end(JSON.stringify({error:{code:'IDENTITY_UNAVAILABLE',message:'Start the local identity service.'}}));}else response.destroy();});
      let size=0;request.on('data',chunk=>{size+=chunk.length;if(size>bodyLimit){upstream.destroy();request.unpipe(upstream);if(!response.headersSent){response.writeHead(413);response.end('Request too large');}}});
      request.on('aborted',()=>upstream.destroy());request.pipe(upstream);return;
    }
    if(path.startsWith('/api/v1/auth')||path.startsWith('/api/v1/identity')){
      response.writeHead(503,{'Content-Type':'application/json'});response.end(JSON.stringify({error:{code:'IDENTITY_UNAVAILABLE',message:'Run npm run local to start the local identity service.'}}));return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, {Allow: 'GET, HEAD'}); response.end('This prototype has no write API.'); return;
    }
    try {
      if(path==='/mobile/releases'){response.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});response.end(request.method==='HEAD'?undefined:JSON.stringify(appRelease));return;}
      if (path === '/api/v1/health') {
        response.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
        response.end(request.method === 'HEAD' ? undefined : JSON.stringify({data: {service: 'safeer', version, mode: 'local-prototype', database: 'not-connected', maintenance:{holds:{state:'disabled',lastSuccessAt:null},retention:{state:'disabled',lastSuccessAt:null}}}}));
        return;
      }
      // Company, seat and hold pages are the same static page; the public API checks each identifier.
      const asset = /^\/(booking|company\/[a-z0-9-]{1,60}|trip\/[0-9a-f-]{36}|hold\/SF-[2-9A-HJ-NP-Z]{8})$/.test(path) ? '/marketplace' : path;
      if (!Object.hasOwn(publicAssets, asset)) {
        response.writeHead(404); response.end('Not found'); return;
      }
      const [file, type] = publicAssets[asset];
      const content = await readFile(new URL((built ? 'dist/' : '') + file, import.meta.url));
      // D53: scripts/styles/images may be kept by phones but must be revalidated on
      // every visit; an unchanged file costs a 304 instead of a full download.
      // Pages stay no-store so a signed-out view is never replayed.
      if (type !== 'text/html') {
        const tag = '"' + createHash('sha256').update(content).digest('base64url').slice(0, 27) + '"';
        response.setHeader('Cache-Control', 'no-cache');
        response.setHeader('ETag', tag);
        if (String(request.headers['if-none-match'] || '').split(',').map(x => x.trim()).includes(tag)) { response.writeHead(304); response.end(); return; }
      }
      response.writeHead(200, {'Content-Type': type + (type === 'image/svg+xml' ? '' : '; charset=utf-8')});
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch {
      response.writeHead(500); response.end('Could not open this prototype page.');
    }
  });
  server.keepAliveTimeout=5000;server.maxHeadersCount=40;server.maxRequestsPerSocket=100;server.setTimeout(15000,socket=>socket.destroy());
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(port, hosted && !loopbackOnly ? '0.0.0.0' : '127.0.0.1', accept); });
  return {server, origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(accept => server.close(accept))};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startServer({port: Number(process.env.SAFEER_PORT ?? 4320), built: process.argv.includes('--built')}).then(app => {
    console.log(`Safeer local prototype: ${app.origin}`);
    const shutdown = () => app.close().then(() => process.exit(0));
    process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
