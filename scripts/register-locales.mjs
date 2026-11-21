// Adds every src/locales file to the served asset list (config/assets.mjs) if missing.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
const f='config/assets.mjs';let t=readFileSync(f,'utf8');
const files=readdirSync('src/locales',{recursive:true}).filter(p=>p.endsWith('.js')).map(p=>'src/locales/'+p.split(String.fromCharCode(92)).join('/')).sort();
const missing=files.filter(p=>!t.includes(`'/${p}'`));
const anchor="  '/src/companies.js': ['src/companies.js', 'text/javascript'],";if(!t.includes(anchor))throw Error('anchor');
if(missing.length)t=t.replace(anchor,anchor+'\n'+missing.map(p=>`  '/${p}': ['${p}', 'text/javascript'],`).join('\n'));
writeFileSync(f,t);console.log('registered',missing);
