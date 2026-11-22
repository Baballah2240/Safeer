import {currencyDigits} from './money.mjs';
/** Money stays in integer minor units, including values beyond Number.MAX_SAFE_INTEGER. D143: decimals follow the currency. */
export function formatMinor(value,language='en',currency='SDG'){
 if(!/^-?\d+$/.test(String(value))||!/^[A-Z]{3}$/.test(currency))return '—';
 const n=BigInt(value),absolute=n<0n?-n:n,locale=language==='ar'?'ar-SD':'en-GB';
 const digits=currencyDigits(currency),unit=10n**BigInt(digits);
 const integer=new Intl.NumberFormat(locale,{maximumFractionDigits:0}).format(absolute/unit);
 const decimal=new Intl.NumberFormat(locale).formatToParts(1.1).find(p=>p.type==='decimal').value;
 if(!digits)return `${n<0n?'−':''}${integer} ${currency}`;
 const cents=new Intl.NumberFormat(locale,{minimumIntegerDigits:digits,maximumFractionDigits:0,useGrouping:false}).format(absolute%unit);
 return `${n<0n?'−':''}${integer}${decimal}${cents} ${currency}`;
}
