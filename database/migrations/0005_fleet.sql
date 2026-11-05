-- Section 05. Existing company-role copies are deliberately not rewritten.
CREATE TABLE safeer.seat_layouts (
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES safeer.companies(id),
 code varchar(40) NOT NULL CHECK(code ~ '^[A-Z0-9_-]+$'),
 name_en varchar(100) NOT NULL CHECK(length(btrim(name_en))>0),
 name_ar varchar(100) NOT NULL CHECK(length(btrim(name_ar))>0),
 active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 latest_revision integer NOT NULL DEFAULT 1 CHECK(latest_revision>0),
 UNIQUE(company_id,id),UNIQUE(company_id,code)
);
CREATE TABLE safeer.seat_layout_revisions (
 company_id uuid NOT NULL,layout_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),
 row_count integer NOT NULL CHECK(row_count BETWEEN 1 AND 20),column_count integer NOT NULL CHECK(column_count BETWEEN 1 AND 7),
 seat_count integer NOT NULL CHECK(seat_count BETWEEN 1 AND 100),
 created_by uuid NOT NULL REFERENCES safeer.users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,layout_id,revision),
 FOREIGN KEY(company_id,layout_id) REFERENCES safeer.seat_layouts(company_id,id)
);
CREATE TABLE safeer.seat_layout_seats (
 company_id uuid NOT NULL,layout_id uuid NOT NULL,revision integer NOT NULL,
 row_number integer NOT NULL CHECK(row_number BETWEEN 1 AND 20),column_number integer NOT NULL CHECK(column_number BETWEEN 1 AND 7),
 label varchar(8) NOT NULL CHECK(length(btrim(label))>0 AND label=btrim(label)),
 PRIMARY KEY(company_id,layout_id,revision,row_number,column_number),
 FOREIGN KEY(company_id,layout_id,revision) REFERENCES safeer.seat_layout_revisions(company_id,layout_id,revision)
);
CREATE UNIQUE INDEX seat_layout_seats_label ON safeer.seat_layout_seats(company_id,layout_id,revision,lower(label));
CREATE TABLE safeer.buses (
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES safeer.companies(id),
 code varchar(40) NOT NULL CHECK(code ~ '^[A-Z0-9_-]+$'),
 registration varchar(40) NOT NULL CHECK(length(btrim(registration))>0),
 layout_id uuid NOT NULL,layout_revision integer NOT NULL,
 active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(company_id,id),UNIQUE(company_id,code),UNIQUE(company_id,registration),
 FOREIGN KEY(company_id,layout_id,layout_revision) REFERENCES safeer.seat_layout_revisions(company_id,layout_id,revision)
);
CREATE INDEX buses_layout ON safeer.buses(company_id,layout_id,layout_revision);
CREATE TABLE safeer.drivers (
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES safeer.companies(id),
 employee_code varchar(40) NOT NULL CHECK(employee_code ~ '^[A-Z0-9_-]+$'),
 name_en varchar(100) NOT NULL CHECK(length(btrim(name_en))>0),
 name_ar varchar(100) NOT NULL CHECK(length(btrim(name_ar))>0),
 phone varchar(30) CHECK(phone IS NULL OR phone ~ '^[+0-9 ()-]{5,30}$'),
 member_id uuid,active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(company_id,id),UNIQUE(company_id,employee_code),
 FOREIGN KEY(company_id,member_id) REFERENCES safeer.company_users(company_id,id)
);
CREATE INDEX drivers_member ON safeer.drivers(company_id,member_id);
INSERT INTO safeer.permissions(code,module) VALUES ('company.fleet.read','company'),('company.fleet.manage','company'),('company.drivers.read','company'),('company.drivers.manage','company');
INSERT INTO safeer.role_permissions(role_id,permission_code)
 SELECT id,p FROM safeer.roles CROSS JOIN unnest(ARRAY['company.fleet.read','company.fleet.manage','company.drivers.read','company.drivers.manage']) p
 WHERE code='company_administrator';
UPDATE safeer.roles SET version=version+1 WHERE code='company_administrator';
-- company_can() is called without a branch or station, so narrower grants cannot match. Audit inserts need profile read.
CREATE FUNCTION safeer.fleet_manage(cid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT safeer.company_can(cid,'company.fleet.manage') AND safeer.company_can(cid,'company.fleet.read') AND safeer.company_has(cid,'company.profile.read')
$$;
CREATE FUNCTION safeer.driver_manage(cid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT safeer.company_can(cid,'company.drivers.manage') AND safeer.company_can(cid,'company.drivers.read') AND safeer.company_has(cid,'company.profile.read')
$$;
CREATE FUNCTION safeer.fleet_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE latest integer; layout_active boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(94107,hashtext(NEW.company_id::text));
 IF TG_TABLE_NAME='seat_layouts' THEN
  IF TG_OP='INSERT' THEN
   IF NEW.latest_revision<>1 THEN RAISE EXCEPTION 'INVALID_SEAT_LAYOUT' USING ERRCODE='P0001'; END IF;
  ELSE
   IF NEW.code<>OLD.code OR NEW.latest_revision NOT IN (OLD.latest_revision,OLD.latest_revision+1) THEN RAISE EXCEPTION 'INVALID_SEAT_LAYOUT' USING ERRCODE='P0001'; END IF;
   IF OLD.active AND NOT NEW.active AND EXISTS(SELECT 1 FROM safeer.buses b WHERE b.company_id=OLD.company_id AND b.layout_id=OLD.id AND b.active) THEN RAISE EXCEPTION 'LAYOUT_IN_USE' USING ERRCODE='P0001'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='seat_layout_revisions' THEN
  IF (SELECT count(*) FROM safeer.seat_layout_revisions WHERE company_id=NEW.company_id)>=200 THEN RAISE EXCEPTION 'CATALOG_LIMIT' USING ERRCODE='P0001'; END IF;
  SELECT latest_revision INTO latest FROM safeer.seat_layouts WHERE company_id=NEW.company_id AND id=NEW.layout_id;
  IF latest IS DISTINCT FROM NEW.revision THEN RAISE EXCEPTION 'INVALID_SEAT_LAYOUT' USING ERRCODE='P0001'; END IF;
 ELSIF TG_TABLE_NAME='buses' THEN
  IF TG_OP='INSERT' AND (SELECT count(*) FROM safeer.buses WHERE company_id=NEW.company_id)>=200 THEN RAISE EXCEPTION 'CATALOG_LIMIT' USING ERRCODE='P0001'; END IF;
  SELECT active INTO layout_active FROM safeer.seat_layouts WHERE company_id=NEW.company_id AND id=NEW.layout_id;
  IF NEW.active AND layout_active IS FALSE THEN RAISE EXCEPTION 'INACTIVE_LAYOUT' USING ERRCODE='P0001'; END IF;
 ELSIF TG_TABLE_NAME='drivers' THEN
  IF TG_OP='INSERT' AND (SELECT count(*) FROM safeer.drivers WHERE company_id=NEW.company_id)>=200 THEN RAISE EXCEPTION 'CATALOG_LIMIT' USING ERRCODE='P0001'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fleet_guard BEFORE INSERT OR UPDATE ON safeer.seat_layouts FOR EACH ROW EXECUTE FUNCTION safeer.fleet_guard();
CREATE TRIGGER fleet_guard BEFORE INSERT ON safeer.seat_layout_revisions FOR EACH ROW EXECUTE FUNCTION safeer.fleet_guard();
CREATE TRIGGER fleet_guard BEFORE INSERT OR UPDATE ON safeer.buses FOR EACH ROW EXECUTE FUNCTION safeer.fleet_guard();
CREATE TRIGGER fleet_guard BEFORE INSERT OR UPDATE ON safeer.drivers FOR EACH ROW EXECUTE FUNCTION safeer.fleet_guard();
CREATE TRIGGER immutable_ownership BEFORE UPDATE ON safeer.seat_layouts FOR EACH ROW EXECUTE FUNCTION safeer.immutable_company_ownership();
CREATE TRIGGER immutable_ownership BEFORE UPDATE ON safeer.buses FOR EACH ROW EXECUTE FUNCTION safeer.immutable_company_ownership();
CREATE TRIGGER immutable_ownership BEFORE UPDATE ON safeer.drivers FOR EACH ROW EXECUTE FUNCTION safeer.immutable_company_ownership();
-- A revision is sealed when its transaction commits: seats can only join a revision created in the same transaction.
CREATE FUNCTION safeer.seat_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r record;
BEGIN
 SELECT row_count,column_count,xmin::text AS creator INTO r FROM safeer.seat_layout_revisions WHERE company_id=NEW.company_id AND layout_id=NEW.layout_id AND revision=NEW.revision;
 IF NOT FOUND OR r.creator<>(pg_current_xact_id()::xid)::text THEN RAISE EXCEPTION 'IMMUTABLE_REVISION' USING ERRCODE='P0001'; END IF;
 IF NEW.row_number>r.row_count OR NEW.column_number>r.column_count THEN RAISE EXCEPTION 'INVALID_SEAT_LAYOUT' USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER seat_guard BEFORE INSERT ON safeer.seat_layout_seats FOR EACH ROW EXECUTE FUNCTION safeer.seat_guard();
CREATE FUNCTION safeer.reject_revision_change() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_REVISION' USING ERRCODE='P0001'; END $$;
CREATE TRIGGER immutable_revision BEFORE UPDATE OR DELETE ON safeer.seat_layout_revisions FOR EACH ROW EXECUTE FUNCTION safeer.reject_revision_change();
CREATE TRIGGER immutable_revision BEFORE UPDATE OR DELETE ON safeer.seat_layout_seats FOR EACH ROW EXECUTE FUNCTION safeer.reject_revision_change();
CREATE TRIGGER immutable_revision_truncate BEFORE TRUNCATE ON safeer.seat_layout_revisions FOR EACH STATEMENT EXECUTE FUNCTION safeer.reject_revision_change();
CREATE TRIGGER immutable_revision_truncate BEFORE TRUNCATE ON safeer.seat_layout_seats FOR EACH STATEMENT EXECUTE FUNCTION safeer.reject_revision_change();
CREATE FUNCTION safeer.validate_seat_layout() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE lid uuid; target integer; expected integer;
BEGIN
 IF TG_TABLE_NAME='seat_layouts' THEN lid=NEW.id;target=NEW.latest_revision; ELSE lid=NEW.layout_id;target=NEW.revision; END IF;
 SELECT seat_count INTO expected FROM safeer.seat_layout_revisions WHERE company_id=NEW.company_id AND layout_id=lid AND revision=target;
 IF expected IS NULL OR expected<>(SELECT count(*) FROM safeer.seat_layout_seats WHERE company_id=NEW.company_id AND layout_id=lid AND revision=target)
 THEN RAISE EXCEPTION 'INVALID_SEAT_LAYOUT' USING ERRCODE='P0001'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER validate_seat_layout AFTER INSERT OR UPDATE ON safeer.seat_layouts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION safeer.validate_seat_layout();
CREATE CONSTRAINT TRIGGER validate_seat_layout AFTER INSERT ON safeer.seat_layout_revisions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION safeer.validate_seat_layout();
ALTER TABLE safeer.seat_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE safeer.seat_layout_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE safeer.seat_layout_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE safeer.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE safeer.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY layout_read ON safeer.seat_layouts FOR SELECT USING(safeer.company_can(company_id,'company.fleet.read'));
CREATE POLICY layout_insert ON safeer.seat_layouts FOR INSERT WITH CHECK(safeer.fleet_manage(company_id));
CREATE POLICY layout_update ON safeer.seat_layouts FOR UPDATE USING(safeer.fleet_manage(company_id)) WITH CHECK(safeer.fleet_manage(company_id));
CREATE POLICY revision_read ON safeer.seat_layout_revisions FOR SELECT USING(safeer.company_can(company_id,'company.fleet.read'));
CREATE POLICY revision_insert ON safeer.seat_layout_revisions FOR INSERT WITH CHECK(safeer.fleet_manage(company_id));
CREATE POLICY seat_read ON safeer.seat_layout_seats FOR SELECT USING(safeer.company_can(company_id,'company.fleet.read'));
CREATE POLICY seat_insert ON safeer.seat_layout_seats FOR INSERT WITH CHECK(safeer.fleet_manage(company_id));
CREATE POLICY bus_read ON safeer.buses FOR SELECT USING(safeer.company_can(company_id,'company.fleet.read'));
CREATE POLICY bus_insert ON safeer.buses FOR INSERT WITH CHECK(safeer.fleet_manage(company_id));
CREATE POLICY bus_update ON safeer.buses FOR UPDATE USING(safeer.fleet_manage(company_id)) WITH CHECK(safeer.fleet_manage(company_id));
CREATE POLICY driver_read ON safeer.drivers FOR SELECT USING(safeer.company_can(company_id,'company.drivers.read'));
CREATE POLICY driver_insert ON safeer.drivers FOR INSERT WITH CHECK(safeer.driver_manage(company_id));
CREATE POLICY driver_update ON safeer.drivers FOR UPDATE USING(safeer.driver_manage(company_id)) WITH CHECK(safeer.driver_manage(company_id));
REVOKE ALL ON safeer.seat_layouts,safeer.seat_layout_revisions,safeer.seat_layout_seats,safeer.buses,safeer.drivers FROM PUBLIC;
REVOKE ALL ON FUNCTION safeer.fleet_manage(uuid),safeer.driver_manage(uuid),safeer.fleet_guard(),safeer.seat_guard(),safeer.reject_revision_change(),safeer.validate_seat_layout() FROM PUBLIC;
