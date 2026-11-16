-- D99: the staff pop-up card shows the full details of a new notification. Only business facts
-- (references, amounts, routes, times and staff notes) are returned, never passenger names or phone numbers,
-- and only for an event notification_visible already allows this person to see.
-- Who caused each event (the signed-in staff member, or none for automatic changes). Nobody gets a pop-up card
-- for their own action; it still counts as unread so the bell matches Notifications.
ALTER TABLE safeer.notification_events ADD COLUMN actor_id uuid DEFAULT safeer.company_actor();

CREATE FUNCTION safeer.notification_detail(n safeer.notification_events) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r record; f jsonb:='[]'::jsonb;
BEGIN
 IF NOT safeer.notification_visible(n) THEN RETURN '[]'::jsonb; END IF;
 CASE n.code
 WHEN 'payment.proof' THEN
  SELECT b.reference,p.amount_minor,p.currency,p.method_reference,t.route_name_en,t.route_name_ar,t.departure_at INTO r
   FROM safeer.payments p JOIN safeer.bookings b ON b.company_id=p.company_id AND b.id=p.booking_id JOIN safeer.trips t ON t.company_id=b.company_id AND t.id=b.trip_id
   WHERE p.company_id=n.company_id AND p.id=n.source_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Booking reference','text',r.reference),jsonb_build_object('label','Amount','minor',r.amount_minor,'currency',r.currency),
   jsonb_build_object('label','Transfer reference','text',r.method_reference),jsonb_build_object('label','Trip','textEn',r.route_name_en,'textAr',r.route_name_ar),jsonb_build_object('label','Departure','at',r.departure_at)); END IF;
 WHEN 'booking.refunded' THEN
  SELECT b.reference,x.refund_number,x.amount_minor,x.currency,x.reason INTO r
   FROM safeer.refunds x JOIN safeer.bookings b ON b.company_id=x.company_id AND b.id=x.booking_id WHERE x.company_id=n.company_id AND x.id=n.source_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Booking reference','text',r.reference),jsonb_build_object('label','Refund number','text',r.refund_number),
   jsonb_build_object('label','Amount refunded','minor',r.amount_minor,'currency',r.currency),jsonb_build_object('label','Reason','text',r.reason)); END IF;
 WHEN 'shipment.exception' THEN
  SELECT s.shipment_number,s.tracking_code,x.kind,x.note INTO r
   FROM safeer.shipment_exceptions x JOIN safeer.shipments s ON s.company_id=x.company_id AND s.id=x.shipment_id WHERE x.company_id=n.company_id AND x.id=n.source_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Shipment','text',r.shipment_number),jsonb_build_object('label','Tracking code','text',r.tracking_code),
   jsonb_build_object('label','Problem','code',r.kind),jsonb_build_object('label','Note','text',r.note)); END IF;
 WHEN 'luggage.exception' THEN
  SELECT l.luggage_number,x.kind,x.note INTO r
   FROM safeer.luggage_exceptions x JOIN safeer.luggage_records l ON l.company_id=x.company_id AND l.id=x.luggage_id WHERE x.company_id=n.company_id AND x.id=n.source_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Bag','text',r.luggage_number),jsonb_build_object('label','Problem','code',r.kind),jsonb_build_object('label','Note','text',r.note)); END IF;
 WHEN 'journey.incident' THEN
  SELECT x.kind,x.note,t.route_name_en,t.route_name_ar,t.departure_at INTO r
   FROM safeer.journey_incidents x JOIN safeer.trips t ON t.company_id=x.company_id AND t.id=x.trip_id WHERE x.company_id=n.company_id AND x.id=n.source_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Trip','textEn',r.route_name_en,'textAr',r.route_name_ar),jsonb_build_object('label','Departure','at',r.departure_at),
   jsonb_build_object('label','Problem','code',r.kind),jsonb_build_object('label','Note','text',r.note)); END IF;
 WHEN 'trip.canceled' THEN
  SELECT t.route_name_en,t.route_name_ar,t.departure_at INTO r FROM safeer.trips t WHERE t.company_id=n.company_id AND t.id=n.source_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Trip','textEn',r.route_name_en,'textAr',r.route_name_ar),jsonb_build_object('label','Departure','at',r.departure_at)); END IF;
 WHEN 'cash.difference' THEN
  SELECT s.expected_minor,s.counted_minor,s.currency,s.close_note,s.closed_at INTO r FROM safeer.cash_sessions s WHERE s.company_id=n.company_id AND s.id=n.source_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Expected','minor',r.expected_minor,'currency',r.currency),jsonb_build_object('label','Counted','minor',r.counted_minor,'currency',r.currency),
   jsonb_build_object('label','Difference','minor',r.counted_minor-r.expected_minor,'currency',r.currency),jsonb_build_object('label','Note','text',r.close_note),jsonb_build_object('label','Closed','at',r.closed_at)); END IF;
 WHEN 'invoice.issued','invoice.paid' THEN
  SELECT i.number,i.total_minor,i.currency,i.due_on INTO r FROM safeer.company_invoices i WHERE i.company_id=n.company_id AND i.id=n.source_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Invoice','text',r.number),jsonb_build_object('label','Total','minor',r.total_minor,'currency',r.currency),jsonb_build_object('label','Due','text',r.due_on::text)); END IF;
 WHEN 'contract.issued','contract.accepted' THEN
  SELECT k.number INTO r FROM safeer.company_contracts k WHERE k.company_id=n.company_id AND k.id=n.source_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Contract','text',r.number)); END IF;
 WHEN 'company.status' THEN
  SELECT c.status INTO r FROM safeer.companies c WHERE c.id=n.company_id;
  IF FOUND THEN f:=jsonb_build_array(jsonb_build_object('label','Status','code',r.status)); END IF;
 ELSE NULL;
 END CASE;
 -- Leave out empty values (for example a problem reported without a note).
 RETURN coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(f) x WHERE NOT (x ? 'text' AND (x->>'text') IS NULL OR x ? 'text' AND x->>'text'='')),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION safeer.notifications_unread() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=safeer.company_actor(); result jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 WITH unread AS MATERIALIZED (
  SELECT n.* FROM safeer.notification_events n WHERE n.created_at>=statement_timestamp()-interval '90 days'
   AND NOT EXISTS(SELECT 1 FROM safeer.notification_reads r WHERE r.user_id=actor AND r.event_id=n.id) AND safeer.notification_visible(n)
 )
 SELECT jsonb_build_object('unreadCount',(SELECT count(*)::integer FROM unread),
  'latest',(SELECT jsonb_build_object('id',u.id::text,'code',u.code,'companyId',u.company_id,'companyEn',c.name_en,'companyAr',c.name_ar,'at',u.created_at,'detail',safeer.notification_detail(u))
   FROM unread u JOIN safeer.companies c ON c.id=u.company_id WHERE u.actor_id IS DISTINCT FROM actor ORDER BY u.id DESC LIMIT 1)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION safeer.notification_detail(safeer.notification_events),safeer.notifications_unread() FROM PUBLIC;
