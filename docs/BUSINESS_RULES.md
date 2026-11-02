# Business rules

## Section 04 route rules (D25)

Cities are a Super Admin-managed shared bilingual catalog with authenticated reads. Route grants are company-wide, never inferred from a branch/station grant. Route management additionally requires company-wide resource reads. Existing tenant role copies need explicit new grants. Support route reads require a selected expiring grant; no mutations.

Routes have 2-30 ordered stops and different endpoint cities. A linked station must belong to the route company and stop city. Identical city/station pairs cannot repeat. Route edits replace all stops atomically under expected version, reauthentication, CSRF and audit. Active routes require active cities/stations/branches; deactivate affected routes before their resources. Any historical station reference prevents changing that station city until detached. Preserve history through deactivation. No route publishing, fares, vehicles or booking are implied.


These are approved target invariants unless marked as an open policy. The current prototype demonstrates only basic single-seat holds/cancellation; it does not implement real guest booking, payments, tickets, luggage or boarding.

## Identity and authorization - Section 02

- Staff sign in through the local identity service; this does not turn the passenger demo into real shared inventory or grant a company membership.
- Temporary passwords must be changed before other authenticated operations. Password resets and account disabling revoke sessions; role changes are effective on the next authorization check.
- Every privileged account/role change requires current-password reauthentication and explicit server permission. Prevent self-escalation, reserve owner and non-platform template edits to Super Administrators and keep at least one active protected owner, even under concurrent changes.
- Company, branch, station and trip templates cannot be assigned globally. Company/resource access begins only after Section 03 membership/scope checks exist. Platform support has no default financial authority.
- Preserve identity audit/history; never log password, cookie, CSRF or request payload secrets. Recovery is a privileged local operation, never an unauthenticated web endpoint.

## Reservations and seat availability

- Guest booking must be available without an account. Obtain agreed passenger full names and mobile contact details, with a separate booking-passenger record per traveler. Children/group handling and retention policy must be specified before collection.
- A booking belongs to one company and trip and may contain multiple passengers/seats. Snapshot fare, currency, route endpoints, passenger terms and hold expiry.
- Check on the server and lock the requested trip-seat anchors in deterministic order. Allocate all requested seats or none. Validate availability again inside the transaction.
- Company policy determines hold duration. Snapshot it; expiry is capped at the boarding/departure cutoff. Changing policy never silently changes existing agreed deadlines.
- At `now >= expires_at`, an unpaid hold is expired. A delayed background job does not extend it. Payment/reservation actions perform the same check under lock using the current database clock after lock acquisition.
- Keep historical bookings/holds/events. Release active inventory on expiry or authorized cancellation without deleting history.
- Never confirm from cached availability or a browser countdown. Retries use an idempotency key scoped by actor/guest capability, company and operation; reuse with a different request hash fails.
- Trip-seat allocation design uses ordered-stop ranges `[from,to)`. Adjacent journeys may share a seat; overlapping active allocations may not. Initial full-trip sales use the whole stop range; segment sales follow their own tested Section 08 implementation.
- Bus/layout changes after any hold or sale require explicit reaccommodation rules and an audit trail. Never silently remap ticket seats.

## Station payment, tickets and receipts

- No online gateway is required. Only authorized station employees record accepted company payment methods in an open authorized cash session/counter where applicable.
- Resolve the booking company and station scope; lock booking and relevant allocations, recheck expiry/ownership/price/currency, then commit the payment, allocations, booking confirmation, official tickets, receipt numbering, cash movement, audit and outbox atomically.
- A confirmed ticket requires a valid committed payment allocation. Initial ticket issuance requires the full booking amount; partial tender or split-payment policy must be explicitly approved before enabling it.
- No paid ticket/receipt is printed for an unpaid reference. Failed payment validation creates neither a payment nor a ticket. A committed payment whose print/notification fails must be retrievable/reprintable, without charging again.
- Duplicate payment requests with the same idempotency key return the original result. Do not create a second money record, cash movement, ticket or receipt.
- Store amounts in minor units and snapshot currency precision. Never use locale-formatted strings or binary floating point for persisted accounting totals.
- Completed payments, receipts and financial movements are immutable. Corrections use linked reversals/adjustments/refunds, authorized actors, reasons and audit events. Refund totals cannot exceed the eligible original amount.
- Receipt/ticket numbers are unique within the agreed company/document sequence. Do not promise gap-free numbering after failed transactions. Final company/legal document format and retention rules require approval before production.

## Cancellations, refunds and trip lifecycle

- Unpaid cancellation releases the active hold and records actor/reason. Paid cancellations require the separate eligibility/refund workflow; cancelling a UI row cannot erase a financial transaction.
- Cancellation cutoffs, fees, no-show rules, station override powers, late-payment resolution and refund approvals are open operational policies. Never silently substitute guessed values.
- Published trips, canceled trips, vehicle assignments, departure/arrival and completion events retain their history. A canceled trip cannot accept new allocations or boarding.

## Companies, employees and platform support

- Company-owned rows carry company_id and same-company foreign keys. A supplied companyId never grants access.
- Role permissions combine with company membership and resource scope. Branch managers, station managers and drivers do not automatically receive all-company access.
- Platform super administrators have explicitly authorized audited global management. Platform support has no default access to sensitive company finances; an explicit limited grant is required.
- Public marketplace/company pages expose only approved company information and published safe trip/fare/availability projections. Passenger manifests, finances, employees and internal references are private.

## Passenger luggage

- At reservation entry ask each traveler whether they have luggage. When yes, require a plain-text description trimmed to 1-300 characters; when no, clear the description. Treat this as an unverified passenger declaration, separate from staff registration and any allowance or fee. The 0.2.1 local prototype implements this declaration for its single passenger only and displays it on the unpaid reference. Full group-passenger persistence belongs to Section 09, with station registration in Section 11.
- Luggage is linked to a booking passenger, booking, ticket when issued, trip/bus snapshot and owning company. Do not create an unrelated shipping module.
- Capture identification/tag numbers, category, quantity, weight, description, handling instructions and relevant passenger/contact links. Read contact information through authorized linked records; avoid uncontrolled PII copies.
- Lifecycle: registered -> tagged -> loaded -> in_transit -> unloaded -> collected. Exception reports are separate auditable events, preserving the prior lifecycle state and resolution; do not lose the loaded/collected history by overwriting it.
- Display `exception_reported` while an unresolved exception exists, with the retained lifecycle visible to authorized staff. Resolution returns the display to the recorded lifecycle state rather than inventing a transport event.
- Only authorized station/boarding personnel may register/update/verify luggage. Collection verification, allowance/excess-fee policy and exception resolution require explicit operational rules.
- Print unique luggage tags with opaque QR identifiers. Keep luggage state separate from ticket/boarding state while verifying same-company/passenger/trip ownership.

## Booking retrieval and boarding

- A booking reference alone must not reveal passenger data. Use a high-entropy guest capability stored as a hash, or verified contact recovery; optional passenger accounts do not remove the guest option.
- QR payloads are opaque, purpose-scoped identifiers. Boarding revalidates paid/nonvoid ticket, company, assigned trip and boarding status. Repeated scans are idempotent and cannot board twice.
- Driver views contain only assigned trips and necessary manifest details. Offline scans/sales are not promised until a tested conflict/reconciliation policy exists.


## 0.3.1 - Super Administrator role editing

Owner-authorized D20 follow-up: Super Administrators can edit names, permissions and status of all eight built-in role templates and custom platform roles. Reserved owner codes/scopes remain immutable, owner authority always includes the permission catalog, and disabling the last active owner is rejected atomically. Other administrators remain restricted. Company/resource assignment remains deferred to Section 03; no schema migration or company access is added. The role editor supports Arabic/English and mobile layouts.


## 0.3.2 - Connected workspace layout

Sidebar navigation and overview shortcuts follow server-returned permissions. User role links open role management; assignments still use the existing explicit assignment form. The passenger demonstration continues to use fictional in-memory reservations, separate from durable staff identities.


## 0.3.3 - Skeuomorphic styling (2026-10-31)

Existing authorization, reservation deadlines and offline-payment boundaries remain unchanged. Selected/disabled controls retain distinct styling; reference printing remains clean and unpaid references are not final tickets.


## 0.3.4 - Dark mode (2026-10-31)

Theme switching must preserve drafts, focus and authorization. Preferences survive reloads and same-origin navigation and synchronize across windows. Reservation references print on white paper regardless of screen theme.


## Section 03 company rules (D24)

Company approval and active authenticated memberships define company access. Super Admin can configure any company; other users receive only assigned companies/branches/stations, or explicitly granted read-only support. A company selector never authorizes access. Pending/suspended/archived companies and inactive parent resources remove ordinary access immediately.

Assignments use tenant-owned roles and same-company resources, with a grant ceiling in both the service and RLS. A manager cannot replace a membership that also spans resources outside their authority. Company role scope is immutable. Existing global identities may be linked only by Super Admin; new company staff receive temporary passwords and must change them. Membership edits do not reset or disable a shared global identity. Keep a capable active company administrator; self-removal that would prevent completing the audit is refused and must be performed by another administrator.

Support grants require an active platform-support account, a reason, Super Admin approval, 1-24 hours and read permissions only; database time, revocation and current role/account/company status apply on every query. No financial grant or future permission is invented. Archive companies and deactivate resources/memberships rather than deleting their history. Company settings are saved but real reservations/payments remain later work.

## Section 05 fleet rules (D26)

Fleet and driver access are separate company-wide permissions, never inferred from a branch, station or support grant. New-company administrator templates gain them; existing company role copies are unchanged.

A seat map has 1-20 rows, 1-7 columns and 1-100 uniquely labeled seats, and empty cells are aisles. Each save creates an immutable revision under a stable code, guarded by the expected latest revision. All revisions are preserved. A bus references one same-company revision and revising never moves it. Active buses need an active layout, and active buses must be retired before their layout. Bus code and registration are unique per company. Drivers have a unique company employee code, bilingual name, optional contact and optional same-company staff link, which is not a login or grant. Records are deactivated, not deleted. Each company is bounded to 200 buses, 200 drivers and 200 layout revisions.
