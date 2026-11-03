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
    GRANT SELECT,INSERT,UPDATE ON safeer.seat_layouts,safeer.buses,safeer.drivers TO "${role}";
    GRANT SELECT,INSERT ON safeer.seat_layout_revisions,safeer.seat_layout_seats TO "${role}";
    GRANT EXECUTE ON FUNCTION safeer.fleet_manage(uuid),safeer.driver_manage(uuid) TO "${role}";
    GRANT SELECT,INSERT,UPDATE ON safeer.trips,safeer.trip_stops,safeer.trip_assignments TO "${role}";
    GRANT EXECUTE ON FUNCTION safeer.trip_manage(uuid) TO "${role}";
    GRANT SELECT,INSERT,UPDATE ON safeer.company_public_profiles TO "${role}";
    GRANT EXECUTE ON FUNCTION safeer.public_trips(text,text,date,text),safeer.public_cities(),safeer.public_companies(text) TO "${role}";
    GRANT EXECUTE ON FUNCTION safeer.public_trip(uuid),safeer.public_book(uuid,text[],uuid,text,text,text,text,jsonb),safeer.public_booking(text,text),safeer.public_booking_by_key(text),safeer.public_lookup(text,text),safeer.public_release(text,text),safeer.public_release_by_mobile(text,text),safeer.expire_due_holds(),safeer.erase_due_passenger_data(),safeer.staff_seat_map(uuid,uuid),safeer.staff_release(uuid,uuid,uuid,uuid,text),safeer.staff_bookings(uuid,text,text,text),safeer.staff_booking(uuid,uuid),safeer.staff_update_travelers(uuid,uuid,uuid,integer,text,jsonb,text) TO "${role}";
    REVOKE EXECUTE ON FUNCTION safeer.public_hold(uuid,text[],uuid,text,text,text) FROM "${role}";
    GRANT EXECUTE ON FUNCTION safeer.counter_overview(uuid),safeer.counter_trip(uuid,uuid),safeer.save_payment_settings(uuid,uuid,boolean,boolean,integer),safeer.save_counter(uuid,uuid,uuid,uuid,text,text,boolean,integer),safeer.open_session(uuid,uuid,uuid,integer),safeer.close_session(uuid,uuid,uuid,bigint,text),safeer.counter_pay(uuid,uuid,uuid,text,text,text,text,text),safeer.counter_sale(uuid,uuid,uuid,text[],uuid,text,text,text,text,jsonb,text,text,text),safeer.counter_refund(uuid,uuid,uuid,text,text,text,text),safeer.record_print(uuid,uuid,uuid,text) TO "${role}";
    GRANT EXECUTE ON FUNCTION safeer.luggage_find(uuid,text,text),safeer.luggage_register(uuid,uuid,text,text,integer,integer,text,text,text,text),safeer.luggage_update(uuid,uuid,uuid,text,integer,integer,text,text,integer),safeer.luggage_tag(uuid,uuid,uuid,text,text,integer),safeer.luggage_move(uuid,uuid,uuid,text,text,integer),safeer.luggage_collect(uuid,uuid,uuid,text,text,text,integer),safeer.luggage_report(uuid,uuid,uuid,text,text),safeer.luggage_resolve(uuid,uuid,uuid,uuid,text,text) TO "${role}";
    REVOKE EXECUTE ON FUNCTION safeer.erase_due_passenger_data_before_boarding() FROM "${role}";
    GRANT EXECUTE ON FUNCTION safeer.finance_report(uuid,date,date,uuid,uuid,text,integer,integer,timestamptz,boolean),safeer.finance_options(uuid),safeer.finance_audit(uuid,text) TO "${role}";
    GRANT EXECUTE ON FUNCTION safeer.driver_trips(),safeer.driver_manifest(uuid,uuid),safeer.driver_verify(uuid,uuid,text,boolean),safeer.driver_event(uuid,uuid,text),safeer.driver_incident(uuid,uuid,text,text,text,text),safeer.ticket_codes(uuid,uuid) TO "${role}";
    GRANT EXECUTE ON FUNCTION safeer.platform_notice(),safeer.platform_settings_read(),safeer.platform_settings_save(boolean,text,text,integer),safeer.platform_dashboard(date,date,integer),safeer.notifications_list(bigint),safeer.notification_read(bigint) TO "${role}";
    GRANT EXECUTE ON FUNCTION safeer.company_actor(),safeer.company_super(),safeer.company_can(uuid,text,uuid,uuid),safeer.company_has(uuid,text),safeer.member_visible(uuid,uuid,boolean),safeer.assignment_allowed(uuid,uuid,uuid,uuid) TO "${role}";`);
}
