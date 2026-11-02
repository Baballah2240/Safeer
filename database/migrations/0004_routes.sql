-- Section 04. Preserve all existing station IDs, users and role copies.
CREATE TABLE safeer.cities (
 id uuid PRIMARY KEY,code varchar(40) NOT NULL UNIQUE CHECK(code ~ '^[A-Z0-9_-]+$'),
 name_en varchar(100) NOT NULL CHECK(length(btrim(name_en))>0),
 name_ar varchar(100) NOT NULL CHECK(length(btrim(name_ar))>0),
 country_code varchar(2) NOT NULL DEFAULT 'SD' CHECK(country_code ~ '^[A-Z]{2}$'),
 active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1 CHECK(version>0)
);
ALTER TABLE safeer.stations ADD COLUMN city_id uuid REFERENCES safeer.cities(id);
ALTER TABLE safeer.stations ADD CONSTRAINT stations_city_key UNIQUE(company_id,id,city_id);
CREATE INDEX stations_city ON safeer.stations(city_id);
CREATE TABLE safeer.routes (
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES safeer.companies(id),
 code varchar(40) NOT NULL CHECK(code ~ '^[A-Z0-9_-]+$'),
 name_en varchar(100) NOT NULL CHECK(length(btrim(name_en))>0),
 name_ar varchar(100) NOT NULL CHECK(length(btrim(name_ar))>0),
 origin_city_id uuid NOT NULL REFERENCES safeer.cities(id),destination_city_id uuid NOT NULL REFERENCES safeer.cities(id),
 active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 CHECK(origin_city_id<>destination_city_id),UNIQUE(company_id,id),UNIQUE(company_id,code)
);
CREATE INDEX routes_endpoints ON safeer.routes(company_id,origin_city_id,destination_city_id);
CREATE TABLE safeer.route_stops (
 company_id uuid NOT NULL,route_id uuid NOT NULL,stop_index integer NOT NULL CHECK(stop_index BETWEEN 0 AND 29),
 city_id uuid NOT NULL REFERENCES safeer.cities(id),station_id uuid,
 PRIMARY KEY(company_id,route_id,stop_index),
 UNIQUE NULLS NOT DISTINCT(company_id,route_id,city_id,station_id),
 FOREIGN KEY(company_id,route_id) REFERENCES safeer.routes(company_id,id),
 FOREIGN KEY(company_id,station_id,city_id) REFERENCES safeer.stations(company_id,id,city_id)
);
CREATE INDEX route_stops_station ON safeer.route_stops(company_id,station_id,city_id);
CREATE INDEX route_stops_city ON safeer.route_stops(city_id);
INSERT INTO safeer.permissions(code,module) VALUES ('company.routes.read','company'),('company.routes.manage','company');
INSERT INTO safeer.role_permissions(role_id,permission_code)
 SELECT id,p FROM safeer.roles CROSS JOIN unnest(ARRAY['company.routes.read','company.routes.manage']) p
 WHERE code='company_administrator';
UPDATE safeer.roles SET version=version+1 WHERE code='company_administrator';
-- Existing company-role copies are deliberately not rewritten.
ALTER TABLE safeer.support_access_grant_permissions DROP CONSTRAINT support_access_grant_permissions_permission_code_check;
ALTER TABLE safeer.support_access_grant_permissions ADD CONSTRAINT support_access_grant_permissions_permission_code_check
 CHECK(permission_code IN ('company.profile.read','company.resources.read','company.audit.read','company.routes.read'));
CREATE FUNCTION safeer.route_manage(cid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT safeer.company_can(cid,'company.routes.manage') AND safeer.company_can(cid,'company.routes.read') AND safeer.company_can(cid,'company.resources.read')
$$;
CREATE FUNCTION safeer.route_resource_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(94106,2);
 IF TG_TABLE_NAME='cities' THEN
  IF TG_OP='INSERT' AND (SELECT count(*) FROM safeer.cities)>=1000 THEN RAISE EXCEPTION 'CATALOG_LIMIT' USING ERRCODE='P0001'; END IF;
  IF TG_OP='UPDATE' THEN
   IF NEW.id<>OLD.id THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='P0001'; END IF;
   IF OLD.active AND NOT NEW.active AND EXISTS(SELECT 1 FROM safeer.route_stops s JOIN safeer.routes r ON (r.company_id,r.id)=(s.company_id,s.route_id) WHERE s.city_id=OLD.id AND r.active) THEN RAISE EXCEPTION 'RESOURCE_IN_USE' USING ERRCODE='P0001'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='stations' THEN
  IF NEW.city_id IS DISTINCT FROM OLD.city_id AND EXISTS(SELECT 1 FROM safeer.route_stops WHERE company_id=OLD.company_id AND station_id=OLD.id) THEN RAISE EXCEPTION 'STATION_CITY_IN_USE' USING ERRCODE='P0001'; END IF;
  IF OLD.active AND NOT NEW.active AND EXISTS(SELECT 1 FROM safeer.route_stops s JOIN safeer.routes r ON (r.company_id,r.id)=(s.company_id,s.route_id) WHERE s.company_id=OLD.company_id AND s.station_id=OLD.id AND r.active) THEN RAISE EXCEPTION 'RESOURCE_IN_USE' USING ERRCODE='P0001'; END IF;
 ELSIF TG_TABLE_NAME='branches' THEN
  IF OLD.active AND NOT NEW.active AND EXISTS(SELECT 1 FROM safeer.route_stops s JOIN safeer.routes r ON (r.company_id,r.id)=(s.company_id,s.route_id) JOIN safeer.stations st ON (st.company_id,st.id)=(s.company_id,s.station_id) WHERE st.company_id=OLD.company_id AND st.branch_id=OLD.id AND r.active) THEN RAISE EXCEPTION 'RESOURCE_IN_USE' USING ERRCODE='P0001'; END IF;
 ELSIF TG_TABLE_NAME='routes' AND TG_OP='INSERT' THEN
  IF (SELECT count(*) FROM safeer.routes WHERE company_id=NEW.company_id)>=500 THEN RAISE EXCEPTION 'CATALOG_LIMIT' USING ERRCODE='P0001'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER route_resource_guard BEFORE INSERT OR UPDATE ON safeer.cities FOR EACH ROW EXECUTE FUNCTION safeer.route_resource_guard();
CREATE TRIGGER route_resource_guard BEFORE UPDATE ON safeer.stations FOR EACH ROW EXECUTE FUNCTION safeer.route_resource_guard();
CREATE TRIGGER route_resource_guard BEFORE UPDATE ON safeer.branches FOR EACH ROW EXECUTE FUNCTION safeer.route_resource_guard();
CREATE TRIGGER route_resource_guard BEFORE INSERT OR UPDATE ON safeer.routes FOR EACH ROW EXECUTE FUNCTION safeer.route_resource_guard();
CREATE TRIGGER immutable_ownership BEFORE UPDATE ON safeer.routes FOR EACH ROW EXECUTE FUNCTION safeer.immutable_company_ownership();
CREATE FUNCTION safeer.validate_route() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE rid uuid; cid uuid; r safeer.routes%ROWTYPE; n integer; first_city uuid; last_city uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(94106,2);
 IF TG_TABLE_NAME='route_stops' THEN rid=COALESCE(NEW.route_id,OLD.route_id);cid=COALESCE(NEW.company_id,OLD.company_id);
 ELSE rid=NEW.id;cid=NEW.company_id; END IF;
 SELECT * INTO r FROM safeer.routes WHERE company_id=cid AND id=rid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT count(*) INTO n FROM safeer.route_stops WHERE company_id=cid AND route_id=rid;
 SELECT city_id INTO first_city FROM safeer.route_stops WHERE company_id=cid AND route_id=rid AND stop_index=0;
 SELECT city_id INTO last_city FROM safeer.route_stops WHERE company_id=cid AND route_id=rid AND stop_index=n-1;
 IF n<2 OR n>30 OR first_city IS DISTINCT FROM r.origin_city_id OR last_city IS DISTINCT FROM r.destination_city_id
 OR (SELECT max(stop_index) FROM safeer.route_stops WHERE company_id=cid AND route_id=rid)<>n-1
 THEN RAISE EXCEPTION 'INVALID_ROUTE_STOPS' USING ERRCODE='P0001'; END IF;
 IF r.active AND EXISTS(SELECT 1 FROM safeer.route_stops s JOIN safeer.cities c ON c.id=s.city_id LEFT JOIN safeer.stations st ON (st.company_id,st.id)=(s.company_id,s.station_id) LEFT JOIN safeer.branches b ON (b.company_id,b.id)=(st.company_id,st.branch_id)
 WHERE s.company_id=cid AND s.route_id=rid AND (NOT c.active OR (s.station_id IS NOT NULL AND (NOT st.active OR NOT b.active))))
 THEN RAISE EXCEPTION 'INACTIVE_ROUTE_RESOURCE' USING ERRCODE='P0001'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER validate_route AFTER INSERT OR UPDATE ON safeer.routes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION safeer.validate_route();
CREATE CONSTRAINT TRIGGER validate_route AFTER INSERT OR UPDATE OR DELETE ON safeer.route_stops DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION safeer.validate_route();
ALTER TABLE safeer.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE safeer.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE safeer.route_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY city_read ON safeer.cities FOR SELECT USING(safeer.company_actor() IS NOT NULL);
CREATE POLICY city_insert ON safeer.cities FOR INSERT WITH CHECK(safeer.company_super());
CREATE POLICY city_update ON safeer.cities FOR UPDATE USING(safeer.company_super()) WITH CHECK(safeer.company_super());
CREATE POLICY route_read ON safeer.routes FOR SELECT USING(safeer.company_can(company_id,'company.routes.read'));
CREATE POLICY route_insert ON safeer.routes FOR INSERT WITH CHECK(safeer.route_manage(company_id));
CREATE POLICY route_update ON safeer.routes FOR UPDATE USING(safeer.route_manage(company_id)) WITH CHECK(safeer.route_manage(company_id));
CREATE POLICY stop_read ON safeer.route_stops FOR SELECT USING(safeer.company_can(company_id,'company.routes.read'));
CREATE POLICY stop_insert ON safeer.route_stops FOR INSERT WITH CHECK(safeer.route_manage(company_id));
CREATE POLICY stop_delete ON safeer.route_stops FOR DELETE USING(safeer.route_manage(company_id));
REVOKE ALL ON safeer.cities,safeer.routes,safeer.route_stops FROM PUBLIC;
REVOKE ALL ON FUNCTION safeer.route_manage(uuid),safeer.route_resource_guard(),safeer.validate_route() FROM PUBLIC;
