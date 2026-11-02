# Current state — read this first

Updated: 2026-11-03. Safeer / Sudan Transport, version **0.13.0**. Section 12 is complete under D35-D36. Stop before Section 13 financial reporting/reconciliation until the owner approves it.

## Running local application

- Staff and company management: http://127.0.0.1:4320/staff
- Driver workspace: http://127.0.0.1:4320/driver
- Real local marketplace: http://127.0.0.1:4320/marketplace
- Fictional passenger design preview: http://127.0.0.1:4320/

The API reports 0.13.0 and database connected. All services remain bound to 127.0.0.1. No remote phone/laptop connection, native Flutter app, external payment gateway or production deployment exists. The owner explicitly chose local web first and mobile later.

## Current features and authority

Sections 01-11 remain implemented: identity and protected Super Administrator; private companies, branches/stations, roles/members and audited support grants; shared cities and company routes; immutable seat layouts, buses/drivers; published trips and assignments; opt-in marketplace; atomic seat holds; guest passenger details; station offline payment recording, tickets/receipts/refunds; and passenger luggage registration, tags, custody and exceptions.

Section 12 connects these to the responsive Arabic/English driver workspace. Drivers use existing staff accounts and see only current trips assigned to an active driver record linked to their active same-company member. The new company.driver.operate permission is required. Company-wide supervisors use company.journeys.manage; Super Administrator retains platform access. Existing company-role copies receive no automatic new grants. New companies receive an Assigned driver template and updated administrator capabilities.

Manifests contain names, seats, ticket/boarding state and journey/incident records without contact numbers, payment references or luggage collection proof. Station ticket prints include stable opaque per-ticket QRs; copies keep the same QR. A check does not board someone. Committing boarding rechecks payment, refund, cancellation, trip and assignment state under locks and records a ticket only once. Use a keyboard scanner or paste a QR value; camera and offline boarding are absent.

Boarding opens 24 hours before scheduled departure and closes at actual departure or scheduled arrival. Departure waits until scheduled departure; arrival follows recorded departure. Actual events do not overwrite the schedule. After actual departure assignments cannot change; actual arrival blocks cancellation to reopen refunds. Financial refund cutoffs remain scheduled-time D32 rules, including cancellation refunds. Luggage rules remain D33. Notes are bounded/idempotent and cleared 90 days after scheduled arrival; passenger erasure is preserved. See [driver setup/use](workflows/DRIVER_BOARDING.md) and [business decisions](DECISIONS.md).

## Local data, startup and recovery

The private runtime has one existing account and zero companies. The existing login/password was preserved; no new default password was created or printed. Account/credential/settings/first-login records and all 45 legacy tables passed integrity comparisons. Keep runtime/ intact; do not reset it to fix access.

Use Node 24+, npm.cmd ci when dependencies are absent, then npm.cmd run local. The launcher applies append-only migrations with the private owner and runs the API as a restricted role. On a fresh database only, the generated first-login details are saved privately to runtime/first-login.txt. See [identity setup/recovery](database/IDENTITY_SETUP.md).

Managers must create company/trip data before drivers have assignments to display. Link a driver to a staff member and grant its explicit role before assigning the driver to a published trip. Real customer data was not seeded. The / preview is fictional and separate from durable bookings.

## Database, API and build

Migrations 0001-0012 are applied and checksum-verified with none pending. There are **53 application tables, 45 RLS tables, 32 permissions, 85 API paths / 98 operations and 29 public assets**. Migration 0012 adds ticket_credentials, boarding_records, journey_events and journey_incidents; runtime has fixed function grants and no direct access to the four new tables. It backfills opaque codes for existing tickets and preserves all earlier migration files. See [schema](DATABASE_SCHEMA.md) and [API contracts](api/CONTRACTS.md).

## Verification and checkpoints

All **109 automated checks passed**: 13 unit/server and 96 native PostgreSQL checks, including seven boarding tests. The native suite uses disposable databases/restricted roles. No failures or skips. Source and built driver workflows each passed 16 Arabic/English, dark/light, desktop/mobile layouts at 1920, 1366, 390 and 320 pixels. The existing built station regression passed 32 layouts and payment/refund/walk-in/original-copy-print workflows. No browser errors were observed; desktop and Arabic mobile screenshots were inspected. The API/frontend build and 21 mandatory-document checks passed.

The pre-upgrade private backup matched **1512 files** and passed a protected restore/start/stop check. The restore copy was safely removed after clean stop; the backup remains under runtime/backups/, separate from source archives. Existing Section 11 backups/checkpoints remain intact. Private backup retention still needs owner management because backups can retain erased details.

Source checkpoint: archives/Safeer-0.13.0-Section-12-2026-11-03.zip, with exact commit/files in ARCHIVE-MANIFEST.json, a .sha256 sidecar and archive verification receipt. Source archives exclude accounts, credentials, runtime/backups, node_modules and generated native files. See [Section 12 handover](archive/SECTION_12_BOARDING.md). The last Section 11 local-update checkpoint remains separate.

Changes are committed locally. Do not push the monorepo's unpublished portfolio history without resolving the owner's keep-local instruction; GitHub authentication was also unavailable at the prior handover. A GitHub push would neither deploy hosting nor install a mobile app.

## Remaining boundaries

Section 13 financial reports/reconciliation needs a new approval. The owner will revisit payment-policy questions in [Section 10](archive/SECTION_10_TICKETING.md). Freight/parcels remain excluded from release 1. Remote secure hosting, native Flutter clients, camera scanning, offline boarding, emergency assignment correction and receipt/legal/retention review remain future work. No production-readiness claim is made by this local checkpoint.
