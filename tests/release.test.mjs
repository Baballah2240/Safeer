import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('a failed release build replaces stale success, stops later phases and never touches runtime',()=>{
 mkdirSync(resolve('.qa'),{recursive:true});
 const sandbox=mkdtempSync(resolve('.qa','release-gate-case-'));for(const folder of ['scripts','database','.qa','runtime'])mkdirSync(join(sandbox,folder));
 copyFileSync('scripts/verify-release.mjs',join(sandbox,'scripts/verify-release.mjs'));copyFileSync('database/migrate.mjs',join(sandbox,'database/migrate.mjs'));
 writeFileSync(join(sandbox,'package.json'),JSON.stringify({type:'module',version:'0.16.0',scripts:{check:'node -e "process.exit(1)"'}}));
 writeFileSync(join(sandbox,'.qa/release-verification.json'),JSON.stringify({passed:true,version:'old'}));writeFileSync(join(sandbox,'runtime/marker.txt'),'fictional sentinel');
 const result=spawnSync(process.execPath,[join(sandbox,'scripts/verify-release.mjs')],{cwd:sandbox,env:{...process.env,SAFEER_TEST_DATABASE_URL:''},windowsHide:true,encoding:'utf8',timeout:30000});
 assert.equal(result.status,1);const report=JSON.parse(readFileSync(join(sandbox,'.qa/release-verification.json'),'utf8'));assert.equal(report.passed,false);assert.equal(report.version,'0.16.0');assert.equal(report.steps.length,1);assert.equal(report.steps[0].passed,false);assert.equal(report.usesPersistentRuntime,false);assert.equal(readFileSync(join(sandbox,'runtime/marker.txt'),'utf8'),'fictional sentinel');assert.equal(existsSync(join(sandbox,'.qa/postgres')),false);
});
