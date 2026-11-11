-- D72: the walk-in sale list shows only the next 100 published departures, so a cashier at a busy
-- company could not sell a seat further ahead. This read-only projection lists one company-local day,
-- with exactly the fields and permission the counter overview already uses. No table or rule changes.
CREATE FUNCTION safeer.counter_trips(cid uuid,p_day date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT safeer.company_has(cid,'company.ticketing.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF p_day IS NULL THEN RAISE EXCEPTION 'Day required' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('day',p_day,'items',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'routeNameEn',t.route_name_en,'routeNameAr',t.route_name_ar,'date',to_char(t.departure_at AT TIME ZONE t.timezone,'YYYY-MM-DD'),'time',to_char(t.departure_at AT TIME ZONE t.timezone,'HH24:MI'),'fareMinor',t.fare_minor,'currency',t.currency) ORDER BY t.departure_at)
  FROM (SELECT * FROM safeer.trips z WHERE z.company_id=cid AND z.status='published' AND z.departure_at>clock_timestamp() AND (z.departure_at AT TIME ZONE z.timezone)::date=p_day ORDER BY z.departure_at LIMIT 100) t),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION safeer.counter_trips(uuid,date) FROM PUBLIC;
