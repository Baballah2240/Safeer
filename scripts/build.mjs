import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {publicAssets} from '../config/assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'dist');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const entries = [];
// D116: each page lists every script module it imports, so the browser fetches them all at once instead of
// discovering one level of imports per round trip. Computed from the static imports, so it never goes stale.
const importsOf = async file => [...(await readFile(join(root, file), 'utf8')).matchAll(/(?:^|[;\n])\s*import\s+(?:[^"';]*?from\s+)?["'](\.{1,2}\/[^"']+)["']/g)].map(m => join(dirname(file), m[1]).replace(/\\/g, '/'));
async function moduleGraph(entry) {
  const seen = new Set(), queue = [entry];
  while (queue.length) { const file = queue.shift(); if (seen.has(file)) continue; seen.add(file); queue.push(...await importsOf(file)); }
  seen.delete(entry); return [...seen].sort();
}
async function withPreloads(html) {
  let out = html;
  for (const [tag, src] of html.matchAll(/<script type="module" src="\/(src\/[^"]+\.js)"><\/script>/g)) {
    const links = (await moduleGraph(src)).map(dep => `<link rel="modulepreload" href="/${dep}">`).join('');
    out = out.replace(tag, links + tag);
  }
  return out;
}
for (const [file] of Object.values(publicAssets)) {
  const source = join(root, file), target = join(output, file);
  if (/\.(js|mjs)$/.test(file)) execFileSync(process.execPath, ['--check', source], {windowsHide: true});
  await mkdir(dirname(target), {recursive: true});
  if (file.endsWith('.html')) await writeFile(target, await withPreloads(await readFile(source, 'utf8')));
  else await copyFile(source, target);
  entries.push({file, sha256: createHash('sha256').update(await readFile(target)).digest('hex')});
}
await writeFile(join(output, 'build-manifest.json'), JSON.stringify({version: pkg.version, mode: 'local-prototype', files: entries}, null, 2));
console.log(`Built ${entries.length} public assets for Safeer ${pkg.version}. No production application or mobile binary was built.`);
