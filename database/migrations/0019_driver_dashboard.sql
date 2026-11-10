-- D66: preserve existing locks/authority and expose only assigned-trip dashboard fields.
-- The public manifest wrapper retains D59 shipments; its private core gains schedule/reference data.
CREATE OR REPLACE FUNCTION safeer.driver_trips() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('items',coalesce(jsonb_agg(x ORDER BY x->>'departureAt'),'[]'::jsonb)) FROM (
 SELECT jsonb_build_object('id',t.id,'companyId',t.company_id,'companyEn',c.name_en,'companyAr',c.name_ar,'routeEn',t.route_name_en,'routeAr',t.route_name_ar,'timezone',t.timezone,'departureAt',t.departure_at,'arrivalAt',t.arrival_at,'status',t.status,'bus',a.bus_registration,
 'journey',CASE WHEN EXISTS(SELECT 1 FROM safeer.journey_events j WHERE j.company_id=t.company_id AND j.trip_id=t.id AND j.event='arrived') THEN 'arrived' WHEN EXISTS(SELECT 1 FROM safeer.journey_events j WHERE j.company_id=t.company_id AND j.trip_id=t.id AND j.event='departed') THEN 'departed' ELSE 'scheduled' END) AS x
 FROM safeer.trips t JOIN safeer.companies c ON c.id=t.company_id
 JOIN safeer.trip_assignments a ON (a.company_id,a.trip_id)=(t.company_id,t.id) AND a.replaced_at IS NULL
 WHERE t.status<>'draft' AND safeer.journey_allowed(t.company_id,t.id)
 ) q
$$;

CREATE OR REPLACE FUNCTION safeer.driver_manifest_before_shipments(cid uuid,tid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 IF NOT safeer.journey_allowed(cid,tid) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('tripId',t.id,'status',t.status,'departureAt',t.departure_at,'arrivalAt',t.arrival_at,'timezone',t.timezone,'serverNow',clock_timestamp(),
 'boardingOpen',t.status='published' AND t.departure_at-interval '24 hours'<=clock_timestamp() AND t.arrival_at>clock_timestamp() AND NOT EXISTS(SELECT 1 FROM safeer.journey_events j WHERE j.company_id=cid AND j.trip_id=tid),
 'stops',COALESCE((SELECT jsonb_agg(jsonb_build_object('nameEn',COALESCE(s.station_name_en,s.city_name_en),'nameAr',COALESCE(s.station_name_ar,s.city_name_ar),'scheduledAt',t.departure_at+make_interval(mins=>s.offset_minutes)) ORDER BY s.stop_index) FROM safeer.trip_stops s WHERE s.company_id=cid AND s.trip_id=tid),'[]'::jsonb),'estimatedArrivalAt',NULL,
 
 'events',coalesce((SELECT jsonb_agg(jsonb_build_object('event',j.event,'at',j.created_at) ORDER BY j.created_at) FROM safeer.journey_events j WHERE j.company_id=cid AND j.trip_id=tid),'[]'::jsonb),
 'incidents',coalesce((SELECT jsonb_agg(jsonb_build_object('id',j.id,'kind',j.kind,'note',CASE WHEN t.arrival_at+interval '90 days'>clock_timestamp() THEN j.note END,'at',j.created_at) ORDER BY j.created_at) FROM safeer.journey_incidents j WHERE j.company_id=cid AND j.trip_id=tid),'[]'::jsonb),
 'passengers',coalesce((SELECT jsonb_agg(jsonb_build_object('ticket',k.ticket_number,'bookingReference',b.reference,'seat',a.label,'name',CASE WHEN c.erase_at>clock_timestamp() THEN p.full_name END,'valid',k.status='valid' AND b.status='confirmed' AND t.status='published','boardedAt',r.boarded_at) ORDER BY a.row_number,a.column_number)
 FROM safeer.tickets k JOIN safeer.bookings b ON (b.company_id,b.id)=(k.company_id,k.booking_id)
 JOIN safeer.seat_allocations a ON (a.company_id,a.id)=(k.company_id,k.allocation_id)
 LEFT JOIN safeer.booking_passengers p ON (p.company_id,p.allocation_id)=(a.company_id,a.id)
 LEFT JOIN safeer.booking_contacts c ON (c.company_id,c.booking_id)=(b.company_id,b.id)
 LEFT JOIN safeer.boarding_records r ON (r.company_id,r.ticket_id)=(k.company_id,k.id)
 WHERE b.company_id=cid AND b.trip_id=tid),'[]'::jsonb)) INTO result FROM safeer.trips t WHERE t.company_id=cid AND t.id=tid AND t.status<>'draft';
 IF result IS NULL THEN RETURN NULL; END IF;
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,safeer.company_actor(),'journey.manifest',tid);
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION safeer.driver_verify(cid uuid,tid uuid,qr text,board boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE k safeer.tickets%ROWTYPE; t safeer.trips%ROWTYPE; b safeer.bookings%ROWTYPE; seat text; person text; boarded timestamptz; was_boarded boolean;
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
 IF t.departure_at-interval '24 hours'>clock_timestamp() OR t.arrival_at<=clock_timestamp() OR EXISTS(SELECT 1 FROM safeer.journey_events WHERE company_id=cid AND trip_id=tid) THEN RAISE EXCEPTION 'BOARDING_CLOSED' USING ERRCODE='P0001'; END IF;
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
 RETURN jsonb_build_object('ticket',k.ticket_number,'seat',seat,'name',person,'boardedAt',boarded,'alreadyBoarded',was_boarded);
END $$;

