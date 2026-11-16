-- D100: the Notifications panel shows each event's details (from safeer.notification_detail) and the read time.
CREATE OR REPLACE FUNCTION safeer.notifications_list(before_id bigint DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=safeer.company_actor(); result jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 WITH visible AS MATERIALIZED (
  SELECT n.* FROM safeer.notification_events n WHERE n.created_at>=statement_timestamp()-interval '90 days' AND safeer.notification_visible(n)
 ), page AS MATERIALIZED (SELECT * FROM visible WHERE before_id IS NULL OR id<before_id ORDER BY id DESC LIMIT 51)
 SELECT jsonb_build_object('unreadCount',(SELECT count(*)::integer FROM visible v WHERE NOT EXISTS(SELECT 1 FROM safeer.notification_reads r WHERE r.user_id=actor AND r.event_id=v.id)),
 'items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id::text,'code',p.code,'companyId',p.company_id,'companyEn',c.name_en,'companyAr',c.name_ar,'sourceId',p.source_id,'at',p.created_at,
   'read',r.read_at IS NOT NULL,'readAt',r.read_at,'detail',safeer.notification_detail(p)) ORDER BY p.id DESC)
  FROM (SELECT * FROM page ORDER BY id DESC LIMIT 50) p JOIN safeer.companies c ON c.id=p.company_id LEFT JOIN safeer.notification_reads r ON r.user_id=actor AND r.event_id=p.id),'[]'::jsonb),
 'nextCursor',CASE WHEN (SELECT count(*) FROM page)>50 THEN (SELECT min(id)::text FROM (SELECT id FROM page ORDER BY id DESC LIMIT 50) x) END) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION safeer.notifications_list(bigint) FROM PUBLIC;

-- D100: notifications point to a record; they do not copy its private contents. The details keep references,
-- problem types, routes and times, and leave out amounts and free-text notes (drawer notes, incident and problem
-- notes, refund reasons), which stay behind the record's own access (D14 notification privacy).
CREATE OR REPLACE FUNCTION safeer.notification_detail(n safeer.notification_events) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r record; f jsonb:='[]'::jsonb;
BEGIN
 IF NOT safeer.notification_visible(n) THEN RETURN '[]'::jsonb; END IF;
 CASE n.code
 WHEN 'payment.proof' THEN
  SELECT b.reference,p.method_reference,t.route_name_en,t.route_name_ar,t.departure_at INTO r
   FROM safeer.payments p JOIN safeer.bookings b ON b.company_id=p.company_id AND b.id=p.booking_id JOIN safeer.trips t ON t.company_id=b.company_id AND t.id=b.trip_id
   WHERE p.company_id=n.company_id AND p.id=n.source_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Booking reference','text',r.reference),jsonb_build_object('label','Transfer reference','text',r.method_reference),
   jsonb_build_object('label','Trip','textEn',r.route_name_en,'textAr',r.route_name_ar),jsonb_build_object('label','Departure','at',r.departure_at)); END IF;
 WHEN 'booking.refunded' THEN
  SELECT b.reference,x.refund_number INTO r FROM safeer.refunds x JOIN safeer.bookings b ON b.company_id=x.company_id AND b.id=x.booking_id WHERE x.company_id=n.company_id AND x.id=n.source_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Booking reference','text',r.reference),jsonb_build_object('label','Refund number','text',r.refund_number)); END IF;
 WHEN 'shipment.exception' THEN
  SELECT s.shipment_number,s.tracking_code,x.kind INTO r FROM safeer.shipment_exceptions x JOIN safeer.shipments s ON s.company_id=x.company_id AND s.id=x.shipment_id WHERE x.company_id=n.company_id AND x.id=n.source_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Shipment','text',r.shipment_number),jsonb_build_object('label','Tracking code','text',r.tracking_code),jsonb_build_object('label','Problem','code',r.kind)); END IF;
 WHEN 'luggage.exception' THEN
  SELECT l.luggage_number,x.kind INTO r FROM safeer.luggage_exceptions x JOIN safeer.luggage_records l ON l.company_id=x.company_id AND l.id=x.luggage_id WHERE x.company_id=n.company_id AND x.id=n.source_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Bag','text',r.luggage_number),jsonb_build_object('label','Problem','code',r.kind)); END IF;
 WHEN 'journey.incident' THEN
  SELECT x.kind,t.route_name_en,t.route_name_ar,t.departure_at INTO r FROM safeer.journey_incidents x JOIN safeer.trips t ON t.company_id=x.company_id AND t.id=x.trip_id WHERE x.company_id=n.company_id AND x.id=n.source_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Trip','textEn',r.route_name_en,'textAr',r.route_name_ar),jsonb_build_object('label','Departure','at',r.departure_at),jsonb_build_object('label','Problem','code',r.kind)); END IF;
 WHEN 'trip.canceled' THEN
  SELECT t.route_name_en,t.route_name_ar,t.departure_at INTO r FROM safeer.trips t WHERE t.company_id=n.company_id AND t.id=n.source_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Trip','textEn',r.route_name_en,'textAr',r.route_name_ar),jsonb_build_object('label','Departure','at',r.departure_at)); END IF;
 WHEN 'cash.difference' THEN
  SELECT s.closed_at,st.name_en,st.name_ar INTO r FROM safeer.cash_sessions s JOIN safeer.stations st ON st.company_id=s.company_id AND st.id=s.station_id WHERE s.company_id=n.company_id AND s.id=n.source_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Station','textEn',r.name_en,'textAr',r.name_ar),jsonb_build_object('label','Closed','at',r.closed_at)); END IF;
 WHEN 'invoice.issued','invoice.paid' THEN
  SELECT i.number,i.due_on INTO r FROM safeer.company_invoices i WHERE i.company_id=n.company_id AND i.id=n.source_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Invoice','text',r.number),jsonb_build_object('label','Due','text',r.due_on::text)); END IF;
 WHEN 'contract.issued','contract.accepted' THEN
  SELECT k.number INTO r FROM safeer.company_contracts k WHERE k.company_id=n.company_id AND k.id=n.source_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Contract','text',r.number)); END IF;
 WHEN 'company.status' THEN
  SELECT c.status INTO r FROM safeer.companies c WHERE c.id=n.company_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Status','code',r.status)); END IF;
 ELSE NULL;
 END CASE;
 RETURN coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(f) x WHERE NOT (x ? 'text' AND coalesce(x->>'text','')='')),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION safeer.notification_detail(safeer.notification_events) FROM PUBLIC;
