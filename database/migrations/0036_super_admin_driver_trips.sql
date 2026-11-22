-- D135: the super administrator has full access everywhere, including the driver app.
-- Drivers still see only the trips assigned to them (D131). The super administrator sees every
-- non-draft trip of every company from two days ago onward, so any journey can be opened from the app.
CREATE OR REPLACE FUNCTION safeer.driver_trips() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('items',coalesce(jsonb_agg(x ORDER BY x->>'departureAt'),'[]'::jsonb)) FROM (
 SELECT jsonb_build_object('id',t.id,'companyId',t.company_id,'companyEn',c.name_en,'companyAr',c.name_ar,'routeEn',t.route_name_en,'routeAr',t.route_name_ar,'timezone',t.timezone,'departureAt',t.departure_at,'arrivalAt',t.arrival_at,'status',t.status,'bus',a.bus_registration,
 'journey',CASE WHEN EXISTS(SELECT 1 FROM safeer.journey_events j WHERE j.company_id=t.company_id AND j.trip_id=t.id AND j.event='arrived') THEN 'arrived' WHEN EXISTS(SELECT 1 FROM safeer.journey_events j WHERE j.company_id=t.company_id AND j.trip_id=t.id AND j.event='departed') THEN 'departed' ELSE 'scheduled' END) AS x
 FROM safeer.trips t JOIN safeer.companies c ON c.id=t.company_id
 JOIN safeer.trip_assignments a ON (a.company_id,a.trip_id)=(t.company_id,t.id) AND a.replaced_at IS NULL
 JOIN safeer.drivers d ON (d.company_id,d.id)=(a.company_id,a.driver_id) AND d.active
 JOIN safeer.company_users m ON (m.company_id,m.id)=(d.company_id,d.member_id) AND m.active AND m.user_id=safeer.company_actor()
 WHERE t.status<>'draft' AND safeer.journey_allowed(t.company_id,t.id)
 UNION ALL
 SELECT jsonb_build_object('id',t.id,'companyId',t.company_id,'companyEn',c.name_en,'companyAr',c.name_ar,'routeEn',t.route_name_en,'routeAr',t.route_name_ar,'timezone',t.timezone,'departureAt',t.departure_at,'arrivalAt',t.arrival_at,'status',t.status,'bus',a.bus_registration,
 'journey',CASE WHEN EXISTS(SELECT 1 FROM safeer.journey_events j WHERE j.company_id=t.company_id AND j.trip_id=t.id AND j.event='arrived') THEN 'arrived' WHEN EXISTS(SELECT 1 FROM safeer.journey_events j WHERE j.company_id=t.company_id AND j.trip_id=t.id AND j.event='departed') THEN 'departed' ELSE 'scheduled' END)
 FROM safeer.trips t JOIN safeer.companies c ON c.id=t.company_id
 LEFT JOIN safeer.trip_assignments a ON (a.company_id,a.trip_id)=(t.company_id,t.id) AND a.replaced_at IS NULL
 WHERE safeer.company_super() AND t.status<>'draft' AND t.departure_at>clock_timestamp()-interval '2 days'
 AND NOT EXISTS(SELECT 1 FROM safeer.trip_assignments a2 JOIN safeer.drivers d2 ON (d2.company_id,d2.id)=(a2.company_id,a2.driver_id) AND d2.active
  JOIN safeer.company_users m2 ON (m2.company_id,m2.id)=(d2.company_id,d2.member_id) AND m2.active AND m2.user_id=safeer.company_actor()
  WHERE a2.company_id=t.company_id AND a2.trip_id=t.id AND a2.replaced_at IS NULL)
 ) q
$$;
