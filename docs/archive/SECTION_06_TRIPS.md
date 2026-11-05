# Section 06 - Trip scheduling and management

Authorized by the owner's "next" on 2026-11-02, decision D27. Version 0.7.0. Status: source complete and verified. One owner step is open: upgrading the existing private local database (below).

## Delivered source

Company staff can schedule draft trips from an active route, singly or repeated across up to 31 dates, with a departure time, minutes after departure for every stop and a fare. They assign a bus and driver, publish, replace either with a recorded reason, and cancel with a recorded reason. Each trip keeps its own copy of the route, stops, seat-layout revision and driver name.

Migration 0006 adds trips, trip_stops and trip_assignments, with row security, same-company foreign keys, database-filled snapshots, status rules, overlap protection, capacity guards and two permissions on the new-company administrator template. Migrations 0001-0005 are unchanged. Existing company role copies are not rewritten.

New API operations: GET/POST companies/:id/trips; GET/PATCH trips/:rid; POST trips/:rid/assignment; POST trips/:rid/publish; POST trips/:rid/cancel. Writes reauthenticate and require CSRF.

Files added: database/migrations/0006_trips.sql, apps/api/src/trip.service.ts, src/trips.js, tests/trips.integration.mjs, tests/trips.browser.mjs, the trip workflow and this handover. Controller/provider registration, runtime grants, company permissions and capabilities, UI wiring, translations, assets, contract, version files and affected test counts are updated. No Stocrant or school files are changed.

## Verification and issues

68 automated checks passed on a disposable PostgreSQL instance, without failures or skips: 13 unit/server and 55 native PostgreSQL (10 database, 12 identity, 10 company, 8 route, 7 fleet, 8 trip). Trip browser checks passed 48 Arabic/English dark/light layouts per source and built run at 1920, 1366, 390 and 320 pixels with no browser or security-policy errors. Fleet, route and company source browser suites also passed.

Coverage: snapshots surviving route edits, all-or-none repeats, company timezone, publish conditions, status rules, overlap for bus and driver, reassignment history, protected buses and drivers, unauthorized and direct SQL access, simultaneous saves and the 5000-trip limit.

Testing found and fixed one defect: publishing an already published trip succeeded and overwrote its publish time. The database now rejects this.

## Open owner step: upgrade the private local database

The real runtime/ database has not been upgraded past Section 04. The automated session was not permitted to stop the running local launcher, so migrations 0005 and 0006 and their backup are still to run.

1. Stop the running local launcher.
2. npm.cmd run local:backup -- Section-06
3. npm.cmd run local

Do not run step 3 if step 2 reports a failure. Existing companies then need the fleet, driver and trip permissions added to a company-wide role.

## Checkpoint

Source checkpoint: archives/Safeer-0.7.0-Section-06-2026-11-02.zip, generated from the committed source. It excludes accounts, credentials, runtime databases, backups, native caches and node_modules.

## Limits and next section

Local only; 5000 trips per company; up to 31 trips per request; list shows up to 200 current and upcoming trips. Fares are stored on the trip but nothing is sold. No passenger search, seat inventory, reservations, departure or arrival records, driver logins, payments or freight. Reassigning a published trip is unrestricted because no seats can be sold yet; Section 08 must add its rule. Stop before Section 07 (passenger marketplace and company pages) until the owner approves it. Continue from [CURRENT_STATE](../CURRENT_STATE.md).
