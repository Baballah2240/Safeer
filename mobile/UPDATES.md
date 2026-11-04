# Safeer mobile status

## 0.16.0-usb.1 - 2026-11-04, D40

Add separate Safeer Driver and Safeer Booking Android local-test WebView packages, opening the existing shared /driver and /marketplace application over USB reverse port 4320. Preserve all server authentication, company/assignment and money rules. Include guarded navigation/resources, private app storage/backup exclusions, disconnected Retry, system insets, accessible Home/Refresh/Print and native print handoff. No JS bridge, camera permission, offline queue or hosting. Both debug APKs build/lint and install with verified versions on the authorized LGN-NX1/API 36 phone; Driver sign-in, Booking lookup/marketplace and USB disconnect/retry are checked. APKs, SHA-256 sidecars and build manifest stay ignored in mobile/releases/. See [mobile setup](README.md). Physical printing and full assigned-trip/booking operations on a phone remain staff acceptance work; no fictional data was seeded into the real installation.

## 0.16.0 - 2026-11-04, Section 15

Shared API health adds safe expiry/retention worker state and last success. Startup verifies the complete reviewed database privilege policy; HTTP limits and denied unused device permissions apply to responsive clients too. Existing keyboard/paste scanner workflows, company/driver scope and UI remain unchanged. No native build, phone update or remote connection was created. Final source/built browser verification is recorded in docs/CURRENT_STATE.md.


## 0.15.0 - 2026-11-03, Section 14

Shared responsive src/ adds the Super Administrator dashboard, bilingual service notice and permission-scoped notification inbox. Drivers can open their inbox from /driver using the same local account. Current authority is checked server-side on every request. Arabic/English and both themes support desktop/mobile widths. No Flutter/native package, phone installation, external delivery or remote connectivity is included. See docs/CURRENT_STATE.md for final test and local-upgrade evidence.


## 0.14.0 — 2026-11-03, Section 13 Finance

Add the shared responsive Finance section under Companies for scoped sales/refunds, currency/method/day/staff/station/trip breakdowns, cash-session reconciliation, CSV export and current-page print. Server checks current station/branch authority on every request. Existing money controls remain unchanged. Verification and local runtime upgrade are recorded in docs/CURRENT_STATE.md. No native app/build or remote access is included.

## 0.13.0 - 2026-11-03, Section 12 driver workspace

Add the shared responsive Arabic/English driver workspace at /driver: assigned trips, minimal manifest, QR ticket checking and boarding, departure/arrival and incident reports. Driver authority is checked against current membership/assignment on every request. Station ticket prints now include stable QR codes. Source/built browser verification and the local upgrade are recorded in docs/CURRENT_STATE.md. The owner chose local web first; no Flutter app, native build or phone installation is included.

## 0.12.0 - 2026-11-02, local upgrade handover

The existing local web runtime now serves the verified responsive Sections 05-11 from 0.12.0 with the original account preserved. API summary metadata now reflects these implemented modules. No mobile UI behavior changed in this maintenance handover; no native app was built or installed, and no external hosting was enabled.

## 0.4.0 - 2026-10-31, Section 03 company access

Shared responsive staff screens now include real companies, approval/settings, branches/stations, scoped employees/roles, support grants and audit. Single-company employees open only their assigned workspace without a selector. Server and database enforce scope; changing a UI company ID grants nothing. Arabic/English, dark/light themes and existing passenger/luggage UI remain available. No native mobile build or installation was requested.

## 0.3.0 - 2026-10-30, Section 02 local identity

- Add a responsive Arabic/English staff sign-in and identity administration interface, separate from the fictional passenger/luggage example.
- Real PostgreSQL identities, temporary-password change, revocable cookie sessions, platform users/roles/permissions and identity audit are enforced by the NestJS API. No permission is granted by a client company selector.
- Seed all eight role templates; company/resource assignments are unavailable until Section 03 membership/scope enforcement exists. Support defaults to identity user/role read only.
- Web clients use same-origin HttpOnly cookies and CSRF; no session token is stored in local storage. Native Flutter apps and secure mobile bearer/keychain handling are not implemented or built in this section.

## 0.2.1 - 2026-10-30, luggage declaration

- The shared responsive reservation form asks whether the passenger has luggage and requires a description when yes (maximum 300 trimmed characters).
- Declaration and description appear with the passenger and on the printable unpaid reference in Arabic/English. Drafts survive seat/language changes, clear when switched to no, and reset after reservation or company change.
- This remains a browser-memory prototype, without luggage tags/tracking/fees or a native app build.

## 0.2.0 - 2026-10-30, Section 01

- Release 1 now covers passenger transport and linked passenger luggage; freight is archived/deferred.
- Passenger prototype layout, Arabic/English copy and shared visual tokens are retained. Guest full-name/mobile and multi-seat booking are documented future requirements, not implemented mobile features.
- The target passenger/driver apps are Flutter clients of versioned APIs. Shared contracts/design assets stay in the repository; Flutter will use Dart models, not execute the existing JavaScript UI.
- No Flutter project, native build, accounts or production reservation API was created in Section 01.

## 0.1.0 - local foundation

- Passenger seat reservation, demo freight requests and company-specific reservation deadlines are explored in a responsive browser prototype.
- Web and future mobile-facing code live together in `src/`.
- No Android/iOS project, native app, installable APK, app-store release, OTP service or real staff/passenger authentication exists yet.
- All data is fictional, kept in the browser's memory and reset on refresh. Do not use real customer information.


## 0.3.1 - Super Administrator role editing

Owner-authorized D20 follow-up: Super Administrators can edit names, permissions and status of all eight built-in role templates and custom platform roles. Reserved owner codes/scopes remain immutable, owner authority always includes the permission catalog, and disabling the last active owner is rejected atomically. Other administrators remain restricted. Company/resource assignment remains deferred to Section 03; no schema migration or company access is added. The role editor supports Arabic/English and mobile layouts.


## 0.3.2 - Connected workspace layout

Responsive staff navigation, account overview, shortcuts, role labels, search and scope filters are available in the shared web code. Arabic RTL and English links preserve language when switching between staff and passenger views. No native mobile package or installation was requested.


## 0.3.3 - Skeuomorphic styling (2026-10-31)

Shared responsive web screens receive the skeuomorphic theme: tactile buttons, inset fields, paper panels and seat controls. Arabic RTL, touch controls and existing navigation remain available. No native mobile package was requested.


## 0.3.4 - Dark mode (2026-10-31)

Shared web/mobile-facing staff and passenger screens default to dark mode. Header controls switch to light mode and remember the preference. Arabic/English labels, touch layouts and drafts are preserved. No native mobile binary or installation was requested.

## 2026-11-02 - Section 04 route planning

Add bilingual responsive city catalog, station-city assignment and company route/stop editing to shared src/. Preserve dark/light styling, keyboard/touch reordering and company permissions. No native app build or deployment requested. Verification receipts accompany the Section 04 source checkpoint.

Section 04 verification: 52 automated checks, source/built route screens (48 layouts per mode), company/identity regressions and private local upgrade/restore passed. No native build or deployment.

## 2026-11-02 - Section 05 fleet

Add bilingual responsive seat-map editing and viewing, bus and driver records to shared src/. Preserve dark/light styling and company permissions. Seat maps scroll inside themselves on phones. No native app build or deployment requested. Verification: 60 automated checks and 64 fleet layouts per source/built mode.

## 2026-11-02 - Section 06 trips

Add bilingual responsive trip scheduling, assignment, publication and cancellation to shared src/. Preserve dark/light styling and company permissions. No native app build or deployment requested. Verification: 68 automated checks and 48 trip layouts per source/built mode.

## 2026-11-02 - Section 07 marketplace

Add responsive bilingual public marketplace and company pages, plus the company Public page editor, to shared src/. No native app build or deployment requested. Verification: 73 automated checks and 32 public layouts per source/built mode.

## 2026-11-02 - Marketplace layout (D29)

Improve the responsive public marketplace and company page layouts in shared src/, including compact trip cards at phone widths. No native app build or deployment requested.

## 2026-11-02 - Section 08 seat holds

Add responsive bilingual seat maps, hold pages with a countdown, and the staff seat view to shared src/. No native app build or deployment requested. Verification: 81 automated checks and 32 layouts per source/built mode.

## 2026-11-02 - Section 09 passenger details

Add responsive bilingual passenger forms, the My booking retrieval page and the staff Bookings section to shared src/. No native app build or deployment requested. Verification: 87 automated checks and 48 layouts per source/built mode.

## 2026-11-02 - Section 10 ticketing

Add the responsive bilingual Station section, payment, refund and print sheets and passenger confirmed and refunded pages to shared src/. No native app build or deployment requested. Verification: 96 automated checks and 32 ticketing layouts per source/built mode.

## 2026-11-02 - Section 11 luggage

Add the responsive bilingual Luggage section, printable QR tags, a luggage field on passenger and walk-in forms and bag status on the passenger booking page to shared src/. No native app build or deployment requested. Verification: 102 automated checks and 32 luggage layouts per source/built mode.
