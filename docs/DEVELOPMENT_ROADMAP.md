# Development roadmap

## Section 12 implementation — 2026-11-03 (D36)

Section 12 is complete. The local app runs 0.13.0 with all twelve migrations applied and the original account/settings preserved. It adds the owner-approved responsive driver workspace, assigned-trip manifests, printed ticket QRs, separate verification/boarding, journey events and incidents. All 109 automated checks passed (13 unit/server and 96 native PostgreSQL). Source and built driver workflows passed 32 language/theme/viewport combinations; the built station regression passed another 32. The private backup matched 1512 files, passed a protected restore/start/stop check, and the upgraded account/credentials/settings and 45 legacy tables passed integrity comparisons. Flutter remains deferred. See [driver workflow](workflows/DRIVER_BOARDING.md) and [Section 12](archive/SECTION_12_BOARDING.md). Stop before Section 13. Earlier per-section entries retain historical results.

Updated 2026-11-03. Sections 01-12 and the verified local upgrades (D34, D36) are complete. The app runs 0.13.0 with migrations 0001-0012. Historical rows marked "local upgrade open" below are closed by D34. See [CURRENT_STATE.md](CURRENT_STATE.md). D36 completes Section 12 and its verified local upgrade; stop before Section 13.

0.2.1 owner-requested prototype addendum: luggage choice/description in the reservation, passenger list and unpaid reference. It is not completion of Section 09 or 11; station luggage registration, tags, tracking and fees remain in their scheduled sections.

| Section | Scope | Dependencies | Status |
| --- | --- | --- | --- |
| 01 | Project inspection, architecture, database/migration foundation, conventions, documentation/archive | Existing 0.1 prototype | Complete; handover/archive evidence in CURRENT_STATE |
| 02 | Authentication, users, roles, permissions, session lifecycle, authorization/audit foundation | 01 + explicit approval | Complete; tested/documented, verified checkpoint at handover |
| 03 | Companies, branches, stations, company isolation, support-access grants | 02 + explicit approval | Complete; verified local upgrade and source checkpoint |
| 04 | Cities, routes, destinations, ordered route stops | 03 | Complete; tested local upgrade, restore and source checkpoint |
| 05 | Bus fleet, immutable seat-layout versions, drivers | 03-04 | Source complete and verified; private local database upgrade is an open owner step |
| 06 | Trip scheduling, assignments, stops/layout snapshots, publication | 04-05 | Source complete and verified; private local database upgrade is an open owner step |
| 07 | Public marketplace and individual company pages | 03, 06 | Source complete and verified; private local database upgrade is an open owner step |
| 08 | Seat inventory, atomic multi-seat holds, expiry, idempotency, segment-ready allocation | 06-07 | Source complete and verified; private local database upgrade is an open owner step |
| 09 | Guest passenger details, multi-passenger booking, secure retrieval and booking history | 08 | Source complete and verified; private local database upgrade is an open owner step |
| 10 | Station ticketing, payment confirmation, official tickets, receipts, cancellations/refund operations | 02-03, 08-09 | Complete in source; local upgrade open; owner will revisit the money flow |
| 11 | Passenger luggage registration, tagging/QR, tracking, exceptions and collection | 09-10 | Complete in source; local upgrade open |
| 12 | Local driver client, assigned-trip manifest, QR verification, boarding/departure/arrival | 05-06, 10-11 | Complete and verified locally under D36; Flutter deferred |
| 13 | Company financial reports, cash sessions, daily reconciliation | 10 | Not started |
| 14 | Platform administration, company approval UI, notifications, global analytics | Existing module APIs through 13 | Not started |
| 15 | Security audit, integration/concurrency/recovery tests, optimization and production preparation | All preceding sections | Not started |

## Resolving dependencies without breaking the order

Section 03 must include company approval state and protected service boundaries needed by the marketplace; Section 14 supplies the complete platform dashboard/reporting experience. Section 02 supplies permission/audit primitives used by every later module, not a platform dashboard. Section 10 includes the minimum cash-session/reconciliation controls necessary for valid station payments; Section 13 completes financial reporting and company-level reconciliation. These are explicitly owned prerequisites, not permission to build later sections early.

Within Section 02, scaffold the selected NestJS/TypeScript backend, connect the migration foundation and implement only identity/access infrastructure. Next.js shells and real company pages are introduced as needed by their owning sections; Flutter is introduced with the passenger/driver client sections. Module designs exist before their executable business tables.

## Per-section acceptance gate

- Requirements and public/private contracts recorded; migrations reviewed and tested on disposable PostgreSQL.
- Normal, invalid, unauthorized and cross-company workflows tested for the code actually implemented.
- Constraints, concurrent requests, retries, failure recovery and temporal boundaries tested when applicable.
- Existing passenger functionality and Arabic/English desktop/mobile layout checked after UI changes.
- No critical/high-priority defects in the completed scope; limitations described without hiding failures.
- Relevant mandatory docs, changelog, module notes and numbered archive entry updated.
- Source checkpoint/archive checksum verified; no secrets, runtime databases or credentials committed.
- Explicit owner approval before Section 10 and later sections; never cross an incomplete gate.

## Known gaps, not completed features

The staff interface now has real local PostgreSQL authentication and platform authorization. Company memberships/tenant security now run on the server and database. Durable bookings, actual guest-mobile validation, multi-seat transactions, payment/ticket/luggage/boarding APIs and native apps remain scheduled work. The separate passenger demo still resets on refresh and never inherits company access from a staff role.


## 0.3.1 - Super Administrator role editing

Owner-authorized D20 follow-up: Super Administrators can edit names, permissions and status of all eight built-in role templates and custom platform roles. Reserved owner codes/scopes remain immutable, owner authority always includes the permission catalog, and disabling the last active owner is rejected atomically. Other administrators remain restricted. Company/resource assignment remains deferred to Section 03; no schema migration or company access is added. The role editor supports Arabic/English and mobile layouts.


## 0.3.2 - Connected workspace layout

Completed the D21 layout follow-up for existing Section 02 screens and the passenger demonstration. Section 03 company membership and real business integration remain deferred; navigation does not grant company access.


## 0.3.3 - Skeuomorphic styling (2026-10-31)

Completed D22 tactile styling for the existing local interface. This visual update does not begin Section 03 or add business modules.


## 0.3.4 - Dark mode (2026-10-31)

Completed the owner-requested D23 dark-mode follow-up. Both themes retain Section 02 staff workflows and the fictional passenger preview; Section 03 remains deferred.
