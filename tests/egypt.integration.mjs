// D142 (global plan: Egypt readiness): a whole Egyptian bus company works in Egyptian pounds and Cairo time -
// standard price, plan, trips, a booking with an Egyptian number, the station counter (cash session and sale),
// parcel prices, the driver's list and the finance report. Before D142 the counter opened every cash session in
// SDG, so an Egyptian station could not take cash (CURRENCY_MISMATCH), and parcel prices fell back to SDG.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';
import {ok,setup,staff} from './support/boarding-fixture.mjs';
test('an Egyptian company runs end to end in EGP and Cairo time',()=>identityFixture(async f=>{
 const s=await setup(f,'egypt-co'),pw={currentPassword:f.password};
 const company=ok(await f.admin.request(s.base),200).company;
 ok(await f.admin.request(s.base,'PATCH',{...company,id:undefined,countryCode:'EG',currency:'EGP',timezone:'Africa/Cairo',...pw}),200);
 // Standard price for Egypt and the first plan.
 ok(await f.admin.request('platform/country-prices/EG','PUT',{monthlyFeeMinor:'500000',commissionBps:300,currency:'EGP',version:0,...pw}),200);
 const billing=ok(await f.admin.request(s.base+'/billing'),200);assert.equal(billing.countryPrice.currency,'EGP');
 // Trips, booking with an Egyptian number.
 const trip=await s.trip();assert.equal((await f.migration.query('SELECT currency,timezone FROM safeer.trips WHERE id=$1',[trip])).rows[0].currency,'EGP');
 const held=ok(await f.client().request('public/holds','POST',{tripId:trip,seats:['1'],key:randomUUID(),mobile:'01012345678',travelers:[{seat:'1',name:'Fictional Traveler',luggage:null}]}));
 const pub=ok(await f.client().request('public/trips/'+trip),200);assert.equal(pub.currency||pub.trip?.currency,'EGP');
 // Station counter: a cashier opens a session and takes cash for the EGP booking.
 const counter=ok(await f.admin.request(s.base+'/counters','POST',{stationId:s.station,code:'c2',name:'Counter 2',...pw})).id;
 const {c:cashier}=await staff(f,s,['company.ticketing.operate','company.bookings.read','company.trips.read']);
 const session=ok(await cashier.request(s.base+'/counter/sessions','POST',{counterId:counter,openingMinor:100000}));
 const sessionCurrency=(await f.migration.query('SELECT currency FROM safeer.cash_sessions WHERE company_id=$1 AND counter_id=$2',[s.cid,counter])).rows[0].currency;
 assert.equal(sessionCurrency,'EGP','the cash session is in the company currency');
 const bid=(await f.migration.query('SELECT id FROM safeer.bookings WHERE reference=$1',[held.reference])).rows[0].id;
 const paid=await cashier.request(`${s.base}/bookings/${bid}/pay`,'POST',{method:'cash',key:randomUUID()});
 assert.equal(paid.status,201,'an Egyptian station takes cash: '+paid.raw);
 assert.equal((await f.migration.query("SELECT currency FROM safeer.payments WHERE booking_id=$1",[bid])).rows[0].currency,'EGP');
 // Parcel prices for a company are in its currency.
 const price=ok(await f.admin.request(s.base+'/shipments/prices','POST',{category:'small',priceMinor:5000,active:true}),201);
 assert.equal(price.currency,'EGP','parcel prices use the company currency');
 // Finance report totals come out in EGP only.
 const day=new Date().toISOString().slice(0,10);
 const report=ok(await f.admin.request(`${s.base}/finance?from=${day}&to=${day}`),200);
 assert.ok(report.totals.some(t=>t.currency==='EGP'),'finance report in EGP');assert.equal(report.totals.some(t=>t.currency==='SDG'&&Number(t.salesMinor)>0),false);
 // Driver app: the trip carries Cairo time.
 assert.equal(ok(await f.admin.request('driver/trips'),200).items.find(t=>t.id===trip)?.timezone,'Africa/Cairo');
 assert.ok(session);
}));
