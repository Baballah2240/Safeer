import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatMinor} from '../src/finance-format.mjs';
import {financeCsv} from '../dist/api/finance.service.js';
test('financial formatting preserves integer precision and localizes both languages',()=>{
 assert.equal(formatMinor('900719925474099312','en','SDG'),'9,007,199,254,740,993.12 SDG');
 assert.equal(formatMinor('-150','en','SDG'),'−1.50 SDG');assert.match(formatMinor('123456','ar','SDG'),/SDG$/);
 assert.equal(formatMinor('NaN'),'—');assert.equal(formatMinor('12','en','<bad>'),'—');
});
test('CSV neutralizes formula labels and preserves quoted Arabic, commas and numeric refunds',()=>{
 const value=financeCsv([{document:'RFD-1',kind:'refund',at:'2026-11-03T10:00:00Z',method:'cash',currency:'SDG',amountMinor:'150',employee:' =HYPERLINK("bad")',stationEn:'A, B',stationAr:'محطة',routeEn:'@SUM(1)',routeAr:'خط',tickets:2}]);
 assert.ok(value.includes('"-150"'));assert.ok(value.includes('"\' =HYPERLINK(""bad"")"'));assert.ok(value.includes('"\'@SUM(1)"'));assert.ok(value.includes('"A, B"'));assert.ok(value.includes('محطة'));
 assert.throws(()=>financeCsv([{amountMinor:'=SUM(1)',tickets:1}]),/Invalid numeric export/);
});
