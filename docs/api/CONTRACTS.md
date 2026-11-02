# Implemented API contracts

Canonical OpenAPI 3.1: [src/contracts/openapi.json](../../src/contracts/openapi.json), version 0.12.0, 79 paths/92 operations. It records implemented operations, request fields, cookies/CSRF, envelopes and response schemas. Requests are strict JSON with an 8 KiB limit. Responses use {data: ...} or {error:{code,message}}; no SQL, token or password details are logged in errors. Successful one-time credential responses are explicit exceptions intended only for the authorized administrator. D34 applied the existing contracts to the upgraded local runtime without changing operation behavior.

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

## Section 05 / 0.6.0

40 paths / 49 operations. GET /api/v1/companies/:id/fleet; POST fleet/layouts; PATCH fleet/layouts/:rid; POST fleet/layouts/:rid/revisions (expectedRevision); GET fleet/layouts/:rid/revisions/:revision; POST fleet/buses; PATCH fleet/buses/:rid; GET/POST companies/:id/drivers; PATCH drivers/:rid. Writes reauthenticate and require CSRF. Conflicts return STALE_VERSION, DUPLICATE_RECORD, LAYOUT_IN_USE, INACTIVE_LAYOUT or CATALOG_LIMIT. No delete, trip or reservation operation exists.

## Section 06 / 0.7.0

45 paths / 56 operations. GET/POST /api/v1/companies/:id/trips (optional from date); GET/PATCH trips/:rid; POST trips/:rid/assignment; POST trips/:rid/publish; POST trips/:rid/cancel. Writes reauthenticate and require CSRF. Conflicts return STALE_VERSION, TRIP_NOT_DRAFT, TRIP_NOT_READY, INVALID_TRIP_STOPS, ASSIGNMENT_CONFLICT, INACTIVE_ASSIGNMENT, TRIP_RESOURCE_IN_USE or CATALOG_LIMIT. No delete, passenger search or reservation operation exists.

## Section 07 / 0.8.0

50 paths / 62 operations. Anonymous GET /api/v1/public/cities, /public/companies, /public/companies/:slug and /public/trips (from, to, date). GET/PUT /api/v1/companies/:id/public-profile needs company.profile.manage; version 0 is the first save. No write route is anonymous.

## Section 08 / 0.9.0

56 paths / 68 operations. Anonymous GET /api/v1/public/trips/:id, POST /public/holds (tripId, seats, key), GET /public/holds/:reference (X-Booking-Key header) and POST /public/holds/:reference/release (key). GET /api/v1/companies/:id/trips/:rid/seats needs company.bookings.read. POST /companies/:id/trips/:rid/holds/:hid/release needs company.bookings.manage, CSRF, a reason and the current password. Conflicts return 409 with SEATS_UNAVAILABLE, IDEMPOTENCY_CONFLICT, TRIP_NOT_BOOKABLE, INVALID_SEATS, SEATS_HELD or HOLD_CLOSED.

## Section 09 / 0.10.0

60 paths / 73 operations. POST /api/v1/public/holds now requires mobile and travelers (seat, name, optional mobile). Anonymous GET /public/holds/current (X-Booking-Key header) and POST /public/holds/lookup (reference, mobile). POST /public/holds/:reference/release accepts key or mobile. GET /api/v1/companies/:id/bookings (q) and GET /companies/:id/bookings/:bid need company.bookings.read. PATCH /companies/:id/bookings/:bid needs company.bookings.manage, CSRF, a reason, version and the current password. New errors: INVALID_MOBILE, INVALID_PASSENGERS, STALE_VERSION.

## Section 10 / 0.11.0

71 paths / 83 operations. Under /api/v1/companies/:id: GET /counter and /counter/trips/:tid; PUT /payment-settings; POST /counters and PATCH /counters/:rid; POST /counter/sessions and /counter/sessions/:sid/close; POST /counter/sales; POST /bookings/:bid/pay, /bookings/:bid/refund and /bookings/:bid/print. All writes need CSRF. Payment settings, counter changes, closing a session and refunds also need the current password; a late payment needs a reason and the late-payment permission. See src/contracts/openapi.json for fields and errors.

## Section 11 / 0.12.0

79 paths / 92 operations. Under /api/v1/companies/:id/luggage: GET (q) and POST; POST /scan; PATCH /:lid; POST /:lid/tag, /:lid/move, /:lid/collect, /:lid/exceptions and /:lid/exceptions/:eid/resolve. All writes need CSRF; resolving also needs the current password. travelers[].luggage is optional on POST /public/holds, POST /counter/sales and PATCH /bookings/:bid. Booking replies gain luggage (number, category, quantity, seat, status). New errors include LUGGAGE_HELD, LUGGAGE_STATE, LUGGAGE_EXCEPTION_OPEN, TICKET_REQUIRED, TAG_UNKNOWN, TAG_REPLACED, TAG_REASON_REQUIRED, REASON_REQUIRED and COLLECTION_NOT_VERIFIED.
