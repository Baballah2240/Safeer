# Section 15 local security review

Review started 2026-11-03; handover date 2026-11-04. D39 authorizes local security, integration, recovery and release preparation. This is a source/configuration review with automated adversarial regression tests, not an independent penetration test or approval to expose the app remotely.

## Threat model and findings

The backend enforces current authenticated platform roles/company memberships and resource scope; a browser company selector is never authority. Guest booking uses opaque hashed keys, bounded reference/mobile lookup, atomic holds and server time. Staff sessions are hashed, HttpOnly/SameSite cookies with idle/absolute expiry and credential-version revocation; writes require exact loopback Origin and CSRF. SQL uses parameterized values, fixed projections and trusted search paths. Runtime credentials, migration owner and backups remain private local operator assets. An OS/database owner can override the installation; defense against a compromised privileged operator is outside this local threat model.

| Finding | Change / evidence |
| --- | --- |
| Startup checked only a subset of RLS tables and could overlook one missing function through NULL aggregation | Reviewed config/database-security.json explicitly describes all 56 tables/48 RLS expectations, exact direct and column privileges, and 60 callable function signatures. Startup rejects schema/grant/RLS drift, missing projections, runtime-owned functions, PUBLIC function execution and unsafe SECURITY DEFINER search paths. It verifies, never silently repairs. Tampering tests remove/restore eight independent controls. |
| Background expiry/retention errors were silent | Health now reports each worker's state and last successful run without SQL/credentials/counts. Concurrent starts share bounded work; retries recover status and shutdown awaits current work. Hold availability still uses database time, independent of the tidying job. Tests remove retention execution and verify failure, redaction, retry and independent DB connectivity. |
| HTTP resource defaults were unsuitable for a prepared release | Set request/header/inactivity/keepalive limits, header count and requests/socket on both servers. Disable Express fingerprint header and unused camera/microphone/geolocation/payment/USB browser permissions. Existing keyboard scanners/paste remain supported. Real proxy tests cover chunked and compressed oversized bodies, Origin and safe headers. These settings complement deployment-level connection/rate limits; they are not an Internet load guarantee. |
| Proxy forwarded connection-specific headers between independent sockets | Strip standard hop-by-hop fields and fields nominated by Connection in both directions, preserving end-to-end cookies, Origin and CSRF. A regression makes twelve requests across four backend sockets and three client sockets with different request limits; all responses succeed and nominated fields are absent. Each server controls its own connection lifetime. No money mutation is automatically retried. |

All application functions were inspected through PostgreSQL metadata: no PUBLIC execution; SECURITY DEFINER functions use pg_catalog search paths. New callable-policy checks cover inherited/PUBLIC grants as effective privileges and detect column-only grants on otherwise private tables. Runtime cannot own application objects, create schemas, inherit roles or bypass RLS. The privilege manifest is reviewed source, not generated from the running database; update it only alongside reviewed schema/grant changes.

Connection-specific forwarding follows [RFC 9110 section 7.6.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-7.6.1). Earlier built Ticketing checks timed out at different navigation steps; the hop-header defect was independently reproduced by the regression. The first regression fixture also forced keepalive at its own close limit; its simulated server now correctly announces close. Do not attribute every earlier browser timeout to a confirmed single cause. The complete release gate passed after the fix; measured results are linked below.

## Measurements and verification

Initial isolated 5,003-event inbox: Super Administrator 338 ms; restricted staff 376 ms. Counts, complete unread totals and 50-row bounds passed under the unchanged eight-second database query timeout. Later run measurements are stored separately and may differ under concurrent suite load. No query rewrite, new index or schema migration was justified by that result. The full financial-volume regression uses 20,002 movements. Measurements are local samples, not a capacity/SLA claim.

The npm registry audit of the locked dependency tree returned zero known advisories when checked during this review; retain the dated receipt. This does not establish absence of undisclosed vulnerabilities. No dependency upgrade or new package was needed. Recheck advisories before an actual external release.

The connected suite covers passenger payment/ticket/bag/boarding/journey/collection/counter/report/alert consistency; payment/cancellation and boarding/refund races; and an ACL-preserving PostgreSQL clone with exact row fingerprints, migration checksums, existing session, stable ticket QR and idempotent payment retry. Source connections are closed before PostgreSQL clones the fictional database. This is a database-clone test, not a pg_dump/file/off-site restoration claim. The pinned Windows package lacks pg_dump/pg_restore. The separate private local filesystem backup is verified by hashes and restored startup/stop before upgrading the real installation.

Final automated/release, browser, backup and account-preservation evidence is recorded in [current state](../CURRENT_STATE.md) and [Section 15 archive](../archive/SECTION_15_RELEASE.md) after completion. No real passenger data is used in test fixtures.

## Residual release prerequisites

Read [release readiness](../RELEASE_READINESS.md). Remote HTTPS/session delivery, external rate limiting/monitoring, independent security review, chosen hosting/backup infrastructure, off-site business-data restoration, retention/legal/receipt decisions and owner acceptance remain explicit prerequisites. No account reset, money policy, support grant, automatic metadata deletion or native app is introduced by this review.
