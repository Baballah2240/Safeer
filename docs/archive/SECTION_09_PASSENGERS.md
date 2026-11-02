# Section 09 - Passenger information and booking management

Authorized by the owner's "next" on 2026-11-02, decision D31. Version 0.10.0. Status: source complete and verified. One owner step is open: upgrading the existing private local database (below).

## Delivered source

Passengers enter a full name per seat and one mobile number with their seats, and both commit together with the hold. A new /booking page reopens a booking with its reference and mobile number, showing a masked number and shortened names, and allows viewing or release only. It also lists bookings made on that device, and a link can be forgotten. A new Bookings section lets staff list, search and open bookings, correct details while seats are held, and see each booking's history. Personal details are erased 90 days after the trip ends.

Migration 0009 adds booking_contacts and booking_passengers, apart from the immutable booking history, plus fixed functions for holds, retrieval, staff access and erasure. Migrations 0001-0008 are unchanged. The runtime role has no access to these tables.

New API operations: anonymous GET public/holds/current and POST public/holds/lookup; GET companies/:id/bookings, GET companies/:id/bookings/:bid and PATCH companies/:id/bookings/:bid. POST public/holds now requires mobile and travelers, and POST public/holds/:reference/release also accepts mobile.

Files added: database/migrations/0009_passengers.sql, src/bookings.js, tests/passengers.integration.mjs, the passenger bookings workflow and this handover. No Stocrant or school files are changed.

## Verification and issues

87 automated checks passed on a disposable PostgreSQL instance, without failures or skips: 13 unit/server and 74 native PostgreSQL (10 database, 12 identity, 10 company, 8 route, 7 fleet, 8 trip, 5 marketplace, 8 reservation, 6 passenger). The reservation browser suite passed 48 Arabic/English dark/light layouts per source and built run at 1920, 1366, 390 and 320 pixels with no browser or security-policy errors. Marketplace, trip, fleet, route, company, identity and passenger prototype browser suites also passed.

Coverage includes refused holds taking no seats, retrieval masking, guess limits, erasure timing and completeness, other companies and missing permissions refused, audited access, and no names or numbers in browser storage.

An independent review before commit found and fixed: an unkeyed retry fingerprint that could confirm an erased number; staff reasons outliving erasure; bulk reads missing from the audit; a client over its limit still using up another booking's attempts; a first success permanently using an attempt; a retry at the limit discarding the only key; the old detail-free hold route staying callable after an upgrade; a seat label breaking the correction form; and smaller retrieval and display problems.

Verification also found a timing bug in the staff dialog: its delayed close event could wipe a form opened in the moments after another closed. This is fixed. The fleet browser suite then passed 15 of 16 repeat runs. The one failure, a seat map dialog with no Close button, did not recur in 10 further instrumented runs and its cause is unknown, so treat a repeat as a real signal.

Erasure was tested by moving stored dates as the database owner. A full 90-day wait was not run.

## Open owner step: upgrade the private local database

The real runtime/ database is still at Section 04. The automated session was not permitted to stop the running local launcher, so migrations 0005-0009 and their backup are still to run.

1. Stop the running local launcher.
2. npm.cmd run local:backup -- Section-09
3. npm.cmd run local

Do not run step 3 if step 2 reports a failure.

## Checkpoint

Source checkpoint: archives/Safeer-0.10.0-Section-09-2026-11-02.zip, generated from the committed source. It excludes accounts, credentials, runtime databases, backups, native caches and node_modules.

## Limits and next section

Local only. Numbers are not verified, because SMS is not authorized, so anyone can enter any number, and someone who knows a reference and its number can view or release that booking. Backups are not erased or deleted automatically, so old backups keep details until the owner deletes them. Names and numbers are not encrypted separately inside the database, and disk or database encryption is a hosting decision. A trip's cancel reason sits on the trip and is not erased, so it must not name passengers. The retention period and privacy wording are not legal advice and need checking against Sudanese requirements before real data is collected. A hold still cannot become a ticket until Section 10. Stop before Section 10 (station ticketing, payments, tickets and receipts) until the owner approves it. Continue from [CURRENT_STATE](../CURRENT_STATE.md).
