-- D115: contracts have a fixed term (start and end date) and are locked once issued. A new contract cannot start
-- in the past, an accepted contract stays in force until a newer accepted one starts, and an invoice uses only
-- a contract in force during its month. Existing contracts keep no end date (month to month).
ALTER TABLE safeer.company_billing_plans ADD COLUMN ends_on date;
ALTER TABLE safeer.company_billing_plans ADD CONSTRAINT company_billing_plans_term CHECK(ends_on IS NULL OR ends_on>starts_on);
ALTER TABLE safeer.company_contracts ADD COLUMN ends_on date;
ALTER TABLE safeer.company_contracts ADD CONSTRAINT company_contracts_term CHECK(ends_on IS NULL OR ends_on>starts_on);

-- Issued terms are already fixed by contract_guard (0023). Contracts are also never deleted.
CREATE FUNCTION safeer.contract_no_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Contracts are kept' USING ERRCODE='42501'; END $$;
REVOKE ALL ON FUNCTION safeer.contract_no_delete() FROM PUBLIC;
CREATE TRIGGER contract_no_delete BEFORE DELETE ON safeer.company_contracts FOR EACH ROW EXECUTE FUNCTION safeer.contract_no_delete();

-- Same as 0024, except the contract must also not have ended before the month began.
CREATE OR REPLACE FUNCTION safeer.invoice_issue(p_company uuid,p_month date,p_issuer_name text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE k safeer.company_contracts; month_end date; starts timestamptz; ends timestamptz; pay bigint; ref bigint; net bigint; commission bigint; new_id uuid:=gen_random_uuid();
BEGIN
 IF NOT safeer.company_super() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF p_month IS NULL OR extract(day FROM p_month)<>1 THEN RAISE EXCEPTION 'INVALID_PERIOD'; END IF;
 month_end:=(p_month+interval '1 month')::date-1;
 -- Only finished months: the last day must be over in UTC.
 IF month_end>=(statement_timestamp() AT TIME ZONE 'UTC')::date THEN RAISE EXCEPTION 'INVOICE_PERIOD_OPEN'; END IF;
 PERFORM 1 FROM safeer.companies WHERE id=p_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM safeer.company_invoices WHERE company_id=p_company AND period_month=p_month AND voided_at IS NULL) THEN RAISE EXCEPTION 'INVOICE_EXISTS'; END IF;
 -- The newest accepted contract in force during the month.
 SELECT * INTO k FROM safeer.company_contracts WHERE company_id=p_company AND accepted_at IS NOT NULL AND starts_on<=month_end AND (ends_on IS NULL OR ends_on>=p_month) ORDER BY starts_on DESC,issued_at DESC,id LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVOICE_NO_CONTRACT'; END IF;
 starts:=p_month::timestamp AT TIME ZONE 'UTC';ends:=(month_end+1)::timestamp AT TIME ZONE 'UTC';
 SELECT c.payments,c.refunds INTO pay,ref FROM safeer.company_collections(p_company,k.currency,starts,ends) c;
 net:=greatest(pay-ref,0);
 -- Commission rounds half up to the minor unit.
 commission:=(net*k.commission_bps+5000)/10000;
 INSERT INTO safeer.company_invoices(id,company_id,contract_id,number,period_month,currency,fee_minor,commission_bps,payments_minor,refunds_minor,commission_minor,total_minor,due_on,issued_by,issued_by_name)
  VALUES(new_id,p_company,k.id,'INV-'||to_char(month_end,'YYYY')||'-'||lpad(nextval('safeer.company_invoice_number')::text,5,'0'),p_month,k.currency,k.monthly_fee_minor,k.commission_bps,pay,ref,commission,k.monthly_fee_minor+commission,
   (statement_timestamp() AT TIME ZONE 'UTC')::date+14,safeer.company_actor(),left(coalesce(nullif(btrim(p_issuer_name),''),'Safeer'),100));
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),p_company,safeer.company_actor(),'invoice.issued',new_id);
 INSERT INTO safeer.notification_events(company_id,code,source_id) VALUES(p_company,'invoice.issued',new_id) ON CONFLICT DO NOTHING;
 RETURN new_id;
END $$;
