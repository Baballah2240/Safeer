# Current state — read this first

Updated: 2026-11-03. Safeer / Sudan Transport **0.14.0**. Sections 01-13 and the private local upgrade are complete. Latest authorization: D37. Stop before Section 14 until the owner approves it.

## Running application

- Staff/company management and Finance: http://127.0.0.1:4320/staff
- Assigned-driver workspace: http://127.0.0.1:4320/driver
- Real local marketplace: http://127.0.0.1:4320/marketplace
- Separate fictional passenger design preview: http://127.0.0.1:4320/

Health reports 0.14.0/database connected. Services remain on 127.0.0.1. No remote phone/laptop access, Flutter app, external payment gateway or hosting deployment exists. The owner chose local web now, mobile later.

## Section 13 Finance

Companies → company → Finance adds date/station/employee/method filters; per-currency gross payments, refunds, net collections and ticket counts; daily/employee/station/trip breakdowns; paginated transaction history and cash reconciliation; CSV export and current-page printing. It reads permanent station payments/refunds/receipts/tickets/cash sessions, adds no new money tables, and changes no financial policy. Net collections are not profit because operating costs are absent.

The new company.finance.read capability follows the originating cash session's permitted company/branch/station. Super Administrator retains access. Drivers and support grants gain none; Finance read access cannot refund or close sessions. New company/branch/station manager templates include it, while existing company-role copies require an explicit grant. UI access also needs the existing company.profile.read capability. The runtime has one existing account and zero companies; create/select the company's records before its Finance menu/report is available. No sample company or real customer data was seeded.

Posting dates use the company's timezone and an inclusive range of at most 31 days. Currencies remain separate with integer minor-unit amounts, and refunds use their own posting dates. Cash-session rows overlap the chosen dates but display each session's full lifetime up to the snapshot, unaffected by payment-method filters. Closing/counting remains under Station with its existing permissions. D32-D33's refund, currency, forgotten-session and custody policies are unchanged; the owner will revisit the financial questions in [Section 10](archive/SECTION_10_TICKETING.md).

Report snapshots preserve microseconds and timezone offsets across pages/exports. Each request rechecks current authority. There are 75 transaction and 50 session rows/page with complete totals/counts. CSV exports all matching movements up to 10,000 and refuses larger results. Printing rechecks access and labels current pages; it does not claim the entire ledger was printed. Report/export content omits passenger names/contacts, transaction references, free-text reasons and QR values. Reads/exports are audited within authorized scope. See [financial workflow](workflows/FINANCIAL_REPORTS.md).

## Earlier modules retained

Protected identity/Super Administrator; company approval, branches/stations, tenant roles/members and scoped audited support; cities/routes; immutable seat maps, buses/drivers; trip publication/assignments; opt-in marketplace; atomic guest seat holds/passenger details; station offline payments, tickets, receipts/refunds; passenger luggage tracking/custody/exceptions; and assigned-driver QR verification, boarding, journey events and incidents remain implemented.

The driver workspace uses existing staff identity and active same-company driver/member links. Drivers act only on current assignments with company.driver.operate; company.journeys.manage grants company-wide supervision. Stable ticket QRs appear on station prints/copies. Checking does not board someone; committing rechecks validity under locks. Existing scheduled-time financial/luggage rules and 90-day passenger/incident erasure remain intact. See [driver workflow](workflows/DRIVER_BOARDING.md).

## Data, startup and recovery

The existing account/password, private settings/first-login file, global role labels and 49 legacy tables passed pre/post-upgrade integrity comparisons. No account was reset or new default password printed. Keep runtime/ intact.

Use Node 24+, npm.cmd ci when dependencies are absent, then npm.cmd run local. The launcher applies append-only migrations with the private owner and starts the API as a restricted role. Only a fresh database generates a private runtime/first-login.txt. See [identity setup/recovery](database/IDENTITY_SETUP.md). Old source checkpoints and private backups remain separate and intact.

## Schema, contracts and build

Migrations 0001-0013 are checksum-verified/applied with none pending. Current totals: **53 application tables, 45 RLS tables, 33 permissions, 88 API paths / 101 operations, 32 public assets**. Migration 0013 adds scoped projection/options/audit functions and date/opening indexes; it does not rewrite earlier migrations or grant runtime access to financial tables. Monetary JSON fields are integer minor-unit strings. Read [schema](DATABASE_SCHEMA.md), [API contracts](api/CONTRACTS.md) and [decisions](DECISIONS.md).

## Verification and backup

All **118 automated checks passed**: 15 unit/server and 103 native PostgreSQL checks, including seven finance integration checks and a 20,002-movement fixture. Tests use isolated databases/restricted roles, not the persistent runtime. No failures or skips in the final full run. Finance source and built browser workflows each passed 16 Arabic/English, dark/light layouts at 1920, 1366, 390 and 320 pixels, with CSV/print/filter checks and no recorded product browser errors. One built sign-in wait timed out during parallel load; the separate rerun passed. Screenshots were inspected. The build and 22 mandatory-document/link checks passed.

Volume testing found a slow join with stale bulk-history statistics. Authorized stations are now materialized and indexes/statistics initialized; cash totals are computed for the displayed session page. The isolated 20,002-movement report measured 426 ms after the fix, and the full integration suite passed under the unchanged eight-second query timeout. Keep autovacuum/statistics maintenance enabled and analyze after bulk import/restore.

The pre-upgrade private backup matched **1532 files** and passed a protected restore/start/stop check with the existing account. Its temporary restore was safely removed after clean stop; the original backup remains under runtime/backups/. Private backups can retain erased details, so their retention still needs owner management.

Source archive: archives/Safeer-0.14.0-Section-13-2026-11-03.zip, with exact commit/file hashes in ARCHIVE-MANIFEST.json, a .sha256 sidecar and verification receipt. Accounts, credentials, runtime/backups, node_modules and native caches are excluded. See [Section 13 handover](archive/SECTION_13_FINANCE.md). Git changes remain local because the shared branch contains unpublished portfolio history the owner requested to keep local; a push would not deploy hosting or install an app.

## Remaining boundaries

Section 14 platform administration/notifications/global analytics needs the next approval. Financial policy decisions, receipt wording and legal/retention review remain open in the Section 10 handover. Freight/parcels remain excluded from release 1. Flutter, secure remote hosting, camera/offline scanning, emergency assignment correction and production security preparation remain future work. No production-readiness claim is made.
