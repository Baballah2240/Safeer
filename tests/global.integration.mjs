// D135: a company outside Sudan. Local phone numbers use the company's calling code, trips default to the
// company's currency, booking lookups accept the local number, and Sudanese companies behave as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';
import {ok,setup} from './support/boarding-fixture.mjs';

const hold=(f,tripId,mobile)=>f.client().request('public/holds','POST',{tripId,seats:['1'],key:randomUUID(),mobile,travelers:[{seat:'1',name:'Fictional Traveler',luggage:null}]});

test('company country decides phone numbers and the default trip currency',()=>identityFixture(async f=>{
 const sd=await setup(f,'global-sd'),eg=await setup(f,'global-eg');
 const company=ok(await f.admin.request(eg.base),200).company;
 assert.equal(company.countryCode,'SD','existing and new companies default to Sudan');assert.equal(company.currency,'SDG');
 const bad=await f.admin.request(eg.base,'PATCH',{...company,id:undefined,countryCode:'ZZ',...eg.pw});assert.equal(bad.error.code,'INVALID_COUNTRY'); for(const code of ['AE','OM','BH','JO','KE','UG'])assert.equal((await f.admin.request(eg.base,'PATCH',{...company,id:undefined,countryCode:code,...eg.pw})).error?.code,'INVALID_COUNTRY','D140: '+code+' is not served yet');
 ok(await f.admin.request(eg.base,'PATCH',{...company,id:undefined,countryCode:'EG',currency:'EGP',timezone:'Africa/Cairo',...eg.pw}),200);
 const saved=ok(await f.admin.request(eg.base),200).company;
 assert.deepEqual([saved.countryCode,saved.currency,saved.timezone],['EG','EGP','Africa/Cairo']);
 // An update from an older client without country or currency keeps them.
 ok(await f.admin.request(eg.base,'PATCH',{...saved,id:undefined,countryCode:undefined,currency:undefined,version:saved.version,...eg.pw}),200);
 assert.equal(ok(await f.admin.request(eg.base),200).company.countryCode,'EG');

 const egTrip=await eg.trip(),sdTrip=await sd.trip();
 const currency=async id=>(await f.migration.query('SELECT currency FROM safeer.trips WHERE id=$1',[id])).rows[0].currency;
 assert.equal(await currency(egTrip),'EGP','new trips take the company currency');assert.equal(await currency(sdTrip),'SDG');

 const egBooking=ok(await hold(f,egTrip,'010 1234 5678'));
 const sdBooking=ok(await hold(f,sdTrip,'0912345678'));
 const stored=async ref=>(await f.migration.query('SELECT c.mobile FROM safeer.booking_contacts c JOIN safeer.bookings b ON b.id=c.booking_id WHERE b.reference=$1',[ref])).rows[0].mobile;
 assert.equal(await stored(egBooking.reference),'+201012345678','Egyptian local number gets +20');
 assert.equal(await stored(sdBooking.reference),'+249912345678','Sudanese numbers unchanged');
 assert.equal((await hold(f,egTrip,'0912345678')).error.code,'INVALID_MOBILE','a Sudanese local number is not an Egyptian one');

 assert.equal(ok(await f.client().request('public/holds/lookup','POST',{reference:egBooking.reference,mobile:'01012345678'})).reference,egBooking.reference,'lookup accepts the local number');
 assert.equal(ok(await f.client().request('public/holds/lookup','POST',{reference:sdBooking.reference,mobile:'0912345678'})).reference,sdBooking.reference);
}));
