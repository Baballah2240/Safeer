-- D59 shipments: parcels sent without a traveler. Fixed price per item type, paid by the
-- sender at drop-off into the open cash session, delivered against receiver phone and name.
INSERT INTO safeer.permissions(code,module) VALUES ('company.shipments.operate','company'),('company.shipments.resolve','company'),('company.shipments.prices','company');
INSERT INTO safeer.role_permissions(role_id,permission_code)
 SELECT r.id,p FROM safeer.roles r CROSS JOIN unnest(ARRAY['company.shipments.operate','company.shipments.resolve']) p WHERE r.code IN ('company_administrator','branch_manager','station_manager') ON CONFLICT DO NOTHING;
INSERT INTO safeer.role_permissions(role_id,permission_code)
 SELECT r.id,'company.shipments.prices' FROM safeer.roles r WHERE r.code IN ('company_administrator','branch_manager') ON CONFLICT DO NOTHING;
INSERT INTO safeer.role_permissions(role_id,permission_code)
 SELECT r.id,'company.shipments.operate' FROM safeer.roles r WHERE r.code='ticketing_employee' ON CONFLICT DO NOTHING;
UPDATE safeer.roles SET version=version+1 WHERE code IN ('company_administrator','branch_manager','station_manager','ticketing_employee');
ALTER TABLE safeer.document_sequences DROP CONSTRAINT document_sequences_document_type_check;
ALTER TABLE safeer.document_sequences ADD CONSTRAINT document_sequences_document_type_check CHECK(document_type IN ('ticket','receipt','refund','luggage','tag','shipment','shipment_tag'));

CREATE TABLE safeer.shipment_prices (
 company_id uuid NOT NULL REFERENCES safeer.companies(id),category varchar(10) NOT NULL CHECK(category IN ('envelope','small','large','other')),
 price_minor integer NOT NULL CHECK(price_minor BETWEEN 1 AND 100000000),currency varchar(3) NOT NULL DEFAULT 'SDG' CHECK(currency ~ '^[A-Z]{3}$'),
 active boolean NOT NULL DEFAULT true,updated_by uuid NOT NULL REFERENCES safeer.users(id),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),version integer NOT NULL DEFAULT 1 CHECK(version>0),
 PRIMARY KEY(company_id,category)
);
-- Personal details sit on the shipment and are erased 90 days after the trip arrives.
CREATE TABLE safeer.shipments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,shipment_number varchar(16) NOT NULL,tracking_code varchar(11) NOT NULL UNIQUE CHECK(tracking_code ~ '^SH-[2-9A-HJ-NP-Z]{8}$'),
 trip_id uuid NOT NULL,origin_station_id uuid NOT NULL,destination_station_id uuid NOT NULL CHECK(destination_station_id<>origin_station_id),
 sender_name varchar(100),sender_mobile varchar(16),receiver_name varchar(100),receiver_mobile varchar(16),
 item_count smallint NOT NULL CHECK(item_count BETWEEN 1 AND 20),amount_minor integer NOT NULL CHECK(amount_minor>0),currency varchar(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 lifecycle varchar(10) NOT NULL DEFAULT 'received' CHECK(lifecycle IN ('received','loaded','in_transit','arrived','delivered','returned','lost')),
 contents_declared boolean NOT NULL CHECK(contents_declared),created_by uuid NOT NULL REFERENCES safeer.users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 delivered_by uuid REFERENCES safeer.users(id),delivered_at timestamptz,erase_at timestamptz NOT NULL,erased_at timestamptz,
 key_hash char(64) NOT NULL,request_hash char(64) NOT NULL,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 CHECK((delivered_at IS NULL)=(delivered_by IS NULL)),
 CHECK(erased_at IS NOT NULL OR (sender_name IS NOT NULL AND sender_mobile IS NOT NULL AND receiver_name IS NOT NULL AND receiver_mobile IS NOT NULL)),
 UNIQUE(company_id,id),UNIQUE(company_id,shipment_number),UNIQUE(company_id,key_hash),
 FOREIGN KEY(company_id,trip_id) REFERENCES safeer.trips(company_id,id),
 FOREIGN KEY(company_id,origin_station_id) REFERENCES safeer.stations(company_id,id),
 FOREIGN KEY(company_id,destination_station_id) REFERENCES safeer.stations(company_id,id)
);
CREATE INDEX shipments_trip ON safeer.shipments(company_id,trip_id);
CREATE INDEX shipments_recent ON safeer.shipments(company_id,created_at DESC);
CREATE INDEX shipments_erase ON safeer.shipments(erase_at) WHERE erased_at IS NULL;
CREATE TABLE safeer.shipment_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,shipment_id uuid NOT NULL,position smallint NOT NULL CHECK(position BETWEEN 1 AND 20),
 category varchar(10) NOT NULL CHECK(category IN ('envelope','small','large','other')),description varchar(200),weight_grams integer NOT NULL CHECK(weight_grams BETWEEN 1 AND 500000),price_minor integer NOT NULL CHECK(price_minor>0),
 UNIQUE(company_id,shipment_id,position),FOREIGN KEY(company_id,shipment_id) REFERENCES safeer.shipments(company_id,id)
);
CREATE TABLE safeer.shipment_tags (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,shipment_id uuid NOT NULL,tag_number varchar(16) NOT NULL,qr_hash char(64) NOT NULL UNIQUE,issued_by uuid NOT NULL REFERENCES safeer.users(id),issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),replaced_at timestamptz,
 UNIQUE(company_id,tag_number),FOREIGN KEY(company_id,shipment_id) REFERENCES safeer.shipments(company_id,id)
);
CREATE UNIQUE INDEX shipment_tags_current ON safeer.shipment_tags(company_id,shipment_id) WHERE replaced_at IS NULL;
CREATE TABLE safeer.shipment_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,company_id uuid NOT NULL,shipment_id uuid NOT NULL,
 event varchar(20) NOT NULL CHECK(event IN ('received','tagged','tag_replaced','moved','corrected','delivered','returned','exception_reported','exception_resolved')),
 from_state varchar(10),to_state varchar(10),actor_id uuid NOT NULL REFERENCES safeer.users(id),reason varchar(300),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(company_id,shipment_id) REFERENCES safeer.shipments(company_id,id)
);
CREATE INDEX shipment_events_parcel ON safeer.shipment_events(company_id,shipment_id,created_at);
CREATE TABLE safeer.shipment_exceptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,shipment_id uuid NOT NULL,kind varchar(10) NOT NULL CHECK(kind IN ('damaged','missing','wrong_bus','other')),note varchar(300),reported_by uuid NOT NULL REFERENCES safeer.users(id),reported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 resolved_by uuid REFERENCES safeer.users(id),resolved_at timestamptz,outcome varchar(10) CHECK(outcome IN ('found','settled','closed')),resolution_note varchar(300),
 CHECK((resolved_at IS NULL)=(resolved_by IS NULL)),CHECK((resolved_at IS NULL)=(outcome IS NULL)),
 UNIQUE(company_id,id),FOREIGN KEY(company_id,shipment_id) REFERENCES safeer.shipments(company_id,id)
);
CREATE UNIQUE INDEX shipment_exceptions_open ON safeer.shipment_exceptions(company_id,shipment_id) WHERE resolved_at IS NULL;
-- The fee is taken into the operator's open cash session, exactly like a ticket payment.
CREATE TABLE safeer.shipment_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,shipment_id uuid NOT NULL,session_id uuid NOT NULL,method varchar(14) NOT NULL CHECK(method IN ('cash','bank_transfer','mobile_wallet')),method_reference varchar(100),
 amount_minor integer NOT NULL CHECK(amount_minor>0),currency varchar(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),taken_by uuid NOT NULL REFERENCES safeer.users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),receipt_number varchar(16) NOT NULL,
 CHECK(method='cash' OR method_reference IS NOT NULL),
 UNIQUE(company_id,id),UNIQUE(company_id,shipment_id),UNIQUE(company_id,receipt_number),
 FOREIGN KEY(company_id,shipment_id) REFERENCES safeer.shipments(company_id,id),FOREIGN KEY(company_id,session_id) REFERENCES safeer.cash_sessions(company_id,id)
);
CREATE INDEX shipment_payments_session ON safeer.shipment_payments(company_id,session_id);
CREATE INDEX shipment_payments_posted ON safeer.shipment_payments(company_id,created_at DESC,id);
CREATE INDEX shipment_payments_global_posted ON safeer.shipment_payments(created_at,company_id);
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['shipment_prices','shipments','shipment_items','shipment_tags','shipment_events','shipment_exceptions','shipment_payments'] LOOP
  EXECUTE format('ALTER TABLE safeer.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON safeer.%I FROM PUBLIC',t);
 END LOOP;
END $$;

-- History is append-only. Erasure may clear personal text; a tag may only be marked replaced.
CREATE FUNCTION safeer.shipment_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Immutable shipment history' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME IN ('shipment_items','shipment_payments') THEN
  IF TG_TABLE_NAME='shipment_items' AND to_jsonb(NEW)->>'description' IS NULL AND (to_jsonb(NEW)-'description') IS NOT DISTINCT FROM (to_jsonb(OLD)-'description') THEN RETURN NEW; END IF;
 ELSIF TG_TABLE_NAME='shipment_events' THEN
  IF to_jsonb(NEW)->>'reason' IS NULL AND (to_jsonb(NEW)-'reason') IS NOT DISTINCT FROM (to_jsonb(OLD)-'reason') THEN RETURN NEW; END IF;
 ELSIF TG_TABLE_NAME='shipment_tags' THEN
  IF to_jsonb(OLD)->>'replaced_at' IS NULL AND (to_jsonb(NEW)-'replaced_at') IS NOT DISTINCT FROM (to_jsonb(OLD)-'replaced_at') THEN RETURN NEW; END IF;
 ELSIF TG_TABLE_NAME='shipment_exceptions' THEN
  IF to_jsonb(OLD)->>'resolved_at' IS NULL AND (to_jsonb(NEW)-ARRAY['resolved_by','resolved_at','outcome','resolution_note','note']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['resolved_by','resolved_at','outcome','resolution_note','note']) THEN RETURN NEW; END IF;
  IF to_jsonb(NEW)->>'note' IS NULL AND to_jsonb(NEW)->>'resolution_note' IS NULL AND (to_jsonb(NEW)-ARRAY['note','resolution_note']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['note','resolution_note']) THEN RETURN NEW; END IF;
 ELSE
  IF (to_jsonb(NEW)-ARRAY['lifecycle','version','delivered_by','delivered_at','sender_name','sender_mobile','receiver_name','receiver_mobile','erased_at']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['lifecycle','version','delivered_by','delivered_at','sender_name','sender_mobile','receiver_name','receiver_mobile','erased_at'])
   AND (OLD.erased_at IS NULL OR NEW.erased_at IS NOT DISTINCT FROM OLD.erased_at)
   AND (NEW.erased_at IS NULL OR (NEW.sender_name IS NULL AND NEW.sender_mobile IS NULL AND NEW.receiver_name IS NULL AND NEW.receiver_mobile IS NULL))
   AND (NEW.erased_at IS NOT NULL OR ((NEW.sender_name,NEW.sender_mobile,NEW.receiver_name,NEW.receiver_mobile) IS NOT DISTINCT FROM (OLD.sender_name,OLD.sender_mobile,OLD.receiver_name,OLD.receiver_mobile))) THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'Immutable shipment history' USING ERRCODE='42501';
END $$;
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['shipments','shipment_items','shipment_tags','shipment_events','shipment_exceptions','shipment_payments'] LOOP
  EXECUTE format('CREATE TRIGGER shipment_guard BEFORE UPDATE OR DELETE ON safeer.%I FOR EACH ROW EXECUTE FUNCTION safeer.shipment_guard()',t);
 END LOOP;
END $$;

CREATE FUNCTION safeer.shipment_status(s safeer.shipments) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM safeer.shipment_exceptions e WHERE e.company_id=s.company_id AND e.shipment_id=s.id AND e.resolved_at IS NULL) THEN 'exception_reported' ELSE s.lifecycle END
$$;
CREATE FUNCTION safeer.shipment_name(value text) RETURNS text LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT lower(regexp_replace(btrim(value),'\s+',' ','g'))
$$;
-- Staff view: everything needed at the counter. Erased shipments keep only operational facts.
CREATE FUNCTION safeer.shipment_row(s safeer.shipments) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',s.id,'number',s.shipment_number,'trackingCode',s.tracking_code,'tripId',s.trip_id,'status',safeer.shipment_status(s),'lifecycle',s.lifecycle,'version',s.version,
  'routeNameEn',t.route_name_en,'routeNameAr',t.route_name_ar,'departureAt',t.departure_at,'arrivalAt',t.arrival_at,'timezone',t.timezone,'tripStatus',t.status,
  'originId',s.origin_station_id,'originEn',o.name_en,'originAr',o.name_ar,'destinationId',s.destination_station_id,'destinationEn',d.name_en,'destinationAr',d.name_ar,
  'senderName',s.sender_name,'senderMobile',s.sender_mobile,'receiverName',s.receiver_name,'receiverMobile',s.receiver_mobile,'detailsErased',s.erased_at IS NOT NULL,
  'itemCount',s.item_count,'amountMinor',s.amount_minor,'currency',s.currency,'createdAt',s.created_at,'deliveredAt',s.delivered_at,
  'items',(SELECT coalesce(jsonb_agg(jsonb_build_object('category',i.category,'description',i.description,'weightGrams',i.weight_grams,'priceMinor',i.price_minor) ORDER BY i.position),'[]'::jsonb) FROM safeer.shipment_items i WHERE i.company_id=s.company_id AND i.shipment_id=s.id),
  'payment',(SELECT jsonb_build_object('method',p.method,'receiptNumber',p.receipt_number,'at',p.created_at) FROM safeer.shipment_payments p WHERE p.company_id=s.company_id AND p.shipment_id=s.id),
  'tagNumber',(SELECT g.tag_number FROM safeer.shipment_tags g WHERE g.company_id=s.company_id AND g.shipment_id=s.id AND g.replaced_at IS NULL),
  'exception',(SELECT jsonb_build_object('id',e.id,'kind',e.kind,'note',e.note,'reportedAt',e.reported_at) FROM safeer.shipment_exceptions e WHERE e.company_id=s.company_id AND e.shipment_id=s.id AND e.resolved_at IS NULL),
  'events',(SELECT coalesce(jsonb_agg(jsonb_build_object('event',v.event,'from',v.from_state,'to',v.to_state,'reason',v.reason,'at',v.created_at) ORDER BY v.created_at,v.id),'[]'::jsonb) FROM safeer.shipment_events v WHERE v.company_id=s.company_id AND v.shipment_id=s.id))
 FROM safeer.trips t JOIN safeer.stations o ON (o.company_id,o.id)=(s.company_id,s.origin_station_id) JOIN safeer.stations d ON (d.company_id,d.id)=(s.company_id,s.destination_station_id)
 WHERE (t.company_id,t.id)=(s.company_id,s.trip_id)
$$;

CREATE FUNCTION safeer.shipment_options(cid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT (safeer.company_has(cid,'company.shipments.operate') OR safeer.company_has(cid,'company.shipments.prices') OR safeer.company_has(cid,'company.shipments.resolve')) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
  'prices',(SELECT coalesce(jsonb_agg(jsonb_build_object('category',p.category,'priceMinor',p.price_minor,'currency',p.currency,'active',p.active,'version',p.version) ORDER BY p.category),'[]'::jsonb) FROM safeer.shipment_prices p WHERE p.company_id=cid),
  'stations',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'nameEn',s.name_en,'nameAr',s.name_ar) ORDER BY s.name_en),'[]'::jsonb) FROM safeer.stations s WHERE s.company_id=cid AND s.active),
  'trips',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'routeNameEn',t.route_name_en,'routeNameAr',t.route_name_ar,'departureAt',t.departure_at,'timezone',t.timezone) ORDER BY t.departure_at),'[]'::jsonb) FROM (SELECT * FROM safeer.trips WHERE company_id=cid AND status='published' AND departure_at>clock_timestamp() ORDER BY departure_at LIMIT 100) t),
  'session',(SELECT jsonb_build_object('id',s.id,'stationId',s.station_id,'currency',s.currency) FROM safeer.cash_sessions s WHERE s.company_id=cid AND s.opened_by=safeer.company_actor() AND s.closed_at IS NULL));
END $$;

CREATE FUNCTION safeer.shipment_price_save(cid uuid,actor uuid,p_category text,p_price integer,p_active boolean,p_version integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p safeer.shipment_prices%ROWTYPE; cur text;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_has(cid,'company.shipments.prices') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM safeer.shipment_prices WHERE company_id=cid AND category=p_category FOR UPDATE;
 IF NOT FOUND THEN
  IF p_version IS NOT NULL THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='P0001'; END IF;
  SELECT coalesce((SELECT currency FROM safeer.trips WHERE company_id=cid ORDER BY departure_at DESC LIMIT 1),'SDG') INTO cur;
  INSERT INTO safeer.shipment_prices(company_id,category,price_minor,currency,active,updated_by) VALUES(cid,p_category,p_price,cur,p_active,actor) RETURNING * INTO p;
 ELSE
  IF p.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='P0001'; END IF;
  UPDATE safeer.shipment_prices SET price_minor=p_price,active=p_active,updated_by=actor,updated_at=clock_timestamp(),version=version+1 WHERE company_id=cid AND category=p_category RETURNING * INTO p;
 END IF;
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,actor,'shipment.price_saved',cid);
 RETURN jsonb_build_object('category',p.category,'priceMinor',p.price_minor,'currency',p.currency,'active',p.active,'version',p.version);
END $$;

-- Shipment, items, payment and receipt commit together. A repeated key returns the original.
CREATE FUNCTION safeer.shipment_create(cid uuid,actor uuid,p_trip uuid,p_destination uuid,p_sender_name text,p_sender_mobile text,p_receiver_name text,p_receiver_mobile text,p_items jsonb,p_method text,p_reference text,p_declared boolean,p_code text,p_key text,p_request text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s safeer.cash_sessions%ROWTYPE; t safeer.trips%ROWTYPE; x safeer.shipments%ROWTYPE; pay safeer.company_payment_settings%ROWTYPE; n integer; total bigint; missing integer;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_has(cid,'company.shipments.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO x FROM safeer.shipments WHERE company_id=cid AND key_hash=p_key;
 IF FOUND THEN
  IF x.request_hash<>p_request THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001'; END IF;
  RETURN safeer.shipment_row(x);
 END IF;
 IF NOT p_declared THEN RAISE EXCEPTION 'CONTENTS_NOT_DECLARED' USING ERRCODE='P0001'; END IF;
 SELECT * INTO s FROM safeer.cash_sessions WHERE company_id=cid AND opened_by=actor AND closed_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NO_OPEN_SESSION' USING ERRCODE='P0001'; END IF;
 IF NOT safeer.company_can(cid,'company.shipments.operate',s.branch_id,s.station_id) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO t FROM safeer.trips WHERE company_id=cid AND id=p_trip FOR NO KEY UPDATE;
 IF NOT FOUND OR t.status<>'published' OR t.departure_at<=clock_timestamp() THEN RAISE EXCEPTION 'TRIP_NOT_BOOKABLE' USING ERRCODE='P0001'; END IF;
 IF p_destination=s.station_id OR NOT EXISTS(SELECT 1 FROM safeer.stations WHERE company_id=cid AND id=p_destination AND active) THEN RAISE EXCEPTION 'INVALID_DESTINATION' USING ERRCODE='P0001'; END IF;
 SELECT * INTO pay FROM safeer.company_payment_settings WHERE company_id=cid;
 IF (p_method='bank_transfer' AND NOT COALESCE(pay.bank_transfer,false)) OR (p_method='mobile_wallet' AND NOT COALESCE(pay.mobile_wallet,false)) THEN RAISE EXCEPTION 'METHOD_DISABLED' USING ERRCODE='P0001'; END IF;
 n:=jsonb_array_length(p_items);
 IF n NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'INVALID_ITEMS' USING ERRCODE='P0001'; END IF;
 SELECT count(*) INTO missing FROM jsonb_to_recordset(p_items) AS i(category text) LEFT JOIN safeer.shipment_prices p ON p.company_id=cid AND p.category=i.category AND p.active AND p.currency=s.currency WHERE p.category IS NULL;
 IF missing>0 THEN RAISE EXCEPTION 'PRICE_MISSING' USING ERRCODE='P0001'; END IF;
 SELECT sum(p.price_minor) INTO total FROM jsonb_to_recordset(p_items) AS i(category text) JOIN safeer.shipment_prices p ON p.company_id=cid AND p.category=i.category;
 IF total>2000000000 THEN RAISE EXCEPTION 'INVALID_ITEMS' USING ERRCODE='P0001'; END IF;
 INSERT INTO safeer.shipments(company_id,shipment_number,tracking_code,trip_id,origin_station_id,destination_station_id,sender_name,sender_mobile,receiver_name,receiver_mobile,item_count,amount_minor,currency,contents_declared,created_by,erase_at,key_hash,request_hash)
  VALUES(cid,safeer.next_document(cid,'shipment','SHP'),p_code,t.id,s.station_id,p_destination,p_sender_name,p_sender_mobile,p_receiver_name,p_receiver_mobile,n,total,s.currency,true,actor,t.arrival_at+interval '90 days',p_key,p_request) RETURNING * INTO x;
 INSERT INTO safeer.shipment_items(company_id,shipment_id,position,category,description,weight_grams,price_minor)
  SELECT cid,x.id,i.ord,i.category,i.description,i.grams,p.price_minor FROM ROWS FROM(jsonb_to_recordset(p_items) AS (category text,description text,grams integer)) WITH ORDINALITY AS i(category,description,grams,ord)
  JOIN safeer.shipment_prices p ON p.company_id=cid AND p.category=i.category;
 INSERT INTO safeer.shipment_payments(company_id,shipment_id,session_id,method,method_reference,amount_minor,currency,taken_by,receipt_number)
  VALUES(cid,x.id,s.id,p_method,p_reference,total,s.currency,actor,safeer.next_document(cid,'receipt','RCP'));
 INSERT INTO safeer.shipment_events(company_id,shipment_id,event,to_state,actor_id) VALUES(cid,x.id,'received','received',actor);
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id,branch_id,station_id) VALUES(gen_random_uuid(),cid,actor,'shipment.received',x.id,s.branch_id,s.station_id);
 RETURN safeer.shipment_row(x);
END $$;

CREATE FUNCTION safeer.shipment_find(cid uuid,p_query text,p_token text,p_trip uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT (safeer.company_has(cid,'company.shipments.operate') OR safeer.company_has(cid,'company.shipments.resolve')) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('items',coalesce((SELECT jsonb_agg(safeer.shipment_row(s) ORDER BY s.created_at DESC) FROM (
  SELECT x.* FROM safeer.shipments x WHERE x.company_id=cid
   AND (p_trip IS NULL OR x.trip_id=p_trip)
   AND (p_query IS NULL OR x.shipment_number=p_query OR x.tracking_code=p_query
    OR EXISTS(SELECT 1 FROM safeer.shipment_tags g WHERE g.company_id=cid AND g.shipment_id=x.id AND g.tag_number=p_query)
    OR EXISTS(SELECT 1 FROM safeer.shipment_payments p WHERE p.company_id=cid AND p.shipment_id=x.id AND p.receipt_number=p_query))
   AND (p_token IS NULL OR EXISTS(SELECT 1 FROM safeer.shipment_tags g WHERE g.company_id=cid AND g.shipment_id=x.id AND g.qr_hash=p_token AND g.replaced_at IS NULL))
  ORDER BY x.created_at DESC LIMIT 50) s),'[]'::jsonb));
END $$;

CREATE FUNCTION safeer.shipment_tag(cid uuid,actor uuid,sid uuid,p_hash text,why text,p_version integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE x safeer.shipments%ROWTYPE; g safeer.shipment_tags%ROWTYPE; had boolean;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_has(cid,'company.shipments.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO x FROM safeer.shipments WHERE company_id=cid AND id=sid FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF x.lifecycle IN ('delivered','returned','lost') THEN RAISE EXCEPTION 'SHIPMENT_STATE' USING ERRCODE='P0001'; END IF;
 had:=EXISTS(SELECT 1 FROM safeer.shipment_tags WHERE company_id=cid AND shipment_id=sid AND replaced_at IS NULL);
 IF had AND why IS NULL THEN RAISE EXCEPTION 'TAG_REASON_REQUIRED' USING ERRCODE='P0001'; END IF;
 IF had AND p_version IS DISTINCT FROM x.version THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='P0001'; END IF;
 UPDATE safeer.shipment_tags SET replaced_at=clock_timestamp() WHERE company_id=cid AND shipment_id=sid AND replaced_at IS NULL;
 INSERT INTO safeer.shipment_tags(company_id,shipment_id,tag_number,qr_hash,issued_by) VALUES(cid,sid,safeer.next_document(cid,'shipment_tag','SPT'),p_hash,actor) RETURNING * INTO g;
 UPDATE safeer.shipments SET version=version+1 WHERE company_id=cid AND id=sid RETURNING * INTO x;
 INSERT INTO safeer.shipment_events(company_id,shipment_id,event,from_state,to_state,actor_id,reason) VALUES(cid,sid,CASE WHEN had THEN 'tag_replaced' ELSE 'tagged' END,x.lifecycle,x.lifecycle,actor,why);
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,actor,CASE WHEN had THEN 'shipment.tag_replaced' ELSE 'shipment.tagged' END,sid);
 RETURN jsonb_build_object('tagNumber',g.tag_number,'row',safeer.shipment_row(x));
END $$;

-- received -> loaded -> in_transit -> arrived; loaded -> received is a correction with a reason.
CREATE FUNCTION safeer.shipment_move(cid uuid,actor uuid,sid uuid,p_to text,why text,p_version integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE x safeer.shipments%ROWTYPE; t safeer.trips%ROWTYPE; was text; back boolean;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_has(cid,'company.shipments.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO x FROM safeer.shipments WHERE company_id=cid AND id=sid FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF x.version<>p_version THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='P0001'; END IF;
 was:=x.lifecycle;back:=was='loaded' AND p_to='received';
 IF NOT (back OR (was,p_to) IN (('received','loaded'),('loaded','in_transit'),('in_transit','arrived'))) THEN RAISE EXCEPTION 'SHIPMENT_STATE' USING ERRCODE='P0001'; END IF;
 IF back AND why IS NULL THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='P0001'; END IF;
 IF p_to='loaded' AND NOT EXISTS(SELECT 1 FROM safeer.shipment_tags WHERE company_id=cid AND shipment_id=sid AND replaced_at IS NULL) THEN RAISE EXCEPTION 'TAG_REQUIRED' USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM safeer.shipment_exceptions WHERE company_id=cid AND shipment_id=sid AND resolved_at IS NULL) AND NOT back THEN RAISE EXCEPTION 'SHIPMENT_EXCEPTION_OPEN' USING ERRCODE='P0001'; END IF;
 SELECT * INTO t FROM safeer.trips WHERE company_id=cid AND id=x.trip_id;
 IF p_to IN ('loaded','in_transit') AND t.status='canceled' THEN RAISE EXCEPTION 'SHIPMENT_STATE' USING ERRCODE='P0001'; END IF;
 IF p_to='in_transit' AND t.departure_at>clock_timestamp() THEN RAISE EXCEPTION 'SHIPMENT_NOT_DEPARTED' USING ERRCODE='P0001'; END IF;
 UPDATE safeer.shipments SET lifecycle=p_to,version=version+1 WHERE company_id=cid AND id=sid RETURNING * INTO x;
 INSERT INTO safeer.shipment_events(company_id,shipment_id,event,from_state,to_state,actor_id,reason) VALUES(cid,sid,CASE WHEN back THEN 'corrected' ELSE 'moved' END,was,p_to,actor,why);
 RETURN safeer.shipment_row(x);
END $$;

-- Delivery needs the receiver's phone number and name exactly as recorded at drop-off.
CREATE FUNCTION safeer.shipment_deliver(cid uuid,actor uuid,sid uuid,p_name text,p_mobile text,p_version integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE x safeer.shipments%ROWTYPE;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_has(cid,'company.shipments.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO x FROM safeer.shipments WHERE company_id=cid AND id=sid FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF x.version<>p_version THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='P0001'; END IF;
 IF x.lifecycle<>'arrived' THEN RAISE EXCEPTION 'SHIPMENT_STATE' USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM safeer.shipment_exceptions WHERE company_id=cid AND shipment_id=sid AND resolved_at IS NULL) THEN RAISE EXCEPTION 'SHIPMENT_EXCEPTION_OPEN' USING ERRCODE='P0001'; END IF;
 IF x.erased_at IS NOT NULL OR x.receiver_mobile IS DISTINCT FROM p_mobile OR safeer.shipment_name(x.receiver_name) IS DISTINCT FROM safeer.shipment_name(p_name) THEN
  RAISE EXCEPTION 'RECEIVER_NOT_VERIFIED' USING ERRCODE='P0001';
 END IF;
 UPDATE safeer.shipments SET lifecycle='delivered',delivered_by=actor,delivered_at=clock_timestamp(),version=version+1 WHERE company_id=cid AND id=sid RETURNING * INTO x;
 INSERT INTO safeer.shipment_events(company_id,shipment_id,event,from_state,to_state,actor_id) VALUES(cid,sid,'delivered','arrived','delivered',actor);
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,actor,'shipment.delivered',sid);
 RETURN safeer.shipment_row(x);
END $$;

-- Before it leaves the origin office, a shipment can go back to the sender, with a reason.
CREATE FUNCTION safeer.shipment_return(cid uuid,actor uuid,sid uuid,why text,p_version integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE x safeer.shipments%ROWTYPE;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_has(cid,'company.shipments.operate') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO x FROM safeer.shipments WHERE company_id=cid AND id=sid FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF x.version<>p_version THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='P0001'; END IF;
 IF x.lifecycle<>'received' THEN RAISE EXCEPTION 'SHIPMENT_STATE' USING ERRCODE='P0001'; END IF;
 IF why IS NULL THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM safeer.shipment_exceptions WHERE company_id=cid AND shipment_id=sid AND resolved_at IS NULL) THEN RAISE EXCEPTION 'SHIPMENT_EXCEPTION_OPEN' USING ERRCODE='P0001'; END IF;
 UPDATE safeer.shipments SET lifecycle='returned',version=version+1 WHERE company_id=cid AND id=sid RETURNING * INTO x;
 INSERT INTO safeer.shipment_events(company_id,shipment_id,event,from_state,to_state,actor_id,reason) VALUES(cid,sid,'returned','received','returned',actor,why);
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,actor,'shipment.returned',sid);
 RETURN safeer.shipment_row(x);
END $$;

CREATE FUNCTION safeer.shipment_report(cid uuid,actor uuid,sid uuid,p_kind text,p_note text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE x safeer.shipments%ROWTYPE;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT (safeer.company_has(cid,'company.shipments.operate') OR safeer.company_has(cid,'company.shipments.resolve')) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO x FROM safeer.shipments WHERE company_id=cid AND id=sid FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF x.lifecycle IN ('delivered','returned','lost') THEN RAISE EXCEPTION 'SHIPMENT_STATE' USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM safeer.shipment_exceptions WHERE company_id=cid AND shipment_id=sid AND resolved_at IS NULL) THEN RAISE EXCEPTION 'SHIPMENT_EXCEPTION_OPEN' USING ERRCODE='P0001'; END IF;
 INSERT INTO safeer.shipment_exceptions(company_id,shipment_id,kind,note,reported_by) VALUES(cid,sid,p_kind,p_note,actor);
 UPDATE safeer.shipments SET version=version+1 WHERE company_id=cid AND id=sid RETURNING * INTO x;
 INSERT INTO safeer.shipment_events(company_id,shipment_id,event,from_state,to_state,actor_id,reason) VALUES(cid,sid,'exception_reported',x.lifecycle,x.lifecycle,actor,p_kind);
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,actor,'shipment.exception_reported',sid);
 RETURN safeer.shipment_row(x);
END $$;

-- A missing shipment settled or closed becomes Lost; otherwise it returns to its recorded state.
CREATE FUNCTION safeer.shipment_resolve(cid uuid,actor uuid,sid uuid,eid uuid,p_outcome text,p_note text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE x safeer.shipments%ROWTYPE; e safeer.shipment_exceptions%ROWTYPE; was text;
BEGIN
 IF actor IS DISTINCT FROM safeer.company_actor() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF NOT safeer.company_has(cid,'company.shipments.resolve') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 SELECT * INTO x FROM safeer.shipments WHERE company_id=cid AND id=sid FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO e FROM safeer.shipment_exceptions WHERE company_id=cid AND id=eid AND shipment_id=sid AND resolved_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SHIPMENT_EXCEPTION_CLOSED' USING ERRCODE='P0001'; END IF;
 UPDATE safeer.shipment_exceptions SET resolved_by=actor,resolved_at=clock_timestamp(),outcome=p_outcome,resolution_note=p_note WHERE company_id=cid AND id=eid;
 was:=x.lifecycle;
 UPDATE safeer.shipments SET lifecycle=CASE WHEN e.kind='missing' AND p_outcome IN ('settled','closed') THEN 'lost' ELSE lifecycle END,version=version+1 WHERE company_id=cid AND id=sid RETURNING * INTO x;
 INSERT INTO safeer.shipment_events(company_id,shipment_id,event,from_state,to_state,actor_id,reason) VALUES(cid,sid,'exception_resolved',was,x.lifecycle,actor,p_outcome);
 INSERT INTO safeer.company_audit(id,company_id,actor_id,action,target_id) VALUES(gen_random_uuid(),cid,actor,'shipment.exception_resolved',sid);
 RETURN safeer.shipment_row(x);
END $$;

-- Public tracking by the random code printed on the receipt: status and places only, never people.
CREATE FUNCTION safeer.public_shipment(p_code text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('trackingCode',s.tracking_code,'status',CASE WHEN safeer.shipment_status(s)='exception_reported' THEN 'delayed' ELSE s.lifecycle END,
  'itemCount',s.item_count,'companyNameEn',co.name_en,'companyNameAr',co.name_ar,'originEn',o.name_en,'originAr',o.name_ar,'destinationEn',d.name_en,'destinationAr',d.name_ar,
  'routeNameEn',t.route_name_en,'routeNameAr',t.route_name_ar,'departureAt',t.departure_at,'arrivalAt',t.arrival_at,'timezone',t.timezone,'tripCanceled',t.status='canceled',
  'updatedAt',(SELECT max(v.created_at) FROM safeer.shipment_events v WHERE v.company_id=s.company_id AND v.shipment_id=s.id))
 FROM safeer.shipments s JOIN safeer.trips t ON (t.company_id,t.id)=(s.company_id,s.trip_id) JOIN safeer.companies co ON co.id=s.company_id
 JOIN safeer.stations o ON (o.company_id,o.id)=(s.company_id,s.origin_station_id) JOIN safeer.stations d ON (d.company_id,d.id)=(s.company_id,s.destination_station_id)
 WHERE s.tracking_code=p_code
$$;

-- Money: shipment fees count in the cash session, finance movements and platform totals.
CREATE OR REPLACE FUNCTION safeer.session_totals(cid uuid,sid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('cashIn',COALESCE((SELECT sum(amount_minor) FROM safeer.payments WHERE company_id=cid AND session_id=sid AND method='cash'),0)+COALESCE((SELECT sum(amount_minor) FROM safeer.shipment_payments WHERE company_id=cid AND session_id=sid AND method='cash'),0),
  'cashOut',COALESCE((SELECT sum(amount_minor) FROM safeer.refunds WHERE company_id=cid AND session_id=sid AND method='cash'),0),
  'otherIn',COALESCE((SELECT sum(amount_minor) FROM safeer.payments WHERE company_id=cid AND session_id=sid AND method<>'cash'),0)+COALESCE((SELECT sum(amount_minor) FROM safeer.shipment_payments WHERE company_id=cid AND session_id=sid AND method<>'cash'),0),
  'otherOut',COALESCE((SELECT sum(amount_minor) FROM safeer.refunds WHERE company_id=cid AND session_id=sid AND method<>'cash'),0),
  'payments',(SELECT count(*) FROM safeer.payments WHERE company_id=cid AND session_id=sid)+(SELECT count(*) FROM safeer.shipment_payments WHERE company_id=cid AND session_id=sid),
  'refunds',(SELECT count(*) FROM safeer.refunds WHERE company_id=cid AND session_id=sid),
  'shipments',(SELECT count(*) FROM safeer.shipment_payments WHERE company_id=cid AND session_id=sid))
$$;
CREATE OR REPLACE FUNCTION safeer.finance_movements(cid uuid,starts timestamptz,ends timestamptz,cutoff timestamptz,station uuid,employee uuid,method text)
RETURNS TABLE(id uuid,kind text,at timestamptz,amount bigint,currency text,document text,employee_id uuid,employee_name text,station_id uuid,station_en text,station_ar text,trip_id uuid,route_en text,route_ar text,payment_method text,tickets integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 WITH permitted_stations AS MATERIALIZED (
 SELECT s.id FROM safeer.stations s WHERE s.company_id=cid AND (station IS NULL OR s.id=station) AND safeer.company_can(cid,'company.finance.read',s.branch_id,s.id)
 ), movements AS (
 SELECT p.id,'payment'::text AS kind,p.created_at AS at,p.amount_minor::bigint AS amount,p.currency::text,b.trip_id,p.session_id,p.taken_by AS employee_id,p.method AS payment_method,r.receipt_number AS document,
 (SELECT count(*)::integer FROM safeer.tickets k WHERE k.company_id=cid AND k.booking_id=p.booking_id) AS tickets
 FROM safeer.payments p JOIN safeer.receipts r ON (r.company_id,r.payment_id)=(p.company_id,p.id) JOIN safeer.bookings b ON b.company_id=cid AND b.id=p.booking_id WHERE p.company_id=cid
 UNION ALL
 SELECT f.id,'refund',f.created_at,f.amount_minor::bigint,f.currency::text,b.trip_id,f.session_id,f.refunded_by,f.method,f.refund_number,
 (SELECT count(*)::integer FROM safeer.tickets k WHERE k.company_id=cid AND k.booking_id=f.booking_id)
 FROM safeer.refunds f JOIN safeer.bookings b ON b.company_id=cid AND b.id=f.booking_id WHERE f.company_id=cid
 UNION ALL
 SELECT sp.id,'payment',sp.created_at,sp.amount_minor::bigint,sp.currency::text,sh.trip_id,sp.session_id,sp.taken_by,sp.method,sp.receipt_number,0
 FROM safeer.shipment_payments sp JOIN safeer.shipments sh ON (sh.company_id,sh.id)=(sp.company_id,sp.shipment_id) WHERE sp.company_id=cid
 )
 SELECT m.id,m.kind,m.at,m.amount,m.currency,m.document::text,m.employee_id,u.display_name::text,s.station_id,st.name_en::text,st.name_ar::text,m.trip_id,t.route_name_en::text,t.route_name_ar::text,m.payment_method::text,m.tickets
 FROM movements m JOIN safeer.cash_sessions s ON s.company_id=cid AND s.id=m.session_id
 JOIN permitted_stations permitted ON permitted.id=s.station_id
 JOIN safeer.stations st ON (st.company_id,st.id)=(s.company_id,s.station_id)
 JOIN safeer.users u ON u.id=m.employee_id
 JOIN safeer.trips t ON (t.company_id,t.id)=(cid,m.trip_id)
 WHERE m.at>=starts AND m.at<ends AND m.at<=cutoff
 AND (station IS NULL OR s.station_id=station) AND (employee IS NULL OR m.employee_id=employee) AND (method IS NULL OR m.payment_method=method)
$$;
CREATE OR REPLACE FUNCTION safeer.finance_report(cid uuid,first_day date,last_day date,station uuid,employee uuid,method text,p_page integer,p_session_page integer,p_cutoff timestamptz,exporting boolean)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE tz text; starts timestamptz; ends timestamptz; cutoff timestamptz:=coalesce(p_cutoff,clock_timestamp()); result jsonb;
BEGIN
 IF NOT safeer.company_has(cid,'company.finance.read') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF first_day IS NULL OR last_day IS NULL OR last_day<first_day OR last_day-first_day>30 OR p_page IS NULL OR p_page<0 OR p_page>1000000 OR p_session_page IS NULL OR p_session_page<0 OR p_session_page>1000000 OR cutoff>clock_timestamp() OR (method IS NOT NULL AND method NOT IN ('cash','bank_transfer','mobile_wallet')) THEN RAISE EXCEPTION 'INVALID_REPORT' USING ERRCODE='P0001'; END IF;
 SELECT timezone INTO tz FROM safeer.company_settings WHERE company_id=cid;
 IF tz IS NULL THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 starts:=first_day::timestamp AT TIME ZONE tz;ends:=(last_day+1)::timestamp AT TIME ZONE tz;
 WITH permitted_stations AS MATERIALIZED (
  SELECT st.id FROM safeer.stations st WHERE st.company_id=cid AND (station IS NULL OR st.id=station) AND safeer.company_can(cid,'company.finance.read',st.branch_id,st.id)
 ), m AS MATERIALIZED (SELECT * FROM safeer.finance_movements(cid,starts,ends,cutoff,station,employee,method)),
 totals AS (
  SELECT currency,coalesce(sum(amount) FILTER(WHERE kind='payment'),0)::text AS sales,coalesce(sum(amount) FILTER(WHERE kind='refund'),0)::text AS refunds,
  sum(CASE WHEN kind='payment' THEN amount ELSE -amount END)::text AS net,
  coalesce(sum(tickets) FILTER(WHERE kind='payment'),0)::integer AS sold,coalesce(sum(tickets) FILTER(WHERE kind='refund'),0)::integer AS returned FROM m GROUP BY currency
 ), daily AS (
  SELECT currency,(at AT TIME ZONE tz)::date AS day,sum(CASE WHEN kind='payment' THEN amount ELSE -amount END)::text AS net FROM m GROUP BY currency,(at AT TIME ZONE tz)::date
 ), methods AS (
  SELECT currency,payment_method AS method,sum(amount) FILTER(WHERE kind='payment') AS sales,sum(amount) FILTER(WHERE kind='refund') AS refunds FROM m GROUP BY currency,payment_method
 ), breakdown AS (
  SELECT 'employee'::text AS category,employee_id AS id,employee_name AS name_en,employee_name AS name_ar,currency,sum(CASE WHEN kind='payment' THEN amount ELSE -amount END)::text AS net,count(*)::integer AS movements FROM m GROUP BY employee_id,employee_name,currency
  UNION ALL SELECT 'station',station_id,station_en,station_ar,currency,sum(CASE WHEN kind='payment' THEN amount ELSE -amount END)::text,count(*)::integer FROM m GROUP BY station_id,station_en,station_ar,currency
  UNION ALL SELECT 'trip',trip_id,route_en,route_ar,currency,sum(CASE WHEN kind='payment' THEN amount ELSE -amount END)::text,count(*)::integer FROM m GROUP BY trip_id,route_en,route_ar,currency
 ), eligible_sessions AS MATERIALIZED (
  SELECT s.*,st.name_en AS station_en,st.name_ar AS station_ar,u.display_name AS operator,c.name AS counter_name
  FROM safeer.cash_sessions s JOIN safeer.stations st ON (st.company_id,st.id)=(s.company_id,s.station_id) JOIN safeer.users u ON u.id=s.opened_by
  JOIN safeer.station_counters c ON (c.company_id,c.id)=(s.company_id,s.counter_id)
  JOIN permitted_stations permitted ON permitted.id=s.station_id
  WHERE s.company_id=cid AND s.opened_at<ends AND s.opened_at<=cutoff AND (s.closed_at IS NULL OR s.closed_at>=starts)
  AND (station IS NULL OR s.station_id=station) AND (employee IS NULL OR s.opened_by=employee)
 ), paged AS (SELECT * FROM m ORDER BY at DESC,id DESC,kind LIMIT CASE WHEN exporting THEN 10001 ELSE 75 END OFFSET CASE WHEN exporting THEN 0 ELSE p_page*75 END),
 sessions AS MATERIALIZED (
  SELECT s.*,
  coalesce((SELECT sum(p.amount_minor) FROM safeer.payments p WHERE p.company_id=cid AND p.session_id=s.id AND p.method='cash' AND p.created_at<=cutoff),0)
  +coalesce((SELECT sum(p.amount_minor) FROM safeer.shipment_payments p WHERE p.company_id=cid AND p.session_id=s.id AND p.method='cash' AND p.created_at<=cutoff),0) AS cash_in,
  coalesce((SELECT sum(f.amount_minor) FROM safeer.refunds f WHERE f.company_id=cid AND f.session_id=s.id AND f.method='cash' AND f.created_at<=cutoff),0) AS cash_out
  FROM (SELECT * FROM eligible_sessions ORDER BY opened_at DESC,id DESC LIMIT 50 OFFSET p_session_page*50) s
 )
 SELECT jsonb_build_object('from',first_day,'to',last_day,'timezone',tz,'asOf',cutoff,'page',p_page,'sessionPage',p_session_page,
 'movementCount',(SELECT count(*)::integer FROM m),'sessionCount',(SELECT count(*)::integer FROM eligible_sessions),
 'totals',coalesce((SELECT jsonb_agg(jsonb_build_object('currency',currency,'salesMinor',sales,'refundMinor',refunds,'netMinor',net,'ticketsSold',sold,'ticketsRefunded',returned) ORDER BY currency) FROM totals),'[]'::jsonb),
 'daily',coalesce((SELECT jsonb_agg(jsonb_build_object('currency',currency,'date',day,'netMinor',net) ORDER BY day,currency) FROM daily),'[]'::jsonb),
 'methods',coalesce((SELECT jsonb_agg(jsonb_build_object('currency',x.currency,'method',x.method,'salesMinor',coalesce(x.sales,0)::text,'refundMinor',coalesce(x.refunds,0)::text) ORDER BY x.currency,x.method) FROM methods x),'[]'::jsonb),
 'breakdown',coalesce((SELECT jsonb_agg(jsonb_build_object('category',category,'id',id,'nameEn',name_en,'nameAr',name_ar,'currency',currency,'netMinor',net,'movements',movements) ORDER BY category,name_en,id,currency) FROM breakdown),'[]'::jsonb),
 'movements',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'at',at,'amountMinor',amount::text,'currency',currency,'document',document,'employeeId',employee_id,'employee',employee_name,'stationId',station_id,'stationEn',station_en,'stationAr',station_ar,'tripId',trip_id,'routeEn',route_en,'routeAr',route_ar,'method',payment_method,'tickets',tickets) ORDER BY at DESC,id DESC,kind) FROM paged),'[]'::jsonb),
 'sessions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'counterName',counter_name,'stationEn',station_en,'stationAr',station_ar,'employee',operator,'openedAt',opened_at,'closedAt',CASE WHEN closed_at<=cutoff THEN closed_at END,'currency',currency,'openingMinor',opening_minor::text,'cashInMinor',cash_in::text,'cashOutMinor',cash_out::text,'expectedMinor',(opening_minor+cash_in-cash_out)::text,'countedMinor',CASE WHEN closed_at<=cutoff THEN counted_minor::text END,'varianceMinor',CASE WHEN closed_at<=cutoff THEN (counted_minor-expected_minor)::text END,'recordedExpectedMinor',CASE WHEN closed_at<=cutoff THEN expected_minor::text END,'stale',(closed_at IS NULL OR closed_at>cutoff) AND cutoff-opened_at>interval '24 hours') ORDER BY opened_at DESC,id DESC) FROM sessions),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION safeer.platform_dashboard(first_day date,last_day date,p_page integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE starts timestamptz; ends timestamptz; cutoff timestamptz:=statement_timestamp(); result jsonb;
BEGIN
 IF NOT safeer.company_super() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF first_day IS NULL OR last_day IS NULL OR last_day-first_day NOT BETWEEN 0 AND 30 OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 1000000 THEN RAISE EXCEPTION 'INVALID_REPORT'; END IF;
 starts:=first_day::timestamp AT TIME ZONE 'UTC';ends:=(last_day+1)::timestamp AT TIME ZONE 'UTC';
 WITH movements AS MATERIALIZED (
  SELECT company_id,currency,'payment'::text AS kind,amount_minor::bigint AS amount FROM safeer.payments WHERE created_at>=starts AND created_at<ends AND created_at<=cutoff
  UNION ALL SELECT company_id,currency,'payment',amount_minor::bigint FROM safeer.shipment_payments WHERE created_at>=starts AND created_at<ends AND created_at<=cutoff
  UNION ALL SELECT company_id,currency,'refund',amount_minor::bigint FROM safeer.refunds WHERE created_at>=starts AND created_at<ends AND created_at<=cutoff
 ), amounts AS MATERIALIZED (
  SELECT company_id,currency,coalesce(sum(amount) FILTER(WHERE kind='payment'),0) AS sales,coalesce(sum(amount) FILTER(WHERE kind='refund'),0) AS refunds FROM movements GROUP BY company_id,currency
 ), totals AS (SELECT currency,sum(sales) AS sales,sum(refunds) AS refunds FROM amounts GROUP BY currency),
 companies AS MATERIALIZED (SELECT c.*,coalesce(p.listed,false) AS listed FROM safeer.companies c LEFT JOIN safeer.company_public_profiles p ON p.company_id=c.id ORDER BY c.created_at DESC,c.id DESC LIMIT 50 OFFSET p_page*50)
 SELECT jsonb_build_object('from',first_day,'to',last_day,'timezone','UTC','asOf',cutoff,'page',p_page,
 'companyCount',(SELECT count(*)::integer FROM safeer.companies),
 'summary',jsonb_build_object('pending',(SELECT count(*)::integer FROM safeer.companies WHERE status='pending'),'approved',(SELECT count(*)::integer FROM safeer.companies WHERE status='approved'),'listed',(SELECT count(*)::integer FROM safeer.company_public_profiles p JOIN safeer.companies c ON c.id=p.company_id WHERE p.listed AND c.status='approved'),'activeUsers',(SELECT count(*)::integer FROM safeer.users WHERE active),'departures',(SELECT count(*)::integer FROM safeer.trips WHERE status='published' AND departure_at>=starts AND departure_at<ends),'bookings',(SELECT count(*)::integer FROM safeer.bookings WHERE created_at>=starts AND created_at<ends AND created_at<=cutoff),'shipments',(SELECT count(*)::integer FROM safeer.shipments WHERE created_at>=starts AND created_at<ends AND created_at<=cutoff)),
 'totals',coalesce((SELECT jsonb_agg(jsonb_build_object('currency',currency,'salesMinor',sales::text,'refundMinor',refunds::text,'netMinor',(sales-refunds)::text) ORDER BY currency) FROM totals),'[]'::jsonb),
 'companies',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'nameEn',c.name_en,'nameAr',c.name_ar,'status',c.status,'listed',c.listed,'createdAt',c.created_at,'totals',coalesce((SELECT jsonb_agg(jsonb_build_object('currency',a.currency,'salesMinor',a.sales::text,'refundMinor',a.refunds::text,'netMinor',(a.sales-a.refunds)::text) ORDER BY a.currency) FROM amounts a WHERE a.company_id=c.id),'[]'::jsonb)) ORDER BY c.created_at DESC,c.id DESC) FROM companies c),'[]'::jsonb)) INTO result;
 INSERT INTO safeer.identity_audit(id,actor_id,action) VALUES(gen_random_uuid(),safeer.company_actor(),'platform.dashboard_read');
 RETURN result;
END $$;

-- Retention: sender/receiver details and item descriptions go 90 days after the trip arrives.
ALTER FUNCTION safeer.erase_due_passenger_data() RENAME TO erase_due_passenger_data_before_shipments;
CREATE FUNCTION safeer.erase_due_passenger_data() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer; m integer;
BEGIN
 n:=safeer.erase_due_passenger_data_before_shipments();
 WITH due AS (SELECT company_id,id FROM safeer.shipments WHERE erased_at IS NULL AND erase_at<=clock_timestamp() ORDER BY erase_at LIMIT 500 FOR UPDATE SKIP LOCKED)
 UPDATE safeer.shipments s SET sender_name=NULL,sender_mobile=NULL,receiver_name=NULL,receiver_mobile=NULL,erased_at=clock_timestamp() FROM due WHERE (s.company_id,s.id)=(due.company_id,due.id);
 GET DIAGNOSTICS m=ROW_COUNT;
 UPDATE safeer.shipment_items i SET description=NULL FROM safeer.shipments s WHERE (s.company_id,s.id)=(i.company_id,i.shipment_id) AND s.erased_at IS NOT NULL AND i.description IS NOT NULL;
 UPDATE safeer.shipment_exceptions e SET note=NULL,resolution_note=NULL FROM safeer.shipments s WHERE (s.company_id,s.id)=(e.company_id,e.shipment_id) AND s.erased_at IS NOT NULL AND (e.note IS NOT NULL OR e.resolution_note IS NOT NULL);
 UPDATE safeer.shipment_events v SET reason=NULL FROM safeer.shipments s WHERE (s.company_id,s.id)=(v.company_id,v.shipment_id) AND s.erased_at IS NOT NULL AND v.reason IS NOT NULL AND v.event IN ('corrected','returned','tag_replaced');
 RETURN n+m;
END $$;

-- The driver sees shipment numbers, counts and destinations for the trip; never people's details.
ALTER FUNCTION safeer.driver_manifest(uuid,uuid) RENAME TO driver_manifest_before_shipments;
CREATE FUNCTION safeer.driver_manifest(cid uuid,tid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 result:=safeer.driver_manifest_before_shipments(cid,tid);
 IF result IS NULL THEN RETURN NULL; END IF;
 RETURN result||jsonb_build_object('shipments',coalesce((SELECT jsonb_agg(jsonb_build_object('number',s.shipment_number,'items',s.item_count,'status',safeer.shipment_status(s),'destinationEn',d.name_en,'destinationAr',d.name_ar) ORDER BY s.shipment_number)
  FROM safeer.shipments s JOIN safeer.stations d ON (d.company_id,d.id)=(s.company_id,s.destination_station_id) WHERE s.company_id=cid AND s.trip_id=tid AND s.lifecycle NOT IN ('returned')),'[]'::jsonb));
END $$;

REVOKE ALL ON FUNCTION safeer.shipment_guard(),safeer.shipment_status(safeer.shipments),safeer.shipment_name(text),safeer.shipment_row(safeer.shipments),
 safeer.shipment_options(uuid),safeer.shipment_price_save(uuid,uuid,text,integer,boolean,integer),
 safeer.shipment_create(uuid,uuid,uuid,uuid,text,text,text,text,jsonb,text,text,boolean,text,text,text),safeer.shipment_find(uuid,text,text,uuid),
 safeer.shipment_tag(uuid,uuid,uuid,text,text,integer),safeer.shipment_move(uuid,uuid,uuid,text,text,integer),safeer.shipment_deliver(uuid,uuid,uuid,text,text,integer),
 safeer.shipment_return(uuid,uuid,uuid,text,integer),safeer.shipment_report(uuid,uuid,uuid,text,text),safeer.shipment_resolve(uuid,uuid,uuid,uuid,text,text),
 safeer.public_shipment(text),safeer.erase_due_passenger_data_before_shipments(),safeer.erase_due_passenger_data(),
 safeer.driver_manifest_before_shipments(uuid,uuid),safeer.driver_manifest(uuid,uuid) FROM PUBLIC;
