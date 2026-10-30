# Safeer / Sudan Transport

Section 01 foundation for a multi-company Sudan passenger-transport marketplace. Updated 2026-10-30, version 0.2.1. The product name remains Safeer. This independent project does not change Stocrant or Qatar School Time Table.

**Continuation starts at [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md). Section 02 requires explicit owner approval.**

## Approved release scope

One central marketplace, individual public company pages and private company operations. Passenger transport, station payments, official tickets/receipts, passenger luggage and boarding are in scope. Freight/parcels/cargo delivery are deferred; the superseded prototype is safely archived.

Guest booking must be available without a passenger account. The real booking module will collect full names/mobile details and support multiple passengers/seats. Station staff confirm offline payment before official tickets and receipts. No online payment gateway is required.

## What currently works

A fictional-data, single-seat passenger prototype: sample trips, seat selection, unpaid reference/print view, company example policies, timestamp-based expiry/cancellation and Arabic/English responsive layouts. Its company selector is a demo switch, not access control. All browser data resets on refresh and is not shared between devices.

The passenger form also asks whether the passenger has luggage. Select Has luggage and describe the bags/colour/identifying details (1-300 trimmed characters); the saved declaration appears with the passenger and on the printable unpaid reference. Select No luggage to clear the description. This is a declaration only; station luggage registration/tracking remains future work.

Section 01 also supplies PostgreSQL migration tooling, a private namespace/ledger baseline, a static asset build, a prototype liveness endpoint and the full architecture/schema/roadmap/archive documentation. The web server does not connect to a database. Target Next.js/NestJS/Flutter applications, real accounts, secure company isolation, durable booking, payments, tickets, luggage and boarding are not implemented yet.

## Run locally

Requires Node.js 24. From this folder:

```powershell
npm.cmd ci
npm.cmd start
```

Open http://127.0.0.1:4320. Stop with Ctrl+C. SAFEER_PORT may select another local port. Use invented data only; displayed companies/fares/availability are not real services.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run check:docs
npm.cmd run test:browser
npm.cmd run start:built
```

Chrome is required for browser checks; CHROME_EXE can specify it. Stop the source server before using start:built on the same port. This build produces local prototype assets, not a production marketplace or mobile binary.

## Database foundation

PostgreSQL 18 is selected. The pinned pg client is used by developer migration tools; no unused ORM/framework is installed. See [migration operations](docs/database/MIGRATIONS.md) for local SAFEER_DATABASE_URL configuration and the separate disposable SAFEER_TEST_DATABASE_URL required by npm run test:db. Never use real company, school or restaurant databases for tests.

Only 0001_foundation.sql exists: private application namespace plus the runner's checksum ledger. Business entities/indexes/tenant policies are designed in [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md), not created prematurely. Native PostgreSQL verification results are recorded in CURRENT_STATE; no permanent application database has been provisioned.

## Project map and records

- [PROJECT_MASTER.md](docs/PROJECT_MASTER.md): vision and implemented-versus-target architecture.
- [DEVELOPMENT_ROADMAP.md](docs/DEVELOPMENT_ROADMAP.md): exact 15-section order and dependencies.
- [SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md), [folder structure](docs/architecture/FOLDER_STRUCTURE.md) and [inspection](docs/architecture/INSPECTION.md).
- [BUSINESS_RULES.md](docs/BUSINESS_RULES.md), [access control](docs/security/ACCESS_CONTROL.md) and [API contracts](docs/api/CONTRACTS.md).
- [DECISIONS.md](docs/DECISIONS.md), [CHANGELOG.md](docs/CHANGELOG.md) and [section archive](docs/archive/SECTION_01_FOUNDATION.md).

src/ holds the retained prototype, shared translations/tokens and versioned contract source. database/ holds the one migration history; config/ and scripts/ provide build/tooling boundaries. mobile/UPDATES.md records native-client status. No native app, database backup, credential, .env or downloaded dependency is included in source control.

Verified source ZIPs and checksums live in ignored archives/. See [archive guidance](docs/archive/README.md). Keep business data backups separate from source checkpoints.

## العربية

الخطة المعتمدة الآن هي منصة لنقل الركاب في السودان: سوق مركزي، وصفحات للشركات، وأنظمة إدارة مستقلة للشركات. الإصدار الأول يشمل الركاب وأمتعتهم، ولا يشمل شحن الطرود أو البضائع. الحجز كزائر متاح في التصميم المعتمد، وتصدر التذكرة الرسمية والإيصال بعد تأكيد الدفع بالمحطة.

هذا القسم هو الأساس المعماري والتوثيق وأدوات ترحيل قاعدة البيانات فقط. النموذج الحالي محلي وتجريبي، وليس نظام حجوزات أو دفع فعلياً. ابدأ المتابعة من docs/CURRENT_STATE.md. لا يبدأ القسم ٠٢ قبل موافقة صريحة.
