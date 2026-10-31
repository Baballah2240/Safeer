# Implemented API contracts

Canonical OpenAPI 3.1: [src/contracts/openapi.json](../../src/contracts/openapi.json), version 0.3.3. It records only implemented operations, request fields, cookies/CSRF, envelopes and response schemas. Requests are strict JSON with an 8 KiB limit. Responses use {data: ...} or {error:{code,message}}; no SQL, token or password details are logged in errors. Successful one-time credential responses are explicit exceptions intended only for the authorized administrator.

## Section 02 routes

| Method | Path under /api/v1 | Rule |
| --- | --- | --- |
| GET | /health | Public local process/database mode; not production readiness |
| POST | /auth/login | Exact local Origin, valid credentials, persistent throttling; HttpOnly session cookie |
| GET | /auth/me | Valid active session; own principal/effective permissions and CSRF |
| POST | /auth/logout | Own session plus Origin/CSRF; revoke and clear cookie |
| POST | /auth/password | Current/new password plus Origin/CSRF; revoke old sessions and rotate current cookie |
| GET | /auth/sessions | Own active sessions only |
| DELETE | /auth/sessions/{id} | Own session only plus Origin/CSRF |
| GET, POST | /identity/users | users.read or users.manage; create requires current password |
| PATCH | /identity/users/{id} | users.manage, current password, expected version and owner safeguards |
| POST | /identity/users/{id}/password | users.manage, current password/version, another user; one-time temporary password |
| PUT | /identity/users/{id}/roles | platform_roles.assign, current password/version, active platform roles and delegation/owner rules |
| GET, POST | /identity/roles | roles.read or roles.manage; create requires current password and permission subset |
| PATCH | /identity/roles/{id} | roles.manage, current password/version; Super Administrators can edit every scope; owner authority persists independently of editable grants; last-owner protection applies |
| GET | /identity/permissions | roles.read; implemented identity catalog only |
| GET | /identity/audit | audit.read; latest 100 identity events without credential payloads |

Permission names above are prefixed identity. GET users returns up to 50 items and nextCursor; pass after=<UUID> for the next page. Roles are bounded to 200 total including templates; creation is rejected at that cap. Audit is explicitly the recent 100 entries, not a complete export. A user without platform roles still has own profile/password/session operations; it has no company membership or global management access.

POST operations return 201; reads/PATCH/PUT/DELETE return 200. Common errors include 400 invalid input, 401 inactive/revoked/expired credentials, 403 missing permission/CSRF/Origin/current-password/protected owner, 409 stale/duplicate/last-owner/scope conflicts, 413 oversized body, 415 non-JSON writes and 429 rate/capacity limits. The local proxy returns 503 when identity is unavailable. Local-only cookies intentionally omit Secure and cannot be treated as production remote cookie configuration.

No bootstrap, registration, password-reset email/SMS, company selector, tenant membership or financial authority is exposed through a public shortcut. The public prototype liveness reports local-prototype/not-connected when no identity API is configured; the identity process reports local-identity/connected.

## Later route families - not implemented

Company operations need verified membership plus company/branch/station/trip scope in Section 03. Marketplace projections need approved/publication filters; guest holds/bookings need verified capabilities and atomic server inventory in Sections 07-09. Station payment/tickets, luggage/boarding and finance/support-grant operations follow their scheduled sections. No such paths enter this executable contract until implemented and tested.

Future booking/payment writes require scoped idempotency keys/request hashes; cache and event delivery cannot authorize money or seats. Flutter bearer/secure-storage contracts, request IDs/observability and WebSocket authentication will be added with their owning modules. The current cookie implementation is for the local browser staff interface only.
