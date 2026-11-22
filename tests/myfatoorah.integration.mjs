// D144: card payment through MyFatoorah (Kuwait, Saudi Arabia, Qatar), against a local fake MyFatoorah. Only
// MyFatoorah's own answer, fetched with the private token, confirms a booking: a return link or webhook body alone
// never does. Amounts use the currency's decimals (KWD has 3).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';
import {ok,setup} from './support/boarding-fixture.mjs';

const token='test-token-kw-'+randomUUID();
async function fakeMyFatoorah(){
 const invoices=new Map(),calls=[];let next=7000;
 const server=createServer((req,res)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{const body=JSON.parse(raw||'{}');calls.push({path:req.url,body,auth:req.headers.authorization});res.setHeader('Content-Type','application/json');
  if(req.headers.authorization!=='Bearer '+token){res.statusCode=401;return res.end(JSON.stringify({IsSuccess:false}));}
  if(req.url==='/v2/SendPayment'){const id=++next;invoices.set(String(id),{value:body.InvoiceValue,ref:body.CustomerReference,status:'Pending'});return res.end(JSON.stringify({IsSuccess:true,Data:{InvoiceId:id,InvoiceURL:`http://127.0.0.1:${server.address().port}/pay/${id}`}}));}
  if(req.url==='/v2/GetPaymentStatus'){const id=body.KeyType==='PaymentId'?String(body.Key).replace(/^P/,''):String(body.Key),i=invoices.get(id);if(!i){res.statusCode=400;return res.end(JSON.stringify({IsSuccess:false}));}
   return res.end(JSON.stringify({IsSuccess:true,Data:{InvoiceId:Number(id),InvoiceStatus:i.status,InvoiceValue:i.paidValue??i.value,CustomerReference:i.ref,InvoiceTransactions:i.status==='Paid'?[{TransactionStatus:'Succss',PaymentId:'P'+id}]:[{TransactionStatus:'Failed',PaymentId:'P'+id}]}}));}
  res.statusCode=404;res.end('{}');});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {calls,invoices,origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>server.close(r))};
}

test('MyFatoorah confirms a Kuwaiti booking only on its own Paid answer',async()=>{
 const mf=await fakeMyFatoorah();
 Object.assign(process.env,{SAFEER_MYFATOORAH_TOKEN_KW:token,SAFEER_MYFATOORAH_BASE_URL:mf.origin});
 try{await identityFixture(async f=>{
  const s=await setup(f,'card-kw'),sd=await setup(f,'card-sd');const company=ok(await f.admin.request(s.base),200).company;
  ok(await f.admin.request(s.base,'PATCH',{...company,id:undefined,countryCode:'KW',currency:'KWD',timezone:'Asia/Kuwait',...s.pw}),200);
  // Cards are offered only where the company's country has a ready provider.
  assert.equal(ok(await f.admin.request(sd.base+'/counter'),200).cardAvailable,false,'no card provider for Sudan');
  const counter=ok(await f.admin.request(s.base+'/counter'),200);assert.equal(counter.cardAvailable,true,'MyFatoorah ready for Kuwait');
  ok(await f.admin.request(s.base+'/payment-settings','PUT',{bankTransfer:false,mobileWallet:false,card:true,version:counter.settings.version,...s.pw}),200);
  const trip=await s.trip();
  const hold=async seat=>{const key=randomUUID();const r=ok(await f.client().request('public/holds','POST',{tripId:trip,seats:[seat],key,mobile:'51234567',travelers:[{seat,name:'Fictional Traveler',luggage:null}]}));return {key,reference:r.reference};};
  const first=await hold('1');
  assert.equal(ok(await f.client().request(`public/holds/${first.reference}`,'GET',undefined,{'x-booking-key':first.key}),200).cardPayment,true);
  const page=ok(await f.client().request(`public/holds/${first.reference}/card`,'POST',{key:first.key,language:'ar'}));
  const sent=mf.calls.find(c=>c.path==='/v2/SendPayment').body,invoice=page.url.match(/\/pay\/(\d+)$/)[1];
  assert.equal(sent.InvoiceValue,150,'150000 fils is 150.000 KWD');assert.equal(sent.DisplayCurrencyIso,'KWD');assert.equal(sent.Language,'ar');assert.match(sent.CallBackUrl,/\/api\/v1\/payments\/myfatoorah\/return\?c=KW$/);
  const status=async ref=>(await f.migration.query('SELECT status FROM safeer.bookings WHERE reference=$1',[ref])).rows[0].status;
  const back=async query=>{const r=await fetch(f.api.origin+'/api/v1/payments/myfatoorah/return?'+new URLSearchParams(query),{redirect:'manual',headers:{host:new URL(f.api.origin).host}});return [r.status,r.headers.get('location')];};
  // Returning before paying, or with a made-up or wrong-country id, confirms nothing.
  assert.deepEqual(await back({c:'KW',paymentId:'P'+invoice}),[303,`/hold/${first.reference}?card=failed#passenger-ticket`]);
  assert.deepEqual(await back({c:'KW',paymentId:'P99999'}),[303,'/booking?card=unknown']);
  assert.deepEqual(await back({c:'SA',paymentId:'P'+invoice}),[303,'/booking?card=unknown'],'no Saudi account configured');
  assert.equal(ok(await f.client().request('payments/myfatoorah/webhook','POST',{Data:{InvoiceId:Number(invoice),InvoiceStatus:'Paid'}})).received,true,'webhook asks MyFatoorah, which says not paid');
  assert.equal(await status(first.reference),'held','a webhook body saying Paid is not believed');
  // MyFatoorah says Paid: the webhook confirms and tickets once; the return link shows paid.
  mf.invoices.get(invoice).status='Paid';
  assert.equal(ok(await f.client().request('payments/myfatoorah/webhook','POST',{Data:{InvoiceId:Number(invoice)}})).received,true);
  assert.equal(await status(first.reference),'confirmed');
  assert.deepEqual(await back({c:'KW',paymentId:'P'+invoice}),[303,`/hold/${first.reference}?card=paid#passenger-ticket`]);
  const pays=(await f.migration.query("SELECT p.method,p.amount_minor,p.currency,p.method_reference FROM safeer.payments p JOIN safeer.bookings b ON b.id=p.booking_id WHERE b.reference=$1",[first.reference])).rows;
  assert.deepEqual(pays,[{method:'card',amount_minor:150000,currency:'KWD',method_reference:'P'+invoice}]);
  assert.ok(mf.calls.every(c=>c.auth==='Bearer '+token),'every call uses the private token');
  // A paid amount that differs from the booking is never recorded.
  const second=await hold('2');const page2=ok(await f.client().request(`public/holds/${second.reference}/card`,'POST',{key:second.key}));
  const inv2=page2.url.match(/\/pay\/(\d+)$/)[1];Object.assign(mf.invoices.get(inv2),{status:'Paid',paidValue:1.5});
  assert.equal(ok(await f.client().request('payments/myfatoorah/webhook','POST',{Data:{InvoiceId:Number(inv2)}})).received,false);
  assert.equal(await status(second.reference),'held');
  for(const bad of [{},{Data:null},{Data:{InvoiceId:'1 OR 1=1'}},{Data:{InvoiceId:-1}}])assert.equal(ok(await f.client().request('payments/myfatoorah/webhook','POST',bad)).received,false);
 });}finally{for(const k of ['SAFEER_MYFATOORAH_TOKEN_KW','SAFEER_MYFATOORAH_BASE_URL'])delete process.env[k];await mf.close();}
});
