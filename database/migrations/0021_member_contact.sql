-- D69 staff member contact details: optional work phone (international form) and job title.
-- Existing members keep NULL values; no permissions or assignments change.
ALTER TABLE safeer.company_users ADD COLUMN phone varchar(16) CHECK(phone ~ '^\+[1-9][0-9]{7,14}$');
ALTER TABLE safeer.company_users ADD COLUMN job_title varchar(80) CHECK(length(btrim(job_title))>0);
