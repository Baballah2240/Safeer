# Section 13 — financial reports and company reconciliation

Authorized 2026-11-03 by the owner's next instruction and D37. Version 0.14.0. Source, verification, private backup/restore and local runtime upgrade are complete.

## Scope and implementation

Read-only company/branch/station reports over existing permanent payments, refunds, receipts, tickets and cash sessions. Date-filtered collections, separate currencies/methods, daily/employee/station/trip breakdowns, paginated transaction and cash-session history, CSV export and report-only printing. Existing session closing and all D32 financial policies remain unchanged; there is no new approval, balance adjustment, settlement or profit accounting.

Migration 0013_finance.sql adds one permission and fixed financial projection/audit helpers, plus company/posting-time indexes on payments/refunds and a session-opening index. It adds no tables and rewrites no previous migration. Totals remain 53 application tables and 45 RLS tables; there are now 33 permissions, 88 API paths / 101 operations and 32 public assets. Runtime receives only the public projection/options/audit functions, never raw financial table/helper access. Existing company role copies receive no automatic grant.

Primary files: apps/api/src/finance.service.ts, database/migrations/0013_finance.sql, src/finance.js, src/finance-format.mjs, src/finance.css, updated company navigation/capabilities and contracts, finance unit/integration/browser tests and the [workflow](../workflows/FINANCIAL_REPORTS.md). Website/mobile-facing code remains in src/; mobile/UPDATES.md records that no native build is included.

## Verification and review findings

All 118 automated checks passed without failures or skips: 15 unit/server and 103 native PostgreSQL checks across the existing modules and seven finance integration tests. The full native suite included scoped access/revocation, denied financial support grants, denied money mutations/session closing for finance readers, multi-seat totals, cash/noncash/currency separation, company-local posting boundaries, negative refund-day collections, snapshot precision, audit/privacy, pagination and rejection of oversized exports.

Source and built Finance browser workflows each passed 16 Arabic/English, dark/light, 1920/1366/390/320 layouts, including filters, CSV, report-only printing and stale-data clearing on bad filters. Screenshots were visually inspected. One built-run sign-in wait timed out while the parallel native suite was active; it passed when rerun after that suite completed. No product browser errors were recorded. No physical printer was used. The API/frontend build and 22 mandatory-document/link checks passed.

Fixed findings: UTC-only snapshot validation rejected the database's offset; timestamp normalization could lose microseconds; permission checks repeated per movement; and stale bulk-history statistics selected a quadratic nested-loop join. Authorized stations are now materialized, cash totals computed for only the displayed session page, posting/opening indexes added and migration/import statistics initialized. A separate isolated 20,002-movement diagnostic completed in 426 ms after the fix; this is not a production performance guarantee. Keep PostgreSQL autovacuum/statistics maintenance enabled and analyze bulk-imported/restored data.

The private pre-upgrade backup matched 1532 files, and a protected restore copy started with the existing account, then stopped and was safely removed. Backup remains under runtime/backups/. The actual local app reports 0.14.0/connected with migrations 0001-0013 applied and none pending. Account/credential/settings/first-login and all 49 legacy-table fingerprints are unchanged; global role labels are preserved. The catalog contains 53 application tables, 45 RLS tables and 33 permissions.

Source checkpoint: archives/Safeer-0.14.0-Section-13-2026-11-03.zip. The generated manifest records the exact commit/files, and .sha256/verification receipts record integrity. Runtime/accounts/credentials/private backups/node_modules are excluded. Commit remains local because the shared branch contains unpublished portfolio history the owner requested to keep local. No hosting deployment or native update is implied.

## Next gate

Stop before Section 14 platform administration/notifications/global analytics. Money-policy questions and receipt/legal/retention review remain separate owner work. No production hosting or mobile installation is claimed.
