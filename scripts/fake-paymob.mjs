// D136 (local development only): a stand-in for Paymob so card payments can be tried without a merchant
// account. It answers the three Accept API calls Safeer makes, shows a test card page with "Pay (test)" and
// "Decline (test)", sends the signed server callback to Safeer and returns the passenger, exactly like Paymob.
// No real card or money is involved. Start it, then start Safeer with the printed SAFEER_PAYMOB_* settings:
//   node scripts/fake-paymob.mjs            (SAFEER_ORIGIN defaults to http://127.0.0.1:4330)
import {createServer} from 'node:http';
import {createHmac,randomBytes} from 'node:crypto';

const port=Number(process.env.FAKE_PAYMOB_PORT||4339),safeer=(process.env.SAFEER_ORIGIN||'http://127.0.0.1:4330').replace(/\/+$/,'');
const secret=process.env.SAFEER_PAYMOB_HMAC_SECRET||randomBytes(24).toString('hex');
const signed=['amount_cents','created_at','currency','error_occured','has_parent_transaction','id','integration_id','is_3d_secure','is_auth','is_capture','is_refunded','is_standalone_payment','is_voided','order.id','owner','pending','source_data.pan','source_data.sub_type','source_data.type','success'];
const pick=(o,p)=>p.split('.').reduce((v,k)=>v?.[k],o);
const sign=obj=>createHmac('sha512',secret).update(signed.map(p=>{const v=pick(obj,p);return v===undefined||v===null?'':String(v);}).join('')).digest('hex');
const orders=new Map(),keys=new Map();let nextOrder=700000,nextTransaction=8800000;
const html=s=>String(s).replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);

createServer((req,res)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>1e5)req.destroy();});req.on('end',async()=>{
 const url=new URL(req.url,'http://127.0.0.1'),json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 let body={};try{body=raw&&req.headers['content-type']?.includes('json')?JSON.parse(raw):Object.fromEntries(new URLSearchParams(raw));}catch{}
 if(req.method==='POST'&&url.pathname==='/api/auth/tokens')return json({token:'fake-auth'});
 if(req.method==='POST'&&url.pathname==='/api/ecommerce/orders'){const id=++nextOrder;orders.set(id,{amount:body.amount_cents,currency:body.currency,name:body.items?.[0]?.name||''});return json({id});}
 if(req.method==='POST'&&url.pathname==='/api/acceptance/payment_keys'){const token='fake-'+randomBytes(12).toString('hex');keys.set(token,Number(body.order_id));return json({token});}
 const page=/^\/api\/acceptance\/iframes\/\d+$/.test(url.pathname);
 if(req.method==='GET'&&page){const order=orders.get(keys.get(url.searchParams.get('payment_token')));if(!order){res.statusCode=404;return res.end('Unknown payment');}
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test card page</title><body style="font-family:system-ui;max-width:420px;margin:48px auto;padding:0 16px"><p style="background:#fff3cd;padding:12px;border-radius:12px">Local test page (stand-in for Paymob). No real card or money.</p><h1>${html(order.name)}</h1><p style="font-size:24px"><b>${(order.amount/100).toFixed(2)} ${html(order.currency)}</b></p><form method="post" action="/pay"><input type="hidden" name="token" value="${html(url.searchParams.get('payment_token'))}"><button name="result" value="ok" style="width:100%;height:48px;border-radius:12px;background:#b9530f;color:#fff;border:0;font-size:16px">Pay (test)</button><p></p><button name="result" value="declined" style="width:100%;height:48px;border-radius:12px;border:1px solid #999;background:#fff;font-size:16px">Decline (test)</button></form>`);}
 if(req.method==='POST'&&url.pathname==='/pay'){const id=keys.get(body.token),order=orders.get(id);if(!order){res.statusCode=404;return res.end('Unknown payment');}
  const ok=body.result==='ok',obj={id:++nextTransaction,pending:false,amount_cents:order.amount,success:ok,is_auth:false,is_capture:false,is_standalone_payment:true,is_voided:false,is_refunded:false,is_3d_secure:true,integration_id:1,has_parent_transaction:false,error_occured:!ok,owner:1,created_at:new Date().toISOString(),currency:order.currency,order:{id},source_data:{pan:'4242',sub_type:'Visa',type:'card'}},hmac=sign(obj);
  try{await fetch(`${safeer}/api/v1/payments/paymob/callback?hmac=${hmac}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'TRANSACTION',obj})});}catch(error){console.error('Could not reach Safeer callback:',error.message);}
  const flat={};for(const p of signed){flat[p==='order.id'?'order':p]=String(pick(obj,p));}
  res.writeHead(303,{Location:`${safeer}/api/v1/payments/paymob/return?${new URLSearchParams({...flat,hmac})}`});return res.end();}
 res.statusCode=404;res.end('Not found');
});}).listen(port,'127.0.0.1',()=>{
 console.log(`Fake Paymob (local test only) on http://127.0.0.1:${port}, returning passengers to ${safeer}`);
 console.log(`Start Safeer with: SAFEER_PAYMOB_API_KEY=local-test SAFEER_PAYMOB_INTEGRATION_ID=1 SAFEER_PAYMOB_IFRAME_ID=1 SAFEER_PAYMOB_HMAC_SECRET=${secret} SAFEER_PAYMOB_BASE_URL=http://127.0.0.1:${port}`);
});
