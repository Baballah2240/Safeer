-- D90: each trip sets how long a booked seat stays reserved for payment, in whole hours (1, 2 or 3). Three hours
-- is the most any hold lasts: trips without their own setting use the company default, capped at three hours.
ALTER TABLE safeer.trips ADD COLUMN hold_minutes integer CHECK(hold_minutes IN (60,120,180));
UPDATE safeer.company_settings SET hold_minutes=180 WHERE hold_minutes>180;
ALTER TABLE safeer.company_settings DROP CONSTRAINT IF EXISTS company_settings_hold_minutes_check;
ALTER TABLE safeer.company_settings ADD CONSTRAINT company_settings_hold_minutes_check CHECK(hold_minutes BETWEEN 5 AND 180);

CREATE FUNCTION safeer.trip_hold_minutes(t safeer.trips) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT least(coalesce(t.hold_minutes,(SELECT s.hold_minutes FROM safeer.company_settings s WHERE s.company_id=t.company_id),30),180)
$$;
REVOKE ALL ON FUNCTION safeer.trip_hold_minutes(safeer.trips) FROM PUBLIC;

CREATE OR REPLACE FUNCTION safeer.hold_seats(tid uuid,labels text[],p_id uuid,p_reference text,p_access text,p_request text,require_listed boolean,p_actor uuid,p_from integer,p_to integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b safeer.bookings%ROWTYPE; t safeer.trips%ROWTYPE; a safeer.trip_assignments%ROWTYPE; minutes integer; wanted integer:=cardinality(labels); until timestamptz; f integer; l integer; fare integer; starts timestamptz;
BEGIN
 SELECT * INTO b FROM safeer.bookings WHERE access_hash=p_access;
 IF FOUND THEN
  IF b.request_hash<>p_request THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001'; END IF;
  RETURN safeer.booking_view(b);
 END IF;
 SELECT x.* INTO t FROM safeer.trips x JOIN safeer.companies co ON co.id=x.company_id AND co.status='approved' LEFT JOIN safeer.company_public_profiles p ON p.company_id=x.company_id WHERE x.id=tid AND (NOT require_listed OR COALESCE(p.listed,false)) FOR NO KEY UPDATE OF x;
 IF NOT FOUND THEN RAISE EXCEPTION 'TRIP_NOT_BOOKABLE' USING ERRCODE='P0001'; END IF;
 SELECT * INTO b FROM safeer.bookings WHERE access_hash=p_access;
 IF FOUND THEN
  IF b.request_hash<>p_request THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001'; END IF;
  RETURN safeer.booking_view(b);
 END IF;
 f:=coalesce(p_from,0);l:=coalesce(p_to,t.stop_count-1);
 IF f<0 OR l>t.stop_count-1 OR f>=l THEN RAISE EXCEPTION 'INVALID_SEGMENT' USING ERRCODE='P0001'; END IF;
 -- A passenger can board until the bus leaves their stop.
 SELECT t.departure_at+make_interval(mins=>s.offset_minutes) INTO starts FROM safeer.trip_stops s WHERE s.company_id=t.company_id AND s.trip_id=t.id AND s.stop_index=f;
 IF t.status<>'published' OR t.departure_at<=clock_timestamp() THEN RAISE EXCEPTION 'TRIP_NOT_BOOKABLE' USING ERRCODE='P0001'; END IF;
 fare:=safeer.segment_fare(t,f,l);
 IF fare IS NULL AND f=0 AND l=t.stop_count-1 THEN RAISE EXCEPTION 'TRIP_NOT_BOOKABLE' USING ERRCODE='P0001'; END IF;
 IF fare IS NULL THEN RAISE EXCEPTION 'SEGMENT_NOT_PRICED' USING ERRCODE='P0001'; END IF;
 PERFORM safeer.expire_trip_holds(t.company_id,t.id);
 SELECT * INTO a FROM safeer.trip_assignments WHERE company_id=t.company_id AND trip_id=t.id AND replaced_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'TRIP_NOT_BOOKABLE' USING ERRCODE='P0001'; END IF;
 IF wanted NOT BETWEEN 1 AND 10 OR (SELECT count(DISTINCT v) FROM unnest(labels) v)<>wanted
  OR (SELECT count(*) FROM safeer.seat_layout_seats s WHERE s.company_id=a.company_id AND s.layout_id=a.layout_id AND s.revision=a.layout_revision AND s.label=ANY(labels))<>wanted
 THEN RAISE EXCEPTION 'INVALID_SEATS' USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM safeer.seat_layout_seats s JOIN safeer.seat_allocations h ON h.company_id=s.company_id AND h.trip_id=t.id AND h.row_number=s.row_number AND h.column_number=s.column_number AND h.status IN ('held','confirmed') AND h.segment && int4range(f,l)
  WHERE s.company_id=a.company_id AND s.layout_id=a.layout_id AND s.revision=a.layout_revision AND s.label=ANY(labels))
 THEN RAISE EXCEPTION 'SEATS_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
 minutes:=safeer.trip_hold_minutes(t);
 until:=least(clock_timestamp()+make_interval(mins=>minutes),t.departure_at);
 INSERT INTO safeer.bookings(id,company_id,trip_id,reference,access_hash,request_hash,hold_minutes,expires_at,seat_count,fare_minor,amount_minor,currency)
  VALUES(p_id,t.company_id,t.id,p_reference,p_access,p_request,minutes,until,wanted,fare,fare*wanted,t.currency) RETURNING * INTO b;
 INSERT INTO safeer.seat_allocations(id,company_id,trip_id,booking_id,layout_id,layout_revision,row_number,column_number,label,segment,expires_at)
  SELECT gen_random_uuid(),t.company_id,t.id,b.id,s.layout_id,s.revision,s.row_number,s.column_number,s.label,int4range(f,l),until
  FROM safeer.seat_layout_seats s WHERE s.company_id=a.company_id AND s.layout_id=a.layout_id AND s.revision=a.layout_revision AND s.label=ANY(labels) ORDER BY s.row_number,s.column_number;
 INSERT INTO safeer.booking_events(company_id,booking_id,event,actor_kind,actor_id) VALUES(b.company_id,b.id,'held',CASE WHEN p_actor IS NULL THEN 'passenger' ELSE 'staff' END,p_actor);
 RETURN safeer.booking_view(b);
END $$;

CREATE OR REPLACE FUNCTION safeer.public_trip(tid uuid,f integer,l integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t safeer.trips%ROWTYPE; a safeer.trip_assignments%ROWTYPE; r safeer.seat_layout_revisions%ROWTYPE; minutes integer;
BEGIN
 SELECT x.* INTO t FROM safeer.trips x JOIN safeer.companies co ON co.id=x.company_id AND co.status='approved' JOIN safeer.company_public_profiles p ON p.company_id=x.company_id AND p.listed
  WHERE x.id=tid AND x.status='published' AND x.departure_at>clock_timestamp();
 IF NOT FOUND THEN RETURN NULL; END IF;
 f:=coalesce(f,0);l:=coalesce(l,t.stop_count-1);
 IF safeer.segment_fare(t,f,l) IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO a FROM safeer.trip_assignments WHERE company_id=t.company_id AND trip_id=tid AND replaced_at IS NULL;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO r FROM safeer.seat_layout_revisions WHERE company_id=a.company_id AND layout_id=a.layout_id AND revision=a.layout_revision;
 minutes:=safeer.trip_hold_minutes(t);
 RETURN safeer.trip_doc(t,f,l)||jsonb_build_object('holdMinutes',minutes,'rows',r.row_count,'columns',r.column_count,
  'seats',(SELECT jsonb_agg(jsonb_build_object('label',s.label,'row',s.row_number,'column',s.column_number,'available',NOT safeer.seat_taken(t.company_id,tid,s.row_number,s.column_number,int4range(f,l))) ORDER BY s.row_number,s.column_number)
   FROM safeer.seat_layout_seats s WHERE s.company_id=a.company_id AND s.layout_id=a.layout_id AND s.revision=a.layout_revision),
  'fares',(SELECT coalesce(jsonb_agg(jsonb_build_object('from',i,'to',j,'fareMinor',safeer.segment_fare(t,i,j)) ORDER BY i,j),'[]'::jsonb) FROM generate_series(0,t.stop_count-2) i CROSS JOIN generate_series(1,t.stop_count-1) j WHERE i<j AND safeer.segment_fare(t,i,j) IS NOT NULL));
END $$;
