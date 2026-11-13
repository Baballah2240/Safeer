# Safeer

- D79 (2026-11-13): the booking home is search-first: 64px header, one-layer hero with a clear photo (no text over it), the 24px heading and the search card all on the first screen; from 1024px the passenger Book/Trips/Profile navigation is a top-right pill (booking and tracking), on phones a bottom bar that must never cover the search. Keep tests/booking-hero.browser.mjs passing (npm run test:booking-hero:browser) for header, hero, search or navigation changes.

- D78 (2026-11-13): the Flutter apps are the published Safeer apps: Safeer Passenger (sd.safeer.booking) and Safeer Driver (sd.safeer.driver), both 0.19.0/19000, GitHub release v0.19.0 (Safeer-Booking-0.19.0.apk, Safeer-Driver-0.19.0.apk). npm run mobile:build builds them (mobile/flutter/tool/build-release.mjs) and npm run mobile:save checks package, version and the upload certificate, then regenerates src/app-release.js; raise the pubspec version code above the last release for every update and keep the Settings label in lib/src/app.dart equal to it (mobile:save checks). The WebView apps in mobile/android are retired: a "SafeerApp/" user agent sees only src/app-retired.js's download screen; never build or publish them again. The Flutter apps still lack shipments, company pages, booking lookup, accounts, driver notifications/incidents/departure-arrival and an in-app update notice. Run npm run test:app-retired:browser and test:home:browser for these pages.

- D76 (2026-11-12): the warm palette supersedes D71 and every earlier palette everywhere: sand #FAF5EC/#F3E9D8/#E8D9BF, orange #E8772A (accents) and #B9530F (filled buttons, white text), deep green #123A2D/#1F5D49, charcoal #1D211F/#4E5651; dark mode charcoal green #0E1311/#161D1A with orange #F4A261 accents. Change colours through src/tokens.css where possible and keep text pairs at WCAG AA. / is the public home page (home.html, src/home.*; no inline styles or scripts, CSP stays strict); the old demo is /demo. Current apps: see D78. Run npm run test:home:browser for home page changes.

- D75 (2026-11-12): the privacy policy, the deletion page and the booking home page are what Google's brand verification reads for the passenger sign-in consent screen; keep them describing Google sign-in accurately (account ID, email and name only; no photo kept) with the Limited Use statement. Profile has Delete account (DELETE /api/v1/passenger/account). Owner setup for Google is in docs/HOSTING.md. Run npm run test:passenger-privacy:browser and passenger-google.integration.mjs for passenger account or legal page changes.

- D73 (2026-11-12): staff can get "Custom permissions (this person only)" instead of a ready role, in Company staff or Users > Create user (the owner picks the company). The server stores them as a personal company role (code personal_<id>, workspace roles personal:true) assigned only to that member; only company-wide roles.manage holders set them, never beyond permissions they hold company-wide. Keep personal roles out of Company roles and role pickers, and never delete roles. Run npm run test:direct-permissions and test:direct-permissions:browser for member or role changes.

- D72 (2026-11-12 audit): public hold/lookup/release limits are per visitor (client(req) in the API; edgeClient in server.mjs trusts CF-Connecting-IP only from Cloudflare's published ranges). The Android shell may leave the app only for GitHub release downloads and user-tapped tel:/mailto: links. Company time zones must be named regions in pg_timezone_names, never offsets. Run npm run test:workflow and npm run test:production for proxy, API or startup changes, and npm run check:live (read-only) to see which commit the live site serves. See docs/testing/QUALITY_AUDIT_2026-11-12.md.

- D66 supersedes D60 coupled app releases for this update: Driver 0.18.0/18000, Booking stays 0.17.0/17000. Use mobile:build:driver then mobile:save:driver; publish only the Driver APK/checksum. Keep per-app version metadata, optional video-only camera restricted to Driver /driver, server-authorized/idempotent boarding, manual confirmation fallback, D59 shipments and no fabricated ETA. The owner declines physical-phone testing. See docs/archive/DRIVER_TRIP_DASHBOARD_0.18.0_2026-11-10.md.

- D64 supersedes the black/brown palette for Booking and Driver app surfaces: use the exact owner-provided violet/blue/pink/yellow glass colors. Passenger /booking is My Trips; Book/Trips/Profile keep existing routes and guest access. Migration 0017 adds proof-checked schedule/paid-ticket presentation: never expose QR to reference/mobile lookup or unpaid/refunded/cancelled bookings, and never fabricate a QR. Keep Driver distinct and preserve D59 shipments. See docs/archive/MY_TRIPS_GLASS_0.17.0_2026-11-10.md.


- D74: Flutter Passenger/Driver apps live in mobile/flutter (pub workspace; Flutter 3.47.9 is installed at C:/Users/Lenovo/dev/flutter). Keep the D71 navy/sky-blue colours (D77: the owner kept them after D76 changed the rest of the project; do not convert them) and bundled Inter/Noto Sans Arabic, the server-decided booking/QR/boarding rules and demo data in debug builds. Run flutter analyze and flutter test in packages/safeer_core and both apps; for API or boarding changes also run npm run test:flutter:live with SAFEER_TEST_DATABASE_URL (local disposable server only). D78: the owner made them the published apps. See mobile/flutter/README.md.

- Mobile apps returned from Codex to Claude on 2026-11-12: read docs/archive/MOBILE_HANDOVER_2026-11-12.md first (the 2026-11-09 handover and continuation are history). Work from the Safeer repository clone, never the Stocrant copy.

- D60: after every website app build run npm.cmd run mobile:save, commit the regenerated src/app-release.js, and attach both APKs to the GitHub release tag v<versionName>. Never commit APKs or the upload key. The repository is intended to be public: keep secrets and real personal data out of tracked files.

- D57: installed apps connect to https://safeer.mohbaba.online; USB is only for installation. npm.cmd run mobile:build/mobile:save build the signed website channel; (D78: the USB debug channel is retired with the WebView apps.) Never commit the upload key. Shipments (D59) are built: see docs/workflows/SHIPMENTS.md; run test:shipments and test:shipments:browser for changes.
- D58: phone workspace sidebar is an off-canvas panel (closed by default, modal, side slide-in); the app passes the cutout height as --safe-top. Keep the show-password button type=button so the sign-in lock still targets submit. Run tests/sidebar.browser.mjs for menu changes.


- D52 supersedes Driver toolbar retention: both clients now use shared sidebar/Settings and immersive fullscreen with normal swipe-reveal/exit, safe cutout/IME insets and drawer-first Back. Version .5/16005. Keep assigned-driver authority and operational actions intact; run Driver/Booking drawer, boarding and header checks.


- D51 Booking uses an accessible modal drawer with Settings and no native title/Home/Refresh/Print toolbar; Driver retains its toolbar. Native version .4/16004. Preserve Escape/focus return, entered forms, RTL and flavor-specific security/recovery. Run the Booking menu and affected public/reservation/header browser checks.


- D50 updates both local USB clients to 0.16.0-usb.3/16003. Preserve replacement installation and signing compatibility, keep APKs/private device details excluded from source and retain loopback/USB dependence.


- D49 supersedes D43 top:0: preserve a 12px desktop/10px mobile floating header gap, include it in focus scroll clearance, and keep the above-sidebar toggle clear of actions. Existing header/sidebar regressions cover this layout.


- D48 places the toggle above navigation in .sidebar-column, outside the hidden aside/header actions. Keep restoration visible without covering header controls, responsive RTL/LTR and print isolation. Run sidebar and sticky-header regressions for layout changes.


- D47 makes the sidebar toggle circular and icon-only, retaining 44px targets, accessible translated labels and D44 behavior. Preserve this reference style and run the targeted sidebar regression for behavior changes.


- D46 refines the public marketplace service notice. Keep bilingual admin settings, plain-text escaping, aligned margins, long-message wrapping and opaque/print fallbacks; tests/platform.browser.mjs covers the notice workflow. No new ad integration.


- D45 refines shared tokens/theme to the owner?s frosted-glass reference. Preserve contrast, opaque accessibility/unsupported-blur fallbacks, sticky headers, sidebar toggle and operational panel readability. No native change.


- D44 adds a header sidebar toggle in staff and fictional preview. Preserve saved visibility, no-form-re-render behavior, keyboard/ARIA and RTL/LTR. Run tests/sidebar.browser.mjs with disposable fixtures for regression. No native change.


- Independent Sudan passenger-transport project. Do not edit Stocrant or the school-display application for Safeer work.
- Current authorized stage: Section 15 (D39), USB Android apps (D40) and the verified bento/liquid-glass shared UI refresh (D41) are complete locally. Keep the service loopback-only and preserve users/data. No hosting or store release is authorized; stop pending the owner's next instruction.
- D43 adds verified sticky Apple-inspired glass headers in the shared theme. D49 uses a floating top gap; preserve wrapped-height focus offsets and black/brown; npm.cmd run test:headers:browser covers the regression.
- Keep the service on 127.0.0.1. No deployment, external accounts, SMS delivery or online payment integration is authorized yet.
- Owner's current visual palette is black and brown (D42): near-black/espresso dark mode, cream/brown light mode, brown branding/actions and native Android shell. Preserve the bento/glass layout and semantic warning/error/seat distinctions.
- Follow docs/decisions/MASTER_INSTRUCTIONS_2026-10-30.md. Release 1 is passenger transport and passenger luggage only; freight/parcels are deferred. Record changes in docs/DECISIONS.md before implementing them.
- Support multiple companies from the start. Production access must be enforced on the server using authenticated company membership, never a browser company selector.
- Companies choose unpaid-reservation deadlines. Calculate expiry from timestamps and release seats when a hold expires.
- Online purchases and payment collection are outside the passenger app's scope. Issue a reservation reference first; only authorized staff may confirm offline payment, after which the final travel ticket and payment receipt can be issued. Follow the implemented D32 payment controls; later financial policy changes need explicit agreement.
- Keep responsive web/mobile-facing code together in src/. Android local USB launchers live in mobile/android/ and reuse the running shared web application. Update mobile/UPDATES.md, build/lint, run npm.cmd run mobile:save, and verify install on the intended USB device. Never commit APKs, Gradle caches, SDK paths or signing material.
- Use invented demonstration data only. Do not store passenger IDs, real customer data, tokens or credentials in fixtures or source control.
- Work one numbered section at a time. The owner's latest "next" approves SECTION 15 (D39), preserving existing money rules and scoped driver/finance controls. Test, document and archive the completed local checkpoint, then stop. Deployment or later features need a new owner instruction.
- Owner-authorized follow-up: the passenger prototype collects a luggage yes/no declaration and required description (1-300 trimmed characters when yes). This does not authorize full Section 11 operations or Section 02; see D16 in docs/DECISIONS.md.
- Update docs/PROJECT_MASTER.md, DEVELOPMENT_ROADMAP.md, DATABASE_SCHEMA.md, BUSINESS_RULES.md, SYSTEM_ARCHITECTURE.md, CHANGELOG.md, CURRENT_STATE.md, DECISIONS.md and the relevant docs/archive/SECTION_*.md at each section handover.
- Validate relevant domain behavior with npm test, the build and affected browser checks. Apply/test executable migrations on an isolated PostgreSQL instance; do not claim proposed tables or future access controls are implemented.
