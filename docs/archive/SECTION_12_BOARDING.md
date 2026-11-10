# Section 12 — local driver workspace and boarding

D66 continuation: [Driver Trip Dashboard and camera release](DRIVER_TRIP_DASHBOARD_0.18.0_2026-11-10.md) supersedes the historical keyboard-only/local-client limits. Assigned-trip authority, explicit manual check/confirm and idempotent boarding remain.

Authorized by D35-D36. Local responsive client now; Flutter deferred by the owner. Assigned drivers may verify tickets, board passengers, record departure/arrival and report incidents only for currently assigned trips. Company-wide journey supervisors and Super Administrator use explicit authority.

Source version: 0.13.0. Append-only migration: `0012_boarding.sql`. Four new private tables: ticket_credentials, boarding_records, journey_events, journey_incidents. Restricted runtime uses fixed SQL functions and has no direct table access. Stable opaque per-ticket QR codes are added to station ticket prints, including existing tickets through migration backfill. The manifest omits phone numbers, payment references and collection proof.

Six driver API paths/operations extend totals to 85 paths and 98 operations. New permission catalog totals 32. New-company templates include Assigned driver and updated company administrator permissions; existing company copies are unchanged. The separate driver route and two assets bring the public asset count to 29.

See [driver workflow](../workflows/DRIVER_BOARDING.md), [decisions](../DECISIONS.md) and [current state](../CURRENT_STATE.md). Scheduled financial and luggage rules remain unchanged. Boarding opens 24 hours before departure; actual departure or scheduled arrival closes it. Actual journey events never rewrite scheduled dates. New notes follow the 90-day retention policy.

## Verification and local upgrade

Completed 2026-11-03. All 109 automated checks passed: 13 unit/server plus 96 native PostgreSQL across foundation, identity, companies, routes, fleet, trips, marketplace, reservations, passengers, station ticketing, luggage and boarding. No failures or skips. Driver source/built browser workflows passed 16 layouts each (Arabic/English, dark/light, widths 1920/1366/390/320), and the existing built station workflow passed 32 layouts including original/copy ticket printing. Screenshots were visually inspected. Build and 21 mandatory document/link checks passed.

The private pre-upgrade backup matched 1512 files and an isolated protected restore started with the existing account, then stopped and was safely removed. The backup remains separate under runtime/backups/. Local health reports 0.13.0/connected; migrations 0001-0012 are applied with no pending entries. Account/credential/settings/first-login fingerprints and 45 legacy tables are unchanged. The current catalog contains 53 application tables and 45 RLS tables. The driver page and asset return HTTP 200.

Source checkpoint: archives/Safeer-0.13.0-Section-12-2026-11-03.zip. Its generated manifest records the exact committed source; the .sha256 sidecar and verification receipt record ZIP/per-file integrity. Runtime, accounts, credentials, private backups and native caches are excluded. Source-control push is separate from local operation or deployment. The monorepo contains an unpublished portfolio commit that the owner asked to keep local; do not push that history incidentally.

## Next gate

Stop before Section 13 financial reports and company reconciliation. The owner will revisit financial policies separately. Remote hosting, phone access and Flutter remain future work.
