-- D65 operations dashboard: read-only projections of today's departures and one trip's
-- boarding. Counts come only from confirmed records (valid tickets, boarding_records),
-- so repeated or retried driver scans can never raise them.
CREATE INDEX IF NOT EXISTS trips_company_departure ON safeer.trips(company_id,departure_at);

CREATE FUNCTION safeer.operations_trip_status(t safeer.trips) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE
  WHEN t.status='canceled' THEN 'canceled'
  WHEN EXISTS(SELECT 1 FROM safeer.journey_events j WHERE (j.company_id,j.trip_id)=(t.company_id,t.id) AND j.event='arrived') THEN 'arrived'
  WHEN EXISTS(SELECT 1 FROM safeer.journey_events j WHERE (j.company_id,j.trip_id)=(t.company_id,t.id) AND j.event='departed') THEN 'departed'
  WHEN NOT EXISTS(SELECT 1 FROM safeer.trip_assignments a WHERE (a.company_id,a.trip_id)=(t.company_id,t.id) AND a.replaced_at IS NULL) THEN 'unassigned'
  WHEN t.status='draft' THEN 'draft'
  WHEN t.departure_at<clock_timestamp()-interval '10 minutes'
   OR EXISTS(SELECT 1 FROM safeer.journey_incidents i WHERE (i.company_id,i.trip_id)=(t.company_id,t.id) AND i.kind='delay') THEN 'delayed'
  WHEN t.departure_at-interval '60 minutes'<=clock_timestamp() THEN 'boarding'
  ELSE 'scheduled' END
$$;

CREATE FUNCTION safeer.operations_today(cid uuid,p_day date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE tz text; starts timestamptz; ends timestamptz; result jsonb;
BEGIN
 IF NOT safeer.company_has(cid,'company.trips.read') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT timezone INTO tz FROM safeer.company_settings WHERE company_id=cid;
 IF tz IS NULL THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF p_day IS NULL THEN p_day:=(clock_timestamp() AT TIME ZONE tz)::date; END IF;
 starts:=p_day::timestamp AT TIME ZONE tz;ends:=(p_day+1)::timestamp AT TIME ZONE tz;
 WITH day_trips AS MATERIALIZED (
  SELECT t.*,safeer.operations_trip_status(t) AS display FROM safeer.trips t WHERE t.company_id=cid AND t.departure_at>=starts AND t.departure_at<ends ORDER BY t.departure_at,t.id LIMIT 200
 ), rows AS (
  SELECT d.*,a.bus_code,a.bus_registration,a.driver_name_en,a.driver_name_ar,a.seat_count,
   (SELECT count(*) FROM safeer.tickets k JOIN safeer.bookings b ON (b.company_id,b.id)=(k.company_id,k.booking_id) WHERE b.company_id=cid AND b.trip_id=d.id AND k.status='valid' AND b.status='confirmed')::integer AS booked,
   (SELECT count(*) FROM safeer.boarding_records r JOIN safeer.tickets k ON (k.company_id,k.id)=(r.company_id,r.ticket_id) WHERE r.company_id=cid AND r.trip_id=d.id AND k.status='valid')::integer AS boarded
  FROM day_trips d LEFT JOIN safeer.trip_assignments a ON (a.company_id,a.trip_id)=(d.company_id,d.id) AND a.replaced_at IS NULL
 )
 SELECT jsonb_build_object('day',p_day,'timezone',tz,'asOf',clock_timestamp(),
  'summary',jsonb_build_object('departures',(SELECT count(*) FROM rows WHERE status<>'canceled')::integer,
   'booked',coalesce((SELECT sum(booked) FROM rows WHERE status<>'canceled'),0)::integer,
   'boarded',coalesce((SELECT sum(boarded) FROM rows WHERE status<>'canceled'),0)::integer,
   'attention',(SELECT count(*) FROM rows WHERE display IN ('delayed','unassigned'))::integer),
  'departures',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'departureAt',departure_at,'arrivalAt',arrival_at,'timezone',timezone,'routeEn',route_name_en,'routeAr',route_name_ar,
   'status',display,'tripStatus',status,'busCode',bus_code,'busRegistration',bus_registration,'driverEn',driver_name_en,'driverAr',driver_name_ar,'seatCount',seat_count,'booked',booked,'boarded',boarded) ORDER BY departure_at,id) FROM rows),'[]'::jsonb),
  'attention',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'kind',display,'departureAt',departure_at,'timezone',timezone,'routeEn',route_name_en,'routeAr',route_name_ar,
   'minutesLate',CASE WHEN display='delayed' AND departure_at<clock_timestamp() THEN floor(extract(epoch FROM clock_timestamp()-departure_at)/60)::integer END) ORDER BY departure_at,id) FROM rows WHERE display IN ('delayed','unassigned')),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;

-- One trip: details for trip readers; passenger names and scans only for booking readers.
CREATE FUNCTION safeer.operations_trip(cid uuid,tid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
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
  'canSeePassengers',people,
  'passengers',CASE WHEN people THEN coalesce((SELECT jsonb_agg(jsonb_build_object('ticket',k.ticket_number,'seat',s.label,'name',CASE WHEN c.erased_at IS NULL THEN p.full_name END,'reference',b.reference,'boardedAt',r.boarded_at) ORDER BY s.row_number,s.column_number)
   FROM safeer.tickets k JOIN safeer.bookings b ON (b.company_id,b.id)=(k.company_id,k.booking_id) JOIN safeer.seat_allocations s ON (s.company_id,s.id)=(k.company_id,k.allocation_id)
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

REVOKE ALL ON FUNCTION safeer.operations_trip_status(safeer.trips),safeer.operations_today(uuid,date),safeer.operations_trip(uuid,uuid) FROM PUBLIC;
