-- Section 07. Existing companies stay private until they choose to list, and their private contact fields are never exposed.
CREATE TABLE safeer.company_public_profiles (
 company_id uuid PRIMARY KEY REFERENCES safeer.companies(id),
 listed boolean NOT NULL DEFAULT false,
 about_en varchar(1000) NOT NULL DEFAULT '',about_ar varchar(1000) NOT NULL DEFAULT '',
 public_phone varchar(30) CHECK(public_phone IS NULL OR public_phone ~ '^[+0-9 ()-]{5,30}$'),
 public_email varchar(254) CHECK(public_email IS NULL OR public_email ~ '^[^[:space:]@]+@[^[:space:]@]+$'),
 public_address varchar(300),
 version integer NOT NULL DEFAULT 1 CHECK(version>0)
);
ALTER TABLE safeer.company_public_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_profile_read ON safeer.company_public_profiles FOR SELECT USING(safeer.company_has(company_id,'company.profile.read'));
CREATE POLICY public_profile_insert ON safeer.company_public_profiles FOR INSERT WITH CHECK(safeer.company_can(company_id,'company.profile.manage'));
CREATE POLICY public_profile_update ON safeer.company_public_profiles FOR UPDATE USING(safeer.company_can(company_id,'company.profile.manage')) WITH CHECK(safeer.company_can(company_id,'company.profile.manage'));
CREATE TRIGGER immutable_ownership BEFORE UPDATE ON safeer.company_public_profiles FOR EACH ROW EXECUTE FUNCTION safeer.immutable_company_ownership();
REVOKE ALL ON safeer.company_public_profiles FROM PUBLIC;
-- Anonymous visitors reach only these fixed projections, never the tables. Each one lists its exact fields,
-- so manifests, drivers, registrations, staff and private contact details cannot appear by accident.
CREATE FUNCTION safeer.public_trips(p_from text,p_to text,p_date date,p_slug text) RETURNS SETOF jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object(
  'id',t.id,'companySlug',co.slug,'companyNameEn',co.name_en,'companyNameAr',co.name_ar,
  'routeNameEn',t.route_name_en,'routeNameAr',t.route_name_ar,
  'fromCode',fc.code,'fromNameEn',fs.city_name_en,'fromNameAr',fs.city_name_ar,'toCode',tc.code,'toNameEn',ls.city_name_en,'toNameAr',ls.city_name_ar,
  'date',to_char(t.departure_at AT TIME ZONE t.timezone,'YYYY-MM-DD'),'time',to_char(t.departure_at AT TIME ZONE t.timezone,'HH24:MI'),
  'arrivalDate',to_char(t.arrival_at AT TIME ZONE t.timezone,'YYYY-MM-DD'),'arrivalTime',to_char(t.arrival_at AT TIME ZONE t.timezone,'HH24:MI'),
  'durationMinutes',ls.offset_minutes,'fareMinor',t.fare_minor,'currency',t.currency,
  'seatCount',a.seat_count,'busTypeEn',l.name_en,'busTypeAr',l.name_ar,
  'stops',(SELECT jsonb_agg(jsonb_build_object('cityNameEn',s.city_name_en,'cityNameAr',s.city_name_ar,'stationNameEn',s.station_name_en,'stationNameAr',s.station_name_ar,'offsetMinutes',s.offset_minutes) ORDER BY s.stop_index) FROM safeer.trip_stops s WHERE s.company_id=t.company_id AND s.trip_id=t.id))
 FROM safeer.trips t
 JOIN safeer.companies co ON co.id=t.company_id AND co.status='approved'
 JOIN safeer.company_public_profiles p ON p.company_id=t.company_id AND p.listed
 JOIN safeer.trip_assignments a ON a.company_id=t.company_id AND a.trip_id=t.id AND a.replaced_at IS NULL
 JOIN safeer.seat_layouts l ON l.company_id=a.company_id AND l.id=a.layout_id
 JOIN safeer.trip_stops fs ON fs.company_id=t.company_id AND fs.trip_id=t.id AND fs.stop_index=0
 JOIN safeer.trip_stops ls ON ls.company_id=t.company_id AND ls.trip_id=t.id AND ls.stop_index=t.stop_count-1
 JOIN safeer.cities fc ON fc.id=fs.city_id
 JOIN safeer.cities tc ON tc.id=ls.city_id
 WHERE t.status='published' AND t.departure_at>clock_timestamp()
  AND (p_from IS NULL OR fc.code=p_from) AND (p_to IS NULL OR tc.code=p_to) AND (p_slug IS NULL OR co.slug=p_slug)
  AND (p_date IS NULL OR (t.departure_at AT TIME ZONE t.timezone)::date=p_date)
 ORDER BY t.departure_at,t.id LIMIT 100
$$;
CREATE FUNCTION safeer.public_cities() RETURNS SETOF jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('code',c.code,'nameEn',c.name_en,'nameAr',c.name_ar) FROM safeer.cities c
 WHERE c.active AND EXISTS(SELECT 1 FROM safeer.trips t JOIN safeer.companies co ON co.id=t.company_id AND co.status='approved'
  JOIN safeer.company_public_profiles p ON p.company_id=t.company_id AND p.listed
  JOIN safeer.trip_stops s ON s.company_id=t.company_id AND s.trip_id=t.id AND s.stop_index IN (0,t.stop_count-1)
  WHERE t.status='published' AND t.departure_at>clock_timestamp() AND s.city_id=c.id)
 ORDER BY c.name_en,c.code
$$;
CREATE FUNCTION safeer.public_companies(p_slug text) RETURNS SETOF jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('slug',co.slug,'nameEn',co.name_en,'nameAr',co.name_ar,'aboutEn',p.about_en,'aboutAr',p.about_ar,'phone',p.public_phone,'email',p.public_email,'address',p.public_address,
  'tripCount',(SELECT count(*) FROM safeer.trips t WHERE t.company_id=co.id AND t.status='published' AND t.departure_at>clock_timestamp()))
 FROM safeer.companies co JOIN safeer.company_public_profiles p ON p.company_id=co.id AND p.listed
 WHERE co.status='approved' AND (p_slug IS NULL OR co.slug=p_slug) ORDER BY co.name_en,co.slug LIMIT 200
$$;
REVOKE ALL ON FUNCTION safeer.public_trips(text,text,date,text),safeer.public_cities(),safeer.public_companies(text) FROM PUBLIC;
