-- Section 12: local driver workspace. Existing tenant role copies keep their grants.
INSERT INTO safeer.permissions(code,module) VALUES ('company.driver.operate','company'),('company.journeys.manage','company');
-- Existing trip-scope templates are reserved for the future client. A company membership
-- grants capability here; the active driver assignment narrows every operation to its trip.
INSERT INTO safeer.roles(id,code,display_name,scope,builtin) VALUES(gen_random_uuid(),'assigned_driver','Assigned driver','company',true);
INSERT INTO safeer.role_permissions(role_id,permission_code)
 SELECT id,'company.driver.operate' FROM safeer.roles WHERE code='assigned_driver';
INSERT INTO safeer.role_permissions(role_id,permission_code)
 SELECT r.id,p FROM safeer.roles r CROSS JOIN unnest(ARRAY['company.journeys.manage','company.driver.operate']) p WHERE r.code='company_administrator';
UPDATE safeer.roles SET version=version+1 WHERE code='company_administrator';

ALTER TABLE safeer.tickets ADD CONSTRAINT tickets_company_id_unique UNIQUE(company_id,id);
CREATE TABLE safeer.ticket_credentials (
 company_id uuid NOT NULL,ticket_id uuid NOT NULL,
 value text NOT NULL DEFAULT ('TQ'||replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','')) CHECK(value ~ '^TQ[0-9a-f]{64}$'),
 PRIMARY KEY(company_id,ticket_id),UNIQUE(value),FOREIGN KEY(company_id,ticket_id) REFERENCES safeer.tickets(company_id,id)
);
CREATE TABLE safeer.boarding_records (
 company_id uuid NOT NULL,trip_id uuid NOT NULL,ticket_id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES safeer.users(id),boarded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,ticket_id),FOREIGN KEY(company_id,trip_id) REFERENCES safeer.trips(company_id,id),FOREIGN KEY(company_id,ticket_id) REFERENCES safeer.tickets(company_id,id)
);
CREATE TABLE safeer.journey_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,trip_id uuid NOT NULL,event text NOT NULL CHECK(event IN ('departed','arrived')),
 actor_id uuid NOT NULL REFERENCES safeer.users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(company_id,trip_id,event),FOREIGN KEY(company_id,trip_id) REFERENCES safeer.trips(company_id,id)
);
CREATE TABLE safeer.journey_incidents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,trip_id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES safeer.users(id),
 kind text NOT NULL CHECK(kind IN ('delay','breakdown','safety','other')),note varchar(500),key_hash text NOT NULL CHECK(key_hash ~ '^[0-9a-f]{64}$'),request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(company_id,key_hash),FOREIGN KEY(company_id,trip_id) REFERENCES safeer.trips(company_id,id)
);
CREATE INDEX boarding_trip ON safeer.boarding_records(company_id,trip_id);
CREATE INDEX incidents_trip ON safeer.journey_incidents(company_id,trip_id,created_at);
DO $$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['ticket_credentials','boarding_records','journey_events','journey_incidents'] LOOP
  EXECUTE format('ALTER TABLE safeer.%I ENABLE ROW LEVEL SECURITY',n);
  EXECUTE format('REVOKE ALL ON safeer.%I FROM PUBLIC',n);
 END LOOP;
END $$;
CREATE FUNCTION safeer.boarding_immutable() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='UPDATE' AND TG_TABLE_NAME='journey_incidents' THEN
  IF NEW.note IS NULL AND (to_jsonb(NEW)-'note') IS NOT DISTINCT FROM (to_jsonb(OLD)-'note') THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'Immutable journey history' USING ERRCODE='42501';
END $$;
CREATE TRIGGER credentials_immutable BEFORE UPDATE OR DELETE ON safeer.ticket_credentials FOR EACH ROW EXECUTE FUNCTION safeer.boarding_immutable();
CREATE TRIGGER boarding_immutable BEFORE UPDATE OR DELETE ON safeer.boarding_records FOR EACH ROW EXECUTE FUNCTION safeer.boarding_immutable();
CREATE TRIGGER journey_immutable BEFORE UPDATE OR DELETE ON safeer.journey_events FOR EACH ROW EXECUTE FUNCTION safeer.boarding_immutable();
CREATE TRIGGER incident_immutable BEFORE UPDATE OR DELETE ON safeer.journey_incidents FOR EACH ROW EXECUTE FUNCTION safeer.boarding_immutable();
CREATE FUNCTION safeer.issue_ticket_credential() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN INSERT INTO safeer.ticket_credentials(company_id,ticket_id) VALUES(NEW.company_id,NEW.id); RETURN NEW; END $$;
CREATE TRIGGER ticket_credential AFTER INSERT ON safeer.tickets FOR EACH ROW EXECUTE FUNCTION safeer.issue_ticket_credential();
INSERT INTO safeer.ticket_credentials(company_id,ticket_id) SELECT company_id,id FROM safeer.tickets;

CREATE FUNCTION safeer.journey_allowed(cid uuid,tid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT safeer.company_can(cid,'company.journeys.manage') OR (
 safeer.company_can(cid,'company.driver.operate') AND EXISTS(
 SELECT 1 FROM safeer.trip_assignments a JOIN safeer.drivers d ON (d.company_id,d.id)=(a.company_id,a.driver_id)
 JOIN safeer.company_users m ON (m.company_id,m.id)=(d.company_id,d.member_id)
 WHERE a.company_id=cid AND a.trip_id=tid AND a.replaced_at IS NULL AND d.active AND m.active AND m.user_id=safeer.company_actor()))
$$;
CREATE FUNCTION safeer.driver_trips() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('items',coalesce(jsonb_agg(x ORDER BY x->>'departureAt'),'[]'::jsonb)) FROM (
 SELECT jsonb_build_object('id',t.id,'companyId',t.company_id,'companyEn',c.name_en,'companyAr',c.name_ar,'routeEn',t.route_name_en,'routeAr',t.route_name_ar,'departureAt',t.departure_at,'arrivalAt',t.arrival_at,'status',t.status,'bus',a.bus_registration,
 'journey',CASE WHEN EXISTS(SELECT 1 FROM safeer.journey_events j WHERE j.company_id=t.company_id AND j.trip_id=t.id AND j.event='arrived') THEN 'arrived' WHEN EXISTS(SELECT 1 FROM safeer.journey_events j WHERE j.company_id=t.company_id AND j.trip_id=t.id AND j.event='departed') THEN 'departed' ELSE 'scheduled' END) AS x
 FROM safeer.trips t JOIN safeer.companies c ON c.id=t.company_id
 JOIN safeer.trip_assignments a ON (a.company_id,a.trip_id)=(t.company_id,t.id) AND a.replaced_at IS NULL
 WHERE t.status<>'draft' AND safeer.journey_allowed(t.company_id,t.id)
 ) q
$$;
CREATE FUNCTION safeer.driver_manifest(cid uuid,tid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 IF NOT safeer.journey_allowed(cid,tid) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('tripId',t.id,'status',t.status,'departureAt',t.departure_at,'arrivalAt',t.arrival_at,
 'events',coalesce((SELECT jsonb_agg(jsonb_build_object('event',j.event,'at',j.created_at) ORDER BY j.created_at) FROM safeer.journey_events j WHERE j.company_id=cid AND j.trip_id=tid),'[]'::jsonb),
 'incidents',coalesce((SELECT jsonb_agg(jsonb_build_object('id',j.id,'kind',j.kind,'note',CASE WHEN t.arrival_at+interval '90 days'>clock_timestamp() THEN j.note END,'at',j.created_at) ORDER BY j.created_at) FROM safeer.journey_incidents j WHERE j.company_id=cid AND j.trip_id=tid),'[]'::jsonb),
 'passengers',coalesce((SELECT jsonb_agg(jsonb_build_object('ticket',k.ticket_number,'seat',a.label,'name',CASE WHEN c.erase_at>clock_timestamp() THEN p.full_name END,'valid',k.status='valid' AND b.status='confirmed' AND t.status='published','boardedAt',r.boarded_at) ORDER BY a.row_number,a.column_number)
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
CREATE FUNCTION safeer.driver_verify(cid uuid,tid uuid,qr text,board boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE k safeer.tickets%ROWTYPE; t safeer.trips%ROWTYPE; b safeer.bookings%ROWTYPE; seat text; person text; boarded timestamptz;
BEGIN
 SELECT * INTO t FROM safeer.trips WHERE company_id=cid AND id=tid FOR NO KEY UPDATE;
 IF NOT safeer.journey_allowed(cid,tid) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT x.* INTO k FROM safeer.tickets x JOIN safeer.ticket_credentials q ON (q.company_id,q.ticket_id)=(x.company_id,x.id) WHERE q.company_id=cid AND q.value=qr;
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
CREATE FUNCTION safeer.driver_event(cid uuid,tid uuid,kind text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t safeer.trips%ROWTYPE; happened timestamptz;
BEGIN
 SELECT * INTO t FROM safeer.trips WHERE company_id=cid AND id=tid FOR NO KEY UPDATE;
 IF NOT safeer.journey_allowed(cid,tid) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF kind NOT IN ('departed','arrived') OR t.status<>'published' OR t.departure_at>clock_timestamp() THEN RAISE EXCEPTION 'JOURNEY_STATE' USING ERRCODE='P0001'; END IF;
 SELECT created_at INTO happened FROM safeer.journey_events WHERE company_id=cid AND trip_id=tid AND event=kind;
 IF happened IS NOT NULL THEN RETURN jsonb_build_object('event',kind,'at',happened); END IF;
 IF kind='arrived' AND NOT EXISTS(SELECT 1 FROM safeer.journey_events WHERE company_id=cid AND trip_id=tid AND event='departed') THEN RAISE EXCEPTION 'JOURNEY_STATE' USING ERRCODE='P0001'; END IF;
 INSERT INTO safeer.journey_events(company_id,trip_id,event,actor_id) VALUES(cid,tid,kind,safeer.company_actor()) RETURNING created_at INTO happened;
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,safeer.company_actor(),'journey.'||kind,tid);
 RETURN jsonb_build_object('event',kind,'at',happened);
END $$;
CREATE FUNCTION safeer.driver_incident(cid uuid,tid uuid,kind text,note text,p_key text,p_request text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE x safeer.journey_incidents%ROWTYPE;
BEGIN
 PERFORM 1 FROM safeer.trips WHERE company_id=cid AND id=tid AND status<>'draft' FOR NO KEY UPDATE;
 IF NOT FOUND OR NOT safeer.journey_allowed(cid,tid) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO x FROM safeer.journey_incidents WHERE company_id=cid AND key_hash=p_key;
 IF FOUND THEN
  IF x.request_hash<>p_request OR x.trip_id<>tid OR x.actor_id<>safeer.company_actor() THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001'; END IF;
  RETURN jsonb_build_object('id',x.id);
 END IF;
 IF (SELECT count(*) FROM safeer.journey_incidents WHERE company_id=cid AND trip_id=tid)>=100 THEN RAISE EXCEPTION 'CATALOG_LIMIT' USING ERRCODE='P0001'; END IF;
 INSERT INTO safeer.journey_incidents(company_id,trip_id,actor_id,kind,note,key_hash,request_hash) VALUES(cid,tid,safeer.company_actor(),kind,note,p_key,p_request) RETURNING * INTO x;
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,safeer.company_actor(),'journey.incident',x.id);
 RETURN jsonb_build_object('id',x.id);
END $$;
CREATE FUNCTION safeer.ticket_codes(cid uuid,bid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT safeer.company_has(cid,'company.ticketing.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('number',k.ticket_number,'token',q.value)) FROM safeer.tickets k JOIN safeer.ticket_credentials q ON (q.company_id,q.ticket_id)=(k.company_id,k.id)
 JOIN safeer.bookings b ON (b.company_id,b.id)=(k.company_id,k.booking_id) JOIN safeer.trips t ON (t.company_id,t.id)=(b.company_id,b.trip_id)
 WHERE k.company_id=cid AND k.booking_id=bid AND k.status='valid' AND b.status='confirmed' AND t.status='published'),'[]'::jsonb);
END $$;
-- Retain scheduled financial cutoffs. An actual completed trip cannot be canceled to reopen refunds.
CREATE FUNCTION safeer.journey_trip_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_TABLE_NAME='trips' THEN
  IF NEW.status='canceled' AND EXISTS(SELECT 1 FROM safeer.journey_events WHERE company_id=OLD.company_id AND trip_id=OLD.id AND event='arrived') THEN RAISE EXCEPTION 'JOURNEY_STATE' USING ERRCODE='P0001'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM safeer.journey_events WHERE company_id=NEW.company_id AND trip_id=NEW.trip_id) THEN RAISE EXCEPTION 'JOURNEY_STATE' USING ERRCODE='P0001'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER journey_trip_guard BEFORE UPDATE ON safeer.trips FOR EACH ROW EXECUTE FUNCTION safeer.journey_trip_guard();
CREATE TRIGGER journey_assignment_guard BEFORE INSERT OR UPDATE ON safeer.trip_assignments FOR EACH ROW EXECUTE FUNCTION safeer.journey_trip_guard();
-- Erasure piggybacks the existing maintenance function without rewriting its prior body.
ALTER FUNCTION safeer.erase_due_passenger_data() RENAME TO erase_due_passenger_data_before_boarding;
CREATE FUNCTION safeer.erase_due_passenger_data() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer;
BEGIN
 n:=safeer.erase_due_passenger_data_before_boarding();
 UPDATE safeer.journey_incidents i SET note=NULL FROM safeer.trips t WHERE (t.company_id,t.id)=(i.company_id,i.trip_id) AND t.arrival_at+interval '90 days'<=clock_timestamp() AND i.note IS NOT NULL;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION safeer.erase_due_passenger_data_before_boarding(),safeer.erase_due_passenger_data(),safeer.boarding_immutable(),safeer.issue_ticket_credential(),safeer.journey_allowed(uuid,uuid),safeer.driver_trips(),safeer.driver_manifest(uuid,uuid),safeer.driver_verify(uuid,uuid,text,boolean),safeer.driver_event(uuid,uuid,text),safeer.driver_incident(uuid,uuid,text,text,text,text),safeer.ticket_codes(uuid,uuid),safeer.journey_trip_guard() FROM PUBLIC;
