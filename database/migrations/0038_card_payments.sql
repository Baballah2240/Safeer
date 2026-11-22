-- D136 (global plan, Egypt): passengers pay a held booking by card through a payment gateway (Paymob first).
-- A card payment has no cash drawer and no staff member, so its session and "taken by" are empty (only for cards). Each attempt is a checkout row;
-- the gateway's signed callback marks it paid, and only then is the booking confirmed and ticketed.

ALTER TABLE safeer.payments ALTER COLUMN session_id DROP NOT NULL;
ALTER TABLE safeer.payments DROP CONSTRAINT payments_method_check;
ALTER TABLE safeer.payments ADD CONSTRAINT payments_method_check CHECK(method IN ('cash','bank_transfer','mobile_wallet','card'));
ALTER TABLE safeer.payments ALTER COLUMN taken_by DROP NOT NULL;
ALTER TABLE safeer.payments ADD CONSTRAINT payments_session_by_method CHECK((method='card')=(session_id IS NULL) AND (method='card')=(taken_by IS NULL));

-- Booking payment details: a card payment has no staff member.
CREATE OR REPLACE FUNCTION safeer.booking_payment(cid uuid,bid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',p.id,'method',p.method,'reference',p.method_reference,'amountMinor',p.amount_minor,'currency',p.currency,'at',p.created_at,'late',p.late,'lateReason',p.late_reason,'receiptNumber',r.receipt_number,'takenBy',COALESCE(u.display_name,'Card payment'),'sessionId',p.session_id,
  'prints',(SELECT count(*) FROM safeer.document_prints d WHERE d.company_id=cid AND d.booking_id=bid AND d.document='receipt'),'ticketPrints',(SELECT count(*) FROM safeer.document_prints d WHERE d.company_id=cid AND d.booking_id=bid AND d.document='tickets'))
 FROM safeer.payments p JOIN safeer.receipts r ON (r.company_id,r.payment_id)=(p.company_id,p.id) LEFT JOIN safeer.users u ON u.id=p.taken_by WHERE p.company_id=cid AND p.booking_id=bid
$$;

ALTER TABLE safeer.company_payment_settings ADD COLUMN card boolean NOT NULL DEFAULT false;

CREATE TABLE safeer.card_checkouts (
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES safeer.companies(id),booking_id uuid NOT NULL,
 provider varchar(20) NOT NULL CHECK(provider IN ('paymob')),provider_order varchar(64) UNIQUE,
 amount_minor integer NOT NULL CHECK(amount_minor>0),currency varchar(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 status varchar(14) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','failed','needs_refund')),
 provider_transaction varchar(64),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),closed_at timestamptz,
 FOREIGN KEY(company_id,booking_id) REFERENCES safeer.bookings(company_id,id)
);
CREATE INDEX card_checkouts_booking ON safeer.card_checkouts(company_id,booking_id);
ALTER TABLE safeer.card_checkouts ENABLE ROW LEVEL SECURITY;

-- Starts a checkout for a held booking the passenger can prove (reference + access key hash). Returns what the
-- gateway needs, or an error code. Card must be on for the company and the hold still open.
CREATE FUNCTION safeer.card_checkout_start(ref text,p_access text,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b safeer.bookings%ROWTYPE; card boolean; c record;
BEGIN
 SELECT * INTO b FROM safeer.bookings WHERE reference=ref AND access_hash=p_access;
 IF NOT FOUND THEN RETURN NULL; END IF;
 PERFORM safeer.expire_trip_holds(b.company_id,b.trip_id);
 SELECT * INTO b FROM safeer.bookings WHERE id=b.id;
 SELECT p.card INTO card FROM safeer.company_payment_settings p WHERE p.company_id=b.company_id;
 IF NOT COALESCE(card,false) THEN RAISE EXCEPTION 'METHOD_DISABLED' USING ERRCODE='P0001'; END IF;
 IF b.status IN ('confirmed','refunded') THEN RAISE EXCEPTION 'ALREADY_PAID' USING ERRCODE='P0001'; END IF;
 IF b.status<>'held' THEN RAISE EXCEPTION 'HOLD_CLOSED' USING ERRCODE='P0001'; END IF;
 INSERT INTO safeer.card_checkouts(id,company_id,booking_id,provider,amount_minor,currency) VALUES(p_id,b.company_id,b.id,'paymob',b.amount_minor,b.currency);
 SELECT co.name_en,co.name_ar INTO c FROM safeer.companies co WHERE co.id=b.company_id;
 RETURN jsonb_build_object('checkoutId',p_id,'amountMinor',b.amount_minor,'currency',b.currency,'reference',b.reference,'companyEn',c.name_en);
END $$;

CREATE FUNCTION safeer.card_checkout_order(p_id uuid,p_order text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 UPDATE safeer.card_checkouts SET provider_order=p_order WHERE id=p_id AND status='pending' AND provider_order IS NULL
$$;

-- The gateway's verified result. Idempotent: a repeated callback returns the recorded outcome. A successful payment
-- confirms the booking like a counter payment (receipt, tickets, booking event). If the hold has already ended and
-- its seats were taken, the money is kept as 'needs_refund' for staff to return.
CREATE FUNCTION safeer.card_checkout_finish(p_order text,p_transaction text,p_success boolean,p_amount integer,p_currency text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE k safeer.card_checkouts%ROWTYPE; b safeer.bookings%ROWTYPE; t safeer.trips%ROWTYPE; a safeer.trip_assignments%ROWTYPE; pid uuid:=gen_random_uuid(); x record;
BEGIN
 SELECT * INTO k FROM safeer.card_checkouts WHERE provider_order=p_order FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF k.status<>'pending' THEN RETURN jsonb_build_object('status',k.status,'bookingId',k.booking_id,'reference',(SELECT reference FROM safeer.bookings WHERE id=k.booking_id)); END IF;
 IF NOT p_success THEN
  UPDATE safeer.card_checkouts SET status='failed',provider_transaction=p_transaction,closed_at=clock_timestamp() WHERE id=k.id;
  RETURN jsonb_build_object('status','failed','bookingId',k.booking_id,'reference',(SELECT reference FROM safeer.bookings WHERE id=k.booking_id));
 END IF;
 IF p_amount<>k.amount_minor OR p_currency<>k.currency THEN RAISE EXCEPTION 'AMOUNT_MISMATCH' USING ERRCODE='P0001'; END IF;
 SELECT * INTO b FROM safeer.bookings WHERE company_id=k.company_id AND id=k.booking_id;
 SELECT * INTO t FROM safeer.trips WHERE company_id=b.company_id AND id=b.trip_id FOR NO KEY UPDATE;
 PERFORM safeer.expire_trip_holds(b.company_id,t.id);
 SELECT * INTO b FROM safeer.bookings WHERE company_id=k.company_id AND id=k.booking_id;
 IF b.status IN ('confirmed','refunded') OR b.status='released' OR (b.status='expired' AND (
   EXISTS(SELECT 1 FROM safeer.trip_assignments a2 JOIN safeer.seat_allocations o ON o.company_id=a2.company_id AND o.booking_id=b.id WHERE a2.company_id=b.company_id AND a2.trip_id=t.id AND a2.replaced_at IS NULL AND (o.layout_id,o.layout_revision)<>(a2.layout_id,a2.layout_revision))
   OR EXISTS(SELECT 1 FROM safeer.seat_allocations o JOIN safeer.seat_allocations h ON h.company_id=o.company_id AND h.trip_id=o.trip_id AND h.row_number=o.row_number AND h.column_number=o.column_number AND h.id<>o.id AND h.status IN ('held','confirmed') AND h.segment && o.segment WHERE o.company_id=b.company_id AND o.booking_id=b.id))) THEN
  UPDATE safeer.card_checkouts SET status='needs_refund',provider_transaction=p_transaction,closed_at=clock_timestamp() WHERE id=k.id;
  RETURN jsonb_build_object('status','needs_refund','bookingId',k.booking_id,'reference',(SELECT reference FROM safeer.bookings WHERE id=k.booking_id));
 END IF;
 INSERT INTO safeer.payments(id,company_id,booking_id,session_id,method,method_reference,amount_minor,currency,taken_by,late,late_reason,key_hash,request_hash)
  VALUES(pid,b.company_id,b.id,NULL,'card',p_transaction,b.amount_minor,b.currency,NULL,b.status='expired',CASE WHEN b.status='expired' THEN 'Card payment arrived after the hold ended' END,encode(sha256(convert_to('card:'||k.id::text,'UTF8')),'hex'),encode(sha256(convert_to('card:'||p_transaction,'UTF8')),'hex'));
 INSERT INTO safeer.receipts(company_id,payment_id,receipt_number) VALUES(b.company_id,pid,safeer.next_document(b.company_id,'receipt','RCP'));
 UPDATE safeer.seat_allocations SET status='confirmed' WHERE company_id=b.company_id AND booking_id=b.id;
 FOR x IN SELECT id FROM safeer.seat_allocations WHERE company_id=b.company_id AND booking_id=b.id ORDER BY row_number,column_number LOOP
  INSERT INTO safeer.tickets(company_id,booking_id,allocation_id,payment_id,ticket_number) VALUES(b.company_id,b.id,x.id,pid,safeer.next_document(b.company_id,'ticket','TKT'));
 END LOOP;
 UPDATE safeer.bookings SET status='confirmed',closed_at=COALESCE(closed_at,clock_timestamp()) WHERE company_id=b.company_id AND id=b.id;
 INSERT INTO safeer.booking_events(company_id,booking_id,event,actor_kind,actor_id,reason) VALUES(b.company_id,b.id,'paid','system',NULL,'card');
 UPDATE safeer.card_checkouts SET status='paid',provider_transaction=p_transaction,closed_at=clock_timestamp() WHERE id=k.id;
 RETURN jsonb_build_object('status','paid','bookingId',k.booking_id,'reference',(SELECT reference FROM safeer.bookings WHERE id=k.booking_id));
END $$;

-- Card on/off per company (Payment methods screen), and whether a booking's company takes cards.
CREATE FUNCTION safeer.company_card(cid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT COALESCE((SELECT card FROM safeer.company_payment_settings WHERE company_id=cid),false)
$$;
CREATE FUNCTION safeer.booking_card(ref text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT COALESCE((SELECT p.card FROM safeer.bookings b JOIN safeer.company_payment_settings p ON p.company_id=b.company_id WHERE b.reference=ref),false)
$$;
CREATE FUNCTION safeer.save_card_payments(cid uuid,actor uuid,p_on boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_can(cid,'company.profile.manage') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 INSERT INTO safeer.company_payment_settings(company_id,card) VALUES(cid,p_on) ON CONFLICT(company_id) DO UPDATE SET card=p_on;
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,actor,'payment_methods.updated',cid);
END $$;

REVOKE ALL ON FUNCTION safeer.company_card(uuid),safeer.booking_card(text),safeer.save_card_payments(uuid,uuid,boolean),safeer.card_checkout_start(text,text,uuid),safeer.card_checkout_order(uuid,text),safeer.card_checkout_finish(text,text,boolean,integer,text) FROM PUBLIC;
