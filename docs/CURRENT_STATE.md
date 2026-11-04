# Current state - read this first

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
