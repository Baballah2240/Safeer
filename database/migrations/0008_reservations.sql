-- Section 08. Existing company-role copies are deliberately not rewritten. No passenger details are stored yet (Section 09).
CREATE EXTENSION IF NOT EXISTS btree_gist;
INSERT INTO safeer.permissions(code,module) VALUES ('company.bookings.read','company'),('company.bookings.manage','company');
INSERT INTO safeer.role_permissions(role_id,permission_code)
 SELECT id,p FROM safeer.roles CROSS JOIN unnest(ARRAY['company.bookings.read','company.bookings.manage']) p
 WHERE code='company_administrator';
UPDATE safeer.roles SET version=version+1 WHERE code='company_administrator';
CREATE TABLE safeer.bookings (
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES safeer.companies(id),trip_id uuid NOT NULL,
 reference varchar(11) NOT NULL UNIQUE CHECK(reference ~ '^SF-[2-9A-HJ-NP-Z]{8}$'),
 access_hash char(64) NOT NULL UNIQUE CHECK(access_hash ~ '^[0-9a-f]{64}$'),request_hash char(64) NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
 status varchar(10) NOT NULL DEFAULT 'held' CHECK(status IN ('held','expired','released')),
 hold_minutes integer NOT NULL CHECK(hold_minutes BETWEEN 5 AND 1440),expires_at timestamptz NOT NULL,
 seat_count integer NOT NULL CHECK(seat_count BETWEEN 1 AND 10),fare_minor integer NOT NULL CHECK(fare_minor>0),amount_minor integer NOT NULL,currency varchar(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),closed_at timestamptz,
 released_by_kind varchar(14) CHECK(released_by_kind IN ('passenger','staff','trip_canceled')),released_by uuid REFERENCES safeer.users(id),release_reason varchar(300),
 CHECK(amount_minor=fare_minor*seat_count),CHECK(expires_at>created_at),
 CHECK((status='held')=(closed_at IS NULL)),CHECK((status='released')=(released_by_kind IS NOT NULL)),
 CHECK((released_by_kind='staff')=(released_by IS NOT NULL AND release_reason IS NOT NULL)),
 UNIQUE(company_id,id),FOREIGN KEY(company_id,trip_id) REFERENCES safeer.trips(company_id,id)
);
CREATE INDEX bookings_trip ON safeer.bookings(company_id,trip_id,created_at);
CREATE INDEX bookings_due ON safeer.bookings(expires_at) WHERE status='held';
-- One table holds every claim on a seat. Each claim covers a range of stops, so a later section can sell non-overlapping parts of a journey.
CREATE TABLE safeer.seat_allocations (
 id uuid PRIMARY KEY,company_id uuid NOT NULL,trip_id uuid NOT NULL,booking_id uuid NOT NULL,
 layout_id uuid NOT NULL,layout_revision integer NOT NULL,row_number integer NOT NULL,column_number integer NOT NULL,label varchar(8) NOT NULL,
 segment int4range NOT NULL CHECK(NOT isempty(segment) AND lower(segment)>=0),status varchar(10) NOT NULL DEFAULT 'held' CHECK(status IN ('held','expired','released')),expires_at timestamptz NOT NULL,
 UNIQUE(company_id,booking_id,row_number,column_number),
 FOREIGN KEY(company_id,booking_id) REFERENCES safeer.bookings(company_id,id),
 FOREIGN KEY(company_id,trip_id) REFERENCES safeer.trips(company_id,id),
 FOREIGN KEY(company_id,layout_id,layout_revision,row_number,column_number) REFERENCES safeer.seat_layout_seats(company_id,layout_id,revision,row_number,column_number),
 EXCLUDE USING gist(company_id WITH =,trip_id WITH =,row_number WITH =,column_number WITH =,segment WITH &&) WHERE (status='held')
);
CREATE INDEX seat_allocations_booking ON safeer.seat_allocations(company_id,booking_id);
CREATE TABLE safeer.booking_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,booking_id uuid NOT NULL,event varchar(10) NOT NULL CHECK(event IN ('held','expired','released')),
 actor_kind varchar(14) NOT NULL CHECK(actor_kind IN ('passenger','staff','trip_canceled','system')),actor_id uuid REFERENCES safeer.users(id),reason varchar(300),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(company_id,booking_id) REFERENCES safeer.bookings(company_id,id)
);
CREATE INDEX booking_events_booking ON safeer.booking_events(company_id,booking_id,created_at);
-- History only moves forward: a hold can be closed once, and nothing else about it ever changes.
CREATE FUNCTION safeer.booking_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Immutable booking history' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='booking_events' THEN RAISE EXCEPTION 'Immutable booking history' USING ERRCODE='42501'; END IF;
 IF OLD.status<>'held' OR (to_jsonb(NEW)-ARRAY['status','closed_at','released_by_kind','released_by','release_reason']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','closed_at','released_by_kind','released_by','release_reason']) THEN RAISE EXCEPTION 'Immutable booking history' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER booking_guard BEFORE UPDATE OR DELETE ON safeer.bookings FOR EACH ROW EXECUTE FUNCTION safeer.booking_guard();
CREATE TRIGGER booking_guard BEFORE UPDATE OR DELETE ON safeer.booking_events FOR EACH ROW EXECUTE FUNCTION safeer.booking_guard();
CREATE FUNCTION safeer.allocation_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.status<>'held' OR (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN RAISE EXCEPTION 'Immutable booking history' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER allocation_guard BEFORE UPDATE OR DELETE ON safeer.seat_allocations FOR EACH ROW EXECUTE FUNCTION safeer.allocation_guard();
ALTER TABLE safeer.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE safeer.seat_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE safeer.booking_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON safeer.bookings,safeer.seat_allocations,safeer.booking_events FROM PUBLIC;
-- Callers must already hold the trip's row lock. Every path that closes or creates a hold takes it first.
CREATE FUNCTION safeer.close_booking(cid uuid,bid uuid,next_status text,kind text,actor uuid,why text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 UPDATE safeer.bookings SET status=next_status,closed_at=clock_timestamp(),released_by_kind=CASE WHEN next_status='released' THEN kind END,released_by=actor,release_reason=why WHERE company_id=cid AND id=bid AND status='held';
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE safeer.seat_allocations SET status=next_status WHERE company_id=cid AND booking_id=bid AND status='held';
 INSERT INTO safeer.booking_events(company_id,booking_id,event,actor_kind,actor_id,reason) VALUES(cid,bid,next_status,kind,actor,why);
END $$;
CREATE FUNCTION safeer.expire_trip_holds(cid uuid,tid uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b uuid; n integer:=0;
BEGIN
 FOR b IN SELECT id FROM safeer.bookings WHERE company_id=cid AND trip_id=tid AND status='held' AND expires_at<=clock_timestamp() ORDER BY id LOOP
  PERFORM safeer.close_booking(cid,b,'expired','system',NULL,NULL);n:=n+1;
 END LOOP;
 RETURN n;
END $$;
-- The background job only tidies up. Availability and new holds compare expires_at themselves, so a late job never extends a hold.
CREATE FUNCTION safeer.expire_due_holds() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r record; n integer:=0;
BEGIN
 FOR r IN SELECT t.company_id,t.id FROM safeer.trips t WHERE EXISTS(SELECT 1 FROM safeer.bookings b WHERE b.company_id=t.company_id AND b.trip_id=t.id AND b.status='held' AND b.expires_at<=clock_timestamp()) ORDER BY t.id LIMIT 200 FOR NO KEY UPDATE OF t SKIP LOCKED LOOP
  n:=n+safeer.expire_trip_holds(r.company_id,r.id);
 END LOOP;
 RETURN n;
END $$;
-- Canceling a trip releases its holds in the same transaction.
CREATE FUNCTION safeer.trip_cancel_holds() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b uuid;
BEGIN
 PERFORM safeer.expire_trip_holds(NEW.company_id,NEW.id);
 FOR b IN SELECT id FROM safeer.bookings WHERE company_id=NEW.company_id AND trip_id=NEW.id AND status='held' ORDER BY id LOOP
  PERFORM safeer.close_booking(NEW.company_id,b,'released','trip_canceled',NULL,NEW.cancel_reason);
 END LOOP;
 RETURN NULL;
END $$;
CREATE TRIGGER trip_cancel_holds AFTER UPDATE OF status ON safeer.trips FOR EACH ROW WHEN (NEW.status='canceled' AND OLD.status<>'canceled') EXECUTE FUNCTION safeer.trip_cancel_holds();
-- A held seat is never silently moved to another seat map. Fires after trip_assignment_guard has copied the layout.
CREATE FUNCTION safeer.trip_assignment_seats_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM 1 FROM safeer.trips WHERE company_id=NEW.company_id AND id=NEW.trip_id FOR NO KEY UPDATE;
 IF EXISTS(SELECT 1 FROM safeer.seat_allocations a WHERE a.company_id=NEW.company_id AND a.trip_id=NEW.trip_id AND a.status='held' AND a.expires_at>clock_timestamp() AND (a.layout_id,a.layout_revision)<>(NEW.layout_id,NEW.layout_revision))
 THEN RAISE EXCEPTION 'SEATS_HELD' USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trip_assignment_seats_guard BEFORE INSERT ON safeer.trip_assignments FOR EACH ROW EXECUTE FUNCTION safeer.trip_assignment_seats_guard();
-- Public projections. The trip row is shared by search and the seat page so their rules cannot drift apart.
CREATE FUNCTION safeer.public_trip_rows(p_id uuid,p_from text,p_to text,p_date date,p_slug text) RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object(
  'id',t.id,'companySlug',co.slug,'companyNameEn',co.name_en,'companyNameAr',co.name_ar,
  'routeNameEn',t.route_name_en,'routeNameAr',t.route_name_ar,
  'fromCode',fc.code,'fromNameEn',fs.city_name_en,'fromNameAr',fs.city_name_ar,'toCode',tc.code,'toNameEn',ls.city_name_en,'toNameAr',ls.city_name_ar,
  'date',to_char(t.departure_at AT TIME ZONE t.timezone,'YYYY-MM-DD'),'time',to_char(t.departure_at AT TIME ZONE t.timezone,'HH24:MI'),
  'arrivalDate',to_char(t.arrival_at AT TIME ZONE t.timezone,'YYYY-MM-DD'),'arrivalTime',to_char(t.arrival_at AT TIME ZONE t.timezone,'HH24:MI'),
  'durationMinutes',ls.offset_minutes,'fareMinor',t.fare_minor,'currency',t.currency,
  'seatCount',a.seat_count,'busTypeEn',l.name_en,'busTypeAr',l.name_ar,
  'seatsLeft',a.seat_count-(SELECT count(DISTINCT (s.row_number,s.column_number)) FROM safeer.seat_allocations s WHERE s.company_id=t.company_id AND s.trip_id=t.id AND s.status='held' AND s.expires_at>clock_timestamp()),
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
CREATE OR REPLACE FUNCTION safeer.public_trips(p_from text,p_to text,p_date date,p_slug text) RETURNS SETOF jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT safeer.public_trip_rows(NULL,p_from,p_to,p_date,p_slug)
$$;
-- Seats say only whether they are free. Who holds a seat, and why, is never public.
CREATE FUNCTION safeer.public_trip(tid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT x.doc||jsonb_build_object('holdMinutes',st.hold_minutes,'rows',r.row_count,'columns',r.column_count,
  'seats',(SELECT jsonb_agg(jsonb_build_object('label',s.label,'row',s.row_number,'column',s.column_number,'available',NOT EXISTS(SELECT 1 FROM safeer.seat_allocations h WHERE h.company_id=s.company_id AND h.trip_id=tid AND h.row_number=s.row_number AND h.column_number=s.column_number AND h.status='held' AND h.expires_at>clock_timestamp())) ORDER BY s.row_number,s.column_number) FROM safeer.seat_layout_seats s WHERE s.company_id=a.company_id AND s.layout_id=a.layout_id AND s.revision=a.layout_revision))
 FROM safeer.public_trip_rows(tid,NULL,NULL,NULL,NULL) x(doc)
 JOIN safeer.trip_assignments a ON a.trip_id=tid AND a.replaced_at IS NULL
 JOIN safeer.company_settings st ON st.company_id=a.company_id
 JOIN safeer.seat_layout_revisions r ON r.company_id=a.company_id AND r.layout_id=a.layout_id AND r.revision=a.layout_revision
$$;
-- A hold reads as expired the moment its time passes, even if the background job has not run yet.
CREATE FUNCTION safeer.booking_view(b safeer.bookings) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('reference',b.reference,'status',CASE WHEN b.status='held' AND b.expires_at<=clock_timestamp() THEN 'expired' ELSE b.status END,
  'releasedBy',b.released_by_kind,'expiresAt',b.expires_at,'serverNow',clock_timestamp(),'createdAt',b.created_at,
  'holdMinutes',b.hold_minutes,'seatCount',b.seat_count,'fareMinor',b.fare_minor,'amountMinor',b.amount_minor,'currency',b.currency,
  'seats',(SELECT jsonb_agg(a.label ORDER BY a.row_number,a.column_number) FROM safeer.seat_allocations a WHERE a.company_id=b.company_id AND a.booking_id=b.id),
  'tripId',t.id,'routeNameEn',t.route_name_en,'routeNameAr',t.route_name_ar,
  'date',to_char(t.departure_at AT TIME ZONE t.timezone,'YYYY-MM-DD'),'time',to_char(t.departure_at AT TIME ZONE t.timezone,'HH24:MI'),
  'tripOpen',t.status='published' AND t.departure_at>clock_timestamp(),'companySlug',co.slug,'companyNameEn',co.name_en,'companyNameAr',co.name_ar,
  'phone',CASE WHEN visible THEN p.public_phone END,'email',CASE WHEN visible THEN p.public_email END,'address',CASE WHEN visible THEN p.public_address END)
 FROM safeer.trips t JOIN safeer.companies co ON co.id=t.company_id LEFT JOIN safeer.company_public_profiles p ON p.company_id=t.company_id
 -- A company that has hidden itself or lost approval no longer shows contact details, even to someone holding an old key.
 CROSS JOIN LATERAL (SELECT co.status='approved' AND COALESCE(p.listed,false) AS visible) v
 WHERE t.company_id=b.company_id AND t.id=b.trip_id
$$;
-- All requested seats are held or none are. The trip row lock serializes claims, and the exclusion constraint is the final guarantee.
CREATE FUNCTION safeer.public_hold(tid uuid,labels text[],p_id uuid,p_reference text,p_access text,p_request text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b safeer.bookings%ROWTYPE; t safeer.trips%ROWTYPE; a safeer.trip_assignments%ROWTYPE; minutes integer; wanted integer:=cardinality(labels); until timestamptz;
BEGIN
 SELECT * INTO b FROM safeer.bookings WHERE access_hash=p_access;
 IF FOUND THEN
  IF b.request_hash<>p_request THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001'; END IF;
  RETURN safeer.booking_view(b);
 END IF;
 SELECT x.* INTO t FROM safeer.trips x JOIN safeer.companies co ON co.id=x.company_id AND co.status='approved' JOIN safeer.company_public_profiles p ON p.company_id=x.company_id AND p.listed WHERE x.id=tid FOR NO KEY UPDATE OF x;
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
 IF EXISTS(SELECT 1 FROM safeer.seat_layout_seats s JOIN safeer.seat_allocations h ON h.company_id=s.company_id AND h.trip_id=t.id AND h.row_number=s.row_number AND h.column_number=s.column_number AND h.status='held'
  WHERE s.company_id=a.company_id AND s.layout_id=a.layout_id AND s.revision=a.layout_revision AND s.label=ANY(labels))
 THEN RAISE EXCEPTION 'SEATS_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
 SELECT hold_minutes INTO minutes FROM safeer.company_settings WHERE company_id=t.company_id;
 until:=least(clock_timestamp()+make_interval(mins=>minutes),t.departure_at);
 INSERT INTO safeer.bookings(id,company_id,trip_id,reference,access_hash,request_hash,hold_minutes,expires_at,seat_count,fare_minor,amount_minor,currency)
  VALUES(p_id,t.company_id,t.id,p_reference,p_access,p_request,minutes,until,wanted,t.fare_minor,t.fare_minor*wanted,t.currency) RETURNING * INTO b;
 INSERT INTO safeer.seat_allocations(id,company_id,trip_id,booking_id,layout_id,layout_revision,row_number,column_number,label,segment,expires_at)
  SELECT gen_random_uuid(),t.company_id,t.id,b.id,s.layout_id,s.revision,s.row_number,s.column_number,s.label,int4range(0,t.stop_count-1),until
  FROM safeer.seat_layout_seats s WHERE s.company_id=a.company_id AND s.layout_id=a.layout_id AND s.revision=a.layout_revision AND s.label=ANY(labels) ORDER BY s.row_number,s.column_number;
 INSERT INTO safeer.booking_events(company_id,booking_id,event,actor_kind) VALUES(b.company_id,b.id,'held','passenger');
 RETURN safeer.booking_view(b);
END $$;
CREATE FUNCTION safeer.public_booking(p_reference text,p_access text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT safeer.booking_view(b) FROM safeer.bookings b WHERE b.reference=p_reference AND b.access_hash=p_access
$$;
CREATE FUNCTION safeer.public_release(p_reference text,p_access text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b safeer.bookings%ROWTYPE;
BEGIN
 SELECT * INTO b FROM safeer.bookings WHERE reference=p_reference AND access_hash=p_access;
 IF NOT FOUND THEN RETURN NULL; END IF;
 PERFORM 1 FROM safeer.trips WHERE company_id=b.company_id AND id=b.trip_id FOR NO KEY UPDATE;
 PERFORM safeer.expire_trip_holds(b.company_id,b.trip_id);
 PERFORM safeer.close_booking(b.company_id,b.id,'released','passenger',NULL,NULL);
 SELECT * INTO b FROM safeer.bookings WHERE id=b.id;
 RETURN safeer.booking_view(b);
END $$;
-- Staff reads and releases check the caller's company permission here, because the runtime role has no access to these tables.
CREATE FUNCTION safeer.staff_seat_map(cid uuid,tid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
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
  'bookings',COALESCE((SELECT jsonb_agg(x ORDER BY x->>'createdAt' DESC) FROM (SELECT jsonb_build_object('id',b.id,'reference',b.reference,'status',CASE WHEN b.status='held' AND b.expires_at<=clock_timestamp() THEN 'expired' ELSE b.status END,'releasedBy',b.released_by_kind,'releaseReason',b.release_reason,'createdAt',b.created_at,'expiresAt',b.expires_at,'closedAt',b.closed_at,'amountMinor',b.amount_minor,'currency',b.currency,
    'seats',(SELECT jsonb_agg(h.label ORDER BY h.row_number,h.column_number) FROM safeer.seat_allocations h WHERE h.company_id=b.company_id AND h.booking_id=b.id)) AS x
   FROM safeer.bookings b WHERE b.company_id=cid AND b.trip_id=tid ORDER BY (b.status='held' AND b.expires_at>clock_timestamp()) DESC,b.created_at DESC LIMIT 200) y),'[]'::jsonb));
END $$;
CREATE FUNCTION safeer.staff_release(cid uuid,tid uuid,bid uuid,actor uuid,why text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT safeer.company_can(cid,'company.bookings.manage') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM safeer.bookings WHERE company_id=cid AND trip_id=tid AND id=bid) THEN RETURN false; END IF;
 PERFORM 1 FROM safeer.trips WHERE company_id=cid AND id=tid FOR NO KEY UPDATE;
 PERFORM safeer.expire_trip_holds(cid,tid);
 IF NOT EXISTS(SELECT 1 FROM safeer.bookings WHERE company_id=cid AND id=bid AND status='held') THEN RAISE EXCEPTION 'HOLD_CLOSED' USING ERRCODE='P0001'; END IF;
 PERFORM safeer.close_booking(cid,bid,'released','staff',actor,why);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION safeer.booking_guard(),safeer.allocation_guard(),safeer.close_booking(uuid,uuid,text,text,uuid,text),safeer.expire_trip_holds(uuid,uuid),safeer.expire_due_holds(),safeer.trip_cancel_holds(),safeer.trip_assignment_seats_guard(),safeer.public_trip_rows(uuid,text,text,date,text),safeer.public_trip(uuid),safeer.booking_view(safeer.bookings),safeer.public_hold(uuid,text[],uuid,text,text,text),safeer.public_booking(text,text),safeer.public_release(text,text),safeer.staff_seat_map(uuid,uuid),safeer.staff_release(uuid,uuid,uuid,uuid,text) FROM PUBLIC;
