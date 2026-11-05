-- Manual printed-ticket fallback, retaining the existing permission and boarding gates.
-- CREATE OR REPLACE preserves the fixed function signature and existing grants.
CREATE OR REPLACE FUNCTION safeer.driver_verify(cid uuid,tid uuid,qr text,board boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE k safeer.tickets%ROWTYPE; t safeer.trips%ROWTYPE; b safeer.bookings%ROWTYPE; seat text; person text; boarded timestamptz;
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
 IF b.trip_id<>tid OR k.status<>'valid' OR b.status<>'confirmed' OR t.status<>'published' THEN RAISE EXCEPTION 'TICKET_INVALID' USING ERRCODE='P0001'; END IF;
 IF t.departure_at-interval '24 hours'>clock_timestamp() OR t.arrival_at<=clock_timestamp() OR EXISTS(SELECT 1 FROM safeer.journey_events WHERE company_id=cid AND trip_id=tid) THEN RAISE EXCEPTION 'BOARDING_CLOSED' USING ERRCODE='P0001'; END IF;
 SELECT r.boarded_at INTO boarded FROM safeer.boarding_records r WHERE r.company_id=cid AND r.ticket_id=k.id;
 IF board AND boarded IS NULL THEN
  INSERT INTO safeer.boarding_records(company_id,trip_id,ticket_id,actor_id) VALUES(cid,tid,k.id,safeer.company_actor()) RETURNING boarded_at INTO boarded;
  INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,safeer.company_actor(),'journey.boarded',k.id);
 END IF;
 IF NOT board THEN INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,safeer.company_actor(),'journey.verified',k.id); END IF;
 SELECT a.label,CASE WHEN c.erase_at>clock_timestamp() THEN p.full_name END INTO seat,person FROM safeer.seat_allocations a
 LEFT JOIN safeer.booking_passengers p ON (p.company_id,p.allocation_id)=(a.company_id,a.id)
 LEFT JOIN safeer.booking_contacts c ON (c.company_id,c.booking_id)=(a.company_id,a.booking_id)
 WHERE a.company_id=cid AND a.id=k.allocation_id;
 RETURN jsonb_build_object('ticket',k.ticket_number,'seat',seat,'name',person,'boardedAt',boarded);
END $$;
