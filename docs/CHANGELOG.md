# Changelog

## Whole-workflow and production audit fixes - D72, 2026-11-12

Per-visitor public booking limits behind the proxy and Cloudflare; Android tel:/mailto: links (Booking 0.17.3/17003, Driver 0.18.4/18004); installed-app Google sign-in guidance; named company time zones only; calendar-checked operations day; Trips "Show trips from" with an incomplete-list notice; walk-in sale travel date (migration 0022 counter_trips); newest-only shipment tracking; aligned travel notice. New tests: workflow, production start, audit fixes, installed-app account, Android navigation policy, visitor address; time-of-day-proof operations fixtures; npm run check:live. See [the audit](testing/QUALITY_AUDIT_2026-11-12.md).

## Official brand palette and Route Pin logo - D71, 2026-11-11

Navy/sky/orange palette across all web surfaces and the Android shell; new src/brand.svg and Android ic_safeer vector; recoloured src/coach-journey.jpg; Booking 0.17.2/17002 and Driver 0.18.3/18003.

## Passenger Google sign-in - D70 (D68 step 2), 2026-11-11

New API under /api/v1/passenger (google/start, google/callback, me, logout, profile, trips, bookings, bookings/:reference, account) in apps/api/src/passenger.service.ts. Website Profile gains Google sign-in, account details and booking sync (src/passenger-account.js); checkout pre-fills from the profile. No migration. Test: npm run test:passenger-google.

## Route stations and staff details - D69, 2026-11-11

Migration 0021_member_contact.sql adds optional company_users.phone and job_title. Route stop station choices follow the chosen city with a clear ROUTE_STATION_CITY error; working company roles always include company.profile.read. The routes browser test selector is updated for the D65 company sidebar. Verified by tests/staff-details.integration.mjs, routes/companies browser workflows and database integration.


## Driver light/dark correction - 2026-11-10

The Driver dashboard used fixed light colors despite the selected theme. Driver-specific surfaces now follow light/dark tokens with contrast/persistence tests. Driver release 0.18.1/18001 keeps Booking at 0.17.0/17000. See [theme correction handover](archive/DRIVER_THEME_FIX_2026-11-10.md).

## Passenger accounts database - D68 step 1, 2026-11-10

Migration 0020_passenger_accounts.sql adds optional passenger accounts behind reviewed functions only. No website, API or app behaviour changes yet; guest booking is unchanged. Verified by tests/passenger-accounts.integration.mjs and the database/security integration suites.

## Driver update discovery - D67, 2026-11-10

Driver update metadata is refreshed without a page/form/camera rerender, and its menu always exposes a download link plus Check for updates. Existing APK versions remain unchanged. See [D67 handover](archive/DRIVER_UPDATE_DISCOVERY_2026-11-10.md) for root cause, one-time old-client recovery and verification.

## Driver Trip Dashboard - D66, 2026-11-10

Driver 0.18.0: frosted route dashboard, authoritative boarding progress, one-tap QR camera, optional torch, printed-code fallback, clear scan results and safe retries. Passenger search by name/seat/booking reference, All/Waiting/Boarded filters and small-phone cards. Independent Driver-only signed update; Booking APK unchanged. See [D66 handover](archive/DRIVER_TRIP_DASHBOARD_0.18.0_2026-11-10.md).

## Operations dashboard and booking homepage - D65, 2026-11-10

The staff workspace adopts the D64 violet-blue glass palette (data-app-surface=staff, operations.css). Inside a company the sidebar lists Overview, Trips, Routes, Bookings, Drivers, Vehicles, Reports, then Operations (Station, Luggage, Shipments) and Settings, each shown only with its permission. Overview (migration 0018, read-only) shows Departures today, Passengers booked, Boarded and Needs attention, the Today's departures table (time, route, vehicle, driver, booked/capacity, boarded/booked, labelled status), a side panel with trip details, boarding progress, passengers and recent scans, and delayed or driver-unassigned trips. Figures come only from valid tickets on confirmed bookings and boarding_records; the dashboard refreshes every 20 seconds while visible. The passenger homepage gets a booking-first hero with the illustrative coach image, a frosted From/To/Travel date/Passengers panel with a blue Find trips button, popular routes from real published city pairs, pickup/drop-off points in results, a Help section, and Book a trip / My tickets / Help / language links on desktop. Tests: tests/operations.integration.mjs (3) and tests/operations.browser.mjs.

## Shipments - D59, 2026-11-09

Shipments (D59, migration 0016): parcels sent without a traveler. Companies set one fixed price per item type (envelope, small parcel, large parcel, other); the sender pays at drop-off into the operator's open cash session and gets a receipt with a random public tracking code (SH-XXXXXXXX). Staff tag the parcel (QR shown once), load it on a published trip, mark it in transit after departure and arrived, and hand it over only when the receiver's phone number and name match. Problems block moves and hand-over until resolved; a missing parcel settled or closed becomes Lost. Before loading it can be returned to the sender without an in-app refund. Adds the staff Shipments section, the public /track page, a Track a shipment item in the Booking menu, the driver's shipment list, privacy policy wording, tests/shipments.integration.mjs (7) and tests/shipments.browser.mjs.

## Online app download - D60, 2026-11-09

Website Download/Get-the-app/Update notices driven by generated src/app-release.js; the app identifies its version in the user agent and opens only Safeer GitHub release links externally.

## Full-screen apps, phone menu and sign-in - D58, 2026-11-09

Android draws into the display cutout and shares --safe-top with the page. Phone Staff/preview navigation becomes an off-canvas modal panel with backdrop, Escape/Back closing and focus return; desktop behaviour is unchanged. Sign-in pages share a professional card with a show-password control. Sidebar browser checks now cover phone open/close, inert background, focus, translation and form preservation.

## Website-connected apps and drawer - D57, 2026-11-09

Android Driver and Booking default to the signed website channel (0.16.1/16100) with automatic reconnect, same-page retry, state restore and ETag asset revalidation. The phone drawers gain an identity header, labelled menu, signed-in driver card, current-page indicator, pinned Settings/footer with version, and a slide-in that respects reduced motion. Menu browser tests finish that animation before measuring; a server test covers 304 revalidation and no-store pages.

## Audit remediation - D56, 2026-11-09

The audit source fixes preserve newest-search ordering and unfinished search fields, restore the above-sidebar toggle with immediate keyboard state and clipped animation overflow, publish the owner-approved support contact, and permit a bounded 64 KiB payload only for creating public group bookings (other endpoints remain 8 KiB). The Android error screen distinguishes hosted HTTPS from USB; local patch .6/16006 is built/linted/saved. Hosted owner recovery now supports a non-superuser migration owner with explicit confirmation, duplicate-email rollback, session revocation and audit. Complete browser release gating and PostgreSQL 16 CI are added. No schema, financial policy, role grants or real account credentials are changed. See [D56 handover](archive/AUDIT_REMEDIATION_2026-11-09.md) for measured results and outstanding deployment/device verification.


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


## Sticky liquid-glass headers - 2026-11-04 (D43)

D43 keeps staff, Driver, Booking/marketplace and preview headers at the viewport top on scroll, using Apple-inspired layered glass within the black/brown palette. Actual header height protects scrolled form fields; no schema/API, business, account or native package change. Targeted scrolling (64 combinations) and Identity/modal (60) checks pass. See [header evidence](archive/STICKY_HEADERS_2026-11-04.md); earlier entries are historical.


## Black and brown - 2026-11-04 (D42)

D42 changes the current visual palette to black/espresso and brown, with cream/brown light mode, retaining the bento/glass layout, language support, business rules and schema/API. Matching Android shell/icon patches 0.16.0-usb.2 are installed locally. Targeted browser/build/native evidence and limitations are in [the palette handover](archive/BLACK_BROWN_2026-11-04.md). Earlier entries are historical.


## Bento grid and liquid glass - 2026-11-04 (D41)

Refresh the shared tokens and theme for staff, company, finance, platform, Driver, Booking/marketplace and the fictional preview with bento tiles, glass controls, a floating top bar and a dark-glass sidebar in both themes. Fix review findings: primary emphasis, sidebar current page and light-mode legibility, held-seat contrast, preview seat states and key, driver header and staff top bar alignment, and the missing Cities & destinations description. Update the marketplace layout test to the tile layout. No schema, API, permission, money or native package change. See [D41 handover](archive/BENTO_GLASS_2026-11-04.md).

## Android USB follow-up - 2026-11-04 (D40)

Add and install separate local-test Safeer Driver/Booking Android WebView apps over the existing shared src/ and loopback API through USB reverse port 4320. All company, driver assignment, session and offline-payment rules remain unchanged; no schema/API authority changes, account seeding, camera/offline queue, Flutter or hosted release. See [USB installation evidence](archive/ANDROID_USB_2026-11-04.md) and [mobile setup](../mobile/README.md). Earlier section entries below are historical.


## Section 15 - 2026-11-04 (D39)

Version 0.16.0, Section 15 (D39): fail-closed full schema/grant/function startup checks; safe maintenance health and retry/overlap/shutdown handling; bounded HTTP/header/socket settings, denied unused device permissions and removed Express fingerprint; security and connected race/clone consistency regressions; executable offline release verification and local/remote preparation guide. No new dependency, migration, account/role/money policy or hosted/native release. See [security review](security/SECTION_15_REVIEW.md), [release operations](RELEASE_READINESS.md) and [Section 15](archive/SECTION_15_RELEASE.md).

Correct connection-specific proxy header forwarding in both directions. Regression coverage verifies independent client/API socket rotation while preserving cookie/Origin/CSRF headers, without automatic mutation retries. Refresh historical Identity browser assertions for current navigation and role catalog; retain paid-booking failure diagnostics.


## 0.15.0 - 2026-11-03 - Section 14 (D38)

Add Super Administrator platform overview/global collection reporting, company/user/role/audit navigation, bilingual public notice and scoped in-app notifications with idempotent read receipts. Append migration 0014 with three RLS tables, fixed least-privilege functions, transactional capture and posting indexes. Add Arabic/English shared responsive screens and driver inbox link. Correct desktop filter specificity and UTC snapshot formatting after visual review. Existing money rules, tenant-role copies and accounts remain unchanged. Final evidence is recorded in [current state](CURRENT_STATE.md) and [Section 14](archive/SECTION_14_PLATFORM.md). Stop before Section 15.


## 0.14.0 — 2026-11-03 — Section 13 (D37)

Section 13 is complete. Safeer runs locally at 0.14.0 with all thirteen migrations applied. All 118 automated checks passed (15 unit/server and 103 native PostgreSQL), including scoped read-only financial access and a 20,002-movement pagination/export-limit fixture. Source and built Finance browser workflows passed 16 layouts each. The private backup matched 1532 files and passed a protected restore/start/stop check; the existing account, settings and 49 legacy tables passed integrity comparisons. Existing financial rules are unchanged. See [financial reports](workflows/FINANCIAL_REPORTS.md) and [Section 13](archive/SECTION_13_FINANCE.md). Stop before Section 14.

## 0.13.0 — 2026-11-03 — Section 12 (D36)

Section 12 is complete. The local app runs 0.13.0 with all twelve migrations applied and the original account/settings preserved. It adds the owner-approved responsive driver workspace, assigned-trip manifests, printed ticket QRs, separate verification/boarding, journey events and incidents. All 109 automated checks passed (13 unit/server and 96 native PostgreSQL). Source and built driver workflows passed 32 language/theme/viewport combinations; the built station regression passed another 32. The private backup matched 1512 files, passed a protected restore/start/stop check, and the upgraded account/credentials/settings and 45 legacy tables passed integrity comparisons. Flutter remains deferred. See [driver workflow](workflows/DRIVER_BOARDING.md) and [Section 12](archive/SECTION_12_BOARDING.md). Stop before Section 13. Earlier per-section entries retain historical results.

## 0.12.0 - 2026-11-02 - Verified local upgrade (D34)

Complete the owner-approved 0.5.0 to 0.12.0 local update. A private physical backup matched 1378 files and passed a separate restore/start/stop check. Apply migrations 0005-0011; preserve the existing account, credentials/settings, role labels and 18 legacy tables. Harden database/backup-local.mjs against linked paths, unprotected restore copies, port collisions and cleanup after failed stops. Refresh continuation documentation and API summary metadata. Re-run 13 unit/server tests, build and documentation checks; local health, migration checksums and data fingerprints pass. No business policy, UI, native app or hosting change; Section 12 remains gated.

## 0.12.0 - 2026-11-02 - SECTION 11

Add a luggage declaration per traveler, bag registration on paid tickets with weight and no fees, QR tags, one-step tracking, problem reports with a separate resolve permission, collection checked against the ticket or mobile number, and a refund block while bags are with the company. Add migration 0011 and 8 paths. 102 automated checks and source/built browser suites passed. The private local database upgrade is an open owner step.

## 0.11.0 - 2026-11-02 - SECTION 10

Add station counters and cash sessions, full payment by cash, bank transfer or mobile wallet, walk-in sales, official tickets and receipts, full refunds until departure and on canceled trips, late payment by a separate permission, and marked reprints. Add migration 0010 and 11 paths. 96 automated checks and source/built browser suites passed. The private local database upgrade is an open owner step.

## 0.10.0 - 2026-11-02 - SECTION 09

Add passenger names and mobile numbers with each hold, retrieval by reference and mobile, staff booking search, correction and history, and automatic erasure 90 days after the trip. Add migration 0009 and 4 paths. 87 automated checks and source/built browser suites passed. The private local database upgrade is an open owner step.

## 0.9.0 - 2026-11-02 - SECTION 08

Add temporary seat holds: live seat maps, all-or-none holds of 1-10 seats with references and countdowns, automatic expiry, passenger and staff release, and availability in search. Add migration 0008 and 6 routes. 81 automated checks and source/built browser suites passed. The private local database upgrade is an open owner step.

## 0.8.1 - 2026-11-02 - Marketplace layout (D29)

Rebuild the marketplace and company page layouts with a title band, ticket-style trip cards and a company sidebar. Fix unstyled links and the booking badge. No data, API or permission changes.

## 0.8.0 - 2026-11-02 - SECTION 07

Add the public marketplace with search and sorting, company pages and a company-managed public profile. Add migration 0007, anonymous read-only projections and 4 public routes. 73 automated checks and source/built browser suites passed. The private local database upgrade is an open owner step.

## 0.7.0 - 2026-11-02 - SECTION 06

Add draft trips from routes, repeated scheduling, stop times, fares, bus and driver assignment with history, publication and cancellation. Add migration 0006, trip service and controller, 3 RLS tables, database-filled snapshots, overlap protection and 2 template permissions. 68 automated checks and source/built browser suites passed. The private local database upgrade is an open owner step.

## 0.6.0 - 2026-11-02 - SECTION 05

Add company-private seat layouts with immutable revisions, a visual seat-map editor, buses and driver records. Add migration 0005, fleet service and controller, 5 RLS tables, sealed revisions, capacity guards, 4 template permissions and database/backup-local.mjs. 60 automated checks and source/built browser suites passed. The private local database upgrade is an open owner step.

## 0.5.0 - 2026-11-02 - SECTION 04

Add bilingual cities, company routes/destinations and ordered stops; station-city assignment; route details, reorder controls and inline validation. Add migration 0004, route service/controllers, 3 RLS tables, composite city/station FKs, deferred route checks, protected active resources, new-company template grants and audit. Preserve existing tenant copies and station identities. Preserve disabled reorder controls after failed form validation. Updated contracts, permissions, startup checks, versions, tests and continuation/workflow/archive documentation. Final verification and local upgrade receipts are recorded in CURRENT_STATE. No files removed; stop before Section 05.


## 0.4.0 - 2026-10-31 - SECTION 03

Added real local company approval/settings, branches/stations, tenant role copies, multi-scope staff memberships, temporary staff onboarding, expiring read-only support grants and company audit. Integrated Companies screens with bilingual dark/light staff navigation. Added same-company FKs, eleven-table RLS, raw-session-derived policies, grant ceilings, immutable ownership, startup RLS checks, local capacity guards and atomic last-company-admin protection. Preserves identity rows and existing passwords/sessions during upgrade. Passenger bookings/payments remain fictional or deferred; stop before Section 04.


## 0.3.1 - Super Administrator role editing

Owner-authorized D20 follow-up: Super Administrators can edit names, permissions and status of all eight built-in role templates and custom platform roles. Reserved owner codes/scopes remain immutable, owner authority always includes the permission catalog, and disabling the last active owner is rejected atomically. Other administrators remain restricted. Company/resource assignment remains deferred to Section 03; no schema migration or company access is added. The role editor supports Arabic/English and mobile layouts.

## 0.3.0 - 2026-10-30 - SECTION 02 identity

- Owner explicitly approved Section 02. Add pinned NestJS 12.3.2/TypeScript 6.0.3 identity backend, strict compilation and PostgreSQL identity repositories; no unrelated project changes.
- Add migration 0002_identity: users/sessions, eight role templates, six implemented permissions, platform assignments, credential-free append-only audit and persistent authentication limits. Keep migration 0001 checksum unchanged.
- Add limited-runtime grants/startup rejection of elevated/owner/membership database connections, one-time generated bootstrap, privileged audited owner recovery and access-restricted persistent Windows local launcher.
- Add /staff sign-in/profile/password/sessions, user creation/edit/disable/reset/platform assignments, role creation/edit and recent audit UI. Include Arabic/English, mobile layouts, one-time secret handling and plain-text output escaping.
- Use bounded salted scrypt, opaque hashed sessions, idle/absolute expiry, password/session rotation, exact Origin/HMAC CSRF, reauthentication, optimistic versions, live permissions and transaction-locked last-owner protection.
- Preserve the public fictional passenger/luggage prototype; add a staff link and same-origin API proxy. No company/business API, remote HTTPS, MFA or native mobile authentication is added.
- Add native API/security/browser regressions, complete implemented OpenAPI contract, identity setup/recovery/test guide and mandatory continuation/section archive records.
- Findings fixed: old migration tests assumed one migration; role editors load asynchronously; account switching retained the previous tab; refreshed tabs/expired forms now clear stale state and secrets safely.
- Verification: 13 unit/security tests, 19 native migration/identity tests, source/built staff and passenger browser workflows, strict build, 11 required docs/24 Markdown files, offline lockfile reproduction, zero known runtime dependency advisories and two persistent local restarts passed. Exact commit and ZIP hashes are recorded in the checkpoint manifest.

## 0.2.1 - 2026-10-30 - owner-requested luggage declaration

- Added a luggage yes/no choice and conditional required description (1-300 trimmed characters) to the existing passenger prototype.
- Show the declaration/description beneath each passenger and on the printable unpaid reference, with Arabic/English labels and escaped plain-text output.
- Retain drafts during seat/trip/language changes; clear them on no, successful reservation and company switch.
- Added domain regression for invalid inputs/no seat allocation, length boundary, historical default and company scoping; expanded browser checks for form validation, draft/reset, no-luggage, escaping/print and Arabic/mobile layouts.
- Updated shared mobile notes, schema design/business rules and continuation documentation. Package and liveness contract version are 0.2.1.
- Verification: nine unit/integration tests, eight-asset build, source/built browser checks and documentation checks passed. No SQL change; prior seven native database tests remain historical Section 01 evidence.
- No station luggage record, tags, fees, tracking, native build or business API was added. Section 02 still requires explicit approval.

## 0.2.0 - 2026-10-30 - SECTION 01 foundation

### Added

- Complete master-plan source, decision ledger, project master, exact 15-section roadmap, current-state tracker, business rules, system/database architecture and archive template.
- Architecture/inspection/folder, database migration, API, module, security, workflow, testing and section-archive documentation categories.
- config/assets.mjs, src/i18n.js, src/tokens.css and the implemented health OpenAPI contract.
- database/migrate.mjs, database/migrations/0001_foundation.sql, scripts/build.mjs and documentation checker.
- PostgreSQL migration unit/native integration tests and self-contained Safeer browser helper/regression suite.
- Ignored verified pre-change source archive and final Section 01 checkpoint workflow.

### Modified

- AGENTS.md and README/BASICS now follow the new passenger-only release/section gate.
- Package/lock: 0.2.0, pinned pg client for migration tooling and explicit build/database/browser/doc commands.
- Local server: shared allowlist, built-asset mode and prototype liveness endpoint. No business write API added.
- Passenger UI/demo/rules: preserve existing examples, replace obsolete freight scope copy, extract translations/tokens, require cancellation confirmation and restart expiry after page restoration.
- Domain/server tests, mobile/UPDATES.md, ignored build configuration.

### Removed

- Active freight form/navigation, request handler/domain rule, cargo fixtures, freight-specific copy/styles and freight test. Original code remains recoverable in f06a638 and the verified 0.1.0 archive. No real data was removed.

### Verification and fixes

- Six original tests passed before editing.
- Native PostgreSQL 18.4: seven foundation integration tests passed; temporary databases/cluster cleaned/stopped.
- Added a regression check for runtime-derived Arabic city/status translations after extraction and restored localized route/reference values.
- Fixed the prototype timer's page-hide/page-show lifecycle; regression check added. The temporary Windows QA launcher initially waited on inherited pg_ctl pipes; fixed test process handling and explicitly stopped that QA cluster before rerun. This is not a production backend change.
- Final checks: 8 unit/integration tests passed; 7 native database tests passed; source and built browser suites passed; 8 assets built; 16 JavaScript files parsed; 10 required documents/local links checked across 21 Markdown files; dependency audit reported zero known advisories. Source archive integrity is verified at checkpoint creation.

### Remaining limitations

This is still a local fictional-data prototype plus verified migration/architecture tooling. Authentication, real company isolation, durable bookings, actual guest/mobile/multi-seat rules, money/ticket/luggage/boarding workflows, target framework applications and production deployment are not implemented. Section 02 requires explicit approval.

## 0.1.0 - 2026-10-28 - exploratory prototype

Added independent Safeer local passenger/freight demonstration, company-specific example hold policies, Arabic/English layout, unpaid reservation print view, cargo request example and six tests. No database/accounts/real payments. Its mixed freight scope is superseded by the 2026-10-30 master plan.


## 0.3.2 - Connected workspace layout

Simplified the responsive staff shell and account overview; added permission-aware shortcuts, user-role links, current-page search, role scope filters and result counts. Unified passenger styling, replaced outdated no-sign-in copy and freight-related journey text, and preserved language across staff/passenger links. No backend authorization or schema change.


## 0.3.3 - Skeuomorphic styling (2026-10-31)

Applied restrained skeuomorphism using shared CSS materials, tactile enamel buttons, recessed fields, warm paper panels, brass navigation accents, padded seat controls and ticket/reference styling. Preserved focus indicators, selected/disabled states and print output. No new dependencies, schema or authorization changes.


## 0.3.4 - Dark mode (2026-10-31)

Added shared default dark theme, bilingual light/dark controls, validated persistent preferences, cross-window synchronization and storage-blocked fallback. Toggling preserves form drafts/focus. Styled seats, statuses, tables and dialogs; retained clean white-paper printing. No dependencies or database changes.

## 2026-11-09 - D61 luggage operations follow-up

The owner selected improvement of the existing Section 11 workflow. Core registration, paid-ticket checks, one-time QR tags/replacement, custody transitions, exceptions and verified collection are implemented, not future prototype work. This follow-up adds fresh-search loading safety, explicit refresh, guidance at the 50-row display bound and a permanent-loss warning for missing-bag resolution. Existing permissions, privacy, refund rules and database schema are unchanged. See [the operational plan](workflows/LUGGAGE_IMPROVEMENT_2026-11-09.md) for responsibilities, acceptance gates and deferred work.

## 2026-11-09 - Mobile continuation (D62)

Claude's 0.16.2 internet-connected apps have been rebuilt, signed and verified in the standalone Safeer repository. Shared mobile menus, headers, login, luggage and release-notice checks passed. Generated download metadata matches saved APKs. See [the continuation handover](archive/MOBILE_CONTINUATION_2026-11-09.md). Release preparation remains private; public repository/release and phone installation require separate action.

## 2026-11-09 - Mobile menus and update (D63)

D63: modern distinct app menus, navigation descriptions, clearer active states, separated Driver account actions, two-column settings, support link, 44px controls and locked background scrolling. Fixed translated-header measurement timing. Signed 0.16.3 update metadata and public release publication are owner-approved. See [the release handover](archive/MOBILE_MENUS_0.16.3_2026-11-09.md).

## 2026-11-10 - My Trips glass redesign (D64)

D64: glass My Trips with Upcoming/Past, next reservation/photo card, journey timeline, paid-ticket/seat/QR view, Book/Trips/Profile navigation, guest preferences, passenger-count selection and matching Driver palette. Fixed ticket anchors causing unnecessary reloads and passenger-count links briefly retaining old intent. Added exact schedule and protected QR projection; signed Android 0.17.0/17000. See [the design/release handover](archive/MY_TRIPS_GLASS_0.17.0_2026-11-10.md).
