# Section archives and source checkpoints

Latest login follow-up: [D54 login reliability](LOGIN_RELIABILITY_2026-11-08.md). Source-only checkpoint: archives/Safeer-0.16.0-Login-2026-11-08.zip.

Latest mobile follow-up: [D52 Driver sidebar/fullscreen](MOBILE_FULLSCREEN_2026-11-05.md), source checkpoint archives/Safeer-0.16.0-Mobile-Fullscreen-2026-11-05.zip.


Latest Booking follow-up: [D51 sidebar and Settings](BOOKING_SIDEBAR_2026-11-05.md), source checkpoint archives/Safeer-0.16.0-Booking-Sidebar-2026-11-05.zip. APKs and private runtime remain separate ignored artifacts.


Latest mobile follow-up: [D50 Android update](ANDROID_UPDATE_2026-11-05.md), checkpoint archives/Safeer-0.16.0-Android-USB3-2026-11-05.zip. APKs and private runtime are separate ignored artifacts.


Latest header follow-up: [D49 floating header](FLOATING_HEADER_2026-11-05.md), checkpoint archives/Safeer-0.16.0-Floating-Header-2026-11-05.zip.


Latest placement follow-up: [D48 sidebar position](SIDEBAR_POSITION_2026-11-05.md), checkpoint archives/Safeer-0.16.0-Sidebar-Position-2026-11-05.zip.


Latest reference follow-up: [D47 circular sidebar button](CIRCULAR_SIDEBAR_2026-11-04.md), checkpoint archives/Safeer-0.16.0-Circular-Sidebar-2026-11-04.zip.


Latest follow-up: [D46 marketplace notice](MARKETPLACE_NOTICE_2026-11-04.md). Source checkpoint: archives/Safeer-0.16.0-Marketplace-Notice-2026-11-04.zip, excluding private runtime/credentials.


Latest material follow-up: [D45 reference glass](REFERENCE_GLASS_2026-11-04.md), with source checkpoint archives/Safeer-0.16.0-Reference-Glass-2026-11-04.zip. Earlier checkpoints remain historical; source archives exclude runtime and credentials.


## Latest follow-up: sidebar visibility

Read [D44 handover](SIDEBAR_TOGGLE_2026-11-04.md). The source checkpoint is archives/Safeer-0.16.0-Sidebar-Toggle-2026-11-04.zip, separate from private business backups. Earlier checkpoints remain historical.


2026-11-02 update: D34 closes the historical local-upgrade items for Sections 05-11 below. The existing runtime is verified at 0.12.0 with all migrations applied and its account preserved. The original Section 11 checkpoint remains unchanged; a separate local-update source checkpoint records the backup safeguard/documentation changes. Private runtime backups are excluded from both.

Numbered Markdown entries in this directory are permanent source-controlled handovers. Compressed source ZIPs live under the ignored project `archives/` folder, with SHA-256 sidecars and per-file manifests. The source repository retains history; ZIPs do not include its entire .git database.

- Pre-change checkpoint: `archives/Safeer-0.1.0-before-passenger-scope-2026-10-30.zip`, 16 files from f06a638. This preserves the superseded passenger-plus-freight prototype. Verified SHA-256: `c96957d4d5211abadd2fcf7527d2fc03655ab42dc45da3525583fda40b0ee1f0`.
- Section 01 entry: [SECTION_01_FOUNDATION.md](SECTION_01_FOUNDATION.md).
- Final Section 01 ZIP: `archives/Safeer-0.2.0-Section-01-2026-10-30.zip`, generated and verified at handover. Its manifest records the exact source commit, file hashes and verification receipts. It includes the small historical checkpoint for recovery of intentionally removed freight code.
- Owner-requested luggage declaration addendum: `archives/Safeer-0.2.1-luggage-2026-10-30.zip`, with exact-commit source, current browser evidence, file hashes and checksum. This preserves rather than replaces the original Section 01 checkpoint; it does not begin Section 02 or implement Section 11 station operations.
- Section 02: [identity handover](SECTION_02_IDENTITY.md), with separate `archives/Safeer-0.3.0-Section-02-2026-10-30.zip` generated/verified at handover. Includes previous verified source and current test evidence; excludes runtime users, credentials, first-login text and native caches. Section 03 is not started.

To continue, extract into a new folder, read docs/CURRENT_STATE.md first, run npm ci, npm test and npm run build. Do not point integration tests at real operational databases. Follow database/MIGRATIONS documentation for a disposable local PostgreSQL instance. Keep real business-data backups separately and securely; no runtime credentials or customer databases belong in a source archive.

- Section 03: [company access handover](SECTION_03_COMPANIES.md), separate `archives/Safeer-0.4.0-Section-03-2026-10-31.zip` with current source, exact commit and verification evidence; private database backups are excluded. Stop before Section 04.

[Section 04 routes](SECTION_04_ROUTES.md) records the city/route implementation and final verification. Stop before Section 05 until approved.

[Section 05 fleet](SECTION_05_FLEET.md) records the bus, seat-layout and driver implementation, final verification and the open local upgrade step. Stop before Section 06 until approved.

[Section 06 trips](SECTION_06_TRIPS.md) records trip scheduling, final verification and the open local upgrade step. Stop before Section 07 until approved.

[Section 07 marketplace](SECTION_07_MARKETPLACE.md) records the public pages, final verification and the open local upgrade step. Stop before Section 08 until approved.

[Section 08 seat holds](SECTION_08_RESERVATIONS.md) records the hold engine, final verification and the open local upgrade step. Stop before Section 09 until approved.

[Section 09 passengers](SECTION_09_PASSENGERS.md) records passenger details, retrieval, erasure, final verification and the open local upgrade step. Stop before Section 10 until approved.

[Section 10 ticketing](SECTION_10_TICKETING.md) records counters, payments, tickets, refunds, final verification, questions for the owner and the open local upgrade step. Stop before Section 11 until approved.

[Section 11 luggage](SECTION_11_LUGGAGE.md) records bags, tags, tracking, problems, final verification and the open local upgrade step. Stop before Section 12 until approved.

[Section 12 boarding](SECTION_12_BOARDING.md), [Section 13 finance](SECTION_13_FINANCE.md), [Section 14 platform](SECTION_14_PLATFORM.md) and [Section 15 release](SECTION_15_RELEASE.md) record the driver workspace, financial reports, platform administration and release checks.

[Android USB](ANDROID_USB_2026-11-04.md) records the D40 Driver and Booking phone apps. [Bento grid and liquid glass](BENTO_GLASS_2026-11-04.md) records the D41 visual refresh.

[Black and brown palette](BLACK_BROWN_2026-11-04.md) records D42 and the matching USB Android patch.

[Sticky liquid-glass headers](STICKY_HEADERS_2026-11-04.md) records D43.
