# Current state - read this first

## Audit remediation - D56, 2026-11-09

Verification complete: 17 unit/server checks, 129 integration tests on PostgreSQL 16.15, and all 20 browser scripts pass across the main run and corrected-predicate continuation. Debug and hosted Android builds/lint pass; APKs are saved. Local service is updated. GitHub/Render authentication and a physical USB phone are the remaining external requirements.

The audit source fixes preserve newest-search ordering and unfinished search fields, restore the above-sidebar toggle with immediate keyboard state and clipped animation overflow, publish the owner-approved support contact, and permit a bounded 64 KiB payload only for creating public group bookings (other endpoints remain 8 KiB). The Android error screen distinguishes hosted HTTPS from USB; local patch .6/16006 is built/linted/saved. Hosted owner recovery now supports a non-superuser migration owner with explicit confirmation, duplicate-email rollback, session revocation and audit. Complete browser release gating and PostgreSQL 16 CI are added. No schema, financial policy, role grants or real account credentials are changed. See [D56 handover](archive/AUDIT_REMEDIATION_2026-11-09.md) for measured results and outstanding deployment/device verification.


## Quality audit - D55, 2026-11-09

The broad audit found seven confirmed issues. All 17 unit/server and 126 database tests pass; 18 of 19 distinct browser scripts pass, with the sidebar placement regression reproduced twice. Targeted probes also reproduce stale marketplace searches, lost search drafts and an allowed Arabic group-booking payload rejected by the 8 KB limit. Read-only online checks confirm that the reviewed login helper is absent from the deployment and the support contact remains empty. See [the complete quality report](testing/QUALITY_AUDIT_2026-11-09.md) for severity, evidence and coverage gaps. No product fixes or production data changes were made.

## Login reliability - D54, 2026-11-08

Staff and Driver preserve entered sign-in fields during language/render changes, keep the email after rejection, clear rejected passwords, and serialize login submissions while startup/session checks or login requests are pending. Credentials stay in ephemeral form state, never browser storage, markup or source. Existing accounts/data, server authorization, password rules and loopback-only access are preserved. The owner separately approved private local owner-password recovery; no credentials are included here. See [D54 handover](archive/LOGIN_RELIABILITY_2026-11-08.md).


## Driver sidebar and mobile fullscreen - D52

Driver now matches Booking with sidebar navigation and appearance/language Settings; operational refresh/logout and assigned-trip rules remain. Both local Android clients remove native toolbars and use immersive fullscreen with swipe-reveal system controls and safe cutout/keyboard insets. USB patch .5/16005 preserves app data. No schema/API, authority, money or hosting change. See [D52 handover](archive/MOBILE_FULLSCREEN_2026-11-05.md); prior evidence is historical.


## Booking sidebar and settings - D51

Booking removes its native title/Home/Refresh/Print toolbar. Shared public Booking navigation now uses a compact menu trigger and accessible side drawer with trip search, My booking, staff access and appearance/language Settings. Driver keeps its native tools. Local USB patch .4/16004 preserves app data and server permissions; no schema, money or hosting change. See [D51 handover](archive/BOOKING_SIDEBAR_2026-11-05.md); prior evidence is historical.


## USB mobile update - D50

The owner requests installing the current shared UI into both USB Android clients. Local test version is 0.16.0-usb.3/16003; build/lint/save and replacement installation preserve app data and existing server accounts. Keep the computer, Safeer service and USB tunnel connected. No schema/API, roles, money or hosting change. See [D50 handover](archive/ANDROID_UPDATE_2026-11-05.md) for verified results; prior evidence is historical.


## Floating header curve and glass - D49

Headers now leave 12px desktop/10px mobile top clearance, retained while sticky, so the full rounded edge is visible. Softer tint, broad reflections, brighter edges and layered shadows refine the glass; scroll clearance includes the gap. Above-sidebar controls, bilingual layout and accessibility remain. No schema/API, authority, account, money or native change. See [D49 handover](archive/FLOATING_HEADER_2026-11-05.md); earlier evidence is historical.


## Toggle above the sidebar - D48

The circular button now sits in its own toolbar above the staff/preview sidebar, outside header actions. When collapsed it stays in the leading top corner, with reserved header space for safe restoration. Saved preference, keyboard/ARIA and responsive RTL/LTR behavior remain. No schema/API, authority, business data or native change. See [D48 handover](archive/SIDEBAR_POSITION_2026-11-05.md); older evidence below is historical.


## Circular sidebar button - D47

The header sidebar toggle follows the supplied reference: circular glass, small two-line menu icon and no visible text. A 44px target, translated accessible name/title and all saved hide/restore behavior remain. No API, schema, account, permission, money or native change. See [D47 handover](archive/CIRCULAR_SIDEBAR_2026-11-04.md); prior evidence below is historical.


## Marketplace announcement - D46

The public notice is now a compact aligned glass announcement with an SVG icon, translated Travel update label and wrapping message. Existing protected bilingual settings and plain-text escaping remain. No schema, API, account, permission, financial or native-code change. Read [D46 handover](archive/MARKETPLACE_NOTICE_2026-11-04.md) for verification/checkpoint details; prior evidence below is historical.


## Frosted reference glass - D45

The supplied visual reference guides clearer translucent headers/sidebar, pill controls and frosted summary tiles over warm ambient gradients. Black/brown identity, readable operational panels, sticky headers and the saved sidebar toggle remain. No schema, API, authority, account, money or native-package change. See [D45 handover](archive/REFERENCE_GLASS_2026-11-04.md) for verification and the local checkpoint; prior evidence below is historical.


## Sidebar visibility - D44

A header button hides/restores the staff and fictional-preview sidebars, expanding the workspace without re-rendering forms. A device-local preference survives navigation/reload; Arabic/English labels, keyboard operation and hidden-navigation focus are supported. No API, schema, authority, money, account or native package change. Read [D44 handover](archive/SIDEBAR_TOGGLE_2026-11-04.md) for verification and the local source checkpoint. Earlier evidence below is historical.


## Sticky headers - D43

The owner-requested Apple-inspired glass headers now stick at top:0 across all four pages on desktop/mobile, retaining black/brown. Header height tracking follows wrapping and app re-rendering, keeping scrolled form fields clear. All 64 scrolling/accessibility/print combinations and 60 existing Identity/modal combinations pass, plus 17 unit/server checks, build/docs and all 33 served asset hashes. Existing USB apps receive the shared change on refresh; no APK or business data change. See [D43 evidence](archive/STICKY_HEADERS_2026-11-04.md).


## Current palette - black and brown (D42)

The owner specified black and brown. The current shared UI uses near-black/espresso surfaces, brown glass actions, warm cream text and a cream/brown light theme; bento layout and all business behavior remain. Both matching local Android apps 0.16.0-usb.2/16002 are built/linted, saved and installed with verified versions. Browser checks cover 68 responsive/language/theme combinations plus preview/print, 17 unit/server checks pass, and all 33 served asset hashes match. The phone was locked at the final capture attempt; D42 phone rendering was not visually rechecked. Read [D42 evidence](archive/BLACK_BROWN_2026-11-04.md).


Updated: 2026-11-04 (Asia/Riyadh). Safeer / Sudan Transport **0.16.0**. Sections 01-15 and the verified local update are complete under D39, followed by the D40 USB phone apps and the D41 visual refresh. Stop here; deployment and later features require a new owner instruction.

## Bento grid and liquid glass - D41

The owner requested a project-wide bento-grid style with liquid-glass buttons, headers and sidebar. Shared src/tokens.css and src/theme.css, loaded last on every page, now give staff/company/finance/platform, Driver, Booking/marketplace and the fictional preview rounded tiles, glass controls, a floating top bar and a dark-glass sidebar in both themes. Data, DOM/control behavior, server authority, business and money rules, Arabic/English layouts, seat states and print output are unchanged. No migration, API, permission or native package change. The same 33 public assets are served.

Review fixes before release: primary buttons regained their teal emphasis, sidebar menus regained the current-page highlight and light-mode legibility, held seats use a readable amber fill, the preview's seat states and key match, the driver header and staff top bar line up with the content, and the Cities & destinations shortcut no longer shows "undefined". All nine affected built-browser workflows pass, covering 256 responsive/language/theme combinations plus the passenger preview, including 320px and keyboard/reduced-motion/reduced-transparency/forced-color checks. The 17 unit/server checks, build and docs pass. The existing installed USB apps were refreshed and their dark Booking/light Driver screens visually verified; no new APK is necessary. Read the [D41 handover](archive/BENTO_GLASS_2026-11-04.md).

## Android USB follow-up - D40

The owner subsequently requested installing Driver and Booking on the USB-connected phone. Separate local-test Android apps **Safeer Driver** (sd.safeer.driver) and **Safeer Booking** (sd.safeer.booking), version 0.16.0-usb.1/16001, are now built/linted and installed with verified package versions on LGN-NX1/API 36. These WebView launchers reuse src/ and the running loopback application through ADB reverse tcp:4320. Real Driver sign-in and Booking screens, independent app storage and disconnected/Retry recovery are checked. Existing accounts/permissions and business records are not reset or seeded. The driver signs in separately and needs a current linked driver assignment; the existing zero-company marketplace stays empty until configured.

Keep the computer, local server and USB connection active. Run npm.cmd run mobile:usb after reconnecting; saved APKs/checksums/manifest are under ignored mobile/releases/. Read [mobile setup](../mobile/README.md). No Flutter, remote hosting, offline synchronization, production signing/store release or camera scanning was introduced. Android lint passes with zero errors and two known target/back-attribute compatibility warnings. Physical printing and full operational phone acceptance remain untested. Section 15 evidence below predates this scoped follow-up; its native-build exclusions describe that original checkpoint.

## Running application

- Staff/company/platform management: http://127.0.0.1:4320/staff
- Assigned-driver workspace: http://127.0.0.1:4320/driver
- Real local marketplace: http://127.0.0.1:4320/marketplace
- Separate fictional passenger design preview: http://127.0.0.1:4320/

Health reports 0.16.0/database connected with both maintenance workers successful. Existing account/password are unchanged. The persistent installation has one existing account, zero companies and no seeded notification events. Everything remains on 127.0.0.1; D40 adds only the USB Android test apps described above. No remote hosting, gateway or external notification delivery occurred.

## Section 15 changes

Startup now verifies the complete reviewed config/database-security.json: all 56 tables, 48 RLS expectations, exact effective direct/column privileges and 60 callable function signatures. Missing projections, disabled RLS, excess grants, unsafe SECURITY DEFINER search paths, PUBLIC function execution and runtime-owned functions are rejected. This replaces partial startup checks that could miss drift or overlook a missing function through a NULL aggregate. The private operator must restore reviewed configuration; startup does not weaken policy or silently repair grants.

Health adds maintenance.holds/retention state and lastSuccessAt. Failures contain no SQL/credentials/passenger data; database failure returns a safe 503. Each worker has one active promise, retries through existing intervals and is awaited during shutdown. Existing server-time expiry and 90-day erasure policies are unchanged. A failed job needs attention even when database connectivity works. The separate prototype labels jobs disabled.

HTTP headers/request/inactivity/keepalive work is bounded on both servers. Unused camera/microphone/geolocation/payment/USB browser permissions are denied and Express fingerprinting is removed. Keyboard/paste scanner workflows remain. Add npm.cmd run verify:release for the complete offline disposable-database and browser gate; failed builds replace stale success receipts and stop later phases without touching runtime/. These controls do not enable or certify Internet deployment.

Read [security review](security/SECTION_15_REVIEW.md), [release/operations guide](RELEASE_READINESS.md) and [Section 15 handover](archive/SECTION_15_RELEASE.md).

## Existing connected functionality

Protected Super Administrator/user/role/session management; approved isolated companies/branches/stations and audited scoped support; cities/routes; fleet/immutable seat maps/drivers; trip scheduling/publication/assignments; opt-in marketplace; atomic guest holds and passenger details; offline station payments/tickets/receipts/refunds; luggage tagging/custody/exceptions/collection; assigned-driver ticket QR checking/boarding/journey events/incidents; scoped Finance/CSV/printing; and platform analytics/notices/current-authority notifications remain implemented. Money rules, tenant-role copies, support permissions and retention policies were not changed. See [Finance](workflows/FINANCIAL_REPORTS.md), [drivers](workflows/DRIVER_BOARDING.md) and [platform](workflows/PLATFORM_ADMINISTRATION.md).

## Schema and API

No Section 15 migration. All fourteen existing migrations are checksum-verified/applied with none pending: **56 application tables, 48 RLS tables, 33 permissions, 93 API paths / 107 operations and 33 public assets**. OpenAPI/package version is 0.16.0. Health gains safe job status and unavailable errors; business contracts and integer minor-unit money fields are unchanged. No dependency was added/upgraded. See [schema](DATABASE_SCHEMA.md), [API contracts](api/CONTRACTS.md) and [decisions](DECISIONS.md).

## Verification evidence

All **138 automated checks passed**: 17 unit/server/tooling and 121 native PostgreSQL checks. The complete release gate passed eight phases in about 6 minutes; its full native phase passed 121/121 in 206 seconds, with no failures/skips. This includes four security checks (eight deliberate tampering cases), four connected workflow/race/clone checks and the existing 20,002-movement finance regression. Fixtures use fictional disposable PostgreSQL databases/restricted roles, never runtime/.

Six Chrome workflows passed **220 responsive language/theme combinations**: source Platform/inbox 32; built Identity 60, Reservations 48, Ticketing 32, Boarding 16 and Platform/inbox 32. These cover real guest holds and lost seats/replies, station payment/refund/printing/counter close, driver QR/journey/revocation, role/password/session recovery, public notice escaping, inbox receipts and Arabic/English dark/light layouts. No recorded product browser errors. Screenshots were reviewed. Build and 24 mandatory-document/link checks across 52 Markdown files passed. All 33 running public assets match build hashes.

Initial registry audit at 2026-11-03T20:56:35.814Z reported zero known advisories for the locked tree; recheck before external release. Initial isolated 5,003-event inbox measured 338/376 ms (Super/restricted). Final full-suite sample: 515/433 ms under concurrent test load. No query rewrite/index/schema change was justified; neither sample is a load/SLA guarantee.

The first release-gate run stopped correctly on historical Identity browser assumptions: six shortcuts/eight roles and the last sidebar link. Tests now verify current authorized controls/role IDs and the explicit passenger-preview link; no product authority was relaxed. Earlier connected fixture status assertions were corrected to the existing confirmed label. Earlier built Ticketing checks timed out during navigation. A separate regression reproduced hop-by-hop header forwarding; the proxy now strips connection-specific fields in both directions and preserves independent socket limits and end-to-end authentication headers. Its twelve-request regression rotates four upstream and three downstream sockets without retries. The initial simulated server was corrected to announce its own close limit. The final full gate passed after these changes; the earlier browser timeouts are not attributed to a proven single cause.

## Recovery and preservation

The connected PostgreSQL clone test compares exact fictional application/ledger row fingerprints, retains ACLs, validates all migration checksums, signs in through the cloned session, retains stable ticket QR and retries a payment idempotently. It closes source sessions before the clone. This is a database-clone test, not a logical export or file/off-site restore. The bundled package lacks pg_dump/pg_restore; trusted matching client tools and an off-site business-data drill remain deployment prerequisites.

Separately, the real private filesystem backup **Safeer-before-Section-15-2026-11-04-8bcdcf0e-ee31-4168-ac17-0635f9202c3c** matched **1551 files** and passed protected restore/start/clean-stop verification with one account and zero companies. Its temporary restore was safely removed; the backup remains under runtime/backups/. Existing account/credentials, private settings/first-login, global role labels and **52 legacy table fingerprints** are unchanged after the update. No account was reset. A successful live sign-in occurred during the gate. The first preservation check stopped before backup/update because audit/session fingerprints changed. Inspection proved one appended login/session, intact old audit rows, and one normal expired-session revocation; all other 50 table fingerprints and private identity settings were unchanged. Retain the original running baseline, capture the stopped-app baseline including that activity, then compare all 52 tables exactly through the update. No session/audit/business records were deleted or repaired. Private-backup retention remains owner-managed.

Source checkpoint: archives/Safeer-0.16.0-Section-15-2026-11-04.zip with SHA-256 sidecar, exact committed source/file hashes and verification receipt. It excludes runtime/users/credentials/dependencies/native caches/test profiles and is not a business-data backup. Preserve runtime/ separately. Install Node 24+, npm.cmd ci if needed, then npm.cmd run local; only a fresh empty database generates private first-login details. See [identity setup/recovery](database/IDENTITY_SETUP.md).

Git changes are committed locally. Pushing the shared branch would also publish the unrelated portfolio history the owner requested to keep local, so no push was made. A push would not itself deploy hosting or install a phone update.

## Remaining release prerequisites

Local preparation is complete; production readiness is not claimed. Before remote customer access: owner-approved HTTPS/host/session/database infrastructure, secrets and off-site backup/rollback drill, monitoring/job supervision/rate and connection limits, representative load objectives, independent security review, physical device/printer/scanner acceptance and legal/financial/retention decisions. Existing open financial questions remain in [Section 10](archive/SECTION_10_TICKETING.md). Flutter, remote notifications, offline/camera scanning, freight and emergency assignment correction remain future scope. Stop at this checkpoint until the owner selects the next phase.

## 2026-11-09 - D61 luggage operations follow-up

The owner selected improvement of the existing Section 11 workflow. Core registration, paid-ticket checks, one-time QR tags/replacement, custody transitions, exceptions and verified collection are implemented, not future prototype work. This follow-up adds fresh-search loading safety, explicit refresh, guidance at the 50-row display bound and a permanent-loss warning for missing-bag resolution. Existing permissions, privacy, refund rules and database schema are unchanged. See [the operational plan](workflows/LUGGAGE_IMPROVEMENT_2026-11-09.md) for responsibilities, acceptance gates and deferred work.

## 2026-11-09 - Mobile continuation (D62)

Claude's 0.16.2 internet-connected apps have been rebuilt, signed and verified in the standalone Safeer repository. Shared mobile menus, headers, login, luggage and release-notice checks passed. Generated download metadata matches saved APKs. See [the continuation handover](archive/MOBILE_CONTINUATION_2026-11-09.md). Release preparation remains private; public repository/release and phone installation require separate action.
