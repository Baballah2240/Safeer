-- Section 06. Existing company-role copies are deliberately not rewritten.
CREATE TABLE safeer.trips (
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES safeer.companies(id),route_id uuid NOT NULL,
 route_version integer NOT NULL,route_code varchar(40) NOT NULL,route_name_en varchar(100) NOT NULL,route_name_ar varchar(100) NOT NULL,stop_count integer NOT NULL CHECK(stop_count BETWEEN 2 AND 30),
 status varchar(12) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','canceled')),
 timezone varchar(80) NOT NULL,departure_at timestamptz NOT NULL,arrival_at timestamptz NOT NULL,
 fare_minor integer NOT NULL DEFAULT 0 CHECK(fare_minor BETWEEN 0 AND 100000000),currency varchar(3) NOT NULL DEFAULT 'SDG' CHECK(currency ~ '^[A-Z]{3}$'),
 cancel_reason varchar(300),published_at timestamptz,canceled_at timestamptz,created_by uuid NOT NULL REFERENCES safeer.users(id),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 CHECK(arrival_at>departure_at),
 CHECK((status='canceled')=(cancel_reason IS NOT NULL AND canceled_at IS NOT NULL)),
 UNIQUE(company_id,id),FOREIGN KEY(company_id,route_id) REFERENCES safeer.routes(company_id,id)
);
CREATE INDEX trips_departure ON safeer.trips(company_id,departure_at,status);
CREATE INDEX trips_route ON safeer.trips(company_id,route_id);
CREATE TABLE safeer.trip_stops (
 company_id uuid NOT NULL,trip_id uuid NOT NULL,stop_index integer NOT NULL CHECK(stop_index BETWEEN 0 AND 29),
 offset_minutes integer NOT NULL CHECK(offset_minutes BETWEEN 0 AND 10080),
 city_id uuid NOT NULL REFERENCES safeer.cities(id),station_id uuid,
 city_name_en varchar(100) NOT NULL,city_name_ar varchar(100) NOT NULL,station_name_en varchar(100),station_name_ar varchar(100),
 PRIMARY KEY(company_id,trip_id,stop_index),FOREIGN KEY(company_id,trip_id) REFERENCES safeer.trips(company_id,id),
 FOREIGN KEY(company_id,station_id) REFERENCES safeer.stations(company_id,id)
);
CREATE TABLE safeer.trip_assignments (
 id uuid PRIMARY KEY,company_id uuid NOT NULL,trip_id uuid NOT NULL,bus_id uuid NOT NULL,driver_id uuid NOT NULL,
 layout_id uuid NOT NULL,layout_revision integer NOT NULL,seat_count integer NOT NULL,bus_code varchar(40) NOT NULL,bus_registration varchar(40) NOT NULL,
 driver_name_en varchar(100) NOT NULL,driver_name_ar varchar(100) NOT NULL,
 assigned_by uuid NOT NULL REFERENCES safeer.users(id),assigned_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 replaced_at timestamptz,replaced_reason varchar(300),
 CHECK((replaced_at IS NULL)=(replaced_reason IS NULL)),
 FOREIGN KEY(company_id,trip_id) REFERENCES safeer.trips(company_id,id),
 FOREIGN KEY(company_id,bus_id) REFERENCES safeer.buses(company_id,id),
 FOREIGN KEY(company_id,driver_id) REFERENCES safeer.drivers(company_id,id),
 FOREIGN KEY(company_id,layout_id,layout_revision) REFERENCES safeer.seat_layout_revisions(company_id,layout_id,revision)
);
CREATE UNIQUE INDEX trip_assignment_current ON safeer.trip_assignments(company_id,trip_id) WHERE replaced_at IS NULL;
CREATE INDEX trip_assignment_bus ON safeer.trip_assignments(company_id,bus_id) WHERE replaced_at IS NULL;
CREATE INDEX trip_assignment_driver ON safeer.trip_assignments(company_id,driver_id) WHERE replaced_at IS NULL;
INSERT INTO safeer.permissions(code,module) VALUES ('company.trips.read','company'),('company.trips.manage','company');
INSERT INTO safeer.role_permissions(role_id,permission_code)
 SELECT id,p FROM safeer.roles CROSS JOIN unnest(ARRAY['company.trips.read','company.trips.manage']) p
 WHERE code='company_administrator';
UPDATE safeer.roles SET version=version+1 WHERE code='company_administrator';
-- Scheduling reads routes, buses and drivers, so managing trips needs all of those reads company-wide.
CREATE FUNCTION safeer.trip_manage(cid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT safeer.company_can(cid,'company.trips.manage') AND safeer.company_can(cid,'company.trips.read') AND safeer.company_can(cid,'company.routes.read') AND safeer.company_can(cid,'company.fleet.read') AND safeer.company_can(cid,'company.drivers.read') AND safeer.company_has(cid,'company.profile.read')
$$;
-- One bus or driver cannot serve two live trips at once. Canceled trips and replaced assignments release them.
CREATE FUNCTION safeer.assignment_overlaps(cid uuid,tid uuid,bus uuid,driver uuid,leaves timestamptz,arrives timestamptz) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM safeer.trip_assignments a JOIN safeer.trips t ON (t.company_id,t.id)=(a.company_id,a.trip_id)
  WHERE a.company_id=cid AND a.trip_id<>tid AND a.replaced_at IS NULL AND t.status<>'canceled' AND (a.bus_id=bus OR a.driver_id=driver) AND t.departure_at<arrives AND leaves<t.arrival_at)
$$;
CREATE FUNCTION safeer.trip_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r safeer.routes%ROWTYPE; a safeer.trip_assignments%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(94107,hashtext(NEW.company_id::text));
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'draft' THEN RAISE EXCEPTION 'TRIP_NOT_DRAFT' USING ERRCODE='P0001'; END IF;
  IF (SELECT count(*) FROM safeer.trips WHERE company_id=NEW.company_id)>=5000 THEN RAISE EXCEPTION 'CATALOG_LIMIT' USING ERRCODE='P0001'; END IF;
  SELECT * INTO r FROM safeer.routes WHERE company_id=NEW.company_id AND id=NEW.route_id;
  IF NOT FOUND THEN RETURN NEW; END IF; -- The foreign key rejects a route from another company.
  IF NOT r.active THEN RAISE EXCEPTION 'INACTIVE_ROUTE_RESOURCE' USING ERRCODE='P0001'; END IF;
  NEW.route_version=r.version;NEW.route_code=r.code;NEW.route_name_en=r.name_en;NEW.route_name_ar=r.name_ar;
  NEW.stop_count=(SELECT count(*) FROM safeer.route_stops WHERE company_id=NEW.company_id AND route_id=NEW.route_id);
  RETURN NEW;
 END IF;
 IF (NEW.route_id,NEW.route_version,NEW.route_code,NEW.route_name_en,NEW.route_name_ar,NEW.stop_count,NEW.timezone,NEW.created_by) IS DISTINCT FROM (OLD.route_id,OLD.route_version,OLD.route_code,OLD.route_name_en,OLD.route_name_ar,OLD.stop_count,OLD.timezone,OLD.created_by)
 THEN RAISE EXCEPTION 'Immutable trip snapshot' USING ERRCODE='42501'; END IF;
 IF NOT ((OLD.status=NEW.status AND NEW.status<>'canceled') OR (OLD.status='draft' AND NEW.status IN ('published','canceled')) OR (OLD.status='published' AND NEW.status='canceled')) THEN RAISE EXCEPTION 'TRIP_NOT_DRAFT' USING ERRCODE='P0001'; END IF;
 IF OLD.status<>'draft' AND (NEW.departure_at,NEW.arrival_at,NEW.fare_minor,NEW.currency,NEW.published_at) IS DISTINCT FROM (OLD.departure_at,OLD.arrival_at,OLD.fare_minor,OLD.currency,OLD.published_at) THEN RAISE EXCEPTION 'TRIP_NOT_DRAFT' USING ERRCODE='P0001'; END IF;
 SELECT * INTO a FROM safeer.trip_assignments WHERE company_id=NEW.company_id AND trip_id=NEW.id AND replaced_at IS NULL;
 IF NEW.status<>'canceled' AND a.id IS NOT NULL AND safeer.assignment_overlaps(NEW.company_id,NEW.id,a.bus_id,a.driver_id,NEW.departure_at,NEW.arrival_at) THEN RAISE EXCEPTION 'ASSIGNMENT_CONFLICT' USING ERRCODE='P0001'; END IF;
 IF OLD.status='draft' AND NEW.status='published' THEN
  IF a.id IS NULL OR NEW.fare_minor<=0 OR NEW.departure_at<=clock_timestamp()
  OR NOT EXISTS(SELECT 1 FROM safeer.companies WHERE id=NEW.company_id AND status='approved')
  OR NOT EXISTS(SELECT 1 FROM safeer.buses WHERE company_id=NEW.company_id AND id=a.bus_id AND active)
  OR NOT EXISTS(SELECT 1 FROM safeer.drivers WHERE company_id=NEW.company_id AND id=a.driver_id AND active)
  THEN RAISE EXCEPTION 'TRIP_NOT_READY' USING ERRCODE='P0001'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trip_guard BEFORE INSERT OR UPDATE ON safeer.trips FOR EACH ROW EXECUTE FUNCTION safeer.trip_guard();
CREATE TRIGGER immutable_ownership BEFORE UPDATE ON safeer.trips FOR EACH ROW EXECUTE FUNCTION safeer.immutable_company_ownership();
-- Stop details are copied from the route here, so a later route edit cannot rewrite an existing trip.
CREATE FUNCTION safeer.trip_stop_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t safeer.trips%ROWTYPE; s safeer.route_stops%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'TRIP_NOT_DRAFT' USING ERRCODE='P0001'; END IF;
 SELECT * INTO t FROM safeer.trips WHERE company_id=NEW.company_id AND id=NEW.trip_id;
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF t.status<>'draft' THEN RAISE EXCEPTION 'TRIP_NOT_DRAFT' USING ERRCODE='P0001'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (NEW.company_id,NEW.trip_id,NEW.stop_index,NEW.city_id,NEW.station_id,NEW.city_name_en,NEW.city_name_ar,NEW.station_name_en,NEW.station_name_ar) IS DISTINCT FROM (OLD.company_id,OLD.trip_id,OLD.stop_index,OLD.city_id,OLD.station_id,OLD.city_name_en,OLD.city_name_ar,OLD.station_name_en,OLD.station_name_ar) THEN RAISE EXCEPTION 'Immutable trip snapshot' USING ERRCODE='42501'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO s FROM safeer.route_stops WHERE company_id=NEW.company_id AND route_id=t.route_id AND stop_index=NEW.stop_index;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_TRIP_STOPS' USING ERRCODE='P0001'; END IF;
 NEW.city_id=s.city_id;NEW.station_id=s.station_id;
 SELECT name_en,name_ar INTO NEW.city_name_en,NEW.city_name_ar FROM safeer.cities WHERE id=s.city_id;
 SELECT name_en,name_ar INTO NEW.station_name_en,NEW.station_name_ar FROM safeer.stations WHERE company_id=NEW.company_id AND id=s.station_id;
 RETURN NEW;
END $$;
CREATE TRIGGER trip_stop_guard BEFORE INSERT OR UPDATE OR DELETE ON safeer.trip_stops FOR EACH ROW EXECUTE FUNCTION safeer.trip_stop_guard();
CREATE FUNCTION safeer.validate_trip() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t safeer.trips%ROWTYPE; n integer; first_offset integer; last_offset integer; ordered boolean;
BEGIN
 IF TG_TABLE_NAME='trips' THEN SELECT * INTO t FROM safeer.trips WHERE company_id=NEW.company_id AND id=NEW.id;
 ELSE SELECT * INTO t FROM safeer.trips WHERE company_id=NEW.company_id AND id=NEW.trip_id; END IF;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT count(*),min(offset_minutes),max(offset_minutes),COALESCE(bool_and(step),true) INTO n,first_offset,last_offset,ordered FROM (
  SELECT offset_minutes,offset_minutes>lag(offset_minutes,1,-1) OVER (ORDER BY stop_index) AS step FROM safeer.trip_stops WHERE company_id=t.company_id AND trip_id=t.id) s;
 IF n<>t.stop_count OR first_offset<>0 OR NOT ordered OR t.arrival_at<>t.departure_at+make_interval(mins=>last_offset) THEN RAISE EXCEPTION 'INVALID_TRIP_STOPS' USING ERRCODE='P0001'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER validate_trip AFTER INSERT OR UPDATE ON safeer.trips DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION safeer.validate_trip();
CREATE CONSTRAINT TRIGGER validate_trip AFTER INSERT OR UPDATE ON safeer.trip_stops DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION safeer.validate_trip();
-- The bus, seat revision and driver name are copied as assigned, and history is only ever closed, never rewritten.
CREATE FUNCTION safeer.trip_assignment_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t safeer.trips%ROWTYPE; b safeer.buses%ROWTYPE; d safeer.drivers%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Immutable assignment history' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.replaced_at IS NOT NULL OR (to_jsonb(NEW)-'replaced_at'-'replaced_reason') IS DISTINCT FROM (to_jsonb(OLD)-'replaced_at'-'replaced_reason') THEN RAISE EXCEPTION 'Immutable assignment history' USING ERRCODE='42501'; END IF;
  RETURN NEW;
 END IF;
 PERFORM pg_advisory_xact_lock(94107,hashtext(NEW.company_id::text));
 SELECT * INTO t FROM safeer.trips WHERE company_id=NEW.company_id AND id=NEW.trip_id;
 SELECT * INTO b FROM safeer.buses WHERE company_id=NEW.company_id AND id=NEW.bus_id;
 SELECT * INTO d FROM safeer.drivers WHERE company_id=NEW.company_id AND id=NEW.driver_id;
 IF t.id IS NULL OR b.id IS NULL OR d.id IS NULL THEN RETURN NEW; END IF; -- Foreign keys reject other companies' records.
 IF t.status='canceled' THEN RAISE EXCEPTION 'TRIP_NOT_DRAFT' USING ERRCODE='P0001'; END IF;
 IF NOT b.active OR NOT d.active THEN RAISE EXCEPTION 'INACTIVE_ASSIGNMENT' USING ERRCODE='P0001'; END IF;
 IF safeer.assignment_overlaps(NEW.company_id,NEW.trip_id,NEW.bus_id,NEW.driver_id,t.departure_at,t.arrival_at) THEN RAISE EXCEPTION 'ASSIGNMENT_CONFLICT' USING ERRCODE='P0001'; END IF;
 NEW.layout_id=b.layout_id;NEW.layout_revision=b.layout_revision;NEW.bus_code=b.code;NEW.bus_registration=b.registration;NEW.driver_name_en=d.name_en;NEW.driver_name_ar=d.name_ar;
 NEW.seat_count=(SELECT seat_count FROM safeer.seat_layout_revisions WHERE company_id=b.company_id AND layout_id=b.layout_id AND revision=b.layout_revision);
 RETURN NEW;
END $$;
CREATE TRIGGER trip_assignment_guard BEFORE INSERT OR UPDATE OR DELETE ON safeer.trip_assignments FOR EACH ROW EXECUTE FUNCTION safeer.trip_assignment_guard();
CREATE FUNCTION safeer.trip_resource_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(94107,hashtext(NEW.company_id::text));
 IF OLD.active AND NOT NEW.active AND EXISTS(SELECT 1 FROM safeer.trip_assignments a JOIN safeer.trips t ON (t.company_id,t.id)=(a.company_id,a.trip_id)
  WHERE a.company_id=OLD.company_id AND a.replaced_at IS NULL AND t.status<>'canceled' AND t.arrival_at>clock_timestamp() AND ((TG_TABLE_NAME='buses' AND a.bus_id=OLD.id) OR (TG_TABLE_NAME='drivers' AND a.driver_id=OLD.id)))
 THEN RAISE EXCEPTION 'TRIP_RESOURCE_IN_USE' USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trip_resource_guard BEFORE UPDATE ON safeer.buses FOR EACH ROW EXECUTE FUNCTION safeer.trip_resource_guard();
CREATE TRIGGER trip_resource_guard BEFORE UPDATE ON safeer.drivers FOR EACH ROW EXECUTE FUNCTION safeer.trip_resource_guard();
ALTER TABLE safeer.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE safeer.trip_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE safeer.trip_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY trip_read ON safeer.trips FOR SELECT USING(safeer.company_can(company_id,'company.trips.read'));
CREATE POLICY trip_insert ON safeer.trips FOR INSERT WITH CHECK(safeer.trip_manage(company_id));
CREATE POLICY trip_update ON safeer.trips FOR UPDATE USING(safeer.trip_manage(company_id)) WITH CHECK(safeer.trip_manage(company_id));
CREATE POLICY trip_stop_read ON safeer.trip_stops FOR SELECT USING(safeer.company_can(company_id,'company.trips.read'));
CREATE POLICY trip_stop_insert ON safeer.trip_stops FOR INSERT WITH CHECK(safeer.trip_manage(company_id));
CREATE POLICY trip_stop_update ON safeer.trip_stops FOR UPDATE USING(safeer.trip_manage(company_id)) WITH CHECK(safeer.trip_manage(company_id));
CREATE POLICY trip_assignment_read ON safeer.trip_assignments FOR SELECT USING(safeer.company_can(company_id,'company.trips.read'));
CREATE POLICY trip_assignment_insert ON safeer.trip_assignments FOR INSERT WITH CHECK(safeer.trip_manage(company_id));
CREATE POLICY trip_assignment_update ON safeer.trip_assignments FOR UPDATE USING(safeer.trip_manage(company_id)) WITH CHECK(safeer.trip_manage(company_id));
REVOKE ALL ON safeer.trips,safeer.trip_stops,safeer.trip_assignments FROM PUBLIC;
REVOKE ALL ON FUNCTION safeer.trip_manage(uuid),safeer.assignment_overlaps(uuid,uuid,uuid,uuid,timestamptz,timestamptz),safeer.trip_guard(),safeer.trip_stop_guard(),safeer.validate_trip(),safeer.trip_assignment_guard(),safeer.trip_resource_guard() FROM PUBLIC;
