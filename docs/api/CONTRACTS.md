# Implemented API contracts

Canonical OpenAPI 3.1: [src/contracts/openapi.json](../../src/contracts/openapi.json), version 0.5.0. It records only implemented operations, request fields, cookies/CSRF, envelopes and response schemas. Requests are strict JSON with an 8 KiB limit. Responses use {data: ...} or {error:{code,message}}; no SQL, token or password details are logged in errors. Successful one-time credential responses are explicit exceptions intended only for the authorized administrator.

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

Company operations use implemented company/branch/station membership checks. Trip scope waits for scheduled trips. Marketplace projections need approved/publication filters; guest holds/bookings need verified capabilities and atomic server inventory in Sections 07-09. Station payment/tickets, luggage/boarding and finance/support-grant operations follow their scheduled sections. No such paths enter this executable contract until implemented and tested.

Future booking/payment writes require scoped idempotency keys/request hashes; cache and event delivery cannot authorize money or seats. Flutter bearer/secure-storage contracts, request IDs/observability and WebSocket authentication will be added with their owning modules. The current cookie implementation is for the local browser staff interface only.


## Section 03 company routes

At the Section 03 handover the schema recorded 27 paths / 31 operations; Section 04 extends it to 31 / 38. All company requests require a valid non-temporary session. Mutations require exact Origin/CSRF/current password; edits use expected versions. UUIDs are validated; unavailable companies/resources return 404 or denied scope, without granting access from the path alone.

| Method | Path under /api/v1 | Rule |
| --- | --- | --- |
| GET, POST | /companies | Authorized company list; only Super Admin creates pending companies |
| GET, PATCH | /companies/{id} | Scoped workspace/profile/settings; only Super Admin changes approval/slug |
| POST | /companies/{id}/branches, /companies/{id}/stations | Resource creation in permitted company/branch scope |
| PATCH | /companies/{id}/branches/{rid}, /companies/{id}/stations/{rid} | Versioned resource edit; immutable ownership and station branch |
| POST, PATCH | /companies/{id}/members, /companies/{id}/members/{rid} | New local employee / tenant membership and multi-scope assignments; existing identity link is Super Admin-only |
| POST, PATCH | /companies/{id}/roles, /companies/{id}/roles/{rid} | Tenant role create/edit with grant ceiling and last-admin protection |
| POST, DELETE | /companies/{id}/support, /companies/{id}/support/{rid} | Super Admin reasoned 1-24-hour read grant / revocation |

Workspace responses contain only RLS-visible resources and field-level UI capabilities, including which resources may be managed. These capabilities improve the interface; server/database checks remain authoritative on every mutation. Staff creation shows a temporary password once. Company member edits never reset a global identity or its other company access. Audit is the latest 100 permitted events. Complete bounded lists and capacity limits are documented in CURRENT_STATE. No booking/payment endpoints are added.

## Section 04 / 0.5.0

31 paths / 38 operations. GET/POST /api/v1/cities; PATCH /api/v1/cities/:id; GET/POST /api/v1/companies/:id/routes; GET/PATCH /api/v1/companies/:id/routes/:rid. Cities are global authenticated reads/Super Admin writes. Routes require company-wide company.routes.read; management additionally needs company.routes.manage and company.resources.read. Station create/update accepts optional nullable cityId; omission preserves an existing assignment. Route input: code, nameEn/nameAr, active, stops[{cityId,stationId?}], currentPassword and expected version on edits. Endpoint cities derive from ordered stops. Read summaries include stopCount; detail returns route and zero-based stops. Error codes include INVALID_ROUTE_STOPS, INACTIVE_ROUTE_RESOURCE, STATION_CITY_IN_USE, RESOURCE_IN_USE and CATALOG_LIMIT; stale/duplicate/CSRF/authentication conventions are unchanged. See the executable OpenAPI contract for exact schemas.
