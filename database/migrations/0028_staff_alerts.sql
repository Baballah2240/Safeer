-- D98: staff alerts. Three more events reach the notification center, and the staff header asks for a light
-- unread count (with the newest unread event for the live pop-up) instead of loading the inbox.
--   payment.proof       a bank transfer with its proof photo, waiting to be checked   (finance readers)
--   shipment.exception  a problem reported on a shipment                               (shipment resolvers)
--   booking.refunded    a booking was refunded at the counter                          (finance readers)
ALTER TABLE safeer.notification_events DROP CONSTRAINT notification_events_code_check;
ALTER TABLE safeer.notification_events ADD CONSTRAINT notification_events_code_check CHECK(code IN ('company.registered','company.status','marketplace.changed','trip.canceled','journey.incident','cash.difference','luggage.exception','contract.issued','contract.accepted','invoice.issued','invoice.paid','payment.proof','shipment.exception','booking.refunded'));

CREATE FUNCTION safeer.staff_alert_notice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'payment_proofs' THEN INSERT INTO safeer.notification_events(company_id,code,source_id) VALUES(NEW.company_id,'payment.proof',NEW.payment_id) ON CONFLICT DO NOTHING;
 WHEN 'shipment_exceptions' THEN INSERT INTO safeer.notification_events(company_id,code,source_id) VALUES(NEW.company_id,'shipment.exception',NEW.id) ON CONFLICT DO NOTHING;
 WHEN 'refunds' THEN INSERT INTO safeer.notification_events(company_id,code,source_id) VALUES(NEW.company_id,'booking.refunded',NEW.id) ON CONFLICT DO NOTHING;
 END CASE;
 RETURN NEW;
END $$;
CREATE TRIGGER payment_proof_notice AFTER INSERT ON safeer.payment_proofs FOR EACH ROW EXECUTE FUNCTION safeer.staff_alert_notice();
CREATE TRIGGER shipment_exception_notice AFTER INSERT ON safeer.shipment_exceptions FOR EACH ROW EXECUTE FUNCTION safeer.staff_alert_notice();
CREATE TRIGGER refund_notice AFTER INSERT ON safeer.refunds FOR EACH ROW EXECUTE FUNCTION safeer.staff_alert_notice();

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
 -- D98: finance readers of the session's station check transfers and see refunds.
 WHEN 'payment.proof' THEN RETURN EXISTS(SELECT 1 FROM safeer.payments p JOIN safeer.cash_sessions s ON s.company_id=p.company_id AND s.id=p.session_id WHERE p.company_id=n.company_id AND p.id=n.source_id AND safeer.company_can(n.company_id,'company.finance.read',s.branch_id,s.station_id));
 WHEN 'booking.refunded' THEN RETURN EXISTS(SELECT 1 FROM safeer.refunds r JOIN safeer.cash_sessions s ON s.company_id=r.company_id AND s.id=r.session_id WHERE r.company_id=n.company_id AND r.id=n.source_id AND safeer.company_can(n.company_id,'company.finance.read',s.branch_id,s.station_id));
 WHEN 'shipment.exception' THEN RETURN safeer.company_can(n.company_id,'company.shipments.resolve');
 ELSE RETURN false;
 END CASE;
END $$;

-- The staff header polls this: the unread count and the newest unread event, nothing else.
CREATE FUNCTION safeer.notifications_unread() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=safeer.company_actor(); result jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 WITH unread AS MATERIALIZED (
  SELECT n.* FROM safeer.notification_events n WHERE n.created_at>=statement_timestamp()-interval '90 days'
   AND NOT EXISTS(SELECT 1 FROM safeer.notification_reads r WHERE r.user_id=actor AND r.event_id=n.id) AND safeer.notification_visible(n)
 )
 SELECT jsonb_build_object('unreadCount',(SELECT count(*)::integer FROM unread),
  'latest',(SELECT jsonb_build_object('id',u.id::text,'code',u.code,'companyId',u.company_id,'companyEn',c.name_en,'companyAr',c.name_ar,'at',u.created_at) FROM unread u JOIN safeer.companies c ON c.id=u.company_id ORDER BY u.id DESC LIMIT 1)) INTO result;
 RETURN result;
END $$;

-- Marks every event this person can see as read.
CREATE FUNCTION safeer.notifications_read_all() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=safeer.company_actor(); marked integer;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 INSERT INTO safeer.notification_reads(user_id,event_id)
  SELECT actor,n.id FROM safeer.notification_events n WHERE n.created_at>=statement_timestamp()-interval '90 days' AND safeer.notification_visible(n)
  ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS marked=ROW_COUNT;
 RETURN jsonb_build_object('marked',marked);
END $$;
REVOKE ALL ON FUNCTION safeer.staff_alert_notice(),safeer.notification_visible(safeer.notification_events),safeer.notifications_unread(),safeer.notifications_read_all() FROM PUBLIC;
