// D136: Paymob card payments (Egypt). Uses Paymob's Accept API: authenticate, register an order, create a payment
// key, then send the passenger to Paymob's hosted card page (Safeer never sees card details). Paymob reports the
// result to /api/v1/payments/paymob/callback (server to server) and returns the passenger to .../return; both are
// signed with the account's HMAC secret, which is checked before anything is recorded.
// Configuration (all required to switch card payments on; otherwise they stay off):
//   SAFEER_PAYMOB_API_KEY, SAFEER_PAYMOB_INTEGRATION_ID, SAFEER_PAYMOB_IFRAME_ID, SAFEER_PAYMOB_HMAC_SECRET
//   SAFEER_PAYMOB_BASE_URL (optional, default https://accept.paymob.com; tests point it at a local fake).
import {createHmac,timingSafeEqual} from 'node:crypto';

export type PaymobConfig={apiKey:string,integrationId:number,iframeId:string,hmacSecret:string,base:string};

export function paymobConfig(env=process.env):PaymobConfig|null{
 const apiKey=env.SAFEER_PAYMOB_API_KEY,integration=Number(env.SAFEER_PAYMOB_INTEGRATION_ID),iframeId=env.SAFEER_PAYMOB_IFRAME_ID,hmacSecret=env.SAFEER_PAYMOB_HMAC_SECRET;
 if(!apiKey||!Number.isSafeInteger(integration)||integration<=0||!iframeId||!/^[0-9]+$/.test(iframeId)||!hmacSecret)return null;
 const base=(env.SAFEER_PAYMOB_BASE_URL||'https://accept.paymob.com').replace(/\/+$/,'');
 if(!/^https:\/\//.test(base)&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))return null;
 return {apiKey,integrationId:integration,iframeId,hmacSecret,base};
}

async function post(config:PaymobConfig,path:string,body:unknown){
 const response=await fetch(config.base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(`Paymob ${path} answered ${response.status}`);
 return response.json() as Promise<Record<string,unknown>>;
}

/** Registers the order and returns Paymob's order id and the hosted card page for the passenger. */
export async function paymobCheckout(config:PaymobConfig,{amountMinor,currency,merchantOrderId,reference}:{amountMinor:number,currency:string,merchantOrderId:string,reference:string}){
 const auth=await post(config,'/api/auth/tokens',{api_key:config.apiKey});
 const token=String(auth.token||'');if(!token)throw Error('Paymob gave no token');
 const order=await post(config,'/api/ecommerce/orders',{auth_token:token,delivery_needed:false,amount_cents:amountMinor,currency,merchant_order_id:merchantOrderId,items:[{name:'Safeer booking '+reference,amount_cents:amountMinor,quantity:1}]});
 const orderId=String(order.id||'');if(!/^[0-9]{1,30}$/.test(orderId))throw Error('Paymob gave no order');
 // Paymob requires billing fields; the hosted page asks the passenger for card details itself.
 const billing={first_name:'Safeer',last_name:'Passenger',email:'NA',phone_number:'NA',apartment:'NA',floor:'NA',street:'NA',building:'NA',shipping_method:'NA',postal_code:'NA',city:'NA',country:'NA',state:'NA'};
 const key=await post(config,'/api/acceptance/payment_keys',{auth_token:token,amount_cents:amountMinor,expiration:1800,order_id:orderId,billing_data:billing,currency,integration_id:config.integrationId});
 const paymentToken=String(key.token||'');if(!paymentToken)throw Error('Paymob gave no payment key');
 return {orderId,url:`${config.base}/api/acceptance/iframes/${config.iframeId}?payment_token=${encodeURIComponent(paymentToken)}`};
}

// Paymob signs these transaction fields, in this order, joined without separators (HMAC-SHA512).
const signed=['amount_cents','created_at','currency','error_occured','has_parent_transaction','id','integration_id','is_3d_secure','is_auth','is_capture','is_refunded','is_standalone_payment','is_voided','order.id','owner','pending','source_data.pan','source_data.sub_type','source_data.type','success'];
const pick=(object:Record<string,unknown>,path:string):unknown=>path.split('.').reduce<unknown>((value,key)=>value&&typeof value==='object'?(value as Record<string,unknown>)[key]:undefined,object);
const text=(value:unknown)=>value===undefined||value===null?'':typeof value==='boolean'?String(value):String(value);

/** Verifies a callback. `fields` is the transaction object (callback body `obj`) or the flat query of the return
 * redirect (keys like "order" and "source_data.pan"). Returns the facts Safeer records, or null when not genuine. */
export function paymobVerify(config:PaymobConfig,fields:Record<string,unknown>,hmac:unknown,flat=false){
 if(typeof hmac!=='string'||!/^[0-9a-f]{128}$/i.test(hmac))return null;
 const get=(path:string)=>flat?fields[path==='order.id'?'order':path]:pick(fields,path);
 const expected=createHmac('sha512',config.hmacSecret).update(signed.map(path=>text(get(path))).join('')).digest();
 if(!timingSafeEqual(expected,Buffer.from(hmac,'hex')))return null;
 const order=text(get('order.id')),transaction=text(get('id')),amount=Number(text(get('amount_cents'))),currency=text(get('currency'));
 if(!/^[0-9]{1,30}$/.test(order)||!/^[0-9]{1,30}$/.test(transaction)||!Number.isSafeInteger(amount))return null;
 const success=text(get('success'))==='true'&&text(get('pending'))!=='true'&&text(get('is_voided'))!=='true'&&text(get('is_refunded'))!=='true';
 return {order,transaction,amount,currency,success};
}
