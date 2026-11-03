# Current state - read this first

Updated: 2026-11-03. Safeer / Sudan Transport **0.15.0**. Sections 01-14 and the private local upgrade are complete. Latest authorization: D38. Stop before Section 15 until the owner approves it.

## Running application

- Staff, Platform overview and Notifications: http://127.0.0.1:4320/staff
- Assigned-driver workspace: http://127.0.0.1:4320/driver
- Real local marketplace: http://127.0.0.1:4320/marketplace
- Separate fictional passenger design preview: http://127.0.0.1:4320/

Health reports 0.15.0/database connected. Existing account and password are preserved. Services remain on 127.0.0.1; no hosting, remote phone/laptop access, Flutter/native build or external gateway exists. The local runtime has one existing account and zero companies. No demonstration company, passengers or notification events were seeded.

## Section 14

Super Administrator → **Platform overview** adds current company/approval/listing/account counts, date-range bookings and scheduled published departures, per-currency gross payments/refunds/net collections and paginated company cards. **Manage company** opens existing protected company approval/listing controls. Existing user/role/audit screens remain authoritative. Global reports use inclusive UTC posting dates, at most 31 days; company Finance still uses each company's timezone. Net collections are not profit. All retained company statuses are included. Each company-page request is a fresh snapshot, not a frozen export. Tenant/support users cannot access global analytics/settings.

**Edit notice** configures a plain-text English/Arabic public service notice, disabled by default, at most 500 characters per language. Both translations are required when enabled; current password/version/CSRF/audit protect changes. Public pages escape its text and require loading/refreshing to receive updates. It does not stop reservations. An unavailable notice endpoint does not block booking retrieval.

**Notifications** provides current-authority events from the last 90 days, 50/page, total unread count and idempotent per-user read markers. Drivers can open it from their header with the existing session. Company registration/status/listing events are Super-only. Trip cancellations follow company-wide trip access/current driver assignment; incidents require company-wide journey management; cash differences follow station finance scope; luggage problems require company-wide resolution access. Recheck current role/membership/company/assignment on every list and marker write. Newly authorized staff can see earlier relevant events in the window. No historical backfill. Read acknowledges an event and does not resolve its source issue.

Notification metadata contains codes/resource IDs/timestamps, not passenger contacts, free-text notes, amounts, payment references or QR secrets. Source-operation triggers commit events atomically and deduplicate retries. This is in-app refresh delivery; no SMS, email, push, Redis or WebSocket service. Events older than 90 days are hidden; physical metadata/receipt cleanup and private-backup retention remain maintenance work. See [platform workflow](workflows/PLATFORM_ADMINISTRATION.md).

## Existing modules retained

Protected identity/Super Administrator; company approval, branches/stations, tenant roles/members and scoped audited support; cities/routes; immutable bus seat-map revisions, fleet/drivers; trip publication/assignments; opt-in marketplace; atomic guest holds/passenger details; station offline payment/tickets/receipts/refunds; luggage custody/exceptions; assigned-driver ticket QR checks/boarding/journey events/incidents; scoped Finance reporting/CSV/current-page printing remain intact. No new money policy, financial approval or role-template grant was introduced. See [Finance](workflows/FINANCIAL_REPORTS.md), [driver workflow](workflows/DRIVER_BOARDING.md) and open financial/legal questions in [Section 10](archive/SECTION_10_TICKETING.md).

## Schema and contracts

Migrations 0001-0014 are checksum-verified/applied with none pending. Current totals: **56 application tables, 48 RLS tables, 33 permissions, 93 API paths / 107 operations, 33 public assets**. Migration 0014 adds private RLS notice/event/receipt tables, six source trigger bindings/seven event codes, fixed restricted functions and two global posting indexes. Runtime has no raw access to new tables or internal visibility/capture helpers. Six necessary entry functions are granted. Existing role copies, money rows and prior migrations are unchanged. Monetary amounts and event cursors are exact decimal strings. Read [schema](DATABASE_SCHEMA.md), [API contracts](api/CONTRACTS.md) and [decisions](DECISIONS.md).

## Verification

All **128 automated checks passed**: 15 unit/server and 113 native PostgreSQL (including nine platform checks and the migration-13-to-14 preservation check). Full native suite: 113/113, no failures or skips, approximately 212 seconds. Final platform edge-case rerun: 9/9. Fixtures use isolated PostgreSQL 18.4 databases and restricted roles; the 20,002-movement finance regression also passes.

Platform source and built Chrome workflows each passed **32 layouts** (platform + inbox × Arabic/English × dark/light × 1920/1366/390/320). Built driver regression passed another **16 layouts** and QR/boarding/incident/journey/revocation/logout workflow. Browser checks cover real data, password-confirmed notice editing, safe public rendering, read receipts, company navigation, failed-filter stale-data clearing and restricted views. No recorded product browser errors. Screenshots were inspected. Build, 23 mandatory-document checks and links in 49 Markdown files passed. All 33 running public assets match their build hashes; public notice is initially disabled and anonymous global settings/inbox requests are rejected.

Initial new tests exposed fixture assumptions and a stale foundation-table allowlist; production guards were retained. Visual review corrected generic form CSS overriding desktop filter layout and the global snapshot formatting in the wrong timezone. An initially unlisted profile now emits no marketplace-listing alert; content-only edits do not create listing alerts. Independent receipts for newly authorized accounts are verified.

## Backup, recovery and checkpoint

The private pre-upgrade backup matched **1535 files** and passed protected restore/start/clean-stop verification with one existing account/zero companies. Temporary restore cleanup succeeded; the backup remains under runtime/backups/Safeer-before-Section-14-2026-11-03-d5b2a301-991f-4b7d-8b01-922f4aebe41f/. The existing account/credentials, settings/first-login file, global role labels and **49 legacy tables** passed pre/post-upgrade fingerprints unchanged. Preserve runtime/; private backups need owner-managed retention.

Source checkpoint: archives/Safeer-0.15.0-Section-14-2026-11-03.zip with SHA-256 sidecar, exact committed source/file hashes and verification receipt. The ZIP excludes accounts, credentials, runtime/backups, dependencies, native caches and temporary browser profiles. It is not a business-data backup. Read [Section 14 handover](archive/SECTION_14_PLATFORM.md). Changes are committed locally; the shared branch includes unpublished portfolio history the owner requested to keep local, so pushing it would publish unrelated work. No hosting deployment or phone update occurred.

Install Node 24+, run npm.cmd ci if dependencies are absent, then npm.cmd run local. Only a fresh database generates runtime/first-login.txt; existing installations keep their current credentials. See [identity setup/recovery](database/IDENTITY_SETUP.md). Older checkpoints/private backups remain intact.

## Next section

Section 15: security audit, integration/concurrency/recovery testing, optimization and production preparation, after the next owner approval. Freight/parcels, native apps, secure remote hosting, external notifications, offline/camera scanning, emergency assignment correction and financial/legal/retention decisions remain future work. No production-readiness claim is made.
