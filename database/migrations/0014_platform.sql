-- Section 14. No financial/role policy changes and no historical notification backfill.
CREATE TABLE safeer.platform_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 notice_enabled boolean NOT NULL DEFAULT false,
 notice_en varchar(500) NOT NULL DEFAULT '',notice_ar varchar(500) NOT NULL DEFAULT '',
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 CHECK(NOT notice_enabled OR (length(btrim(notice_en))>0 AND length(btrim(notice_ar))>0))
);
INSERT INTO safeer.platform_settings(singleton) VALUES(true);
CREATE TABLE safeer.notification_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES safeer.companies(id),
 code text NOT NULL CHECK(code IN ('company.registered','company.status','marketplace.changed','trip.canceled','journey.incident','cash.difference','luggage.exception')),
 source_id uuid NOT NULL,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(code,source_id,revision)
);
CREATE INDEX notification_company_recent ON safeer.notification_events(company_id,id DESC);
CREATE INDEX notification_recent ON safeer.notification_events(created_at);
CREATE TABLE safeer.notification_reads (
 event_id bigint NOT NULL REFERENCES safeer.notification_events(id),
 user_id uuid NOT NULL REFERENCES safeer.users(id),read_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,event_id)
);
ALTER TABLE safeer.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE safeer.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE safeer.notification_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON safeer.platform_settings,safeer.notification_events,safeer.notification_reads FROM PUBLIC;

-- The API receives fixed projections, never direct access to these tables/helpers.
CREATE FUNCTION safeer.platform_notice() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN notice_enabled THEN jsonb_build_object('enabled',true,'textEn',notice_en,'textAr',notice_ar)
 ELSE jsonb_build_object('enabled',false) END FROM safeer.platform_settings WHERE singleton
$$;
CREATE FUNCTION safeer.platform_settings_read() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT safeer.company_super() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 RETURN (SELECT jsonb_build_object('enabled',notice_enabled,'textEn',notice_en,'textAr',notice_ar,'version',version) FROM safeer.platform_settings WHERE singleton);
END $$;
CREATE FUNCTION safeer.platform_settings_save(enabled boolean,en text,ar text,revision integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT safeer.company_super() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF enabled IS NULL OR en IS NULL OR ar IS NULL OR length(en)>500 OR length(ar)>500 OR en ~ '[[:cntrl:]]' OR ar ~ '[[:cntrl:]]' OR (enabled AND (length(btrim(en))=0 OR length(btrim(ar))=0)) THEN RAISE EXCEPTION 'Invalid input' USING ERRCODE='23514'; END IF;
 UPDATE safeer.platform_settings SET notice_enabled=enabled,notice_en=btrim(en),notice_ar=btrim(ar),version=version+1 WHERE singleton AND version=revision;
 IF NOT FOUND THEN RAISE EXCEPTION 'STALE_VERSION'; END IF;
 INSERT INTO safeer.identity_audit(id,actor_id,action) VALUES(gen_random_uuid(),safeer.company_actor(),'platform.notice_changed');
 RETURN safeer.platform_settings_read();
END $$;

CREATE FUNCTION safeer.notification_capture() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE event_code text; revision integer:=1;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'companies' THEN
  IF TG_OP='INSERT' THEN event_code:='company.registered';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN event_code:='company.status'; END IF;
  revision:=NEW.version;
 WHEN 'company_public_profiles' THEN
  IF TG_OP='INSERT' THEN IF NEW.listed THEN event_code:='marketplace.changed'; END IF;
  ELSIF NEW.listed IS DISTINCT FROM OLD.listed THEN event_code:='marketplace.changed'; END IF;
  revision:=NEW.version;
 WHEN 'trips' THEN IF NEW.status='canceled' AND OLD.status<>'canceled' THEN event_code:='trip.canceled'; END IF;
 WHEN 'journey_incidents' THEN event_code:='journey.incident';
 WHEN 'cash_sessions' THEN IF NEW.closed_at IS NOT NULL AND OLD.closed_at IS NULL AND NEW.counted_minor<>NEW.expected_minor THEN event_code:='cash.difference'; END IF;
 WHEN 'luggage_exceptions' THEN event_code:='luggage.exception';
 END CASE;
 IF event_code IS NOT NULL THEN
  IF TG_TABLE_NAME='companies' THEN INSERT INTO safeer.notification_events(company_id,code,source_id,revision) VALUES(NEW.id,event_code,NEW.id,revision) ON CONFLICT DO NOTHING;
  ELSIF TG_TABLE_NAME='company_public_profiles' THEN INSERT INTO safeer.notification_events(company_id,code,source_id,revision) VALUES(NEW.company_id,event_code,NEW.company_id,revision) ON CONFLICT DO NOTHING;
  ELSE INSERT INTO safeer.notification_events(company_id,code,source_id,revision) VALUES(NEW.company_id,event_code,NEW.id,revision) ON CONFLICT DO NOTHING;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER platform_company_notice AFTER INSERT OR UPDATE ON safeer.companies FOR EACH ROW EXECUTE FUNCTION safeer.notification_capture();
CREATE TRIGGER platform_listing_notice AFTER INSERT OR UPDATE ON safeer.company_public_profiles FOR EACH ROW EXECUTE FUNCTION safeer.notification_capture();
CREATE TRIGGER platform_trip_notice AFTER UPDATE ON safeer.trips FOR EACH ROW EXECUTE FUNCTION safeer.notification_capture();
CREATE TRIGGER platform_incident_notice AFTER INSERT ON safeer.journey_incidents FOR EACH ROW EXECUTE FUNCTION safeer.notification_capture();
CREATE TRIGGER platform_cash_notice AFTER UPDATE ON safeer.cash_sessions FOR EACH ROW EXECUTE FUNCTION safeer.notification_capture();
CREATE TRIGGER platform_luggage_notice AFTER INSERT ON safeer.luggage_exceptions FOR EACH ROW EXECUTE FUNCTION safeer.notification_capture();

CREATE FUNCTION safeer.notification_visible(n safeer.notification_events) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF safeer.company_actor() IS NULL OR n.created_at<statement_timestamp()-interval '90 days' THEN RETURN false; END IF;
 IF safeer.company_super() THEN RETURN true; END IF;
 IF NOT EXISTS(SELECT 1 FROM safeer.companies WHERE id=n.company_id AND status='approved') THEN RETURN false; END IF;
 CASE n.code
 WHEN 'trip.canceled' THEN RETURN safeer.company_can(n.company_id,'company.trips.read') OR safeer.journey_allowed(n.company_id,n.source_id);
 WHEN 'journey.incident' THEN RETURN safeer.company_can(n.company_id,'company.journeys.manage');
 WHEN 'cash.difference' THEN RETURN EXISTS(SELECT 1 FROM safeer.cash_sessions s WHERE s.company_id=n.company_id AND s.id=n.source_id AND safeer.company_can(n.company_id,'company.finance.read',s.branch_id,s.station_id));
 WHEN 'luggage.exception' THEN RETURN safeer.company_can(n.company_id,'company.luggage.resolve');
 ELSE RETURN false;
 END CASE;
END $$;
CREATE FUNCTION safeer.notifications_list(before_id bigint DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=safeer.company_actor(); result jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 WITH visible AS MATERIALIZED (
  SELECT n.* FROM safeer.notification_events n WHERE n.created_at>=statement_timestamp()-interval '90 days' AND safeer.notification_visible(n)
 ), page AS MATERIALIZED (SELECT * FROM visible WHERE before_id IS NULL OR id<before_id ORDER BY id DESC LIMIT 51)
 SELECT jsonb_build_object('unreadCount',(SELECT count(*)::integer FROM visible v WHERE NOT EXISTS(SELECT 1 FROM safeer.notification_reads r WHERE r.user_id=actor AND r.event_id=v.id)),
 'items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id::text,'code',p.code,'companyId',p.company_id,'companyEn',c.name_en,'companyAr',c.name_ar,'sourceId',p.source_id,'at',p.created_at,'read',EXISTS(SELECT 1 FROM safeer.notification_reads r WHERE r.user_id=actor AND r.event_id=p.id)) ORDER BY p.id DESC) FROM (SELECT * FROM page ORDER BY id DESC LIMIT 50) p JOIN safeer.companies c ON c.id=p.company_id),'[]'::jsonb),
 'nextCursor',CASE WHEN (SELECT count(*) FROM page)>50 THEN (SELECT min(id)::text FROM (SELECT id FROM page ORDER BY id DESC LIMIT 50) x) END) INTO result;
 RETURN result;
END $$;
CREATE FUNCTION safeer.notification_read(event bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n safeer.notification_events; actor uuid:=safeer.company_actor();
BEGIN
 SELECT * INTO n FROM safeer.notification_events WHERE id=event;
 IF NOT FOUND OR NOT safeer.notification_visible(n) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 INSERT INTO safeer.notification_reads(user_id,event_id) VALUES(actor,event) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('read',true);
END $$;

CREATE INDEX payments_global_posted ON safeer.payments(created_at,company_id);
CREATE INDEX refunds_global_posted ON safeer.refunds(created_at,company_id);
CREATE FUNCTION safeer.platform_dashboard(first_day date,last_day date,p_page integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE starts timestamptz; ends timestamptz; cutoff timestamptz:=statement_timestamp(); result jsonb;
BEGIN
 IF NOT safeer.company_super() THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF first_day IS NULL OR last_day IS NULL OR last_day-first_day NOT BETWEEN 0 AND 30 OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 1000000 THEN RAISE EXCEPTION 'INVALID_REPORT'; END IF;
 starts:=first_day::timestamp AT TIME ZONE 'UTC';ends:=(last_day+1)::timestamp AT TIME ZONE 'UTC';
 WITH movements AS MATERIALIZED (
  SELECT company_id,currency,'payment'::text AS kind,amount_minor::bigint AS amount FROM safeer.payments WHERE created_at>=starts AND created_at<ends AND created_at<=cutoff
  UNION ALL SELECT company_id,currency,'refund',amount_minor::bigint FROM safeer.refunds WHERE created_at>=starts AND created_at<ends AND created_at<=cutoff
 ), amounts AS MATERIALIZED (
  SELECT company_id,currency,coalesce(sum(amount) FILTER(WHERE kind='payment'),0) AS sales,coalesce(sum(amount) FILTER(WHERE kind='refund'),0) AS refunds FROM movements GROUP BY company_id,currency
 ), totals AS (SELECT currency,sum(sales) AS sales,sum(refunds) AS refunds FROM amounts GROUP BY currency),
 companies AS MATERIALIZED (SELECT c.*,coalesce(p.listed,false) AS listed FROM safeer.companies c LEFT JOIN safeer.company_public_profiles p ON p.company_id=c.id ORDER BY c.created_at DESC,c.id DESC LIMIT 50 OFFSET p_page*50)
 SELECT jsonb_build_object('from',first_day,'to',last_day,'timezone','UTC','asOf',cutoff,'page',p_page,
 'companyCount',(SELECT count(*)::integer FROM safeer.companies),
 'summary',jsonb_build_object('pending',(SELECT count(*)::integer FROM safeer.companies WHERE status='pending'),'approved',(SELECT count(*)::integer FROM safeer.companies WHERE status='approved'),'listed',(SELECT count(*)::integer FROM safeer.company_public_profiles p JOIN safeer.companies c ON c.id=p.company_id WHERE p.listed AND c.status='approved'),'activeUsers',(SELECT count(*)::integer FROM safeer.users WHERE active),'departures',(SELECT count(*)::integer FROM safeer.trips WHERE status='published' AND departure_at>=starts AND departure_at<ends),'bookings',(SELECT count(*)::integer FROM safeer.bookings WHERE created_at>=starts AND created_at<ends AND created_at<=cutoff)),
 'totals',coalesce((SELECT jsonb_agg(jsonb_build_object('currency',currency,'salesMinor',sales::text,'refundMinor',refunds::text,'netMinor',(sales-refunds)::text) ORDER BY currency) FROM totals),'[]'::jsonb),
 'companies',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'nameEn',c.name_en,'nameAr',c.name_ar,'status',c.status,'listed',c.listed,'createdAt',c.created_at,'totals',coalesce((SELECT jsonb_agg(jsonb_build_object('currency',a.currency,'salesMinor',a.sales::text,'refundMinor',a.refunds::text,'netMinor',(a.sales-a.refunds)::text) ORDER BY a.currency) FROM amounts a WHERE a.company_id=c.id),'[]'::jsonb)) ORDER BY c.created_at DESC,c.id DESC) FROM companies c),'[]'::jsonb)) INTO result;
 INSERT INTO safeer.identity_audit(id,actor_id,action) VALUES(gen_random_uuid(),safeer.company_actor(),'platform.dashboard_read');
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION safeer.platform_notice(),safeer.platform_settings_read(),safeer.platform_settings_save(boolean,text,text,integer),safeer.notification_capture(),safeer.notification_visible(safeer.notification_events),safeer.notifications_list(bigint),safeer.notification_read(bigint),safeer.platform_dashboard(date,date,integer) FROM PUBLIC;
