# Current state - read this first

Updated: 2026-11-02. Safeer / Sudan Transport, version 0.12.0.

## Current section and next gate

Section 11 (D33), including the local upgrade, is complete. On 2026-11-02 the owner approved the backup/update/restart (D34): the running app is now 0.12.0 with migrations 0001-0011 applied. One existing account, its credentials and settings, and all 18 preserved legacy tables passed integrity comparisons. There are no companies in this private runtime yet. The owner will revisit money policy later; open questions remain in [Section 10](archive/SECTION_10_TICKETING.md). The subsequent "next" authorizes Section 12 preparation (D35). Driver client format and operational authority are awaiting the owner's answers; no Section 12 feature or migration is implemented. See [preparation](modules/DRIVER_BOARDING_PREPARATION.md). Stop before Section 13.

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

Migrations 0001-0011 are immutable and applied locally. Migration 0011_luggage.sql adds luggage_records, luggage_tags, luggage_events, luggage_exceptions and a declaration on booking_passengers. Current totals: 49 application tables plus the migration ledger, 41 RLS tables, 30 permissions, 79 API paths / 92 operations and 26 public assets. Earlier migrations add station ticketing, passenger details, atomic seat holds, public profiles, trip/seat snapshots, immutable fleet revisions and company-private routes. Each numbered section below retains its own historical verification.

The global city catalog is authenticated and Super Admin-managed. Company RLS still derives authority from the valid raw opaque session set transaction-locally, not actor/company flags. Local bounds: 1000 cities, 500 routes/company and 30 stops/route, alongside the existing Section 03 company/resource limits. No DELETE city/route endpoint exists. Current routes use unique(company_id,code); version is optimistic concurrency. Section 06 must snapshot routes/stops for trips before publication.

## Verification, backup and archive

Native tests use disposable databases and restricted runtime roles, never the persistent local database. Section 11 passed 102 automated checks (13 unit/server and 89 native PostgreSQL), without failures or skips. Luggage workflows passed 32 Arabic/English dark/light layouts per source and built run at 1920, 1366, 390 and 320 pixels. D34 additionally verifies the actual private runtime backup, restore and upgrade; see the local verification below.

Verified exact-source checkpoint: archives/Safeer-0.12.0-Section-11-2026-11-02.zip. It excludes accounts, credentials, runtime databases/backups, native caches and node_modules. Existing checkpoints remain separate. Source commit/push status is reported separately; pushing is not hosting deployment.

## Remaining work

The local upgrade is verified and running. Section 12 boarding/driver preparation is underway; implementation awaits the client and permission decisions. Later financial reporting is not started. The passenger preview at / still uses fictional in-memory records and must not be confused with durable holds. No Safeer native app or external deployment exists.

## Local upgrade verification (D34)

The private backup matched 1378 files and a protected restore copy started with the existing account, then stopped and was safely removed. The original private backup remains under runtime/backups/. Existing users/credentials, first-login file, private settings, role labels and legacy records were unchanged. The upgraded catalog has 49 application tables, 41 RLS tables and 30 permissions; source contracts list 79 paths/92 operations and the build contains 26 public assets. The build, all 13 unit/server tests and documentation checks passed again for this handover. The earlier Section 11 native/browser results above remain the domain verification; this maintenance update changed no business rules or UI workflows.

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
