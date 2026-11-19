-- D121: each city may have one photo of the place, set by the Super Administrator. Passengers see the
-- destination's photo on popular route cards. Only PNG, JPEG or WebP up to 128 KB, checked here and in the API.
CREATE TABLE safeer.city_photos (
 city_id uuid PRIMARY KEY REFERENCES safeer.cities(id) ON DELETE CASCADE,
 photo_type varchar(20) NOT NULL CHECK(photo_type IN ('image/png','image/jpeg','image/webp')),
 photo bytea NOT NULL CHECK(octet_length(photo) BETWEEN 1 AND 131072),
 version integer NOT NULL DEFAULT 1 CHECK(version>0)
);
ALTER TABLE safeer.city_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON safeer.city_photos FROM PUBLIC;
CREATE POLICY city_photo_read ON safeer.city_photos FOR SELECT USING(safeer.company_actor() IS NOT NULL);
CREATE POLICY city_photo_insert ON safeer.city_photos FOR INSERT WITH CHECK(safeer.company_super());
CREATE POLICY city_photo_update ON safeer.city_photos FOR UPDATE USING(safeer.company_super()) WITH CHECK(safeer.company_super());
CREATE POLICY city_photo_delete ON safeer.city_photos FOR DELETE USING(safeer.company_super());

-- The public city list also says which cities have a photo (its version busts the browser cache).
CREATE OR REPLACE FUNCTION safeer.public_cities() RETURNS SETOF jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('code',c.code,'nameEn',c.name_en,'nameAr',c.name_ar,'photoVersion',ph.version) FROM safeer.cities c
 LEFT JOIN safeer.city_photos ph ON ph.city_id=c.id
 WHERE c.active AND EXISTS(SELECT 1 FROM safeer.trips t JOIN safeer.companies co ON co.id=t.company_id AND co.status='approved'
  JOIN safeer.company_public_profiles p ON p.company_id=t.company_id AND p.listed
  JOIN safeer.trip_stops s ON s.company_id=t.company_id AND s.trip_id=t.id
  WHERE t.status='published' AND t.departure_at>clock_timestamp() AND s.city_id=c.id)
 ORDER BY c.name_en,c.code
$$;
-- Photo of an active city, by its public code.
CREATE FUNCTION safeer.public_city_photo(p_code text) RETURNS TABLE(photo_type text,photo bytea) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT ph.photo_type::text,ph.photo FROM safeer.cities c JOIN safeer.city_photos ph ON ph.city_id=c.id WHERE c.code=p_code AND c.active
$$;
REVOKE ALL ON FUNCTION safeer.public_cities(),safeer.public_city_photo(text) FROM PUBLIC;
