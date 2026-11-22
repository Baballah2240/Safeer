-- D145: the Super Administrator's Countries panel. Per country: how many companies are set to it and how many
-- of them are approved. Countries without companies are simply absent (the API adds the rest of the served list).
CREATE FUNCTION safeer.platform_countries() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT safeer.company_super() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object('countryCode',x.code,'companies',x.total,'approved',x.approved) ORDER BY x.code) FROM (
  SELECT s.country_code::text AS code,count(*)::int AS total,count(*) FILTER(WHERE co.status='approved')::int AS approved
  FROM safeer.companies co JOIN safeer.company_settings s ON s.company_id=co.id GROUP BY s.country_code) x),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION safeer.platform_countries() FROM PUBLIC;
