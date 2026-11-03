// Fictional historical fixture, used only inside identityFixture's disposable database.
// Complete refunded sales share a released seat; no active inventory is duplicated.
export async function financeVolume(f,s,count=10001){
 const actor=(await f.admin.request('auth/me')).data.id;
 await f.migration.query('BEGIN');
 try{
  await f.migration.query('SET LOCAL session_replication_role=replica');
  await f.migration.query('CREATE TEMP TABLE financial_volume ON COMMIT DROP AS SELECT n,gen_random_uuid() AS booking,gen_random_uuid() AS payment,gen_random_uuid() AS allocation FROM generate_series(1,$1::integer) n',[count]);
  await f.migration.query(`INSERT INTO safeer.bookings(id,company_id,trip_id,reference,access_hash,request_hash,status,hold_minutes,expires_at,seat_count,fare_minor,amount_minor,currency,created_at,closed_at)
   SELECT booking,$1,$2,'SF-'||translate(lpad(to_hex(n+100000),8,'0'),'0123456789abcdef','23456789ABCDEFGH'),md5('access'||n)||md5('second'||n),md5('request'||n)||md5('second'||n),'refunded',30,now()+interval '30 minutes',1,150000,150000,'SDG',now()-interval '1 minute',now() FROM financial_volume`,[s.cid,s.tid]);
  await f.migration.query(`INSERT INTO safeer.seat_allocations(id,company_id,trip_id,booking_id,layout_id,layout_revision,row_number,column_number,label,segment,status,expires_at)
   SELECT v.allocation,$1,$2,v.booking,a.layout_id,a.layout_revision,1,1,'1',int4range(0,1),'released',now()+interval '30 minutes' FROM financial_volume v CROSS JOIN safeer.trip_assignments a WHERE a.company_id=$1 AND a.trip_id=$2 AND a.replaced_at IS NULL`,[s.cid,s.tid]);
  await f.migration.query(`INSERT INTO safeer.payments(id,company_id,booking_id,session_id,method,amount_minor,currency,taken_by,key_hash,request_hash)
   SELECT v.payment,$1,v.booking,s.id,'cash',150000,'SDG',$2,md5('pay'||v.n)||md5('second'||v.n),md5('request'||v.n)||md5('second'||v.n) FROM financial_volume v CROSS JOIN safeer.cash_sessions s WHERE s.company_id=$1 AND s.closed_at IS NULL`,[s.cid,actor]);
  await f.migration.query(`INSERT INTO safeer.receipts(company_id,payment_id,receipt_number) SELECT $1,payment,'RCP-'||lpad((n+100000)::text,8,'0') FROM financial_volume`,[s.cid]);
  await f.migration.query(`INSERT INTO safeer.tickets(company_id,booking_id,allocation_id,payment_id,ticket_number,status) SELECT $1,booking,allocation,payment,'TKT-'||lpad((n+100000)::text,8,'0'),'refunded' FROM financial_volume`,[s.cid]);
  await f.migration.query(`INSERT INTO safeer.ticket_credentials(company_id,ticket_id) SELECT company_id,id FROM safeer.tickets WHERE company_id=$1`,[s.cid]);
  await f.migration.query(`INSERT INTO safeer.refunds(id,company_id,booking_id,payment_id,session_id,refund_number,method,amount_minor,currency,refunded_by,reason,key_hash,request_hash)
   SELECT gen_random_uuid(),$1,v.booking,v.payment,s.id,'RFD-'||lpad((v.n+100000)::text,8,'0'),'cash',150000,'SDG',$2,'Fictional historical refund',md5('refund'||v.n)||md5('second'||v.n),md5('request'||v.n)||md5('second'||v.n) FROM financial_volume v CROSS JOIN safeer.cash_sessions s WHERE s.company_id=$1 AND s.closed_at IS NULL`,[s.cid,actor]);
  await f.migration.query('COMMIT');
  // The owner migration initializes statistics for existing history. This bulk load
  // happens afterwards, so perform the equivalent import maintenance explicitly.
  await f.migration.query('ANALYZE safeer.bookings,safeer.payments,safeer.refunds,safeer.receipts,safeer.tickets,safeer.cash_sessions,safeer.stations,safeer.trips,safeer.users');
 }catch(error){await f.migration.query('ROLLBACK');throw error;}
}
