# Module boundaries

This is the complete target map. The only implemented services today are local prototype asset/liveness delivery and developer migration/build tooling. The matrix does not declare business modules complete.

| Module | Owns | Allowed collaboration | Section |
| --- | --- | --- | --- |
| Identity/access | Credentials, sessions, principal, role/permission templates, authorization context | Produces verified principal and scope; never grants tenant access from request fields | 02 |
| Companies | Company approval/profile/settings, branches, stations, employees and support grants | Supplies membership/resource ownership and approved public company projection | 03 |
| Route network | Cities, company routes, ordered stops | Supplies versioned route snapshots to trips | 04 |
| Fleet | Bus categories, buses, immutable layouts/seats, drivers | Supplies compatible assignment/layout versions to trips | 05 |
| Trips | Schedule, publication, assignments, trip-stop/layout snapshots | Supplies published inventory context; controlled changes call allocation/booking services | 06 |
| Marketplace | Public search, company pages, safe public projections | Reads approved/published services; delegates holds to inventory, never private company repositories | 07 |
| Inventory | Trip-seat anchors, allocations, holds, expiry and availability | Executes atomic seat claims; delegates booking identity/details to bookings | 08 |
| Bookings/passengers | Guest capabilities, booking/passenger records, snapshots, retrieval/history | Coordinates with inventory and later payment/ticket use cases | 09 |
| Station ticketing | Counter operations, walk-ins, authorized payment confirmation, ticket/receipt issue and minimum cash controls | One transactional use case coordinates booking/inventory, finance records, documents/audit/outbox | 10 |
| Passenger luggage | Passenger-linked luggage/tag records, lifecycle/events/exceptions | Checks matching booking/ticket/trip; uses document service for printable tags | 11 |
| Boarding/driver | Assigned-trip manifests, QR verification, boarding/departure/arrival/incidents | Revalidates paid ticket/assignment; does not modify payment history | 12 |
| Finance/reporting | Immutable cash/payment/refund movements, reconciliation and reports | Extends Section 10 foundations; read projections cannot rewrite posted transactions | 13 |
| Platform/notifications/analytics | Global authorized administration, approval dashboard, delivery retries, global reports | Uses explicit module services, grants and redacted projections; no ambient support finance access | 14 |
| Operations/security | Deployment, backup/restore, monitoring, load/security audit | Verifies all module boundaries and recovery behavior | 15 |

## Shared infrastructure

Versioned API/error contracts, transactions, tenant-context handling, immutable audit, document/storage adapters, localization, idempotency and outbox form small explicitly owned services. They are introduced with their first completed use case rather than copied into each module. Secrets and provider SDKs remain backend-only.

Freight is a future separate module, not a hidden passenger/cargo mode. Its eventual contract can consume company/route/fleet services but cannot write passenger inventory or financial tables directly. No freight implementation is carried into release 1.
