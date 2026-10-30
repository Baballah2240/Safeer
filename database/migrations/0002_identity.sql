CREATE TABLE safeer.users (
  id uuid PRIMARY KEY,
  normalized_login varchar(254) NOT NULL UNIQUE CHECK (normalized_login = lower(btrim(normalized_login))),
  display_name varchar(100) NOT NULL CHECK (length(btrim(display_name)) > 0),
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  credential_version integer NOT NULL DEFAULT 1 CHECK (credential_version > 0),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE safeer.sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES safeer.users(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  credential_version integer NOT NULL CHECK (credential_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX sessions_user_expiry ON safeer.sessions(user_id, expires_at);
CREATE TABLE safeer.permissions (code varchar(80) PRIMARY KEY, module varchar(40) NOT NULL);
CREATE TABLE safeer.roles (
  id uuid PRIMARY KEY,
  code varchar(80) NOT NULL UNIQUE,
  display_name varchar(100) NOT NULL CHECK (length(btrim(display_name)) > 0),
  scope varchar(20) NOT NULL CHECK (scope IN ('platform','company','branch','station','trip')),
  builtin boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE(id,scope)
);
CREATE TABLE safeer.role_permissions (
  role_id uuid NOT NULL REFERENCES safeer.roles(id) ON DELETE RESTRICT,
  permission_code varchar(80) NOT NULL REFERENCES safeer.permissions(code) ON DELETE RESTRICT,
  PRIMARY KEY(role_id,permission_code)
);
CREATE INDEX role_permissions_code ON safeer.role_permissions(permission_code);
CREATE TABLE safeer.platform_user_roles (
  user_id uuid NOT NULL REFERENCES safeer.users(id) ON DELETE RESTRICT,
  role_id uuid NOT NULL,
  role_scope varchar(20) NOT NULL DEFAULT 'platform' CHECK (role_scope = 'platform'),
  assigned_by uuid REFERENCES safeer.users(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,role_id),
  FOREIGN KEY(role_id,role_scope) REFERENCES safeer.roles(id,scope) ON DELETE RESTRICT
);
CREATE INDEX platform_user_roles_role ON safeer.platform_user_roles(role_id);
CREATE TABLE safeer.identity_audit (
  id uuid PRIMARY KEY,
  actor_id uuid REFERENCES safeer.users(id) ON DELETE RESTRICT,
  action varchar(80) NOT NULL,
  target_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX identity_audit_time ON safeer.identity_audit(occurred_at DESC,id);
CREATE TABLE safeer.auth_throttles (
  key_hash text PRIMARY KEY CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  attempts integer NOT NULL CHECK (attempts > 0),
  resets_at timestamptz NOT NULL
);
CREATE INDEX auth_throttles_expiry ON safeer.auth_throttles(resets_at);
INSERT INTO safeer.permissions(code,module) VALUES
 ('identity.users.read','identity'),('identity.users.manage','identity'),
 ('identity.roles.read','identity'),('identity.roles.manage','identity'),
 ('identity.platform_roles.assign','identity'),('identity.audit.read','identity');
INSERT INTO safeer.roles(id,code,display_name,scope,builtin) VALUES
 ('00000000-0000-4000-8000-000000000001','platform_super_administrator','Platform super administrator','platform',true),
 ('00000000-0000-4000-8000-000000000002','platform_support_administrator','Platform support administrator','platform',true),
 ('00000000-0000-4000-8000-000000000003','company_administrator','Company administrator','company',true),
 ('00000000-0000-4000-8000-000000000004','branch_manager','Branch manager','branch',true),
 ('00000000-0000-4000-8000-000000000005','station_manager','Station manager','station',true),
 ('00000000-0000-4000-8000-000000000006','ticketing_employee','Ticketing employee','station',true),
 ('00000000-0000-4000-8000-000000000007','boarding_employee','Boarding employee','trip',true),
 ('00000000-0000-4000-8000-000000000008','driver','Driver','trip',true);
INSERT INTO safeer.role_permissions(role_id,permission_code)
 SELECT '00000000-0000-4000-8000-000000000001',code FROM safeer.permissions;
INSERT INTO safeer.role_permissions(role_id,permission_code) VALUES
 ('00000000-0000-4000-8000-000000000002','identity.users.read'),
 ('00000000-0000-4000-8000-000000000002','identity.roles.read');
REVOKE ALL ON ALL TABLES IN SCHEMA safeer FROM PUBLIC;
