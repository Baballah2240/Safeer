// D143: money decimals follow the currency (ISO 4217) everywhere: Kuwaiti and Libyan dinars 3, CFA franc 0,
// the other currencies Safeer serves 2. Web, PDFs and the Flutter apps use the same table.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {currencyDigits,minorFromText,textFromMinor,moneyFormat,amountStep,amountPattern} from '../src/money.mjs';
import {formatMinor} from '../src/finance-format.mjs';
import {countries} from '../src/countries.js';
test('every served currency has the right number of decimals',()=>{
 const want={SDG:2,EGP:2,SSP:2,SAR:2,QAR:2,KWD:3,LYD:3,XAF:0,ETB:2,ERN:2};
 for(const [code,[,currency]] of Object.entries(countries))assert.equal(currencyDigits(currency),want[currency],code+' '+currency);
 for(const [c,d] of Object.entries(want))assert.equal(new Intl.NumberFormat('en',{style:'currency',currency:c}).resolvedOptions().maximumFractionDigits,d,c+' matches the browser');
});
test('typed amounts become exact minor units and back',()=>{
 assert.equal(minorFromText('25,000.50','EGP'),'2500050');assert.equal(minorFromText('12.345','KWD'),'12345');assert.equal(minorFromText('12.3','KWD'),'12300');
 assert.equal(minorFromText('500','XAF'),'500');assert.equal(minorFromText('10','KWD'),'10000');assert.equal(minorFromText('99999999999.99','SDG'),'9999999999999');
 for(const [v,c] of [['1.5','XAF'],['1.234','EGP'],['1.2345','KWD'],['-1','SDG'],['1e3','SDG'],['','SDG'],['abc','KWD']])assert.throws(()=>minorFromText(v,c),/INVALID_AMOUNT/,v+' '+c);
 assert.equal(textFromMinor('12345','KWD'),'12.345');assert.equal(textFromMinor('500','XAF'),'500');assert.equal(textFromMinor('2500050','EGP'),'25000.50');assert.equal(textFromMinor('-150','SDG'),'-1.50');
 assert.deepEqual([amountStep('KWD'),amountStep('XAF'),amountStep('SDG')],['0.001','1','0.01']);
 assert.ok(new RegExp('^'+amountPattern('KWD')+'$').test('1,234.567'));assert.equal(new RegExp('^'+amountPattern('XAF')+'$').test('1.5'),false);
});
test('shown amounts use the currency decimals',()=>{
 assert.equal(formatMinor('12345','en','KWD'),'12.345 KWD');assert.equal(formatMinor('500','en','XAF'),'500 XAF');assert.equal(formatMinor('150050','en','EGP'),'1,500.50 EGP');
 assert.match(moneyFormat(12345,'KWD','en-GB'),/12\.345/);assert.match(moneyFormat(500,'XAF','en-GB'),/500$/);assert.match(moneyFormat(150000,'SDG','en-GB',{dropWholeDecimals:true}),/1,500$/);
});
test('the PDF and Flutter tables match the web table',()=>{
 const pdf=readFileSync(new URL('../apps/api/src/contract-pdf.ts',import.meta.url),'utf8'),dart=readFileSync(new URL('../mobile/flutter/packages/safeer_core/lib/src/format.dart',import.meta.url),'utf8');
 for(const [c,d] of [['KWD',3],['LYD',3],['XAF',0]]){assert.ok(pdf.includes(`${c}:${d}`),'PDF '+c);assert.ok(dart.includes(`'${c}': ${d}`),'Flutter '+c);}
});
