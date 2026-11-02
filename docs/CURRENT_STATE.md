# Current state - read this first

Updated: 2026-11-02. Safeer / Sudan Transport, version 0.12.0.

## Current section and next gate

The owner's latest "next" authorizes Section 11 (D33): passenger luggage. Source is complete and verified. **Open owner step:** the real runtime/ database is still at Section 04. Stop the running launcher, then run npm.cmd run local:backup -- Section-11 and npm.cmd run local; see [Section 11](archive/SECTION_11_LUGGAGE.md). The owner said they will come back to the money flow later; open questions are listed in [Section 10](archive/SECTION_10_TICKETING.md). Stop before Section 12 (driver client, QR verification, boarding) until explicitly approved.

## Working application

Local bilingual staff UI at http://127.0.0.1:4320/staff with the NestJS/TypeScript API and PostgreSQL. Identity, protected Super Admin, company approval/settings, branches/stations, tenant roles, scoped staff, read-only support and audit remain implemented. Existing dark/light skeuomorphic styling and passenger/luggage demonstration are retained.

Section 04 adds a shared Cities & destinations catalog. Super Admin creates/edits bilingual city names, canonical codes, country codes and active state. Authenticated staff can read the catalog. It contains no seeded real geography or passenger data.

Companies -> Branches & stations now supports an optional City assignment. Existing station identities, branches and staff links are preserved; old stations initially have no city. Companies -> Routes & stops supports names/codes, active state, ordered stop details, creation/editing, adding/removing/reordering stops and optional station selection filtered by city.

A route has 2-30 contiguous zero-based stops and different origin/destination cities. Identical city/station pairs cannot repeat; distinct stations in one city are allowed. Stop station references must match both company and city. Edits replace the route and its stops atomically, with expected version, current password, CSRF and audit. Failed/stale saves preserve the existing route. Deactivation keeps history. Active routes require active city/station/branch resources; retire affected routes before deactivating those resources. A station's city cannot change while any route references it.

Route catalog permissions are company-wide company.routes.read/manage. Branch/station-only grants cannot broaden route access. Management also requires company-wide resource reads. Explicit support grants can include read-only routes with expiry/revocation. Existing company role copies are unchanged: Super Admin must explicitly add new route permissions to an existing company role. New-company administrator templates include them.

## Run and use

From this folder use Node 24+, npm.cmd ci (when dependencies are absent), then npm.cmd run local. The local launcher applies append-only migrations with a private owner and runs the API as a separate restricted runtime role. Only loopback is enabled. Existing account passwords are not regenerated.

On a fresh database only, owner@safeer.local receives a generated temporary password privately in runtime/first-login.txt; change it at first sign-in. Keep runtime/ intact. Private credentials/databases/backups are excluded from Git and source ZIPs. See [setup/recovery](database/IDENTITY_SETUP.md).

Workflow: Super Admin -> Cities & destinations -> add cities -> Companies -> add/select company -> approve -> add branches/stations and assign station cities -> Routes & stops -> create route -> set stops in travel order. See [route planning](workflows/ROUTE_PLANNING.md) and [company access](workflows/COMPANY_ACCESS.md).

## Database and API

Migrations 0001-0010 are immutable. New 0011_luggage.sql adds luggage_records, luggage_tags, luggage_events, luggage_exceptions and a declaration on booking_passengers. There are 49 application tables plus the migration ledger and 41 RLS tables. Earlier, 0010_ticketing.sql added company_payment_settings, station_counters, cash_sessions, document_sequences, payments, receipts, tickets, refunds, document_prints and fixed functions for counter work. Earlier, 0009_passengers.sql added booking_contacts, booking_passengers and functions for retrieval, staff access and erasure. Earlier, 0008_reservations.sql added bookings, seat_allocations, booking_events and fixed hold functions. Earlier, 0007_marketplace.sql added company_public_profiles and fixed anonymous read projections. Earlier, 0006_trips.sql added trips, trip_stops and trip_assignments with company-wide RLS, database-filled snapshots and overlap protection. Earlier, 0005_fleet.sql added seat_layouts, seat_layout_revisions, seat_layout_seats, buses and drivers with company-wide RLS, sealed revisions and capacity guards. Earlier, 0004_routes.sql added cities, routes and route_stops plus nullable station city IDs, scoped policies, composite FKs, deferred route validation, resource guards and template permissions. There are 22 application tables plus the migration ledger, 14 RLS tables, 17 permissions, 31 implemented API paths / 38 operations and 16 allowlisted public assets.

The global city catalog is authenticated and Super Admin-managed. Company RLS still derives authority from the valid raw opaque session set transaction-locally, not actor/company flags. Local bounds: 1000 cities, 500 routes/company and 30 stops/route, alongside the existing Section 03 company/resource limits. No DELETE city/route endpoint exists. Current routes use unique(company_id,code); version is optimistic concurrency. Section 06 must snapshot routes/stops for trips before publication.

## Verification, backup and archive

Native tests use disposable databases and restricted runtime roles, never the persistent local database. All 102 automated checks passed (13 unit/server and 89 native PostgreSQL), without failures or skips. Luggage workflows passed 32 Arabic/English dark/light layouts per source and built run at 1920, 1366, 390 and 320 pixels. The backup command and upgrade path were proven on a throwaway runtime only.

Verified exact-source checkpoint: archives/Safeer-0.12.0-Section-11-2026-11-02.zip. It excludes accounts, credentials, runtime databases/backups, native caches and node_modules. Existing checkpoints remain separate. Source commit/push status is reported separately; pushing is not hosting deployment.

## Remaining work

Section 11 source is complete; the local database upgrade above is open. Stop before Section 12 until explicitly approved. boarding and finance remain later sections. The passenger preview at / still uses fictional in-memory records and must not be confused with durable holds. No Safeer native app or external deployment was requested.

## Section 05 fleet

Company workspaces add Buses & seat maps and Drivers. See [fleet workflow](workflows/FLEET_MANAGEMENT.md). New-company administrators receive the four permissions; existing company role copies need them assigned explicitly.

## Section 06 trips

Company workspaces add Trips. See [trip workflow](workflows/TRIP_SCHEDULING.md). Existing company role copies need the trip permissions assigned explicitly.

## Section 07 marketplace

Public pages are at /marketplace and /company/{slug}. See [marketplace workflow](workflows/MARKETPLACE.md). Existing companies stay hidden until they list themselves under Public page.

## Section 08 seat holds

Passengers hold seats at /trip/{id} and keep a reference at /hold/{reference}. See [seat holds workflow](workflows/SEAT_HOLDS.md). Existing company roles need the new booking permissions added. A hold cannot yet become a ticket.

## Section 09 passengers

Passengers give names and a mobile number with each hold and reopen bookings at /booking. Staff use Bookings in the company workspace. Details are erased 90 days after the trip; backups are not. See [passenger bookings workflow](workflows/PASSENGER_BOOKINGS.md).

## Section 10 ticketing

Staff use Station in the company workspace to open a counter session, sell walk-in seats, take payment for a booking, print and refund. Existing company roles need the new ticketing, late-payment and session permissions added. See [station ticketing workflow](workflows/STATION_TICKETING.md).

## Section 11 luggage

Staff use Luggage in the company workspace to register bags on paid tickets, print QR tags, move bags along the journey, report and resolve problems, and hand bags over. Travelers can say what they carry when booking. Existing company roles need the two new luggage permissions added. See [luggage workflow](workflows/LUGGAGE.md).
