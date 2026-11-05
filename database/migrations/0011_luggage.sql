-- Section 11. Existing company-role copies are deliberately not rewritten. Bags are weighed but carry no fees (D33).
INSERT INTO safeer.permissions(code,module) VALUES ('company.luggage.operate','company'),('company.luggage.resolve','company');
INSERT INTO safeer.role_permissions(role_id,permission_code)
 SELECT r.id,p FROM safeer.roles r CROSS JOIN unnest(ARRAY['company.luggage.operate','company.luggage.resolve']) p WHERE r.code IN ('company_administrator','branch_manager','station_manager') ON CONFLICT DO NOTHING;
INSERT INTO safeer.role_permissions(role_id,permission_code)
 SELECT r.id,'company.luggage.operate' FROM safeer.roles r WHERE r.code='ticketing_employee' ON CONFLICT DO NOTHING;
UPDATE safeer.roles SET version=version+1 WHERE code IN ('company_administrator','branch_manager','station_manager','ticketing_employee');
-- What a traveler says they are carrying. It is only their word, and goes with their name.
ALTER TABLE safeer.booking_passengers ADD COLUMN luggage_note varchar(300) CHECK(length(btrim(luggage_note))>0);
ALTER TABLE safeer.document_sequences DROP CONSTRAINT document_sequences_document_type_check;
ALTER TABLE safeer.document_sequences ADD CONSTRAINT document_sequences_document_type_check CHECK(document_type IN ('ticket','receipt','refund','luggage','tag'));
CREATE TABLE safeer.luggage_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,booking_id uuid NOT NULL,allocation_id uuid NOT NULL,ticket_id uuid NOT NULL,trip_id uuid NOT NULL,bus_id uuid,
 luggage_number varchar(16) NOT NULL,category varchar(10) NOT NULL CHECK(category IN ('suitcase','bag','box','other')),quantity smallint NOT NULL CHECK(quantity BETWEEN 1 AND 20),weight_grams integer NOT NULL CHECK(weight_grams BETWEEN 1 AND 500000),
 description varchar(300),handling varchar(200),lifecycle varchar(10) NOT NULL DEFAULT 'registered' CHECK(lifecycle IN ('registered','tagged','loaded','in_transit','unloaded','collected','lost')),
 registered_by uuid NOT NULL REFERENCES safeer.users(id),registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),key_hash char(64) NOT NULL,request_hash char(64) NOT NULL,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(company_id,id),UNIQUE(company_id,luggage_number),UNIQUE(company_id,key_hash),
 FOREIGN KEY(company_id,booking_id,allocation_id) REFERENCES safeer.seat_allocations(company_id,booking_id,id),
 FOREIGN KEY(company_id,trip_id) REFERENCES safeer.trips(company_id,id)
);
CREATE INDEX luggage_records_booking ON safeer.luggage_records(company_id,booking_id);
CREATE INDEX luggage_records_trip ON safeer.luggage_records(company_id,trip_id);
CREATE INDEX luggage_records_recent ON safeer.luggage_records(company_id,registered_at DESC);
-- Only a hash of the QR value is kept, so it can be shown once and a stolen database cannot print a tag.
CREATE TABLE safeer.luggage_tags (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,luggage_id uuid NOT NULL,tag_number varchar(16) NOT NULL,qr_hash char(64) NOT NULL UNIQUE,issued_by uuid NOT NULL REFERENCES safeer.users(id),issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),replaced_at timestamptz,
 UNIQUE(company_id,tag_number),FOREIGN KEY(company_id,luggage_id) REFERENCES safeer.luggage_records(company_id,id)
);
CREATE UNIQUE INDEX luggage_tags_current ON safeer.luggage_tags(company_id,luggage_id) WHERE replaced_at IS NULL;
CREATE TABLE safeer.luggage_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,company_id uuid NOT NULL,luggage_id uuid NOT NULL,event varchar(20) NOT NULL CHECK(event IN ('registered','updated','tagged','tag_replaced','moved','corrected','returned','collected','exception_reported','exception_resolved')),
 from_state varchar(10),to_state varchar(10),actor_id uuid NOT NULL REFERENCES safeer.users(id),reason varchar(300),before jsonb,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(company_id,luggage_id) REFERENCES safeer.luggage_records(company_id,id)
);
CREATE INDEX luggage_events_bag ON safeer.luggage_events(company_id,luggage_id,created_at);
-- An exception sits beside the lifecycle and never overwrites it.
CREATE TABLE safeer.luggage_exceptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,luggage_id uuid NOT NULL,kind varchar(10) NOT NULL CHECK(kind IN ('damaged','missing','wrong_bag','other')),note varchar(300),reported_by uuid NOT NULL REFERENCES safeer.users(id),reported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 resolved_by uuid REFERENCES safeer.users(id),resolved_at timestamptz,outcome varchar(10) CHECK(outcome IN ('found','settled','closed')),resolution_note varchar(300),
 CHECK((resolved_at IS NULL)=(resolved_by IS NULL)),CHECK((resolved_at IS NULL)=(outcome IS NULL)),
 UNIQUE(company_id,id),FOREIGN KEY(company_id,luggage_id) REFERENCES safeer.luggage_records(company_id,id)
);
CREATE UNIQUE INDEX luggage_exceptions_open ON safeer.luggage_exceptions(company_id,luggage_id) WHERE resolved_at IS NULL;
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['luggage_records','luggage_tags','luggage_events','luggage_exceptions'] LOOP
  EXECUTE format('ALTER TABLE safeer.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON safeer.%I FROM PUBLIC',t);
 END LOOP;
END $$;
-- History can only be added to. Erasure may clear written text, and a tag may only be marked replaced.
CREATE FUNCTION safeer.luggage_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Immutable luggage history' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='luggage_events' THEN
  IF to_jsonb(NEW)->>'reason' IS NULL AND (to_jsonb(NEW)-'reason') IS NOT DISTINCT FROM (to_jsonb(OLD)-'reason') THEN RETURN NEW; END IF;
 ELSIF TG_TABLE_NAME='luggage_tags' THEN
  IF to_jsonb(OLD)->>'replaced_at' IS NULL AND (to_jsonb(NEW)-'replaced_at') IS NOT DISTINCT FROM (to_jsonb(OLD)-'replaced_at') THEN RETURN NEW; END IF;
 ELSIF TG_TABLE_NAME='luggage_exceptions' THEN
  IF to_jsonb(OLD)->>'resolved_at' IS NULL AND (to_jsonb(NEW)-ARRAY['resolved_by','resolved_at','outcome','resolution_note','note']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['resolved_by','resolved_at','outcome','resolution_note','note']) THEN RETURN NEW; END IF;
  IF to_jsonb(NEW)->>'note' IS NULL AND to_jsonb(NEW)->>'resolution_note' IS NULL AND (to_jsonb(NEW)-ARRAY['note','resolution_note']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['note','resolution_note']) THEN RETURN NEW; END IF;
 ELSE
  IF (to_jsonb(NEW)-ARRAY['lifecycle','version','category','quantity','weight_grams','description','handling']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['lifecycle','version','category','quantity','weight_grams','description','handling']) THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'Immutable luggage history' USING ERRCODE='42501';
END $$;
CREATE TRIGGER luggage_guard BEFORE UPDATE OR DELETE ON safeer.luggage_records FOR EACH ROW EXECUTE FUNCTION safeer.luggage_guard();
CREATE TRIGGER luggage_guard BEFORE UPDATE OR DELETE ON safeer.luggage_tags FOR EACH ROW EXECUTE FUNCTION safeer.luggage_guard();
CREATE TRIGGER luggage_guard BEFORE UPDATE OR DELETE ON safeer.luggage_events FOR EACH ROW EXECUTE FUNCTION safeer.luggage_guard();
CREATE TRIGGER luggage_guard BEFORE UPDATE OR DELETE ON safeer.luggage_exceptions FOR EACH ROW EXECUTE FUNCTION safeer.luggage_guard();
-- A ticket cannot be refunded while its bags are with the company. Staff return them first.
CREATE FUNCTION safeer.refund_luggage_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM safeer.luggage_records WHERE company_id=NEW.company_id AND booking_id=NEW.booking_id AND lifecycle NOT IN ('collected','lost')) THEN RAISE EXCEPTION 'LUGGAGE_HELD' USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER refund_luggage_guard BEFORE INSERT ON safeer.refunds FOR EACH ROW EXECUTE FUNCTION safeer.refund_luggage_guard();
-- What a passenger may see: their bags and where they are, without staff notes.
CREATE FUNCTION safeer.luggage_status(l safeer.luggage_records) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM safeer.luggage_exceptions e WHERE e.company_id=l.company_id AND e.luggage_id=l.id AND e.resolved_at IS NULL) THEN 'exception_reported' ELSE l.lifecycle END
$$;
CREATE FUNCTION safeer.booking_luggage(cid uuid,bid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('number',l.luggage_number,'category',l.category,'quantity',l.quantity,'seat',a.label,'status',safeer.luggage_status(l),'withCompany',l.lifecycle NOT IN ('collected','lost')) ORDER BY l.registered_at,l.id),'[]'::jsonb)
 FROM safeer.luggage_records l JOIN safeer.seat_allocations a ON a.id=l.allocation_id WHERE l.company_id=cid AND l.booking_id=bid
$$;
CREATE OR REPLACE FUNCTION safeer.booking_travelers(cid uuid,bid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('seat',a.label,'name',p.full_name,'mobile',p.mobile,'luggage',p.luggage_note) ORDER BY a.row_number,a.column_number),'[]'::jsonb)
 FROM safeer.booking_passengers p JOIN safeer.seat_allocations a ON a.id=p.allocation_id WHERE p.company_id=cid AND p.booking_id=bid
$$;
CREATE OR REPLACE FUNCTION safeer.public_book(tid uuid,labels text[],p_id uuid,p_reference text,p_access text,p_request text,p_mobile text,p_travelers jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b safeer.bookings%ROWTYPE; n integer;
BEGIN
 PERFORM safeer.public_hold(tid,labels,p_id,p_reference,p_access,p_request);
 SELECT * INTO b FROM safeer.bookings WHERE access_hash=p_access;
 IF EXISTS(SELECT 1 FROM safeer.booking_contacts WHERE company_id=b.company_id AND booking_id=b.id) THEN RETURN safeer.booking_view(b); END IF;
 INSERT INTO safeer.booking_contacts(company_id,booking_id,mobile,erase_at)
  SELECT b.company_id,b.id,p_mobile,t.arrival_at+interval '90 days' FROM safeer.trips t WHERE t.company_id=b.company_id AND t.id=b.trip_id;
 INSERT INTO safeer.booking_passengers(company_id,booking_id,allocation_id,full_name,mobile,luggage_note)
  SELECT b.company_id,b.id,a.id,x.name,x.mobile,x.luggage FROM safeer.seat_allocations a JOIN jsonb_to_recordset(p_travelers) AS x(seat text,name text,mobile text,luggage text) ON x.seat=a.label
  WHERE a.company_id=b.company_id AND a.booking_id=b.id;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>b.seat_count THEN RAISE EXCEPTION 'INVALID_PASSENGERS' USING ERRCODE='P0001'; END IF;
 RETURN safeer.booking_view(b);
END $$;
CREATE OR REPLACE FUNCTION safeer.staff_update_travelers(cid uuid,bid uuid,actor uuid,p_version integer,p_mobile text,p_travelers jsonb,why text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b safeer.bookings%ROWTYPE; n integer;
BEGIN
 IF NOT safeer.company_can(cid,'company.bookings.manage') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO b FROM safeer.bookings WHERE company_id=cid AND id=bid;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM 1 FROM safeer.trips WHERE company_id=cid AND id=b.trip_id FOR NO KEY UPDATE;
 PERFORM safeer.expire_trip_holds(cid,b.trip_id);
 IF NOT EXISTS(SELECT 1 FROM safeer.bookings WHERE company_id=cid AND id=bid AND status='held') THEN RAISE EXCEPTION 'HOLD_CLOSED' USING ERRCODE='P0001'; END IF;
 UPDATE safeer.booking_contacts SET mobile=p_mobile,version=version+1 WHERE company_id=cid AND booking_id=bid AND version=p_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='P0001'; END IF;
 UPDATE safeer.booking_passengers p SET full_name=x.name,mobile=x.mobile,luggage_note=x.luggage FROM safeer.seat_allocations a,jsonb_to_recordset(p_travelers) AS x(seat text,name text,mobile text,luggage text)
  WHERE p.company_id=cid AND p.booking_id=bid AND a.id=p.allocation_id AND a.label=x.seat;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>b.seat_count THEN RAISE EXCEPTION 'INVALID_PASSENGERS' USING ERRCODE='P0001'; END IF;
 INSERT INTO safeer.booking_events(company_id,booking_id,event,actor_kind,actor_id,reason) VALUES(cid,bid,'changed','staff',actor,why);
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION safeer.counter_sale(cid uuid,actor uuid,tid uuid,labels text[],p_id uuid,p_reference text,p_access text,p_request text,p_mobile text,p_travelers jsonb,p_method text,p_method_reference text,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
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
  INSERT INTO safeer.booking_passengers(company_id,booking_id,allocation_id,full_name,mobile,luggage_note)
   SELECT cid,b.id,a.id,x.name,x.mobile,x.luggage FROM safeer.seat_allocations a JOIN jsonb_to_recordset(p_travelers) AS x(seat text,name text,mobile text,luggage text) ON x.seat=a.label WHERE a.company_id=cid AND a.booking_id=b.id;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>b.seat_count THEN RAISE EXCEPTION 'INVALID_PASSENGERS' USING ERRCODE='P0001'; END IF;
 END IF;
 PERFORM safeer.counter_pay(cid,b.id,actor,p_method,p_method_reference,p_key,p_request,NULL);
 RETURN jsonb_build_object('id',b.id,'reference',b.reference);
END $$;
CREATE OR REPLACE FUNCTION safeer.booking_view(b safeer.bookings) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('reference',b.reference,'status',CASE WHEN b.status='held' AND b.expires_at<=clock_timestamp() THEN 'expired' ELSE b.status END,
  'releasedBy',b.released_by_kind,'expiresAt',b.expires_at,'serverNow',clock_timestamp(),'createdAt',b.created_at,
  'holdMinutes',b.hold_minutes,'seatCount',b.seat_count,'fareMinor',b.fare_minor,'amountMinor',b.amount_minor,'currency',b.currency,
  'seats',(SELECT jsonb_agg(a.label ORDER BY a.row_number,a.column_number) FROM safeer.seat_allocations a WHERE a.company_id=b.company_id AND a.booking_id=b.id),
  'tickets',safeer.booking_tickets(b.company_id,b.id),'luggage',safeer.booking_luggage(b.company_id,b.id),'tripCanceled',t.status='canceled','mobile',c.mobile,'detailsErased',c.erased_at IS NOT NULL,'travelers',safeer.booking_travelers(b.company_id,b.id),
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
  'tickets',safeer.booking_tickets(b.company_id,b.id),'luggage',safeer.booking_luggage(b.company_id,b.id),'payment',safeer.booking_payment(b.company_id,b.id),'refund',safeer.booking_refund(b.company_id,b.id),'tripCanceled',t.status='canceled','refundable',b.status='confirmed' AND (t.status='canceled' OR t.departure_at>clock_timestamp()),'tripOpen',t.status='published' AND t.departure_at>clock_timestamp(),'mobile',c.mobile,'version',c.version,'hasDetails',c.booking_id IS NOT NULL,'detailsErased',c.erased_at IS NOT NULL,'eraseAt',c.erase_at,'travelers',safeer.booking_travelers(b.company_id,b.id),
  'seats',(SELECT jsonb_agg(a.label ORDER BY a.row_number,a.column_number) FROM safeer.seat_allocations a WHERE a.company_id=b.company_id AND a.booking_id=b.id),
  'routeNameEn',t.route_name_en,'routeNameAr',t.route_name_ar,'timezone',t.timezone,'date',to_char(t.departure_at AT TIME ZONE t.timezone,'YYYY-MM-DD'),'time',to_char(t.departure_at AT TIME ZONE t.timezone,'HH24:MI'))
 FROM safeer.trips t LEFT JOIN safeer.booking_contacts c ON c.company_id=b.company_id AND c.booking_id=b.id
 WHERE t.company_id=b.company_id AND t.id=b.trip_id
$$;
CREATE OR REPLACE FUNCTION safeer.erase_due_passenger_data() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r record; n integer:=0;
BEGIN
 FOR r IN SELECT company_id,booking_id FROM safeer.booking_contacts WHERE erased_at IS NULL AND erase_at<=clock_timestamp() ORDER BY erase_at LIMIT 500 FOR UPDATE SKIP LOCKED LOOP
  UPDATE safeer.booking_passengers SET full_name=NULL,mobile=NULL,luggage_note=NULL WHERE company_id=r.company_id AND booking_id=r.booking_id;
  UPDATE safeer.booking_contacts SET mobile=NULL,erased_at=clock_timestamp() WHERE company_id=r.company_id AND booking_id=r.booking_id;
  UPDATE safeer.booking_events SET reason=NULL WHERE company_id=r.company_id AND booking_id=r.booking_id AND reason IS NOT NULL;
  UPDATE safeer.bookings SET release_reason=NULL WHERE company_id=r.company_id AND id=r.booking_id AND release_reason IS NOT NULL AND status<>'held';
  UPDATE safeer.payments SET late_reason=NULL WHERE company_id=r.company_id AND booking_id=r.booking_id AND late_reason IS NOT NULL;
  UPDATE safeer.refunds SET reason=NULL WHERE company_id=r.company_id AND booking_id=r.booking_id AND reason IS NOT NULL;
  UPDATE safeer.luggage_records SET description=NULL,handling=NULL,version=version+1 WHERE company_id=r.company_id AND booking_id=r.booking_id AND (description IS NOT NULL OR handling IS NOT NULL);
  UPDATE safeer.luggage_events e SET reason=NULL FROM safeer.luggage_records l WHERE e.company_id=l.company_id AND e.luggage_id=l.id AND l.company_id=r.company_id AND l.booking_id=r.booking_id AND e.reason IS NOT NULL;
  UPDATE safeer.luggage_exceptions e SET note=NULL,resolution_note=NULL FROM safeer.luggage_records l WHERE e.company_id=l.company_id AND e.luggage_id=l.id AND l.company_id=r.company_id AND l.booking_id=r.booking_id AND (e.note IS NOT NULL OR e.resolution_note IS NOT NULL);
  INSERT INTO safeer.booking_events(company_id,booking_id,event,actor_kind) VALUES(r.company_id,r.booking_id,'erased','system');
  n:=n+1;
 END LOOP;
 -- A canceled trip stays refundable after erasure, so reasons written later still go, as do session notes.
 UPDATE safeer.refunds f SET reason=NULL FROM safeer.booking_contacts c WHERE c.company_id=f.company_id AND c.booking_id=f.booking_id AND c.erased_at IS NOT NULL AND f.reason IS NOT NULL AND f.created_at<=clock_timestamp()-interval '90 days';
 UPDATE safeer.booking_events e SET reason=NULL FROM safeer.booking_contacts c WHERE c.company_id=e.company_id AND c.booking_id=e.booking_id AND c.erased_at IS NOT NULL AND e.reason IS NOT NULL AND e.created_at<=clock_timestamp()-interval '90 days';
 UPDATE safeer.cash_sessions SET close_note=NULL WHERE close_note IS NOT NULL AND closed_at<=clock_timestamp()-interval '90 days';
 -- Bags can still be handled after erasure, for example lost and found, so later notes go too.
 UPDATE safeer.luggage_events e SET reason=NULL FROM safeer.luggage_records l JOIN safeer.booking_contacts c ON (c.company_id,c.booking_id)=(l.company_id,l.booking_id) WHERE e.company_id=l.company_id AND e.luggage_id=l.id AND c.erased_at IS NOT NULL AND e.reason IS NOT NULL AND e.created_at<=clock_timestamp()-interval '90 days';
 UPDATE safeer.luggage_exceptions e SET note=NULL,resolution_note=NULL FROM safeer.luggage_records l JOIN safeer.booking_contacts c ON (c.company_id,c.booking_id)=(l.company_id,l.booking_id) WHERE e.company_id=l.company_id AND e.luggage_id=l.id AND c.erased_at IS NOT NULL AND (e.note IS NOT NULL OR e.resolution_note IS NOT NULL) AND e.reported_at<=clock_timestamp()-interval '90 days';
 RETURN n;
END $$;
CREATE FUNCTION safeer.luggage_row(l safeer.luggage_records) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',l.id,'number',l.luggage_number,'category',l.category,'quantity',l.quantity,'weightGrams',l.weight_grams,'description',l.description,'handling',l.handling,'lifecycle',l.lifecycle,'status',safeer.luggage_status(l),'version',l.version,'registeredAt',l.registered_at,
  'bookingId',l.booking_id,'reference',b.reference,'ticketNumber',k.ticket_number,'ticketStatus',k.status,'seat',a.label,'traveler',p.full_name,'routeNameEn',t.route_name_en,'routeNameAr',t.route_name_ar,'timezone',t.timezone,'date',to_char(t.departure_at AT TIME ZONE t.timezone,'YYYY-MM-DD'),'time',to_char(t.departure_at AT TIME ZONE t.timezone,'HH24:MI'),'tripStatus',t.status,
  'busRegistration',bus.registration,'tagNumber',(SELECT g.tag_number FROM safeer.luggage_tags g WHERE g.company_id=l.company_id AND g.luggage_id=l.id AND g.replaced_at IS NULL),
  'exception',(SELECT jsonb_build_object('id',e.id,'kind',e.kind,'note',e.note,'at',e.reported_at,'by',u.display_name) FROM safeer.luggage_exceptions e JOIN safeer.users u ON u.id=e.reported_by WHERE e.company_id=l.company_id AND e.luggage_id=l.id AND e.resolved_at IS NULL),
  'events',(SELECT jsonb_agg(jsonb_build_object('event',v.event,'from',v.from_state,'to',v.to_state,'reason',v.reason,'before',v.before,'at',v.created_at,'by',u.display_name) ORDER BY v.created_at,v.id) FROM safeer.luggage_events v JOIN safeer.users u ON u.id=v.actor_id WHERE v.company_id=l.company_id AND v.luggage_id=l.id))
 FROM safeer.bookings b JOIN safeer.trips t ON (t.company_id,t.id)=(b.company_id,b.trip_id) JOIN safeer.tickets k ON k.company_id=l.company_id AND k.id=l.ticket_id JOIN safeer.seat_allocations a ON a.id=l.allocation_id
 LEFT JOIN safeer.booking_passengers p ON (p.company_id,p.booking_id,p.allocation_id)=(l.company_id,l.booking_id,l.allocation_id) LEFT JOIN safeer.trip_assignments ca ON ca.company_id=l.company_id AND ca.trip_id=l.trip_id AND ca.replaced_at IS NULL LEFT JOIN safeer.buses bus ON (bus.company_id,bus.id)=(ca.company_id,ca.bus_id)
 WHERE b.company_id=l.company_id AND b.id=l.booking_id
$$;
-- Company-wide staff can list bags. Others need a number from the ticket, tag or booking in front of them.
CREATE FUNCTION safeer.luggage_find(cid uuid,p_query text,p_token text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE wide boolean; k record; tag safeer.luggage_tags%ROWTYPE;
BEGIN
 IF NOT (safeer.company_has(cid,'company.luggage.operate') OR safeer.company_has(cid,'company.luggage.resolve')) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 wide:=safeer.company_can(cid,'company.luggage.operate') OR safeer.company_can(cid,'company.luggage.resolve');
 IF p_token IS NOT NULL THEN
  SELECT * INTO tag FROM safeer.luggage_tags WHERE company_id=cid AND qr_hash=p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAG_UNKNOWN' USING ERRCODE='P0001'; END IF;
  IF tag.replaced_at IS NOT NULL THEN RAISE EXCEPTION 'TAG_REPLACED' USING ERRCODE='P0001'; END IF;
  RETURN jsonb_build_object('searchOnly',NOT wide,'ticket',NULL,'items',(SELECT jsonb_agg(safeer.luggage_row(l)) FROM safeer.luggage_records l WHERE l.company_id=cid AND l.id=tag.luggage_id));
 END IF;
 SELECT t.ticket_number,t.status,t.booking_id,a.label,p.full_name,p.luggage_note,b.reference,tr.status='published' AND tr.departure_at>clock_timestamp() AS can_register INTO k FROM safeer.tickets t JOIN safeer.seat_allocations a ON a.id=t.allocation_id JOIN safeer.bookings b ON (b.company_id,b.id)=(t.company_id,t.booking_id) JOIN safeer.trips tr ON (tr.company_id,tr.id)=(b.company_id,b.trip_id) LEFT JOIN safeer.booking_passengers p ON (p.company_id,p.booking_id,p.allocation_id)=(t.company_id,t.booking_id,t.allocation_id) WHERE t.company_id=cid AND t.ticket_number=p_query;
 RETURN jsonb_build_object('searchOnly',NOT wide,
  'ticket',CASE WHEN k.ticket_number IS NULL THEN NULL ELSE jsonb_build_object('number',k.ticket_number,'status',k.status,'seat',k.label,'traveler',k.full_name,'declared',k.luggage_note,'canRegister',k.status='valid' AND k.can_register,'reference',CASE WHEN wide THEN k.reference END) END,
  'items',COALESCE((SELECT jsonb_agg(CASE WHEN wide THEN safeer.luggage_row(y) ELSE safeer.luggage_row(y)-ARRAY['reference','bookingId'] END ORDER BY y.registered_at DESC) FROM (SELECT l.* FROM safeer.luggage_records l WHERE l.company_id=cid AND (
    (p_query IS NULL AND wide) OR l.luggage_number=p_query OR l.booking_id=k.booking_id
    OR l.id=(SELECT g.luggage_id FROM safeer.luggage_tags g WHERE g.company_id=cid AND g.tag_number=p_query AND g.replaced_at IS NULL)
    OR l.booking_id=(SELECT b.id FROM safeer.bookings b WHERE b.company_id=cid AND b.reference=p_query)) ORDER BY l.registered_at DESC LIMIT 50) y),'[]'::jsonb));
END $$;
-- Only a valid ticket on a trip that has not left can have bags registered.
CREATE FUNCTION safeer.luggage_register(cid uuid,actor uuid,p_ticket text,p_category text,p_quantity integer,p_grams integer,p_description text,p_handling text,p_key text,p_request text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE k safeer.tickets%ROWTYPE; b safeer.bookings%ROWTYPE; t safeer.trips%ROWTYPE; l safeer.luggage_records%ROWTYPE; a safeer.trip_assignments%ROWTYPE;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_has(cid,'company.luggage.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM safeer.luggage_records WHERE company_id=cid AND key_hash=p_key;
 IF FOUND THEN
  IF l.request_hash<>p_request THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001'; END IF;
  RETURN safeer.luggage_row(l);
 END IF;
 SELECT * INTO k FROM safeer.tickets WHERE company_id=cid AND ticket_number=p_ticket;
 IF NOT FOUND THEN RAISE EXCEPTION 'TICKET_REQUIRED' USING ERRCODE='P0001'; END IF;
 SELECT * INTO b FROM safeer.bookings WHERE company_id=cid AND id=k.booking_id;
 -- The trip lock is the one refunds take, so a bag cannot slip in while its ticket is being refunded.
 SELECT * INTO t FROM safeer.trips WHERE company_id=cid AND id=b.trip_id FOR NO KEY UPDATE;
 SELECT * INTO l FROM safeer.luggage_records WHERE company_id=cid AND key_hash=p_key;
 IF FOUND THEN
  IF l.request_hash<>p_request THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001'; END IF;
  RETURN safeer.luggage_row(l);
 END IF;
 SELECT * INTO k FROM safeer.tickets WHERE company_id=cid AND id=k.id;
 IF k.status<>'valid' THEN RAISE EXCEPTION 'TICKET_REQUIRED' USING ERRCODE='P0001'; END IF;
 IF t.status<>'published' OR t.departure_at<=clock_timestamp() THEN RAISE EXCEPTION 'TRIP_NOT_BOOKABLE' USING ERRCODE='P0001'; END IF;
 SELECT * INTO a FROM safeer.trip_assignments WHERE company_id=cid AND trip_id=t.id AND replaced_at IS NULL;
 INSERT INTO safeer.luggage_records(company_id,booking_id,allocation_id,ticket_id,trip_id,bus_id,luggage_number,category,quantity,weight_grams,description,handling,registered_by,key_hash,request_hash)
  VALUES(cid,b.id,k.allocation_id,k.id,t.id,a.bus_id,safeer.next_document(cid,'luggage','LUG'),p_category,p_quantity,p_grams,p_description,p_handling,actor,p_key,p_request) RETURNING * INTO l;
 INSERT INTO safeer.luggage_events(company_id,luggage_id,event,to_state,actor_id) VALUES(cid,l.id,'registered','registered',actor);
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,actor,'luggage.registered',l.id);
 RETURN safeer.luggage_row(l);
END $$;
CREATE FUNCTION safeer.luggage_update(cid uuid,actor uuid,lid uuid,p_category text,p_quantity integer,p_grams integer,p_description text,p_handling text,p_version integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE l safeer.luggage_records%ROWTYPE; was jsonb; erased boolean;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_has(cid,'company.luggage.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM safeer.luggage_records WHERE company_id=cid AND id=lid FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF l.version<>p_version THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='P0001'; END IF;
 was:=jsonb_build_object('category',l.category,'quantity',l.quantity,'weightGrams',l.weight_grams);
 erased:=EXISTS(SELECT 1 FROM safeer.booking_contacts c WHERE c.company_id=cid AND c.booking_id=l.booking_id AND c.erased_at IS NOT NULL);
 IF l.lifecycle NOT IN ('registered','tagged') THEN RAISE EXCEPTION 'LUGGAGE_STATE' USING ERRCODE='P0001'; END IF;
 UPDATE safeer.luggage_records SET category=p_category,quantity=p_quantity,weight_grams=p_grams,description=CASE WHEN erased THEN NULL ELSE p_description END,handling=CASE WHEN erased THEN NULL ELSE p_handling END,version=version+1 WHERE company_id=cid AND id=lid RETURNING * INTO l;
 INSERT INTO safeer.luggage_events(company_id,luggage_id,event,from_state,to_state,actor_id,before) VALUES(cid,lid,'updated',l.lifecycle,l.lifecycle,actor,was);
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,actor,'luggage.updated',lid);
 RETURN safeer.luggage_row(l);
END $$;
-- The first tag moves the bag on. Printing again replaces the tag, so the old QR stops working.
CREATE FUNCTION safeer.luggage_tag(cid uuid,actor uuid,lid uuid,p_hash text,why text,p_version integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE l safeer.luggage_records%ROWTYPE; g safeer.luggage_tags%ROWTYPE; had boolean;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_has(cid,'company.luggage.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM safeer.luggage_records WHERE company_id=cid AND id=lid FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF l.lifecycle IN ('collected','lost') THEN RAISE EXCEPTION 'LUGGAGE_STATE' USING ERRCODE='P0001'; END IF;
 had:=EXISTS(SELECT 1 FROM safeer.luggage_tags WHERE company_id=cid AND luggage_id=lid AND replaced_at IS NULL);
 IF had AND why IS NULL THEN RAISE EXCEPTION 'TAG_REASON_REQUIRED' USING ERRCODE='P0001'; END IF;
 IF had AND p_version IS DISTINCT FROM l.version THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='P0001'; END IF;
 UPDATE safeer.luggage_tags SET replaced_at=clock_timestamp() WHERE company_id=cid AND luggage_id=lid AND replaced_at IS NULL;
 INSERT INTO safeer.luggage_tags(company_id,luggage_id,tag_number,qr_hash,issued_by) VALUES(cid,lid,safeer.next_document(cid,'tag','TAG'),p_hash,actor) RETURNING * INTO g;
 UPDATE safeer.luggage_records SET lifecycle=CASE WHEN lifecycle='registered' THEN 'tagged' ELSE lifecycle END,version=version+1 WHERE company_id=cid AND id=lid RETURNING * INTO l;
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,actor,CASE WHEN had THEN 'luggage.tag_replaced' ELSE 'luggage.tagged' END,lid);
 INSERT INTO safeer.luggage_events(company_id,luggage_id,event,from_state,to_state,actor_id,reason) VALUES(cid,lid,CASE WHEN had THEN 'tag_replaced' ELSE 'tagged' END,CASE WHEN had THEN l.lifecycle ELSE 'registered' END,l.lifecycle,actor,why);
 RETURN jsonb_build_object('tagNumber',g.tag_number,'row',safeer.luggage_row(l));
END $$;
-- Moves follow the journey one step at a time. A step back needs a reason and is recorded as a correction.
CREATE FUNCTION safeer.luggage_move(cid uuid,actor uuid,lid uuid,p_to text,why text,p_version integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE l safeer.luggage_records%ROWTYPE; t safeer.trips%ROWTYPE; was text; back boolean;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_has(cid,'company.luggage.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM safeer.luggage_records WHERE company_id=cid AND id=lid FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF l.version<>p_version THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='P0001'; END IF;
 was:=l.lifecycle;back:=was='loaded' AND p_to='tagged';
 IF NOT (back OR (was,p_to) IN (('tagged','loaded'),('loaded','in_transit'),('in_transit','unloaded'))) THEN RAISE EXCEPTION 'LUGGAGE_STATE' USING ERRCODE='P0001'; END IF;
 IF back AND why IS NULL THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='P0001'; END IF;
 SELECT * INTO t FROM safeer.trips WHERE company_id=cid AND id=l.trip_id;
 IF p_to IN ('loaded','in_transit') AND NOT back AND t.status='canceled' THEN RAISE EXCEPTION 'LUGGAGE_STATE' USING ERRCODE='P0001'; END IF;
 IF p_to='in_transit' AND t.departure_at>clock_timestamp() THEN RAISE EXCEPTION 'LUGGAGE_NOT_DEPARTED' USING ERRCODE='P0001'; END IF;
 UPDATE safeer.luggage_records SET lifecycle=p_to,version=version+1 WHERE company_id=cid AND id=lid RETURNING * INTO l;
 INSERT INTO safeer.luggage_events(company_id,luggage_id,event,from_state,to_state,actor_id,reason) VALUES(cid,lid,CASE WHEN back THEN 'corrected' ELSE 'moved' END,was,p_to,actor,why);
 RETURN safeer.luggage_row(l);
END $$;
-- Handing a bag over needs its ticket number or the booking's mobile number, and no open problem. Before travel it is a return, with a reason.
CREATE FUNCTION safeer.luggage_collect(cid uuid,actor uuid,lid uuid,p_ticket text,p_mobile text,why text,p_version integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE l safeer.luggage_records%ROWTYPE; was text; early boolean;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_has(cid,'company.luggage.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM safeer.luggage_records WHERE company_id=cid AND id=lid FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF l.version<>p_version THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='P0001'; END IF;
 was:=l.lifecycle;early:=was IN ('registered','tagged');
 IF NOT (early OR was='unloaded') THEN RAISE EXCEPTION 'LUGGAGE_STATE' USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM safeer.luggage_exceptions WHERE company_id=cid AND luggage_id=lid AND resolved_at IS NULL) THEN RAISE EXCEPTION 'LUGGAGE_EXCEPTION_OPEN' USING ERRCODE='P0001'; END IF;
 IF early AND why IS NULL THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='P0001'; END IF;
 IF NOT (EXISTS(SELECT 1 FROM safeer.tickets k WHERE k.company_id=cid AND k.id=l.ticket_id AND k.ticket_number=p_ticket)
  OR EXISTS(SELECT 1 FROM safeer.booking_contacts c WHERE c.company_id=cid AND c.booking_id=l.booking_id AND c.mobile=p_mobile)) THEN RAISE EXCEPTION 'COLLECTION_NOT_VERIFIED' USING ERRCODE='P0001'; END IF;
 UPDATE safeer.luggage_records SET lifecycle='collected',version=version+1 WHERE company_id=cid AND id=lid RETURNING * INTO l;
 INSERT INTO safeer.luggage_events(company_id,luggage_id,event,from_state,to_state,actor_id,reason) VALUES(cid,lid,CASE WHEN early THEN 'returned' ELSE 'collected' END,was,'collected',actor,why);
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,actor,CASE WHEN early THEN 'luggage.returned' ELSE 'luggage.collected' END,lid);
 RETURN safeer.luggage_row(l);
END $$;
CREATE FUNCTION safeer.luggage_report(cid uuid,actor uuid,lid uuid,p_kind text,p_note text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE l safeer.luggage_records%ROWTYPE;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_has(cid,'company.luggage.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM safeer.luggage_records WHERE company_id=cid AND id=lid FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM safeer.luggage_exceptions WHERE company_id=cid AND luggage_id=lid AND resolved_at IS NULL) THEN RAISE EXCEPTION 'LUGGAGE_EXCEPTION_OPEN' USING ERRCODE='P0001'; END IF;
 INSERT INTO safeer.luggage_exceptions(company_id,luggage_id,kind,note,reported_by) VALUES(cid,lid,p_kind,p_note,actor);
 INSERT INTO safeer.luggage_events(company_id,luggage_id,event,from_state,to_state,actor_id,reason) VALUES(cid,lid,'exception_reported',l.lifecycle,l.lifecycle,actor,p_note);
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,actor,'luggage.exception_reported',lid);
 RETURN safeer.luggage_row(l);
END $$;
-- Resolving is a separate permission, and returns the display to the recorded lifecycle.
CREATE FUNCTION safeer.luggage_resolve(cid uuid,actor uuid,lid uuid,eid uuid,p_outcome text,p_note text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE l safeer.luggage_records%ROWTYPE; x safeer.luggage_exceptions%ROWTYPE; was text;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_has(cid,'company.luggage.resolve') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM safeer.luggage_records WHERE company_id=cid AND id=lid FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE safeer.luggage_exceptions SET resolved_by=actor,resolved_at=clock_timestamp(),outcome=p_outcome,resolution_note=p_note WHERE company_id=cid AND id=eid AND luggage_id=lid AND resolved_at IS NULL RETURNING * INTO x;
 IF NOT FOUND THEN RAISE EXCEPTION 'LUGGAGE_STATE' USING ERRCODE='P0001'; END IF;
 was:=l.lifecycle;
 IF x.kind='missing' AND p_outcome<>'found' AND l.lifecycle<>'collected' THEN UPDATE safeer.luggage_records SET lifecycle='lost',version=version+1 WHERE company_id=cid AND id=lid RETURNING * INTO l; END IF;
 INSERT INTO safeer.luggage_events(company_id,luggage_id,event,from_state,to_state,actor_id,reason) VALUES(cid,lid,'exception_resolved',was,l.lifecycle,actor,p_note);
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,actor,'luggage.exception_resolved',lid);
 RETURN safeer.luggage_row(l);
END $$;
CREATE OR REPLACE FUNCTION safeer.save_counter(cid uuid,actor uuid,p_id uuid,p_station uuid,p_code text,p_name text,p_active boolean,p_version integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
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
  SELECT * INTO c FROM safeer.station_counters WHERE company_id=cid AND id=p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT safeer.company_can(cid,'company.resources.manage',c.branch_id,c.station_id) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
  IF c.active AND NOT p_active AND EXISTS(SELECT 1 FROM safeer.cash_sessions WHERE company_id=cid AND counter_id=p_id AND closed_at IS NULL) THEN RAISE EXCEPTION 'COUNTER_BUSY' USING ERRCODE='P0001'; END IF;
  UPDATE safeer.station_counters SET code=p_code,name=p_name,active=p_active,version=version+1 WHERE company_id=cid AND id=p_id AND version=p_version RETURNING id INTO rid;
  IF rid IS NULL THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='P0001'; END IF;
 END IF;
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id,branch_id,station_id) SELECT gen_random_uuid(),cid,actor,'counter.saved',rid,x.branch_id,x.station_id FROM safeer.station_counters x WHERE x.company_id=cid AND x.id=rid;
 RETURN rid;
END $$;
REVOKE ALL ON FUNCTION safeer.luggage_guard(),safeer.refund_luggage_guard(),safeer.luggage_status(safeer.luggage_records),safeer.booking_luggage(uuid,uuid),safeer.luggage_row(safeer.luggage_records),safeer.luggage_find(uuid,text,text),safeer.luggage_register(uuid,uuid,text,text,integer,integer,text,text,text,text),safeer.luggage_update(uuid,uuid,uuid,text,integer,integer,text,text,integer),safeer.luggage_tag(uuid,uuid,uuid,text,text,integer),safeer.luggage_move(uuid,uuid,uuid,text,text,integer),safeer.luggage_collect(uuid,uuid,uuid,text,text,text,integer),safeer.luggage_report(uuid,uuid,uuid,text,text),safeer.luggage_resolve(uuid,uuid,uuid,uuid,text,text) FROM PUBLIC;
