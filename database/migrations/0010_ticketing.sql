-- Section 10. Existing company-role copies are deliberately not rewritten. Money records can only ever be added to, never edited.
INSERT INTO safeer.permissions(code,module) VALUES ('company.ticketing.operate','company'),('company.payments.late','company'),('company.sessions.manage','company');
INSERT INTO safeer.role_permissions(role_id,permission_code)
 SELECT r.id,p FROM safeer.roles r CROSS JOIN unnest(ARRAY['company.ticketing.operate','company.payments.late','company.sessions.manage','company.bookings.read']) p
 WHERE r.code IN ('company_administrator','branch_manager','station_manager') ON CONFLICT DO NOTHING;
INSERT INTO safeer.role_permissions(role_id,permission_code)
 SELECT r.id,p FROM safeer.roles r CROSS JOIN unnest(ARRAY['company.ticketing.operate','company.bookings.read']) p WHERE r.code='ticketing_employee' ON CONFLICT DO NOTHING;
UPDATE safeer.roles SET version=version+1 WHERE code IN ('company_administrator','branch_manager','station_manager','ticketing_employee');
CREATE TABLE safeer.company_payment_settings (
 company_id uuid PRIMARY KEY REFERENCES safeer.companies(id),bank_transfer boolean NOT NULL DEFAULT false,mobile_wallet boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE TABLE safeer.station_counters (
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES safeer.companies(id),branch_id uuid NOT NULL,station_id uuid NOT NULL,
 code varchar(40) NOT NULL CHECK(code ~ '^[A-Z0-9_-]+$'),name varchar(100) NOT NULL CHECK(length(btrim(name))>0),active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(company_id,id),UNIQUE(company_id,station_id,code),
 FOREIGN KEY(company_id,branch_id,station_id) REFERENCES safeer.stations(company_id,branch_id,id)
);
CREATE TABLE safeer.cash_sessions (
 id uuid PRIMARY KEY,company_id uuid NOT NULL,counter_id uuid NOT NULL,branch_id uuid NOT NULL,station_id uuid NOT NULL,opened_by uuid NOT NULL REFERENCES safeer.users(id),
 opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),opening_minor integer NOT NULL CHECK(opening_minor BETWEEN 0 AND 1000000000),currency varchar(3) NOT NULL DEFAULT 'SDG' CHECK(currency ~ '^[A-Z]{3}$'),
 closed_at timestamptz,closed_by uuid REFERENCES safeer.users(id),expected_minor bigint,counted_minor bigint CHECK(counted_minor BETWEEN 0 AND 10000000000),close_note varchar(300),
 CHECK((closed_at IS NULL)=(closed_by IS NULL)),CHECK((closed_at IS NULL)=(counted_minor IS NULL)),CHECK((closed_at IS NULL)=(expected_minor IS NULL)),
 UNIQUE(company_id,id),FOREIGN KEY(company_id,counter_id) REFERENCES safeer.station_counters(company_id,id),
 FOREIGN KEY(company_id,branch_id,station_id) REFERENCES safeer.stations(company_id,branch_id,id)
);
CREATE UNIQUE INDEX cash_sessions_counter_open ON safeer.cash_sessions(company_id,counter_id) WHERE closed_at IS NULL;
CREATE UNIQUE INDEX cash_sessions_user_open ON safeer.cash_sessions(company_id,opened_by) WHERE closed_at IS NULL;
CREATE INDEX cash_sessions_recent ON safeer.cash_sessions(company_id,opened_at);
-- Numbers come from one locked row per company and document type, so they commit with the record that uses them.
CREATE TABLE safeer.document_sequences (
 company_id uuid NOT NULL REFERENCES safeer.companies(id),document_type varchar(12) NOT NULL CHECK(document_type IN ('ticket','receipt','refund')),next_value bigint NOT NULL DEFAULT 1 CHECK(next_value>0),
 PRIMARY KEY(company_id,document_type)
);
CREATE TABLE safeer.payments (
 id uuid PRIMARY KEY,company_id uuid NOT NULL,booking_id uuid NOT NULL,session_id uuid NOT NULL,method varchar(14) NOT NULL CHECK(method IN ('cash','bank_transfer','mobile_wallet')),method_reference varchar(100),
 amount_minor integer NOT NULL CHECK(amount_minor>0),currency varchar(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),taken_by uuid NOT NULL REFERENCES safeer.users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 late boolean NOT NULL DEFAULT false,late_reason varchar(300),key_hash char(64) NOT NULL,request_hash char(64) NOT NULL,
 CHECK(method='cash' OR method_reference IS NOT NULL),
 UNIQUE(company_id,id),UNIQUE(company_id,booking_id),UNIQUE(company_id,key_hash),
 FOREIGN KEY(company_id,booking_id) REFERENCES safeer.bookings(company_id,id),FOREIGN KEY(company_id,session_id) REFERENCES safeer.cash_sessions(company_id,id)
);
CREATE INDEX payments_session ON safeer.payments(company_id,session_id);
CREATE TABLE safeer.receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,payment_id uuid NOT NULL,receipt_number varchar(16) NOT NULL,issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,payment_id),UNIQUE(company_id,receipt_number),FOREIGN KEY(company_id,payment_id) REFERENCES safeer.payments(company_id,id)
);
CREATE TABLE safeer.tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,booking_id uuid NOT NULL,allocation_id uuid NOT NULL,payment_id uuid NOT NULL,ticket_number varchar(16) NOT NULL,
 status varchar(10) NOT NULL DEFAULT 'valid' CHECK(status IN ('valid','refunded')),issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,ticket_number),UNIQUE(company_id,allocation_id),
 FOREIGN KEY(company_id,booking_id,allocation_id) REFERENCES safeer.seat_allocations(company_id,booking_id,id),FOREIGN KEY(company_id,payment_id) REFERENCES safeer.payments(company_id,id)
);
CREATE INDEX tickets_booking ON safeer.tickets(company_id,booking_id);
CREATE TABLE safeer.refunds (
 id uuid PRIMARY KEY,company_id uuid NOT NULL,booking_id uuid NOT NULL,payment_id uuid NOT NULL,session_id uuid NOT NULL,refund_number varchar(16) NOT NULL,method varchar(14) NOT NULL,method_reference varchar(100),
 amount_minor integer NOT NULL CHECK(amount_minor>0),currency varchar(3) NOT NULL,refunded_by uuid NOT NULL REFERENCES safeer.users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),reason varchar(300),key_hash char(64) NOT NULL,request_hash char(64) NOT NULL,
 CHECK(method='cash' OR method_reference IS NOT NULL),
 UNIQUE(company_id,payment_id),UNIQUE(company_id,refund_number),UNIQUE(company_id,key_hash),
 FOREIGN KEY(company_id,payment_id) REFERENCES safeer.payments(company_id,id),FOREIGN KEY(company_id,session_id) REFERENCES safeer.cash_sessions(company_id,id),FOREIGN KEY(company_id,booking_id) REFERENCES safeer.bookings(company_id,id)
);
CREATE INDEX refunds_session ON safeer.refunds(company_id,session_id);
-- A later print of a ticket or receipt is marked as a copy, so only one original ever exists.
CREATE TABLE safeer.document_prints (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,booking_id uuid NOT NULL,document varchar(10) NOT NULL CHECK(document IN ('tickets','receipt','refund')),printed_by uuid NOT NULL REFERENCES safeer.users(id),printed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(company_id,booking_id) REFERENCES safeer.bookings(company_id,id)
);
CREATE INDEX document_prints_booking ON safeer.document_prints(company_id,booking_id,document);
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['company_payment_settings','station_counters','cash_sessions','document_sequences','payments','receipts','tickets','refunds','document_prints'] LOOP
  EXECUTE format('ALTER TABLE safeer.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON safeer.%I FROM PUBLIC',t);
 END LOOP;
END $$;
-- Booking and allocation statuses gain paid states, and a paid seat is claimed for good until refunded.
ALTER TABLE safeer.bookings DROP CONSTRAINT bookings_status_check;
ALTER TABLE safeer.bookings ADD CONSTRAINT bookings_status_check CHECK(status IN ('held','expired','released','confirmed','refunded'));
ALTER TABLE safeer.seat_allocations DROP CONSTRAINT seat_allocations_status_check;
ALTER TABLE safeer.seat_allocations ADD CONSTRAINT seat_allocations_status_check CHECK(status IN ('held','expired','released','confirmed'));
ALTER TABLE safeer.booking_events DROP CONSTRAINT booking_events_event_check;
ALTER TABLE safeer.booking_events ADD CONSTRAINT booking_events_event_check CHECK(event IN ('held','expired','released','changed','erased','paid','refunded'));
DO $$
DECLARE name text;
BEGIN
 SELECT conname INTO name FROM pg_constraint WHERE conrelid='safeer.seat_allocations'::regclass AND contype='x';
 EXECUTE format('ALTER TABLE safeer.seat_allocations DROP CONSTRAINT %I',name);
END $$;
ALTER TABLE safeer.seat_allocations ADD CONSTRAINT seat_allocations_no_sharing EXCLUDE USING gist(company_id WITH =,trip_id WITH =,row_number WITH =,column_number WITH =,segment WITH &&) WHERE (status IN ('held','confirmed'));
CREATE OR REPLACE FUNCTION safeer.booking_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Immutable booking history' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='booking_events' THEN
  IF NEW.reason IS NULL AND (to_jsonb(NEW)-'reason') IS NOT DISTINCT FROM (to_jsonb(OLD)-'reason') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Immutable booking history' USING ERRCODE='42501';
 END IF;
 IF OLD.status<>'held' AND NEW.release_reason IS NULL AND (to_jsonb(NEW)-'release_reason') IS NOT DISTINCT FROM (to_jsonb(OLD)-'release_reason') THEN RETURN NEW; END IF;
 IF (to_jsonb(NEW)-ARRAY['status','closed_at','released_by_kind','released_by','release_reason']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','closed_at','released_by_kind','released_by','release_reason']) THEN RAISE EXCEPTION 'Immutable booking history' USING ERRCODE='42501'; END IF;
 IF OLD.status='held' OR (OLD.status='expired' AND NEW.status='confirmed') OR (OLD.status='confirmed' AND NEW.status='refunded') THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Immutable booking history' USING ERRCODE='42501';
END $$;
CREATE OR REPLACE FUNCTION safeer.allocation_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN RAISE EXCEPTION 'Immutable booking history' USING ERRCODE='42501'; END IF;
 IF OLD.status='held' OR (OLD.status='expired' AND NEW.status='confirmed') OR (OLD.status='confirmed' AND NEW.status='released') THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Immutable booking history' USING ERRCODE='42501';
END $$;
-- Money records never change. The only exceptions are a ticket being refunded, a session being closed, and erasure clearing staff-written text.
CREATE FUNCTION safeer.money_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Immutable financial record' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='tickets' THEN
  IF to_jsonb(OLD)->>'status'='valid' AND to_jsonb(NEW)->>'status'='refunded' AND (to_jsonb(NEW)-'status') IS NOT DISTINCT FROM (to_jsonb(OLD)-'status') THEN RETURN NEW; END IF;
 ELSIF TG_TABLE_NAME='payments' THEN
  IF to_jsonb(NEW)->>'late_reason' IS NULL AND (to_jsonb(NEW)-'late_reason') IS NOT DISTINCT FROM (to_jsonb(OLD)-'late_reason') THEN RETURN NEW; END IF;
 ELSIF TG_TABLE_NAME='refunds' THEN
  IF to_jsonb(NEW)->>'reason' IS NULL AND (to_jsonb(NEW)-'reason') IS NOT DISTINCT FROM (to_jsonb(OLD)-'reason') THEN RETURN NEW; END IF;
 ELSIF TG_TABLE_NAME='cash_sessions' AND to_jsonb(OLD)->>'closed_at' IS NULL AND (to_jsonb(NEW)-ARRAY['closed_at','closed_by','expected_minor','counted_minor','close_note']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['closed_at','closed_by','expected_minor','counted_minor','close_note']) THEN
  RETURN NEW;
 ELSIF TG_TABLE_NAME='cash_sessions' AND to_jsonb(NEW)->>'close_note' IS NULL AND (to_jsonb(NEW)-'close_note') IS NOT DISTINCT FROM (to_jsonb(OLD)-'close_note') THEN
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'Immutable financial record' USING ERRCODE='42501';
END $$;
CREATE TRIGGER money_guard BEFORE UPDATE OR DELETE ON safeer.payments FOR EACH ROW EXECUTE FUNCTION safeer.money_guard();
CREATE TRIGGER money_guard BEFORE UPDATE OR DELETE ON safeer.receipts FOR EACH ROW EXECUTE FUNCTION safeer.money_guard();
CREATE TRIGGER money_guard BEFORE UPDATE OR DELETE ON safeer.tickets FOR EACH ROW EXECUTE FUNCTION safeer.money_guard();
CREATE TRIGGER money_guard BEFORE UPDATE OR DELETE ON safeer.refunds FOR EACH ROW EXECUTE FUNCTION safeer.money_guard();
CREATE TRIGGER money_guard BEFORE UPDATE OR DELETE ON safeer.cash_sessions FOR EACH ROW EXECUTE FUNCTION safeer.money_guard();
CREATE TRIGGER money_guard BEFORE UPDATE OR DELETE ON safeer.document_prints FOR EACH ROW EXECUTE FUNCTION safeer.money_guard();
-- Seat availability: functions from earlier sections, with paid seats now counted as taken.
CREATE OR REPLACE FUNCTION safeer.trip_assignment_seats_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM 1 FROM safeer.trips WHERE company_id=NEW.company_id AND id=NEW.trip_id FOR NO KEY UPDATE;
 IF EXISTS(SELECT 1 FROM safeer.seat_allocations a WHERE a.company_id=NEW.company_id AND a.trip_id=NEW.trip_id AND (a.status='confirmed' OR (a.status='held' AND a.expires_at>clock_timestamp())) AND (a.layout_id,a.layout_revision)<>(NEW.layout_id,NEW.layout_revision))
 THEN RAISE EXCEPTION 'SEATS_HELD' USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION safeer.public_trip_rows(p_id uuid,p_from text,p_to text,p_date date,p_slug text) RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object(
  'id',t.id,'companySlug',co.slug,'companyNameEn',co.name_en,'companyNameAr',co.name_ar,
  'routeNameEn',t.route_name_en,'routeNameAr',t.route_name_ar,
  'fromCode',fc.code,'fromNameEn',fs.city_name_en,'fromNameAr',fs.city_name_ar,'toCode',tc.code,'toNameEn',ls.city_name_en,'toNameAr',ls.city_name_ar,
  'date',to_char(t.departure_at AT TIME ZONE t.timezone,'YYYY-MM-DD'),'time',to_char(t.departure_at AT TIME ZONE t.timezone,'HH24:MI'),
  'arrivalDate',to_char(t.arrival_at AT TIME ZONE t.timezone,'YYYY-MM-DD'),'arrivalTime',to_char(t.arrival_at AT TIME ZONE t.timezone,'HH24:MI'),
  'durationMinutes',ls.offset_minutes,'fareMinor',t.fare_minor,'currency',t.currency,
  'seatCount',a.seat_count,'busTypeEn',l.name_en,'busTypeAr',l.name_ar,
  'seatsLeft',a.seat_count-(SELECT count(DISTINCT (s.row_number,s.column_number)) FROM safeer.seat_allocations s WHERE s.company_id=t.company_id AND s.trip_id=t.id AND (s.status='confirmed' OR (s.status='held' AND s.expires_at>clock_timestamp()))),
  'stops',(SELECT jsonb_agg(jsonb_build_object('cityNameEn',s.city_name_en,'cityNameAr',s.city_name_ar,'stationNameEn',s.station_name_en,'stationNameAr',s.station_name_ar,'offsetMinutes',s.offset_minutes) ORDER BY s.stop_index) FROM safeer.trip_stops s WHERE s.company_id=t.company_id AND s.trip_id=t.id))
 FROM safeer.trips t
 JOIN safeer.companies co ON co.id=t.company_id AND co.status='approved'
 JOIN safeer.company_public_profiles p ON p.company_id=t.company_id AND p.listed
 JOIN safeer.trip_assignments a ON a.company_id=t.company_id AND a.trip_id=t.id AND a.replaced_at IS NULL
 JOIN safeer.seat_layouts l ON l.company_id=a.company_id AND l.id=a.layout_id
 JOIN safeer.trip_stops fs ON fs.company_id=t.company_id AND fs.trip_id=t.id AND fs.stop_index=0
 JOIN safeer.trip_stops ls ON ls.company_id=t.company_id AND ls.trip_id=t.id AND ls.stop_index=t.stop_count-1
 JOIN safeer.cities fc ON fc.id=fs.city_id
 JOIN safeer.cities tc ON tc.id=ls.city_id
 WHERE t.status='published' AND t.departure_at>clock_timestamp() AND (p_id IS NULL OR t.id=p_id)
  AND (p_from IS NULL OR fc.code=p_from) AND (p_to IS NULL OR tc.code=p_to) AND (p_slug IS NULL OR co.slug=p_slug)
  AND (p_date IS NULL OR (t.departure_at AT TIME ZONE t.timezone)::date=p_date)
 ORDER BY t.departure_at,t.id LIMIT 100
$$;
CREATE OR REPLACE FUNCTION safeer.public_trip(tid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT x.doc||jsonb_build_object('holdMinutes',st.hold_minutes,'rows',r.row_count,'columns',r.column_count,
  'seats',(SELECT jsonb_agg(jsonb_build_object('label',s.label,'row',s.row_number,'column',s.column_number,'available',NOT EXISTS(SELECT 1 FROM safeer.seat_allocations h WHERE h.company_id=s.company_id AND h.trip_id=tid AND h.row_number=s.row_number AND h.column_number=s.column_number AND (h.status='confirmed' OR (h.status='held' AND h.expires_at>clock_timestamp())))) ORDER BY s.row_number,s.column_number) FROM safeer.seat_layout_seats s WHERE s.company_id=a.company_id AND s.layout_id=a.layout_id AND s.revision=a.layout_revision))
 FROM safeer.public_trip_rows(tid,NULL,NULL,NULL,NULL) x(doc)
 JOIN safeer.trip_assignments a ON a.trip_id=tid AND a.replaced_at IS NULL
 JOIN safeer.company_settings st ON st.company_id=a.company_id
 JOIN safeer.seat_layout_revisions r ON r.company_id=a.company_id AND r.layout_id=a.layout_id AND r.revision=a.layout_revision
$$;
CREATE OR REPLACE FUNCTION safeer.hold_seats(tid uuid,labels text[],p_id uuid,p_reference text,p_access text,p_request text,require_listed boolean,p_actor uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b safeer.bookings%ROWTYPE; t safeer.trips%ROWTYPE; a safeer.trip_assignments%ROWTYPE; minutes integer; wanted integer:=cardinality(labels); until timestamptz;
BEGIN
 SELECT * INTO b FROM safeer.bookings WHERE access_hash=p_access;
 IF FOUND THEN
  IF b.request_hash<>p_request THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001'; END IF;
  RETURN safeer.booking_view(b);
 END IF;
 SELECT x.* INTO t FROM safeer.trips x JOIN safeer.companies co ON co.id=x.company_id AND co.status='approved' LEFT JOIN safeer.company_public_profiles p ON p.company_id=x.company_id WHERE x.id=tid AND (NOT require_listed OR COALESCE(p.listed,false)) FOR NO KEY UPDATE OF x;
 IF NOT FOUND THEN RAISE EXCEPTION 'TRIP_NOT_BOOKABLE' USING ERRCODE='P0001'; END IF;
 -- A retry that waited for the lock behind its own first attempt returns that attempt.
 SELECT * INTO b FROM safeer.bookings WHERE access_hash=p_access;
 IF FOUND THEN
  IF b.request_hash<>p_request THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001'; END IF;
  RETURN safeer.booking_view(b);
 END IF;
 IF t.status<>'published' OR t.departure_at<=clock_timestamp() OR t.fare_minor<=0 THEN RAISE EXCEPTION 'TRIP_NOT_BOOKABLE' USING ERRCODE='P0001'; END IF;
 PERFORM safeer.expire_trip_holds(t.company_id,t.id);
 SELECT * INTO a FROM safeer.trip_assignments WHERE company_id=t.company_id AND trip_id=t.id AND replaced_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'TRIP_NOT_BOOKABLE' USING ERRCODE='P0001'; END IF;
 IF wanted NOT BETWEEN 1 AND 10 OR (SELECT count(DISTINCT v) FROM unnest(labels) v)<>wanted
  OR (SELECT count(*) FROM safeer.seat_layout_seats s WHERE s.company_id=a.company_id AND s.layout_id=a.layout_id AND s.revision=a.layout_revision AND s.label=ANY(labels))<>wanted
 THEN RAISE EXCEPTION 'INVALID_SEATS' USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM safeer.seat_layout_seats s JOIN safeer.seat_allocations h ON h.company_id=s.company_id AND h.trip_id=t.id AND h.row_number=s.row_number AND h.column_number=s.column_number AND h.status IN ('held','confirmed')
  WHERE s.company_id=a.company_id AND s.layout_id=a.layout_id AND s.revision=a.layout_revision AND s.label=ANY(labels))
 THEN RAISE EXCEPTION 'SEATS_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
 SELECT hold_minutes INTO minutes FROM safeer.company_settings WHERE company_id=t.company_id;
 until:=least(clock_timestamp()+make_interval(mins=>minutes),t.departure_at);
 INSERT INTO safeer.bookings(id,company_id,trip_id,reference,access_hash,request_hash,hold_minutes,expires_at,seat_count,fare_minor,amount_minor,currency)
  VALUES(p_id,t.company_id,t.id,p_reference,p_access,p_request,minutes,until,wanted,t.fare_minor,t.fare_minor*wanted,t.currency) RETURNING * INTO b;
 INSERT INTO safeer.seat_allocations(id,company_id,trip_id,booking_id,layout_id,layout_revision,row_number,column_number,label,segment,expires_at)
  SELECT gen_random_uuid(),t.company_id,t.id,b.id,s.layout_id,s.revision,s.row_number,s.column_number,s.label,int4range(0,t.stop_count-1),until
  FROM safeer.seat_layout_seats s WHERE s.company_id=a.company_id AND s.layout_id=a.layout_id AND s.revision=a.layout_revision AND s.label=ANY(labels) ORDER BY s.row_number,s.column_number;
 INSERT INTO safeer.booking_events(company_id,booking_id,event,actor_kind,actor_id) VALUES(b.company_id,b.id,'held',CASE WHEN p_actor IS NULL THEN 'passenger' ELSE 'staff' END,p_actor);
 RETURN safeer.booking_view(b);
END $$;
CREATE OR REPLACE FUNCTION safeer.public_hold(tid uuid,labels text[],p_id uuid,p_reference text,p_access text,p_request text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT safeer.hold_seats(tid,labels,p_id,p_reference,p_access,p_request,true,NULL)
$$;
-- Readers of paid bookings. Passengers see ticket numbers; only staff see how the money moved.
CREATE FUNCTION safeer.booking_tickets(cid uuid,bid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('number',t.ticket_number,'seat',a.label,'status',t.status) ORDER BY a.row_number,a.column_number),'[]'::jsonb)
 FROM safeer.tickets t JOIN safeer.seat_allocations a ON a.id=t.allocation_id WHERE t.company_id=cid AND t.booking_id=bid
$$;
CREATE FUNCTION safeer.booking_payment(cid uuid,bid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',p.id,'method',p.method,'reference',p.method_reference,'amountMinor',p.amount_minor,'currency',p.currency,'at',p.created_at,'late',p.late,'lateReason',p.late_reason,'receiptNumber',r.receipt_number,'takenBy',u.display_name,'sessionId',p.session_id,
  'prints',(SELECT count(*) FROM safeer.document_prints d WHERE d.company_id=cid AND d.booking_id=bid AND d.document='receipt'),'ticketPrints',(SELECT count(*) FROM safeer.document_prints d WHERE d.company_id=cid AND d.booking_id=bid AND d.document='tickets'))
 FROM safeer.payments p JOIN safeer.receipts r ON (r.company_id,r.payment_id)=(p.company_id,p.id) JOIN safeer.users u ON u.id=p.taken_by WHERE p.company_id=cid AND p.booking_id=bid
$$;
CREATE FUNCTION safeer.booking_refund(cid uuid,bid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('number',f.refund_number,'method',f.method,'reference',f.method_reference,'amountMinor',f.amount_minor,'currency',f.currency,'at',f.created_at,'reason',f.reason,'refundedBy',u.display_name,
  'prints',(SELECT count(*) FROM safeer.document_prints d WHERE d.company_id=cid AND d.booking_id=bid AND d.document='refund'))
 FROM safeer.refunds f JOIN safeer.users u ON u.id=f.refunded_by WHERE f.company_id=cid AND f.booking_id=bid
$$;
CREATE OR REPLACE FUNCTION safeer.booking_view(b safeer.bookings) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('reference',b.reference,'status',CASE WHEN b.status='held' AND b.expires_at<=clock_timestamp() THEN 'expired' ELSE b.status END,
  'releasedBy',b.released_by_kind,'expiresAt',b.expires_at,'serverNow',clock_timestamp(),'createdAt',b.created_at,
  'holdMinutes',b.hold_minutes,'seatCount',b.seat_count,'fareMinor',b.fare_minor,'amountMinor',b.amount_minor,'currency',b.currency,
  'seats',(SELECT jsonb_agg(a.label ORDER BY a.row_number,a.column_number) FROM safeer.seat_allocations a WHERE a.company_id=b.company_id AND a.booking_id=b.id),
  'tickets',safeer.booking_tickets(b.company_id,b.id),'tripCanceled',t.status='canceled','mobile',c.mobile,'detailsErased',c.erased_at IS NOT NULL,'travelers',safeer.booking_travelers(b.company_id,b.id),
  'tripId',t.id,'routeNameEn',t.route_name_en,'routeNameAr',t.route_name_ar,
  'date',to_char(t.departure_at AT TIME ZONE t.timezone,'YYYY-MM-DD'),'time',to_char(t.departure_at AT TIME ZONE t.timezone,'HH24:MI'),
  'tripOpen',visible AND t.status='published' AND t.departure_at>clock_timestamp(),'companySlug',co.slug,'companyNameEn',co.name_en,'companyNameAr',co.name_ar,
  'phone',CASE WHEN visible THEN p.public_phone END,'email',CASE WHEN visible THEN p.public_email END,'address',CASE WHEN visible THEN p.public_address END)
 FROM safeer.trips t JOIN safeer.companies co ON co.id=t.company_id LEFT JOIN safeer.company_public_profiles p ON p.company_id=t.company_id
 LEFT JOIN safeer.booking_contacts c ON c.company_id=b.company_id AND c.booking_id=b.id
 -- A company that has hidden itself or lost approval no longer shows contact details, even to someone holding an old key.
 CROSS JOIN LATERAL (SELECT co.status='approved' AND COALESCE(p.listed,false) AS visible) v
 WHERE t.company_id=b.company_id AND t.id=b.trip_id
$$;
CREATE OR REPLACE FUNCTION safeer.staff_booking_row(b safeer.bookings) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',b.id,'tripId',b.trip_id,'reference',b.reference,'status',CASE WHEN b.status='held' AND b.expires_at<=clock_timestamp() THEN 'expired' ELSE b.status END,
  'releasedBy',b.released_by_kind,'releaseReason',b.release_reason,'createdAt',b.created_at,'expiresAt',b.expires_at,'closedAt',b.closed_at,'amountMinor',b.amount_minor,'currency',b.currency,
  'tickets',safeer.booking_tickets(b.company_id,b.id),'payment',safeer.booking_payment(b.company_id,b.id),'refund',safeer.booking_refund(b.company_id,b.id),'tripCanceled',t.status='canceled','refundable',b.status='confirmed' AND (t.status='canceled' OR t.departure_at>clock_timestamp()),'tripOpen',t.status='published' AND t.departure_at>clock_timestamp(),'mobile',c.mobile,'version',c.version,'hasDetails',c.booking_id IS NOT NULL,'detailsErased',c.erased_at IS NOT NULL,'eraseAt',c.erase_at,'travelers',safeer.booking_travelers(b.company_id,b.id),
  'seats',(SELECT jsonb_agg(a.label ORDER BY a.row_number,a.column_number) FROM safeer.seat_allocations a WHERE a.company_id=b.company_id AND a.booking_id=b.id),
  'routeNameEn',t.route_name_en,'routeNameAr',t.route_name_ar,'timezone',t.timezone,'date',to_char(t.departure_at AT TIME ZONE t.timezone,'YYYY-MM-DD'),'time',to_char(t.departure_at AT TIME ZONE t.timezone,'HH24:MI'))
 FROM safeer.trips t LEFT JOIN safeer.booking_contacts c ON c.company_id=b.company_id AND c.booking_id=b.id
 WHERE t.company_id=b.company_id AND t.id=b.trip_id
$$;
CREATE OR REPLACE FUNCTION safeer.staff_bookings(cid uuid,p_reference text,p_mobile text,p_name text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE wide boolean;
BEGIN
 IF NOT safeer.company_has(cid,'company.bookings.read') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 wide:=safeer.company_can(cid,'company.bookings.read');
 RETURN jsonb_build_object('canManage',safeer.company_can(cid,'company.bookings.manage'),'searchOnly',NOT wide,'items',COALESCE((SELECT jsonb_agg(safeer.staff_booking_row(y.b) ORDER BY y.live DESC,(y.b).created_at DESC) FROM (
  SELECT b,(b.status='held' AND b.expires_at>clock_timestamp()) AS live FROM safeer.bookings b
  LEFT JOIN safeer.booking_contacts c ON c.company_id=b.company_id AND c.booking_id=b.id
  WHERE b.company_id=cid AND (wide OR p_reference IS NOT NULL OR p_mobile IS NOT NULL) AND (p_reference IS NULL OR b.reference=p_reference) AND (p_mobile IS NULL OR c.mobile=p_mobile)
   AND (p_name IS NULL OR EXISTS(SELECT 1 FROM safeer.booking_passengers p WHERE p.company_id=b.company_id AND p.booking_id=b.id AND position(lower(p_name) in lower(p.full_name))>0))
  ORDER BY (b.status='held' AND b.expires_at>clock_timestamp()) DESC,b.created_at DESC LIMIT 50) y),'[]'::jsonb));
END $$;
CREATE OR REPLACE FUNCTION safeer.staff_booking(cid uuid,bid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b safeer.bookings%ROWTYPE;
BEGIN
 IF NOT safeer.company_has(cid,'company.bookings.read') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO b FROM safeer.bookings WHERE company_id=cid AND id=bid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN safeer.staff_booking_row(b)||jsonb_build_object('canManage',safeer.company_can(cid,'company.bookings.manage'),
  'events',(SELECT jsonb_agg(jsonb_build_object('event',e.event,'actorKind',e.actor_kind,'reason',e.reason,'at',e.created_at) ORDER BY e.created_at,e.id) FROM safeer.booking_events e WHERE e.company_id=cid AND e.booking_id=bid));
END $$;
CREATE OR REPLACE FUNCTION safeer.staff_seat_map(cid uuid,tid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a safeer.trip_assignments%ROWTYPE; r safeer.seat_layout_revisions%ROWTYPE;
BEGIN
 IF NOT safeer.company_can(cid,'company.bookings.read') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM safeer.trips WHERE company_id=cid AND id=tid) THEN RETURN NULL; END IF;
 SELECT * INTO a FROM safeer.trip_assignments WHERE company_id=cid AND trip_id=tid AND replaced_at IS NULL;
 SELECT * INTO r FROM safeer.seat_layout_revisions WHERE company_id=cid AND layout_id=a.layout_id AND revision=a.layout_revision;
 RETURN jsonb_build_object('serverNow',clock_timestamp(),'canManage',safeer.company_can(cid,'company.bookings.manage'),'rows',r.row_count,'columns',r.column_count,
  'seats',COALESCE((SELECT jsonb_agg(jsonb_build_object('label',s.label,'row',s.row_number,'column',s.column_number,
    'reference',(SELECT b.reference FROM safeer.seat_allocations h JOIN safeer.bookings b ON (b.company_id,b.id)=(h.company_id,h.booking_id) WHERE h.company_id=cid AND h.trip_id=tid AND h.row_number=s.row_number AND h.column_number=s.column_number AND (h.status='confirmed' OR (h.status='held' AND h.expires_at>clock_timestamp())))) ORDER BY s.row_number,s.column_number)
   FROM safeer.seat_layout_seats s WHERE s.company_id=cid AND s.layout_id=a.layout_id AND s.revision=a.layout_revision),'[]'::jsonb),
  'bookingTotal',(SELECT count(*) FROM safeer.bookings b WHERE b.company_id=cid AND b.trip_id=tid),
  'bookings',COALESCE((SELECT jsonb_agg(x ORDER BY x->>'createdAt' DESC) FROM (SELECT safeer.staff_booking_row(b) AS x
   FROM safeer.bookings b WHERE b.company_id=cid AND b.trip_id=tid ORDER BY (b.status='held' AND b.expires_at>clock_timestamp()) DESC,b.created_at DESC LIMIT 200) y),'[]'::jsonb));
END $$;
CREATE OR REPLACE FUNCTION safeer.erase_due_passenger_data() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r record; n integer:=0;
BEGIN
 FOR r IN SELECT company_id,booking_id FROM safeer.booking_contacts WHERE erased_at IS NULL AND erase_at<=clock_timestamp() ORDER BY erase_at LIMIT 500 FOR UPDATE SKIP LOCKED LOOP
  UPDATE safeer.booking_passengers SET full_name=NULL,mobile=NULL WHERE company_id=r.company_id AND booking_id=r.booking_id;
  UPDATE safeer.booking_contacts SET mobile=NULL,erased_at=clock_timestamp() WHERE company_id=r.company_id AND booking_id=r.booking_id;
  UPDATE safeer.booking_events SET reason=NULL WHERE company_id=r.company_id AND booking_id=r.booking_id AND reason IS NOT NULL;
  UPDATE safeer.bookings SET release_reason=NULL WHERE company_id=r.company_id AND id=r.booking_id AND release_reason IS NOT NULL AND status<>'held';
  UPDATE safeer.payments SET late_reason=NULL WHERE company_id=r.company_id AND booking_id=r.booking_id AND late_reason IS NOT NULL;
  UPDATE safeer.refunds SET reason=NULL WHERE company_id=r.company_id AND booking_id=r.booking_id AND reason IS NOT NULL;
  INSERT INTO safeer.booking_events(company_id,booking_id,event,actor_kind) VALUES(r.company_id,r.booking_id,'erased','system');
  n:=n+1;
 END LOOP;
 -- A canceled trip stays refundable after erasure, so reasons written later still go, as do session notes.
 UPDATE safeer.refunds f SET reason=NULL FROM safeer.booking_contacts c WHERE c.company_id=f.company_id AND c.booking_id=f.booking_id AND c.erased_at IS NOT NULL AND f.reason IS NOT NULL AND f.created_at<=clock_timestamp()-interval '90 days';
 UPDATE safeer.booking_events e SET reason=NULL FROM safeer.booking_contacts c WHERE c.company_id=e.company_id AND c.booking_id=e.booking_id AND c.erased_at IS NOT NULL AND e.reason IS NOT NULL AND e.created_at<=clock_timestamp()-interval '90 days';
 UPDATE safeer.cash_sessions SET close_note=NULL WHERE close_note IS NOT NULL AND closed_at<=clock_timestamp()-interval '90 days';
 RETURN n;
END $$;
CREATE FUNCTION safeer.next_document(cid uuid,kind text,prefix text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n bigint;
BEGIN
 INSERT INTO safeer.document_sequences(company_id,document_type,next_value) VALUES(cid,kind,2)
  ON CONFLICT(company_id,document_type) DO UPDATE SET next_value=safeer.document_sequences.next_value+1 RETURNING next_value-1 INTO n;
 RETURN prefix||'-'||lpad(n::text,8,'0');
END $$;
-- Cash in the drawer: only cash counts, and it comes from the permanent payment and refund records.
CREATE FUNCTION safeer.session_totals(cid uuid,sid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('cashIn',COALESCE((SELECT sum(amount_minor) FROM safeer.payments WHERE company_id=cid AND session_id=sid AND method='cash'),0),
  'cashOut',COALESCE((SELECT sum(amount_minor) FROM safeer.refunds WHERE company_id=cid AND session_id=sid AND method='cash'),0),
  'otherIn',COALESCE((SELECT sum(amount_minor) FROM safeer.payments WHERE company_id=cid AND session_id=sid AND method<>'cash'),0),
  'otherOut',COALESCE((SELECT sum(amount_minor) FROM safeer.refunds WHERE company_id=cid AND session_id=sid AND method<>'cash'),0),
  'payments',(SELECT count(*) FROM safeer.payments WHERE company_id=cid AND session_id=sid),'refunds',(SELECT count(*) FROM safeer.refunds WHERE company_id=cid AND session_id=sid))
$$;
CREATE FUNCTION safeer.session_row(s safeer.cash_sessions) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',s.id,'counterId',s.counter_id,'counterName',c.name,'stationId',s.station_id,'stationNameEn',st.name_en,'stationNameAr',st.name_ar,'openedBy',u.display_name,'openedAt',s.opened_at,'openingMinor',s.opening_minor,'currency',s.currency,'closedAt',s.closed_at,'expectedMinor',s.expected_minor,'countedMinor',s.counted_minor,'closeNote',s.close_note,'mine',s.opened_by=safeer.company_actor(),'totals',safeer.session_totals(s.company_id,s.id))
 FROM safeer.station_counters c JOIN safeer.stations st ON (st.company_id,st.id)=(c.company_id,c.station_id) JOIN safeer.users u ON u.id=s.opened_by WHERE c.company_id=s.company_id AND c.id=s.counter_id
$$;
-- What a station screen needs. Scoped staff see the counters of their own stations and their own session.
CREATE FUNCTION safeer.counter_overview(cid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s safeer.cash_sessions%ROWTYPE; m boolean:=safeer.company_has(cid,'company.sessions.manage'); o boolean:=safeer.company_has(cid,'company.ticketing.operate'); pay safeer.company_payment_settings%ROWTYPE;
BEGIN
 IF NOT (m OR o OR safeer.company_has(cid,'company.resources.manage') OR safeer.company_can(cid,'company.profile.manage')) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM safeer.cash_sessions WHERE company_id=cid AND opened_by=safeer.company_actor() AND closed_at IS NULL;
 SELECT * INTO pay FROM safeer.company_payment_settings WHERE company_id=cid;
 RETURN jsonb_build_object('canOperate',o,'canManageSessions',m,'canPayLate',CASE WHEN s.id IS NULL THEN safeer.company_has(cid,'company.payments.late') ELSE safeer.company_can(cid,'company.payments.late',s.branch_id,s.station_id) END,'canManageSettings',safeer.company_can(cid,'company.profile.manage'),
  'settings',jsonb_build_object('bankTransfer',COALESCE(pay.bank_transfer,false),'mobileWallet',COALESCE(pay.mobile_wallet,false),'version',COALESCE(pay.version,0)),
  'session',CASE WHEN s.id IS NULL THEN NULL ELSE safeer.session_row(s) END,
  'counters',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'code',c.code,'name',c.name,'active',c.active,'version',c.version,'stationId',c.station_id,'stationNameEn',st.name_en,'stationNameAr',st.name_ar,'busy',EXISTS(SELECT 1 FROM safeer.cash_sessions x WHERE x.company_id=cid AND x.counter_id=c.id AND x.closed_at IS NULL),
    'canOpen',safeer.company_can(cid,'company.ticketing.operate',c.branch_id,c.station_id),'canEdit',safeer.company_can(cid,'company.resources.manage',c.branch_id,c.station_id)) ORDER BY st.code,c.code)
   FROM safeer.station_counters c JOIN safeer.stations st ON (st.company_id,st.id)=(c.company_id,c.station_id) WHERE c.company_id=cid AND (safeer.company_can(cid,'company.ticketing.operate',c.branch_id,c.station_id) OR safeer.company_can(cid,'company.sessions.manage',c.branch_id,c.station_id) OR safeer.company_can(cid,'company.resources.manage',c.branch_id,c.station_id))),'[]'::jsonb),
  'stations',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',st.id,'nameEn',st.name_en,'nameAr',st.name_ar) ORDER BY st.code) FROM safeer.stations st WHERE st.company_id=cid AND st.active AND safeer.company_can(cid,'company.resources.manage',st.branch_id,st.id)),'[]'::jsonb),
  'sessions',CASE WHEN m THEN COALESCE((SELECT jsonb_agg(safeer.session_row(x) ORDER BY x.closed_at IS NULL DESC,x.opened_at DESC) FROM (SELECT * FROM safeer.cash_sessions y WHERE y.company_id=cid AND safeer.company_can(cid,'company.sessions.manage',y.branch_id,y.station_id) ORDER BY y.closed_at IS NULL DESC,y.opened_at DESC LIMIT 50) x),'[]'::jsonb) ELSE '[]'::jsonb END,
  'trips',CASE WHEN o THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'routeNameEn',t.route_name_en,'routeNameAr',t.route_name_ar,'date',to_char(t.departure_at AT TIME ZONE t.timezone,'YYYY-MM-DD'),'time',to_char(t.departure_at AT TIME ZONE t.timezone,'HH24:MI'),'fareMinor',t.fare_minor,'currency',t.currency) ORDER BY t.departure_at) FROM (SELECT * FROM safeer.trips z WHERE z.company_id=cid AND z.status='published' AND z.departure_at>clock_timestamp() ORDER BY z.departure_at LIMIT 100) t),'[]'::jsonb) ELSE '[]'::jsonb END);
END $$;
CREATE FUNCTION safeer.counter_trip(cid uuid,tid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a safeer.trip_assignments%ROWTYPE; r safeer.seat_layout_revisions%ROWTYPE; t safeer.trips%ROWTYPE;
BEGIN
 IF NOT safeer.company_has(cid,'company.ticketing.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO t FROM safeer.trips WHERE company_id=cid AND id=tid AND status='published' AND departure_at>clock_timestamp();
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO a FROM safeer.trip_assignments WHERE company_id=cid AND trip_id=tid AND replaced_at IS NULL;
 SELECT * INTO r FROM safeer.seat_layout_revisions WHERE company_id=cid AND layout_id=a.layout_id AND revision=a.layout_revision;
 RETURN jsonb_build_object('id',t.id,'fareMinor',t.fare_minor,'currency',t.currency,'rows',r.row_count,'columns',r.column_count,
  'seats',(SELECT jsonb_agg(jsonb_build_object('label',s.label,'row',s.row_number,'column',s.column_number,'available',NOT EXISTS(SELECT 1 FROM safeer.seat_allocations h WHERE h.company_id=cid AND h.trip_id=tid AND h.row_number=s.row_number AND h.column_number=s.column_number AND (h.status='confirmed' OR (h.status='held' AND h.expires_at>clock_timestamp())))) ORDER BY s.row_number,s.column_number) FROM safeer.seat_layout_seats s WHERE s.company_id=cid AND s.layout_id=a.layout_id AND s.revision=a.layout_revision));
END $$;
CREATE FUNCTION safeer.save_payment_settings(cid uuid,actor uuid,p_bank boolean,p_wallet boolean,p_version integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_can(cid,'company.profile.manage') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF p_version=0 THEN INSERT INTO safeer.company_payment_settings(company_id,bank_transfer,mobile_wallet) VALUES(cid,p_bank,p_wallet);
 ELSE
  UPDATE safeer.company_payment_settings SET bank_transfer=p_bank,mobile_wallet=p_wallet,version=version+1 WHERE company_id=cid AND version=p_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='P0001'; END IF;
 END IF;
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,actor,'payment_methods.updated',cid);
END $$;
CREATE FUNCTION safeer.save_counter(cid uuid,actor uuid,p_id uuid,p_station uuid,p_code text,p_name text,p_active boolean,p_version integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE st safeer.stations%ROWTYPE; c safeer.station_counters%ROWTYPE; rid uuid;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF p_version=0 THEN
  SELECT * INTO st FROM safeer.stations WHERE company_id=cid AND id=p_station;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
  IF NOT safeer.company_can(cid,'company.resources.manage',st.branch_id,st.id) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
  IF (SELECT count(*) FROM safeer.station_counters WHERE company_id=cid)>=500 THEN RAISE EXCEPTION 'CATALOG_LIMIT' USING ERRCODE='P0001'; END IF;
  rid:=gen_random_uuid();INSERT INTO safeer.station_counters(id,company_id,branch_id,station_id,code,name) VALUES(rid,cid,st.branch_id,st.id,p_code,p_name);
 ELSE
  SELECT * INTO c FROM safeer.station_counters WHERE company_id=cid AND id=p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT safeer.company_can(cid,'company.resources.manage',c.branch_id,c.station_id) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
  IF c.active AND NOT p_active AND EXISTS(SELECT 1 FROM safeer.cash_sessions WHERE company_id=cid AND counter_id=p_id AND closed_at IS NULL) THEN RAISE EXCEPTION 'COUNTER_BUSY' USING ERRCODE='P0001'; END IF;
  UPDATE safeer.station_counters SET code=p_code,name=p_name,active=p_active,version=version+1 WHERE company_id=cid AND id=p_id AND version=p_version RETURNING id INTO rid;
  IF rid IS NULL THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='P0001'; END IF;
 END IF;
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id,branch_id,station_id) SELECT gen_random_uuid(),cid,actor,'counter.saved',rid,x.branch_id,x.station_id FROM safeer.station_counters x WHERE x.company_id=cid AND x.id=rid;
 RETURN rid;
END $$;
CREATE FUNCTION safeer.open_session(cid uuid,actor uuid,p_counter uuid,p_opening integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c safeer.station_counters%ROWTYPE; s safeer.cash_sessions%ROWTYPE;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM safeer.station_counters WHERE company_id=cid AND id=p_counter FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_can(cid,'company.ticketing.operate',c.branch_id,c.station_id) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT c.active THEN RAISE EXCEPTION 'COUNTER_INACTIVE' USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM safeer.cash_sessions WHERE company_id=cid AND closed_at IS NULL AND (counter_id=p_counter OR opened_by=actor)) THEN RAISE EXCEPTION 'SESSION_OPEN' USING ERRCODE='P0001'; END IF;
 INSERT INTO safeer.cash_sessions(id,company_id,counter_id,branch_id,station_id,opened_by,opening_minor) VALUES(gen_random_uuid(),cid,p_counter,c.branch_id,c.station_id,actor,p_opening) RETURNING * INTO s;
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id,branch_id,station_id) VALUES(gen_random_uuid(),cid,actor,'session.opened',s.id,s.branch_id,s.station_id);
 RETURN safeer.session_row(s);
END $$;
-- Closing compares counted cash with what the records expect. Any difference is kept; nothing is adjusted to hide it.
CREATE FUNCTION safeer.close_session(cid uuid,actor uuid,sid uuid,p_counted bigint,p_note text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s safeer.cash_sessions%ROWTYPE; totals jsonb; expected bigint;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM safeer.cash_sessions WHERE company_id=cid AND id=sid FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF NOT ((s.opened_by=actor AND safeer.company_can(cid,'company.ticketing.operate',s.branch_id,s.station_id)) OR safeer.company_can(cid,'company.sessions.manage',s.branch_id,s.station_id)) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF s.closed_at IS NOT NULL THEN RAISE EXCEPTION 'SESSION_CLOSED' USING ERRCODE='P0001'; END IF;
 totals:=safeer.session_totals(cid,sid);expected:=s.opening_minor+(totals->>'cashIn')::bigint-(totals->>'cashOut')::bigint;
 IF p_counted<>expected AND p_note IS NULL THEN RAISE EXCEPTION 'NOTE_REQUIRED' USING ERRCODE='P0001'; END IF;
 UPDATE safeer.cash_sessions SET closed_at=clock_timestamp(),closed_by=actor,expected_minor=expected,counted_minor=p_counted,close_note=p_note WHERE id=sid RETURNING * INTO s;
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id,branch_id,station_id) VALUES(gen_random_uuid(),cid,actor,'session.closed',sid,s.branch_id,s.station_id);
 RETURN safeer.session_row(s);
END $$;
-- The payment, receipt, tickets and seat confirmation commit together. A repeated key returns the original and records nothing new.
CREATE FUNCTION safeer.counter_pay(cid uuid,bid uuid,actor uuid,p_method text,p_reference text,p_key text,p_request text,p_late text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b safeer.bookings%ROWTYPE; s safeer.cash_sessions%ROWTYPE; t safeer.trips%ROWTYPE; a safeer.trip_assignments%ROWTYPE; paid safeer.payments%ROWTYPE; pay safeer.company_payment_settings%ROWTYPE; pid uuid:=gen_random_uuid(); x record;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO paid FROM safeer.payments WHERE company_id=cid AND key_hash=p_key;
 IF FOUND THEN
  IF paid.request_hash<>p_request OR paid.booking_id<>bid THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001'; END IF;
  RETURN jsonb_build_object('id',bid);
 END IF;
 SELECT * INTO s FROM safeer.cash_sessions WHERE company_id=cid AND opened_by=actor AND closed_at IS NULL;
 IF NOT FOUND THEN
  IF NOT safeer.company_has(cid,'company.ticketing.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
  RAISE EXCEPTION 'NO_OPEN_SESSION' USING ERRCODE='P0001';
 END IF;
 IF NOT safeer.company_can(cid,'company.ticketing.operate',s.branch_id,s.station_id) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO b FROM safeer.bookings WHERE company_id=cid AND id=bid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO t FROM safeer.trips WHERE company_id=cid AND id=b.trip_id FOR NO KEY UPDATE;
 PERFORM 1 FROM safeer.cash_sessions WHERE id=s.id AND closed_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NO_OPEN_SESSION' USING ERRCODE='P0001'; END IF;
 -- A retry that waited behind its own first attempt returns that attempt.
 SELECT * INTO paid FROM safeer.payments WHERE company_id=cid AND key_hash=p_key;
 IF FOUND THEN
  IF paid.request_hash<>p_request OR paid.booking_id<>bid THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001'; END IF;
  RETURN jsonb_build_object('id',bid);
 END IF;
 PERFORM safeer.expire_trip_holds(cid,t.id);
 SELECT * INTO b FROM safeer.bookings WHERE company_id=cid AND id=bid;
 IF b.status IN ('confirmed','refunded') THEN RAISE EXCEPTION 'ALREADY_PAID' USING ERRCODE='P0001'; END IF;
 IF b.status='released' THEN RAISE EXCEPTION 'HOLD_CLOSED' USING ERRCODE='P0001'; END IF;
 IF t.status<>'published' OR t.departure_at<=clock_timestamp() THEN RAISE EXCEPTION 'TRIP_NOT_BOOKABLE' USING ERRCODE='P0001'; END IF;
 SELECT * INTO pay FROM safeer.company_payment_settings WHERE company_id=cid;
 IF (p_method='bank_transfer' AND NOT COALESCE(pay.bank_transfer,false)) OR (p_method='mobile_wallet' AND NOT COALESCE(pay.mobile_wallet,false)) THEN RAISE EXCEPTION 'METHOD_DISABLED' USING ERRCODE='P0001'; END IF;
 IF s.currency<>b.currency THEN RAISE EXCEPTION 'CURRENCY_MISMATCH' USING ERRCODE='P0001'; END IF;
 IF b.status='expired' THEN
  IF NOT safeer.company_can(cid,'company.payments.late',s.branch_id,s.station_id) THEN RAISE EXCEPTION 'HOLD_ENDED' USING ERRCODE='P0001'; END IF;
  IF p_late IS NULL THEN RAISE EXCEPTION 'LATE_REASON_REQUIRED' USING ERRCODE='P0001'; END IF;
  SELECT * INTO a FROM safeer.trip_assignments WHERE company_id=cid AND trip_id=t.id AND replaced_at IS NULL;
  IF EXISTS(SELECT 1 FROM safeer.seat_allocations o WHERE o.company_id=cid AND o.booking_id=bid AND (o.layout_id,o.layout_revision)<>(a.layout_id,a.layout_revision))
   OR EXISTS(SELECT 1 FROM safeer.seat_allocations o JOIN safeer.seat_allocations h ON h.company_id=o.company_id AND h.trip_id=o.trip_id AND h.row_number=o.row_number AND h.column_number=o.column_number AND h.id<>o.id AND h.status IN ('held','confirmed') WHERE o.company_id=cid AND o.booking_id=bid)
  THEN RAISE EXCEPTION 'SEATS_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
 END IF;
 INSERT INTO safeer.payments(id,company_id,booking_id,session_id,method,method_reference,amount_minor,currency,taken_by,late,late_reason,key_hash,request_hash)
  VALUES(pid,cid,bid,s.id,p_method,p_reference,b.amount_minor,b.currency,actor,b.status='expired',CASE WHEN b.status='expired' THEN p_late END,p_key,p_request);
 INSERT INTO safeer.receipts(company_id,payment_id,receipt_number) VALUES(cid,pid,safeer.next_document(cid,'receipt','RCP'));
 UPDATE safeer.seat_allocations SET status='confirmed' WHERE company_id=cid AND booking_id=bid;
 FOR x IN SELECT id FROM safeer.seat_allocations WHERE company_id=cid AND booking_id=bid ORDER BY row_number,column_number LOOP
  INSERT INTO safeer.tickets(company_id,booking_id,allocation_id,payment_id,ticket_number) VALUES(cid,bid,x.id,pid,safeer.next_document(cid,'ticket','TKT'));
 END LOOP;
 UPDATE safeer.bookings SET status='confirmed',closed_at=COALESCE(closed_at,clock_timestamp()) WHERE company_id=cid AND id=bid;
 INSERT INTO safeer.booking_events(company_id,booking_id,event,actor_kind,actor_id,reason) VALUES(cid,bid,'paid','staff',actor,CASE WHEN b.status='expired' THEN p_late END);
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id,branch_id,station_id) VALUES(gen_random_uuid(),cid,actor,CASE WHEN b.status='expired' THEN 'payment.recorded_late' ELSE 'payment.recorded' END,bid,s.branch_id,s.station_id);
 RETURN jsonb_build_object('id',bid);
END $$;
-- A walk-in sale holds and pays in one transaction, so a failed payment leaves no seats taken.
CREATE FUNCTION safeer.counter_sale(cid uuid,actor uuid,tid uuid,labels text[],p_id uuid,p_reference text,p_access text,p_request text,p_mobile text,p_travelers jsonb,p_method text,p_method_reference text,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b safeer.bookings%ROWTYPE; n integer;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM safeer.cash_sessions WHERE company_id=cid AND opened_by=actor AND closed_at IS NULL) AND NOT EXISTS(SELECT 1 FROM safeer.payments WHERE company_id=cid AND key_hash=p_key) THEN
  IF NOT safeer.company_has(cid,'company.ticketing.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
  RAISE EXCEPTION 'NO_OPEN_SESSION' USING ERRCODE='P0001';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM safeer.trips WHERE company_id=cid AND id=tid) THEN RAISE EXCEPTION 'TRIP_NOT_BOOKABLE' USING ERRCODE='P0001'; END IF;
 PERFORM safeer.hold_seats(tid,labels,p_id,p_reference,p_access,p_request,false,actor);
 SELECT * INTO b FROM safeer.bookings WHERE access_hash=p_access;
 IF NOT EXISTS(SELECT 1 FROM safeer.booking_contacts WHERE company_id=cid AND booking_id=b.id) THEN
  INSERT INTO safeer.booking_contacts(company_id,booking_id,mobile,erase_at) SELECT cid,b.id,p_mobile,t.arrival_at+interval '90 days' FROM safeer.trips t WHERE t.company_id=cid AND t.id=b.trip_id;
  INSERT INTO safeer.booking_passengers(company_id,booking_id,allocation_id,full_name,mobile)
   SELECT cid,b.id,a.id,x.name,x.mobile FROM safeer.seat_allocations a JOIN jsonb_to_recordset(p_travelers) AS x(seat text,name text,mobile text) ON x.seat=a.label WHERE a.company_id=cid AND a.booking_id=b.id;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>b.seat_count THEN RAISE EXCEPTION 'INVALID_PASSENGERS' USING ERRCODE='P0001'; END IF;
 END IF;
 PERFORM safeer.counter_pay(cid,b.id,actor,p_method,p_method_reference,p_key,p_request,NULL);
 RETURN jsonb_build_object('id',b.id,'reference',b.reference);
END $$;
-- Full refund until departure, or at any time if the trip was canceled (D32). The refund goes out by the same method as the payment.
CREATE FUNCTION safeer.counter_refund(cid uuid,bid uuid,actor uuid,p_reference text,p_key text,p_request text,why text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b safeer.bookings%ROWTYPE; s safeer.cash_sessions%ROWTYPE; t safeer.trips%ROWTYPE; paid safeer.payments%ROWTYPE; f safeer.refunds%ROWTYPE;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO f FROM safeer.refunds WHERE company_id=cid AND key_hash=p_key;
 IF FOUND THEN
  IF f.request_hash<>p_request OR f.booking_id<>bid THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001'; END IF;
  RETURN jsonb_build_object('id',bid);
 END IF;
 SELECT * INTO s FROM safeer.cash_sessions WHERE company_id=cid AND opened_by=actor AND closed_at IS NULL;
 IF NOT FOUND THEN
  IF NOT safeer.company_has(cid,'company.ticketing.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
  RAISE EXCEPTION 'NO_OPEN_SESSION' USING ERRCODE='P0001';
 END IF;
 IF NOT safeer.company_can(cid,'company.ticketing.operate',s.branch_id,s.station_id) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO b FROM safeer.bookings WHERE company_id=cid AND id=bid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO t FROM safeer.trips WHERE company_id=cid AND id=b.trip_id FOR NO KEY UPDATE;
 PERFORM 1 FROM safeer.cash_sessions WHERE id=s.id AND closed_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NO_OPEN_SESSION' USING ERRCODE='P0001'; END IF;
 SELECT * INTO f FROM safeer.refunds WHERE company_id=cid AND key_hash=p_key;
 IF FOUND THEN
  IF f.request_hash<>p_request OR f.booking_id<>bid THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001'; END IF;
  RETURN jsonb_build_object('id',bid);
 END IF;
 SELECT * INTO b FROM safeer.bookings WHERE company_id=cid AND id=bid;
 IF b.status='refunded' THEN RAISE EXCEPTION 'ALREADY_REFUNDED' USING ERRCODE='P0001'; END IF;
 IF b.status<>'confirmed' THEN RAISE EXCEPTION 'NOT_PAID' USING ERRCODE='P0001'; END IF;
 IF t.status<>'canceled' AND t.departure_at<=clock_timestamp() THEN RAISE EXCEPTION 'REFUND_CLOSED' USING ERRCODE='P0001'; END IF;
 SELECT * INTO paid FROM safeer.payments WHERE company_id=cid AND booking_id=bid;
 IF paid.method<>'cash' AND p_reference IS NULL THEN RAISE EXCEPTION 'REFERENCE_REQUIRED' USING ERRCODE='P0001'; END IF;
 IF s.currency<>paid.currency THEN RAISE EXCEPTION 'CURRENCY_MISMATCH' USING ERRCODE='P0001'; END IF;
 INSERT INTO safeer.refunds(id,company_id,booking_id,payment_id,session_id,refund_number,method,method_reference,amount_minor,currency,refunded_by,reason,key_hash,request_hash)
  VALUES(gen_random_uuid(),cid,bid,paid.id,s.id,safeer.next_document(cid,'refund','RFD'),paid.method,CASE WHEN paid.method='cash' THEN NULL ELSE p_reference END,paid.amount_minor,paid.currency,actor,why,p_key,p_request);
 UPDATE safeer.tickets SET status='refunded' WHERE company_id=cid AND booking_id=bid;
 UPDATE safeer.seat_allocations SET status='released' WHERE company_id=cid AND booking_id=bid AND status='confirmed';
 UPDATE safeer.bookings SET status='refunded' WHERE company_id=cid AND id=bid;
 INSERT INTO safeer.booking_events(company_id,booking_id,event,actor_kind,actor_id,reason) VALUES(cid,bid,'refunded','staff',actor,why);
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id,branch_id,station_id) VALUES(gen_random_uuid(),cid,actor,'payment.refunded',bid,s.branch_id,s.station_id);
 RETURN jsonb_build_object('id',bid);
END $$;
CREATE FUNCTION safeer.record_print(cid uuid,bid uuid,actor uuid,kind text) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE earlier bigint;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_has(cid,'company.ticketing.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM safeer.bookings WHERE company_id=cid AND id=bid) THEN RETURN NULL; END IF;
 IF (kind='refund' AND NOT EXISTS(SELECT 1 FROM safeer.refunds WHERE company_id=cid AND booking_id=bid)) OR (kind<>'refund' AND NOT EXISTS(SELECT 1 FROM safeer.payments WHERE company_id=cid AND booking_id=bid)) THEN RAISE EXCEPTION 'NOT_PAID' USING ERRCODE='P0001'; END IF;
 -- A valid ticket is never printed for a refunded booking.
 IF kind='tickets' AND EXISTS(SELECT 1 FROM safeer.refunds WHERE company_id=cid AND booking_id=bid) THEN RAISE EXCEPTION 'ALREADY_REFUNDED' USING ERRCODE='P0001'; END IF;
 IF kind='tickets' AND EXISTS(SELECT 1 FROM safeer.bookings b JOIN safeer.trips t ON (t.company_id,t.id)=(b.company_id,b.trip_id) WHERE b.company_id=cid AND b.id=bid AND t.status='canceled') THEN RAISE EXCEPTION 'TRIP_NOT_BOOKABLE' USING ERRCODE='P0001'; END IF;
 PERFORM pg_advisory_xact_lock(94108,hashtext(bid::text));
 SELECT count(*) INTO earlier FROM safeer.document_prints WHERE company_id=cid AND booking_id=bid AND document=kind;
 INSERT INTO safeer.document_prints(company_id,booking_id,document,printed_by) VALUES(cid,bid,kind,actor);
 RETURN earlier;
END $$;
CREATE FUNCTION safeer.trip_finished_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF OLD.status='published' AND NEW.status='canceled' AND OLD.arrival_at<=clock_timestamp() THEN RAISE EXCEPTION 'TRIP_FINISHED' USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trip_finished_guard BEFORE UPDATE ON safeer.trips FOR EACH ROW EXECUTE FUNCTION safeer.trip_finished_guard();
REVOKE ALL ON FUNCTION safeer.trip_finished_guard(),safeer.money_guard(),safeer.hold_seats(uuid,text[],uuid,text,text,text,boolean,uuid),safeer.booking_tickets(uuid,uuid),safeer.booking_payment(uuid,uuid),safeer.booking_refund(uuid,uuid),safeer.next_document(uuid,text,text),safeer.session_totals(uuid,uuid),safeer.session_row(safeer.cash_sessions),safeer.counter_overview(uuid),safeer.counter_trip(uuid,uuid),safeer.save_payment_settings(uuid,uuid,boolean,boolean,integer),safeer.save_counter(uuid,uuid,uuid,uuid,text,text,boolean,integer),safeer.open_session(uuid,uuid,uuid,integer),safeer.close_session(uuid,uuid,uuid,bigint,text),safeer.counter_pay(uuid,uuid,uuid,text,text,text,text,text),safeer.counter_sale(uuid,uuid,uuid,text[],uuid,text,text,text,text,jsonb,text,text,text),safeer.counter_refund(uuid,uuid,uuid,text,text,text,text),safeer.record_print(uuid,uuid,uuid,text) FROM PUBLIC;
