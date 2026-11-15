-- D89: stop-to-stop journeys. A passenger books from any stop to any later stop of a trip. Seat allocations
-- already store the stretch as stop-index ranges [from,to) and refuse overlaps (D11, 0010), so a seat freed at a
-- middle stop is sold again for the rest of the trip. Prices come from a price list on the route (one price per
-- pair of stops); the whole trip keeps the trip's own fare. A stretch without a price is not sold.
CREATE TABLE safeer.route_fares (
 company_id uuid NOT NULL,route_id uuid NOT NULL,
 from_index integer NOT NULL CHECK(from_index BETWEEN 0 AND 28),to_index integer NOT NULL CHECK(to_index BETWEEN 1 AND 29),
 fare_minor integer NOT NULL CHECK(fare_minor BETWEEN 1 AND 100000000),
 PRIMARY KEY(company_id,route_id,from_index,to_index),CHECK(from_index<to_index),
 FOREIGN KEY(company_id,route_id) REFERENCES safeer.routes(company_id,id)
);
ALTER TABLE safeer.route_fares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON safeer.route_fares FROM PUBLIC;
CREATE POLICY fare_read ON safeer.route_fares FOR SELECT USING(safeer.company_can(company_id,'company.routes.read'));
CREATE POLICY fare_insert ON safeer.route_fares FOR INSERT WITH CHECK(safeer.route_manage(company_id));
CREATE POLICY fare_delete ON safeer.route_fares FOR DELETE USING(safeer.route_manage(company_id));

-- The price of a journey from stop f to stop l. The trip keeps snapshots of its stops; a route price only applies
-- while the trip's stops still match the route's, so an edited route never prices an old trip wrongly.
CREATE FUNCTION safeer.segment_fare(t safeer.trips,f integer,l integer) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN f IS NULL OR l IS NULL OR f<0 OR l>t.stop_count-1 OR f>=l THEN NULL
  WHEN f=0 AND l=t.stop_count-1 THEN nullif(t.fare_minor,0)
  ELSE (SELECT rf.fare_minor FROM safeer.route_fares rf
   WHERE rf.company_id=t.company_id AND rf.route_id=t.route_id AND rf.from_index=f AND rf.to_index=l
    AND (SELECT count(*) FROM safeer.route_stops r WHERE r.company_id=t.company_id AND r.route_id=t.route_id)=t.stop_count
    AND NOT EXISTS(SELECT 1 FROM safeer.trip_stops s LEFT JOIN safeer.route_stops r ON r.company_id=s.company_id AND r.route_id=t.route_id AND r.stop_index=s.stop_index
     WHERE s.company_id=t.company_id AND s.trip_id=t.id AND (r.city_id IS DISTINCT FROM s.city_id OR r.station_id IS DISTINCT FROM s.station_id))) END
$$;

-- Whether a seat is taken anywhere on a stretch (live holds and sold seats).
CREATE FUNCTION safeer.seat_taken(cid uuid,tid uuid,r integer,c integer,seg int4range) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM safeer.seat_allocations h WHERE h.company_id=cid AND h.trip_id=tid AND h.row_number=r AND h.column_number=c AND h.segment && seg
  AND (h.status='confirmed' OR (h.status='held' AND h.expires_at>clock_timestamp())))
$$;

-- The stretch a booking covers (every seat of a booking covers the same stretch).
CREATE FUNCTION safeer.booking_segment(cid uuid,bid uuid) RETURNS int4range LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT int4range(min(lower(a.segment)),max(upper(a.segment))) FROM safeer.seat_allocations a WHERE a.company_id=cid AND a.booking_id=bid
$$;

-- Holds for a stretch. The original signature books the whole trip.
CREATE FUNCTION safeer.hold_seats(tid uuid,labels text[],p_id uuid,p_reference text,p_access text,p_request text,require_listed boolean,p_actor uuid,p_from integer,p_to integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
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
 SELECT hold_minutes INTO minutes FROM safeer.company_settings WHERE company_id=t.company_id;
 until:=least(clock_timestamp()+make_interval(mins=>minutes),t.departure_at);
 INSERT INTO safeer.bookings(id,company_id,trip_id,reference,access_hash,request_hash,hold_minutes,expires_at,seat_count,fare_minor,amount_minor,currency)
  VALUES(p_id,t.company_id,t.id,p_reference,p_access,p_request,minutes,until,wanted,fare,fare*wanted,t.currency) RETURNING * INTO b;
 INSERT INTO safeer.seat_allocations(id,company_id,trip_id,booking_id,layout_id,layout_revision,row_number,column_number,label,segment,expires_at)
  SELECT gen_random_uuid(),t.company_id,t.id,b.id,s.layout_id,s.revision,s.row_number,s.column_number,s.label,int4range(f,l),until
  FROM safeer.seat_layout_seats s WHERE s.company_id=a.company_id AND s.layout_id=a.layout_id AND s.revision=a.layout_revision AND s.label=ANY(labels) ORDER BY s.row_number,s.column_number;
 INSERT INTO safeer.booking_events(company_id,booking_id,event,actor_kind,actor_id) VALUES(b.company_id,b.id,'held',CASE WHEN p_actor IS NULL THEN 'passenger' ELSE 'staff' END,p_actor);
 RETURN safeer.booking_view(b);
END $$;
CREATE OR REPLACE FUNCTION safeer.hold_seats(tid uuid,labels text[],p_id uuid,p_reference text,p_access text,p_request text,require_listed boolean,p_actor uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT safeer.hold_seats(tid,labels,p_id,p_reference,p_access,p_request,require_listed,p_actor,NULL::integer,NULL::integer)
$$;

CREATE FUNCTION safeer.public_book(tid uuid,labels text[],p_id uuid,p_reference text,p_access text,p_request text,p_mobile text,p_travelers jsonb,p_from integer,p_to integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b safeer.bookings%ROWTYPE; n integer;
BEGIN
 PERFORM safeer.hold_seats(tid,labels,p_id,p_reference,p_access,p_request,true,NULL,p_from,p_to);
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

CREATE FUNCTION safeer.counter_sale(cid uuid,actor uuid,tid uuid,labels text[],p_id uuid,p_reference text,p_access text,p_request text,p_mobile text,p_travelers jsonb,p_method text,p_method_reference text,p_key text,p_from integer,p_to integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b safeer.bookings%ROWTYPE; n integer;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM safeer.cash_sessions WHERE company_id=cid AND opened_by=actor AND closed_at IS NULL) AND NOT EXISTS(SELECT 1 FROM safeer.payments WHERE company_id=cid AND key_hash=p_key) THEN
  IF NOT safeer.company_has(cid,'company.ticketing.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
  RAISE EXCEPTION 'NO_OPEN_SESSION' USING ERRCODE='P0001';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM safeer.trips WHERE company_id=cid AND id=tid) THEN RAISE EXCEPTION 'TRIP_NOT_BOOKABLE' USING ERRCODE='P0001'; END IF;
 PERFORM safeer.hold_seats(tid,labels,p_id,p_reference,p_access,p_request,false,actor,p_from,p_to);
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

-- One trip as seen by a passenger travelling from stop f to stop l: times, names and price for that journey.
CREATE FUNCTION safeer.trip_doc(t safeer.trips,f integer,l integer) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object(
  'id',t.id,'companySlug',co.slug,'companyNameEn',co.name_en,'companyNameAr',co.name_ar,
  'routeNameEn',t.route_name_en,'routeNameAr',t.route_name_ar,'fromIndex',f,'toIndex',l,'partial',NOT(f=0 AND l=t.stop_count-1),
  'fromCode',fc.code,'fromNameEn',fs.city_name_en,'fromNameAr',fs.city_name_ar,'toCode',tc.code,'toNameEn',ls.city_name_en,'toNameAr',ls.city_name_ar,
  'fromStationEn',fs.station_name_en,'fromStationAr',fs.station_name_ar,'toStationEn',ls.station_name_en,'toStationAr',ls.station_name_ar,
  'date',to_char((t.departure_at+make_interval(mins=>fs.offset_minutes)) AT TIME ZONE t.timezone,'YYYY-MM-DD'),'time',to_char((t.departure_at+make_interval(mins=>fs.offset_minutes)) AT TIME ZONE t.timezone,'HH24:MI'),
  'arrivalDate',to_char((t.departure_at+make_interval(mins=>ls.offset_minutes)) AT TIME ZONE t.timezone,'YYYY-MM-DD'),'arrivalTime',to_char((t.departure_at+make_interval(mins=>ls.offset_minutes)) AT TIME ZONE t.timezone,'HH24:MI'),
  'durationMinutes',ls.offset_minutes-fs.offset_minutes,'fareMinor',safeer.segment_fare(t,f,l),'currency',t.currency,
  'seatCount',a.seat_count,'busTypeEn',lay.name_en,'busTypeAr',lay.name_ar,
  'seatsLeft',a.seat_count-(SELECT count(DISTINCT (s.row_number,s.column_number)) FROM safeer.seat_allocations s WHERE s.company_id=t.company_id AND s.trip_id=t.id AND s.segment && int4range(f,l) AND (s.status='confirmed' OR (s.status='held' AND s.expires_at>clock_timestamp()))),
  'stops',(SELECT jsonb_agg(jsonb_build_object('index',s.stop_index,'code',c.code,'cityNameEn',s.city_name_en,'cityNameAr',s.city_name_ar,'stationNameEn',s.station_name_en,'stationNameAr',s.station_name_ar,'offsetMinutes',s.offset_minutes) ORDER BY s.stop_index) FROM safeer.trip_stops s JOIN safeer.cities c ON c.id=s.city_id WHERE s.company_id=t.company_id AND s.trip_id=t.id))
 FROM safeer.companies co
 JOIN safeer.trip_assignments a ON a.company_id=t.company_id AND a.trip_id=t.id AND a.replaced_at IS NULL
 JOIN safeer.seat_layouts lay ON lay.company_id=a.company_id AND lay.id=a.layout_id
 JOIN safeer.trip_stops fs ON fs.company_id=t.company_id AND fs.trip_id=t.id AND fs.stop_index=f
 JOIN safeer.trip_stops ls ON ls.company_id=t.company_id AND ls.trip_id=t.id AND ls.stop_index=l
 JOIN safeer.cities fc ON fc.id=fs.city_id
 JOIN safeer.cities tc ON tc.id=ls.city_id
 WHERE co.id=t.company_id
$$;

-- Search: a trip matches when it stops at the origin and later at the destination, and that journey has a price.
CREATE OR REPLACE FUNCTION safeer.public_trip_rows(p_id uuid,p_from text,p_to text,p_date date,p_slug text) RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT safeer.trip_doc(t,x.f,y.l)
 FROM safeer.trips t
 JOIN safeer.companies co ON co.id=t.company_id AND co.status='approved'
 JOIN safeer.company_public_profiles p ON p.company_id=t.company_id AND p.listed
 JOIN safeer.trip_assignments a ON a.company_id=t.company_id AND a.trip_id=t.id AND a.replaced_at IS NULL
 CROSS JOIN LATERAL (SELECT CASE WHEN p_from IS NULL THEN 0 ELSE (SELECT min(s.stop_index) FROM safeer.trip_stops s JOIN safeer.cities c ON c.id=s.city_id WHERE s.company_id=t.company_id AND s.trip_id=t.id AND c.code=p_from AND s.stop_index<t.stop_count-1) END AS f) x
 CROSS JOIN LATERAL (SELECT CASE WHEN p_to IS NULL THEN t.stop_count-1 ELSE (SELECT min(s.stop_index) FROM safeer.trip_stops s JOIN safeer.cities c ON c.id=s.city_id WHERE s.company_id=t.company_id AND s.trip_id=t.id AND c.code=p_to AND s.stop_index>x.f) END AS l) y
 JOIN safeer.trip_stops board ON board.company_id=t.company_id AND board.trip_id=t.id AND board.stop_index=x.f
 WHERE t.status='published' AND t.departure_at>clock_timestamp() AND (p_id IS NULL OR t.id=p_id) AND (p_slug IS NULL OR co.slug=p_slug)
  AND x.f IS NOT NULL AND y.l IS NOT NULL AND safeer.segment_fare(t,x.f,y.l) IS NOT NULL
  AND (p_date IS NULL OR ((t.departure_at+make_interval(mins=>board.offset_minutes)) AT TIME ZONE t.timezone)::date=p_date)
 ORDER BY t.departure_at+make_interval(mins=>board.offset_minutes),t.id LIMIT 100
$$;

-- A trip page for one journey, with each seat's availability on that stretch.
CREATE FUNCTION safeer.public_trip(tid uuid,f integer,l integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
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
 SELECT hold_minutes INTO minutes FROM safeer.company_settings WHERE company_id=t.company_id;
 RETURN safeer.trip_doc(t,f,l)||jsonb_build_object('holdMinutes',minutes,'rows',r.row_count,'columns',r.column_count,
  'seats',(SELECT jsonb_agg(jsonb_build_object('label',s.label,'row',s.row_number,'column',s.column_number,'available',NOT safeer.seat_taken(t.company_id,tid,s.row_number,s.column_number,int4range(f,l))) ORDER BY s.row_number,s.column_number)
   FROM safeer.seat_layout_seats s WHERE s.company_id=a.company_id AND s.layout_id=a.layout_id AND s.revision=a.layout_revision),
  'fares',(SELECT coalesce(jsonb_agg(jsonb_build_object('from',i,'to',j,'fareMinor',safeer.segment_fare(t,i,j)) ORDER BY i,j),'[]'::jsonb) FROM generate_series(0,t.stop_count-2) i CROSS JOIN generate_series(1,t.stop_count-1) j WHERE i<j AND safeer.segment_fare(t,i,j) IS NOT NULL));
END $$;

-- The station counter for one journey on a trip.
CREATE FUNCTION safeer.counter_trip(cid uuid,tid uuid,f integer,l integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a safeer.trip_assignments%ROWTYPE; r safeer.seat_layout_revisions%ROWTYPE; t safeer.trips%ROWTYPE;
BEGIN
 IF NOT safeer.company_has(cid,'company.ticketing.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO t FROM safeer.trips WHERE company_id=cid AND id=tid AND status='published' AND departure_at>clock_timestamp();
 IF NOT FOUND THEN RETURN NULL; END IF;
 f:=coalesce(f,0);l:=coalesce(l,t.stop_count-1);
 IF f<0 OR l>t.stop_count-1 OR f>=l THEN RAISE EXCEPTION 'INVALID_SEGMENT' USING ERRCODE='P0001'; END IF;
 SELECT * INTO a FROM safeer.trip_assignments WHERE company_id=cid AND trip_id=tid AND replaced_at IS NULL;
 SELECT * INTO r FROM safeer.seat_layout_revisions WHERE company_id=cid AND layout_id=a.layout_id AND revision=a.layout_revision;
 RETURN jsonb_build_object('id',t.id,'fareMinor',safeer.segment_fare(t,f,l),'currency',t.currency,'rows',r.row_count,'columns',r.column_count,'fromIndex',f,'toIndex',l,
  'stops',(SELECT jsonb_agg(jsonb_build_object('index',s.stop_index,'nameEn',coalesce(s.station_name_en,s.city_name_en),'nameAr',coalesce(s.station_name_ar,s.city_name_ar)) ORDER BY s.stop_index) FROM safeer.trip_stops s WHERE s.company_id=cid AND s.trip_id=tid),
  'fares',(SELECT coalesce(jsonb_agg(jsonb_build_object('from',i,'to',j,'fareMinor',safeer.segment_fare(t,i,j)) ORDER BY i,j),'[]'::jsonb) FROM generate_series(0,t.stop_count-2) i CROSS JOIN generate_series(1,t.stop_count-1) j WHERE i<j AND safeer.segment_fare(t,i,j) IS NOT NULL),
  'seats',(SELECT jsonb_agg(jsonb_build_object('label',s.label,'row',s.row_number,'column',s.column_number,'available',NOT safeer.seat_taken(cid,tid,s.row_number,s.column_number,int4range(f,l))) ORDER BY s.row_number,s.column_number) FROM safeer.seat_layout_seats s WHERE s.company_id=cid AND s.layout_id=a.layout_id AND s.revision=a.layout_revision));
END $$;

-- Bookings and tickets name the passenger's own stops and times.
CREATE OR REPLACE FUNCTION safeer.booking_view(b safeer.bookings) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('reference',b.reference,'status',CASE WHEN b.status='held' AND b.expires_at<=clock_timestamp() THEN 'expired' ELSE b.status END,
  'releasedBy',b.released_by_kind,'expiresAt',b.expires_at,'serverNow',clock_timestamp(),'createdAt',b.created_at,
  'holdMinutes',b.hold_minutes,'seatCount',b.seat_count,'fareMinor',b.fare_minor,'amountMinor',b.amount_minor,'currency',b.currency,
  'seats',(SELECT jsonb_agg(a.label ORDER BY a.row_number,a.column_number) FROM safeer.seat_allocations a WHERE a.company_id=b.company_id AND a.booking_id=b.id),
  'tickets',safeer.booking_tickets(b.company_id,b.id),'luggage',safeer.booking_luggage(b.company_id,b.id),'tripCanceled',t.status='canceled','mobile',c.mobile,'detailsErased',c.erased_at IS NOT NULL,'travelers',safeer.booking_travelers(b.company_id,b.id),
  'tripId',t.id,'routeNameEn',t.route_name_en,'routeNameAr',t.route_name_ar,
  'fromIndex',fs.stop_index,'toIndex',ls.stop_index,'partial',NOT(fs.stop_index=0 AND ls.stop_index=t.stop_count-1),
  'fromNameEn',coalesce(fs.station_name_en,fs.city_name_en),'fromNameAr',coalesce(fs.station_name_ar,fs.city_name_ar),'toNameEn',coalesce(ls.station_name_en,ls.city_name_en),'toNameAr',coalesce(ls.station_name_ar,ls.city_name_ar),
  'date',to_char((t.departure_at+make_interval(mins=>fs.offset_minutes)) AT TIME ZONE t.timezone,'YYYY-MM-DD'),'time',to_char((t.departure_at+make_interval(mins=>fs.offset_minutes)) AT TIME ZONE t.timezone,'HH24:MI'),
  'tripOpen',visible AND t.status='published' AND t.departure_at>clock_timestamp(),'companySlug',co.slug,'companyNameEn',co.name_en,'companyNameAr',co.name_ar,
  'phone',CASE WHEN visible THEN p.public_phone END,'email',CASE WHEN visible THEN p.public_email END,'address',CASE WHEN visible THEN p.public_address END)
 FROM safeer.trips t JOIN safeer.companies co ON co.id=t.company_id LEFT JOIN safeer.company_public_profiles p ON p.company_id=t.company_id
 LEFT JOIN safeer.booking_contacts c ON c.company_id=b.company_id AND c.booking_id=b.id
 CROSS JOIN LATERAL (SELECT co.status='approved' AND COALESCE(p.listed,false) AS visible) v
 CROSS JOIN LATERAL (SELECT coalesce(safeer.booking_segment(b.company_id,b.id),int4range(0,t.stop_count-1)) AS seg) g
 JOIN safeer.trip_stops fs ON fs.company_id=t.company_id AND fs.trip_id=t.id AND fs.stop_index=lower(g.seg)
 JOIN safeer.trip_stops ls ON ls.company_id=t.company_id AND ls.trip_id=t.id AND ls.stop_index=upper(g.seg)
 WHERE t.company_id=b.company_id AND t.id=b.trip_id
$$;

CREATE OR REPLACE FUNCTION safeer.passenger_booking(p_reference text,p_access text,p_mobile text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b safeer.bookings%ROWTYPE; t safeer.trips%ROWTYPE; doc jsonb; trip_doc jsonb; seg int4range;
BEGIN
 IF (p_access IS NULL)=(p_mobile IS NULL) THEN RETURN NULL; END IF;
 SELECT x.* INTO b FROM safeer.bookings x LEFT JOIN safeer.booking_contacts c ON (c.company_id,c.booking_id)=(x.company_id,x.id)
 WHERE x.reference=p_reference AND ((p_access IS NOT NULL AND x.access_hash=p_access) OR (p_access IS NULL AND c.mobile=p_mobile));
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO t FROM safeer.trips WHERE company_id=b.company_id AND id=b.trip_id;
 seg:=coalesce(safeer.booking_segment(b.company_id,b.id),int4range(0,t.stop_count-1));
 doc:=safeer.booking_view(b);
 -- D89: departure and arrival are the passenger's own stops.
 SELECT jsonb_build_object('departureAt',t.departure_at+make_interval(mins=>first_stop.offset_minutes),'arrivalAt',t.departure_at+make_interval(mins=>last_stop.offset_minutes),'timezone',t.timezone,
  'fromNameEn',first_stop.city_name_en,'fromNameAr',first_stop.city_name_ar,'toNameEn',last_stop.city_name_en,'toNameAr',last_stop.city_name_ar,
  'arrivalDate',to_char((t.departure_at+make_interval(mins=>last_stop.offset_minutes)) AT TIME ZONE t.timezone,'YYYY-MM-DD'),'arrivalTime',to_char((t.departure_at+make_interval(mins=>last_stop.offset_minutes)) AT TIME ZONE t.timezone,'HH24:MI'),
  'stops',COALESCE((SELECT jsonb_agg(jsonb_build_object('cityNameEn',s.city_name_en,'cityNameAr',s.city_name_ar,'stationNameEn',s.station_name_en,'stationNameAr',s.station_name_ar,'onJourney',s.stop_index BETWEEN lower(seg) AND upper(seg)) ORDER BY s.stop_index) FROM safeer.trip_stops s WHERE s.company_id=t.company_id AND s.trip_id=t.id),'[]'::jsonb)) INTO trip_doc
 FROM safeer.trip_stops first_stop JOIN safeer.trip_stops last_stop ON last_stop.company_id=first_stop.company_id AND last_stop.trip_id=first_stop.trip_id AND last_stop.stop_index=upper(seg)
 WHERE first_stop.company_id=t.company_id AND first_stop.trip_id=t.id AND first_stop.stop_index=lower(seg);
 IF p_access IS NULL THEN
  doc:=safeer.mask_booking(doc);
 ELSE
  doc:=doc||jsonb_build_object('tickets',COALESCE((SELECT jsonb_agg(jsonb_build_object('number',k.ticket_number,'seat',a.label,'status',k.status,
   'qrToken',CASE WHEN b.status='confirmed' AND t.status='published' AND k.status='valid' THEN q.value END) ORDER BY a.row_number,a.column_number)
   FROM safeer.tickets k JOIN safeer.seat_allocations a ON (a.company_id,a.id)=(k.company_id,k.allocation_id)
   LEFT JOIN safeer.ticket_credentials q ON (q.company_id,q.ticket_id)=(k.company_id,k.id)
   WHERE k.company_id=b.company_id AND k.booking_id=b.id),'[]'::jsonb));
 END IF;
 RETURN doc||COALESCE(trip_doc,'{}'::jsonb);
END $$;

-- Driver: who boards and who leaves at each stop.
CREATE OR REPLACE FUNCTION safeer.driver_manifest_before_shipments(cid uuid,tid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 IF NOT safeer.journey_allowed(cid,tid) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('tripId',t.id,'status',t.status,'departureAt',t.departure_at,'arrivalAt',t.arrival_at,'timezone',t.timezone,'serverNow',clock_timestamp(),
 -- D89: after departure, boarding stays open for passengers who board at a later stop, until arrival.
 'boardingOpen',t.status='published' AND t.departure_at-interval '24 hours'<=clock_timestamp() AND t.arrival_at>clock_timestamp()
  AND NOT EXISTS(SELECT 1 FROM safeer.journey_events j WHERE j.company_id=cid AND j.trip_id=tid AND j.event='arrived')
  AND (NOT EXISTS(SELECT 1 FROM safeer.journey_events j WHERE j.company_id=cid AND j.trip_id=tid AND j.event='departed')
   OR EXISTS(SELECT 1 FROM safeer.seat_allocations x JOIN safeer.bookings z ON (z.company_id,z.id)=(x.company_id,x.booking_id) WHERE x.company_id=cid AND x.trip_id=tid AND z.status='confirmed' AND lower(x.segment)>0)),
 'stops',COALESCE((SELECT jsonb_agg(jsonb_build_object('index',s.stop_index,'nameEn',COALESCE(s.station_name_en,s.city_name_en),'nameAr',COALESCE(s.station_name_ar,s.city_name_ar),'scheduledAt',t.departure_at+make_interval(mins=>s.offset_minutes)) ORDER BY s.stop_index) FROM safeer.trip_stops s WHERE s.company_id=cid AND s.trip_id=tid),'[]'::jsonb),'estimatedArrivalAt',NULL,
 'events',coalesce((SELECT jsonb_agg(jsonb_build_object('event',j.event,'at',j.created_at) ORDER BY j.created_at) FROM safeer.journey_events j WHERE j.company_id=cid AND j.trip_id=tid),'[]'::jsonb),
 'incidents',coalesce((SELECT jsonb_agg(jsonb_build_object('id',j.id,'kind',j.kind,'note',CASE WHEN t.arrival_at+interval '90 days'>clock_timestamp() THEN j.note END,'at',j.created_at) ORDER BY j.created_at) FROM safeer.journey_incidents j WHERE j.company_id=cid AND j.trip_id=tid),'[]'::jsonb),
 'passengers',coalesce((SELECT jsonb_agg(jsonb_build_object('ticket',k.ticket_number,'bookingReference',b.reference,'seat',a.label,'name',CASE WHEN c.erase_at>clock_timestamp() THEN p.full_name END,'valid',k.status='valid' AND b.status='confirmed' AND t.status='published','boardedAt',r.boarded_at,
   'fromIndex',lower(a.segment),'toIndex',upper(a.segment),'boardsEn',coalesce(fs.station_name_en,fs.city_name_en),'boardsAr',coalesce(fs.station_name_ar,fs.city_name_ar),'leavesEn',coalesce(ls.station_name_en,ls.city_name_en),'leavesAr',coalesce(ls.station_name_ar,ls.city_name_ar)) ORDER BY lower(a.segment),a.row_number,a.column_number)
 FROM safeer.tickets k JOIN safeer.bookings b ON (b.company_id,b.id)=(k.company_id,k.booking_id)
 JOIN safeer.seat_allocations a ON (a.company_id,a.id)=(k.company_id,k.allocation_id)
 JOIN safeer.trip_stops fs ON fs.company_id=a.company_id AND fs.trip_id=a.trip_id AND fs.stop_index=lower(a.segment)
 JOIN safeer.trip_stops ls ON ls.company_id=a.company_id AND ls.trip_id=a.trip_id AND ls.stop_index=upper(a.segment)
 LEFT JOIN safeer.booking_passengers p ON (p.company_id,p.allocation_id)=(a.company_id,a.id)
 LEFT JOIN safeer.booking_contacts c ON (c.company_id,c.booking_id)=(b.company_id,b.id)
 LEFT JOIN safeer.boarding_records r ON (r.company_id,r.ticket_id)=(k.company_id,k.id)
 WHERE b.company_id=cid AND b.trip_id=tid),'[]'::jsonb)) INTO result FROM safeer.trips t WHERE t.company_id=cid AND t.id=tid AND t.status<>'draft';
 IF result IS NULL THEN RETURN NULL; END IF;
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,safeer.company_actor(),'journey.manifest',tid);
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION safeer.driver_verify(cid uuid,tid uuid,qr text,board boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE k safeer.tickets%ROWTYPE; t safeer.trips%ROWTYPE; b safeer.bookings%ROWTYPE; seat text; person text; boarded timestamptz; was_boarded boolean; seg int4range; boards jsonb;
BEGIN
 SELECT * INTO t FROM safeer.trips WHERE company_id=cid AND id=tid FOR NO KEY UPDATE;
 IF NOT safeer.journey_allowed(cid,tid) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF qr ~ '^TKT-[0-9]{8,12}$' THEN
  SELECT x.* INTO k FROM safeer.tickets x JOIN safeer.bookings z ON (z.company_id,z.id)=(x.company_id,x.booking_id)
  WHERE x.company_id=cid AND z.trip_id=tid AND x.ticket_number=qr;
 ELSE
  SELECT x.* INTO k FROM safeer.tickets x JOIN safeer.ticket_credentials q ON (q.company_id,q.ticket_id)=(x.company_id,x.id) WHERE q.company_id=cid AND q.value=qr;
 END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'TICKET_INVALID' USING ERRCODE='P0001'; END IF;
 SELECT * INTO b FROM safeer.bookings WHERE company_id=cid AND id=k.booking_id;
 IF k.status<>'valid' OR b.status<>'confirmed' OR t.status<>'published' THEN RAISE EXCEPTION 'TICKET_INVALID' USING ERRCODE='P0001'; END IF;
 IF b.trip_id<>tid THEN RAISE EXCEPTION 'TICKET_WRONG_TRIP' USING ERRCODE='P0001'; END IF;
 IF t.departure_at-interval '24 hours'>clock_timestamp() OR t.arrival_at<=clock_timestamp() OR EXISTS(SELECT 1 FROM safeer.journey_events WHERE company_id=cid AND trip_id=tid AND event<>'departed') THEN RAISE EXCEPTION 'BOARDING_CLOSED' USING ERRCODE='P0001'; END IF;
 -- D89: once the bus has left its first stop, only passengers boarding at a later stop can still be boarded.
 SELECT a.segment INTO seg FROM safeer.seat_allocations a WHERE a.company_id=cid AND a.id=k.allocation_id;
 IF EXISTS(SELECT 1 FROM safeer.journey_events WHERE company_id=cid AND trip_id=tid AND event='departed') AND lower(seg)=0 AND NOT EXISTS(SELECT 1 FROM safeer.boarding_records WHERE company_id=cid AND ticket_id=k.id) THEN RAISE EXCEPTION 'BOARDING_CLOSED' USING ERRCODE='P0001'; END IF;
 SELECT r.boarded_at INTO boarded FROM safeer.boarding_records r WHERE r.company_id=cid AND r.ticket_id=k.id;
 was_boarded:=boarded IS NOT NULL;
 IF board AND boarded IS NULL THEN
  INSERT INTO safeer.boarding_records(company_id,trip_id,ticket_id,actor_id) VALUES(cid,tid,k.id,safeer.company_actor()) RETURNING boarded_at INTO boarded;
  INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,safeer.company_actor(),'journey.boarded',k.id);
 END IF;
 IF NOT board THEN INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,safeer.company_actor(),'journey.verified',k.id); END IF;
 SELECT a.label,CASE WHEN c.erase_at>clock_timestamp() THEN p.full_name END INTO seat,person FROM safeer.seat_allocations a
 LEFT JOIN safeer.booking_passengers p ON (p.company_id,p.allocation_id)=(a.company_id,a.id)
 LEFT JOIN safeer.booking_contacts c ON (c.company_id,c.booking_id)=(a.company_id,a.booking_id)
 WHERE a.company_id=cid AND a.id=k.allocation_id;
 SELECT jsonb_build_object('fromIndex',lower(seg),'toIndex',upper(seg),'boardsEn',coalesce(fs.station_name_en,fs.city_name_en),'boardsAr',coalesce(fs.station_name_ar,fs.city_name_ar),'leavesEn',coalesce(ls.station_name_en,ls.city_name_en),'leavesAr',coalesce(ls.station_name_ar,ls.city_name_ar)) INTO boards
  FROM safeer.trip_stops fs JOIN safeer.trip_stops ls ON ls.company_id=fs.company_id AND ls.trip_id=fs.trip_id AND ls.stop_index=upper(seg) WHERE fs.company_id=cid AND fs.trip_id=tid AND fs.stop_index=lower(seg);
 RETURN jsonb_build_object('ticket',k.ticket_number,'seat',seat,'name',person,'boardedAt',boarded,'alreadyBoarded',was_boarded)||coalesce(boards,'{}'::jsonb);
END $$;

-- Operations: occupancy on each stretch, and where each passenger travels.
CREATE OR REPLACE FUNCTION safeer.operations_trip(cid uuid,tid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t safeer.trips%ROWTYPE; a safeer.trip_assignments%ROWTYPE; people boolean; result jsonb;
BEGIN
 IF NOT safeer.company_has(cid,'company.trips.read') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO t FROM safeer.trips WHERE company_id=cid AND id=tid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO a FROM safeer.trip_assignments WHERE company_id=cid AND trip_id=tid AND replaced_at IS NULL;
 people:=safeer.company_has(cid,'company.bookings.read');
 SELECT jsonb_build_object('id',t.id,'departureAt',t.departure_at,'arrivalAt',t.arrival_at,'timezone',t.timezone,'routeEn',t.route_name_en,'routeAr',t.route_name_ar,
  'status',safeer.operations_trip_status(t),'tripStatus',t.status,'busCode',a.bus_code,'busRegistration',a.bus_registration,'driverEn',a.driver_name_en,'driverAr',a.driver_name_ar,'seatCount',a.seat_count,
  'booked',(SELECT count(*) FROM safeer.tickets k JOIN safeer.bookings b ON (b.company_id,b.id)=(k.company_id,k.booking_id) WHERE b.company_id=cid AND b.trip_id=tid AND k.status='valid' AND b.status='confirmed')::integer,
  'boarded',(SELECT count(*) FROM safeer.boarding_records r JOIN safeer.tickets k ON (k.company_id,k.id)=(r.company_id,r.ticket_id) WHERE r.company_id=cid AND r.trip_id=tid AND k.status='valid')::integer,
  'legs',(SELECT coalesce(jsonb_agg(jsonb_build_object('fromIndex',s.stop_index,'fromEn',coalesce(s.station_name_en,s.city_name_en),'fromAr',coalesce(s.station_name_ar,s.city_name_ar),'toEn',coalesce(n.station_name_en,n.city_name_en),'toAr',coalesce(n.station_name_ar,n.city_name_ar),
    'occupied',(SELECT count(*) FROM safeer.tickets k JOIN safeer.bookings b ON (b.company_id,b.id)=(k.company_id,k.booking_id) JOIN safeer.seat_allocations x ON (x.company_id,x.id)=(k.company_id,k.allocation_id) WHERE b.company_id=cid AND b.trip_id=tid AND k.status='valid' AND b.status='confirmed' AND x.segment @> s.stop_index)::integer) ORDER BY s.stop_index),'[]'::jsonb)
   FROM safeer.trip_stops s JOIN safeer.trip_stops n ON n.company_id=s.company_id AND n.trip_id=s.trip_id AND n.stop_index=s.stop_index+1 WHERE s.company_id=cid AND s.trip_id=tid),
  'canSeePassengers',people,
  'passengers',CASE WHEN people THEN coalesce((SELECT jsonb_agg(jsonb_build_object('ticket',k.ticket_number,'seat',s.label,'name',CASE WHEN c.erased_at IS NULL THEN p.full_name END,'reference',b.reference,'boardedAt',r.boarded_at,
    'fromIndex',lower(s.segment),'toIndex',upper(s.segment),'boardsEn',coalesce(fs.station_name_en,fs.city_name_en),'boardsAr',coalesce(fs.station_name_ar,fs.city_name_ar),'leavesEn',coalesce(ls.station_name_en,ls.city_name_en),'leavesAr',coalesce(ls.station_name_ar,ls.city_name_ar)) ORDER BY lower(s.segment),s.row_number,s.column_number)
   FROM safeer.tickets k JOIN safeer.bookings b ON (b.company_id,b.id)=(k.company_id,k.booking_id) JOIN safeer.seat_allocations s ON (s.company_id,s.id)=(k.company_id,k.allocation_id)
   JOIN safeer.trip_stops fs ON fs.company_id=s.company_id AND fs.trip_id=s.trip_id AND fs.stop_index=lower(s.segment)
   JOIN safeer.trip_stops ls ON ls.company_id=s.company_id AND ls.trip_id=s.trip_id AND ls.stop_index=upper(s.segment)
   LEFT JOIN safeer.booking_passengers p ON (p.company_id,p.allocation_id)=(s.company_id,s.id) LEFT JOIN safeer.booking_contacts c ON (c.company_id,c.booking_id)=(b.company_id,b.id)
   LEFT JOIN safeer.boarding_records r ON (r.company_id,r.ticket_id)=(k.company_id,k.id)
   WHERE b.company_id=cid AND b.trip_id=tid AND k.status='valid' AND b.status='confirmed'),'[]'::jsonb) END,
  'recentScans',CASE WHEN people THEN coalesce((SELECT jsonb_agg(x ORDER BY x->>'at' DESC) FROM (SELECT jsonb_build_object('at',r.boarded_at,'ticket',k.ticket_number,'seat',s.label,'name',CASE WHEN c.erased_at IS NULL THEN p.full_name END) AS x
   FROM safeer.boarding_records r JOIN safeer.tickets k ON (k.company_id,k.id)=(r.company_id,r.ticket_id) JOIN safeer.seat_allocations s ON (s.company_id,s.id)=(k.company_id,k.allocation_id)
   LEFT JOIN safeer.booking_passengers p ON (p.company_id,p.allocation_id)=(s.company_id,s.id) LEFT JOIN safeer.booking_contacts c ON (c.company_id,c.booking_id)=(k.company_id,k.booking_id)
   WHERE r.company_id=cid AND r.trip_id=tid ORDER BY r.boarded_at DESC LIMIT 10) q),'[]'::jsonb) END,
  'incidents',(SELECT coalesce(jsonb_agg(jsonb_build_object('kind',i.kind,'at',i.created_at) ORDER BY i.created_at DESC),'[]'::jsonb) FROM safeer.journey_incidents i WHERE i.company_id=cid AND i.trip_id=tid)) INTO result;
 RETURN result;
END $$;

-- Staff seat map: a seat can now carry one booking per stretch.
CREATE OR REPLACE FUNCTION safeer.staff_seat_map(cid uuid,tid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a safeer.trip_assignments%ROWTYPE; r safeer.seat_layout_revisions%ROWTYPE;
BEGIN
 IF NOT safeer.company_can(cid,'company.bookings.read') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM safeer.trips WHERE company_id=cid AND id=tid) THEN RETURN NULL; END IF;
 SELECT * INTO a FROM safeer.trip_assignments WHERE company_id=cid AND trip_id=tid AND replaced_at IS NULL;
 SELECT * INTO r FROM safeer.seat_layout_revisions WHERE company_id=cid AND layout_id=a.layout_id AND revision=a.layout_revision;
 RETURN jsonb_build_object('serverNow',clock_timestamp(),'canManage',safeer.company_can(cid,'company.bookings.manage'),'rows',r.row_count,'columns',r.column_count,
  'seats',COALESCE((SELECT jsonb_agg(jsonb_build_object('label',s.label,'row',s.row_number,'column',s.column_number,
    'reference',(SELECT string_agg(b.reference,' · ' ORDER BY lower(h.segment)) FROM safeer.seat_allocations h JOIN safeer.bookings b ON (b.company_id,b.id)=(h.company_id,h.booking_id) WHERE h.company_id=cid AND h.trip_id=tid AND h.row_number=s.row_number AND h.column_number=s.column_number AND (h.status='confirmed' OR (h.status='held' AND h.expires_at>clock_timestamp())))) ORDER BY s.row_number,s.column_number)
   FROM safeer.seat_layout_seats s WHERE s.company_id=cid AND s.layout_id=a.layout_id AND s.revision=a.layout_revision),'[]'::jsonb),
  'bookingTotal',(SELECT count(*) FROM safeer.bookings b WHERE b.company_id=cid AND b.trip_id=tid),
  'bookings',COALESCE((SELECT jsonb_agg(x ORDER BY x->>'createdAt' DESC) FROM (SELECT safeer.staff_booking_row(b) AS x
   FROM safeer.bookings b WHERE b.company_id=cid AND b.trip_id=tid ORDER BY (b.status='held' AND b.expires_at>clock_timestamp()) DESC,b.created_at DESC LIMIT 200) y),'[]'::jsonb));
END $$;

-- Staff booking rows (Bookings, seat map) name the journey too.
CREATE FUNCTION safeer.booking_journey(b safeer.bookings) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('fromIndex',fs.stop_index,'toIndex',ls.stop_index,'partial',NOT(fs.stop_index=0 AND ls.stop_index=t.stop_count-1),
  'fromNameEn',coalesce(fs.station_name_en,fs.city_name_en),'fromNameAr',coalesce(fs.station_name_ar,fs.city_name_ar),'toNameEn',coalesce(ls.station_name_en,ls.city_name_en),'toNameAr',coalesce(ls.station_name_ar,ls.city_name_ar),
  'boardingAt',t.departure_at+make_interval(mins=>fs.offset_minutes),
  'date',to_char((t.departure_at+make_interval(mins=>fs.offset_minutes)) AT TIME ZONE t.timezone,'YYYY-MM-DD'),'time',to_char((t.departure_at+make_interval(mins=>fs.offset_minutes)) AT TIME ZONE t.timezone,'HH24:MI'))
 FROM safeer.trips t
 CROSS JOIN LATERAL (SELECT coalesce(safeer.booking_segment(b.company_id,b.id),int4range(0,t.stop_count-1)) AS seg) g
 JOIN safeer.trip_stops fs ON fs.company_id=t.company_id AND fs.trip_id=t.id AND fs.stop_index=lower(g.seg)
 JOIN safeer.trip_stops ls ON ls.company_id=t.company_id AND ls.trip_id=t.id AND ls.stop_index=upper(g.seg)
 WHERE t.company_id=b.company_id AND t.id=b.trip_id
$$;
ALTER FUNCTION safeer.staff_booking_row(safeer.bookings) RENAME TO staff_booking_row_before_stops;
CREATE FUNCTION safeer.staff_booking_row(b safeer.bookings) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT safeer.staff_booking_row_before_stops(b)||coalesce(safeer.booking_journey(b),'{}'::jsonb)
$$;
REVOKE ALL ON FUNCTION safeer.booking_journey(safeer.bookings),safeer.staff_booking_row(safeer.bookings) FROM PUBLIC;
REVOKE ALL ON FUNCTION safeer.segment_fare(safeer.trips,integer,integer),safeer.seat_taken(uuid,uuid,integer,integer,int4range),safeer.booking_segment(uuid,uuid),
 safeer.hold_seats(uuid,text[],uuid,text,text,text,boolean,uuid,integer,integer),safeer.public_book(uuid,text[],uuid,text,text,text,text,jsonb,integer,integer),
 safeer.counter_sale(uuid,uuid,uuid,text[],uuid,text,text,text,text,jsonb,text,text,text,integer,integer),safeer.trip_doc(safeer.trips,integer,integer),
 safeer.public_trip(uuid,integer,integer),safeer.counter_trip(uuid,uuid,integer,integer) FROM PUBLIC;

-- Every stop of a published trip is a place passengers can search from or to.
CREATE OR REPLACE FUNCTION safeer.public_cities() RETURNS SETOF jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('code',c.code,'nameEn',c.name_en,'nameAr',c.name_ar) FROM safeer.cities c
 WHERE c.active AND EXISTS(SELECT 1 FROM safeer.trips t JOIN safeer.companies co ON co.id=t.company_id AND co.status='approved'
  JOIN safeer.company_public_profiles p ON p.company_id=t.company_id AND p.listed
  JOIN safeer.trip_stops s ON s.company_id=t.company_id AND s.trip_id=t.id
  WHERE t.status='published' AND t.departure_at>clock_timestamp() AND s.city_id=c.id)
 ORDER BY c.name_en,c.code
$$;
