-- D146: the Super Administrator's Countries page lists the companies set to one country, with a short summary.
CREATE FUNCTION safeer.platform_country_companies(code text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT safeer.company_super() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF code IS NULL OR code !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'Invalid input' USING ERRCODE='23514'; END IF;
 RETURN jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',co.id,'slug',co.slug,'nameEn',co.name_en,'nameAr',co.name_ar,'status',co.status,
   'listed',coalesce(pp.listed,false),'currency',s.currency::text,'timezone',s.timezone,
   'branches',(SELECT count(*) FROM safeer.branches b WHERE b.company_id=co.id AND b.active)::int,
   'staff',(SELECT count(*) FROM safeer.company_users m WHERE m.company_id=co.id AND m.active)::int,
   'upcomingTrips',(SELECT count(*) FROM safeer.trips t WHERE t.company_id=co.id AND t.status='published' AND t.departure_at>clock_timestamp())::int) ORDER BY co.name_en,co.id)
  FROM safeer.companies co JOIN safeer.company_settings s ON s.company_id=co.id LEFT JOIN safeer.company_public_profiles pp ON pp.company_id=co.id
  WHERE s.country_code=code),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION safeer.platform_country_companies(text) FROM PUBLIC;
