# Current state - read this first

Updated: 2026-10-30. Safeer / Sudan Transport, version 0.3.0.

## Current section and gate

The owner explicitly approved Section 02 (authentication, users, roles and permissions) by answering "next". Section 02 is complete: tested and documented, with a verified exact-commit source checkpoint generated at handover. Do not begin Section 03 without explicit approval.

## What works

- NestJS 12.3.2 / TypeScript 6.0.3 local identity API and bilingual staff interface at /staff.
- PostgreSQL users, hashed/revocable sessions, eight built-in role templates, six implemented identity permissions, configurable platform roles and immutable identity audit.
- Sign-in/out, mandatory temporary-password change, own session list/revocation, user creation/edit/disable/password reset, platform role assignment/create/edit and recent audit view, subject to server permissions/current-password checks.
- Scrypt hashes; strict input validation; same-origin/CSRF protection; durable login/reauthentication limits; bounded hashing; absolute/idle session expiry; immediate grant/account revocation; expected-version edits; last-owner protection under a transaction lock.
- One-time generated local owner bootstrap and privileged local owner recovery. No fixed account password or unauthenticated web bootstrap.
- Private persistent Windows development PostgreSQL launcher: npm run local. Migration owner and restricted API DB credentials are separate; ignored runtime/ is limited to the current Windows user/SYSTEM.
- Preserved passenger/luggage example, Arabic/English views, unpaid reference/print, expiry/cancellation. It remains fictional and separate from staff identity.

## How to run

Install Node 24+ and run npm ci, then npm run local from this folder on Windows. Open http://127.0.0.1:4320/staff. On the first fresh startup, fictional owner@safeer.local and a generated temporary password are saved privately to runtime/first-login.txt. Change it at first sign-in; do not put this file into Git, an archive or customer handover. Stopping the launcher stops the PostgreSQL process it started while preserving data for the next launch.

npm start alone still serves the passenger prototype without identity. For existing PostgreSQL, use [IDENTITY_SETUP](database/IDENTITY_SETUP.md). Ports 4320/4321 and the private DB port are loopback only. No remote deployment is configured.

## Database status

Migrations 0001_foundation.sql and 0002_identity.sql are executable. Eight identity tables exist; the migration ledger is separate. Runtime grants allow only required identity DML, cannot update/delete audit or alter the permission catalog, and cannot create schema objects. No company/membership, branch/station, booking, payment, registered luggage or boarding table exists.

Company/branch/station/trip roles are templates only and cannot be assigned globally. Scoped company roles, memberships, support grants and RLS begin in Section 03. Platform support defaults to identity users/roles read only and has no financial authority.

## Verification status

- Dependency reproduction: npm ci --offline --ignore-scripts passed from the lockfile; 123 packages installed.
- Current unit/security suite: 13 passed, including password salts/work limits, cookies/CSRF, private assets and malformed request-target recovery, plus retained passenger/luggage regression.
- Native PostgreSQL migration/identity suite: 19 passed with no skips, using disposable databases and real restricted runtime roles. Covers transactional migrations, scope/FKs, session rotation/expiry/revocation, Origin/CSRF, durable throttling, current-password checks, delegated permissions, owner-template/last-owner concurrency, audit and owner recovery.
- Strict TypeScript API build and 12 public assets passed; no native mobile application was built.
- Staff browser workflows passed on source and built assets: real login, one-time credentials, users, role assignment/create/edit, temporary-password change, support restrictions, session revocation, account switching, expired-form recovery, escaped names and EN/AR at 1920x1080, 1366x768 and 390x844. Screenshots never include temporary passwords.
- Passenger/luggage browser checks passed on both source and built assets.
- Windows local launcher: restricted current-user/SYSTEM ACL verified; one account/eight templates and first-login details survived two supervised restarts; owned database/web/API processes stopped cleanly. The persistence test fixed repeated ACL hardening so already-private ACLs are verified instead of rewritten.
- Documentation: 11 mandatory records and links across 24 Markdown files passed.
- Runtime dependency audit: zero known advisories reported on 2026-10-30. This is not a production security certification.
- Source patch hygiene passed. Final ZIP CRC/per-file SHA-256, exact commit and exclusions are verified at checkpoint generation under ignored archives/.

## Remaining boundaries

This is local development authentication. HTTPS/proxy trust, email/SMS reset, MFA, Flutter token/keychain delivery and final production/load/security audit are not enabled. Local HTTP cookies intentionally omit Secure and must not be used remotely. Company access does not exist yet: a template or demo selector grants no company membership.

Real passenger data, multi-seat/guest-mobile bookings, station money/tickets, registered luggage/tags/tracking, boarding and production hosting remain later sections. The passenger example resets on refresh. No Stocrant or school files change for this work.

## Exact next task after handover

Stop and wait for Section 03 approval: companies, branches, stations and company isolation. Then add company/membership/resource tables, scoped roles and support grants, composite same-company FKs, runtime RLS and cross-company/resource tests. Do not add booking/payment modules early. Read the master plan, decisions, this file and Section 02 archive before continuing.
