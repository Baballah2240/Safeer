-- D131: the driver app lists only trips assigned to the signed-in person, also for managers
-- who may manage every journey (they still open any trip they are allowed to from the staff site).
CREATE OR REPLACE FUNCTION safeer.driver_trips() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('items',coalesce(jsonb_agg(x ORDER BY x->>'departureAt'),'[]'::jsonb)) FROM (
 SELECT jsonb_build_object('id',t.id,'companyId',t.company_id,'companyEn',c.name_en,'companyAr',c.name_ar,'routeEn',t.route_name_en,'routeAr',t.route_name_ar,'timezone',t.timezone,'departureAt',t.departure_at,'arrivalAt',t.arrival_at,'status',t.status,'bus',a.bus_registration,
 'journey',CASE WHEN EXISTS(SELECT 1 FROM safeer.journey_events j WHERE j.company_id=t.company_id AND j.trip_id=t.id AND j.event='arrived') THEN 'arrived' WHEN EXISTS(SELECT 1 FROM safeer.journey_events j WHERE j.company_id=t.company_id AND j.trip_id=t.id AND j.event='departed') THEN 'departed' ELSE 'scheduled' END) AS x
 FROM safeer.trips t JOIN safeer.companies c ON c.id=t.company_id
 JOIN safeer.trip_assignments a ON (a.company_id,a.trip_id)=(t.company_id,t.id) AND a.replaced_at IS NULL
 JOIN safeer.drivers d ON (d.company_id,d.id)=(a.company_id,a.driver_id) AND d.active
 JOIN safeer.company_users m ON (m.company_id,m.id)=(d.company_id,d.member_id) AND m.active AND m.user_id=safeer.company_actor()
 WHERE t.status<>'draft' AND safeer.journey_allowed(t.company_id,t.id)
 ) q
$$;
