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
for (const [file] of Object.values(publicAssets)) {
  const source = join(root, file), target = join(output, file);
  if (/\.(js|mjs)$/.test(file)) execFileSync(process.execPath, ['--check', source], {windowsHide: true});
  await mkdir(dirname(target), {recursive: true});
  await copyFile(source, target);
  entries.push({file, sha256: createHash('sha256').update(await readFile(target)).digest('hex')});
}
await writeFile(join(output, 'build-manifest.json'), JSON.stringify({version: pkg.version, mode: 'local-prototype', files: entries}, null, 2));
console.log(`Built ${entries.length} public assets for Safeer ${pkg.version}. No production application or mobile binary was built.`);
