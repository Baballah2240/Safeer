# Safeer quality audit - 2026-11-09

Follow-up: [D56 source remediation and verification](../archive/AUDIT_REMEDIATION_2026-11-09.md). The six source issues are corrected and checked locally; online deployment remains pending authentication. The original audit evidence below is retained as history.

Scope: current local source, all existing automated workflows, targeted boundary/race probes, and read-only public requests to https://safeer.mohbaba.online. No production sign-in, bookings, payments, account changes or deployment. This is a broad audit, not proof that every possible defect has been found.

## Test results

- Unit/server checks: 17 passed. API/static build and documentation checks passed.
- Native database release suite: all 126 tests passed, including tenant isolation, concurrency, financial invariants, retention, identity recovery and database restore.
- Release verification completed successfully: source platform plus built identity, login, reservations, ticketing, boarding and platform browser workflows all passed.
- Additional browser workflows: 12 of 13 passed. Across all 19 distinct browser scripts, 18 passed and sidebar.browser.mjs failed. The sidebar failure was reproduced against a second fresh database. Because it fails at its first layout assertion, its later layouts and interactions were not certified in this run.
- npm audit --omit=dev and npm audit: zero reported vulnerabilities across production and development dependencies at audit time. This is not an independent security assessment.
- Read-only online checks: marketplace, Staff, Driver, privacy, account deletion and health return 200; unauthenticated auth/me returns 401; private runtime file returns 404. HSTS, restrictive CSP, no-store and denied unused device permissions are present. Health reports a connected database and healthy hold/retention maintenance.

## Confirmed issues

### High: current login fixes are absent online

The published /src/login-form.js returns 404, and published Staff/Driver JS differ from the current local source. The local login tests therefore do not certify the deployed login implementation. Verify Render's linked repository, branch and deployed commit, then deploy the reviewed build and retest. No deployment was performed during this audit.

### High: allowed Arabic group bookings can exceed the API limit

A request for ten travelers, each with a 100-character Arabic name and a 300-character Arabic luggage description, is 8,545 UTF-8 bytes. Those values are within the UI/domain limits, but the local proxy rejects it with HTTP 413 because both proxy and API impose an 8,192-byte limit. The UI does not explain this size conflict. Sources: server.mjs:42/48, apps/api/src/app.ts:246, src/marketplace.js and apps/api/src/reservation.service.ts. Reproduced using a temporary HTTP server and invented Arabic strings; no reservation was created. Align endpoint byte limits with the maximum validated booking envelope and show a specific response for 413.

### Medium: stale marketplace search overwrites newer results

Submit search A, then search B; resolve B first and A last. The URL/filter remains B, but the displayed trips become A's results. Confirmed by a controlled browser probe: filter B, OLD RESULT visible, NEW RESULT absent. src/marketplace.js:175 lacks request sequencing or cancellation. Capture search inputs per request and apply only the latest result.

### Medium: changing language loses an unfinished marketplace search

Select a departure city and enter a date without submitting, then switch language in the drawer. Both fields become empty. Confirmed by a controlled browser probe. src/marketplace.js:138 renders from query, which is only updated on submission at line 173. Capture form drafts before re-rendering.

### Medium: published privacy/deletion pages have no support contact

SUPPORT_CONTACT is empty in both local and deployed src/legal.js:5. Visitors are told to contact an address that is replaced by a publishing placeholder. Configure a monitored contact and verify the request-handling process; do not infer that a displayed deletion policy provides an implemented deletion workflow.

### Medium: hosted Android error screen incorrectly requires USB

mobile/android/app/src/main/java/sd/safeer/mobile/MainActivity.java:118 always tells users to run the computer app and connect by USB, including release builds whose origin is HTTPS. Confirmed by source inspection, not a physical-device outage test. Choose recovery wording based on the build origin and test network interruption in the hosted Android build.

### Medium: sidebar placement regressed and its dedicated suite fails

The built sidebar browser test fails at tests/sidebar.browser.mjs:28 with /staff/en/light/1920 toggle above sidebar. The same failure occurs against a second fresh isolated database. Current src/staff.js:42 places the toggle inside the header; src/app.js:71 uses the same header placement for the fictional preview. This contradicts the saved D48 requirement that the control sit above the sidebar, outside the header. The main release runner does not include this suite, so its green result misses the regression. Restore the intended placement and rerun the entire sidebar matrix; later assertions did not run after the first failure.

## Coverage and operational gaps

- database/recover-owner.mjs requires a PostgreSQL superuser and uses the local SAFEER_DATABASE_URL path. It is not a reviewed Render-owner recovery command; hosted recovery and changing the owner email currently require manual administrator work. No self-service forgot-password flow or MFA was found.
- The test database is bundled PostgreSQL 18; render.yaml selects PostgreSQL 16. No automated hosted startup/proxy/Secure-cookie test was found in tests/. Production-version database compatibility and Render configuration need a dedicated staging check. The healthy live GET checks do not replace that coverage.
- Native phone behavior, hosted release signing/installation, real printers/scanners, accessibility with assistive devices, backup restoration from the Render service, and production load were not certified by this audit. Browser emulation and local restore tests have narrower scope.
- The normal release runner selects only a subset of available browser workflows. This audit separately runs the remaining suites; future release gating should include them or document the selected coverage.

## Evidence

Generated receipts are kept privately under ignored .qa/: release-verification.json, additional-browser-audit.json, online-readonly-audit.json, gap-probe-results.json, booking-size-probe.json and sidebar-recheck.json. Temporary databases use separate directories and loopback ports. No credentials or private business records belong in this report or its source checkpoint.

## Suggested order

1. Bring Render onto the reviewed commit and verify online login.
2. Correct booking byte limits and add a maximum-size Arabic group-booking regression.
3. Fix search request ordering and draft preservation, with the reproduced races as regressions.
4. Complete support/recovery operations and hosted/Android acceptance checks.

No product bugs were fixed as part of this audit.

## Additional browser receipts

| Script | Result |
| --- | --- |
| browser.mjs | PASS |
| booking-menu.browser.mjs | PASS |
| companies.browser.mjs | PASS |
| driver-menu.browser.mjs | PASS |
| finance.browser.mjs | PASS |
| fleet.browser.mjs | PASS |
| headers.browser.mjs | PASS |
| luggage.browser.mjs | PASS |
| manual-ticket.browser.mjs | PASS |
| marketplace.browser.mjs | PASS |
| routes.browser.mjs | PASS |
| sidebar.browser.mjs | FAIL - reproduced sidebar placement regression |
| trips.browser.mjs | PASS |

The temporary database was stopped successfully. The main release runner also stopped and cleaned its own isolated cluster. Production/runtime databases were not used for the automated workflows.
