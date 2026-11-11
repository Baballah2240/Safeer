import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Static guard for the Android shell's navigation policy. No device or emulator runs here: this only
// keeps the reviewed rules in place (D57 origin lock, D60 release downloads, D72 contact links).
const source=readFileSync(new URL('../mobile/android/app/src/main/java/sd/safeer/mobile/MainActivity.java',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const method=name=>{const start=source.indexOf(name);assert.ok(start>0,name+' exists');let depth=0,i=source.indexOf('{',start);for(const begin=i;i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&--depth===0)return source.slice(begin,i+1);}throw Error('unbalanced '+name);};

test('the Android shell opens tapped phone and email links in the phone apps and keeps other pages out',()=>{
 const contact=method('static boolean contactLink(');
 assert.match(contact,/"tel"\.equals\(scheme\)/);assert.match(contact,/"mailto"\.equals\(scheme\)/);
 assert.match(contact,/userGesture\s*&&/,'only a user tap may leave the app');
 assert.doesNotMatch(contact,/"(https?|intent|file|content|javascript|sms)"/,'no other schemes');
 const navigation=method('public boolean shouldOverrideUrlLoading(');
 assert.match(navigation,/if \(allowed\(target\)\) return false;/,'Safeer pages stay in the app');
 assert.match(navigation,/releaseDownload\(target\) \|\| contactLink\(target, request\.hasGesture\(\)\)/);
 assert.match(navigation,/return true;\s*\}$/,'everything else is blocked');
 const release=method('static boolean releaseDownload(');
 assert.match(release,/"github\.com"\.equals\(uri\.getHost\(\)\)/);assert.match(release,/startsWith\("\/Baballah2240\/Safeer\/releases\/"\)/);
});
