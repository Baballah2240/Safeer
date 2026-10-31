# Safeer / Sudan Transport - project master

Updated: 2026-10-30. Current authorization: **Section 02 only**, approved by the owner's "next". Start continuation with [CURRENT_STATE.md](CURRENT_STATE.md). The owner's [master instructions](decisions/MASTER_INSTRUCTIONS_2026-10-30.md) are the governing plan; [DECISIONS.md](DECISIONS.md) records scope decisions. Stop before Section 03 after the Section 02 handover.

Owner-authorized 0.2.1 follow-up: collect and display a passenger luggage yes/no declaration and required description in the local prototype. This scoped change (D16) does not begin authentication or full station luggage management.

## Vision and approved business model

A reliable Sudan intercity passenger-transport platform: one central marketplace, individual public company booking pages, and independent private company management systems. Approved operators publish trips and fares. Passengers may book as guests; a passenger account is never mandatory. Company staff run stations, buses, passenger/luggage operations and finances within their own authorized scope.

Release 1 includes passenger search, seats, temporary holds, passenger information, station payments, official tickets and receipts, linked passenger luggage, boarding, trip completion and reports. Freight, parcels and cargo delivery are excluded. Their future extension point is a separate module using approved company/route/fleet interfaces; no unused freight code or schema is built now.

## Passenger and station workflow

Search across approved companies -> select trip/seats -> enter full names/mobile details -> receive a temporary booking reference/countdown -> pay an authorized office/station -> employee confirms payment -> issue official tickets and payment receipt -> register/tag luggage -> verify boarding -> complete trip and luggage collection.

An expired hold does not authorize payment or boarding. One booking initially belongs to one company and one trip, with multiple passengers/seats. Cross-company travel uses separate bookings; no interline settlement or combined checkout is implied.

## Architecture: target versus current source

| Layer | Target decision | Implemented now (Sections 01-02) |
| --- | --- | --- |
| Public marketplace, company pages, dashboards, station PWA | Next.js/React with TypeScript | Existing responsive JavaScript prototype retained, freight removed; no Next.js app installed |
| Passenger and driver apps | Flutter/Dart clients | Contracts/design sharing strategy documented; no native project or build |
| Backend | NestJS/TypeScript modular monolith, versioned APIs | Section 02 NestJS identity API, same-origin local proxy and separate public passenger example |
| Durable data | PostgreSQL 18, explicit SQL migrations | Migration runner plus durable identity/session/role/audit tables; no passenger business tables |
| Jobs/cache/events | Redis, idempotent workers and WebSocket availability updates | Interfaces and consistency requirements documented; services not installed |
| Documents/storage/notifications | S3-compatible private storage, FCM where applicable | Ownership, outbox and access requirements documented; no accounts or integrations |

Node 24 is retained. NestJS 12.3.2 and TypeScript 6.0.3 are pinned for the implemented identity module. Next.js/Flutter/Redis remain staged for their owning sections. The passenger demo remains a design/reference aid, separate from the real staff identity interface at `/staff`.

## Modules and roles

Module owners: platform administration; identity/access; companies/branches/stations; cities/routes/stops; fleet/layouts/drivers; trips; public marketplace; inventory/holds; bookings/passengers; station ticketing/payments/documents; passenger luggage; boarding; finance/reconciliation; notifications/reporting/audit.

Approved initial roles: platform super administrator, platform support administrator, company administrator, branch manager, station manager, ticketing employee, boarding employee and driver. Permissions must be configurable and resource-scoped. Support financial access requires explicit authorization; driver access is limited to assigned trips and necessary passenger data. See [security design](security/ACCESS_CONTROL.md).

## Development principles

1. Follow the exact 15-section [roadmap](DEVELOPMENT_ROADMAP.md), one section at a time.
2. Preserve tested work; record intentional breaking changes before editing it.
3. Separate domain rules from transports/UI. Enforce security and consistency on the server/database.
4. Never use mock data as live operations. Never issue a paid document without a committed valid payment.
5. Scope private data by company and authorized branch/station/trip. Public data uses a separate approved projection.
6. Use immutable financial/audit history, explicit state transitions, idempotency and transactional constraints.
7. Support Arabic/English, RTL/LTR, accessible controls, low-bandwidth clients and clear errors. Do not promise offline seat sales until conflict policy is implemented and tested.
8. Test, fix, document and archive before handing off. Do not mark proposed schema or target frameworks as implemented.

Section 02 ends at the verified identity handover. Section 03 requires explicit owner approval. No production deployment, school-app changes, restaurant/mobile changes, real passenger data or external service enrollment is authorized by this section.


## 0.3.1 - Super Administrator role editing

Owner-authorized D20 follow-up: Super Administrators can edit names, permissions and status of all eight built-in role templates and custom platform roles. Reserved owner codes/scopes remain immutable, owner authority always includes the permission catalog, and disabling the last active owner is rejected atomically. Other administrators remain restricted. Company/resource assignment remains deferred to Section 03; no schema migration or company access is added. The role editor supports Arabic/English and mobile layouts.


## 0.3.2 - Connected workspace layout

Owner-authorized D21 follow-up improves the implemented staff/passenger workspace: shared navy/teal styling, sidebar, account overview, permission-aware shortcuts, user-role navigation and language-preserving links. Business modules remain at their existing stage.


## 0.3.3 - Skeuomorphic styling (2026-10-31)

D22 owner-authorized visual follow-up: restrained skeuomorphic materials across the existing staff and passenger interfaces. Navigation and implemented scope are unchanged.


## 0.3.4 - Dark mode (2026-10-31)

D23: shared dark skeuomorphic mode is now the default across existing staff and passenger screens, with a bilingual light/dark switch. Existing implementation scope and access rules remain unchanged.
