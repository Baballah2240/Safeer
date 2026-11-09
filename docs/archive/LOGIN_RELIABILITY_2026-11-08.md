# D54 - Login reliability

Date: 2026-11-08 (Asia/Riyadh). Scope: Staff and Driver login, local access recovery, source publication authorized by the owner.

## Problem and change

Failed sign-in and language changes replaced the form and discarded entered details. Staff startup session checks and language re-renders also allowed premature or duplicate login requests. A shared ephemeral form controller now retains field values across re-renders, serializes sign-in, preserves the email after invalid/offline responses and clears rejected passwords. Driver does not reset the whole session state on an invalid login response. Both clients wait for the initial session check to finish before enabling sign-in.

No password is embedded in HTML, browser storage, fixtures, source or archives. Existing server authentication, CSRF, hashing, throttling, permissions, accounts and business data are unchanged. The local owner password was recovered separately after explicit approval, using the existing privileged recovery tool with an affected-account/session snapshot kept privately in ignored runtime/. It requires password change and revokes old owner sessions.

## Verification

- npm run check: 17 unit/server checks, API/static build and documentation links pass.
- Source login browser regressions pass across Staff/Driver, desktop/mobile, language changes, pending submission locks, invalid/offline retry and successful sign-in.
- All 12 real PostgreSQL identity integration tests pass. The existing built staff browser suite passes 60 language/theme/layout combinations; the Driver menu suite passes 32 signed-in/out layouts. Focused login browser regressions pass against both source and built assets. The release runner now includes the login regression.
- Local web/API service restarted successfully on 127.0.0.1:4320/4321; all 37 served public assets match the build manifest. The recovered owner temporary login was verified, then its verification session was signed out.

The database tests use a new isolated PostgreSQL cluster and fictional identities, not persistent runtime/. No schema migration, native APK rebuild/installation, hosting or store deployment is part of this follow-up. Shared installed USB clients receive the web changes on refresh while connected to the local service.

## Checkpoint

Scoped tracked source is committed and pushed on the existing main branch. A source-only ZIP is generated under ignored archives/ after verification. Private credentials, runtime, test databases, screenshots, native caches and APKs remain excluded.
