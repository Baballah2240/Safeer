# Safeer mobile status

## Google sign-in readiness - website, 2026-11-12

D75: The privacy and account deletion pages cover Google sign-in, the signed-in Profile can delete the account, and the booking home page links the privacy policy. Phones receive this from the website; no new APK. Google sign-in inside the apps is still D68 step 4.

## Flutter Passenger and Driver apps (preview) - 2026-11-12

D74: new native Flutter apps in mobile/flutter, built from the Safeer Glass brief with the current Inter/Noto Sans Arabic fonts and SAFEER colours. Passenger: Explore with a frosted search card over the coach photo, departures with loading/empty/error states, seat map with legend, review and reservation (pay at the station), and My Trips with the ticket QR saved for offline use. Driver: Today's Trips with the active assignment first, full-screen scanner with torch and typed ticket numbers, result for every outcome, passenger list with search, and "Pending verification" for scans made without a connection. Same API and rules as the website; demo data in debug builds. Debug builds install beside the current apps (.dev IDs). Nothing is published and the WebView apps stay the live apps: the Flutter apps do not yet have shipments, company pages, accounts, notifications, incidents, departure/arrival or the update notice. 36 automated tests and flutter analyze pass; no physical phone or camera test. See [mobile/flutter/README.md](flutter/README.md).

## Handover back to Claude - 2026-11-12

Codex hands the Android apps back to Claude. No app change: Booking stays 0.17.3/17003 and Driver 0.18.4/18004. Checked on this computer: live site 19/19 with both APK downloads working, signed release build and lint pass, and the rebuilt APKs are byte-identical to the published ones with the same certificate. mobile/README.md now describes the current website-connected apps instead of the old USB test channel. See [the handover](../docs/archive/MOBILE_HANDOVER_2026-11-12.md).

## Custom staff permissions - website, 2026-11-12

D73: Staff screens can give a person custom permissions instead of a ready-made role, and the owner can choose a company and access while creating a user. Phones receive this from the website; no new APK.

## Phone and email links, app sign-in guidance - Booking 0.17.3 / 17003, Driver 0.18.4 / 18004, 2026-11-12

D72: tapping a company phone number or email (company page, booking page), the support email (privacy page) or a passenger number in Staff now opens the phone's dialer or mail app; before, the app shell blocked them silently. Only taps can do this, and every other non-Safeer page stays blocked. Inside the apps the Profile page now says Google sign-in works on the Safeer website instead of showing a button that cannot work in an app. Web-side fixes (per-visitor booking limits, Trips date filter, walk-in sale travel date) reach the apps without reinstalling. Signed with the existing key (certificate SHA-256 a19fb6c1…7205); release build and Android lint passed (2 existing warnings each). Not installed on a physical phone. Publish GitHub releases v0.17.3 and v0.18.4 with Safeer-Booking-0.17.3.apk and Safeer-Driver-0.18.4.apk (and their .sha256 files) right after pushing, because src/app-release.js points the update notice at them.

## New brand colours and logo - Booking 0.17.2 / 17002, Driver 0.18.3 / 18003, 2026-11-11

Both apps and the website switch to the official SAFEER palette (navy, sky blue, orange) and the new Route Pin logo. The web screens update by themselves; the new launcher icon and native status-bar colours need the new APKs, offered by the in-app update notice. Signed with the existing key (certificate SHA-256 a19fb6c1…7205, same as earlier releases). Release builds and Android lint passed. Physical-phone installation was not performed.

## Passenger Google sign-in - website, 2026-11-11

Booking website Profile: optional "Sign in with Google", saved name and mobile, sign-out and "Save bookings from this device"; checkout fills the first traveller name and mobile from the profile. Not yet available inside the Android Booking app (that is D68 step 4); no APK change.

## Route stations and staff details - website, 2026-11-11

Staff screens: each route stop now lists only stations in its city and explains when there are none; saving a mismatched station shows a clear message. Adding or editing staff accepts an optional job title and work phone. Custom company roles always let the person open their company workspace. Phones receive these changes from the website; no new APK.

## Theme leftovers and clearer errors - website, 2026-11-10

The Safeer logo, the home workspace sidebar and the staff sign-in sidebar now use the violet palette instead of brown/beige. Staff and Driver sign-in show a readable message when sign-in is unavailable instead of IDENTITY_UNAVAILABLE or a developer command, and the booking search reports an unavailable trip service instead of a missing company page. Phones receive these changes from the website; no new APK.

## Driver light/dark correction - 0.18.1 / 18001, 2026-11-10

The Driver appearance setting previously changed while dashboard, menu and field colors stayed fixed in light mode. Driver surfaces now follow saved light/dark tokens, including passenger rows, links, focus outlines and solid readable scanner results. Exact blue/purple action and progress colors, sharp camera, reduced motion, forms and sign-in state are preserved. Driver-only 0.18.1 uses the existing signature; Booking stays at 0.17.0/17000. Installing the update gives the already-open client a fresh document with the corrected styles.

## Driver update discovery fix - 2026-11-10, D67

Web-only correction; keep the published Driver 0.18.0/18000 and Booking 0.17.0/17000 APKs/checksums unchanged. Driver now checks uncached public release metadata when its page starts, returns to the foreground, reconnects, opens its menu or uses Check for updates. Its menu always offers Download Driver app, even for a current or unidentified client. Only update controls change in place; login/incident drafts and active camera streams remain intact. Offline/invalid/downgraded metadata retains the last known valid Safeer release.

An already-loaded old document cannot execute new code until a fresh page load. If the old layout persists, open the published Driver APK link in the phone browser and install it once. This also gets an old USB-channel wrapper onto the current HTTPS channel if necessary; no automatic install or physical-phone verification is claimed.

## Driver only - 0.18.0 / 18000, 2026-11-10, D66

Published to public release v0.18.0 (Driver APK and checksum only). Live source/health and Driver-17000 update notice are independently verified; Booking-17000 shows no update. Both public APK downloads match their recorded checksums. No physical phone was installed or tested.

Final verification preserves upstream D65 operations counts, translates Wrong trip in manual checks and clears passenger search/filter state when changing trip/account or losing access. Driver-only notices and both menus pass; Booking remains 17000.

Trip Dashboard shows the real assigned route, departure/status and valid boarding totals. Scan ticket opens the QR camera, offers optional flashlight and printed-code fallback, shows accepted/already scanned/wrong trip/invalid/retry results, and refreshes passengers without duplicate boarding. Search/filter passengers with a shortcut to scanning. Violet/blue frosted cards, phone passenger cards, Arabic/English and reduced motion are preserved. Camera frames stay on the device; no audio permission.

Build with `npm.cmd run mobile:build:driver`, then `npm.cmd run mobile:save:driver`. The signed APK, checksum and `latest-driver.json` are ignored artifacts. Publish only Safeer-Driver-0.18.0.apk and its checksum in release v0.18.0. Driver update notices use version 18000; Booking metadata, URL and APK hash stay at 17000. Android installs the APK after the owner downloads/approves it; pushing source does not install it. The owner declined a connected phone, so this release has automated camera/video verification but no physical-phone result.

## Booking homepage - 2026-11-10, D65

No new app version. The Booking app shows the new booking-first homepage once the website is updated. The Driver app is unchanged by this work.

## Shipments on the website - 2026-11-09, D59

No new app version. The Booking app's menu gains Track a shipment (served by the website), and the Driver app's trip page lists shipments on the trip. Both appear once the website is updated.

## Online download and update notice - 0.16.2 / 16200, 2026-11-09, D60

The website gets a Download Android app button (Booking and Driver menus, plus a Get the app notice in Android browsers). Installed apps show A new version is available with Download update when a newer release exists; the download opens in the phone browser and installs over the existing app, keeping its data. Files are attached to public GitHub releases; src/app-release.js is regenerated by mobile:save.

## Full screen, workspace menu and sign-in - 0.16.2 / 16200, 2026-11-09, D58

Apps now fill the whole screen including the camera area; page content starts just below it. On phones the Safeer workspace menu slides in from the side when the menu button is tapped and closes on tap outside, Back, or choosing a page. Staff and Driver sign-in pages are redesigned with larger fields and a show-password button. Release build/lint (0 errors) and mobile:save passed. The cutout spacing, menu and sign-in changes come from the website and appear on phones once it is updated.

## Website-connected apps - 0.16.1 / 16100, 2026-11-09, D57

Driver and Booking now open https://safeer.mohbaba.online directly; USB is only used to install them. Signed with the private Safeer upload key, so the first install over the old USB test apps needs a one-time uninstall (booking keys saved on that phone are removed; references still work). The apps reconnect automatically when internet returns, Retry stays on the current page, and repeat visits download only changed files. The menu drawer is redesigned with app identity, labelled sections, a signed-in driver card and a pinned Settings footer. Release build/lint (0 errors) and mobile:save passed; installation awaits a connected USB phone. Shared web changes reach phones only after the website is updated.

## Audit fixes - 0.16.0-usb.6 / 16006, 2026-11-09

Hosted errors now explain internet recovery; USB debug retains cable/tunnel recovery. Shared web fixes cover search ordering/drafts, large Arabic group bookings, support contact and sidebar placement. Debug build/lint and mobile:save passed; installation awaits an authorized USB phone. mobile:build:hosted compiles/lints the HTTPS release variants without publishing. See [D56 evidence](../docs/archive/AUDIT_REMEDIATION_2026-11-09.md).

## Shared login reliability - 2026-11-08, D54

Staff/Driver sign-in preserves fields across language changes, retains the email after failed attempts, clears rejected passwords and prevents premature/duplicate submission. The shared web update is available on refresh; no native package change or APK installation. Existing permissions, data and local USB dependence are preserved. See [D54 handover](../docs/archive/LOGIN_RELIABILITY_2026-11-08.md).

## Render hosting - 2026-11-05

The web app can now run hosted at https://safeer.mohbaba.online from `render.yaml` and `scripts/production.mjs`: one fixed HTTPS origin, Secure cookies, HSTS, hosted PostgreSQL with a limited runtime role, and migrations on start. Store builds use `--origin https://safeer.mohbaba.online` once the site is live. See [hosting](../docs/HOSTING.md).

## Play preparation - 2026-11-05

Add signed Google Play release bundles for both apps. The server address is a build setting: debug keeps the USB loopback, while release requires a public HTTPS origin with system certificates only. The private upload key is created outside Git. The privacy policy and account/data deletion pages are linked from staff sign-in, driver sign-in and the booking form, in Arabic and English. Not yet publishable: hosting, the support contact in src/legal.js and legal review are still needed. See [Play steps](PLAY_STORE.md).

## 0.16.0-usb.5 - 2026-11-05, D52

Driver gains the same sidebar and appearance/language Settings as Booking, keeping notifications, company access, Refresh and Sign out. Both native clients remove top toolbars and use immersive fullscreen with transient system-bar swipe reveal, cutout/keyboard safety and drawer-first Back handling. Shared drawer binding avoids duplicate focus/dismissal logic. Rebuild/lint/save/install preserving data; binaries remain ignored. See [D52 handover](../docs/archive/MOBILE_FULLSCREEN_2026-11-05.md).


## 0.16.0-usb.4 - 2026-11-05, D51

Booking removes the native title and Home/Refresh/Print row. Public Booking pages use a compact menu and accessible sidebar containing navigation and language/appearance Settings. Driver retains its native tools. Preserve all origin/permission, system-inset, error-recovery and data rules. Build/lint/save and replace both local packages without clearing data. See [D51 handover](../docs/archive/BOOKING_SIDEBAR_2026-11-05.md).


## 0.16.0-usb.3 - 2026-11-05, D50

Owner-requested update of both Safeer Driver and Booking. Increment the local native version to 16003 and retain all security/navigation behavior, signing compatibility and data-preserving installation. Shared src/ supplies the latest glass, floating headers and marketplace notice. Build/lint, save APK/checksum manifests and verify the connected phone; binaries remain ignored. See [D50 evidence](../docs/archive/ANDROID_UPDATE_2026-11-05.md).


D49 shared web refresh: 12px desktop/10px mobile sticky header gap reveals the curve; glass has softer tint and broad reflections. Scroll clearance accounts for the gap. Existing USB apps load shared web assets on Refresh; no APK build/install or physical phone capture is claimed. See [handover](../docs/archive/FLOATING_HEADER_2026-11-05.md).


D48 shared web follow-up: staff/preview toggle moved above the sidebar; a visible corner control restores collapsed navigation. Native Driver/Booking have no sidebar and no APK changes. No install/physical phone check is claimed. See [handover](../docs/archive/SIDEBAR_POSITION_2026-11-05.md).


D47 shared web follow-up: staff/preview sidebar toggles are circular icon-only glass controls with accessible labels and 44px targets. Driver/Booking have no sidebar. Native packages are unchanged; no APK build/install or phone recapture is required. See [handover](../docs/archive/CIRCULAR_SIDEBAR_2026-11-04.md).


D46 shared Booking web update: the public announcement has aligned margins, an SVG icon, translated label and safe message wrapping on narrow screens. Existing native packages are unchanged; Refresh loads served web changes. No APK build/install or physical phone capture is claimed. See [handover](../docs/archive/MARKETPLACE_NOTICE_2026-11-04.md).


D45 shared web refresh: reference-led frosted headers/sidebar, pill controls and glass summary tiles, retaining black/brown and all behavior. Existing local USB clients load the shared design on Refresh; no native rebuild/install or physical phone verification is claimed. See [D45 handover](../docs/archive/REFERENCE_GLASS_2026-11-04.md).


Shared web follow-up D44: staff and fictional preview now have a persistent header sidebar toggle. Driver/Booking have no sidebar and remain unchanged; no APK build/install is needed. Refresh shared pages for the update. See [handover](../docs/archive/SIDEBAR_TOGGLE_2026-11-04.md).


## Shared sticky headers - 2026-11-04, D43

Driver and Booking headers now stick at the top while scrolling, with layered reflections and stronger backdrop blur in the black/brown palette. Wrapped header height is observed so scrolled fields stay below it. Desktop/mobile, Arabic/English, both themes, reduced motion/transparency, forced colors and print isolation pass. Existing 0.16.0-usb.2 apps load the shared web update after Refresh; no APK build/install or physical phone recapture occurred in D43. See [header evidence](../docs/archive/STICKY_HEADERS_2026-11-04.md).


## 0.16.0-usb.2 - 2026-11-04, D42

Apply the requested black/brown palette to shared web pages, logo, Android toolbar/status/navigation bars, disconnected view and launcher icon. Retain bento/glass, Arabic/English, both themes and all business/assignment rules. Both APKs build/lint, pass signature verification and install with version 16002 on the authorized USB phone without clearing data. APKs/checksums/manifest stay in ignored releases/. Final physical capture was blocked by the phone lock; targeted built-browser color checks pass. See [D42 handover](../docs/archive/BLACK_BROWN_2026-11-04.md).


## Web refresh - 2026-11-04, D41

The shared responsive src/ adopts the bento-grid and liquid-glass design for /driver and /marketplace, along with the website. The installed 0.16.0-usb.1 Driver and Booking apps load these pages from the running local server, which sends assets with no-store. They receive the design after the dist/ rebuild without a new APK: reopen a screen or press Refresh. Server authority, driver assignment, booking and money rules are unchanged. No APK was built or installed; both existing apps were refreshed and their actual dark Booking/light Driver screens inspected on the USB-connected LGN-NX1/API 36 phone. Nine affected built-browser workflows pass with 256 responsive/language/theme combinations plus the preview workflow. See [the D41 handover](../docs/archive/BENTO_GLASS_2026-11-04.md).

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

## 2026-11-09 - D61 shared luggage workflow

Staff luggage pages now clear stale actions during searches, support explicit refresh, explain the 50-bag display bound and warn about permanent missing-bag closure in Arabic/English. Existing Android web clients consume the shared source. No camera permission, package/version change or driver luggage grant. Phone/printer/scanner acceptance is separate from source checks.

## 2026-11-09 - D62 verified mobile handover

Rebuilt both 0.16.2 website apps with the existing upload certificate; release build/lint/signatures and shared mobile workflows passed. Regenerated src/app-release.js for the saved APK hashes. Added Android-browser/old/current/newer app download-notice checks. See docs/archive/MOBILE_CONTINUATION_2026-11-09.md. No signing identity/version change or phone uninstall. Public downloads await owner publication of the private draft and repository visibility choice.

## 2026-11-09 - 0.16.3 / 16300 (D63)

- Driver: own app identity, trip/boarding descriptions and separated Refresh/Sign out actions.
- Booking: own app identity, trip search/reservation descriptions and employee access guidance.
- Both: modern menu cards, clear selected destination, 44px controls, compact settings, privacy/support access, reliable scroll/focus and translated-header clearance.
- Same package IDs, HTTPS service and signing certificate. New app-release metadata points each app to its matching 0.16.3 APK; older 0.16.2 clients show the update notice after loading the updated website.
- Source/browser/build/lint/signature checks passed; public hosting/download verification is separate from a Git push. No phone uninstall or automatic APK installation.

## 2026-11-10 - 0.17.0 / 17000 (D64)

Booking: reference-driven glass My Trips, Upcoming/Past, real route/photo/status cards, timeline, seat/boarding and valid device-owned paid-ticket QR, frosted Book/Trips/Profile and passenger-count search intent. Driver: matching exact blue/violet palette and native loading/recovery colors; its separate assignment/boarding workflow is unchanged. Both retain package IDs, signing key and HTTPS website. Migration 0017 is a read-only, proof-checked passenger projection; weaker reference/mobile lookup stays masked/QR-free. Preserve D59 shipments. See docs/archive/MY_TRIPS_GLASS_0.17.0_2026-11-10.md.


## 2026-11-11 - Minimal headers and branded loading (web update)
- Booking and Driver show localized Safeer centered beside the existing menu button without the floating header panel.
- Branded loading includes an indeterminate progress track, screen-reader status and reduced-motion support.
- Delivered through the hosted website; app versions and download metadata remain unchanged.


## 2026-11-11 - Seamless app bar and centered startup loading
- Removed the separate background behind the centered app name in Booking and Driver.
- Startup and Booking page loading now use a centered, full-screen branded state without a top loading card.
- Driver operation feedback stays compact; reduced-motion and form preservation remain supported.

### Native update: Driver 0.18.2 / Booking 0.17.1
- Removed the Android horizontal progress strip at the very top.
- Requires installing the new signed APK; the hosted page alone cannot remove the strip from older installed apps.

Validation: signed release builds and Android lint passed (0 errors); versions/signing compatibility and removal of the native progress view were verified in both APKs. Unit/build/documentation checks, Booking/Driver menus, transparent-header, login/sidebar and centered light/dark/reduced-motion loading checks passed. Physical-phone installation was not performed.


## 2026-11-11 - Bilingual branding and booking form refinement
- Centered Safeer wordmark with the existing brand mark, distinct Arabic/English typography and more vertical space.
- Clearer booking photo with a separate heading and form, refined city/date/passenger labels, stronger field surfaces and keyboard focus.
- Shared hosted styling; no APK reinstall required for this refinement.

Validation: 26 unit tests, source build and documentation checks passed; Booking/Driver menus (80 layouts), headers (64 layouts), login and sidebar (32 layouts) passed. Visual QA covered 12 Arabic/English light/dark booking layouts, including field sizing/focus, image separation and overflow.


## 2026-11-11 - Scroll-aware header and booking spacing
- Booking/Driver headers hide when scrolling down and return when scrolling up or reaching the top. Keyboard focus and open drawers keep navigation available; reduced-motion is respected.
- Added vertical room around the centered name and moved the booking image card and search form lower.
- Hosted update; no native version change.

Validation: unit/build/documentation checks, 80 Booking/Driver menu layouts, 64 header layouts including down/up scrolling, login and 32 sidebar layouts passed. Twelve bilingual light/dark booking layouts verified the larger visible card gap and field fit.
- Directional header visibility is preserved when data refreshes replace the header markup.


## 2026-11-11 - Tracking page shares the app theme
- Shipment tracking now uses the shared centered header, menu/Settings and passenger navigation.
- Matched the tracking form, result cards and progress timeline to the official app styling in Arabic/English and light/dark mode.
- Tracking-code drafts and public-only tracking responses are preserved. Hosted update; no new APK required.

Validation: 26 unit tests, build/docs checks, all 7 shipment integration tests and the shipment browser workflow passed. Tracking passed 16 bilingual light/dark responsive layouts with draft/focus/error checks; 64 shared-header layouts passed. Final mobile visuals were reviewed in both languages.


## 2026-11-11 - Independent body branding and minimal Driver sidebar
- The Safeer logo/name now scrolls naturally with page content; the menu button stays fixed independently, with safe-area clearance.
- Driver sidebar contains only Settings and version. Refresh/sign-out remain on the Driver page; app-update controls remain in its footer.
- Hosted shared-source update; no new APK version.

Validation: unit/build/docs checks, 80 menu layouts, 16 tracking layouts, 64 body-masthead/staff-header layouts, 36 Driver theme layouts, boarding/revocation/logout, update discovery and login regressions passed. Focused fields stay clear of the fixed menu button; final sidebar visuals were reviewed.


## 2026-11-12 - Staff access matches the app shell
- Staff access uses the body logo and independent fixed menu button, with modern slide-out navigation and Settings.
- Permission-scoped staff/company navigation and refresh/sign-out remain available; obsolete preview links and the old top bar/sidebar column are removed from Staff access.
- Shared hosted update; no APK reinstall required.

Validation: unit/build/docs checks, 32 Staff menu layouts, 64 shared masthead/header layouts, login, 72 company-management layouts and 60 identity/permissions layouts passed. Legacy preview sidebar checks also passed. The time-sensitive operations fixture could not run near the Khartoum day boundary; company and identity workflows were verified independently.
- Staff appearance and language controls use separate, comfortably spaced rows in the drawer.
- Language changes preserve the menu scroll position, including long company/admin navigation.


## 2026-11-12 - Shared Noto Sans Arabic and Inter typography
- Bundled local fonts for all screens, with license notices and source checksums.
- Consistent wordmarks, headings, 16px body/inputs and medium-weight controls; increased Arabic line spacing and Inter numerals for dates/prices.
- Official text colors and operational behavior remain unchanged. Hosted update; no APK version change.

Validation: 28 unit tests and build/docs checks passed on the current audited source. Actual custom-font rendering, Inter numerals, local-only delivery and overflow were verified across 72 bilingual/theme/viewport combinations. Staff/Driver/Booking/Tracking menus, 64 masthead layouts, Driver appearance, login, and audited passenger-account/tracking checks passed. Font licenses and provenance are bundled.

## Shimmer placeholders - 2026-11-12

Booking startup and saved trips, Driver loading/refresh, Staff workspace loading and shipment lookup now use shared rounded shimmer placeholders. Light/dark themes, Arabic RTL, translated screen-reader status and reduced motion are supported. Loading stays inside the page so the app name and menu remain visible. No top progress strip, artificial delay or native update; reopen the app after the website update.

Validation: 28 unit tests, build/docs checks, 32 delayed-request shimmer layouts, Staff (32), Driver (40), Booking (40), Tracking (16) and login browser regressions passed. Verified Arabic/English, light/dark, reduced motion, request completion and visible mastheads. Native metadata was saved without changing the published app versions.
