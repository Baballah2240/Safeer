# SECTION 01 - project inspection, architecture and foundation

Date: 2026-10-30. Authorization: owner's new master plan, Section 01 only. Status: complete; final source ZIP/checksum generated and verified at handover. Section 02 not started.

## Objectives and implemented features

Inspect the whole starter; preserve reliable passenger examples; document the approved passenger-only multi-company marketplace; establish tested migration/build infrastructure and full continuation records without implementing authentication or later business modules.

Inspected all 16 baseline files, instructions/dependencies and ignored QA coupling. Archived the f06a638 prototype before removing freight. Retained seat/reference/policy/cancellation examples and bilingual responsive UI; extracted locale/tokens, fixed timer restoration and added cancellation confirmation. Added a single public-asset list, build manifest, versioned liveness contract and PostgreSQL migration foundation.

## Database changes

0001_foundation.sql creates private safeer namespace. Runner creates private safeer_meta.schema_migrations with version/name/checksum/applied timestamp, validates history, serializes runners and wraps all pending DDL/ledger changes in one transaction. Seven native PostgreSQL 18.4 tests passed on disposable databases; no persistent operational DB migrated. No business or RLS tables/policies exist yet.

## Files and APIs

See CHANGELOG.md for added/modified/removed groups and architecture/FOLDER_STRUCTURE.md for the actual tree. New files include the mandatory docs/categories, config/assets.mjs, src/contracts/openapi.json, src/i18n.js, src/tokens.css, database CLI/migration, build/docs scripts and migration/browser tests.

Implemented API: GET /api/v1/health, returning prototype liveness and explicit database not-connected. No authentication, booking, payment, luggage or tenant-management endpoint exists.

## Permissions and business rules

No application permissions are implemented. Existing loopback/CSP/private-file restrictions are retained; database namespaces/ledger revoke PUBLIC privileges. Company/RLS/role/support-grant design is documented for 02-03. Passenger-only scope, guest option, multi-seat/group requirements, station-payment-before-ticket, company hold deadlines and passenger-luggage linkage are recorded as approved rules; only the legacy single-seat unpaid example is executable.

## Tests, findings and limitations

Baseline: six tests passed. Final current unit/integration tests: eight passed. Native database: seven passed, including apply/re-run, drift, rollback, concurrent runner lock, constraints, namespace access and CLI. Eight public assets built; 16 JavaScript files parsed. Source and built browser suites passed passenger-only navigation, escaped/printed reference, confirmation, expiry/page restore, company fixture scoping, Arabic reference and 1920/1366/390-width layouts. Ten mandatory documents and links across 21 Markdown files passed checks. Dependency audit reported zero known advisories. Final ZIP CRC, per-file hashes and exact commit are verified/recorded by checkpoint generation, outside the recursive source manifest.

Findings/fixes: obsolete active freight scope, combined translation/UI code, asset-list duplication risk, stopped timer after page restoration, missing demo cancellation confirmation and QA helper coupling to the school app. Runtime Arabic city translations were restored and covered by unit/browser checks after extraction. Inherited Windows pg_ctl pipes delayed the first temporary launcher; stopped that exact cluster, corrected QA handling and reran successfully. Obsolete one-off QA scripts/screenshots and stopped disposable test clusters are cleaned without touching application data.

The demo is not a backend, real tenant isolation, real guest/multi-seat inventory, finance/ticket system or mobile app. No production security/compliance/deployment claim is made. Target frameworks are selected but intentionally not installed unused.

## Dependencies and continuation

Node 24, pinned pg client, optional local PostgreSQL 18 for migrations and Chrome for browser checks. Temporary native test binaries and random QA credentials remain ignored; no fixed app passwords or service accounts created.

Read CURRENT_STATE.md, reproduce npm ci/test/build and the documented PostgreSQL/browser checks. Source ZIPs/checksums are in ignored archives/; numbered documentation remains in Git. The verified old freight prototype is preserved separately. The final section archive records the exact checkpoint commit and payload hashes in its manifest.

**Next section: 02 - Authentication, users, roles and permissions, only after explicit owner approval. Stop here after this section passes, is documented and archived.**
