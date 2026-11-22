// D144: MyFatoorah card payments for Kuwait, Saudi Arabia and Qatar (KNET, mada, NAPS, Visa/Mastercard, Apple Pay
// as enabled on the account). Safeer creates an invoice (SendPayment) and sends the passenger to MyFatoorah's
// hosted payment page; Safeer never sees card details. A result is never taken from the browser or a webhook body:
// Safeer asks MyFatoorah itself (GetPaymentStatus, with the account's private token) and records only that answer.
// Configuration, one account per country (each country's payments are switched on only when its token is set):
//   SAFEER_MYFATOORAH_TOKEN_KW, SAFEER_MYFATOORAH_TOKEN_SA, SAFEER_MYFATOORAH_TOKEN_QA
//   SAFEER_MYFATOORAH_TEST=1 uses MyFatoorah's test server; SAFEER_MYFATOORAH_BASE_URL overrides every base (tests).
// The API shapes follow MyFatoorah's v2 REST documentation; confirm them against the live account before launch.
import {currencyDigits} from './contract-pdf.js';
import {countries} from './countries.js';

export const myfatoorahCountries=['KW','SA','QA'] as const;
export type MyFatoorahCountry=typeof myfatoorahCountries[number];
const live:Record<MyFatoorahCountry,string>={KW:'https://api.myfatoorah.com',SA:'https://api-sa.myfatoorah.com',QA:'https://api-qa.myfatoorah.com'};
export type MyFatoorahConfig={country:MyFatoorahCountry,token:string,base:string,currency:string};

export function myfatoorahConfig(country:unknown,env=process.env):MyFatoorahConfig|null{
 if(typeof country!=='string'||!(myfatoorahCountries as readonly string[]).includes(country))return null;
 const code=country as MyFatoorahCountry,token=env['SAFEER_MYFATOORAH_TOKEN_'+code];
 if(!token||token.length<20||/\s/.test(token))return null;
 const base=(env.SAFEER_MYFATOORAH_BASE_URL||(env.SAFEER_MYFATOORAH_TEST==='1'?'https://apitest.myfatoorah.com':live[code])).replace(/\/+$/,'');
 if(!/^https:\/\//.test(base)&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))return null;
 return {country:code,token,base,currency:countries[code].currency};
}

async function call(config:MyFatoorahConfig,path:string,body:unknown){
 const response=await fetch(config.base+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.token},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const json=await response.json().catch(()=>null) as {IsSuccess?:boolean,Data?:Record<string,unknown>}|null;
 if(!response.ok||!json?.IsSuccess||!json.Data||typeof json.Data!=='object')throw Error(`MyFatoorah ${path} answered ${response.status}`);
 return json.Data;
}
/** Minor units to MyFatoorah's decimal amount, exact: 12345 KWD fils -> "12.345". */
export const majorAmount=(minor:number,currency:string)=>{const d=currencyDigits(currency),u=10**d;return d?`${Math.trunc(minor/u)}.${String(minor%u).padStart(d,'0')}`:String(minor);};
/** MyFatoorah's decimal amount back to minor units; null when it is not an exact amount in that currency. */
export const minorAmount=(value:unknown,currency:string)=>{
 const d=currencyDigits(currency),s=typeof value==='number'?value.toFixed(d):String(value??'');
 if(!/^\d{1,9}(\.\d+)?$/.test(s))return null;const [w,f='']=s.split('.');if(/[1-9]/.test(f.slice(d)))return null;
 const minor=Number(w)*10**d+Number((f+'0'.repeat(d)).slice(0,d)||'0');return Number.isSafeInteger(minor)?minor:null;
};

/** Creates the invoice; returns its id (Safeer stores it as "mf:<id>") and the hosted payment page. */
export async function myfatoorahCheckout(config:MyFatoorahConfig,{amountMinor,currency,checkoutId,reference,returnUrl,language}:{amountMinor:number,currency:string,checkoutId:string,reference:string,returnUrl:string,language:'en'|'ar'}){
 if(currency!==config.currency)throw Error('Currency does not match the MyFatoorah account');
 const data=await call(config,'/v2/SendPayment',{CustomerName:'Safeer passenger',NotificationOption:'LNK',InvoiceValue:Number(majorAmount(amountMinor,currency)),DisplayCurrencyIso:currency,
  CallBackUrl:returnUrl,ErrorUrl:returnUrl,Language:language,CustomerReference:checkoutId,UserDefinedField:reference,InvoiceItems:[{ItemName:'Safeer booking '+reference,Quantity:1,UnitPrice:Number(majorAmount(amountMinor,currency))}]});
 const invoice=String(data.InvoiceId??''),url=String(data.InvoiceURL??'');
 if(!/^[0-9]{1,20}$/.test(invoice)||!/^https:\/\/|^http:\/\/127\.0\.0\.1:\d+\//.test(url))throw Error('MyFatoorah gave no invoice');
 return {order:'mf:'+invoice,url};
}

/** Asks MyFatoorah for the invoice's real state. key is a PaymentId (return redirect) or an InvoiceId (webhook). */
export async function myfatoorahStatus(config:MyFatoorahConfig,key:string,kind:'PaymentId'|'InvoiceId'){
 if(!/^[0-9A-Za-z-]{1,64}$/.test(key))return null;
 const data=await call(config,'/v2/GetPaymentStatus',{Key:key,KeyType:kind});
 const invoice=String(data.InvoiceId??'');if(!/^[0-9]{1,20}$/.test(invoice))return null;
 const amount=minorAmount(data.InvoiceValue,config.currency);if(amount===null)return null;
 const paid=data.InvoiceStatus==='Paid';
 const transactions=Array.isArray(data.InvoiceTransactions)?data.InvoiceTransactions as Record<string,unknown>[]:[];
 const done=transactions.find(t=>/^succe?ss$/i.test(String(t.TransactionStatus??'')))||transactions[transactions.length-1];
 const transaction=String(done?.PaymentId??done?.TransactionId??(kind==='PaymentId'?key:'')).slice(0,64);
 return {order:'mf:'+invoice,checkoutId:String(data.CustomerReference??''),paid,amount,currency:config.currency,transaction:transaction||'mf-'+invoice};
}
