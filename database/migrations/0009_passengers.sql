-- Section 09. Personal details live apart from the immutable booking history, so they can be erased and the booking record stays.
ALTER TABLE safeer.seat_allocations ADD CONSTRAINT seat_allocations_booking_seat UNIQUE(company_id,booking_id,id);
ALTER TABLE safeer.booking_events DROP CONSTRAINT booking_events_event_check;
ALTER TABLE safeer.booking_events ADD CONSTRAINT booking_events_event_check CHECK(event IN ('held','expired','released','changed','erased'));
CREATE TABLE safeer.booking_contacts (
 company_id uuid NOT NULL,booking_id uuid NOT NULL,
 mobile varchar(16) CHECK(mobile ~ '^\+[1-9][0-9]{7,14}$'),
 erase_at timestamptz NOT NULL,erased_at timestamptz,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 CHECK((mobile IS NULL)=(erased_at IS NOT NULL)),
 PRIMARY KEY(company_id,booking_id),FOREIGN KEY(company_id,booking_id) REFERENCES safeer.bookings(company_id,id)
);
CREATE INDEX booking_contacts_mobile ON safeer.booking_contacts(company_id,mobile) WHERE mobile IS NOT NULL;
CREATE INDEX booking_contacts_due ON safeer.booking_contacts(erase_at) WHERE erased_at IS NULL;
CREATE TABLE safeer.booking_passengers (
 company_id uuid NOT NULL,booking_id uuid NOT NULL,allocation_id uuid NOT NULL,
 full_name varchar(100) CHECK(length(btrim(full_name))>=2),mobile varchar(16) CHECK(mobile ~ '^\+[1-9][0-9]{7,14}$'),
 PRIMARY KEY(company_id,booking_id,allocation_id),
 FOREIGN KEY(company_id,booking_id,allocation_id) REFERENCES safeer.seat_allocations(company_id,booking_id,id)
);
-- A staff reason may name someone, so the release check no longer needs the reason to stay, and erasure may clear it.
DO $$
DECLARE name text;
BEGIN
 SELECT conname INTO name FROM pg_constraint WHERE conrelid='safeer.bookings'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%release_reason%';
 EXECUTE format('ALTER TABLE safeer.bookings DROP CONSTRAINT %I',name);
END $$;
ALTER TABLE safeer.bookings ADD CONSTRAINT bookings_staff_release CHECK((released_by_kind='staff')=(released_by IS NOT NULL));
CREATE OR REPLACE FUNCTION safeer.booking_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Immutable booking history' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='booking_events' THEN
  IF NEW.reason IS NULL AND (to_jsonb(NEW)-'reason') IS NOT DISTINCT FROM (to_jsonb(OLD)-'reason') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Immutable booking history' USING ERRCODE='42501';
 END IF;
 IF OLD.status<>'held' AND NEW.release_reason IS NULL AND (to_jsonb(NEW)-'release_reason') IS NOT DISTINCT FROM (to_jsonb(OLD)-'release_reason') THEN RETURN NEW; END IF;
 IF OLD.status<>'held' OR (to_jsonb(NEW)-ARRAY['status','closed_at','released_by_kind','released_by','release_reason']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','closed_at','released_by_kind','released_by','release_reason']) THEN RAISE EXCEPTION 'Immutable booking history' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
-- Details can be corrected or erased, never deleted row by row, moved to another booking or restored after erasure.
CREATE FUNCTION safeer.passenger_data_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Immutable booking history' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='booking_contacts' THEN
  IF OLD.erased_at IS NOT NULL OR (NEW.company_id,NEW.booking_id,NEW.erase_at) IS DISTINCT FROM (OLD.company_id,OLD.booking_id,OLD.erase_at) THEN RAISE EXCEPTION 'Immutable booking history' USING ERRCODE='42501'; END IF;
 ELSIF OLD.full_name IS NULL OR (NEW.company_id,NEW.booking_id,NEW.allocation_id) IS DISTINCT FROM (OLD.company_id,OLD.booking_id,OLD.allocation_id) THEN RAISE EXCEPTION 'Immutable booking history' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER passenger_data_guard BEFORE UPDATE OR DELETE ON safeer.booking_contacts FOR EACH ROW EXECUTE FUNCTION safeer.passenger_data_guard();
CREATE TRIGGER passenger_data_guard BEFORE UPDATE OR DELETE ON safeer.booking_passengers FOR EACH ROW EXECUTE FUNCTION safeer.passenger_data_guard();
ALTER TABLE safeer.booking_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE safeer.booking_passengers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON safeer.booking_contacts,safeer.booking_passengers FROM PUBLIC;
-- The same list of travelers for every reader. Masking for reference-and-mobile access happens in public_lookup.
CREATE FUNCTION safeer.booking_travelers(cid uuid,bid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('seat',a.label,'name',p.full_name,'mobile',p.mobile) ORDER BY a.row_number,a.column_number),'[]'::jsonb)
 FROM safeer.booking_passengers p JOIN safeer.seat_allocations a ON a.id=p.allocation_id WHERE p.company_id=cid AND p.booking_id=bid
$$;
CREATE OR REPLACE FUNCTION safeer.booking_view(b safeer.bookings) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('reference',b.reference,'status',CASE WHEN b.status='held' AND b.expires_at<=clock_timestamp() THEN 'expired' ELSE b.status END,
  'releasedBy',b.released_by_kind,'expiresAt',b.expires_at,'serverNow',clock_timestamp(),'createdAt',b.created_at,
  'holdMinutes',b.hold_minutes,'seatCount',b.seat_count,'fareMinor',b.fare_minor,'amountMinor',b.amount_minor,'currency',b.currency,
  'seats',(SELECT jsonb_agg(a.label ORDER BY a.row_number,a.column_number) FROM safeer.seat_allocations a WHERE a.company_id=b.company_id AND a.booking_id=b.id),
  'mobile',c.mobile,'detailsErased',c.erased_at IS NOT NULL,'travelers',safeer.booking_travelers(b.company_id,b.id),
  'tripId',t.id,'routeNameEn',t.route_name_en,'routeNameAr',t.route_name_ar,
  'date',to_char(t.departure_at AT TIME ZONE t.timezone,'YYYY-MM-DD'),'time',to_char(t.departure_at AT TIME ZONE t.timezone,'HH24:MI'),
  'tripOpen',t.status='published' AND t.departure_at>clock_timestamp(),'companySlug',co.slug,'companyNameEn',co.name_en,'companyNameAr',co.name_ar,
  'phone',CASE WHEN visible THEN p.public_phone END,'email',CASE WHEN visible THEN p.public_email END,'address',CASE WHEN visible THEN p.public_address END)
 FROM safeer.trips t JOIN safeer.companies co ON co.id=t.company_id LEFT JOIN safeer.company_public_profiles p ON p.company_id=t.company_id
 LEFT JOIN safeer.booking_contacts c ON c.company_id=b.company_id AND c.booking_id=b.id
 -- A company that has hidden itself or lost approval no longer shows contact details, even to someone holding an old key.
 CROSS JOIN LATERAL (SELECT co.status='approved' AND COALESCE(p.listed,false) AS visible) v
 WHERE t.company_id=b.company_id AND t.id=b.trip_id
$$;
-- A hold now always carries its travelers: seats and details commit together or not at all.
CREATE FUNCTION safeer.public_book(tid uuid,labels text[],p_id uuid,p_reference text,p_access text,p_request text,p_mobile text,p_travelers jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b safeer.bookings%ROWTYPE; n integer;
BEGIN
 PERFORM safeer.public_hold(tid,labels,p_id,p_reference,p_access,p_request);
 SELECT * INTO b FROM safeer.bookings WHERE access_hash=p_access;
 IF EXISTS(SELECT 1 FROM safeer.booking_contacts WHERE company_id=b.company_id AND booking_id=b.id) THEN RETURN safeer.booking_view(b); END IF;
 INSERT INTO safeer.booking_contacts(company_id,booking_id,mobile,erase_at)
  SELECT b.company_id,b.id,p_mobile,t.arrival_at+interval '90 days' FROM safeer.trips t WHERE t.company_id=b.company_id AND t.id=b.trip_id;
 INSERT INTO safeer.booking_passengers(company_id,booking_id,allocation_id,full_name,mobile)
  SELECT b.company_id,b.id,a.id,x.name,x.mobile FROM safeer.seat_allocations a JOIN jsonb_to_recordset(p_travelers) AS x(seat text,name text,mobile text) ON x.seat=a.label
  WHERE a.company_id=b.company_id AND a.booking_id=b.id;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>b.seat_count THEN RAISE EXCEPTION 'INVALID_PASSENGERS' USING ERRCODE='P0001'; END IF;
 RETURN safeer.booking_view(b);
END $$;
-- Finds an attempt whose reply was lost. The browser saves only the key, so no personal details wait in its storage.
CREATE FUNCTION safeer.public_booking_by_key(p_access text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT safeer.booking_view(b) FROM safeer.bookings b WHERE b.access_hash=p_access
$$;
-- Reference and mobile prove less than the device key, so this view masks the number and shortens names.
CREATE FUNCTION safeer.mask_booking(doc jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT doc||jsonb_build_object('retrieved',true,'mobile',left(doc->>'mobile',4)||'•••••'||right(doc->>'mobile',3),
  'travelers',COALESCE((SELECT jsonb_agg(jsonb_build_object('seat',t->>'seat','name',
    split_part(btrim(t->>'name'),' ',1)||CASE WHEN position(' ' in btrim(t->>'name'))>0 THEN ' '||left(split_part(btrim(t->>'name'),' ',2),1)||'.' ELSE '' END,'mobile',NULL)) FROM jsonb_array_elements(doc->'travelers') t),'[]'::jsonb))
$$;
CREATE FUNCTION safeer.public_lookup(p_reference text,p_mobile text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT safeer.mask_booking(safeer.booking_view(b)) FROM safeer.bookings b JOIN safeer.booking_contacts c ON c.company_id=b.company_id AND c.booking_id=b.id
 WHERE b.reference=p_reference AND c.mobile=p_mobile
$$;
CREATE FUNCTION safeer.public_release_by_mobile(p_reference text,p_mobile text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE access text;
BEGIN
 SELECT b.access_hash INTO access FROM safeer.bookings b JOIN safeer.booking_contacts c ON c.company_id=b.company_id AND c.booking_id=b.id WHERE b.reference=p_reference AND c.mobile=p_mobile;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN safeer.mask_booking(safeer.public_release(p_reference,access));
END $$;
-- Removes names and numbers 90 days after the trip ends. The booking, seats and amounts stay.
CREATE FUNCTION safeer.erase_due_passenger_data() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r record; n integer:=0;
BEGIN
 FOR r IN SELECT company_id,booking_id FROM safeer.booking_contacts WHERE erased_at IS NULL AND erase_at<=clock_timestamp() ORDER BY erase_at LIMIT 500 FOR UPDATE SKIP LOCKED LOOP
  UPDATE safeer.booking_passengers SET full_name=NULL,mobile=NULL WHERE company_id=r.company_id AND booking_id=r.booking_id;
  UPDATE safeer.booking_contacts SET mobile=NULL,erased_at=clock_timestamp() WHERE company_id=r.company_id AND booking_id=r.booking_id;
  UPDATE safeer.booking_events SET reason=NULL WHERE company_id=r.company_id AND booking_id=r.booking_id AND reason IS NOT NULL;
  UPDATE safeer.bookings SET release_reason=NULL WHERE company_id=r.company_id AND id=r.booking_id AND release_reason IS NOT NULL AND status<>'held';
  INSERT INTO safeer.booking_events(company_id,booking_id,event,actor_kind) VALUES(r.company_id,r.booking_id,'erased','system');
  n:=n+1;
 END LOOP;
 RETURN n;
END $$;
CREATE FUNCTION safeer.staff_booking_row(b safeer.bookings) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',b.id,'tripId',b.trip_id,'reference',b.reference,'status',CASE WHEN b.status='held' AND b.expires_at<=clock_timestamp() THEN 'expired' ELSE b.status END,
  'releasedBy',b.released_by_kind,'releaseReason',b.release_reason,'createdAt',b.created_at,'expiresAt',b.expires_at,'closedAt',b.closed_at,'amountMinor',b.amount_minor,'currency',b.currency,
  'mobile',c.mobile,'version',c.version,'hasDetails',c.booking_id IS NOT NULL,'detailsErased',c.erased_at IS NOT NULL,'eraseAt',c.erase_at,'travelers',safeer.booking_travelers(b.company_id,b.id),
  'seats',(SELECT jsonb_agg(a.label ORDER BY a.row_number,a.column_number) FROM safeer.seat_allocations a WHERE a.company_id=b.company_id AND a.booking_id=b.id),
  'routeNameEn',t.route_name_en,'routeNameAr',t.route_name_ar,'timezone',t.timezone,'date',to_char(t.departure_at AT TIME ZONE t.timezone,'YYYY-MM-DD'),'time',to_char(t.departure_at AT TIME ZONE t.timezone,'HH24:MI'))
 FROM safeer.trips t LEFT JOIN safeer.booking_contacts c ON c.company_id=b.company_id AND c.booking_id=b.id
 WHERE t.company_id=b.company_id AND t.id=b.trip_id
$$;
CREATE FUNCTION safeer.staff_bookings(cid uuid,p_reference text,p_mobile text,p_name text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT safeer.company_can(cid,'company.bookings.read') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('canManage',safeer.company_can(cid,'company.bookings.manage'),'items',COALESCE((SELECT jsonb_agg(safeer.staff_booking_row(y.b) ORDER BY y.live DESC,(y.b).created_at DESC) FROM (
  SELECT b,(b.status='held' AND b.expires_at>clock_timestamp()) AS live FROM safeer.bookings b
  LEFT JOIN safeer.booking_contacts c ON c.company_id=b.company_id AND c.booking_id=b.id
  WHERE b.company_id=cid AND (p_reference IS NULL OR b.reference=p_reference) AND (p_mobile IS NULL OR c.mobile=p_mobile)
   AND (p_name IS NULL OR EXISTS(SELECT 1 FROM safeer.booking_passengers p WHERE p.company_id=b.company_id AND p.booking_id=b.id AND position(lower(p_name) in lower(p.full_name))>0))
  ORDER BY (b.status='held' AND b.expires_at>clock_timestamp()) DESC,b.created_at DESC LIMIT 50) y),'[]'::jsonb));
END $$;
CREATE FUNCTION safeer.staff_booking(cid uuid,bid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b safeer.bookings%ROWTYPE;
BEGIN
 IF NOT safeer.company_can(cid,'company.bookings.read') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO b FROM safeer.bookings WHERE company_id=cid AND id=bid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN safeer.staff_booking_row(b)||jsonb_build_object('canManage',safeer.company_can(cid,'company.bookings.manage'),
  'events',(SELECT jsonb_agg(jsonb_build_object('event',e.event,'actorKind',e.actor_kind,'reason',e.reason,'at',e.created_at) ORDER BY e.created_at,e.id) FROM safeer.booking_events e WHERE e.company_id=cid AND e.booking_id=bid));
END $$;
-- Staff can correct details only while seats are held. The reason is recorded; the old values are not kept.
CREATE FUNCTION safeer.staff_update_travelers(cid uuid,bid uuid,actor uuid,p_version integer,p_mobile text,p_travelers jsonb,why text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
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
 UPDATE safeer.booking_passengers p SET full_name=x.name,mobile=x.mobile FROM safeer.seat_allocations a,jsonb_to_recordset(p_travelers) AS x(seat text,name text,mobile text)
  WHERE p.company_id=cid AND p.booking_id=bid AND a.id=p.allocation_id AND a.label=x.seat;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>b.seat_count THEN RAISE EXCEPTION 'INVALID_PASSENGERS' USING ERRCODE='P0001'; END IF;
 INSERT INTO safeer.booking_events(company_id,booking_id,event,actor_kind,actor_id,reason) VALUES(cid,bid,'changed','staff',actor,why);
 RETURN true;
END $$;
-- The trip's seat view now names who holds what, for staff with the booking permission.
CREATE OR REPLACE FUNCTION safeer.staff_seat_map(cid uuid,tid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a safeer.trip_assignments%ROWTYPE; r safeer.seat_layout_revisions%ROWTYPE;
BEGIN
 IF NOT safeer.company_can(cid,'company.bookings.read') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM safeer.trips WHERE company_id=cid AND id=tid) THEN RETURN NULL; END IF;
 SELECT * INTO a FROM safeer.trip_assignments WHERE company_id=cid AND trip_id=tid AND replaced_at IS NULL;
 SELECT * INTO r FROM safeer.seat_layout_revisions WHERE company_id=cid AND layout_id=a.layout_id AND revision=a.layout_revision;
 RETURN jsonb_build_object('serverNow',clock_timestamp(),'canManage',safeer.company_can(cid,'company.bookings.manage'),'rows',r.row_count,'columns',r.column_count,
  'seats',COALESCE((SELECT jsonb_agg(jsonb_build_object('label',s.label,'row',s.row_number,'column',s.column_number,
    'reference',(SELECT b.reference FROM safeer.seat_allocations h JOIN safeer.bookings b ON (b.company_id,b.id)=(h.company_id,h.booking_id) WHERE h.company_id=cid AND h.trip_id=tid AND h.row_number=s.row_number AND h.column_number=s.column_number AND h.status='held' AND h.expires_at>clock_timestamp())) ORDER BY s.row_number,s.column_number)
   FROM safeer.seat_layout_seats s WHERE s.company_id=cid AND s.layout_id=a.layout_id AND s.revision=a.layout_revision),'[]'::jsonb),
  'bookingTotal',(SELECT count(*) FROM safeer.bookings b WHERE b.company_id=cid AND b.trip_id=tid),
  'bookings',COALESCE((SELECT jsonb_agg(x ORDER BY x->>'createdAt' DESC) FROM (SELECT safeer.staff_booking_row(b) AS x
   FROM safeer.bookings b WHERE b.company_id=cid AND b.trip_id=tid ORDER BY (b.status='held' AND b.expires_at>clock_timestamp()) DESC,b.created_at DESC LIMIT 200) y),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION safeer.passenger_data_guard(),safeer.booking_travelers(uuid,uuid),safeer.public_book(uuid,text[],uuid,text,text,text,text,jsonb),safeer.public_booking_by_key(text),safeer.mask_booking(jsonb),safeer.public_lookup(text,text),safeer.public_release_by_mobile(text,text),safeer.erase_due_passenger_data(),safeer.staff_booking_row(safeer.bookings),safeer.staff_bookings(uuid,text,text,text),safeer.staff_booking(uuid,uuid),safeer.staff_update_travelers(uuid,uuid,uuid,integer,text,jsonb,text) FROM PUBLIC;
