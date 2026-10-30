-- Section 01: namespace only. Business tables belong to their numbered sections.
CREATE SCHEMA safeer;
REVOKE ALL ON SCHEMA safeer FROM PUBLIC;
COMMENT ON SCHEMA safeer IS 'Safeer private application namespace; business migrations follow by section.';
