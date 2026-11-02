# Section 04 - Cities, routes, destinations and stops

Authorized by the owner's "next" on 2026-11-02, decision D25. Version 0.5.0. Status: complete and verified.

## Delivered source

Bilingual shared city catalog, optional station-city assignment, company-private route catalog and details, ordered stop editor with keyboard/touch controls, active/history handling and useful empty/validation states. Existing company, identity and passenger workflows remain separate.

Database migration 0004 adds cities/routes/route_stops, nullable station city links, composite same-company/city FKs, row security, deferred full-route validation, immutable route ownership, bounded capacities and protected referenced resources. Migrations 0001-0003 are unchanged. Route endpoints derive from first/last stops; expected versions protect atomic replacement. New global templates receive two route permissions; existing tenant role copies are preserved.

New API operations: GET/POST cities, PATCH cities/:id, GET/POST companies/:id/routes and GET/PATCH companies/:id/routes/:rid. Writes reauthenticate and require CSRF; company route access requires company-wide permissions. The global catalog is authenticated, with edits restricted to Super Admin. No deletion or passenger trip publication exists.

Files added: database/migrations/0004_routes.sql, apps/api/src/route.service.ts, src/routes.js, tests/routes.integration.mjs, tests/routes.browser.mjs, route workflow and this handover. Existing controller/provider registration, runtime grants/startup checks, company station/role handling, UI/translation/assets, contracts, version files, affected tests and continuation documents are updated. No Stocrant/school files are changed.

## Verification and issues

Verify migration preservation, scope and foreign references, raw RLS, active resources, concurrent edits/deactivation, support expiry, station-city history, source/built bilingual responsive workflows and existing regression suites. The browser checks caught and corrected the station-city selector being placed on the wrong form. Initial baseline tests needed dynamic migration numbering and the new table catalog. All 52 automated checks passed (13 unit/server plus 39 native PostgreSQL), without failures or skips. Source/built route screens passed 48 layouts each; company screens passed 72 and identity screens 60 per mode. Passenger/luggage built checks passed. The local migration preserved existing accounts/credentials and 11 company tables, and the private backup was restored and verified in isolation. Build and documentation checks passed. Exact evidence is recorded in CURRENT_STATE and ignored receipts included in the source checkpoint.

Checkpoint: archives/Safeer-0.5.0-Section-04-2026-11-02.zip, generated from committed source, with ZIP CRC and individual file hashes verified. Runtime data, passwords, account files and backups remain private and excluded. Source ZIP restoration starts a fresh local identity database; preserving an existing installation needs its separate private backup.

## Limits and next section

Local only; 1000 cities, 500 routes/company, 30 stops/route. No freight, fleet, trips, real booking/payment/ticketing or native clients. Versioned edits are current route configuration; future trips must take snapshots. Explicit permission assignment is required for existing tenant roles. Stop before Section 05 (bus fleet, immutable seat layouts and drivers) until the owner approves it. Continue from [CURRENT_STATE](../CURRENT_STATE.md).
