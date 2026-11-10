-- D68 optional passenger accounts (Google sign-in). Guest booking is unchanged: an account only
-- links bookings the passenger already proves with the device key. Tables have RLS and no direct
-- runtime privileges; the API reaches them only through the reviewed functions below.
CREATE TABLE safeer.passenger_accounts (
 id uuid PRIMARY KEY,
 provider varchar(10) NOT NULL DEFAULT 'google' CHECK(provider IN ('google')),
 provider_subject varchar(255) NOT NULL CHECK(provider_subject ~ '^[A-Za-z0-9_-]{1,255}$'),
 email varchar(320) NOT NULL CHECK(email ~ '^[^@\s]+@[^@\s]+$'),
 display_name varchar(100) NOT NULL CHECK(length(btrim(display_name))>=1),
 picture_url varchar(500) CHECK(picture_url ~ '^https://'),
 mobile varchar(16) CHECK(mobile ~ '^\+[1-9][0-9]{7,14}$'),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 last_sign_in_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(provider,provider_subject)
);
CREATE TABLE safeer.passenger_sessions (
 id uuid PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES safeer.passenger_accounts(id) ON DELETE CASCADE,
 token_hash char(64) NOT NULL UNIQUE CHECK(token_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,revoked_at timestamptz,
 CHECK(expires_at>created_at)
);
CREATE INDEX passenger_sessions_account ON safeer.passenger_sessions(account_id,expires_at);
-- Saved co-travellers are kept by the account holder until changed or the account is deleted.
CREATE TABLE safeer.passenger_travelers (
 account_id uuid NOT NULL REFERENCES safeer.passenger_accounts(id) ON DELETE CASCADE,
 position smallint NOT NULL CHECK(position BETWEEN 0 AND 9),
 full_name varchar(100) NOT NULL CHECK(length(btrim(full_name))>=2),
 mobile varchar(16) CHECK(mobile ~ '^\+[1-9][0-9]{7,14}$'),
 PRIMARY KEY(account_id,position)
);
-- One owner per booking. Unlinking or deleting the account leaves the guest booking intact.
CREATE TABLE safeer.passenger_booking_links (
 company_id uuid NOT NULL,booking_id uuid NOT NULL,
 account_id uuid NOT NULL REFERENCES safeer.passenger_accounts(id) ON DELETE CASCADE,
 linked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,booking_id),
 FOREIGN KEY(company_id,booking_id) REFERENCES safeer.bookings(company_id,id)
);
CREATE INDEX passenger_booking_links_account ON safeer.passenger_booking_links(account_id,linked_at);
ALTER TABLE safeer.passenger_accounts ENABLE ROW LEVEL SECURITY;ALTER TABLE safeer.passenger_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE safeer.passenger_sessions ENABLE ROW LEVEL SECURITY;ALTER TABLE safeer.passenger_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE safeer.passenger_travelers ENABLE ROW LEVEL SECURITY;ALTER TABLE safeer.passenger_travelers FORCE ROW LEVEL SECURITY;
ALTER TABLE safeer.passenger_booking_links ENABLE ROW LEVEL SECURITY;ALTER TABLE safeer.passenger_booking_links FORCE ROW LEVEL SECURITY;

CREATE FUNCTION safeer.passenger_account_view(a safeer.passenger_accounts) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',a.id,'provider',a.provider,'email',a.email,'displayName',a.display_name,'pictureUrl',a.picture_url,'mobile',a.mobile,'version',a.version,'createdAt',a.created_at,
  'travelers',COALESCE((SELECT jsonb_agg(jsonb_build_object('fullName',t.full_name,'mobile',t.mobile) ORDER BY t.position) FROM safeer.passenger_travelers t WHERE t.account_id=a.id),'[]'::jsonb),
  'bookingCount',(SELECT count(*) FROM safeer.passenger_booking_links l WHERE l.account_id=a.id)::integer)
$$;
-- Resolves a live session; every other passenger function starts here.
CREATE FUNCTION safeer.passenger_actor(p_token text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE aid uuid;
BEGIN
 UPDATE safeer.passenger_sessions SET last_seen_at=clock_timestamp()
  WHERE token_hash=p_token AND revoked_at IS NULL AND expires_at>clock_timestamp() RETURNING account_id INTO aid;
 RETURN aid;
END $$;
-- Called only after the API has verified the Google ID token signature, audience, issuer and expiry.
CREATE FUNCTION safeer.passenger_sign_in(p_subject text,p_email text,p_name text,p_picture text,p_session uuid,p_token text,p_days integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a safeer.passenger_accounts%ROWTYPE;
BEGIN
 IF p_days IS NULL OR p_days NOT BETWEEN 1 AND 90 THEN RAISE EXCEPTION 'Invalid session length' USING ERRCODE='22023'; END IF;
 INSERT INTO safeer.passenger_accounts(id,provider,provider_subject,email,display_name,picture_url)
  VALUES(gen_random_uuid(),'google',p_subject,lower(p_email),left(btrim(p_name),100),p_picture)
  ON CONFLICT(provider,provider_subject) DO UPDATE SET email=EXCLUDED.email,picture_url=EXCLUDED.picture_url,last_sign_in_at=clock_timestamp()
  RETURNING * INTO a;
 INSERT INTO safeer.passenger_sessions(id,account_id,token_hash,expires_at) VALUES(p_session,a.id,p_token,clock_timestamp()+make_interval(days=>p_days));
 DELETE FROM safeer.passenger_sessions WHERE account_id=a.id AND (expires_at<=clock_timestamp() OR revoked_at<clock_timestamp()-interval '30 days');
 RETURN safeer.passenger_account_view(a);
END $$;
CREATE FUNCTION safeer.passenger_me(p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE aid uuid:=safeer.passenger_actor(p_token);
BEGIN
 IF aid IS NULL THEN RETURN NULL; END IF;
 RETURN (SELECT safeer.passenger_account_view(a) FROM safeer.passenger_accounts a WHERE a.id=aid);
END $$;
CREATE FUNCTION safeer.passenger_sign_out(p_token text,p_everywhere boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE aid uuid:=safeer.passenger_actor(p_token);
BEGIN
 IF aid IS NULL THEN RETURN false; END IF;
 UPDATE safeer.passenger_sessions SET revoked_at=clock_timestamp() WHERE account_id=aid AND revoked_at IS NULL AND (p_everywhere OR token_hash=p_token);
 RETURN true;
END $$;
-- Replaces the profile name/mobile and the whole saved traveller list (at most 10), version-checked.
CREATE FUNCTION safeer.passenger_save_profile(p_token text,p_version integer,p_name text,p_mobile text,p_travelers jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE aid uuid:=safeer.passenger_actor(p_token); a safeer.passenger_accounts%ROWTYPE;
BEGIN
 IF aid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_travelers)<>'array' OR jsonb_array_length(p_travelers)>10 THEN RAISE EXCEPTION 'Invalid travelers' USING ERRCODE='22023'; END IF;
 UPDATE safeer.passenger_accounts SET display_name=left(btrim(p_name),100),mobile=NULLIF(p_mobile,''),version=version+1
  WHERE id=aid AND version=p_version RETURNING * INTO a;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile changed elsewhere' USING ERRCODE='40001'; END IF;
 DELETE FROM safeer.passenger_travelers WHERE account_id=aid;
 INSERT INTO safeer.passenger_travelers(account_id,position,full_name,mobile)
  SELECT aid,(x.n-1)::smallint,btrim(x.v->>'fullName'),NULLIF(x.v->>'mobile','') FROM jsonb_array_elements(p_travelers) WITH ORDINALITY x(v,n);
 RETURN safeer.passenger_account_view(a);
END $$;
-- Linking needs the same device key that already proves the guest booking.
CREATE FUNCTION safeer.passenger_link_booking(p_token text,p_reference text,p_access text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE aid uuid:=safeer.passenger_actor(p_token); b safeer.bookings%ROWTYPE; owner uuid;
BEGIN
 IF aid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE='42501'; END IF;
 SELECT * INTO b FROM safeer.bookings WHERE reference=p_reference AND access_hash=p_access;
 IF NOT FOUND THEN RETURN 'not_found'; END IF;
 INSERT INTO safeer.passenger_booking_links(company_id,booking_id,account_id) VALUES(b.company_id,b.id,aid) ON CONFLICT DO NOTHING;
 SELECT account_id INTO owner FROM safeer.passenger_booking_links WHERE company_id=b.company_id AND booking_id=b.id;
 RETURN CASE WHEN owner=aid THEN 'linked' ELSE 'other_account' END;
END $$;
CREATE FUNCTION safeer.passenger_unlink_booking(p_token text,p_reference text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE aid uuid:=safeer.passenger_actor(p_token); n integer;
BEGIN
 IF aid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE='42501'; END IF;
 DELETE FROM safeer.passenger_booking_links l USING safeer.bookings b
  WHERE l.account_id=aid AND (b.company_id,b.id)=(l.company_id,l.booking_id) AND b.reference=p_reference;
 GET DIAGNOSTICS n=ROW_COUNT;RETURN n>0;
END $$;
-- Account trips reuse the D64 itinerary exactly as the device key would see it (tickets and QR included).
CREATE FUNCTION safeer.passenger_trips(p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE aid uuid:=safeer.passenger_actor(p_token);
BEGIN
 IF aid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('items',COALESCE((SELECT jsonb_agg(safeer.passenger_booking(b.reference,b.access_hash,NULL)||jsonb_build_object('linkedAt',l.linked_at) ORDER BY b.created_at DESC)
  FROM safeer.passenger_booking_links l JOIN safeer.bookings b ON (b.company_id,b.id)=(l.company_id,l.booking_id) WHERE l.account_id=aid),'[]'::jsonb));
END $$;
-- Removes the account, its sessions, saved travellers and links. Bookings stay as guest bookings.
CREATE FUNCTION safeer.passenger_delete_account(p_token text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE aid uuid:=safeer.passenger_actor(p_token);
BEGIN
 IF aid IS NULL THEN RETURN false; END IF;
 DELETE FROM safeer.passenger_accounts WHERE id=aid;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION safeer.passenger_account_view(safeer.passenger_accounts),safeer.passenger_actor(text),safeer.passenger_sign_in(text,text,text,text,uuid,text,integer),
 safeer.passenger_me(text),safeer.passenger_sign_out(text,boolean),safeer.passenger_save_profile(text,integer,text,text,jsonb),safeer.passenger_link_booking(text,text,text),
 safeer.passenger_unlink_booking(text,text),safeer.passenger_trips(text),safeer.passenger_delete_account(text) FROM PUBLIC;
