# Section 05 - Bus fleet, seat layouts and drivers

Authorized by the owner's "next" on 2026-11-02, decision D26. Version 0.6.0. Status: source complete and verified. One owner step is open: upgrading the existing private local database (below).

## Delivered source

Company-private seat layouts with a stable code and immutable numbered revisions, a visual seat-map editor and viewer, buses that each use one layout revision, and driver records with an optional staff link. Existing company, route, identity and passenger workflows remain separate.

Migration 0005 adds seat_layouts, seat_layout_revisions, seat_layout_seats, buses and drivers, with row security, same-company composite foreign keys, sealed revisions, capacity guards and four permissions on the new-company administrator template. Migrations 0001-0004 are unchanged. Existing company role copies are not rewritten, so existing companies need these permissions assigned explicitly.

New API operations: GET companies/:id/fleet; POST fleet/layouts; PATCH fleet/layouts/:rid; POST fleet/layouts/:rid/revisions; GET fleet/layouts/:rid/revisions/:revision; POST fleet/buses; PATCH fleet/buses/:rid; GET/POST companies/:id/drivers; PATCH drivers/:rid. Writes reauthenticate and require CSRF.

Files added: database/migrations/0005_fleet.sql, database/backup-local.mjs, apps/api/src/fleet.service.ts, src/fleet.js, tests/fleet.integration.mjs, tests/fleet.browser.mjs, the fleet workflow and this handover. Controller/provider registration, runtime grants, company permissions and capabilities, UI wiring, translations, assets, contract, version files and affected test counts are updated. No Stocrant or school files are changed.

## Verification and issues

60 automated checks passed on a disposable PostgreSQL instance, without failures or skips: 13 unit/server and 47 native PostgreSQL (10 database, 12 identity, 10 company, 8 route, 7 fleet). Fleet browser checks passed 64 Arabic/English dark/light layouts per source and built run at 1920, 1366, 390 and 320 pixels with no browser or security-policy errors. Passenger, identity, company (source) and route (source and built) browser suites also passed.

Coverage: unauthorized and direct SQL access, immutable revisions (including against the database owner), sealed revisions refusing late seats, concurrent saves, active-bus and layout protection, capacity at 200, migration preservation, and a backup, restore-copy and 0004-to-0005 upgrade run on a throwaway runtime.

Testing found and fixed two defects: the deferred layout validator read a column absent from one of its tables and failed every layout save, and a layout from another company returned the wrong error before the foreign key could reject it.

## Open owner step: upgrade the private local database

The real runtime/ database has not been upgraded and no Section 05 backup of it exists. The automated session was not permitted to stop the running local launcher. Until this runs, that database stays at Section 04, and the fleet screens stay hidden while the older API process keeps running.

1. Stop the running local launcher.
2. npm.cmd run local:backup -- Section-05
3. npm.cmd run local

Step 2 stops only a database left running, copies runtime/ privately, checks every file and starts a separate copy to prove it restores. Do not run step 3 if step 2 reports a failure.

## Checkpoint

Source checkpoint: archives/Safeer-0.6.0-Section-05-2026-11-02.zip, generated from the committed source. It excludes accounts, credentials, runtime databases, backups, native caches and node_modules.

## Limits and next section

Local only; 200 buses, 200 drivers and 200 layout revisions per company; 1-20 rows, 1-7 columns and 1-100 seats per map. No scheduling, trip assignments, seat reservations, fares, payments, freight or native clients. A linked staff member is an identity reference, not a login or a grant. Stop before Section 06 (trip scheduling and management) until the owner approves it. Continue from [CURRENT_STATE](../CURRENT_STATE.md).
