-- Section 03. Existing migrations remain immutable.
CREATE TABLE safeer.companies (
 id uuid PRIMARY KEY,
 slug varchar(60) NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name_en varchar(100) NOT NULL CHECK(length(btrim(name_en))>0),
 name_ar varchar(100) NOT NULL CHECK(length(btrim(name_ar))>0),
 status varchar(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','suspended','archived')),
 contact_email varchar(254) NOT NULL DEFAULT '', phone varchar(40) NOT NULL DEFAULT '', address varchar(300) NOT NULL DEFAULT '',
 version integer NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE safeer.company_settings (
 company_id uuid PRIMARY KEY REFERENCES safeer.companies(id),
 hold_minutes integer NOT NULL DEFAULT 30 CHECK(hold_minutes BETWEEN 5 AND 1440),
 timezone varchar(80) NOT NULL DEFAULT 'Africa/Khartoum', locale varchar(2) NOT NULL DEFAULT 'en' CHECK(locale IN ('en','ar'))
);
CREATE TABLE safeer.branches (
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES safeer.companies(id),code varchar(40) NOT NULL,
 name_en varchar(100) NOT NULL CHECK(length(btrim(name_en))>0),name_ar varchar(100) NOT NULL CHECK(length(btrim(name_ar))>0),
 active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(company_id,id),UNIQUE(company_id,code)
);
CREATE TABLE safeer.stations (
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES safeer.companies(id),branch_id uuid NOT NULL,
 code varchar(40) NOT NULL,name_en varchar(100) NOT NULL CHECK(length(btrim(name_en))>0),name_ar varchar(100) NOT NULL CHECK(length(btrim(name_ar))>0),
 address varchar(300) NOT NULL DEFAULT '',active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(company_id,id),UNIQUE(company_id,branch_id,id),UNIQUE(company_id,code),
 FOREIGN KEY(company_id,branch_id) REFERENCES safeer.branches(company_id,id)
);
CREATE INDEX stations_branch ON safeer.stations(company_id,branch_id);
CREATE TABLE safeer.company_roles (
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES safeer.companies(id),code varchar(80) NOT NULL,
 display_name varchar(100) NOT NULL CHECK(length(btrim(display_name))>0),
 scope varchar(20) NOT NULL CHECK(scope IN ('company','branch','station')),
 active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(company_id,id),UNIQUE(company_id,id,scope),UNIQUE(company_id,code)
);
CREATE TABLE safeer.company_role_permissions (
 company_id uuid NOT NULL,role_id uuid NOT NULL,permission_code varchar(80) NOT NULL REFERENCES safeer.permissions(code),
 PRIMARY KEY(company_id,role_id,permission_code),
 CHECK(permission_code LIKE 'company.%'),
 FOREIGN KEY(company_id,role_id) REFERENCES safeer.company_roles(company_id,id)
);
CREATE TABLE safeer.company_users (
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES safeer.companies(id),user_id uuid NOT NULL REFERENCES safeer.users(id),
 display_name varchar(100) NOT NULL CHECK(length(btrim(display_name))>0),active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),UNIQUE(company_id,id),UNIQUE(company_id,user_id)
);
CREATE INDEX company_users_user ON safeer.company_users(user_id,company_id);
CREATE TABLE safeer.company_user_roles (
 id uuid PRIMARY KEY,company_id uuid NOT NULL,member_id uuid NOT NULL,role_id uuid NOT NULL,scope varchar(20) NOT NULL,
 branch_id uuid,station_id uuid,
 CHECK((scope='company' AND branch_id IS NULL AND station_id IS NULL) OR (scope='branch' AND branch_id IS NOT NULL AND station_id IS NULL) OR (scope='station' AND branch_id IS NOT NULL AND station_id IS NOT NULL)),
 FOREIGN KEY(company_id,member_id) REFERENCES safeer.company_users(company_id,id),
 FOREIGN KEY(company_id,role_id,scope) REFERENCES safeer.company_roles(company_id,id,scope),
 FOREIGN KEY(company_id,branch_id) REFERENCES safeer.branches(company_id,id),
 FOREIGN KEY(company_id,branch_id,station_id) REFERENCES safeer.stations(company_id,branch_id,id),
 UNIQUE NULLS NOT DISTINCT(company_id,member_id,role_id,branch_id,station_id)
);
CREATE INDEX company_user_roles_member ON safeer.company_user_roles(company_id,member_id);
CREATE INDEX company_user_roles_role ON safeer.company_user_roles(company_id,role_id);
CREATE INDEX company_user_roles_resource ON safeer.company_user_roles(company_id,branch_id,station_id);
CREATE TABLE safeer.support_access_grants (
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES safeer.companies(id),support_user_id uuid NOT NULL REFERENCES safeer.users(id),
 approved_by uuid NOT NULL REFERENCES safeer.users(id),reason varchar(300) NOT NULL CHECK(length(btrim(reason))>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL,revoked_at timestamptz,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '24 hours'),UNIQUE(company_id,id)
);
CREATE INDEX support_grants_actor ON safeer.support_access_grants(support_user_id,company_id,expires_at);
CREATE TABLE safeer.support_access_grant_permissions (
 company_id uuid NOT NULL,grant_id uuid NOT NULL,permission_code varchar(80) NOT NULL REFERENCES safeer.permissions(code),
 PRIMARY KEY(company_id,grant_id,permission_code),
 CHECK(permission_code IN ('company.profile.read','company.resources.read','company.audit.read')),
 FOREIGN KEY(company_id,grant_id) REFERENCES safeer.support_access_grants(company_id,id)
);
CREATE TABLE safeer.company_audit (
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES safeer.companies(id),actor_id uuid NOT NULL REFERENCES safeer.users(id),
 action varchar(80) NOT NULL,target_id uuid NOT NULL,branch_id uuid,station_id uuid,occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(company_id,branch_id) REFERENCES safeer.branches(company_id,id),
 FOREIGN KEY(company_id,branch_id,station_id) REFERENCES safeer.stations(company_id,branch_id,id)
);
CREATE INDEX company_audit_time ON safeer.company_audit(company_id,occurred_at DESC,id);
INSERT INTO safeer.permissions(code,module) VALUES
 ('company.profile.read','company'),('company.profile.manage','company'),
 ('company.resources.read','company'),('company.resources.manage','company'),
 ('company.members.read','company'),('company.members.manage','company'),
 ('company.roles.read','company'),('company.roles.manage','company'),('company.audit.read','company');
INSERT INTO safeer.role_permissions(role_id,permission_code)
 SELECT r.id,p.code FROM safeer.roles r CROSS JOIN safeer.permissions p
 WHERE (r.code='company_administrator' AND p.module='company')
 OR (r.code IN ('branch_manager','station_manager') AND p.code IN ('company.profile.read','company.resources.read','company.resources.manage','company.members.read','company.members.manage','company.roles.read','company.audit.read'))
 OR (r.code='ticketing_employee' AND p.code IN ('company.profile.read','company.resources.read','company.roles.read'));
UPDATE safeer.roles SET version=version+1 WHERE code IN ('company_administrator','branch_manager','station_manager','ticketing_employee');
-- SECURITY DEFINER helpers have a fixed trusted search_path and no dynamic SQL.
-- The raw opaque session capability must be set with SET LOCAL; actor IDs/flags cannot authorize RLS.
CREATE FUNCTION safeer.company_actor() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT u.id FROM safeer.sessions s JOIN safeer.users u ON u.id=s.user_id
 WHERE s.token_hash=encode(sha256(convert_to(current_setting('safeer.session_token',true),'UTF8')),'hex')
 AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND s.last_seen_at>clock_timestamp()-interval '30 minutes'
 AND s.credential_version=u.credential_version AND u.active AND NOT u.must_change_password
$$;
CREATE FUNCTION safeer.company_super() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM safeer.platform_user_roles a JOIN safeer.roles r ON r.id=a.role_id
 WHERE a.user_id=safeer.company_actor() AND r.code='platform_super_administrator' AND r.active)
$$;
CREATE FUNCTION safeer.company_can(cid uuid,perm text,bid uuid DEFAULT NULL,sid uuid DEFAULT NULL) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT safeer.company_super() OR (
 EXISTS(SELECT 1 FROM safeer.companies co WHERE co.id=cid AND co.status='approved') AND (
 EXISTS(SELECT 1 FROM safeer.company_users m JOIN safeer.company_user_roles a ON (a.company_id,a.member_id)=(m.company_id,m.id)
 JOIN safeer.company_roles r ON (r.company_id,r.id)=(a.company_id,a.role_id)
 JOIN safeer.company_role_permissions p ON (p.company_id,p.role_id)=(r.company_id,r.id)
 WHERE m.company_id=cid AND m.user_id=safeer.company_actor() AND m.active AND r.active AND p.permission_code=perm
 AND (a.branch_id IS NULL OR EXISTS(SELECT 1 FROM safeer.branches b WHERE b.company_id=cid AND b.id=a.branch_id AND b.active))
 AND (a.station_id IS NULL OR EXISTS(SELECT 1 FROM safeer.stations s WHERE s.company_id=cid AND s.id=a.station_id AND s.active))
 AND (a.scope='company' OR (a.scope='branch' AND a.branch_id=bid)
 OR (a.scope='station' AND a.station_id=sid AND a.branch_id=bid)
 OR (a.scope='station' AND perm='company.resources.read' AND sid IS NULL AND a.branch_id=bid)))
 OR EXISTS(SELECT 1 FROM safeer.support_access_grants g JOIN safeer.support_access_grant_permissions p ON (p.company_id,p.grant_id)=(g.company_id,g.id)
 JOIN safeer.platform_user_roles a ON a.user_id=g.support_user_id JOIN safeer.roles r ON r.id=a.role_id
 WHERE g.company_id=cid AND g.support_user_id=safeer.company_actor() AND g.revoked_at IS NULL AND g.expires_at>clock_timestamp()
 AND r.code='platform_support_administrator' AND r.active AND p.permission_code=perm)))
$$;
CREATE FUNCTION safeer.company_has(cid uuid,perm text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT safeer.company_can(cid,perm) OR EXISTS(SELECT 1 FROM safeer.company_users m JOIN safeer.company_user_roles a ON (a.company_id,a.member_id)=(m.company_id,m.id)
 WHERE m.company_id=cid AND m.user_id=safeer.company_actor() AND safeer.company_can(cid,perm,a.branch_id,a.station_id))
$$;
CREATE FUNCTION safeer.member_visible(cid uuid,mid uuid,manage boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT safeer.company_super() OR safeer.company_can(cid,CASE WHEN manage THEN 'company.members.manage' ELSE 'company.members.read' END)
 OR (manage AND EXISTS(SELECT 1 FROM safeer.company_user_roles a WHERE a.company_id=cid AND a.member_id=mid) AND NOT EXISTS(SELECT 1 FROM safeer.company_user_roles a WHERE a.company_id=cid AND a.member_id=mid AND NOT safeer.company_can(cid,'company.members.manage',a.branch_id,a.station_id)))
 OR (NOT manage AND EXISTS(SELECT 1 FROM safeer.company_user_roles a WHERE a.company_id=cid AND a.member_id=mid AND safeer.company_can(cid,'company.members.read',a.branch_id,a.station_id)))
 OR (NOT manage AND safeer.company_has(cid,'company.profile.read') AND EXISTS(SELECT 1 FROM safeer.company_users m WHERE m.company_id=cid AND m.id=mid AND m.user_id=safeer.company_actor()))
$$;
CREATE FUNCTION safeer.assignment_allowed(cid uuid,rid uuid,bid uuid,sid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT safeer.company_can(cid,'company.members.manage',bid,sid) AND NOT EXISTS(SELECT 1 FROM safeer.company_role_permissions p WHERE p.company_id=cid AND p.role_id=rid AND NOT safeer.company_can(cid,p.permission_code,bid,sid))
$$;
-- RLS is enabled on every company-owned table. The migration owner is the sole definer/owner;
-- the application role is neither an owner nor BYPASSRLS and cannot change these functions.
ALTER TABLE safeer.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_read ON safeer.companies FOR SELECT USING(safeer.company_super() OR safeer.company_has(id,'company.profile.read'));
CREATE POLICY company_insert ON safeer.companies FOR INSERT WITH CHECK(safeer.company_super());
CREATE POLICY company_update ON safeer.companies FOR UPDATE USING(safeer.company_can(id,'company.profile.manage')) WITH CHECK(safeer.company_can(id,'company.profile.manage'));
ALTER TABLE safeer.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_read ON safeer.company_settings FOR SELECT USING(safeer.company_super() OR safeer.company_has(company_id,'company.profile.read'));
CREATE POLICY settings_insert ON safeer.company_settings FOR INSERT WITH CHECK(safeer.company_super());
CREATE POLICY settings_update ON safeer.company_settings FOR UPDATE USING(safeer.company_can(company_id,'company.profile.manage')) WITH CHECK(safeer.company_can(company_id,'company.profile.manage'));
ALTER TABLE safeer.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY branches_read ON safeer.branches FOR SELECT USING(safeer.company_can(company_id,'company.resources.read',id));
CREATE POLICY branches_insert ON safeer.branches FOR INSERT WITH CHECK(safeer.company_can(company_id,'company.resources.manage'));
CREATE POLICY branches_update ON safeer.branches FOR UPDATE USING(safeer.company_can(company_id,'company.resources.manage',id)) WITH CHECK(safeer.company_can(company_id,'company.resources.manage',id));
ALTER TABLE safeer.stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY stations_read ON safeer.stations FOR SELECT USING(safeer.company_can(company_id,'company.resources.read',branch_id,id));
CREATE POLICY stations_insert ON safeer.stations FOR INSERT WITH CHECK(safeer.company_can(company_id,'company.resources.manage',branch_id));
CREATE POLICY stations_update ON safeer.stations FOR UPDATE USING(safeer.company_can(company_id,'company.resources.manage',branch_id,id)) WITH CHECK(safeer.company_can(company_id,'company.resources.manage',branch_id,id));
ALTER TABLE safeer.company_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_read ON safeer.company_roles FOR SELECT USING(safeer.company_super() OR safeer.company_has(company_id,'company.roles.read'));
CREATE POLICY roles_insert ON safeer.company_roles FOR INSERT WITH CHECK(safeer.company_can(company_id,'company.roles.manage'));
CREATE POLICY roles_update ON safeer.company_roles FOR UPDATE USING(safeer.company_can(company_id,'company.roles.manage')) WITH CHECK(safeer.company_can(company_id,'company.roles.manage'));
ALTER TABLE safeer.company_role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_permissions_read ON safeer.company_role_permissions FOR SELECT USING(safeer.company_super() OR safeer.company_has(company_id,'company.roles.read'));
CREATE POLICY role_permissions_write ON safeer.company_role_permissions FOR ALL USING(safeer.company_can(company_id,'company.roles.manage')) WITH CHECK(safeer.company_can(company_id,'company.roles.manage') AND safeer.company_can(company_id,permission_code));
ALTER TABLE safeer.company_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY members_read ON safeer.company_users FOR SELECT USING(safeer.member_visible(company_id,id));
CREATE POLICY members_insert ON safeer.company_users FOR INSERT WITH CHECK(safeer.company_has(company_id,'company.members.manage'));
CREATE POLICY members_update ON safeer.company_users FOR UPDATE USING(safeer.member_visible(company_id,id,true)) WITH CHECK(safeer.member_visible(company_id,id,true));
ALTER TABLE safeer.company_user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY assignments_read ON safeer.company_user_roles FOR SELECT USING(safeer.company_can(company_id,'company.members.read') OR safeer.company_can(company_id,'company.members.read',branch_id,station_id) OR EXISTS(SELECT 1 FROM safeer.company_users m WHERE m.company_id=company_user_roles.company_id AND m.id=member_id AND m.user_id=safeer.company_actor()));
CREATE POLICY assignments_write ON safeer.company_user_roles FOR ALL USING(safeer.company_can(company_id,'company.members.manage',branch_id,station_id)) WITH CHECK(safeer.assignment_allowed(company_id,role_id,branch_id,station_id));
ALTER TABLE safeer.support_access_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_read ON safeer.support_access_grants FOR SELECT USING(safeer.company_super() OR safeer.company_can(company_id,'company.members.manage'));
CREATE POLICY support_insert ON safeer.support_access_grants FOR INSERT WITH CHECK(safeer.company_super());
CREATE POLICY support_update ON safeer.support_access_grants FOR UPDATE USING(safeer.company_super()) WITH CHECK(safeer.company_super());
ALTER TABLE safeer.support_access_grant_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_permissions_read ON safeer.support_access_grant_permissions FOR SELECT USING(safeer.company_super() OR safeer.company_can(company_id,'company.members.manage'));
CREATE POLICY support_permissions_insert ON safeer.support_access_grant_permissions FOR INSERT WITH CHECK(safeer.company_super());
ALTER TABLE safeer.company_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON safeer.company_audit FOR SELECT USING(safeer.company_can(company_id,'company.audit.read',branch_id,station_id));
CREATE POLICY audit_insert ON safeer.company_audit FOR INSERT WITH CHECK(actor_id=safeer.company_actor() AND safeer.company_has(company_id,'company.profile.read'));
-- Approval cannot be changed through a company-scoped SQL update, even if an endpoint regresses.
CREATE FUNCTION safeer.protect_company_status() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF (NEW.status IS DISTINCT FROM OLD.status OR NEW.slug IS DISTINCT FROM OLD.slug) AND NOT safeer.company_super() THEN
 RAISE EXCEPTION 'Company status and slug require super administrator' USING ERRCODE='42501';END IF;RETURN NEW;
END $$;
CREATE TRIGGER company_status_guard BEFORE UPDATE ON safeer.companies FOR EACH ROW EXECUTE FUNCTION safeer.protect_company_status();
-- Deferred checks see the final atomic role/member state, not transient delete/reinsert steps.
CREATE FUNCTION safeer.check_company_administrator(cid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(94106,2);
 IF EXISTS(SELECT 1 FROM safeer.companies WHERE id=cid AND status<>'archived') AND NOT EXISTS(
 SELECT 1 FROM safeer.company_users m JOIN safeer.users u ON u.id=m.user_id
 WHERE m.company_id=cid AND m.active AND u.active
 AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['company.profile.read','company.members.read','company.members.manage','company.roles.read','company.roles.manage']) required(permission)
 WHERE NOT EXISTS(SELECT 1 FROM safeer.company_user_roles a JOIN safeer.company_roles r ON (r.company_id,r.id)=(a.company_id,a.role_id)
 JOIN safeer.company_role_permissions p ON (p.company_id,p.role_id)=(r.company_id,r.id)
 WHERE a.company_id=cid AND a.member_id=m.id AND r.active AND a.scope='company' AND p.permission_code=required.permission)))
 THEN RAISE EXCEPTION 'LAST_COMPANY_ADMIN' USING ERRCODE='P0001';END IF;
END $$;
CREATE FUNCTION safeer.guard_company_administrator() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE cid uuid;
BEGIN
 IF TG_TABLE_NAME='users' THEN
 FOR cid IN SELECT company_id FROM safeer.company_users WHERE user_id=NEW.id LOOP PERFORM safeer.check_company_administrator(cid);END LOOP;
 ELSIF TG_TABLE_NAME='companies' THEN PERFORM safeer.check_company_administrator(NEW.id);
 ELSE PERFORM safeer.check_company_administrator(CASE WHEN TG_OP='DELETE' THEN OLD.company_id ELSE NEW.company_id END);
 END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER company_admin_companies AFTER INSERT OR UPDATE ON safeer.companies DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION safeer.guard_company_administrator();
CREATE CONSTRAINT TRIGGER company_admin_members AFTER INSERT OR UPDATE ON safeer.company_users DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION safeer.guard_company_administrator();
CREATE CONSTRAINT TRIGGER company_admin_assignments AFTER INSERT OR UPDATE OR DELETE ON safeer.company_user_roles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION safeer.guard_company_administrator();
CREATE CONSTRAINT TRIGGER company_admin_roles AFTER INSERT OR UPDATE ON safeer.company_roles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION safeer.guard_company_administrator();
CREATE CONSTRAINT TRIGGER company_admin_grants AFTER INSERT OR UPDATE OR DELETE ON safeer.company_role_permissions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION safeer.guard_company_administrator();
CREATE CONSTRAINT TRIGGER company_admin_users AFTER UPDATE ON safeer.users DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION safeer.guard_company_administrator();
REVOKE ALL ON ALL TABLES IN SCHEMA safeer FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA safeer FROM PUBLIC;

-- No API path or accidental SQL UPDATE may transfer an existing tenant-owned row.
CREATE FUNCTION safeer.immutable_company_ownership() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN IF NEW.company_id IS DISTINCT FROM OLD.company_id OR (to_jsonb(NEW)->'id') IS DISTINCT FROM (to_jsonb(OLD)->'id') THEN RAISE EXCEPTION 'Immutable ownership' USING ERRCODE='42501';END IF;RETURN NEW;END $$;
DO $$ DECLARE tab text; BEGIN FOREACH tab IN ARRAY ARRAY['company_settings','branches','stations','company_roles','company_role_permissions','company_users','company_user_roles','support_access_grants','support_access_grant_permissions','company_audit'] LOOP
 EXECUTE format('CREATE TRIGGER immutable_ownership BEFORE UPDATE ON safeer.%I FOR EACH ROW EXECUTE FUNCTION safeer.immutable_company_ownership()',tab);
END LOOP;END $$;
CREATE FUNCTION safeer.company_capacity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer; cap integer;
BEGIN
 PERFORM pg_advisory_xact_lock(94106,2);
 CASE TG_TABLE_NAME
 WHEN 'companies' THEN SELECT count(*) INTO n FROM safeer.companies;cap:=200;
 WHEN 'branches' THEN SELECT count(*) INTO n FROM safeer.branches WHERE company_id=NEW.company_id;cap:=100;
 WHEN 'stations' THEN SELECT count(*) INTO n FROM safeer.stations WHERE company_id=NEW.company_id;cap:=200;
 WHEN 'company_users' THEN SELECT count(*) INTO n FROM safeer.company_users WHERE company_id=NEW.company_id;cap:=500;
 WHEN 'company_roles' THEN SELECT count(*) INTO n FROM safeer.company_roles WHERE company_id=NEW.company_id;cap:=50;
 WHEN 'company_user_roles' THEN SELECT count(*) INTO n FROM safeer.company_user_roles WHERE company_id=NEW.company_id AND member_id=NEW.member_id;cap:=10;
 WHEN 'support_access_grants' THEN SELECT count(*) INTO n FROM safeer.support_access_grants WHERE company_id=NEW.company_id;cap:=500;
 END CASE;
 IF n>=cap THEN RAISE EXCEPTION 'COMPANY_LIMIT' USING ERRCODE='P0001';END IF;RETURN NEW;
END $$;
DO $$ DECLARE tab text; BEGIN FOREACH tab IN ARRAY ARRAY['companies','branches','stations','company_users','company_roles','company_user_roles','support_access_grants'] LOOP
 EXECUTE format('CREATE TRIGGER company_capacity BEFORE INSERT ON safeer.%I FOR EACH ROW EXECUTE FUNCTION safeer.company_capacity()',tab);
END LOOP;END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA safeer FROM PUBLIC;
