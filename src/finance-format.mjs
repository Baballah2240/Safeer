/** Money stays in integer minor units, including values beyond Number.MAX_SAFE_INTEGER. */
export function formatMinor(value,language='en',currency='SDG'){
 if(!/^-?\d+$/.test(String(value))||!/^[A-Z]{3}$/.test(currency))return '—';
 const n=BigInt(value),absolute=n<0n?-n:n,locale=language==='ar'?'ar-SD':'en-GB';
 const integer=new Intl.NumberFormat(locale,{maximumFractionDigits:0}).format(absolute/100n);
 const decimal=new Intl.NumberFormat(locale).formatToParts(1.1).find(p=>p.type==='decimal').value;
 const cents=new Intl.NumberFormat(locale,{minimumIntegerDigits:2,maximumFractionDigits:0,useGrouping:false}).format(absolute%100n);
 return `${n<0n?'−':''}${integer}${decimal}${cents} ${currency}`;
}
