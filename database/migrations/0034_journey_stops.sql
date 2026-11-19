-- D122: the driver records the journey step by step: start (departed), each intermediate stop reached,
-- destination reached (arrived) and finally closes the trip (closed). The trip may start with passengers
-- still missing. Passengers follow the progress on the public tracking page with their booking reference.
ALTER TABLE safeer.journey_events DROP CONSTRAINT journey_events_event_check;
ALTER TABLE safeer.journey_events ADD CONSTRAINT journey_events_event_check CHECK(event IN ('departed','arrived','closed'));

CREATE TABLE safeer.journey_stop_events (
 company_id uuid NOT NULL,trip_id uuid NOT NULL,stop_index integer NOT NULL CHECK(stop_index BETWEEN 1 AND 28),
 actor_id uuid NOT NULL REFERENCES safeer.users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,trip_id,stop_index),FOREIGN KEY(company_id,trip_id,stop_index) REFERENCES safeer.trip_stops(company_id,trip_id,stop_index)
);
ALTER TABLE safeer.journey_stop_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON safeer.journey_stop_events FROM PUBLIC;
CREATE POLICY journey_stop_read ON safeer.journey_stop_events FOR SELECT USING(safeer.company_has(company_id,'company.trips.read') OR safeer.journey_allowed(company_id,trip_id));

-- Start, destination and close. Close needs the destination first.
CREATE OR REPLACE FUNCTION safeer.driver_event(cid uuid,tid uuid,kind text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t safeer.trips%ROWTYPE; happened timestamptz;
BEGIN
 SELECT * INTO t FROM safeer.trips WHERE company_id=cid AND id=tid FOR NO KEY UPDATE;
 IF NOT safeer.journey_allowed(cid,tid) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF kind NOT IN ('departed','arrived','closed') OR t.status<>'published' OR t.departure_at>clock_timestamp() THEN RAISE EXCEPTION 'JOURNEY_STATE' USING ERRCODE='P0001'; END IF;
 SELECT created_at INTO happened FROM safeer.journey_events WHERE company_id=cid AND trip_id=tid AND event=kind;
 IF happened IS NOT NULL THEN RETURN jsonb_build_object('event',kind,'at',happened); END IF;
 IF kind='arrived' AND NOT EXISTS(SELECT 1 FROM safeer.journey_events WHERE company_id=cid AND trip_id=tid AND event='departed') THEN RAISE EXCEPTION 'JOURNEY_STATE' USING ERRCODE='P0001'; END IF;
 IF kind='closed' AND NOT EXISTS(SELECT 1 FROM safeer.journey_events WHERE company_id=cid AND trip_id=tid AND event='arrived') THEN RAISE EXCEPTION 'JOURNEY_STATE' USING ERRCODE='P0001'; END IF;
 INSERT INTO safeer.journey_events(company_id,trip_id,event,actor_id) VALUES(cid,tid,kind,safeer.company_actor()) RETURNING created_at INTO happened;
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,safeer.company_actor(),'journey.'||kind,tid);
 RETURN jsonb_build_object('event',kind,'at',happened);
END $$;

-- An intermediate stop reached, in travel order, after the start and before the destination.
CREATE FUNCTION safeer.driver_stop(cid uuid,tid uuid,idx integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t safeer.trips%ROWTYPE; last integer; happened timestamptz;
BEGIN
 SELECT * INTO t FROM safeer.trips WHERE company_id=cid AND id=tid FOR NO KEY UPDATE;
 IF NOT FOUND OR NOT safeer.journey_allowed(cid,tid) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT max(stop_index) INTO last FROM safeer.trip_stops WHERE company_id=cid AND trip_id=tid;
 IF t.status<>'published' OR idx IS NULL OR idx<1 OR idx>=last
  OR NOT EXISTS(SELECT 1 FROM safeer.journey_events WHERE company_id=cid AND trip_id=tid AND event='departed')
  OR EXISTS(SELECT 1 FROM safeer.journey_events WHERE company_id=cid AND trip_id=tid AND event='arrived') THEN RAISE EXCEPTION 'JOURNEY_STATE' USING ERRCODE='P0001'; END IF;
 SELECT created_at INTO happened FROM safeer.journey_stop_events WHERE company_id=cid AND trip_id=tid AND stop_index=idx;
 IF happened IS NOT NULL THEN RETURN jsonb_build_object('stopIndex',idx,'at',happened); END IF;
 IF EXISTS(SELECT 1 FROM safeer.journey_stop_events WHERE company_id=cid AND trip_id=tid AND stop_index>idx) THEN RAISE EXCEPTION 'JOURNEY_STATE' USING ERRCODE='P0001'; END IF;
 INSERT INTO safeer.journey_stop_events(company_id,trip_id,stop_index,actor_id) VALUES(cid,tid,idx,safeer.company_actor()) RETURNING created_at INTO happened;
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,safeer.company_actor(),'journey.stop',tid);
 RETURN jsonb_build_object('stopIndex',idx,'at',happened);
END $$;

-- The trip's progress: each stop with its planned time and when it was reached.
CREATE FUNCTION safeer.trip_progress(cid uuid,tid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object(
  'departedAt',(SELECT created_at FROM safeer.journey_events WHERE company_id=cid AND trip_id=tid AND event='departed'),
  'arrivedAt',(SELECT created_at FROM safeer.journey_events WHERE company_id=cid AND trip_id=tid AND event='arrived'),
  'closedAt',(SELECT created_at FROM safeer.journey_events WHERE company_id=cid AND trip_id=tid AND event='closed'),
  'stops',coalesce((SELECT jsonb_agg(jsonb_build_object('index',s.stop_index,'cityEn',s.city_name_en,'cityAr',s.city_name_ar,'stationEn',s.station_name_en,'stationAr',s.station_name_ar,
    'plannedAt',t.departure_at+make_interval(mins=>s.offset_minutes),
    'reachedAt',CASE WHEN s.stop_index=0 THEN (SELECT created_at FROM safeer.journey_events WHERE company_id=cid AND trip_id=tid AND event='departed')
     WHEN s.stop_index=(SELECT max(stop_index) FROM safeer.trip_stops WHERE company_id=cid AND trip_id=tid) THEN (SELECT created_at FROM safeer.journey_events WHERE company_id=cid AND trip_id=tid AND event='arrived')
     ELSE (SELECT created_at FROM safeer.journey_stop_events e WHERE e.company_id=cid AND e.trip_id=tid AND e.stop_index=s.stop_index) END) ORDER BY s.stop_index)
   FROM safeer.trip_stops s JOIN safeer.trips t ON (t.company_id,t.id)=(s.company_id,s.trip_id) WHERE s.company_id=cid AND s.trip_id=tid),'[]'::jsonb))
$$;
-- Drivers and trip staff read it for their own trips.
CREATE FUNCTION safeer.driver_progress(cid uuid,tid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT (safeer.journey_allowed(cid,tid) OR safeer.company_has(cid,'company.trips.read')) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 RETURN safeer.trip_progress(cid,tid);
END $$;
-- Passengers: the booking reference shows the trip's company, route and progress only, never passenger details.
-- Released or expired holds, canceled and draft trips are not shown.
CREATE FUNCTION safeer.public_trip_progress(p_reference text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT safeer.trip_progress(t.company_id,t.id)||jsonb_build_object('companyEn',co.name_en,'companyAr',co.name_ar,'timezone',t.timezone,'departureAt',t.departure_at,'arrivalAt',t.arrival_at)
 FROM safeer.bookings b JOIN safeer.trips t ON (t.company_id,t.id)=(b.company_id,b.trip_id) JOIN safeer.companies co ON co.id=t.company_id
 WHERE b.reference=p_reference AND (b.status='confirmed' OR (b.status='held' AND b.expires_at>clock_timestamp())) AND t.status='published' AND co.status='approved'
$$;
REVOKE ALL ON FUNCTION safeer.driver_event(uuid,uuid,text),safeer.driver_stop(uuid,uuid,integer),safeer.trip_progress(uuid,uuid),safeer.driver_progress(uuid,uuid),safeer.public_trip_progress(text) FROM PUBLIC;
