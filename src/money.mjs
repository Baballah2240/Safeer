// D143: money is stored in whole minor units, but currencies differ in how many decimals they have (ISO 4217):
// Kuwaiti and Libyan dinars 3 (fils, dirhams), the Central African CFA franc 0, the others Safeer serves 2.
// Every place that shows money or reads a typed amount must use these helpers, never /100 or *100.
const EXPONENT={KWD:3,LYD:3,BHD:3,OMR:3,JOD:3,TND:3,IQD:3,XAF:0,XOF:0,JPY:0,KRW:0,UGX:0,RWF:0,DJF:0,GNF:0,KMF:0,VND:0};
export const currencyDigits=currency=>EXPONENT[currency]??2;
const unit=currency=>10n**BigInt(currencyDigits(currency));

/** "25,000.50" in EGP -> "2500050"; "12.345" in KWD -> "12345"; "500" in XAF -> "500". Exact, no floating point. */
export function minorFromText(value,currency,{maxWhole=12}={}){
  const d=currencyDigits(currency),s=String(value??'').replace(/[,\s]/g,'');
  const pattern=d?new RegExp(`^\\d{1,${maxWhole}}(\\.\\d{1,${d}})?$`):new RegExp(`^\\d{1,${maxWhole}}$`);
  if(!pattern.test(s))throw Error('INVALID_AMOUNT');
  const [whole,fraction='']=s.split('.');
  return (BigInt(whole)*unit(currency)+BigInt((fraction+'0'.repeat(d)).slice(0,d)||'0')).toString();
}
/** The amount as plain text for an input field: "25000.50", "12.345", "500". */
export function textFromMinor(minor,currency){
  const d=currencyDigits(currency),v=BigInt(minor??0),u=unit(currency),neg=v<0n,a=neg?-v:v;
  return (neg?'-':'')+(a/u).toString()+(d?'.'+(a%u).toString().padStart(d,'0'):'');
}
/** A number for Intl.NumberFormat (fine for display; use the text helpers for exact values). */
export const majorNumber=(minor,currency)=>Number(minor??0)/10**currencyDigits(currency);
/** The step and pattern for an amount input in this currency. */
export const amountStep=currency=>{const d=currencyDigits(currency);return d?'0.'+'0'.repeat(d-1)+'1':'1';};
export const amountPattern=currency=>{const d=currencyDigits(currency);return d?`[0-9][0-9,]*(\\.[0-9]{1,${d}})?`:'[0-9][0-9,]*';};
/** Formatted with the currency, the currency's own decimals; whole amounts drop the decimals when asked. */
export function moneyFormat(minor,currency,locale,{dropWholeDecimals=false}={}){
  const d=currencyDigits(currency),whole=BigInt(minor??0)%unit(currency)===0n,digits=dropWholeDecimals&&whole?0:d;
  try{return new Intl.NumberFormat(locale,{style:'currency',currency,minimumFractionDigits:digits,maximumFractionDigits:digits}).format(majorNumber(minor,currency));}
  catch{return textFromMinor(minor,currency)+' '+currency;}
}
