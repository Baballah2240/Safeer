# Decisions

## 2026-10-30 - accepted master plan

Source: [Master development instructions](decisions/MASTER_INSTRUCTIONS_2026-10-30.md), supplied by the project owner. This replaces the 2026-10-28 exploratory scope wherever the two disagree.

| ID | Decision | Reason and implementation impact |
| --- | --- | --- |
| D01 | Release 1 is passenger transport, including passenger luggage; freight/parcels/cargo delivery are deferred. | Explicit scope change from the earlier passenger-plus-freight prototype. Preserve the old source checkpoint, then remove freight navigation, fixtures, rules and tests from active code. Do not create freight tables or API stubs. |
| D02 | One public marketplace, company public pages, and independent private company systems. | Public projections may cross approved operators; private queries must derive tenant and scope from authenticated membership. The demo selector is not authentication. |
| D03 | Guest booking is mandatory; full name/mobile and multiple passengers/seats are required in the real booking module. | Supersedes the open account-versus-guest question. The existing single-seat/name-only UI remains a labeled historical prototype until Sections 08-09. |
| D04 | Station payment precedes official ticket and receipt issuance; no online payment gateway in release 1. | Keeps the earlier agreed payment-before-ticket rule. Money records are immutable; corrections use reversals and refunds. |
| D05 | Company-defined holds use server/database time, transactions, row locks, constraints, idempotency and background expiry. | The prototype's browser timer is educational only. Do not expose it as a real reservation engine. Section 08 owns implementation. |
| D06 | Target a modular monolith: TypeScript/NestJS API, PostgreSQL 18, Next.js public/company/station web, Flutter passenger/driver clients. | Follows the preferred master architecture while retaining the reliable Node 24 prototype. Framework shells are introduced at their owning sections, not installed unused in Section 01. Current versions must be pinned and verified when introduced. |
| D07 | Redis jobs/cache and WebSocket notifications are delivery aids; PostgreSQL remains authoritative. | A cache or delayed worker cannot authorize a seat/payment. Use an outbox and idempotent consumers in the owning sections. |
| D08 | Shared API contracts, localization keys and design tokens stay in this repository. | Flutter uses Dart, so it shares contracts/generated models and design assets rather than executing JavaScript UI components. Document this technology consequence before adding Flutter; no native app exists today. |
| D09 | Plan company-owned composite foreign keys, least-privilege runtime roles and PostgreSQL RLS as defense in depth. | Company-private records always carry company_id. Platform access uses explicit authorization, never a caller-controlled admin flag. Support financial access needs a scoped, expiring, audited grant. Implement in Sections 02-03. |
| D10 | Schema design covers all passenger modules, but executable migrations are added only when a module is implemented. | Section 01 creates the migration ledger and private application namespace only. It must not pretend that proposed business tables or tenant policies already exist. |
| D11 | Route-segment allocation is designed now as stop-index ranges [from,to), implemented with the seat module. | Prepare immutable trip-stop/seat snapshots and non-overlap constraints without implementing future parcel logistics. |
| D12 | Perform Section 01 only, test/archive/document it, then stop for explicit approval before Section 02. | No accounts, role screens, real booking APIs or production features are to be added in this section. |
| D13 | Keep the working product name Safeer / سفير; use Sudan Transport for the platform description. | The supplied plan does not explicitly request a brand/package rename. |
| D14 | One booking initially belongs to one company and one trip, with multiple passengers/seats. | Keeps company money/seat ownership atomic; marketplace comparison does not imply interline settlement or a cross-company checkout. |
| D15 | Luggage exception_reported is a visible exception state backed by separate exception events, retaining the underlying lifecycle. | Supports the approved status list while preserving whether an affected bag was loaded, unloaded or collected before the exception. |

## Decision changes

Record the old decision, owner instruction, reason, affected modules/data, compatibility impact and required tests before implementing a change. Financial rules, tenancy, ticket validity, support access and public/private data boundaries must never change silently.

## 2026-10-30 - passenger luggage declaration addendum

D16: The owner explicitly requested a luggage yes/no choice and description for the passenger. Extend only the existing local passenger prototype: default to no luggage; when yes, require a plain-text description trimmed to 1-300 characters. Keep the declaration with the reservation and display it in the passenger list and printable unpaid reference. Clear it for the next reservation and on company changes. Existing example rows without these fields display no luggage. Test required/invalid descriptions, Arabic/English layouts, draft preservation, escaping and company/reset behavior. This is a declaration, not station registration, tags, verified weight, charges or tracking; those remain Section 11. No business tables or APIs are added, and Section 02 remains unapproved.
