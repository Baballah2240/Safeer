import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identityFixture} from './support/identity-db.mjs';
import {ok,setup,paid,staff} from './support/boarding-fixture.mjs';

// D87: the Safeer owner issues a monthly invoice from the accepted contract: the monthly fee plus the commission
// on the month's net collections. The company sees it, downloads it, and the owner marks it paid or voids it.
const lastMonth=()=>{const n=new Date();return new Date(Date.UTC(n.getUTCFullYear(),n.getUTCMonth()-1,1)).toISOString().slice(0,7);};

test('a monthly invoice charges the fee plus commission on net collections and is settled once',async()=>identityFixture(async f=>{
 const s=await setup(f,'invoice-co'),trip=await s.trip(),month=lastMonth(),before=new Date(Date.UTC(+month.slice(0,4),+month.slice(5)-2,1)).toISOString().slice(0,7);
 await paid(f,s,trip,['1','2']);
 const manager=await staff(f,s,['company.profile.manage']),mpw={currentPassword:manager.pass},plain=await staff(f,s,['company.trips.read']);
 const issue=(who,m,pw)=>who.request(s.base+'/invoices','POST',{month:m,...pw});
 const today=new Date().toISOString().slice(0,10);ok(await f.admin.request(s.base+'/billing','PUT',{monthlyFeeMinor:'2500000',commissionBps:350,currency:'SDG',startsOn:today,endsOn:new Date(Date.now()+365*864e5).toISOString().slice(0,10),...s.pw}),200);
 // D115: contracts cannot start in the past, so this one is moved back to last month directly (triggers off) to test billing.
 await f.migration.query('SET session_replication_role=replica');await f.migration.query("UPDATE safeer.company_contracts SET starts_on=$2::date WHERE company_id=$1",[s.cid,month+'-01']);await f.migration.query('SET session_replication_role=DEFAULT');
 assert.equal((await issue(f.admin,month,s.pw)).error?.code,'INVOICE_NO_CONTRACT','An unaccepted contract is not billed.');
 const contract=ok(await manager.c.request(s.base+'/billing'),200).contracts[0];
 ok(await manager.c.request(`${s.base}/contracts/${contract.id}/accept`,'POST',mpw));
 assert.equal((await issue(f.admin,new Date().toISOString().slice(0,7),s.pw)).error?.code,'INVOICE_PERIOD_OPEN','The current month is not billed yet.');
 assert.equal((await issue(f.admin,before,s.pw)).error?.code,'INVOICE_NO_CONTRACT','Months before the contract starts are not billed.');
 assert.equal((await issue(f.admin,'2026-13',s.pw)).error?.code,'INVALID_PERIOD');
 assert.equal((await issue(manager.c,month,mpw)).status,403,'Only the Safeer owner issues invoices.');
 // Move the recorded payments into last month (payments are otherwise unchangeable).
 await f.migration.query('ALTER TABLE safeer.payments DISABLE TRIGGER money_guard');
 await f.migration.query(`UPDATE safeer.payments SET created_at=($1||'-15 12:00:00+00')::timestamptz WHERE company_id=$2`,[month,s.cid]);
 await f.migration.query('ALTER TABLE safeer.payments ENABLE TRIGGER money_guard');
 const collected=BigInt((await f.migration.query('SELECT sum(amount_minor)::text AS v FROM safeer.payments WHERE company_id=$1',[s.cid])).rows[0].v);assert.ok(collected>0n);
 const first=ok(await issue(f.admin,month,s.pw));
 const commission=(collected*350n+5000n)/10000n;
 assert.match(first.number,/^INV-\d{4}-\d{5}$/);assert.equal(first.month,month);assert.equal(first.status,'issued');
 assert.deepEqual([first.feeMinor,first.paymentsMinor,first.refundsMinor,first.commissionMinor,first.totalMinor],['2500000',collected.toString(),'0',commission.toString(),(2500000n+commission).toString()]);
 assert.equal((await issue(f.admin,month,s.pw)).error?.code,'INVOICE_EXISTS','One live invoice per month.');
 // The company sees it and receives it; other staff do not.
 assert.equal(ok(await manager.c.request(s.base+'/billing'),200).invoices[0].id,first.id);
 assert.equal((await plain.c.request(s.base+'/billing')).status,403);
 assert.ok(ok(await manager.c.request('notifications'),200).items.some(n=>n.code==='invoice.issued'&&n.sourceId===first.id),'The company is notified.');
 assert.ok(!ok(await plain.c.request('notifications'),200).items.some(n=>n.code.startsWith('invoice.')));
 for(const lang of ['en','ar']){const pdf=await manager.c.request(`${s.base}/invoices/${first.id}/pdf?lang=${lang}`);assert.equal(pdf.status,200);assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.ok(pdf.raw.startsWith('%PDF-1.4'));}
 assert.ok((await manager.c.request(`${s.base}/invoices/${first.id}/pdf`)).raw.includes('SDG 25,000.00'),'The fee is on the PDF.');
 assert.equal((await plain.c.request(`${s.base}/invoices/${first.id}/pdf`)).status,404);
 // Void and reissue, then settle once.
 assert.equal((await manager.c.request(`${s.base}/invoices/${first.id}/void`,'POST',{reason:'x',...mpw})).status,403);
 assert.equal((await f.admin.request(`${s.base}/invoices/${first.id}/void`,'POST',{reason:'',...s.pw})).status,400);
 assert.equal(ok(await f.admin.request(`${s.base}/invoices/${first.id}/void`,'POST',{reason:'Wrong start date',...s.pw})).status,'void');
 const second=ok(await issue(f.admin,month,s.pw));assert.notEqual(second.number,first.number);
 assert.equal(ok(await f.admin.request(`${s.base}/invoices/${second.id}/paid`,'POST',{reference:'BANK-7781',...s.pw})).status,'paid');
 assert.equal((await f.admin.request(`${s.base}/invoices/${second.id}/paid`,'POST',{reference:'again',...s.pw})).error?.code,'INVOICE_CLOSED');
 assert.equal((await f.admin.request(`${s.base}/invoices/${second.id}/void`,'POST',{reason:'late',...s.pw})).error?.code,'INVOICE_CLOSED','A paid invoice cannot be voided.');
 assert.ok(ok(await manager.c.request('notifications'),200).items.some(n=>n.code==='invoice.paid'&&n.sourceId===second.id));
 assert.ok((await manager.c.request(`${s.base}/invoices/${second.id}/pdf`)).raw.includes('BANK-7781'),'The PDF shows the payment.');
 // The runtime role cannot write invoices directly.
 const direct=await f.migration.query(`SELECT has_table_privilege($1,'safeer.company_invoices','UPDATE') AS u,has_table_privilege($1,'safeer.company_invoices','INSERT') AS i`,[new URL(f.runtimeUrl).username]);
 assert.deepEqual(direct.rows[0],{u:false,i:false});
}));
