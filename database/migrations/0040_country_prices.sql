-- D141 (global plan: prices per country): the Super Administrator keeps one standard price per country
-- (monthly fee, commission and currency). A company without a plan is offered its country's price; the
-- plan and contract stay per company (D82), so a company can still get its own price.
CREATE TABLE safeer.country_prices (
 country_code char(2) PRIMARY KEY CHECK(country_code ~ '^[A-Z]{2}$'),
 monthly_fee_minor bigint NOT NULL CHECK(monthly_fee_minor BETWEEN 0 AND 100000000000),
 commission_bps integer NOT NULL CHECK(commission_bps BETWEEN 0 AND 5000),
 currency char(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_by uuid NOT NULL REFERENCES safeer.users(id)
);
ALTER TABLE safeer.country_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON safeer.country_prices FROM PUBLIC;

CREATE FUNCTION safeer.country_prices_read() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT safeer.company_super() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object('countryCode',country_code::text,'monthlyFeeMinor',monthly_fee_minor::text,'commissionBps',commission_bps,'currency',currency::text,'version',version,'updatedAt',updated_at) ORDER BY country_code) FROM safeer.country_prices),'[]'::jsonb));
END $$;
-- revision 0 creates the country's price; otherwise it must match the current version.
CREATE FUNCTION safeer.country_price_save(code text,fee bigint,bps integer,cur text,revision integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT safeer.company_super() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF code IS NULL OR code !~ '^[A-Z]{2}$' OR cur IS NULL OR cur !~ '^[A-Z]{3}$' OR fee IS NULL OR fee<0 OR fee>100000000000 OR bps IS NULL OR bps<0 OR bps>5000 OR revision IS NULL OR revision<0 THEN RAISE EXCEPTION 'Invalid input' USING ERRCODE='23514'; END IF;
 IF revision=0 THEN
  INSERT INTO safeer.country_prices(country_code,monthly_fee_minor,commission_bps,currency,updated_by) VALUES(code,fee,bps,cur,safeer.company_actor()) ON CONFLICT DO NOTHING;
 ELSE
  UPDATE safeer.country_prices SET monthly_fee_minor=fee,commission_bps=bps,currency=cur,version=version+1,updated_at=clock_timestamp(),updated_by=safeer.company_actor() WHERE country_code=code AND version=revision;
 END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'STALE_VERSION'; END IF;
 INSERT INTO safeer.identity_audit(id,actor_id,action) VALUES(gen_random_uuid(),safeer.company_actor(),'platform.country_price_changed');
 RETURN safeer.country_prices_read();
END $$;
-- The standard price for a company's country, or null when none is set.
CREATE FUNCTION safeer.company_country_price(cid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT safeer.company_super() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 RETURN (SELECT jsonb_build_object('countryCode',p.country_code::text,'monthlyFeeMinor',p.monthly_fee_minor::text,'commissionBps',p.commission_bps,'currency',p.currency::text)
  FROM safeer.company_settings s JOIN safeer.country_prices p ON p.country_code=s.country_code WHERE s.company_id=cid);
END $$;
REVOKE ALL ON FUNCTION safeer.country_prices_read(),safeer.country_price_save(text,bigint,integer,text,integer),safeer.company_country_price(uuid) FROM PUBLIC;
