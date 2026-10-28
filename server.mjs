import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const files = {
  '/': ['index.html', 'text/html'],
  '/src/app.js': ['src/app.js', 'text/javascript'],
  '/src/domain.mjs': ['src/domain.mjs', 'text/javascript'],
  '/src/demo.mjs': ['src/demo.mjs', 'text/javascript'],
  '/src/styles.css': ['src/styles.css', 'text/css'],
  '/src/brand.svg': ['src/brand.svg', 'image/svg+xml'],
};

export async function startServer({port = 4320} = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Choose a valid local port.');
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (request.headers.host !== `127.0.0.1:${server.address().port}`) {
      response.writeHead(403); response.end('Open the local 127.0.0.1 address.'); return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, {Allow: 'GET, HEAD'}); response.end('This prototype has no write API.'); return;
    }
    try {
      const path = new URL(request.url, 'http://127.0.0.1').pathname;
      if (!Object.hasOwn(files, path)) {
        response.writeHead(404); response.end('Not found'); return;
      }
      const [file, type] = files[path];
      const content = await readFile(new URL(file, import.meta.url));
      response.writeHead(200, {'Content-Type': type + (type === 'image/svg+xml' ? '' : '; charset=utf-8')});
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch {
      response.writeHead(500); response.end('Could not open this prototype page.');
    }
  });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', accept); });
  return {server, origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(accept => server.close(accept))};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startServer({port: Number(process.env.SAFEER_PORT ?? 4320)}).then(app => {
    console.log(`Safeer local prototype: ${app.origin}`);
    const shutdown = () => app.close().then(() => process.exit(0));
    process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
