# Section 08 - Seat inventory and temporary reservations

Authorized by the owner's "next" on 2026-11-02, decision D30. Version 0.9.0. Status: source complete and verified. One owner step is open: upgrading the existing private local database (below).

## Delivered source

Passengers choose seats on a live seat map at /trip/{id} and hold 1-10 of them with no account. They get a booking reference and a countdown at /hold/{reference}, and can release the hold. Staff see held seats and hold history under Seats and holds on a trip, and can release a hold with a reason and their current password. Search results show seats left and link to the seat map.

Migration 0008 adds bookings, seat_allocations and booking_events, the company.bookings.read and company.bookings.manage permissions, and the btree_gist extension. Migrations 0001-0007 are unchanged. The runtime role has no access to the new tables; every read and write goes through fixed database functions.

How a hold stays correct:

- The trip row is locked for the whole operation, so claims on one trip run one at a time and claims on different trips do not wait for each other.
- All requested seats are held or none are. A database exclusion constraint is the final guarantee against sharing a seat, even if the application were wrong.
- Claims store a range of stops. Today every hold covers the whole trip because fares do (D28). Selling parts of a journey is a later change that needs no new table.
- Expiry is decided by comparing expires_at with the database clock at every read and write. A job every 30 seconds only tidies the records, so a late or stopped job cannot extend a hold.
- The browser creates a random key for each attempt and saves it before sending. A retry with the same key returns the same hold, including when the first reply was lost. Only the key's hash is stored, and the reference alone opens nothing.

New API operations: anonymous GET public/trips/:id, POST public/holds, GET public/holds/:reference and POST public/holds/:reference/release; GET companies/:id/trips/:rid/seats and POST companies/:id/trips/:rid/holds/:hid/release.

Files added: database/migrations/0008_reservations.sql, apps/api/src/reservation.service.ts, tests/reservations.integration.mjs, tests/reservations.browser.mjs, the seat holds workflow and this handover. No Stocrant or school files are changed.

## Verification and issues

81 automated checks passed on a disposable PostgreSQL instance, without failures or skips: 13 unit/server and 68 native PostgreSQL (10 database, 12 identity, 10 company, 8 route, 7 fleet, 8 trip, 5 marketplace, 8 reservation). The reservation browser suite passed 32 Arabic/English dark/light layouts per source and built run at 1920, 1366, 390 and 320 pixels with no browser or security-policy errors. Marketplace, trip, fleet, company, identity and passenger browser suites also passed.

Coverage includes 20 simultaneous requests for one seat with exactly one winner; overlapping multi-seat groups in opposite orders with no deadlock or partial hold; concurrent retries sharing one hold; holds lapsing before the job runs; holds capped at departure; a reply lost after commit; other companies, wrong keys and missing permissions refused; direct table access blocked; and history that even the database owner cannot edit through normal statements.

An independent review before commit found and fixed: a lost reply that discarded the only key to a live hold, the proxy's 503 being treated as a refusal, a background refresh closing the release confirmation, a bus change freezing the seat page, focus lost on refresh, a silent failed release, overlapping requests when the countdown reached zero, trip cancellation rewriting already-lapsed holds as released, live holds able to fall off the staff list, and contact details still showing after a company hid itself. The hold limit was also changed to count seats rather than requests.

During verification two test runs appeared to crash mid-test with no error. Section 09 traced this to the verification command itself: each run had reached its own time limit, which killed the test process. It was not an application fault.

The identity browser suite had been broken since Section 07, when the new Marketplace sidebar link shared a class with the passenger preview link and the test clicked the wrong one. The app was unaffected. The test now selects the right link.

Tests move time by editing stored timestamps with triggers off, as the database owner. Holds were not left to run for real minutes.

## Open owner step: upgrade the private local database

The real runtime/ database is still at Section 04. The automated session was not permitted to stop the running local launcher, so migrations 0005-0008 and their backup are still to run.

1. Stop the running local launcher.
2. npm.cmd run local:backup -- Section-08
3. npm.cmd run local

Do not run step 3 if step 2 reports a failure.

## Checkpoint

Source checkpoint: archives/Safeer-0.9.0-Section-08-2026-11-02.zip, generated from the committed source. It excludes accounts, credentials, runtime databases, backups, native caches and node_modules.

## Limits and next section

Local only. A hold has no passenger name or phone until Section 09, and cannot become a ticket until Section 10, so the hold page's instruction to pay at a station cannot yet be completed. The hold limit of 120 seats per client address per 15 minutes sees one address behind the local proxy: hosting must forward the real client address, and should add a limit on public reads, before any public exposure. The page text is not final policy: cancellation cutoffs and late payment remain open operational decisions. Stop before Section 09 (passenger information and booking management) until the owner approves it. Continue from [CURRENT_STATE](../CURRENT_STATE.md).
