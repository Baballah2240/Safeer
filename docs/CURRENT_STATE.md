# Current state - read this first

Updated: 2026-10-30. Project: Safeer / Sudan Transport, version 0.2.1.

## Current section and gate

**Section 01 complete: tested and documented, with a source checkpoint ZIP generated/verified at handover.** Section 02 is not authorized. Do not create authentication features or move to another section automatically.

Owner-requested follow-up D16: the local passenger form now collects a luggage yes/no declaration, with a required plain-text description when yes (1-300 trimmed characters). It appears beneath the passenger name in reservations and on the printable unpaid reference. This is not station luggage registration/tracking or approval for Section 02/11. The 0.2.1 checkpoint is separate from the preserved original Section 01 archive.

## Completed source work

- Inspected the complete 0.1.0 source and passed its six baseline tests.
- Recorded the new master plan and superseding decisions before scope changes.
- Verified an archive of the old 16-file prototype, then removed active freight/parcels code, fixtures, navigation and tests.
- Preserved the fictional passenger example: trip/seat selection, unpaid reference/print view, timestamp expiry, cancellation and company demo scoping.
- Extracted translations/design tokens, added cancellation confirmation and fixed expiry timer restoration after page hide/show.
- Added bilingual luggage declaration/description, domain validation and escaped list/reference output. Drafts survive seat/trip/language re-renders, clear on no, and reset after successful reservation/company change.
- Added a single asset allowlist, a static build and versioned prototype liveness contract.
- Added a pinned PostgreSQL client, transactional/checksummed migration runner and namespace-only baseline.
- Documented the complete target architecture, entities/constraints/indexes, module boundaries, roles, workflows, exact roadmap and continuation/archive conventions.

## What works versus what does not exist

`npm start` serves the local prototype on 127.0.0.1:4320; it resets on refresh and is not shared between tabs/devices. The company selector only switches fictional fixtures. Guest full-name/mobile validation and atomic multiple-seat bookings remain future requirements; the retained demo is name-only/single-seat.

No real accounts/sessions, company security/RLS, Next.js/NestJS apps, Flutter clients, durable business tables, station payments, official tickets/receipts, luggage/boarding or production hosting exist. The target stack is selected and staged; it is not claimed installed or deployed. No critical production workflow is being represented by a fake success screen.

## Database status

- Executable migration: 0001_foundation.sql. Runner owns safeer_meta.schema_migrations; migration creates private safeer namespace only.
- Native PostgreSQL 18.4 integration run: **7 passed**, no skips. Fresh per-test databases were dropped and the disposable cluster stopped.
- No persistent application/production database has been provisioned or migrated. The browser server reports database not-connected.
- No business tables or tenant/RLS policies are implemented. See DATABASE_SCHEMA.md for their planned owning sections.

## Latest verification status

- Before edits: 6 baseline tests passed.
- Dependency reproduction: npm ci --offline completed successfully from the lockfile.
- Current unit/integration checks: **9 passed**, including luggage validation, migration filename/URL safeguards and liveness/contract/private-file boundaries. Original Section 01 checkpoint had eight tests.
- Native database integration: 7 passed at the original Section 01 checkpoint, including migration CLI, rollback, drift, concurrency and constraints. Not rerun for the 0.2.1 UI/in-memory change; database code and migrations are unchanged.
- Static build: 8 public assets built successfully.
- Browser regression: **passed on source and built assets**, covering luggage visibility/required description, draft retention/reset, no-luggage booking, escaped passenger list/unpaid reference/print, cancellation confirmation, expiry after page restoration, company fixture scoping, Arabic print and 1920x1080/1366x768/390x844 layouts. Current screenshots: ignored `.qa/luggage-addendum/`; original screenshots preserved in `.qa/section-01/`.
- Documentation: **10 mandatory continuation/archive documents checked**, local links valid in **21 Markdown files**.
- Syntax: **16 JavaScript files parsed**. Static build: **8 assets** and SHA-256 manifest.
- Dependency audit: **zero known advisories reported** for the pinned client dependency tree on 2026-10-30.
- Patch hygiene and source ZIP CRC/per-file SHA-256 verification are part of the final checkpoint handover; receipts remain under ignored archives/ and .qa/.

## Known limitations and issues

No unresolved critical/high defect is known in the completed Section 01 foundation. The in-memory demo cannot provide real tenant security, shared availability or paid documents and must not accept actual passenger data. Production cancellation/refund/late-payment policy, luggage allowance/collection checks, data retention and offline behavior require decisions in their owning sections. Framework/client setup is intentionally staged rather than installed unused. GitHub delivery is verified separately from local source/build/archive checks; a push does not deploy or install anything.

## Exact next task

**Stop and wait for explicit owner approval for Section 02: Authentication, users, roles and permissions.** Once approved, scaffold the selected NestJS/TypeScript identity backend, connect the reviewed migration history, add identity migrations, revocable sessions, role/permission primitives and authorization tests. Company resources/tenant policies follow in Section 03; do not implement later booking modules early. Read the master plan, this file and Section 01 archive before continuing.
