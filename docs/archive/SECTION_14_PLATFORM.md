# Section 14 - platform administration, notifications and global analytics

Date: 2026-11-03. Authorization: owner's "next", recorded as D38 before implementation. Version 0.15.0. Completed and verified locally. Stop before Section 15.

## Implemented scope

Super Administrator-only platform dashboard with current company/approval/listing/account counts, range-based bookings/scheduled departures and per-currency payment/refund/net collections. Global dates are UTC and limited to 31 inclusive days; 50 company cards/page. Reuse protected company approval/listing and existing user/role/audit screens. Add reauthenticated/versioned/audited bilingual plain-text public notice, disabled by default, safely displayed in real public pages.

Transactional durable in-app event feed with per-user idempotent read receipts, 50 events/page, total unread count, newest/older navigation and current authorization checks. Current authority controls access, including driver assignment, station finance scope, company-wide incident/luggage authority and company approval state. Only codes/resource IDs/timestamps are stored; no copied notes/passenger/payment/QR values. Last 90 days visible, no backfill or external delivery. See [workflow](../workflows/PLATFORM_ADMINISTRATION.md).

## Source and data changes

New platform.service.ts, platform.js, migration 0014_platform.sql, platform integration/browser checks and workflow/handover. Update app wiring/runtime grants/startup checks, staff navigation/translations/CSS, driver inbox link, safe public notice display, OpenAPI/package versions and focused schema/server assertions. Shared responsive src/ and mobile/UPDATES.md remain in this repository. No dependencies added, native build, hosting or account reset.

Migration 0014 adds platform_settings, notification_events and notification_reads, all RLS-enabled and inaccessible as raw tables to the runtime. Fixed SECURITY DEFINER projections/capture functions use pg_catalog search paths and PUBLIC revocation; only six necessary callable functions are granted. Six source-operation trigger bindings capture metadata atomically (company/profile/trip/incident/session/luggage); public notice contains no private settings. Two global posting indexes support payment/refund reporting. No earlier migration, existing role grants, company policies or money rows are rewritten.

Verified schema/contracts: 56 application tables, 48 RLS tables, 33 permissions, 93 API paths / 107 operations, 33 public assets. New paths: GET public/notice; GET platform/dashboard; GET/PUT platform/settings; GET notifications; POST notifications/{event}/read. Existing cookies, Origin/CSRF, strict JSON, password-work limits and query timeouts apply.

## Verification evidence

npm.cmd run check passed: 15 unit/server checks, API/static build, 23 mandatory documents and links in 49 Markdown files. Full disposable PostgreSQL 18.4 suite passed 113/113 with no skips/failures in about 212 seconds (11 database, 12 identity, 10 companies, 8 routes, 7 fleet, 8 trips, 5 marketplace, 8 reservations, 6 passengers, 9 ticketing, 6 luggage, 7 boarding, 7 finance, 9 platform). Total unique automated checks: 128. A final nine-test platform rerun verifies initially unlisted/content-only profile behavior and independent newly authorized read receipts. Existing 20,002-movement finance regression passed.

Source and built platform browser workflows each passed 32 layouts (two screens × two languages × two themes × four widths), plus real collections, notice editing/escaping, public Arabic switch, receipts, company links, invalid-filter clearing and restricted employee views. Built driver regression passed 16 more layouts and complete QR/boarding/incident/journey/revocation/logout behavior. No recorded product browser errors; screenshots inspected. Final local health is 0.15.0/database connected; all 33 served asset hashes match the build. Anonymous settings/inbox are denied and the public notice is disabled.

Private backup runtime/backups/Safeer-before-Section-14-2026-11-03-d5b2a301-991f-4b7d-8b01-922f4aebe41f/ matched 1535 files and passed protected restore/start/clean-stop with one account/zero companies. Temporary restore was removed only after clean stop/path checks. Upgrade applied only migration 0014; all fourteen checksums are applied. Account/password/user records, private settings/first-login, global role labels and 49 legacy table fingerprints are unchanged. Runtime remains one account, zero companies, zero notification events/receipts; no fictional operational records seeded.

Initial checks found fixture assumptions: expected wrong-password status differed from the existing REAUTHENTICATION_FAILED response; privileged owner SQL needed real authenticated context; bulk fixture companies needed archived status to respect the last-company-admin guard; and the foundation table allowlist needed the three new tables. Correct the tests without relaxing production guards. Visual inspection found desktop filters overridden by a more specific generic form style and an Africa/Khartoum timestamp mislabeled UTC; scope the selector and explicitly format the global snapshot in UTC.

## Boundaries and continuation

No Section 15 production-readiness claim. No SMS/email/push/WebSocket delivery, automatic public-notice refresh, native app, remote hosting, camera/offline scanning or freight. Inbox events older than 90 days are hidden; physical metadata/receipt deletion and backup retention remain maintenance work. Dashboard pagination takes fresh snapshots. Financial policy questions and legal/receipt/retention review remain in [Section 10](SECTION_10_TICKETING.md).

The committed Safeer-only source ZIP belongs at archives/Safeer-0.15.0-Section-14-2026-11-03.zip with SHA-256 sidecar, exact source commit/file hashes and verification receipt. Keep existing runtime/ and its verified private pre-upgrade backup separately; source archives contain no accounts/credentials/database/dependencies. Git push must not publish the unrelated portfolio history that the owner requested to keep local. Stop before Section 15.
