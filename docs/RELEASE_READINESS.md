# Safeer release and local operations

Version 0.16.0 prepares the existing local passenger system. It is not an Internet deployment. Source: [current state](CURRENT_STATE.md), [Section 15 security review](security/SECTION_15_REVIEW.md) and [business decisions](DECISIONS.md).

## Reproduce verification

Install Node 24+, npm.cmd ci and the pinned optional Windows PostgreSQL package. Install local Chrome or set CHROME_EXE to a trusted Chrome/Chromium executable. Run from projects/Safeer:

    npm.cmd run verify:release

This command runs unit/server checks, API/static build, mandatory docs/links, every *.integration.mjs database test, source Platform browser checks and built Identity/Reservations/Ticketing/Boarding/Platform browser workflows. It creates a private, disposable loopback PostgreSQL cluster with fictional data, never opens runtime/, and removes its temporary cluster only after clean stop and path/link checks. A failed check stops the release gate and writes .qa/release-verification.json with passed:false. Read the actual result and process exit status; a build by itself does not pass the release gate. Screenshots and temporary browser profiles remain ignored test artifacts.

On another OS, supply SAFEER_TEST_DATABASE_URL for an explicitly disposable loopback PostgreSQL owner. The tests create/drop their own databases/roles, not the supplied base database. Do not point test tooling at business data. External URLs/options are refused. No native application or hosting is built or deployed.

The command is offline apart from normal local browser/server communication. Recheck public dependency advisories separately with npm.cmd audit --json; do not assume a past zero-advisory result remains current. Do not use audit fix blindly. The repository lockfile remains authoritative.

## Health and failures

GET http://127.0.0.1:4320/api/v1/health reports version, local mode, database connectivity and maintenance.holds/retention. Each job has state starting/running/ok/failed and lastSuccessAt. The separate static prototype reports disabled jobs and no database connection. A failed maintenance job needs attention even when database is connected; raw SQL, passenger details and credentials never appear here. Database unavailability returns a safe 503 error. Health connectivity is not proof that every business workflow or production prerequisite is ready.

Expiry tidies every 30 seconds and retention retries hourly/on startup. Concurrent starts of the same worker share one promise. Health state is process-local and resets on restart; it is not durable job history. Existing server-side expiry/90-day erasure rules remain authoritative. Investigate permissions/connectivity and rerun local verification; do not disable security checks to make startup pass. Startup failures on changed RLS/table/column/function grants or missing functions require restoring the reviewed configuration/migrations using the private owner, never weakening config/database-security.json to match accidental grants.

HTTP request/header deadlines are 15/10 seconds; inactivity is 15 seconds; keepalive is five seconds; at most 40 parsed headers and 100 requests/socket. Node's periodic deadline checks can add scheduling delay, so these are configured limits, not exact per-request timing guarantees. Existing body/query/lock limits remain. Local loopback Host/Origin/CSRF checks are still required. Unused browser device permissions are denied; camera scanning is not implemented.

The local proxy removes hop-by-hop and Connection-nominated headers in both directions. Each socket controls its own lifetime/framing; cookies, Origin and CSRF remain end-to-end. Transport failures do not trigger an automatic retry of a money mutation; existing idempotent recovery workflows remain explicit.

## Safe local update / recovery

1. Keep runtime/ private and intact. Preserve the current source checkpoint and its checksum. Stop only the verified Safeer launcher; never delete postmaster.pid or runtime/ to repair a login.
2. Run npm.cmd run local:backup -- Section-15 with the launcher stopped. Verify file hashes and the protected restore/start/clean-stop receipt. A failed backup means do not upgrade. Existing backups are retained; owner-managed retention is still required.
3. Run npm.cmd run local for the tested source. Migrations are append-only/checksummed; this Section 15 introduces no schema migration. Restricted runtime grants must match the reviewed security manifest.
4. Verify version, health/job state, source/build hashes and the existing account. Preserve credentials/settings and history. Existing installations do not generate a new owner password. A new empty installation creates its own private first-login file.
5. On failure, stop the verified launcher and retain the original runtime and backup. Follow [identity setup/recovery](database/IDENTITY_SETUP.md) using the private operator connection. Restore to a separate protected directory/port first and compare account/history before switching; never overwrite the only good copy.

The source ZIP contains code/evidence, not accounts/passwords/business records. The private physical backup is a separate artifact. PostgreSQL clone tests validate complete fictional business consistency; they do not replace file/off-site restoration drills. The optional package omits pg_dump/pg_restore: provision trusted matching PostgreSQL client tools before planning logical exports. Preserve ACLs/revoke PUBLIC function execution and recreate a least-privileged runtime role when restoring elsewhere; startup must reject unsafe restored grants. Do not expose backups, settings or credentials through web/static hosting or Git.

## Before any remote customer release

- Owner-approved infrastructure/domain, HTTPS-only reverse proxy, secure cookie/token delivery, trusted-host/proxy/Origin changes and firewall boundaries. The present code deliberately rejects remote hosts/database URLs.
- Operator-managed database/service accounts, secrets rotation, encrypted off-site backup and a timed business-data restore/rollback drill on the chosen infrastructure.
- Central health/maintenance failure alerts, durable job supervision, bounded connection/rate limits, access/audit monitoring and representative load/availability objectives.
- Owner/legal decisions on financial/refund/currency/session policies, receipt wording, passenger-data/metadata/audit/backup retention and access reviews. Existing money rules remain unchanged pending those decisions.
- Independent security assessment and real staff acceptance of Arabic/English booking, station printing/scanners, luggage, drivers and reconciliation. Test physical printers/projectors/scanners and supported devices; browser emulation is not hardware certification.
- Separate native/mobile scope and delivery, if requested. Flutter, offline scanning, remote notifications and freight remain unimplemented.

Section 15 completes a verifiable local checkpoint and documented preparation. Deployment, policy changes and later features require a new owner instruction.
