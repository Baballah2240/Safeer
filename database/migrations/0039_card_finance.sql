-- D137: online card payments (D136) appear in finance: the whole-company report lists them as "Online card
-- payments" with their own method, and "card" can be chosen as a method filter. Station views are unchanged.
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
 SELECT m.id,m.kind,m.at,m.amount,m.currency,m.document::text,m.employee_id,COALESCE(u.display_name::text,'Card payment'),s.station_id,COALESCE(st.name_en::text,'Online card payments'),COALESCE(st.name_ar::text,'مدفوعات البطاقة عبر الإنترنت'),m.trip_id,t.route_name_en::text,t.route_name_ar::text,m.payment_method::text,m.tickets
 FROM movements m LEFT JOIN safeer.cash_sessions s ON s.company_id=cid AND s.id=m.session_id
 LEFT JOIN permitted_stations permitted ON permitted.id=s.station_id
 LEFT JOIN safeer.stations st ON (st.company_id,st.id)=(s.company_id,s.station_id)
 LEFT JOIN safeer.users u ON u.id=m.employee_id
 JOIN safeer.trips t ON (t.company_id,t.id)=(cid,m.trip_id)
 WHERE m.at>=starts AND m.at<ends AND m.at<=cutoff
 -- D137: station movements need a permitted station; online card payments (no cash drawer) are shown only in the
 -- whole-company view, to people who may read the whole company's finances.
 AND ((m.session_id IS NOT NULL AND permitted.id IS NOT NULL) OR (m.session_id IS NULL AND m.payment_method='card' AND station IS NULL AND safeer.company_can(cid,'company.finance.read')))
 AND (station IS NULL OR s.station_id=station) AND (employee IS NULL OR m.employee_id IS NOT DISTINCT FROM employee) AND (method IS NULL OR m.payment_method=method)
$$;

CREATE OR REPLACE FUNCTION safeer.finance_report(cid uuid,first_day date,last_day date,station uuid,employee uuid,method text,p_page integer,p_session_page integer,p_cutoff timestamptz,exporting boolean)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE tz text; starts timestamptz; ends timestamptz; cutoff timestamptz:=coalesce(p_cutoff,clock_timestamp()); result jsonb;
BEGIN
 IF NOT safeer.company_has(cid,'company.finance.read') THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501'; END IF;
 IF first_day IS NULL OR last_day IS NULL OR last_day<first_day OR last_day-first_day>30 OR p_page IS NULL OR p_page<0 OR p_page>1000000 OR p_session_page IS NULL OR p_session_page<0 OR p_session_page>1000000 OR cutoff>clock_timestamp() OR (method IS NOT NULL AND method NOT IN ('cash','bank_transfer','mobile_wallet','card')) THEN RAISE EXCEPTION 'INVALID_REPORT' USING ERRCODE='P0001'; END IF;
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
