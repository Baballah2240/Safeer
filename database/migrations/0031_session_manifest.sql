-- D114: the manifest of a closed counter session: every booking paid and every refund made in it, with
-- the trip, bus, driver, seats, tickets, travellers, luggage and receipt. Read-only. The employee who opened
-- the session (while still allowed to operate that counter) or a session manager may read it, and only
-- staff who can read bookings see passenger details.
CREATE FUNCTION safeer.session_manifest(cid uuid,sid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s safeer.cash_sessions%ROWTYPE; actor uuid:=safeer.company_actor();
BEGIN
 SELECT * INTO s FROM safeer.cash_sessions WHERE company_id=cid AND id=sid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF NOT safeer.company_has(cid,'company.bookings.read')
  OR NOT ((s.opened_by=actor AND safeer.company_can(cid,'company.ticketing.operate',s.branch_id,s.station_id)) OR safeer.company_can(cid,'company.sessions.manage',s.branch_id,s.station_id))
 THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF s.closed_at IS NULL THEN RAISE EXCEPTION 'SESSION_STILL_OPEN' USING ERRCODE='P0001'; END IF;
 RETURN (SELECT safeer.session_row(s)||jsonb_build_object(
  'closedBy',(SELECT u.display_name FROM safeer.users u WHERE u.id=s.closed_by),
  'companyNameEn',co.name_en,'companyNameAr',co.name_ar,'timezone',coalesce(cs.timezone,'Africa/Khartoum'),'printedAt',clock_timestamp(),
  'bookings',COALESCE((SELECT jsonb_agg(safeer.booking_view(b)||jsonb_build_object(
     'bookingStatus',b.status,'departureAt',t.departure_at,
     'busCode',bus.code,'busRegistration',bus.registration,'driverNameEn',d.name_en,'driverNameAr',d.name_ar,
     'paymentMethod',p.method,'paymentReference',p.method_reference,'paidMinor',p.amount_minor,'paidCurrency',p.currency,'paidAt',p.created_at,'late',p.late,
     'receiptNumber',r.receipt_number,'takenBy',u.display_name) ORDER BY t.departure_at,t.id,b.reference)
    FROM safeer.payments p JOIN safeer.bookings b ON b.company_id=p.company_id AND b.id=p.booking_id
    JOIN safeer.trips t ON t.company_id=b.company_id AND t.id=b.trip_id
    JOIN safeer.users u ON u.id=p.taken_by
    LEFT JOIN safeer.receipts r ON r.company_id=p.company_id AND r.payment_id=p.id
    LEFT JOIN safeer.trip_assignments a ON a.company_id=t.company_id AND a.trip_id=t.id AND a.replaced_at IS NULL
    LEFT JOIN safeer.buses bus ON bus.company_id=a.company_id AND bus.id=a.bus_id
    LEFT JOIN safeer.drivers d ON d.company_id=a.company_id AND d.id=a.driver_id
    WHERE p.company_id=cid AND p.session_id=sid),'[]'::jsonb),
  'refunds',COALESCE((SELECT jsonb_agg(jsonb_build_object('reference',b.reference,'number',f.refund_number,'method',f.method,'methodReference',f.method_reference,'amountMinor',f.amount_minor,'currency',f.currency,'at',f.created_at,'reason',f.reason,'by',u.display_name) ORDER BY f.created_at,f.id)
    FROM safeer.refunds f JOIN safeer.bookings b ON b.company_id=f.company_id AND b.id=f.booking_id JOIN safeer.users u ON u.id=f.refunded_by
    WHERE f.company_id=cid AND f.session_id=sid),'[]'::jsonb))
 FROM safeer.companies co LEFT JOIN safeer.company_settings cs ON cs.company_id=co.id WHERE co.id=cid);
END $$;
REVOKE ALL ON FUNCTION safeer.session_manifest(uuid,uuid) FROM PUBLIC;
-- The signed-in employee's own last closed sessions, so the manifest can be printed right after closing.
CREATE FUNCTION safeer.my_closed_sessions(cid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT COALESCE(jsonb_agg(safeer.session_row(x) ORDER BY x.closed_at DESC),'[]'::jsonb)
 FROM (SELECT * FROM safeer.cash_sessions s WHERE s.company_id=cid AND s.opened_by=safeer.company_actor() AND s.closed_at IS NOT NULL
  AND safeer.company_can(cid,'company.ticketing.operate',s.branch_id,s.station_id) ORDER BY s.closed_at DESC LIMIT 3) x
$$;
REVOKE ALL ON FUNCTION safeer.my_closed_sessions(uuid) FROM PUBLIC;
