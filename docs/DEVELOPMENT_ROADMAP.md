# Development roadmap

## Operations dashboard and booking homepage - D65, 2026-11-10

The staff workspace adopts the D64 violet-blue glass palette (data-app-surface=staff, operations.css). Inside a company the sidebar lists Overview, Trips, Routes, Bookings, Drivers, Vehicles, Reports, then Operations (Station, Luggage, Shipments) and Settings, each shown only with its permission. Overview (migration 0018, read-only) shows Departures today, Passengers booked, Boarded and Needs attention, the Today's departures table (time, route, vehicle, driver, booked/capacity, boarded/booked, labelled status), a side panel with trip details, boarding progress, passengers and recent scans, and delayed or driver-unassigned trips. Figures come only from valid tickets on confirmed bookings and boarding_records; the dashboard refreshes every 20 seconds while visible. The passenger homepage gets a booking-first hero with the illustrative coach image, a frosted From/To/Travel date/Passengers panel with a blue Find trips button, popular routes from real published city pairs, pickup/drop-off points in results, a Help section, and Book a trip / My tickets / Help / language links on desktop. Tests: tests/operations.integration.mjs (3) and tests/operations.browser.mjs.

## Shipments - D59, 2026-11-09

Delivered: price list, paid drop-off with receipt and tracking code, tags, journey steps, verified hand-over, returns, problems, public tracking, driver list, finance integration and 90-day erasure. Possible follow-ups needing owner decisions: refunds for returned shipments, receiver-pays-on-collection, price per route, SMS notifications.

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

The verified shared UI refresh adds bento tiles and glass controls/headers/sidebar in both themes and languages, including the existing USB Android web clients. No migration, API, company/driver authority, money policy or native package changes. Nine built-browser workflows, 256 layout/language/theme combinations plus the preview, accessibility preferences and actual phone screens are verified. Read [D41 handover](archive/BENTO_GLASS_2026-11-04.md) and [current state](CURRENT_STATE.md); earlier section entries are historical.


## Android USB follow-up - 2026-11-04 (D40)

Add and install separate local-test Safeer Driver/Booking Android WebView apps over the existing shared src/ and loopback API through USB reverse port 4320. All company, driver assignment, session and offline-payment rules remain unchanged; no schema/API authority changes, account seeding, camera/offline queue, Flutter or hosted release. See [USB installation evidence](archive/ANDROID_USB_2026-11-04.md) and [mobile setup](../mobile/README.md). Earlier section entries below are historical.


## Section 15 - 2026-11-04 (D39)

Section 15 is complete and verified locally: 138 automated checks, six browser workflows/220 language-theme-layout combinations and the full release gate passed. A protected private backup/restore and all 52 existing table fingerprints/account settings passed the local update. Stop after the verified Section 15 checkpoint. Deployment and later features require a new instruction. See [security review](security/SECTION_15_REVIEW.md), [release operations](RELEASE_READINESS.md) and [Section 15](archive/SECTION_15_RELEASE.md).


## Section 14 - 2026-11-03 (D38)

Platform administration, local notification inbox and global analytics implemented in 0.15.0. Complete and verified locally: 128 automated checks, 32 source and 32 built platform/inbox layouts plus 16 built driver layouts passed. The 1535-file private backup passed protected restoration; the existing account/settings and 49 legacy tables passed upgrade fingerprints. See CURRENT_STATE and the Section 14 handover. No mobile build or remote service. Section 15 remains gated.


## Section 13 — 2026-11-03 (D37)

Section 13 is complete. Safeer runs locally at 0.14.0 with all thirteen migrations applied. All 118 automated checks passed (15 unit/server and 103 native PostgreSQL), including scoped read-only financial access and a 20,002-movement pagination/export-limit fixture. Source and built Finance browser workflows passed 16 layouts each. The private backup matched 1532 files and passed a protected restore/start/stop check; the existing account, settings and 49 legacy tables passed integrity comparisons. Existing financial rules are unchanged. See [financial reports](workflows/FINANCIAL_REPORTS.md) and [Section 13](archive/SECTION_13_FINANCE.md). Stop before Section 14.

## Historical Section 12 checkpoint — 2026-11-03 (D36)

Section 12 is complete. The local app runs 0.13.0 with all twelve migrations applied and the original account/settings preserved. It adds the owner-approved responsive driver workspace, assigned-trip manifests, printed ticket QRs, separate verification/boarding, journey events and incidents. All 109 automated checks passed (13 unit/server and 96 native PostgreSQL). Source and built driver workflows passed 32 language/theme/viewport combinations; the built station regression passed another 32. The private backup matched 1512 files, passed a protected restore/start/stop check, and the upgraded account/credentials/settings and 45 legacy tables passed integrity comparisons. Flutter remains deferred. See [driver workflow](workflows/DRIVER_BOARDING.md) and [Section 12](archive/SECTION_12_BOARDING.md). Stop before Section 13. Earlier per-section entries retain historical results.

Updated 2026-11-03. Sections 01-12 and the verified local upgrades (D34, D36) are complete. The app runs 0.13.0 with migrations 0001-0012. Historical rows marked "local upgrade open" below are closed by D34. See [CURRENT_STATE.md](CURRENT_STATE.md). D36 completes Section 12 and its verified local upgrade; stop before Section 13.

0.2.1 owner-requested prototype addendum: luggage choice/description in the reservation, passenger list and unpaid reference. It is not completion of Section 09 or 11; station luggage registration, tags, tracking and fees remain in their scheduled sections.

| Section | Scope | Dependencies | Status |
| --- | --- | --- | --- |
| 01 | Project inspection, architecture, database/migration foundation, conventions, documentation/archive | Existing 0.1 prototype | Complete; handover/archive evidence in CURRENT_STATE |
| 02 | Authentication, users, roles, permissions, session lifecycle, authorization/audit foundation | 01 + explicit approval | Complete; tested/documented, verified checkpoint at handover |
| 03 | Companies, branches, stations, company isolation, support-access grants | 02 + explicit approval | Complete; verified local upgrade and source checkpoint |
| 04 | Cities, routes, destinations, ordered route stops | 03 | Complete; tested local upgrade, restore and source checkpoint |
| 05 | Bus fleet, immutable seat-layout versions, drivers | 03-04 | Source complete and verified; private local database upgrade is an open owner step |
| 06 | Trip scheduling, assignments, stops/layout snapshots, publication | 04-05 | Source complete and verified; private local database upgrade is an open owner step |
| 07 | Public marketplace and individual company pages | 03, 06 | Source complete and verified; private local database upgrade is an open owner step |
| 08 | Seat inventory, atomic multi-seat holds, expiry, idempotency, segment-ready allocation | 06-07 | Source complete and verified; private local database upgrade is an open owner step |
| 09 | Guest passenger details, multi-passenger booking, secure retrieval and booking history | 08 | Source complete and verified; private local database upgrade is an open owner step |
| 10 | Station ticketing, payment confirmation, official tickets, receipts, cancellations/refund operations | 02-03, 08-09 | Complete in source; local upgrade open; owner will revisit the money flow |
| 11 | Passenger luggage registration, tagging/QR, tracking, exceptions and collection | 09-10 | Complete and locally upgraded under D34; D61 operational improvement |
| 12 | Local driver client, assigned-trip manifest, QR verification, boarding/departure/arrival | 05-06, 10-11 | Complete and verified locally under D36; Flutter deferred |
| 13 | Company financial reports and read-only cash reconciliation | 10 | Complete and verified locally under D37 |
| 14 | Platform administration, company approval UI, notifications, global analytics | Existing module APIs through 13 | Complete and verified locally under D38; see CURRENT_STATE |
| 15 | Security audit, integration/concurrency/recovery tests, optimization and production preparation | All preceding sections | Complete and verified locally under D39; remote release prerequisites remain explicit |

## Resolving dependencies without breaking the order

Section 03 must include company approval state and protected service boundaries needed by the marketplace; Section 14 supplies the complete platform dashboard/reporting experience. Section 02 supplies permission/audit primitives used by every later module, not a platform dashboard. Section 10 includes the minimum cash-session/reconciliation controls necessary for valid station payments; Section 13 completes financial reporting and company-level reconciliation. These are explicitly owned prerequisites, not permission to build later sections early.

Within Section 02, scaffold the selected NestJS/TypeScript backend, connect the migration foundation and implement only identity/access infrastructure. Next.js shells and real company pages are introduced as needed by their owning sections; Flutter is introduced with the passenger/driver client sections. Module designs exist before their executable business tables.

## Per-section acceptance gate

- Requirements and public/private contracts recorded; migrations reviewed and tested on disposable PostgreSQL.
- Normal, invalid, unauthorized and cross-company workflows tested for the code actually implemented.
- Constraints, concurrent requests, retries, failure recovery and temporal boundaries tested when applicable.
- Existing passenger functionality and Arabic/English desktop/mobile layout checked after UI changes.
- No critical/high-priority defects in the completed scope; limitations described without hiding failures.
- Relevant mandatory docs, changelog, module notes and numbered archive entry updated.
- Source checkpoint/archive checksum verified; no secrets, runtime databases or credentials committed.
- Explicit owner approval before Section 10 and later sections; never cross an incomplete gate.

## Known gaps, not completed features

The staff interface now has real local PostgreSQL authentication and platform authorization. Company memberships/tenant security now run on the server and database. Durable bookings, actual guest-mobile validation, multi-seat transactions, payment/ticket/luggage/boarding APIs and native apps remain scheduled work. The separate passenger demo still resets on refresh and never inherits company access from a staff role.


## 0.3.1 - Super Administrator role editing

Owner-authorized D20 follow-up: Super Administrators can edit names, permissions and status of all eight built-in role templates and custom platform roles. Reserved owner codes/scopes remain immutable, owner authority always includes the permission catalog, and disabling the last active owner is rejected atomically. Other administrators remain restricted. Company/resource assignment remains deferred to Section 03; no schema migration or company access is added. The role editor supports Arabic/English and mobile layouts.


## 0.3.2 - Connected workspace layout

Completed the D21 layout follow-up for existing Section 02 screens and the passenger demonstration. Section 03 company membership and real business integration remain deferred; navigation does not grant company access.


## 0.3.3 - Skeuomorphic styling (2026-10-31)

Completed D22 tactile styling for the existing local interface. This visual update does not begin Section 03 or add business modules.


## 0.3.4 - Dark mode (2026-10-31)

Completed the owner-requested D23 dark-mode follow-up. Both themes retain Section 02 staff workflows and the fictional passenger preview; Section 03 remains deferred.

## 2026-11-09 - D61 luggage operations follow-up

The owner selected improvement of the existing Section 11 workflow. Core registration, paid-ticket checks, one-time QR tags/replacement, custody transitions, exceptions and verified collection are implemented, not future prototype work. This follow-up adds fresh-search loading safety, explicit refresh, guidance at the 50-row display bound and a permanent-loss warning for missing-bag resolution. Existing permissions, privacy, refund rules and database schema are unchanged. See [the operational plan](workflows/LUGGAGE_IMPROVEMENT_2026-11-09.md) for responsibilities, acceptance gates and deferred work.

## 2026-11-09 - Mobile menus and update (D63)

D63 mobile-menu follow-up: separate app identity, descriptive navigation, grouped account actions, compact settings, 44px targets, responsive landscape coverage and new signed update artifacts are implemented and verified. See [the release handover](archive/MOBILE_MENUS_0.16.3_2026-11-09.md).

## 2026-11-10 - My Trips glass redesign (D64)

D64 adds My Trips, guest Profile/settings, passenger-count search intent, itinerary/ticket presentation and exact app colors. It builds on the separately committed D59 shipments without rewriting that migration or its workflows. Deployment and download evidence are tracked separately from source checks. See [the design/release handover](archive/MY_TRIPS_GLASS_0.17.0_2026-11-10.md).
