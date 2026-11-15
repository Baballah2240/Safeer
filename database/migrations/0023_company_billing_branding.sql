-- D82: Safeer charges each company a monthly fee plus a commission. Only a Super Administrator sets the plan;
-- every saved plan issues a numbered contract (an unchangeable snapshot) that the company's managers and the
-- Safeer owner both receive in their notification center as a PDF. A company manager accepts it once.
-- Each company also keeps its own brand colors and logo, shown in its workspace and on its public page.
CREATE TABLE safeer.company_billing_plans (
 company_id uuid PRIMARY KEY REFERENCES safeer.companies(id),
 monthly_fee_minor bigint NOT NULL CHECK(monthly_fee_minor BETWEEN 0 AND 100000000000),
 commission_bps integer NOT NULL CHECK(commission_bps BETWEEN 0 AND 5000),
 currency char(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 starts_on date NOT NULL,
 notes varchar(500) NOT NULL DEFAULT '' CHECK(notes !~ '[[:cntrl:]]'),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_by uuid NOT NULL REFERENCES safeer.users(id)
);
CREATE SEQUENCE safeer.company_contract_number;
REVOKE ALL ON SEQUENCE safeer.company_contract_number FROM PUBLIC;
CREATE TABLE safeer.company_contracts (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES safeer.companies(id),
 number varchar(20) NOT NULL UNIQUE,
 plan_version integer NOT NULL CHECK(plan_version>0),
 company_name_en varchar(100) NOT NULL,company_name_ar varchar(100) NOT NULL,
 contact_email varchar(254) NOT NULL DEFAULT '',phone varchar(40) NOT NULL DEFAULT '',address varchar(300) NOT NULL DEFAULT '',
 monthly_fee_minor bigint NOT NULL CHECK(monthly_fee_minor>=0),
 commission_bps integer NOT NULL CHECK(commission_bps BETWEEN 0 AND 5000),
 currency char(3) NOT NULL,starts_on date NOT NULL,notes varchar(500) NOT NULL DEFAULT '',
 issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 issued_by uuid NOT NULL REFERENCES safeer.users(id),issued_by_name varchar(100) NOT NULL,
 accepted_at timestamptz,accepted_by uuid REFERENCES safeer.users(id),accepted_by_name varchar(100),
 superseded_at timestamptz,
 UNIQUE(company_id,plan_version),
 CHECK((accepted_at IS NULL)=(accepted_by IS NULL) AND (accepted_at IS NULL)=(accepted_by_name IS NULL))
);
CREATE INDEX company_contracts_recent ON safeer.company_contracts(company_id,issued_at DESC);
CREATE TABLE safeer.company_branding (
 company_id uuid PRIMARY KEY REFERENCES safeer.companies(id),
 primary_color char(7) CHECK(primary_color ~ '^#[0-9a-f]{6}$'),
 secondary_color char(7) CHECK(secondary_color ~ '^#[0-9a-f]{6}$'),
 logo_type varchar(20) CHECK(logo_type IN ('image/png','image/jpeg','image/webp')),
 logo bytea CHECK(octet_length(logo) BETWEEN 1 AND 98304),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 CHECK((logo IS NULL)=(logo_type IS NULL))
);
ALTER TABLE safeer.company_billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE safeer.company_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE safeer.company_branding ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON safeer.company_billing_plans,safeer.company_contracts,safeer.company_branding FROM PUBLIC;
-- Billing is visible to the Safeer owner and to people who manage the company profile; only the owner writes it.
CREATE POLICY billing_read ON safeer.company_billing_plans FOR SELECT USING(safeer.company_super() OR safeer.company_can(company_id,'company.profile.manage'));
CREATE POLICY billing_insert ON safeer.company_billing_plans FOR INSERT WITH CHECK(safeer.company_super());
CREATE POLICY billing_update ON safeer.company_billing_plans FOR UPDATE USING(safeer.company_super()) WITH CHECK(safeer.company_super());
CREATE POLICY contract_read ON safeer.company_contracts FOR SELECT USING(safeer.company_super() OR safeer.company_can(company_id,'company.profile.manage'));
CREATE POLICY contract_insert ON safeer.company_contracts FOR INSERT WITH CHECK(safeer.company_super());
CREATE POLICY contract_update ON safeer.company_contracts FOR UPDATE USING(safeer.company_super() OR safeer.company_can(company_id,'company.profile.manage')) WITH CHECK(safeer.company_super() OR safeer.company_can(company_id,'company.profile.manage'));
CREATE POLICY branding_read ON safeer.company_branding FOR SELECT USING(safeer.company_has(company_id,'company.profile.read'));
CREATE POLICY branding_insert ON safeer.company_branding FOR INSERT WITH CHECK(safeer.company_can(company_id,'company.profile.manage'));
CREATE POLICY branding_update ON safeer.company_branding FOR UPDATE USING(safeer.company_can(company_id,'company.profile.manage')) WITH CHECK(safeer.company_can(company_id,'company.profile.manage'));
CREATE TRIGGER immutable_ownership BEFORE UPDATE ON safeer.company_billing_plans FOR EACH ROW EXECUTE FUNCTION safeer.immutable_company_ownership();
CREATE TRIGGER immutable_ownership BEFORE UPDATE ON safeer.company_branding FOR EACH ROW EXECUTE FUNCTION safeer.immutable_company_ownership();

-- A contract is a fixed record: its number comes from the database, its terms never change, a company member
-- who manages the profile (never the Safeer owner, who issued it) accepts it once, and only the Safeer owner marks
-- it replaced by a newer one.
CREATE FUNCTION safeer.contract_number() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 NEW.number:='SAF-'||to_char(NEW.issued_at AT TIME ZONE 'UTC','YYYY')||'-'||lpad(nextval('safeer.company_contract_number')::text,5,'0');
 NEW.accepted_at:=NULL;NEW.accepted_by:=NULL;NEW.accepted_by_name:=NULL;NEW.superseded_at:=NULL;
 RETURN NEW;
END $$;
CREATE FUNCTION safeer.contract_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE fixed text[]:=ARRAY['accepted_at','accepted_by','accepted_by_name','superseded_at'];
BEGIN
 IF (to_jsonb(NEW)-fixed) IS DISTINCT FROM (to_jsonb(OLD)-fixed) THEN RAISE EXCEPTION 'Contract terms are fixed' USING ERRCODE='42501'; END IF;
 IF NEW.superseded_at IS DISTINCT FROM OLD.superseded_at AND (OLD.superseded_at IS NOT NULL OR NOT safeer.company_super()) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF (NEW.accepted_at,NEW.accepted_by,NEW.accepted_by_name) IS DISTINCT FROM (OLD.accepted_at,OLD.accepted_by,OLD.accepted_by_name) THEN
  IF OLD.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'CONTRACT_ACCEPTED'; END IF;
  IF OLD.superseded_at IS NOT NULL THEN RAISE EXCEPTION 'CONTRACT_SUPERSEDED'; END IF;
  IF safeer.company_super() OR NEW.accepted_by IS DISTINCT FROM safeer.company_actor() OR NOT EXISTS(SELECT 1 FROM safeer.company_users m WHERE m.company_id=NEW.company_id AND m.user_id=NEW.accepted_by AND m.active) OR NOT safeer.company_can(NEW.company_id,'company.profile.manage') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER contract_number BEFORE INSERT ON safeer.company_contracts FOR EACH ROW EXECUTE FUNCTION safeer.contract_number();
CREATE TRIGGER contract_guard BEFORE UPDATE ON safeer.company_contracts FOR EACH ROW EXECUTE FUNCTION safeer.contract_guard();

-- Both parties receive each contract, and the acceptance, in the notification center.
ALTER TABLE safeer.notification_events DROP CONSTRAINT notification_events_code_check;
ALTER TABLE safeer.notification_events ADD CONSTRAINT notification_events_code_check CHECK(code IN ('company.registered','company.status','marketplace.changed','trip.canceled','journey.incident','cash.difference','luggage.exception','contract.issued','contract.accepted'));
CREATE FUNCTION safeer.contract_notice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='INSERT' THEN INSERT INTO safeer.notification_events(company_id,code,source_id) VALUES(NEW.company_id,'contract.issued',NEW.id) ON CONFLICT DO NOTHING;
 ELSIF NEW.accepted_at IS NOT NULL AND OLD.accepted_at IS NULL THEN INSERT INTO safeer.notification_events(company_id,code,source_id) VALUES(NEW.company_id,'contract.accepted',NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER contract_notice AFTER INSERT OR UPDATE ON safeer.company_contracts FOR EACH ROW EXECUTE FUNCTION safeer.contract_notice();
CREATE OR REPLACE FUNCTION safeer.notification_visible(n safeer.notification_events) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF safeer.company_actor() IS NULL OR n.created_at<statement_timestamp()-interval '90 days' THEN RETURN false; END IF;
 IF safeer.company_super() THEN RETURN true; END IF;
 -- D82: contracts reach the company's profile managers (company_can: approved companies only).
 IF n.code IN ('contract.issued','contract.accepted') THEN RETURN safeer.company_can(n.company_id,'company.profile.manage'); END IF;
 IF NOT EXISTS(SELECT 1 FROM safeer.companies WHERE id=n.company_id AND status='approved') THEN RETURN false; END IF;
 CASE n.code
 WHEN 'trip.canceled' THEN RETURN safeer.company_can(n.company_id,'company.trips.read') OR safeer.journey_allowed(n.company_id,n.source_id);
 WHEN 'journey.incident' THEN RETURN safeer.company_can(n.company_id,'company.journeys.manage');
 WHEN 'cash.difference' THEN RETURN EXISTS(SELECT 1 FROM safeer.cash_sessions s WHERE s.company_id=n.company_id AND s.id=n.source_id AND safeer.company_can(n.company_id,'company.finance.read',s.branch_id,s.station_id));
 WHEN 'luggage.exception' THEN RETURN safeer.company_can(n.company_id,'company.luggage.resolve');
 ELSE RETURN false;
 END CASE;
END $$;

-- Passengers see a listed, approved company's colors and logo only.
CREATE FUNCTION safeer.public_company_brand(p_slug text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('primaryColor',b.primary_color,'secondaryColor',b.secondary_color,'logoVersion',CASE WHEN b.logo IS NOT NULL THEN b.version END)
 FROM safeer.companies co JOIN safeer.company_public_profiles p ON p.company_id=co.id AND p.listed JOIN safeer.company_branding b ON b.company_id=co.id
 WHERE co.slug=p_slug AND co.status='approved'
$$;
CREATE FUNCTION safeer.public_company_logo(p_slug text) RETURNS TABLE(logo_type text,logo bytea) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT b.logo_type::text,b.logo FROM safeer.companies co JOIN safeer.company_public_profiles p ON p.company_id=co.id AND p.listed JOIN safeer.company_branding b ON b.company_id=co.id
 WHERE co.slug=p_slug AND co.status='approved' AND b.logo IS NOT NULL
$$;
REVOKE ALL ON FUNCTION safeer.contract_number(),safeer.contract_guard(),safeer.contract_notice(),safeer.public_company_brand(text),safeer.public_company_logo(text) FROM PUBLIC;
