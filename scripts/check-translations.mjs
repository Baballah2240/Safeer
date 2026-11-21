// D138: checks the translation files in src/locales.
//  1. Every language in src/locales/index.js (other than English, the source) has the same files as Arabic, and each
//     text dictionary has the same keys as the Arabic one, so a new language cannot be half done.
//  2. Every fixed text a page passes to t('...') has an Arabic translation.
// Run: npm run check:translations   (prints what is missing; exit code 1 when anything is).
import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {languageCodes} from '../src/locales/index.js';

const problems=[];
const isDict=v=>v&&typeof v==='object'&&!Array.isArray(v);
const keysOf=v=>isDict(v)?Object.keys(v.text&&isDict(v.text)?v.text:v):[];
const load=async(lang,file)=>(await import(new URL(`../src/locales/${lang}/${file}`,import.meta.url))).default;

// 1) Same files and keys as Arabic for every other language.
const arFiles=readdirSync(new URL('../src/locales/ar/',import.meta.url)).filter(f=>f.endsWith('.js'));
for(const lang of languageCodes.filter(l=>l!=='en'&&l!=='ar')){
 for(const file of arFiles){
  if(!existsSync(new URL(`../src/locales/${lang}/${file}`,import.meta.url))){problems.push(`${lang}: missing src/locales/${lang}/${file}`);continue;}
  const want=keysOf(await load('ar',file)),have=new Set(keysOf(await load(lang,file)));
  const gaps=want.filter(k=>!have.has(k));if(gaps.length)problems.push(`${lang}/${file}: ${gaps.length} missing, e.g. ${JSON.stringify(gaps[0])}`);
 }
}

// 2) Fixed texts given to t('...') have Arabic.
const arabic={};for(const file of arFiles){const v=await load('ar',file);Object.assign(arabic,isDict(v)?(isDict(v.text)?v.text:v):{});}
const codes={...await load('en','staff-errors.js'),...await load('en','staff-labels.js'),...await load('en','driver-errors.js')};
const quote=String.fromCharCode(39),call=new RegExp('\\bt\\(\\s*'+quote+'((?:[^'+quote+'\\\\]|\\\\.){2,}?)'+quote+'\\s*[,)]','g');
const missing=new Map();
for(const f of readdirSync(new URL('../src/',import.meta.url)).filter(f=>f.endsWith('.js'))){
 const text=readFileSync(new URL('../src/'+f,import.meta.url),'utf8');
 for(const m of text.matchAll(call)){const key=m[1].split('\\'+quote).join(quote);
  if(!/[A-Za-z]/.test(key)||key in arabic||(codes[key]&&codes[key] in arabic))continue;
  if(!missing.has(key))missing.set(key,new Set());missing.get(key).add(f);}
}
for(const [key,files] of missing)problems.push(`ar: no translation for ${JSON.stringify(key)} (${[...files].join(', ')})`);

if(problems.length){console.log(problems.join('\n'));console.log(`\n${problems.length} translation problem(s).`);process.exitCode=1;}
else console.log(`Translations complete: ${languageCodes.join(', ')}; ${Object.keys(arabic).length} Arabic texts.`);
