# Changelog

## 0.3.0 - 2026-10-30 - SECTION 02 identity

- Owner explicitly approved Section 02. Add pinned NestJS 12.3.2/TypeScript 6.0.3 identity backend, strict compilation and PostgreSQL identity repositories; no unrelated project changes.
- Add migration 0002_identity: users/sessions, eight role templates, six implemented permissions, platform assignments, credential-free append-only audit and persistent authentication limits. Keep migration 0001 checksum unchanged.
- Add limited-runtime grants/startup rejection of elevated/owner/membership database connections, one-time generated bootstrap, privileged audited owner recovery and access-restricted persistent Windows local launcher.
- Add /staff sign-in/profile/password/sessions, user creation/edit/disable/reset/platform assignments, role creation/edit and recent audit UI. Include Arabic/English, mobile layouts, one-time secret handling and plain-text output escaping.
- Use bounded salted scrypt, opaque hashed sessions, idle/absolute expiry, password/session rotation, exact Origin/HMAC CSRF, reauthentication, optimistic versions, live permissions and transaction-locked last-owner protection.
- Preserve the public fictional passenger/luggage prototype; add a staff link and same-origin API proxy. No company/business API, remote HTTPS, MFA or native mobile authentication is added.
- Add native API/security/browser regressions, complete implemented OpenAPI contract, identity setup/recovery/test guide and mandatory continuation/section archive records.
- Findings fixed: old migration tests assumed one migration; role editors load asynchronously; account switching retained the previous tab; refreshed tabs/expired forms now clear stale state and secrets safely.
- Verification: 13 unit/security tests, 19 native migration/identity tests, source/built staff and passenger browser workflows, strict build, 11 required docs/24 Markdown files, offline lockfile reproduction, zero known runtime dependency advisories and two persistent local restarts passed. Exact commit and ZIP hashes are recorded in the checkpoint manifest.

## 0.2.1 - 2026-10-30 - owner-requested luggage declaration

- Added a luggage yes/no choice and conditional required description (1-300 trimmed characters) to the existing passenger prototype.
- Show the declaration/description beneath each passenger and on the printable unpaid reference, with Arabic/English labels and escaped plain-text output.
- Retain drafts during seat/trip/language changes; clear them on no, successful reservation and company switch.
- Added domain regression for invalid inputs/no seat allocation, length boundary, historical default and company scoping; expanded browser checks for form validation, draft/reset, no-luggage, escaping/print and Arabic/mobile layouts.
- Updated shared mobile notes, schema design/business rules and continuation documentation. Package and liveness contract version are 0.2.1.
- Verification: nine unit/integration tests, eight-asset build, source/built browser checks and documentation checks passed. No SQL change; prior seven native database tests remain historical Section 01 evidence.
- No station luggage record, tags, fees, tracking, native build or business API was added. Section 02 still requires explicit approval.

## 0.2.0 - 2026-10-30 - SECTION 01 foundation

### Added

- Complete master-plan source, decision ledger, project master, exact 15-section roadmap, current-state tracker, business rules, system/database architecture and archive template.
- Architecture/inspection/folder, database migration, API, module, security, workflow, testing and section-archive documentation categories.
- config/assets.mjs, src/i18n.js, src/tokens.css and the implemented health OpenAPI contract.
- database/migrate.mjs, database/migrations/0001_foundation.sql, scripts/build.mjs and documentation checker.
- PostgreSQL migration unit/native integration tests and self-contained Safeer browser helper/regression suite.
- Ignored verified pre-change source archive and final Section 01 checkpoint workflow.

### Modified

- AGENTS.md and README/BASICS now follow the new passenger-only release/section gate.
- Package/lock: 0.2.0, pinned pg client for migration tooling and explicit build/database/browser/doc commands.
- Local server: shared allowlist, built-asset mode and prototype liveness endpoint. No business write API added.
- Passenger UI/demo/rules: preserve existing examples, replace obsolete freight scope copy, extract translations/tokens, require cancellation confirmation and restart expiry after page restoration.
- Domain/server tests, mobile/UPDATES.md, ignored build configuration.

### Removed

- Active freight form/navigation, request handler/domain rule, cargo fixtures, freight-specific copy/styles and freight test. Original code remains recoverable in f06a638 and the verified 0.1.0 archive. No real data was removed.

### Verification and fixes

- Six original tests passed before editing.
- Native PostgreSQL 18.4: seven foundation integration tests passed; temporary databases/cluster cleaned/stopped.
- Added a regression check for runtime-derived Arabic city/status translations after extraction and restored localized route/reference values.
- Fixed the prototype timer's page-hide/page-show lifecycle; regression check added. The temporary Windows QA launcher initially waited on inherited pg_ctl pipes; fixed test process handling and explicitly stopped that QA cluster before rerun. This is not a production backend change.
- Final checks: 8 unit/integration tests passed; 7 native database tests passed; source and built browser suites passed; 8 assets built; 16 JavaScript files parsed; 10 required documents/local links checked across 21 Markdown files; dependency audit reported zero known advisories. Source archive integrity is verified at checkpoint creation.

### Remaining limitations

This is still a local fictional-data prototype plus verified migration/architecture tooling. Authentication, real company isolation, durable bookings, actual guest/mobile/multi-seat rules, money/ticket/luggage/boarding workflows, target framework applications and production deployment are not implemented. Section 02 requires explicit approval.

## 0.1.0 - 2026-10-28 - exploratory prototype

Added independent Safeer local passenger/freight demonstration, company-specific example hold policies, Arabic/English layout, unpaid reservation print view, cargo request example and six tests. No database/accounts/real payments. Its mixed freight scope is superseded by the 2026-10-30 master plan.
