-- D142 (global plan: Egypt readiness): station cash sessions and parcel prices use the company currency
-- (safeer.company_currency, D135). Before, every session opened in SDG, so a company in another currency could
-- not take cash at its station (CURRENCY_MISMATCH), and parcel prices fell back to SDG or to the latest trip.
-- Saving a parcel price also moves it to the company's current currency. Sessions already open keep theirs.
CREATE OR REPLACE FUNCTION safeer.open_session(cid uuid,actor uuid,p_counter uuid,p_opening integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c safeer.station_counters%ROWTYPE; s safeer.cash_sessions%ROWTYPE;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM safeer.station_counters WHERE company_id=cid AND id=p_counter FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_can(cid,'company.ticketing.operate',c.branch_id,c.station_id) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT c.active THEN RAISE EXCEPTION 'COUNTER_INACTIVE' USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM safeer.cash_sessions WHERE company_id=cid AND closed_at IS NULL AND (counter_id=p_counter OR opened_by=actor)) THEN RAISE EXCEPTION 'SESSION_OPEN' USING ERRCODE='P0001'; END IF;
 INSERT INTO safeer.cash_sessions(id,company_id,counter_id,branch_id,station_id,opened_by,opening_minor,currency) VALUES(gen_random_uuid(),cid,p_counter,c.branch_id,c.station_id,actor,p_opening,safeer.company_currency(cid)) RETURNING * INTO s;
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id,branch_id,station_id) VALUES(gen_random_uuid(),cid,actor,'session.opened',s.id,s.branch_id,s.station_id);
 RETURN safeer.session_row(s);
END $$;
CREATE OR REPLACE FUNCTION safeer.shipment_price_save(cid uuid,actor uuid,p_category text,p_price integer,p_active boolean,p_version integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p safeer.shipment_prices%ROWTYPE; cur text;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_has(cid,'company.shipments.prices') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM safeer.shipment_prices WHERE company_id=cid AND category=p_category FOR UPDATE;
 IF NOT FOUND THEN
  IF p_version IS NOT NULL THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='P0001'; END IF;
  cur:=safeer.company_currency(cid);
  INSERT INTO safeer.shipment_prices(company_id,category,price_minor,currency,active,updated_by) VALUES(cid,p_category,p_price,cur,p_active,actor) RETURNING * INTO p;
 ELSE
  IF p.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='P0001'; END IF;
  UPDATE safeer.shipment_prices SET price_minor=p_price,active=p_active,currency=safeer.company_currency(cid),updated_by=actor,updated_at=clock_timestamp(),version=version+1 WHERE company_id=cid AND category=p_category RETURNING * INTO p;
 END IF;
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,actor,'shipment.price_saved',cid);
 RETURN jsonb_build_object('category',p.category,'priceMinor',p.price_minor,'currency',p.currency,'active',p.active,'version',p.version);
END $$;
