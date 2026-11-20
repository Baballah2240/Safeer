import {test} from 'node:test';
import assert from 'node:assert/strict';
import {body,login,password,uuid,list,hashPassword,verifyPassword,secret,csrf,validCsrf,sessionToken,digest} from '../dist/api/security.js';
import {localDatabase} from '../dist/api/database.js';
test('identity input validation rejects extra authority fields, malformed values and unsafe database URLs',()=>{
  assert.throws(()=>body({login:'owner@safeer.local',superAdministrator:true},['login']));
  assert.throws(()=>body([],[]));assert.equal(login(' OWNER@SAFEER.LOCAL '),'owner@safeer.local');
  for(const value of ['bad',null,'a@b\r\nx: y'])assert.throws(()=>login(value));
  for(const value of ['short','x'.repeat(129),null])assert.throws(()=>password(value,true));
  assert.equal(password('a meaningful passphrase',true),'a meaningful passphrase');
  assert.throws(()=>uuid('not-an-id'));assert.throws(()=>list(['x','x'],String));
  for(const value of [undefined,'postgresql://u:p@example.com/app','postgresql://u:p@localhost/app?options=x'])assert.throws(()=>localDatabase(value));
});
test('passwords use salted adaptive scrypt hashes and constant length secret comparisons',async()=>{
  const first=await hashPassword('A fictional long passphrase'),second=await hashPassword('A fictional long passphrase');
  assert.notEqual(first,second);assert.match(first,/^scrypt\$32768\$8\$3\$/);
  assert.equal(await verifyPassword('A fictional long passphrase',first),true);
  assert.equal(await verifyPassword('Wrong fictional long passphrase',first),false);
  assert.equal(await verifyPassword('A fictional long passphrase','invalid'),false);
});
test('opaque cookies and CSRF tokens reject duplicates, guesses and mismatched sessions',()=>{
  const token=secret(),other=secret();assert.equal(sessionToken('safeer_session='+token),token);
  assert.throws(()=>sessionToken('safeer_session='+token+';safeer_session='+other));assert.throws(()=>sessionToken('safeer_session=invalid'));
  assert.equal(validCsrf(token,csrf(token)),true);assert.equal(validCsrf(token,csrf(other)),false);assert.equal(validCsrf(token,'x'),false);assert.equal(digest(token).length,64);
});
test('password work is bounded: two run, up to 64 wait in line (D132), the next is refused',async()=>{
  const queued=Array.from({length:66},()=>hashPassword(secret()));
  await assert.rejects(hashPassword(secret()),error=>error.getStatus()===429);
  const settled=await Promise.allSettled(queued);
  assert.ok(settled.filter(s=>s.status==='fulfilled').length>=3,'people waiting in line are served, not refused');
  assert.ok(settled.every(s=>s.status==='fulfilled'||s.reason.getStatus()===429),'a slow machine may time out the end of the line, never crash');
});
