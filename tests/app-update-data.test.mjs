import {test} from 'node:test';import assert from 'node:assert/strict';import {validateAppRelease} from '../src/app-update-data.js';import {appRelease} from '../src/app-release.js';
test('release metadata retains independent app versions and accepts only exact published Safeer links',()=>{
 const current=validateAppRelease(appRelease);assert.equal(current.apps.driver.versionCode,18000);assert.equal(current.apps.booking.versionCode,17000);
 for(const mutate of [v=>v.apps.driver.url='https://example.invalid/other.apk',v=>v.apps.driver.versionName='<img>',v=>v.apps.driver.bytes=-1,v=>v.apps.driver.sha256='bad',v=>v.apps.driver.tag='v0.17.0']){const next=structuredClone(appRelease);mutate(next);assert.throws(()=>validateAppRelease(next,current));}
 assert.throws(()=>validateAppRelease({...appRelease,apps:{...appRelease.apps,driver:{...appRelease.apps.driver,versionCode:17999}}},current));
});
