# Section 02 - authentication, users, roles and permissions

Date: 2026-10-30. Authorization: the owner's "next" after the explicit Section 02 offer. Status: complete; tested/documented, verified source checkpoint generated at handover. Section 03 is not started.

## Scope and implementation

Added the NestJS/TypeScript identity module, PostgreSQL repositories and restricted runtime grants. Staff UI at /staff covers real local sign-in/out, mandatory temporary-password change, user administration, configurable platform roles/permissions, session ownership/revocation and recent identity audit. Eight role templates are seeded; non-platform assignments are rejected until company/resource membership exists in Section 03. Follow-up 0.3.1 permits Super Administrator edits of every role template; reserved authority and the last active owner remain protected under concurrent mutations.

Passwords use salted scrypt and bounded asynchronous work. Sessions are opaque, hashed in the database, idle/absolute expiring and revocable; permissions and credentials are rechecked server-side. Privileged mutations reauthenticate and reauthorize, enforce versions, require exact Origin/CSRF and write credential-free audit. Runtime credentials cannot create schema objects, update/delete audit or alter the catalog. Local tooling supports one-time bootstrap, persistent private Windows PostgreSQL and privileged audited owner recovery.

Preserved the separate fictional passenger/luggage example. No real booking, company membership/RLS, payment, official ticket, registered luggage or mobile application module is implemented. Local loopback HTTP is a development exception and is not remote HTTPS readiness.

## Changes and APIs

Source groups: apps/api/src and tsconfig; migration 0002_identity; runtime-grant/recovery/launcher tooling; staff HTML/JS/CSS/translations and public allowlist/proxy; package/lock/build/test changes; OpenAPI and mandatory continuation/security/schema/API/mobile documents. See CHANGELOG, FOLDER_STRUCTURE and API contracts for the complete current map.

Identity tables: users, sessions, roles, permissions, role_permissions, platform_user_roles, identity_audit, auth_throttles. Original migration 0001 remains unchanged. All company/business tables remain future designs. API operations: liveness, login/me/logout/password, own sessions/revocation, identity users/create/edit/reset/platform assignment, roles/create/edit, permission catalog and recent audit. There is no web bootstrap/reset shortcut.

## Verification, findings and archive

Final checks: 13 unit/security tests, 19 native PostgreSQL migration/identity tests, source/built staff and passenger browser workflows, strict API/static build (12 assets), 11 required documents/24 Markdown files, zero known runtime dependency advisories and offline lockfile reproduction passed. Local private ACLs and persistent owner/template/credential state across two supervised restarts were verified. Detailed evidence/limits are recorded in CURRENT_STATE. The initial native run passed the new identity scenarios but exposed two old one-migration test expectations, corrected for the new identity migration; all 19 subsequent native checks passed. Browser checking found that account switching retained the previous navigation tab; the session context now clears on logout/revocation and starts at profile. Guarded refresh sequencing prevents stale tab requests overwriting new views, and expired form requests recover to sign-in without retaining credential dialogs. Tests wait for asynchronous role metadata before filling the editor. Local restart checking fixed repeated Windows ACL hardening: existing private rules are verified without rewriting them. Review also moved malformed request targets into a guarded 400 response so they cannot reject the server callback. No unresolved critical/high defect is known in the completed local identity scope.

Source checkpoint: ignored archives/Safeer-0.3.0-Section-02-2026-10-30.zip with exact-commit manifest, per-file hashes and checksum. The previous verified 0.2.1 source is retained. No runtime database, credentials, first-login text, node_modules, native binaries or temporary browser profiles are included. Archive integrity is finalized at handover.

## Next section

Stop after Section 02 and wait for explicit approval for Section 03: companies, branches, stations, membership and company isolation. Do not implement later business modules automatically.


## 0.3.1 - Super Administrator role editing

Owner-authorized D20 follow-up: Super Administrators can edit names, permissions and status of all eight built-in role templates and custom platform roles. Reserved owner codes/scopes remain immutable, owner authority always includes the permission catalog, and disabling the last active owner is rejected atomically. Other administrators remain restricted. Company/resource assignment remains deferred to Section 03; no schema migration or company access is added. The role editor supports Arabic/English and mobile layouts.


0.3.1 verification: 13 unit/server checks and 19 native PostgreSQL/identity checks passed; build, documentation links and offline locked install passed. Real source and built Chrome checks passed for Super Administrator owner/company role edits, restricted support UI, and Arabic/English at 1920x1080, 1366x768 and 390x844 with no uncaught browser errors. Follow-up checkpoint: `archives/Safeer-0.3.1-role-editing-2026-10-30.zip` (generated from the committed source, credentials/runtime excluded).


## 0.3.2 - Connected workspace layout

D21 follow-up checkpoint: archives/Safeer-0.3.2-workspace-2026-10-30.zip, generated from committed source with hashes/CRC verification. The layout connects existing identity workflows and the fictional passenger preview; it does not implement company membership or live booking/payment modules.


0.3.2 validation: 13 unit/server checks, TypeScript/API/public build and documentation links passed. Source and built staff browser workflows passed across 30 layouts each (five screens, Arabic/English, three viewports). Search/scope filters, role links, Super Administrator edits, restricted support views, session/password workflows, keyboard dismissal and language-preserving round trips passed with no uncaught errors. Passenger source/built reservation, luggage, escaping and printing regressions passed. No schema or authorization changes required repeating migrations.
