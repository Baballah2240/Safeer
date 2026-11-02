# Changelog

## 0.10.0 - 2026-11-02 - SECTION 09

Add passenger names and mobile numbers with each hold, retrieval by reference and mobile, staff booking search, correction and history, and automatic erasure 90 days after the trip. Add migration 0009 and 4 paths. 87 automated checks and source/built browser suites passed. The private local database upgrade is an open owner step.

## 0.9.0 - 2026-11-02 - SECTION 08

Add temporary seat holds: live seat maps, all-or-none holds of 1-10 seats with references and countdowns, automatic expiry, passenger and staff release, and availability in search. Add migration 0008 and 6 routes. 81 automated checks and source/built browser suites passed. The private local database upgrade is an open owner step.

## 0.8.1 - 2026-11-02 - Marketplace layout (D29)

Rebuild the marketplace and company page layouts with a title band, ticket-style trip cards and a company sidebar. Fix unstyled links and the booking badge. No data, API or permission changes.

## 0.8.0 - 2026-11-02 - SECTION 07

Add the public marketplace with search and sorting, company pages and a company-managed public profile. Add migration 0007, anonymous read-only projections and 4 public routes. 73 automated checks and source/built browser suites passed. The private local database upgrade is an open owner step.

## 0.7.0 - 2026-11-02 - SECTION 06

Add draft trips from routes, repeated scheduling, stop times, fares, bus and driver assignment with history, publication and cancellation. Add migration 0006, trip service and controller, 3 RLS tables, database-filled snapshots, overlap protection and 2 template permissions. 68 automated checks and source/built browser suites passed. The private local database upgrade is an open owner step.

## 0.6.0 - 2026-11-02 - SECTION 05

Add company-private seat layouts with immutable revisions, a visual seat-map editor, buses and driver records. Add migration 0005, fleet service and controller, 5 RLS tables, sealed revisions, capacity guards, 4 template permissions and database/backup-local.mjs. 60 automated checks and source/built browser suites passed. The private local database upgrade is an open owner step.

## 0.5.0 - 2026-11-02 - SECTION 04

Add bilingual cities, company routes/destinations and ordered stops; station-city assignment; route details, reorder controls and inline validation. Add migration 0004, route service/controllers, 3 RLS tables, composite city/station FKs, deferred route checks, protected active resources, new-company template grants and audit. Preserve existing tenant copies and station identities. Preserve disabled reorder controls after failed form validation. Updated contracts, permissions, startup checks, versions, tests and continuation/workflow/archive documentation. Final verification and local upgrade receipts are recorded in CURRENT_STATE. No files removed; stop before Section 05.


## 0.4.0 - 2026-10-31 - SECTION 03

Added real local company approval/settings, branches/stations, tenant role copies, multi-scope staff memberships, temporary staff onboarding, expiring read-only support grants and company audit. Integrated Companies screens with bilingual dark/light staff navigation. Added same-company FKs, eleven-table RLS, raw-session-derived policies, grant ceilings, immutable ownership, startup RLS checks, local capacity guards and atomic last-company-admin protection. Preserves identity rows and existing passwords/sessions during upgrade. Passenger bookings/payments remain fictional or deferred; stop before Section 04.


## 0.3.1 - Super Administrator role editing

Owner-authorized D20 follow-up: Super Administrators can edit names, permissions and status of all eight built-in role templates and custom platform roles. Reserved owner codes/scopes remain immutable, owner authority always includes the permission catalog, and disabling the last active owner is rejected atomically. Other administrators remain restricted. Company/resource assignment remains deferred to Section 03; no schema migration or company access is added. The role editor supports Arabic/English and mobile layouts.

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


## 0.3.2 - Connected workspace layout

Simplified the responsive staff shell and account overview; added permission-aware shortcuts, user-role links, current-page search, role scope filters and result counts. Unified passenger styling, replaced outdated no-sign-in copy and freight-related journey text, and preserved language across staff/passenger links. No backend authorization or schema change.


## 0.3.3 - Skeuomorphic styling (2026-10-31)

Applied restrained skeuomorphism using shared CSS materials, tactile enamel buttons, recessed fields, warm paper panels, brass navigation accents, padded seat controls and ticket/reference styling. Preserved focus indicators, selected/disabled states and print output. No new dependencies, schema or authorization changes.


## 0.3.4 - Dark mode (2026-10-31)

Added shared default dark theme, bilingual light/dark controls, validated persistent preferences, cross-window synchronization and storage-blocked fallback. Toggling preserves form drafts/focus. Styled seats, statuses, tables and dialogs; retained clean white-paper printing. No dependencies or database changes.
