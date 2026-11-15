-- D87: monthly invoices for the D82 plans. For each finished calendar month (UTC, like the platform dashboard) the
-- Safeer owner issues one invoice per company from its accepted contract: the monthly fee plus the commission on
-- net collections (ticket and parcel payments minus ticket refunds) in the contract currency. The database works
-- out the amounts so they always match the recorded payments; the invoice is a fixed snapshot. Payment is due in
-- 14 days. The owner marks it paid (with a reference) or voids it with a reason; a voided month can be reissued.
CREATE SEQUENCE safeer.company_invoice_number;
REVOKE ALL ON SEQUENCE safeer.company_invoice_number FROM PUBLIC;
CREATE TABLE safeer.company_invoices (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES safeer.companies(id),
 contract_id uuid NOT NULL REFERENCES safeer.company_contracts(id),
 number varchar(20) NOT NULL UNIQUE,
 period_month date NOT NULL CHECK(extract(day FROM period_month)=1),
 currency char(3) NOT NULL,
 fee_minor bigint NOT NULL CHECK(fee_minor>=0),
 commission_bps integer NOT NULL CHECK(commission_bps BETWEEN 0 AND 5000),
 payments_minor bigint NOT NULL CHECK(payments_minor>=0),
 refunds_minor bigint NOT NULL CHECK(refunds_minor>=0),
 commission_minor bigint NOT NULL CHECK(commission_minor>=0),
 total_minor bigint NOT NULL CHECK(total_minor=fee_minor+commission_minor),
 due_on date NOT NULL,
 issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 issued_by uuid NOT NULL REFERENCES safeer.users(id),issued_by_name varchar(100) NOT NULL,
 paid_at timestamptz,paid_by uuid REFERENCES safeer.users(id),paid_reference varchar(100),
 voided_at timestamptz,voided_by uuid REFERENCES safeer.users(id),void_reason varchar(300),
 CHECK((paid_at IS NULL)=(paid_by IS NULL) AND (paid_at IS NULL)=(paid_reference IS NULL)),
 CHECK((voided_at IS NULL)=(voided_by IS NULL) AND (voided_at IS NULL)=(void_reason IS NULL)),
 CHECK(paid_at IS NULL OR voided_at IS NULL)
);
-- One live invoice per company and month.
CREATE UNIQUE INDEX company_invoices_month ON safeer.company_invoices(company_id,period_month) WHERE voided_at IS NULL;
CREATE INDEX company_invoices_recent ON safeer.company_invoices(company_id,period_month DESC,issued_at DESC);
ALTER TABLE safeer.company_invoices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON safeer.company_invoices FROM PUBLIC;
-- Read like contracts; every write goes through the functions below (the runtime role has SELECT only).
CREATE POLICY invoice_read ON safeer.company_invoices FOR SELECT USING(safeer.company_super() OR safeer.company_can(company_id,'company.profile.manage'));

-- Net collections of one company in one currency over [starts, ends).
CREATE FUNCTION safeer.company_collections(p_company uuid,p_currency text,starts timestamptz,ends timestamptz,OUT payments bigint,OUT refunds bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT
  coalesce((SELECT sum(amount_minor) FROM safeer.payments WHERE company_id=p_company AND currency=p_currency AND created_at>=starts AND created_at<ends),0)
  +coalesce((SELECT sum(amount_minor) FROM safeer.shipment_payments WHERE company_id=p_company AND currency=p_currency AND created_at>=starts AND created_at<ends),0),
  coalesce((SELECT sum(amount_minor) FROM safeer.refunds WHERE company_id=p_company AND currency=p_currency AND created_at>=starts AND created_at<ends),0)
$$;

CREATE FUNCTION safeer.invoice_issue(p_company uuid,p_month date,p_issuer_name text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
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
 SELECT * INTO k FROM safeer.company_contracts WHERE company_id=p_company AND accepted_at IS NOT NULL AND starts_on<=month_end ORDER BY issued_at DESC,id LIMIT 1;
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

CREATE FUNCTION safeer.invoice_settle(p_company uuid,p_invoice uuid,p_action text,p_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE i safeer.company_invoices; note text:=btrim(coalesce(p_note,''));
BEGIN
 IF NOT safeer.company_super() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF p_action NOT IN ('paid','void') OR note='' OR length(note)>(CASE WHEN p_action='paid' THEN 100 ELSE 300 END) OR note ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
 SELECT * INTO i FROM safeer.company_invoices WHERE company_id=p_company AND id=p_invoice FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF i.paid_at IS NOT NULL OR i.voided_at IS NOT NULL THEN RAISE EXCEPTION 'INVOICE_CLOSED'; END IF;
 IF p_action='paid' THEN
  UPDATE safeer.company_invoices SET paid_at=clock_timestamp(),paid_by=safeer.company_actor(),paid_reference=note WHERE id=p_invoice;
  INSERT INTO safeer.notification_events(company_id,code,source_id) VALUES(p_company,'invoice.paid',p_invoice) ON CONFLICT DO NOTHING;
 ELSE
  UPDATE safeer.company_invoices SET voided_at=clock_timestamp(),voided_by=safeer.company_actor(),void_reason=note WHERE id=p_invoice;
 END IF;
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),p_company,safeer.company_actor(),'invoice.'||p_action,p_invoice);
END $$;

-- Invoice events reach the same people as contracts.
ALTER TABLE safeer.notification_events DROP CONSTRAINT notification_events_code_check;
ALTER TABLE safeer.notification_events ADD CONSTRAINT notification_events_code_check CHECK(code IN ('company.registered','company.status','marketplace.changed','trip.canceled','journey.incident','cash.difference','luggage.exception','contract.issued','contract.accepted','invoice.issued','invoice.paid'));
CREATE OR REPLACE FUNCTION safeer.notification_visible(n safeer.notification_events) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF safeer.company_actor() IS NULL OR n.created_at<statement_timestamp()-interval '90 days' THEN RETURN false; END IF;
 IF safeer.company_super() THEN RETURN true; END IF;
 -- D82/D87: contracts and invoices reach the company's profile managers (company_can: approved companies only).
 IF n.code IN ('contract.issued','contract.accepted','invoice.issued','invoice.paid') THEN RETURN safeer.company_can(n.company_id,'company.profile.manage'); END IF;
 IF NOT EXISTS(SELECT 1 FROM safeer.companies WHERE id=n.company_id AND status='approved') THEN RETURN false; END IF;
 CASE n.code
 WHEN 'trip.canceled' THEN RETURN safeer.company_can(n.company_id,'company.trips.read') OR safeer.journey_allowed(n.company_id,n.source_id);
 WHEN 'journey.incident' THEN RETURN safeer.company_can(n.company_id,'company.journeys.manage');
 WHEN 'cash.difference' THEN RETURN EXISTS(SELECT 1 FROM safeer.cash_sessions s WHERE s.company_id=n.company_id AND s.id=n.source_id AND safeer.company_can(n.company_id,'company.finance.read',s.branch_id,s.station_id));
 WHEN 'luggage.exception' THEN RETURN safeer.company_can(n.company_id,'company.luggage.resolve');
 ELSE RETURN false;
 END CASE;
END $$;

REVOKE ALL ON FUNCTION safeer.company_collections(uuid,text,timestamptz,timestamptz),safeer.invoice_issue(uuid,date,text),safeer.invoice_settle(uuid,uuid,text,text) FROM PUBLIC;
