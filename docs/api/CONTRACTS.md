# API contracts

The canonical implemented contract is [src/contracts/openapi.json](../../src/contracts/openapi.json). Only `GET /api/v1/health` exists. It returns `{data:{service,version,mode,database}}`, with mode local-prototype and database not-connected. This endpoint checks liveness only. Static and unsupported-route errors currently use the prototype's plain-text responses; no business error contract is claimed implemented.

## Conventions for the NestJS API

Introduce validated versioned DTOs, stable permission names and a consistent `{data,meta}` success / `{error:{code,message,details},requestId}` error envelope when the backend begins. No SQL details, credentials or other-company existence leaks in responses. Money amounts are integer strings with currency/exponent. Timestamps are ISO instants plus explicit local trip timezone. All lists are paginated and company/resource-scoped unless a documented public projection.

Mutating booking/payment endpoints require an idempotency key and canonical request hash. Keys are scoped to the authenticated principal or guest capability and owning company/operation. A repeated key with different input is a conflict. A response timeout must be recoverable without a duplicate charge or allocation.

## Planned route families - not implemented endpoints

| Owner | Future family | Boundary |
| --- | --- | --- |
| 02 | /api/v1/auth, user/session/permission operations | Authentication and revocation; no public tenant selection |
| 03-06 | /api/v1/company/* | Verified membership + permission + company/branch/station scope |
| 07 | /api/v1/public/companies, trips, company pages | Approved/published safe projections only |
| 08-09 | /api/v1/public/holds, bookings, retrieval | Guest capability/contact verification, rate limits, atomic server authority |
| 10 | /api/v1/station/* | Assigned station/counter/session + payment/ticket permissions |
| 11-12 | luggage, tags, manifest, boarding operations | Passenger/trip ownership and assigned-role checks |
| 13-14 | finance, platform, notifications/reporting | Explicit finance/global/support-grant permissions |

Do not add these paths to the executable OpenAPI file until implemented and tested. Event names/payload versions are documented alongside their owning modules; outbox delivery is at least once. WebSocket clients must authorize subscriptions and re-fetch after reconnect rather than treating events as final seat/payment truth.
