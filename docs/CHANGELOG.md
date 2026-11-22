# Changelog

## One place to give and remove any access - D136, 2026-11-22

In Users, every account now has an Access button for the super administrator. It shows everything that person can reach: platform roles, their own platform permissions and every company they belong to, with their role or custom permissions. From the same place the super administrator can tick individual platform permissions for that person (no role needed), add them to any company, change their company access or remove it. Removing company access leaves the account and other companies as they are.
## Legal pages per country - D139, 2026-11-22 (global-ready branch, not published)

The privacy policy, the account deletion page and a new Terms of use page now have a country choice. Each country shows its own personal data law and where to complain, its consumer law where there is one, and card payment details only where cards are accepted. Countries where Safeer has not launched yet show a clear note that the text will be checked by a local lawyer before launch. Sudan reads as before, plus a short section on your rights in Sudan. The site footers link to the new Terms of use page.

## Full access for the super administrator - D135, 2026-11-22

The super administrator can open and change every part of Safeer: all companies, the staff site, the platform pages and the Safeer Driver app. In the Driver app the super administrator now sees every company's trips (from two days ago onward) and can board passengers and run any journey; drivers still see only their own trips. A new automatic test signs in as the super administrator and checks every page and permission, so new features cannot leave the super administrator out.
## Translation files - D138, 2026-11-21

All website text is now in translation files, one folder per language (src/locales), and a single language list decides direction, date formats and the language switch. The phone apps read the same kind of list. Adding a language means adding its files and one line; an automatic check fails if any text is missing. Nothing visible changed: the site and apps still offer English and Arabic. See docs/TRANSLATIONS.md.

## Card sales in finance reports - D137, 2026-11-21

Online card payments appear in the company-wide finance report as "Online card payments", count in sales, daily and method totals, and Card can be chosen as a payment method filter. Station reports still show only that station's counter payments.

## Card payments for Egypt (Paymob) - D136, 2026-11-21

Passengers can pay a held booking by card on Paymob's secure page when the bus company turns on Card in Payment methods. Only a payment Paymob has signed confirms the booking and issues the tickets; declined cards leave the booking held, and money that arrives after the seats were released is marked for refund. Safeer never sees card details; the privacy page says so. Card payments are off until Paymob keys are configured.

## Ready for a second country, step 1 - D135, 2026-11-20

Each bus company now has a country and a currency. Local phone numbers are completed with that country's calling code (for example 010 1234 5678 becomes +20 10 1234 5678 for an Egyptian company), new trips are priced in the company's currency, and the company form fills in the time zone and currency when a country is chosen. Staff screens no longer assume Khartoum time. Sudanese companies work exactly as before.

## San Francisco font and consistent controls - D134, 2026-11-20

The site uses San Francisco on Apple devices and the matching open font Inter elsewhere. Every button, tab and field now follows one size system (48px buttons with 12px corners, 44px round icon buttons, 48px fields), and the main action is Safeer orange everywhere. Details: docs/archive/DESIGN_SYSTEM_2026-11-20.md.

## Trip card fills wide screens - D133, 2026-11-20

On computers and wide tablets, each trip in My Trips shows the photo beside the trip details (route, date, status, seats, booking number and arrival time) instead of leaving half the card empty. Phones keep the same look.

## Load test and sign-in waiting line - D132, 2026-11-20

Added a load test (npm run test:load) that simulates 50, 100 and 200 people at the same moment. No crashes or wrong results: one seat always has one winner, one ticket is boarded once. Sign-in no longer refuses people when more than two sign in at the same moment; they wait a few seconds in line instead.

## Own trips only in the driver app, and a logo with depth - D131, 2026-11-20

The driver app and the website driver page now list only trips assigned to the signed-in person, also for company managers. The Safeer logo in both apps and on the phone home screen is drawn with light, shadow and gloss; it is still drawn as vector shapes, so it stays sharp at every size. Released as Safeer Driver and Passenger 0.27.0.

## Scan sounds in Safeer Driver - D130, 2026-11-20

After each scan the Driver app beeps: one short beep when the ticket is valid, two beeps when the driver should check it (already boarded, boarding closed, waiting for connection), and a long low tone when it is not valid. Settings > Scan sounds turns it off. Released as Safeer Driver 0.26.0.

## Cleaner Settings and a faster PIN keypad - D129, 2026-11-20

Both apps: Settings hides the data source and the crash-reports switch; Language, Appearance and App lock are now clear option lists with the full label and a check mark. A new PIN is 4 or 6 digits; the lock screen shows exactly that many dots, opens the app the moment the last correct digit is typed, and says "The PIN is not correct. Try again." otherwise. The privacy page no longer says crash reports can be turned off in Settings. Released as Safeer Driver and Passenger 0.25.0.

## Crash reports, deploy safety check and uptime monitoring - D128, 2026-11-20

- **Apps:** Safeer Driver and Safeer Passenger 0.24.0 send crash reports through Firebase Crashlytics (error, app version, phone model; no personal data). Settings has a switch to turn it off. The privacy page explains it.
- **Deploys:** the live site updates only after all GitHub tests pass. Two tests that had been failing since 18 November were fixed.
- **Monitoring:** a GitHub check runs the live-site checks every 30 minutes and emails the owner when the site has a problem.
- **Backups:** `npm run backup:compare` and docs/BACKUP-RESTORE.md: restore a Render backup into a new database monthly and check, read-only, that every table and its data came back.
- **Test reliability:** the browser test helper now waits for pages that are still loading and honours each test's time limit, which was making the GitHub check fail at random on slower machines.
- **Tested on a real phone:** the app lock, fingerprint unlock and the Lock after timer on an HONOR phone with Android 16.

## Steady backgrounds on phones - D127, 2026-11-19

- **Website on phones:** the page background (the bus photo on the booking site, and the soft background on tracking, privacy and driver pages) no longer moves or rescales while scrolling. It stays pinned to the screen and keeps its size when the browser address bar hides or shows.
- **Tests:** tests/background.browser.mjs.

## In-app update - D126, 2026-11-19

- **Both apps:** when a newer version is published, the app shows "Version X is available" with an Update button (also in Settings > App update, with Check for updates). It downloads the new APK from the Safeer GitHub release, checks its SHA-256 and size against the website's release information, and opens Android's installer, which installs it over the app and keeps sign-in, settings and saved data. The first time, Android asks to allow installs from the app.
- **Release:** Safeer Driver and Safeer Passenger 0.23.0 (23000), with D125 and D126. Phones on 0.22.0 or older install 0.23.0 once from the website; later versions arrive inside the app.

## Account lock in Safeer Driver - D125, 2026-11-19

- **Safeer Driver:** with App lock on, the driver signs in with the password once; after that the PIN or fingerprint/face opens their account directly, even after the app was closed or the server session ended. The lock screen shows which account it opens. The sign-in details are stored encrypted in the Android Keystore and removed on sign-out, when the lock is turned off, when the password no longer works (for example after a change on the website) or after 10 wrong PINs, which also signs the driver out.
- **Tests:** apps/safeer_driver/test/account_lock_test.dart.

## App lock timer - D124, 2026-11-19

- **Phone apps (Flutter):** Settings > App lock now has "Lock after": immediately when you leave the app, or after 30 seconds, 1, 5 or 15 minutes. With a timer, the app asks for the PIN or fingerprint/face again only after being in the background that long, or after being left untouched that long while open; every touch restarts the timer.
- **Tests:** two new tests in safeer_core app_lock_test.dart.

## Layout on every device and typing help - D123, 2026-11-19

- **Phone apps (Flutter):** both apps were checked on small, large and folding phones, tablets and landscape, in English and Arabic, at large text sizes and with the keyboard open. Fixed: the ticket-number sheet in Safeer Driver overflowed when the keyboard opened, sign-in and review forms now stay a readable width on tablets, and Next on the review screen goes traveller by traveller, then to the mobile number (Done books). Tapping empty space or dragging a form closes the keyboard, and the focused field stays above the keyboard.
- **Website on phones:** every page now asks the browser to resize for the on-screen keyboard. On touch screens the keyboard shows Next until the last field and Go on the last, Enter moves to the next field instead of sending the form, the field being typed in is scrolled above the keyboard, and the floating booking bar hides while typing. Typing fields stay at 16px so phones do not zoom in. The staff overview figures no longer break words on narrow phones.
- **Tests:** layout_test.dart in both Flutter apps and tests/keyboard.browser.mjs.

## Journey steps and trip tracking - D122, 2026-11-19

- **Driver journey steps:** on the driver page and in the Safeer Driver app, the driver starts the trip (even if some passengers have not boarded), marks each stop reached, marks the destination reached and then closes the trip. The steps must go in that order and the server enforces it. Each step is recorded in the company audit history.
- **Trip tracking for passengers:** the tracking page (/track) now also takes a booking reference (SF-…) and shows the bus's progress: not started, on the way with the next stop, arrived, or completed, with planned and actual times for every stop. It shows no passenger details, works only for active bookings, and is rate limited per visitor like parcel tracking. The home page has new "Track your trip" links.
- **Database:** migration 0034 adds the stop check-in table and the "closed" step. New tests: tests/journey.integration.mjs and the Flutter journey_test.dart.

The Safeer Driver app needs a new APK for the Journey screen; the driver web page works at once.

## City photos on popular routes - D121, 2026-11-19

- **Destination photos:** each popular route card on the booking page now shows a photo of the destination city instead of the bus. Cities without a photo still show the coach picture.
- **Editable:** in the staff workspace, Cities & destinations, the platform owner uses **City photo** to upload or remove a city picture. Large pictures are shrunk on the device before upload (at most 128 KB). Only PNG, JPEG and WebP are accepted, checked by file content.
- **Security:** only the Super Administrator can change photos (password confirmed, recorded in the audit history). Passengers can only read photos of active cities. New test: tests/city-photos.integration.mjs.

Database migration 0033 (applies on the next deploy). Website and API only; no new APK.

## Bus photo as the booking site background - D120, 2026-11-19

- The coach photo now fills the whole booking page behind the search, routes and trips, softened with a light wash (darker in dark mode) so text stays readable. Phones load the small image and wide screens the large one.
- The separate banner photo above the search is removed, so the search form moves up.

Website only; no migration, no new APK.

## Staff layout polish - D119, 2026-11-19

Staff web only; no migration, no new APK.
- **Company bar:** the bar above Operations overview has padding and space before the title. The company name leads, and on phones it takes its own row.
- **Company page header:** more compact. The platform owner no longer sees "Your access is limited to your assigned company".
- **Trips:** search and "Show trips from" share one row (stacked on phones). Trip cards use smaller, tighter text and keep their buttons along the bottom.
- **Workspace home:** the shortcut cards fill the full width (3 columns from 1200px, 2 from 1000px) instead of leaving a third empty.
- **Trip status tiles:** numbers line up when a label wraps.
- **Headings and cards:** "Today's departures" uses the same heading size as the other dashboard sections, and page headers and summary cards are tighter.

Tests: operations, trips, companies, sidebar, headers, fleet, ticketing, platform, finance and direct-permissions browser.

## Security review and cross-origin headers - D118, 2026-11-19

Reviewed everything added since the D72 audit; see docs/testing/SECURITY_REVIEW_2026-11-19.md. No exploitable weakness was found. Every page and file now also sends Cross-Origin-Opener-Policy and Cross-Origin-Resource-Policy: same-origin. The new attack test tests/security-probe.integration.mjs refuses anonymous, unprivileged and other-company callers on the new billing, branding, invoice, contract, fare, manifest and payment-proof endpoints, and sends 1,105 hostile requests with no server error. Website only; no migration, no new APK.

## Workspace layout and dashboard in the style of Plane - D102, 2026-11-17

Staff workspace only; no migration, no new APK. From 1100 px wide the signed-in workspace has a slim icon rail (Home, Platform, Companies, Cities, Users, Roles, Sessions, Audit, by access) and a second sidebar (the open company's grouped sections, or the workspace pages) beside the content; narrower screens keep the menu drawer. The company Overview becomes a dashboard: tabs (Summary, Departures, Needs attention, Activity) that jump to each part, the existing summary cards, trip status counts that filter today's departures, a seats-booked-by-departure bar chart whose bars open the trip, a departures-by-status half ring with a legend that filters, the departures table and trip details as before, recent activity from this company's notifications, and from 1280 px a right sidebar with the person and the company (Your profile, Company settings, Notifications). Minimal styling: white surfaces, light grey borders, compact spacing; colour is used for statuses and charts, with matching dark colours. Tests: operations browser.

## Staff header fixed to the top - D101, 2026-11-17

The staff workspace header (src/staff-header.js) stays at the top of the screen and holds the menu button, a Home button (your workspace overview, or your company for company-only staff), the Safeer name, a search bar in the middle, theme and language buttons (moved from the menu drawer), the notification bell and the profile (initials and name, with Your profile and Sign out). Search lists the pages and company sections the person may open, and a booking reference (SF-) or shipment code (SH-, SHP-, SPT-, RCP-) opens that search in the open company; arrow keys, Enter and Esc work, and Ctrl+K or Cmd+K moves to it. On phones the search takes its own row. The header drops its blur for reduced transparency and high contrast, and does not stick when printing. Staff web only; no new APK. Tests: staff-menu and headers browser.

## Notifications panel - D100, 2026-11-17

Notifications are no longer a page. The bell (and Open notifications on the card) opens a panel over the current screen: unread count or You're all caught up, Mark all read, close, search, filters All / Unread / Money / Operations / Company, an updates count with Refresh, cards with category, time, title, meaning, company and read state, Details, Mark read and PDF downloads for contracts and invoices, Older notifications, and full screen on phones. Migration 0030 returns each event's details and read time in the list, and restores the D14 privacy rule for details: references, problem types, routes and times only, no amounts and no free-text notes (D99 had shown amounts and notes). Old ?tab=notifications links open the panel. Staff web only; no new APK.

## Notification card with full details and iOS-style count - D99, 2026-11-17

Migration 0029 adds safeer.notification_detail (business facts only: references, amounts, routes, times and staff notes; no passenger names or phone numbers; only for events the person may see) and returns it with the newest unread event. A notification that arrives while the staff page is open now opens a card in the middle of the screen with its full details, a blurred backdrop and a spring animation, with Open notifications, Mark read and Close; it waits while a form is open, and nobody gets a card for their own action (notification_events.actor_id records who caused the event; it still counts as unread). The unread count is a red circle outside the bell (iOS style) that pops when it changes, and it is rechecked after every screen load as well as every 30 seconds. Notifications explains every event type. Web only: push to phones is not set up yet (see workflows/NOTIFICATIONS.md).

## Staff notification bell, live pop-up and three new alerts - D98, 2026-11-16

Migration 0028 adds the events payment.proof (bank transfer with proof photo, for finance readers of that station), shipment.exception (for shipment resolvers) and booking.refunded (for finance readers of that station), recorded by triggers in the same transaction, plus safeer.notifications_unread() and safeer.notifications_read_all(). New endpoints GET notifications/unread and POST notifications/read-all. The staff workspace has a bell beside the menu button with the unread count (src/staff-alerts.js); it checks every 30 seconds while the page is visible and at once on return, and an event that arrives while the page is open shows a 10-second pop-up with View. Notifications has Mark all as read. Plan for passenger alerts (app push and SMS): [notifications](workflows/NOTIFICATIONS.md). Staff web only; no new APK. Tests: ticketing and shipments integration, ticketing browser.

## Code and security review, cleanup - D97, 2026-11-16

Review: npm audit (0 vulnerabilities), TypeScript with noUnusedLocals/noUnusedParameters on the API and on the web and tool JavaScript, SQL built from strings (only fixed column lists and a hard-coded table name), HTML escaping of stored text, public API routes, the Google sign-in return address (fixed list, state, nonce, PKCE), origin and CSRF checks on every change request, and the payment proof image route (owner-checked, nosniff, no-store). No security fault was found. Removed: the retired WebView app source (mobile/android) and its scripts mobile/build.mjs, usb.mjs and release.mjs (still in Git history), tests/mobile-shell.test.mjs that only tested that app, unused imports in marketplace.js, scripts/local.mjs and mobile/upload-key.mjs, two duplicate Arabic strings, and export from twelve functions used only in their own file. mobile/install.mjs installs the saved Flutter apps only. Results: 161/161 integration, all browser, 28/28 unit tests and the documentation check pass.

## One scrollbar style everywhere - D96, 2026-11-16

Every web page (typography.css; home.css for the home page) uses the same scrollbar: thin, rounded, no arrow buttons, a soft thumb that darkens on hover, light and dark colours, and the system colour in forced-colours mode. Chromium and Safari use ::-webkit-scrollbar; Firefox uses scrollbar-width and scrollbar-color. The staff sidebar now uses the shared colour instead of near-invisible white. CSS only; no migration, no new APK.

## Company sidebar in dropdown groups and a Settings button - D95, 2026-11-16

Staff workspace only; no migration, no new APK. The company sidebar shows Overview, then dropdown groups Planning (Trips, Routes, Drivers, Vehicles), Sales (Bookings, Reports), Operations (Sessions, Station, Luggage, Shipments) and Settings (company profile to audit). Each group has a count and opens or closes; the group holding the open screen is always open, Settings starts closed, and the choice is remembered per company on this device. As before, each person sees only the sections their access in that company allows, and a group with none is left out. The company header has a Settings button that opens the first settings screen the person may use. Tests: tests/operations.browser.mjs.

## Staff list pages for Shipments and Bookings - D94, 2026-11-16

Staff workspace only (the booking site and the Booking/Driver apps are unchanged; no migration, no new APK). New src/list-page.js gives Shipments and Bookings one list layout: a page header with icon, subtitle and actions (New shipment, Price list), the existing search form, date presets by creation date in the company time zone (All, Today, 7D, 30D, 90D), a status filter, Filter this list, removable filter chips with a result count, a data table with a coloured status strip and an Options column, and pages of 20 rows. Under 900 px the table becomes stacked cards. Presets, status and Filter this list narrow only the rows already loaded (Shipments still loads the latest 50; Bookings the server search result). Every existing action, element id and permission is unchanged. Styles are in operations.css, Arabic text in staff-i18n.js. Tests: tests/list-page.test.mjs and new filter steps in tests/shipments.browser.mjs.

## Sessions is the working counter, bank transfer proof photos, Station shows station details - D93, 2026-11-16

Migration 0027 adds safeer.payment_proofs with safeer.payment_proof_attach and safeer.payment_proof. A bank transfer (booking payment or walk-in sale) must carry a photo of the transfer (proof: JPEG, PNG or WebP data URL, at most 384 KB; PROOF_REQUIRED, INVALID_PROOF, PROOF_TOO_LARGE); the image is saved in the same transaction as the payment and served to staff at GET companies/:id/bookings/:bid/payment-proof. The staff app takes a photo (camera) or uploads an image, shrinks it on the device and previews it; the booking shows View proof of transfer. Payment requests may be up to 576 KB, and the staff page allows data: and blob: images for the preview. Sessions now holds your session, a booking finder (pay, change or print), the walk-in sale, the session list and payment methods; Station shows the stations (with Edit) and their counters.

## Station Sessions, staff landing screen and staff Back button - D92, 2026-11-16

The company menu has a Sessions entry (under Station) showing only your session and the session list, and /staff?tab=companies&company=<id>&section=sessions opens it directly. Staff without platform access open straight into their company after signing in, and ticketing staff (no trip access) start on Sessions. Every staff screen (tab, company, section) is now a history entry, so the top-bar Back button and the phone back gesture return to the previous screen. Stale browser tests updated: 0.20.0 version codes, and boarding staying open after departure (D89).

## Back button on inner screens - D91, 2026-11-16

The booking, tracking and driver web apps show a Back button in the top bar on inner screens (company page, trip, ticket, search results, tracking, driver scan and passenger list). It returns to the previous Safeer screen, or to the booking home (driver: dashboard) when the screen was opened directly. The main booking screen and the bottom-tab screens keep only the menu. tests/app-back.browser.mjs covers it.

## Trip times in hours, seat holds of 1-3 hours, apps 0.20.0 - D90, 2026-11-15

Migration 0026 adds trips.hold_minutes (60, 120 or 180) and safeer.trip_hold_minutes; every hold now lasts at most 3 hours (company defaults above 180 minutes are lowered to 180 and the company form allows at most 180). Schedule trips and Edit trip take stop times in hours (quarter hours) with the last stop labelled Expected trip time, and a Seat hold before payment of 1, 2 or 3 hours (holdHours, INVALID_HOLD_HOURS); the trip list shows the expected trip time and the seat hold. The Flutter apps 0.20.0 book part-route journeys at their own price (passenger) and show each passenger's boarding and drop-off stop (driver).

## Stop-to-stop journeys with a price list - D89, 2026-11-15

Migration 0025 adds route_fares and makes booking, search, the station counter, tickets, the driver manifest and operations aware of the passenger's own stops. Routes > Prices between stops sets one price per pair of stops; the whole route keeps each trip's fare and an unpriced journey is not sold. Search matches any stop (every stop city is offered); the trip page has Board at / Get off at; holds and counter sales accept fromIndex/toIndex; a seat freed at a middle stop is sold again and overlapping journeys never share a seat (existing range exclusion). Tickets, bookings and the passenger itinerary show the passenger's stops and boarding time; drivers see where each passenger boards and gets off and can keep boarding later-stop passengers after departure until arrival; Operations shows the load on each stretch. New endpoints: GET/PUT companies/:id/routes/:rid/fares. OpenAPI: 105 paths / 121 operations. Tests: tests/stop-to-stop.integration.mjs and tests/stop-to-stop.browser.mjs.

## Back button on the privacy and account deletion pages - D88, 2026-11-15

Both pages have Back at the top and bottom. It returns to the Safeer page the reader came from (checked with the Navigation API, because the site sends no referrer) and goes to the home page when the page was opened directly. tests/legal-back.browser.mjs covers both cases in English and Arabic.

## Monthly invoices and review fixes - D87, 2026-11-15

Migration 0024 adds company_invoices with safeer.invoice_issue and safeer.invoice_settle (the runtime role can only read the table). New endpoints: POST companies/:id/invoices, POST companies/:id/invoices/:iid/paid and /void, GET companies/:id/invoices/:iid/pdf (lang=en|ar); GET companies/:id/billing also returns invoices. Plan & contract gains an Invoices section with the outstanding balance; invoice.issued and invoice.paid reach Notifications with Download PDF. Review fixes: English PDFs print Arabic names and addresses with the embedded font instead of "?" (the Arabic font is embedded only when used); brackets and full stops around numbers and Latin words follow Arabic direction; the public logo is revalidated on every view; plan figures stack on phones; the privacy notice says contracts and invoices are kept as business records. OpenAPI 0.16.0: 104 paths / 119 operations. tests/invoices.integration.mjs covers issuing, amounts, access, voiding, reissuing and payment.

## Review fixes for D82-D85 - D86, 2026-11-15

Arabic contract PDFs compress each embedded font once per process instead of on every download, and measuring text no longer adds unused glyphs to the font tables. A word wider than its column (a long email or address) is split instead of running past the page margin. The Needs attention card on the operations overview is a link only when something needs attention.

## Operations overview linked to the workspace - D85, 2026-11-15

The overview summary cards no longer touch the departures board. Each card leads somewhere: Departures today opens Trips, Passengers booked opens Bookings, Boarded and Needs attention jump to their list. A whole departure row opens its details, which end with Manage in Trips (or Assign a driver) and Open Bookings. Missing vehicles or drivers show an Assign button, and canceled departures are dimmed. Links appear only for staff who can open the target. tests/operations.browser.mjs covers spacing and navigation.

## Page stays still behind open cards - D84, 2026-11-15

While any card or menu (modal dialog) is open, the page behind it no longer scrolls, and scrolling inside the card stops at its edges instead of moving the page (src/theme.css, screen only so printing is unaffected). tests/billing.browser.mjs checks the lock and its release.

## Arabic contracts and API reference - D83, 2026-11-15

GET companies/:id/contracts/:cid/pdf accepts lang=en|ar (default en; other values 400 INVALID_LANGUAGE). The Arabic agreement is laid out right to left with the company's Arabic name, using the Noto Sans Arabic fonts the mobile app already ships (apps/api/src/pdf-arabic.ts: letter joining, line ordering, embedded Type0 fonts with a ToUnicode map). Download PDF links in Plan & contract and Notifications follow the page language. OpenAPI 0.16.0 now lists the D82 billing, contract, branding and public brand endpoints: 100 paths / 115 operations. No database change.

## Company plans, contracts and brands - D82, 2026-11-15

Migration 0023 adds company_billing_plans, company_contracts and company_branding. New endpoints: GET/PUT companies/:id/billing, POST companies/:id/contracts/:cid/accept, GET companies/:id/contracts/:cid/pdf, PUT companies/:id/branding, GET companies/:id/branding/logo, GET public/companies/:slug/brand and /logo. Company settings gain Plan & contract and Brand & theme; notifications for contracts carry Download PDF; the public company page shows the company's logo and header color. tests/billing.integration.mjs and tests/billing.browser.mjs cover them. src/contracts/openapi.json does not list the new endpoints yet.

## Staff layouts - D81, 2026-11-13

Company pages show an approval notice while a company is not approved (with Edit company for Super Administrators); Arabic staff, driver and tracking screens use Latin digits; staff tables become labelled cards on phones and the departures table has balanced columns; attention items stack on phones; "Saved." is a bottom toast that never sits under the menu button. tests/operations.browser.mjs and tests/trips.browser.mjs check these.

## Publish trip readiness checklist - D80, 2026-11-13

The Publish trip dialog lists company approval, bus and driver assignment, active bus and driver, fare and future departure as done or missing with what to do, asks for the password only when the trip is ready, and labels its button Publish trip. Staff dialog errors show as error boxes and dialog paragraphs keep even spacing. tests/trips.browser.mjs checks both states.

## Search-first booking hero - D79, 2026-11-13

The top of the booking page is redesigned: a 64px header, one layer instead of a card inside a card, and a shorter clear coach photo followed by the 24px heading and the search card, so the whole search, button included, is on the first screen on phones, tablets and laptops. From 1024px the Book/Trips/Profile links move from the floating bottom bar (which covered the search form) to a pill at the top right, on booking and tracking pages; phones keep the bottom bar with room kept above it. Field icons are readable in dark mode. New test: tests/booking-hero.browser.mjs (npm run test:booking-hero:browser), 28 layouts with a stand-in API, no database.

## Flutter apps replace the WebView apps - D78, 2026-11-13

Safeer Passenger and Safeer Driver, the Flutter apps (D74), are published as 0.19.0/19000 under the existing application IDs and upload key, so each installs over Booking 0.17.4 or Driver 0.18.5 as an Android update. Release APKs are ARM-only with compressed native libraries (about 17 and 22 MB instead of 35 and 49 MB). src/app-release.js points to GitHub release v0.19.0. The home page gains a "Safeer apps for Android" section whose buttons use /mobile/download/booking and /mobile/download/driver (no-store redirects to the current files), and the booking and driver pages name the new apps in their download links. The old WebView apps now show only "This app has been replaced" (src/app-retired.js, English and Arabic) with the new app's download. npm run mobile:build builds the Flutter release APKs, and npm run mobile:save checks each APK's package, version and signing certificate before saving it and regenerating src/app-release.js; the WebView-only scripts are removed. New: tests/app-retired.browser.mjs (npm run test:app-retired:browser); check:live also checks the home page download links.

## Warm palette everywhere and the public home page - D76, 2026-11-12

The public website is the home page at / (home.html with src/home.css, src/home.js, src/home-boot.js and WebP copies of the coach photo) in English and Arabic, with scroll reveals, a moving bus along the three steps, reduced-motion and no-JavaScript support, and relative links to booking, tracking, staff and privacy. The earlier demo workspace moves to /demo. The whole project switches from the D71 navy/sky-blue palette to sand, orange, deep green and charcoal: shared tokens are redefined for light and dark, and 392 hard-coded colours are converted by role. Filled buttons use #B9530F (white text 4.88:1). The Route Pin logo, the Android launcher icon, accent and system bars use the new colours: Booking 0.17.4/17004 and Driver 0.18.5/18005. Tests: home.browser.mjs; /demo replaces / in the demo tests; version pins and the selected-tab colour updated.

## Google sign-in readiness: privacy policy, account deletion, home-page links - D75, 2026-11-12

The privacy policy and the account deletion page now cover optional passenger accounts and Google sign-in in English and Arabic, including the Google API Services User Data Policy (Limited Use) statement, so Google can verify the consent screen. The signed-in Profile has Delete account with a confirmation (D68 step 5). The booking home page ends with the Privacy policy and Delete account links, and marketplace.html has a description and those links without JavaScript. Safeer no longer keeps the Google profile photo address. docs/HOSTING.md lists the owner's Google Cloud, Search Console and Render steps. No migration; website only, no new APK. Tests: passenger-privacy.browser.mjs and new account-deletion and photo checks in passenger-google.integration.mjs.

## Flutter live-API tests - D74 follow-up, 2026-11-12

mobile/flutter/tool/live-server.mjs and run-live-tests.mjs (npm run test:flutter:live, needs SAFEER_TEST_DATABASE_URL and flutter): a disposable local server built from the existing test fixtures, then packages/safeer_core/tool/live_api_test.dart (5 tests) and apps/safeer_driver/tool/live_boarding_test.dart (1 test). All pass.

## Flutter Passenger and Driver apps (preview) - D74, 2026-11-12

mobile/flutter pub workspace: packages/safeer_core (SAFEER palette and light/dark tokens, bundled Inter and Noto Sans Arabic TTF, English/Arabic strings with right-to-left layout, models for the existing public/driver replies, API client with Origin/CSRF, demo repositories, private storage, glass and solid components, seat map, server-geometry QR view) and two apps with separate entry points. Passenger: Explore, Departures, seat selection and review, reservation, My Trips and offline ticket. Driver: sign-in, Today's Trips, scanner with torch and typed ticket numbers, scan outcomes, passenger list, pending verification queue. Release builds keep sd.safeer.booking / sd.safeer.driver and the upload key; debug builds use .dev IDs. Tests: 11 shared, 12 Passenger and 13 Driver, including small-phone English/Arabic flows, offline ticket reopening, duplicate and wrong-trip scans. No API or database change.

## Custom permissions for one person, company access when creating a user - D73, 2026-11-12

Company staff can give a person "Custom permissions (this person only)" instead of a ready-made role, for the whole company, one branch or one station. The server keeps them as that person's personal company role, so the existing permission checks, row-level security, last-administrator guard and audit all apply. Only company-wide role managers set them, and never beyond their own permissions. Users > Create user (owner) can choose a company and the same access, creating the account and membership in one step. Staff dialogs now scroll to their error message. No migration; website only, no new APK. Tests: direct-permissions.integration.mjs (2 tests) and direct-permissions.browser.mjs. The concurrent-migration test now contends over one pending migration instead of the whole set, so the release gate no longer fails its 5-second lock wait when the machine is busy.

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

## D103 — Workspace sidebar is the main navigation

On screens 1100px and wider, the header menu button now hides and shows the icon rail and second sidebar (remembered per browser) instead of opening the old drawer. The drawer remains for narrow screens.

## D104 — One workspace layout

The old slide-out drawer is removed from the staff workspace. The icon rail and second sidebar are the only navigation: a column on screens 1024px and wider (the menu button hides and shows it), and a slide-in panel on narrower screens (closes on a choice, the backdrop or Escape). Marketplace, Driver workspace, Refresh and Sign out moved to the bottom of the sidebar. Every staff page uses the minimal look: white surfaces, light grey borders, compact spacing, small radii; main buttons keep the company colour.

## D105 — Profile only in the header

The profile sidebar on the company dashboard is removed; the dashboard uses the full width. Your profile stays in the header menu.

## D106 — Overview without personal details

The workspace Overview no longer shows your profile or the password form. Your profile (name, email, roles, change password) is its own page, opened from the header profile menu or the search. A new account that must change its temporary password lands on that page, then on Overview.

## D107 — Collapsible sidebar keeps the icon rail

On wide screens the menu button now collapses the sidebar to the icon rail (the second sidebar slides away and the page widens smoothly) and expands it back to the full sidebar. Motion is off for people who prefer reduced motion.

## D108 — Whole unread badge

The unread count on the bell was clipped to a quarter circle because buttons clip their contents. The bell now lets its badge show in full, with a thin ring that separates it from the bell.

## D109 — Notification panel opens once

The notification panel replayed its opening animation every time it redrew (when the list loaded, on a filter or after marking read), so it looked as if it popped up twice. The panel is now kept between redraws and only its contents update.

## D110 — Booking and parcel pages connected

- Every passenger page has a fourth tab, **Parcels** (the tracking page); on 1024–1279px screens the top tabs show icons only so they clear the wordmark, and on small phones labels stay on one line.
- The booking page has a **Send a parcel** card explaining drop-off, payment, tracking and collection, with a link to tracking.
- The parcel page shows **How to send a parcel** beside the tracker (side by side on wide screens), links back to choosing a bus company, and its menu links to staff sign-in.
- A tracking result ends with **Track another code** and **Find a bus trip**, so no page is a dead end.

## D111 — One passenger header bar

On screens 1024px and wider, the booking and parcel pages show the menu button, the Safeer wordmark and the Book, Trips, Parcels and Profile tabs in one full-width header bar that stays at the top while scrolling. Phones keep the bottom tab bar. Tests: `headers`, `track` (updated for the bar on wide screens), `marketplace`, `marketplace-regressions`, `booking-hero`.

## D112 — No Back button on passenger pages

The booking and parcel pages no longer show a Back button in the header; the Book, Trips, Parcels and Profile tabs handle navigation. Staff and driver screens keep their Back button. Tests: `app-back` (now checks there is none on passenger pages), `headers`, `track`, `station-sessions`, `marketplace`.

## D113 — App lock in the mobile apps

Safeer Passenger and Safeer Driver have Settings > App lock: Off, PIN (4-6 digits, stored as a salted hash) or Biometrics (fingerprint or face, with the PIN as fallback). The app locks on start and when it goes to the background. Five wrong PINs start a 30-second wait that doubles each time. Details in mobile/UPDATES.md. Tests: safeer_core `app_lock_test.dart`, both app suites, `flutter analyze`.

## D114 — Session manifest and walk-in sale

- **Walk-in sale:** an open counter session has a **Walk-in sale** button beside Close session, and the sale form now comes directly after the session (before "Pay or change a booking"), so staff can sell a seat and take payment from a customer straight away.
- **Manifest:** after a session closes, the employee sees **Your closed sessions** (their last three) with **Print manifest**; session managers have the same button on every closed session. The manifest lists the company, counter, station, who opened and closed it and when, the cash totals and count, then every ticket sold in the session grouped by trip (route, date, time, bus, driver): ticket number, seat, passenger, mobile, journey stops, luggage, booking reference, receipt, payment method, amount paid and status, followed by any refunds, and signature lines. It prints on A4 landscape.
- **Server:** `GET /api/v1/companies/{id}/counter/sessions/{sid}/manifest` (database function `safeer.session_manifest`, migration 0031). Only the employee who opened the session (while still allowed to work that counter) or a session manager for the station can read it, and `company.bookings.read` is also required. An open session returns `SESSION_STILL_OPEN`. The counter overview also returns `recentClosed`.
- Tests: `ticketing` integration (new D114 test), `station-sessions` and `ticketing` browser tests, unit tests (API path count 106).

## D115 — Contracts with a fixed term

- A new contract needs a **start date** (today or later; no backdating) and an **end date** (after the start, at most five years). The form offers 6 months, 1 year, 2 years, 3 years or a custom end date, and a renewal defaults to the day after the current contract ends.
- Issued contracts cannot be edited or deleted (the database already fixed their terms; deletes are now refused too). "Change plan" is now **New contract**: an accepted contract stays in force until the company accepts the new one and it starts; a newer contract withdraws one still waiting for acceptance.
- Each contract shows its **term** and a status: Waiting for acceptance, Starts later, Active, Expired, Replaced or Withdrawn. The current contract card shows its number, fee, commission, term and days left, with a warning 30 days before it ends and when no contract is in force.
- The PDF shows the end date and fixed-term wording; contracts issued before this change keep no end date (month to month).
- Invoices use only an accepted contract in force during the month (migration 0032).
- Tests: `billing` and `invoices` integration (date rules, guard, withdrawal), `billing` browser test, database and platform integration, unit tests.

## D116 — Faster page loading

The build now adds `<link rel="modulepreload">` for every script module each page imports (worked out from the static imports, so the list never goes stale). The browser fetches all of a page's scripts at once instead of finding them one level at a time; the staff workspace has 26 modules five levels deep. `scripts/measure-loading.mjs [origin]` measures each page on a slow phone connection (250 ms latency, about 1.6 Mbps).

## D117 — Cards and pop-ups match the workspace

The home shortcut cards, every create/edit form (`#staff-dialog`), the notification centre and the new-notification card now use the minimal workspace look (plain surface, thin border, small radius, company accent for the main button) in light and dark, instead of the older green glass style. The selected notification filter is filled, unread notifications have an accent edge, and checkbox rows in forms are neutral. The headers browser test adds a temporary spacer when the compact staff home fits a tall screen.
