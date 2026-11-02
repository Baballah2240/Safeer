# Safeer / Sudan Transport

Version 0.6.0, Section 05: company buses, immutable seat-layout revisions and drivers, built on the existing company, route and identity system. This independent Sudan passenger-transport project does not modify Stocrant or the school application.

Start continuation at [CURRENT_STATE](docs/CURRENT_STATE.md). Section 05 is authorized by the latest "next". Stop before Section 06 after its handover. To upgrade an existing local database, stop the launcher, then run npm.cmd run local:backup -- Section-05 followed by npm.cmd run local.

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
- Eight built-in templates. Platform assignments stay separate from company/branch/station memberships; trip roles wait for real trips. Support has no default finance access.

This is local development, not remote production deployment. Loopback HTTP cookies intentionally omit Secure. HTTPS/proxy trust, MFA, email/SMS reset delivery, mobile token/keychain flows and final load/security auditing require further work before remote use.

## Preserved passenger example

The public example at http://127.0.0.1:4320 still supports fictional sample trips, one seat/name per reservation, company example hold policies, expiry/cancellation and printable unpaid references. It includes a luggage yes/no declaration and a required description when yes (1-300 trimmed characters). All passenger example data resets on refresh and is not shared between users/devices. The company selector is not authentication or tenant security.

npm start serves this example alone without identity. The staff route displays a service-unavailable message until the identity service is running; it does not fake sign-in.

## Approved release model and remaining sections

One central marketplace, company public booking pages and independent private operations. Release 1 is passenger transport and linked passenger luggage; freight/parcels are deferred. Real bookings must support guest full-name/mobile entry and multiple passengers/seats. Authorized station employees confirm offline payment before official tickets/receipts. These business modules, company RLS/memberships, Next.js and Flutter clients are not implemented yet; follow the [15-section roadmap](docs/DEVELOPMENT_ROADMAP.md).

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
