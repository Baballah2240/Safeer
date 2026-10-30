# Folder structure and staged transition

## Actual Section 01 source

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

When the owning sections begin, add `apps/api` (NestJS modular monolith/worker entry point), `apps/web` (Next.js route areas), `apps/passenger-mobile` and `apps/driver-mobile` (Flutter). Keep shared API/localization/design sources under root `src/shared`/`src/contracts`, generated client artifacts in the owning clients, and the single SQL migration history under `database/`.

Move the current UI into a clearly marked prototype/reference area only when a working framework replacement is available. Until then `npm start` remains usable. Do not copy in-memory booking rules into a production controller or remove working UI before its replacement passes regression checks.

Use module-local domain/application/infrastructure/delivery layers. Shared libraries contain stable primitives, not an unbounded utility module or a second financial business model. No cross-project runtime dependency on Stocrant or school-display is allowed.
