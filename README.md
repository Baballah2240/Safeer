# Safeer / Sudan Transport

Headers now float 12px below the top (10px on phones), with softer translucent glass and visible rounded edges. See [D49 handover](docs/archive/FLOATING_HEADER_2026-11-05.md).


The circular sidebar button now sits above navigation, staying in the upper leading corner while collapsed. See [D48 handover](docs/archive/SIDEBAR_POSITION_2026-11-05.md).


The sidebar toggle is now a circular icon-only glass button matching the supplied reference. See [D47 handover](docs/archive/CIRCULAR_SIDEBAR_2026-11-04.md).


Marketplace notices now align with the header/search and use a compact accessible glass announcement. See [D46 handover](docs/archive/MARKETPLACE_NOTICE_2026-11-04.md).


The shared interface now follows the owner?s frosted-glass reference: translucent lenses, fine highlights and rounded pill controls. See [D45 handover](docs/archive/REFERENCE_GLASS_2026-11-04.md).


The staff and fictional-preview headers include a Hide sidebar / Show sidebar button, with a saved device preference. See [D44 handover](docs/archive/SIDEBAR_TOGGLE_2026-11-04.md).


## Sticky glass navigation

The black/brown glass headers stay at the top while scrolling on desktop and mobile. The existing USB apps receive the shared update on Refresh. See [header verification](docs/archive/STICKY_HEADERS_2026-11-04.md).


## Current appearance

Black and brown: espresso/near-black surfaces, brown glass actions and a cream/brown light theme. The bento layout is retained, and both USB phone apps are updated to 0.16.0-usb.2. See [palette evidence](docs/archive/BLACK_BROWN_2026-11-04.md).


Version 0.16.0, Section 15: verified local passenger transport with full database-security checks, safe maintenance health, connected/recovery tests and release tooling. Existing company, station, driver, luggage, finance and platform workflows are preserved.

Start continuation at [CURRENT_STATE](docs/CURRENT_STATE.md) and [platform workflow](docs/workflows/PLATFORM_ADMINISTRATION.md). Preserve runtime/ and the existing account. Section 15 is verified and running locally with the existing account preserved; see CURRENT_STATE and the Section 15 handover for measured evidence. Deployment and later features require a new instruction. A source ZIP never contains existing users/passwords/history.

Run the complete offline verification with npm.cmd run verify:release. See [release operations](docs/RELEASE_READINESS.md) for required local tools, health, backup/recovery and remote-release prerequisites.

The D40 USB follow-up adds installed **Safeer Driver** and **Safeer Booking** Android test apps using this same local service. Keep the computer/cable connected and run npm.cmd run mobile:usb after reconnecting. See [Android setup, builds and installation](mobile/README.md). This does not publish Safeer online or create driver accounts automatically.

The shared interface now uses bento-grid tiles and liquid-glass controls, headers and sidebar. Both themes, Arabic/English and the installed USB apps are verified; refresh the existing app screen to load the new design. See [the visual refresh handover](docs/archive/BENTO_GLASS_2026-11-04.md).

## Run locally on Windows

Install Node 24+, then from this folder:

    npm.cmd ci
    npm.cmd run local

Open http://127.0.0.1:4320/staff. On a fresh local database, the fictional first owner is owner@safeer.local. Its generated temporary password is saved privately to runtime/first-login.txt; change it at first sign-in. No fixed default password exists. Do not commit, archive or share runtime/.

The launcher creates a persistent private PostgreSQL development database, applies migrations with a separate owner, uses a limited API runtime login and starts loopback web/API servers. Ctrl+C stops processes started by it while preserving data. For existing PostgreSQL, custom ports, bootstrap, privileged owner recovery and backup boundaries see [IDENTITY_SETUP](docs/database/IDENTITY_SETUP.md).

## Implemented staff identity

- Real NestJS/TypeScript backend, PostgreSQL identity/session/role/permission/audit storage and bilingual responsive staff UI.
- Sign-in/out, mandatory temporary-password change, active-session list/revocation and password reset by authorized administrators.
- User creation/edit/deactivation, platform role assignment and configurable platform roles/permissions; protected owner/last-owner rules and audited privileged changes.
- Adaptive salted scrypt, bounded hashing, durable throttling, strict inputs, opaque hashed sessions, expiry/revocation, Origin/CSRF protection and same-origin HttpOnly cookies.
- Nine built-in templates. Platform assignments stay separate from company/branch/station memberships and current driver-trip assignments. Support has no default finance access.

This is local development, not remote production deployment. Loopback HTTP cookies intentionally omit Secure. HTTPS/proxy trust, MFA, email/SMS reset delivery, mobile token/keychain flows and final load/security auditing require further work before remote use.

## Preserved passenger example

The public example at http://127.0.0.1:4320 still supports fictional sample trips, one seat/name per reservation, company example hold policies, expiry/cancellation and printable unpaid references. It includes a luggage yes/no declaration and a required description when yes (1-300 trimmed characters). All passenger example data resets on refresh and is not shared between users/devices. The company selector is not authentication or tenant security.

npm start serves this example alone without identity. The staff route displays a service-unavailable message until the identity service is running; it does not fake sign-in.

## Approved release model and remaining sections

One central marketplace, company public booking pages and independent private operations. Release 1 is passenger transport and linked passenger luggage; freight/parcels are deferred. The local responsive app implements guest multi-passenger booking, company RLS/memberships, station offline payment/tickets/receipts, luggage, driver operations, finance and platform administration. Next.js migration and Flutter clients are not implemented. Follow the [15-section roadmap](docs/DEVELOPMENT_ROADMAP.md) and [current state](docs/CURRENT_STATE.md) for the verified checkpoint and remote-release prerequisites.

## Checks and records

- npm test / npm run build / npm run check:docs
- npm run test:db / npm run test:identity on disposable loopback PostgreSQL only
- npm run test:identity:browser and npm run test:browser; SAFEER_BROWSER_BUILT=1 selects built assets
- npm audit --omit=dev

Read [database/schema](docs/DATABASE_SCHEMA.md), [security](docs/security/ACCESS_CONTROL.md), [Section 02 tests](docs/testing/SECTION_02_TEST_PLAN.md), [API contracts](docs/api/CONTRACTS.md), [decisions](docs/DECISIONS.md) and [archive records](docs/archive/README.md). Source ZIPs/checksums exclude credentials, databases, native binary caches, node_modules and temporary profiles. Source copies do not include your registered users; database backups are separate.


## Company workspaces

Open **Companies** in the staff sidebar. Super Admin creates and approves a company, configures its profile/hold/timezone/language, adds branches/stations and then staff with scoped company roles. Ordinary users see only their approved assigned companies; a single assignment opens directly without a chooser. Company membership changes never reset shared global passwords or deactivate access to other companies.

Support access is explicit, read-only, reasoned, expiring (1-24 hours) and revocable. Company events are audited. See [company workflow](docs/workflows/COMPANY_ACCESS.md) and [Section 03 security](docs/security/ACCESS_CONTROL.md). Existing users/passwords are preserved on upgrade; keep a private database backup before applying migrations. The passenger reservation preview remains separate fictional data.

Route workflow: Super Admin -> Cities & destinations -> add cities -> Companies -> Branches & stations -> assign cities -> Routes & stops -> create and order stops. Existing company roles need explicit route grants. See [route planning](docs/workflows/ROUTE_PLANNING.md).

## Section 12 local driver workspace

Version 0.13.0 adds /driver for assigned-trip ticket verification, boarding, departure/arrival and incidents. Read [driver setup and use](docs/workflows/DRIVER_BOARDING.md) and [current verification status](docs/CURRENT_STATE.md). Use the existing staff account and password; managers link driver records to members and grant explicit permissions. Flutter and remote access are deferred.

## Section 13 Finance

Source 0.14.0 adds Companies → Finance: scoped financial reports and read-only cash reconciliation over existing payments/refunds/sessions. See [financial workflow](docs/workflows/FINANCIAL_REPORTS.md) and [verified running status](docs/CURRENT_STATE.md). Existing company roles need an explicit company.finance.read grant; no payment/refund or session-closing rights are added.
