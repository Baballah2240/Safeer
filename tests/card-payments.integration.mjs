// D136: card payment through Paymob, against a local fake Paymob. The passenger holds seats, opens the card page,
// and only Paymob's signed result confirms the booking. Forged, repeated and declined results are handled.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHmac,randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';
import {ok,setup} from './support/boarding-fixture.mjs';

const secret='fake-hmac-secret-'+randomUUID();
const signed=['amount_cents','created_at','currency','error_occured','has_parent_transaction','id','integration_id','is_3d_secure','is_auth','is_capture','is_refunded','is_standalone_payment','is_voided','order.id','owner','pending','source_data.pan','source_data.sub_type','source_data.type','success'];
const pick=(o,p)=>p.split('.').reduce((v,k)=>v?.[k],o);
const sign=obj=>createHmac('sha512',secret).update(signed.map(p=>{const v=pick(obj,p);return v===undefined||v===null?'':String(v);}).join('')).digest('hex');
const transaction=(order,amount,success,id)=>({id,pending:false,amount_cents:amount,success,is_auth:false,is_capture:false,is_standalone_payment:true,is_voided:false,is_refunded:false,is_3d_secure:true,integration_id:4242,has_parent_transaction:false,error_occured:!success,owner:7,created_at:'2026-11-21T10:00:00.000000',currency:'EGP',order:{id:Number(order)},source_data:{pan:'2346',sub_type:'MasterCard',type:'card'}});

async function fakePaymob(){
 const calls=[];let next=900000;
 const server=createServer((req,res)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{const body=JSON.parse(raw||'{}');calls.push({path:req.url,body});res.setHeader('Content-Type','application/json');
  if(req.url==='/api/auth/tokens')return res.end(JSON.stringify({token:'auth-'+body.api_key}));
  if(req.url==='/api/ecommerce/orders')return res.end(JSON.stringify({id:++next}));
  if(req.url==='/api/acceptance/payment_keys')return res.end(JSON.stringify({token:'pay-'+body.order_id}));
  res.statusCode=404;res.end('{}');});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {calls,origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>server.close(r))};
}

test('Paymob card payment confirms a held booking only on a genuine signed result',async()=>{
 const paymob=await fakePaymob();
 Object.assign(process.env,{SAFEER_PAYMOB_API_KEY:'test-key',SAFEER_PAYMOB_INTEGRATION_ID:'4242',SAFEER_PAYMOB_IFRAME_ID:'777',SAFEER_PAYMOB_HMAC_SECRET:secret,SAFEER_PAYMOB_BASE_URL:paymob.origin});
 try{await identityFixture(async f=>{
  const s=await setup(f,'card-eg');const company=ok(await f.admin.request(s.base),200).company;
  ok(await f.admin.request(s.base,'PATCH',{...company,id:undefined,countryCode:'EG',currency:'EGP',timezone:'Africa/Cairo',...s.pw}),200);
  const trip=await s.trip();
  const hold=async seat=>{const key=randomUUID();const r=ok(await f.client().request('public/holds','POST',{tripId:trip,seats:[seat],key,mobile:'01012345678',travelers:[{seat,name:'Fictional Traveler',luggage:null}]}));return {key,reference:r.reference,view:r};};

  // Off until the company turns it on.
  const first=await hold('1');assert.equal(first.view.cardPayment,false);
  assert.equal((await f.client().request(`public/holds/${first.reference}/card`,'POST',{key:first.key})).error.code,'METHOD_DISABLED');
  const counter=ok(await f.admin.request(s.base+'/counter'),200);assert.equal(counter.settings.card,false);assert.equal(counter.cardAvailable,true);
  ok(await f.admin.request(s.base+'/payment-settings','PUT',{bankTransfer:false,mobileWallet:false,card:true,version:counter.settings.version,...s.pw}),200);
  assert.equal(ok(await f.admin.request(s.base+'/counter'),200).settings.card,true);
  const again=ok(await f.client().request(`public/holds/${first.reference}`,'GET',undefined,{'x-booking-key':first.key}),200);
  assert.equal(again.cardPayment,true,'offered to the holder once the company takes cards');
  assert.equal(ok(await f.client().request(`public/holds/${first.reference}`,'GET',undefined,{'x-booking-key':first.key}),200).currency,'EGP');

  // Only the holder can start a card payment.
  assert.equal((await f.client().request(`public/holds/${first.reference}/card`,'POST',{key:randomUUID()})).status,404);
  const page=ok(await f.client().request(`public/holds/${first.reference}/card`,'POST',{key:first.key}));
  assert.match(page.url,new RegExp('^'+paymob.origin+'/api/acceptance/iframes/777\\?payment_token=pay-\\d+$'));
  const order=paymob.calls.find(c=>c.path==='/api/ecommerce/orders').body;
  assert.equal(order.currency,'EGP');assert.equal(order.amount_cents,150000);
  const orderId=page.url.match(/pay-(\d+)/)[1];

  // A forged result is ignored; the booking stays held.
  const paid=transaction(orderId,150000,true,'5550001');
  const cb=(obj,hmac)=>f.client().request('payments/paymob/callback?hmac='+hmac,'POST',{type:'TRANSACTION',obj});
  assert.equal(ok(await cb(paid,'0'.repeat(128))).received,false);
  assert.equal(ok(await cb({...paid,amount_cents:1},sign(paid))).received,false,'changed amount breaks the signature');
  const status=async ref=>(await f.migration.query('SELECT status FROM safeer.bookings WHERE reference=$1',[ref])).rows[0].status;
  assert.equal(await status(first.reference),'held');

  // The genuine result confirms and tickets the booking, once.
  assert.equal(ok(await cb(paid,sign(paid))).received,true);
  assert.equal(await status(first.reference),'confirmed');
  assert.equal(ok(await cb(paid,sign(paid))).received,true,'a repeated callback is accepted');
  const pays=(await f.migration.query("SELECT p.method,p.session_id,p.taken_by FROM safeer.payments p JOIN safeer.bookings b ON b.id=p.booking_id WHERE b.reference=$1",[first.reference])).rows;
  assert.deepEqual(pays,[{method:'card',session_id:null,taken_by:null}],'one card payment, no cash drawer');
  assert.equal((await f.migration.query('SELECT count(*)::int n FROM safeer.tickets t JOIN safeer.bookings b ON b.id=t.booking_id WHERE b.reference=$1',[first.reference])).rows[0].n,1);
  const view=ok(await f.client().request(`public/holds/${first.reference}`,'GET',undefined,{'x-booking-key':first.key}),200);
  assert.equal(view.status,'confirmed');assert.equal(view.cardPayment,false);assert.ok(view.tickets[0].qr,'ticket with QR');

  // D137: the card sale is in the whole-company finance report as Online card payments, and as its own method.
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo'}).format(new Date());
  const finance=ok(await f.admin.request(s.base+'/finance?'+new URLSearchParams({from:today,to:today})),200);
  const card=finance.movements.find(m=>m.method==='card');
  assert.ok(card,'card payment listed');assert.equal(card.stationEn,'Online card payments');assert.equal(finance.totals[0].salesMinor,'150000');
  assert.equal(ok(await f.admin.request(s.base+'/finance?'+new URLSearchParams({from:today,to:today,method:'card'})),200).movements.length,1);
  // Paymob returns the passenger to the booking (signed query, flat keys).
  const flat={};for(const p of signed){const v=pick(paid,p);flat[p==='order.id'?'order':p]=String(v);}
  const back=await fetch(f.api.origin+'/api/v1/payments/paymob/return?'+new URLSearchParams({...flat,hmac:sign(paid)}),{redirect:'manual',headers:{host:new URL(f.api.origin).host}});
  assert.equal(back.status,303);assert.equal(back.headers.get('location'),`/hold/${first.reference}?card=paid#passenger-ticket`);

  // A declined card leaves the booking held and can be retried.
  const second=await hold('2');
  const page2=ok(await f.client().request(`public/holds/${second.reference}/card`,'POST',{key:second.key}));
  const declined=transaction(page2.url.match(/pay-(\d+)/)[1],150000,false,'5550002');
  assert.equal(ok(await cb(declined,sign(declined))).received,true);
  assert.equal(await status(second.reference),'held');
  ok(await f.client().request(`public/holds/${second.reference}/card`,'POST',{key:second.key}));
 });}finally{for(const k of ['SAFEER_PAYMOB_API_KEY','SAFEER_PAYMOB_INTEGRATION_ID','SAFEER_PAYMOB_IFRAME_ID','SAFEER_PAYMOB_HMAC_SECRET','SAFEER_PAYMOB_BASE_URL'])delete process.env[k];await paymob.close();}
});
