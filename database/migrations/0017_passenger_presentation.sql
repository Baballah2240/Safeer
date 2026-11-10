-- D64: read-only passenger itinerary and paid-ticket presentation. Existing migrations are unchanged.
CREATE FUNCTION safeer.passenger_booking(p_reference text,p_access text,p_mobile text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b safeer.bookings%ROWTYPE; t safeer.trips%ROWTYPE; doc jsonb; trip_doc jsonb;
BEGIN
 -- Exactly one existing proof: device key hash, or reference+mobile (masked, no QR).
 IF (p_access IS NULL)=(p_mobile IS NULL) THEN RETURN NULL; END IF;
 SELECT x.* INTO b FROM safeer.bookings x LEFT JOIN safeer.booking_contacts c ON (c.company_id,c.booking_id)=(x.company_id,x.id)
 WHERE x.reference=p_reference AND ((p_access IS NOT NULL AND x.access_hash=p_access) OR (p_access IS NULL AND c.mobile=p_mobile));
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO t FROM safeer.trips WHERE company_id=b.company_id AND id=b.trip_id;
 doc:=safeer.booking_view(b);
 SELECT jsonb_build_object('departureAt',t.departure_at,'arrivalAt',t.arrival_at,'timezone',t.timezone,
  'fromNameEn',first_stop.city_name_en,'fromNameAr',first_stop.city_name_ar,'toNameEn',last_stop.city_name_en,'toNameAr',last_stop.city_name_ar,
  'arrivalDate',to_char(t.arrival_at AT TIME ZONE t.timezone,'YYYY-MM-DD'),'arrivalTime',to_char(t.arrival_at AT TIME ZONE t.timezone,'HH24:MI'),
  'stops',COALESCE((SELECT jsonb_agg(jsonb_build_object('cityNameEn',s.city_name_en,'cityNameAr',s.city_name_ar,'stationNameEn',s.station_name_en,'stationNameAr',s.station_name_ar) ORDER BY s.stop_index) FROM safeer.trip_stops s WHERE s.company_id=t.company_id AND s.trip_id=t.id),'[]'::jsonb)) INTO trip_doc
 FROM safeer.trip_stops first_stop JOIN safeer.trip_stops last_stop ON last_stop.company_id=first_stop.company_id AND last_stop.trip_id=first_stop.trip_id AND last_stop.stop_index=t.stop_count-1
 WHERE first_stop.company_id=t.company_id AND first_stop.trip_id=t.id AND first_stop.stop_index=0;
 IF p_access IS NULL THEN
  doc:=safeer.mask_booking(doc);
 ELSE
  doc:=doc||jsonb_build_object('tickets',COALESCE((SELECT jsonb_agg(jsonb_build_object('number',k.ticket_number,'seat',a.label,'status',k.status,
   'qrToken',CASE WHEN b.status='confirmed' AND t.status='published' AND k.status='valid' THEN q.value END) ORDER BY a.row_number,a.column_number)
   FROM safeer.tickets k JOIN safeer.seat_allocations a ON (a.company_id,a.id)=(k.company_id,k.allocation_id)
   LEFT JOIN safeer.ticket_credentials q ON (q.company_id,q.ticket_id)=(k.company_id,k.id)
   WHERE k.company_id=b.company_id AND k.booking_id=b.id),'[]'::jsonb));
 END IF;
 RETURN doc||COALESCE(trip_doc,'{}'::jsonb);
END $$;
REVOKE ALL ON FUNCTION safeer.passenger_booking(text,text,text) FROM PUBLIC;
