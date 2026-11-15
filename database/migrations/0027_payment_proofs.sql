-- D93: a bank transfer taken at the counter keeps a photo of the transfer (proof of payment).
-- The image is saved in the same transaction as the payment, read only by staff who may see the booking.
CREATE TABLE safeer.payment_proofs (
 company_id uuid NOT NULL,payment_id uuid NOT NULL,content_type varchar(20) NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
 data bytea NOT NULL CHECK(octet_length(data) BETWEEN 1 AND 393216),uploaded_by uuid NOT NULL REFERENCES safeer.users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,payment_id),FOREIGN KEY(company_id,payment_id) REFERENCES safeer.payments(company_id,id)
);
ALTER TABLE safeer.payment_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON safeer.payment_proofs FROM PUBLIC;

-- Attaches the proof to the booking's bank transfer. A repeated request (same payment) keeps the first image.
CREATE FUNCTION safeer.payment_proof_attach(cid uuid,bid uuid,actor uuid,p_type text,p_data bytea) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p safeer.payments%ROWTYPE;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_has(cid,'company.ticketing.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM safeer.payments WHERE company_id=cid AND booking_id=bid;
 IF NOT FOUND OR p.method<>'bank_transfer' THEN RETURN false; END IF;
 INSERT INTO safeer.payment_proofs(company_id,payment_id,content_type,data,uploaded_by) VALUES(cid,p.id,p_type,p_data,actor) ON CONFLICT DO NOTHING;
 RETURN true;
END $$;

-- Staff who may read bookings (or work the counter) see the proof.
CREATE FUNCTION safeer.payment_proof(cid uuid,bid uuid) RETURNS TABLE(content_type text,data bytea) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT (safeer.company_has(cid,'company.bookings.read') OR safeer.company_has(cid,'company.ticketing.operate')) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT f.content_type::text,f.data FROM safeer.payment_proofs f JOIN safeer.payments p ON (p.company_id,p.id)=(f.company_id,f.payment_id) WHERE p.company_id=cid AND p.booking_id=bid;
END $$;
REVOKE ALL ON FUNCTION safeer.payment_proof_attach(uuid,uuid,uuid,text,bytea),safeer.payment_proof(uuid,uuid) FROM PUBLIC;
