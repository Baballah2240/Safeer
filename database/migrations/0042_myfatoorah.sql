-- D144 (global plan: Gulf payments): MyFatoorah takes card payments for companies in Kuwait, Saudi Arabia and
-- Qatar; Paymob stays for Egypt. The company's country picks the provider; companies elsewhere cannot start a card
-- checkout. MyFatoorah invoices are stored as provider_order "mf:<InvoiceId>" so they never collide with Paymob ids.
ALTER TABLE safeer.card_checkouts DROP CONSTRAINT card_checkouts_provider_check;
ALTER TABLE safeer.card_checkouts ADD CONSTRAINT card_checkouts_provider_check CHECK(provider IN ('paymob','myfatoorah'));
CREATE OR REPLACE FUNCTION safeer.card_checkout_start(ref text,p_access text,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b safeer.bookings%ROWTYPE; card boolean; c record; country text; provider text;
BEGIN
 SELECT * INTO b FROM safeer.bookings WHERE reference=ref AND access_hash=p_access;
 IF NOT FOUND THEN RETURN NULL; END IF;
 PERFORM safeer.expire_trip_holds(b.company_id,b.trip_id);
 SELECT * INTO b FROM safeer.bookings WHERE id=b.id;
 SELECT p.card INTO card FROM safeer.company_payment_settings p WHERE p.company_id=b.company_id;
 IF NOT COALESCE(card,false) THEN RAISE EXCEPTION 'METHOD_DISABLED' USING ERRCODE='P0001'; END IF;
 country:=safeer.company_country(b.company_id);
 provider:=CASE WHEN country='EG' THEN 'paymob' WHEN country IN ('KW','SA','QA') THEN 'myfatoorah' END;
 IF provider IS NULL THEN RAISE EXCEPTION 'METHOD_DISABLED' USING ERRCODE='P0001'; END IF;
 IF b.status IN ('confirmed','refunded') THEN RAISE EXCEPTION 'ALREADY_PAID' USING ERRCODE='P0001'; END IF;
 IF b.status<>'held' THEN RAISE EXCEPTION 'HOLD_CLOSED' USING ERRCODE='P0001'; END IF;
 INSERT INTO safeer.card_checkouts(id,company_id,booking_id,provider,amount_minor,currency) VALUES(p_id,b.company_id,b.id,provider,b.amount_minor,b.currency);
 SELECT co.name_en,co.name_ar INTO c FROM safeer.companies co WHERE co.id=b.company_id;
 RETURN jsonb_build_object('provider',provider,'countryCode',country,'checkoutId',p_id,'amountMinor',b.amount_minor,'currency',b.currency,'reference',b.reference,'companyEn',c.name_en);
END $$;
-- What a provider callback needs before Safeer asks the provider: the booking reference, the company's country
-- (which account to ask) and the checkout state. No passenger data.
CREATE FUNCTION safeer.card_checkout_peek(p_order text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('reference',b.reference,'countryCode',safeer.company_country(k.company_id),'status',k.status,'provider',k.provider,'checkoutId',k.id)
 FROM safeer.card_checkouts k JOIN safeer.bookings b ON (b.company_id,b.id)=(k.company_id,k.booking_id) WHERE k.provider_order=p_order
$$;
-- Which provider serves a company's country (null when none), for the staff Payment methods screen.
CREATE FUNCTION safeer.card_provider(country text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT CASE WHEN country='EG' THEN 'paymob' WHEN country IN ('KW','SA','QA') THEN 'myfatoorah' END
$$;
REVOKE ALL ON FUNCTION safeer.card_checkout_peek(text),safeer.card_provider(text) FROM PUBLIC;
