# Safeer quality audit - 2026-11-12 (D72)

Owner request: search deeply for bugs and gaps, test the whole workflow, scan again, fix what is found, and test production. Work stays local until the owner reviews it; nothing was pushed or deployed during the audit.

Scope: API (NestJS services and controllers), web proxy (server.mjs), SQL migrations, passenger/staff/driver/tracking front ends, the Android shell, the production start script, and read-only requests to https://safeer.mohbaba.online. Fictional data and disposable PostgreSQL databases only.

Methods: code review; a whole-workflow test through the hosted proxy; a malformed-input probe (5,130 requests over about 100 endpoints, one field changed at a time); the production start command against a non-superuser-owned database; browser checks in both languages; read-only live checks. This is a broad audit, not proof that no defect remains.

## Baseline before any change (commit d6b85e7)

- Unit, build and documentation checks: 26/26 passed.
- Database integration: 144/147 passed. The 3 failures were the operations fixtures, which refuse to run in the last 75 minutes of the Khartoum day, so the release gate failed every night from 22:45 to midnight.
- Built browser workflows, run one at a time: 26/28 passed. operations.browser failed for the same fixture reason; platform.browser failed on the travel-notice alignment check.

## Issues found and fixed

| # | Severity | Issue | Effect before the fix | Fix | Regression test |
|---|---|---|---|---|---|
| 1 | High | Public hold, lookup and release limits were keyed by the API socket address, which is always the web proxy | The whole site shared one budget: after 120 held seats or 30 booking lookups in 15 minutes, every passenger got "too many attempts" | Use the visitor address (client()), as sign-in and tracking already did | workflow.integration.mjs, production.integration.mjs |
| 2 | High | The site is behind Cloudflare; the proxy used the last X-Forwarded-For hop, which is then a Cloudflare server | Sign-in and booking limits shared by everyone reaching the site through the same Cloudflare server | Trust CF-Connecting-IP only when the last hop is in Cloudflare's published ranges; a request that bypasses Cloudflare keeps its real address | server.test.mjs |
| 3 | High (apps) | The Android shell blocked every non-Safeer link, including tel: and mailto: | In the apps, company phone/email, the support email and staff booking phone links did nothing | Hand user-tapped tel:/mailto: links to the dialer or mail app; Booking 0.17.3, Driver 0.18.4 | mobile-shell.test.mjs; compiled DEX checked |
| 4 | Medium (apps) | "Sign in with Google" shown inside the installed apps | The app shell blocks Google's page and Google refuses embedded views, so the button did nothing | In the apps, explain that Google sign-in works on the website | passenger-app-account.browser.mjs |
| 5 | Medium | Company time zone accepted offsets such as +03:00 (allowed by JavaScript) | PostgreSQL reads +03:00 as three hours west of UTC: a 07:00 departure would be stored 6 hours off, breaking boarding windows, hold expiry and delay alerts; unknown names caused 500s on trip writes | Accept only named regions that PostgreSQL knows; clear message in English and Arabic | audit-fixes.integration.mjs |
| 6 | Medium | Staff Trips list silently capped at 200 trips; walk-in sale list capped at the next 100 departures | A busy company could not see, manage or sell later trips from the screens | Trips: "Show trips from" date and an incomplete-list notice. Walk-in sale: optional travel date using migration 0022 counter_trips | audit-fixes.integration.mjs, trips.browser.mjs, ticketing.browser.mjs |
| 7 | Low | Operations dashboard accepted impossible dates such as 2026-02-31 | HTTP 500 | Calendar round-trip validation | audit-fixes.integration.mjs |
| 8 | Low | Shipment tracking applied whichever reply arrived last | A slow earlier lookup could show the wrong code's status | Only the newest lookup is shown | track.browser.mjs (existing) |
| 9 | Low (visual) | Travel notice side margins differed from the content below it on tablets and phones | Misaligned notice; the layout test was also out of date after the header became edge to edge | Same margins as the content band; test compares with the content band | platform.browser.mjs |

## Test and tooling gaps closed

- workflow.integration.mjs: one company from setup to reports through the hosted proxy, with real roles (company administrator, cashier at a station, luggage handler, assigned driver): guest group booking in Arabic, retry and seat race, masked lookup, cash payment and printed tickets, bank-transfer walk-in sale, luggage tag/load/collect with proof, parcel drop-off/track/deliver with receiver checks, driver check versus boarding and idempotent rescans, departure/arrival and incident, closed refund after travel, counter close with a difference, finance and platform reports, alerts, and hold expiry.
- production.integration.mjs: runs scripts/production.mjs (the Render start command) twice against a disposable database owned by a non-superuser; checks migrations, the limited safeer_app role, first-owner bootstrap, health, security headers on every page, asset revalidation, private-file refusal, release data, Secure cookies, a short booking-to-payment flow, per-visitor limits and a clean restart with data kept.
- audit-fixes.integration.mjs, passenger-app-account.browser.mjs, mobile-shell.test.mjs and new server.test.mjs cases for the fixes above.
- The operations fixtures now pick Africa/Khartoum or Etc/GMT+6 by time of day, so the release gate passes at any hour.
- npm run check:live: read-only check of the deployed site, including which commit its files match.

## Results after the fixes

Full local release verification (npm run verify:release, fresh disposable PostgreSQL 18 cluster, 18 minutes) passed:

- Unit, build and documentation: 28/28 (two new checks).
- Database integration: 153/153, including the three operations tests that failed before and the new workflow (2), production start (1) and audit-fix (3) tests.
- Built browser workflows, one at a time: 30/30, including the new installed-app account check and the Staff menu check added in commit b6b084b.

Also checked:

- Malformed-input probe: 5,130 requests, no server error (4,417 refused as invalid input, 286 as business-rule conflicts, the rest permission, sign-in or success answers).
- npm audit for production and development dependencies: 0 known advisories at the time of the audit.
- Android: Booking 0.17.3 and Driver 0.18.4 release builds and lint passed (two existing warnings each), signed with the existing certificate a19fb6c1…7205, and the compiled apps contain the new link handling.

## Live site, read-only (2026-11-12)

19/19 checks passed: health and database connected, hold and retention jobs ok, all pages 200 with HSTS and CSP, signed-out staff session refused, private files 404, update notice data identical to the committed release file, both v0.17.2/v0.18.3 APK downloads 200, and the deployed files match commit 5cc278a, the latest pushed commit. Google sign-in is not configured on the host yet. No sign-in, booking or change was made.

## Open items (not changed)

- After pushing, publish GitHub releases v0.17.3 and v0.18.4 with the saved APKs and .sha256 files. Until then the in-app update link for the new versions returns 404.
- The Cloudflare range list in server.mjs must be updated if Cloudflare publishes new ranges. Whether Render keeps CF-Connecting-IP is assumed from standard behavior; if it does not, behavior falls back to the previous last-hop address.
- Finance reports take the exclusive application lock for a consistent snapshot, so a very large report briefly delays other writes. Acceptable at current scale; revisit if reports get slow.
- Expired passenger sessions are removed only when that account signs in again.
- An assigned driver can board by typing a printed ticket number (D66 by design); numbers are sequential per company.
- Phone and email links were checked by source policy test and in the compiled app code, not on a physical phone.
- Google sign-in inside the apps would need a browser hand-off flow (D68 step 4).
