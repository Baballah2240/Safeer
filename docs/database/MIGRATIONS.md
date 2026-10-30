# Database operations - foundation

## Local tooling

`npm ci` installs the pinned `pg` client used only by migration/testing tools in Section 01. The browser server does not open a database connection. Use a separate local PostgreSQL 18 database and migration owner; do not point tests at real company, school or restaurant data.

Set `SAFEER_DATABASE_URL` in your shell or secure local environment to a loopback PostgreSQL database. `.env.example` documents the name; the application deliberately does not load or publish `.env` files automatically. Do not paste credentials into chat or commit them.

```powershell
npm.cmd run db:status
npm.cmd run db:migrate
npm.cmd run db:status
```

Only loopback URLs are accepted at this stage; no remote-database opt-out is provided. The CLI rejects URL query options and redacts connection/query details in failures. Provisioning a hosted database requires a later explicit deployment/security task.

## Test isolation

`SAFEER_TEST_DATABASE_URL` must identify a **disposable local instance**, using a QA role allowed to create/drop databases. `npm run test:db` creates uniquely named `safeer_s01_<uuid>` databases, tests them and drops only those generated databases. It fails when the variable is missing rather than reporting skipped coverage. It does not migrate the connection's original database.

The Section 01 workstation verification uses a temporary PostgreSQL 18.4 cluster from the binary package documented in the archive, random credentials, loopback binding and a unique ignored `.qa/pgdata-*` directory. The test cluster is stopped afterward. This is QA infrastructure, not an installed service or production configuration. Private test databases/credentials and downloaded binaries are excluded from source/archive deliverables.

## Why plain SQL migrations

The reservation design needs explicit composite tenant keys, range exclusion, locks, policies and immutable-history constraints. A small SQL migration layer preserves these PostgreSQL features without installing an unused ORM. NestJS modules may use a typed query/repository layer later, but it must use the same migration history and transaction boundaries.

## Upgrade and recovery conventions

1. Review schema ownership, row security, tenant foreign keys, indexes, query/backfill costs and affected API contracts.
2. Add a new numbered migration; never rewrite an applied file. Every migration is currently transactional. Large online indexes/backfills require a separately reviewed execution strategy rather than disabling safeguards silently.
3. Test a fresh install and upgrade from the previous schema on PostgreSQL, including deliberate failure/rollback, checksum drift, concurrent runners and constraints.
4. Back up and rehearse restore before production application. Source archives are not business-data backups.
5. Apply as a dedicated schema owner, not the application's runtime user. No real deployment is performed in Section 01.
6. Use forward fixes for errors. A rollback of a software release does not authorize destructive database downgrade or deletion of financial history.

Future business migrations must add their own tenant/RLS, payment and inventory tests. The current namespace/ledger tests cannot be cited as proof of company isolation or reservation concurrency.
