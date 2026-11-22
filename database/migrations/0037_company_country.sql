-- D135 (global-ready): each company has a country and a currency. Existing companies are Sudanese and keep SDG.
-- The country decides how local phone numbers are completed (calling code) and the default currency and time
-- zone offered when the company is set up; trips keep their own currency and time zone.
ALTER TABLE safeer.company_settings
 ADD COLUMN country_code char(2) NOT NULL DEFAULT 'SD' CHECK(country_code ~ '^[A-Z]{2}$'),
 ADD COLUMN currency char(3) NOT NULL DEFAULT 'SDG' CHECK(currency ~ '^[A-Z]{3}$');

-- Country lookups for phone numbers typed before the company is known to the caller. They return only the
-- two-letter country code (or null), never booking or trip details.
CREATE FUNCTION safeer.company_country(cid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT country_code::text FROM safeer.company_settings WHERE company_id=cid
$$;
CREATE FUNCTION safeer.trip_country(tid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT s.country_code::text FROM safeer.trips t JOIN safeer.company_settings s ON s.company_id=t.company_id WHERE t.id=tid
$$;
CREATE FUNCTION safeer.booking_country(ref text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT s.country_code::text FROM safeer.bookings b JOIN safeer.company_settings s ON s.company_id=b.company_id WHERE b.reference=ref
$$;
CREATE FUNCTION safeer.company_currency(cid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT currency::text FROM safeer.company_settings WHERE company_id=cid
$$;

REVOKE ALL ON FUNCTION safeer.company_currency(uuid),safeer.company_country(uuid),safeer.trip_country(uuid),safeer.booking_country(text) FROM PUBLIC;
