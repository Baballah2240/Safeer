import {readFile, readdir, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const docs = resolve(root, 'docs');
const required = ['PROJECT_MASTER.md','DEVELOPMENT_ROADMAP.md','DATABASE_SCHEMA.md','BUSINESS_RULES.md','SYSTEM_ARCHITECTURE.md','CHANGELOG.md','CURRENT_STATE.md','DECISIONS.md','SECTION_ARCHIVE_TEMPLATE.md','archive/SECTION_01_FOUNDATION.md','archive/SECTION_02_IDENTITY.md','archive/SECTION_03_COMPANIES.md','archive/SECTION_04_ROUTES.md','archive/SECTION_05_FLEET.md','archive/SECTION_06_TRIPS.md','archive/SECTION_07_MARKETPLACE.md','archive/SECTION_08_RESERVATIONS.md','archive/SECTION_09_PASSENGERS.md'];
for (const file of required) if (!(await readFile(resolve(docs, file), 'utf8')).trim()) throw Error('Empty required document: ' + file);
for (const directory of ['architecture','database','workflows','modules','api','security','testing','decisions','archive']) {
  if (!(await readdir(resolve(docs, directory))).length) throw Error('Empty documentation category: ' + directory);
}
let count = 0;
async function walk(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) { await walk(path); continue; }
    if (!entry.name.endsWith('.md')) continue;
    const content = await readFile(path, 'utf8'); count++;
    for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const link = match[1];
      if (/^(https?:|#)/.test(link)) continue;
      const target = resolve(dirname(path), decodeURIComponent(link.split('#')[0]));
      if (!target.startsWith(root)) throw Error('Documentation link escapes the project: ' + path);
      await stat(target).catch(() => { throw Error('Broken local documentation link: ' + path + ' -> ' + link); });
    }
  }
}
await walk(docs);
console.log(`Verified ${required.length} mandatory continuation/archive documents and links in ${count} Markdown files.`);
