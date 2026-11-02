# Folder structure and staged transition

## Preserved Section 01 source (with Section 02 additions below)

```text
Safeer/
  AGENTS.md                     section gate and implementation rules
  README.md                     local commands and honest feature status
  package.json / package-lock.json
  server.mjs                    loopback prototype + liveness only
  config/assets.mjs             single public asset allowlist
  src/
    app.js                      retained passenger prototype views/events
    domain.mjs                  in-memory example rules, not backend authority
    demo.mjs                    fictional passenger fixtures
    i18n.js                     shared prototype translations
    styles.css / tokens.css     layout and visual vocabulary
    contracts/openapi.json      implemented API contract only
    brand.svg
  database/
    migrate.mjs                 transactional PostgreSQL migration CLI
    migrations/0001_foundation.sql
  scripts/                      static build and documentation checks
  tests/                        example rules, server, migration and browser checks
  mobile/UPDATES.md              mobile-facing status, no native build
  docs/
    architecture/ database/ workflows/ modules/ api/
    security/ testing/ decisions/ archive/
    PROJECT_MASTER.md DEVELOPMENT_ROADMAP.md DATABASE_SCHEMA.md
    BUSINESS_RULES.md SYSTEM_ARCHITECTURE.md CHANGELOG.md
    CURRENT_STATE.md DECISIONS.md SECTION_ARCHIVE_TEMPLATE.md
  archives/                     ignored verified source ZIPs/checksums
  dist/                         ignored reproducible public-asset build
  .qa/                          ignored test screenshots, binaries, private QA runtime
```

No empty fake application modules or placeholder controllers are created. The complete module/table design is documentation; folders and executable tables are introduced with tested work.

## Target repository layout

`apps/api` is now implemented for identity. Add `apps/web` (Next.js route areas), `apps/passenger-mobile` and `apps/driver-mobile` (Flutter) only in their owning sections. Keep shared API/localization/design sources under root `src/shared`/`src/contracts`, generated client artifacts in the owning clients, and the single SQL migration history under `database/`.

Move the current UI into a clearly marked prototype/reference area only when a working framework replacement is available. Until then `npm start` remains usable. Do not copy in-memory booking rules into a production controller or remove working UI before its replacement passes regression checks.

Use module-local domain/application/infrastructure/delivery layers. Shared libraries contain stable primitives, not an unbounded utility module or a second financial business model. No cross-project runtime dependency on Stocrant or school-display is allowed.

## Actual Section 02 additions

apps/api/src contains the NestJS identity module: app/main/admin, database, security and identity service; apps/api/tsconfig.json compiles only these sources to ignored dist/api. The existing public server remains the allowlisted frontend/proxy. staff.html and src/staff.js, staff-i18n.js and staff.css provide the working staff client. There is no Next.js or Flutter shell yet.

The 0002 identity migration remains in database/migrations alongside the original checksum-stable baseline. runtime-grants, grant-runtime and recover-owner are local developer/owner commands. scripts/local.mjs owns the optional private Windows PostgreSQL development process and restricted runtime configuration. tests/support/identity-db.mjs supplies disposable real PostgreSQL fixtures shared by HTTP/browser tests.

runtime/ contains the ignored persistent development database, private connection settings and first-login text; never treat it as source/build cache. The optional pinned Windows PostgreSQL binary stays in node_modules and is excluded from archives.


Section 03 adds `apps/api/src/company.service.ts`, `database/migrations/0003_companies.sql`, `src/companies.js`, company integration/browser tests, the company access workflow and numbered Section 03 archive. Company SQL/authorization stays in the API/database; shared responsive company UI stays under src/. Runtime database dumps are private under ignored runtime/backups/, never under source archives.

Section 04 adds apps/api/src/route.service.ts, src/routes.js, database/migrations/0004_routes.sql and route-specific integration/browser tests. Route workflow and handover documents explain access, limits and continuation.

Section 05 adds apps/api/src/fleet.service.ts, src/fleet.js, database/migrations/0005_fleet.sql, database/backup-local.mjs and fleet integration/browser tests. The fleet workflow and handover documents explain access, limits and continuation.

Section 06 adds apps/api/src/trip.service.ts, src/trips.js, database/migrations/0006_trips.sql and trip integration/browser tests. The trip workflow and handover documents explain access, limits and continuation.

Section 07 adds marketplace.html, apps/api/src/public.service.ts, src/marketplace.js, src/marketplace.css, src/public-page.js, database/migrations/0007_marketplace.sql and marketplace integration/browser tests.

Section 08 adds apps/api/src/reservation.service.ts, database/migrations/0008_reservations.sql and reservation integration/browser tests. Seat and hold pages live in src/marketplace.js and src/marketplace.css.

Section 09 adds src/bookings.js, database/migrations/0009_passengers.sql and tests/passengers.integration.mjs. Passenger forms and the retrieval page live in src/marketplace.js.
