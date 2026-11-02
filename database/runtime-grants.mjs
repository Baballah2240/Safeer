// Run only using the local migration owner, never through an HTTP endpoint.
export async function grantIdentityRuntime(client,role){
  if(!/^safeer_[a-z0-9_]{1,50}$/.test(role))throw Error('Use a dedicated safeer_ runtime role.');
  const result=await client.query('SELECT r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid) AS membership FROM pg_roles r WHERE r.rolname=$1',[role]);
  if(!result.rows[0]||Object.values(result.rows[0]).some(Boolean))throw Error('Runtime role must not have elevated PostgreSQL privileges.');
  // The identifier is constrained above; values elsewhere remain parameterized.
  await client.query(`GRANT USAGE ON SCHEMA safeer TO "${role}";
    GRANT SELECT,INSERT,UPDATE ON safeer.users,safeer.sessions,safeer.roles TO "${role}";
    GRANT SELECT,INSERT,DELETE ON safeer.role_permissions,safeer.platform_user_roles TO "${role}";
    GRANT SELECT ON safeer.permissions TO "${role}";
    GRANT SELECT,INSERT,UPDATE,DELETE ON safeer.auth_throttles TO "${role}";
    GRANT SELECT,INSERT ON safeer.identity_audit TO "${role}";
    GRANT SELECT,INSERT,UPDATE ON safeer.companies,safeer.company_settings,safeer.branches,safeer.stations,safeer.company_roles,safeer.company_users,safeer.support_access_grants TO "${role}";
    GRANT SELECT,INSERT,DELETE ON safeer.company_role_permissions,safeer.company_user_roles TO "${role}";
    GRANT SELECT,INSERT ON safeer.support_access_grant_permissions,safeer.company_audit TO "${role}";
    GRANT SELECT,INSERT,UPDATE ON safeer.cities,safeer.routes TO "${role}";
    GRANT SELECT,INSERT,DELETE ON safeer.route_stops TO "${role}";
    GRANT EXECUTE ON FUNCTION safeer.route_manage(uuid) TO "${role}";
    GRANT EXECUTE ON FUNCTION safeer.company_actor(),safeer.company_super(),safeer.company_can(uuid,text,uuid,uuid),safeer.company_has(uuid,text),safeer.member_visible(uuid,uuid,boolean),safeer.assignment_allowed(uuid,uuid,uuid,uuid) TO "${role}";`);
}
