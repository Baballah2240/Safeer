# Business rules

## Audit remediation - D56, 2026-11-09

The audit source fixes preserve newest-search ordering and unfinished search fields, restore the above-sidebar toggle with immediate keyboard state and clipped animation overflow, publish the owner-approved support contact, and permit a bounded 64 KiB payload only for creating public group bookings (other endpoints remain 8 KiB). The Android error screen distinguishes hosted HTTPS from USB; local patch .6/16006 is built/linted/saved. Hosted owner recovery now supports a non-superuser migration owner with explicit confirmation, duplicate-email rollback, session revocation and audit. Complete browser release gating and PostgreSQL 16 CI are added. No schema, financial policy, role grants or real account credentials are changed. See [D56 handover](archive/AUDIT_REMEDIATION_2026-11-09.md) for measured results and outstanding deployment/device verification.


## Login reliability - D54, 2026-11-08

Staff and Driver preserve entered sign-in fields during language/render changes, keep the email after rejection, clear rejected passwords, and serialize login submissions while startup/session checks or login requests are pending. Credentials stay in ephemeral form state, never browser storage, markup or source. Existing accounts/data, server authorization, password rules and loopback-only access are preserved. The owner separately approved private local owner-password recovery; no credentials are included here. See [D54 handover](archive/LOGIN_RELIABILITY_2026-11-08.md).


## Driver sidebar and mobile fullscreen - D52

Driver now matches Booking with sidebar navigation and appearance/language Settings; operational refresh/logout and assigned-trip rules remain. Both local Android clients remove native toolbars and use immersive fullscreen with swipe-reveal system controls and safe cutout/keyboard insets. USB patch .5/16005 preserves app data. No schema/API, authority, money or hosting change. See [D52 handover](archive/MOBILE_FULLSCREEN_2026-11-05.md); prior evidence is historical.


## Booking sidebar and settings - D51

Booking removes its native title/Home/Refresh/Print toolbar. Shared public Booking navigation now uses a compact menu trigger and accessible side drawer with trip search, My booking, staff access and appearance/language Settings. Driver keeps its native tools. Local USB patch .4/16004 preserves app data and server permissions; no schema, money or hosting change. See [D51 handover](archive/BOOKING_SIDEBAR_2026-11-05.md); prior evidence is historical.


## USB mobile update - D50

The owner requests installing the current shared UI into both USB Android clients. Local test version is 0.16.0-usb.3/16003; build/lint/save and replacement installation preserve app data and existing server accounts. Keep the computer, Safeer service and USB tunnel connected. No schema/API, roles, money or hosting change. See [D50 handover](archive/ANDROID_UPDATE_2026-11-05.md) for verified results; prior evidence is historical.


## Floating header curve and glass - D49

Headers now leave 12px desktop/10px mobile top clearance, retained while sticky, so the full rounded edge is visible. Softer tint, broad reflections, brighter edges and layered shadows refine the glass; scroll clearance includes the gap. Above-sidebar controls, bilingual layout and accessibility remain. No schema/API, authority, account, money or native change. See [D49 handover](archive/FLOATING_HEADER_2026-11-05.md); earlier evidence is historical.


## Toggle above the sidebar - D48

The circular button now sits in its own toolbar above the staff/preview sidebar, outside header actions. When collapsed it stays in the leading top corner, with reserved header space for safe restoration. Saved preference, keyboard/ARIA and responsive RTL/LTR behavior remain. No schema/API, authority, business data or native change. See [D48 handover](archive/SIDEBAR_POSITION_2026-11-05.md); older evidence below is historical.


## Circular sidebar button - D47

The header sidebar toggle follows the supplied reference: circular glass, small two-line menu icon and no visible text. A 44px target, translated accessible name/title and all saved hide/restore behavior remain. No API, schema, account, permission, money or native change. See [D47 handover](archive/CIRCULAR_SIDEBAR_2026-11-04.md); prior evidence below is historical.


## Marketplace announcement - D46

The public notice is now a compact aligned glass announcement with an SVG icon, translated Travel update label and wrapping message. Existing protected bilingual settings and plain-text escaping remain. No schema, API, account, permission, financial or native-code change. Read [D46 handover](archive/MARKETPLACE_NOTICE_2026-11-04.md) for verification/checkpoint details; prior evidence below is historical.


## Frosted reference glass - D45

The supplied visual reference guides clearer translucent headers/sidebar, pill controls and frosted summary tiles over warm ambient gradients. Black/brown identity, readable operational panels, sticky headers and the saved sidebar toggle remain. No schema, API, authority, account, money or native-package change. See [D45 handover](archive/REFERENCE_GLASS_2026-11-04.md) for verification and the local checkpoint; prior evidence below is historical.


## Sidebar visibility - D44

A header button hides/restores the staff and fictional-preview sidebars, expanding the workspace without re-rendering forms. A device-local preference survives navigation/reload; Arabic/English labels, keyboard operation and hidden-navigation focus are supported. No API, schema, authority, money, account or native package change. Read [D44 handover](archive/SIDEBAR_TOGGLE_2026-11-04.md) for verification and the local source checkpoint. Earlier evidence below is historical.


## Sticky liquid-glass headers - 2026-11-04 (D43)

D43 keeps staff, Driver, Booking/marketplace and preview headers at the viewport top on scroll, using Apple-inspired layered glass within the black/brown palette. Actual header height protects scrolled form fields; no schema/API, business, account or native package change. Targeted scrolling (64 combinations) and Identity/modal (60) checks pass. See [header evidence](archive/STICKY_HEADERS_2026-11-04.md); earlier entries are historical.


## Black and brown - 2026-11-04 (D42)

D42 changes the current visual palette to black/espresso and brown, with cream/brown light mode, retaining the bento/glass layout, language support, business rules and schema/API. Matching Android shell/icon patches 0.16.0-usb.2 are installed locally. Targeted browser/build/native evidence and limitations are in [the palette handover](archive/BLACK_BROWN_2026-11-04.md). Earlier entries are historical.


## Bento grid and liquid glass - 2026-11-04 (D41)

The verified shared UI refresh adds bento tiles and glass controls/headers/sidebar in both themes and languages, including the existing USB Android web clients. No migration, API, company/driver authority, money policy or native package changes. Nine built-browser workflows, 256 layout/language/theme combinations plus the preview, accessibility preferences and actual phone screens are verified. Read [D41 handover](archive/BENTO_GLASS_2026-11-04.md) and [current state](CURRENT_STATE.md); earlier section entries are historical.


## Android USB follow-up - 2026-11-04 (D40)

Add and install separate local-test Safeer Driver/Booking Android WebView apps over the existing shared src/ and loopback API through USB reverse port 4320. All company, driver assignment, session and offline-payment rules remain unchanged; no schema/API authority changes, account seeding, camera/offline queue, Flutter or hosted release. See [USB installation evidence](archive/ANDROID_USB_2026-11-04.md) and [mobile setup](../mobile/README.md). Earlier section entries below are historical.


## Section 15 - 2026-11-04 (D39)

D39 changes no company membership, driver assignment, money/refund/currency, ticket, custody or retention rule. Maintenance health makes existing expiry/90-day erasure failures visible without private contents; worker concurrency is bounded. Safe health output and a tested release gate are operational controls. Remote release, off-site retention/restore, legal/financial choices and physical hardware validation remain explicit prerequisites. See [security review](security/SECTION_15_REVIEW.md), [release operations](RELEASE_READINESS.md) and [Section 15](archive/SECTION_15_RELEASE.md).


## Section 14 rules (D38)

Global dashboard/settings are reserved Super Administrator authority; tenant roles/support grants gain none. Reports include retained company history, separate currencies and at most 31 inclusive UTC posting dates. Recorded net collections are not profit. Scheduled published departure counts do not assert actual departure. Company Finance retains company-timezone reporting. Dashboard pagination starts fresh snapshots.

Only the bilingual public service notice is configurable here; it is plain text, at most 500 characters/language, initially disabled, and requires current password/version/audit. It cannot stop bookings. Current access controls notification visibility and each receipt write; company approval, current driver assignment, station finance scope and company-wide incident/luggage capability remain enforced. Newly authorized users can see relevant events from the last 90 days. No historical alert backfill or external delivery. Read means acknowledged, not resolved. Metadata/receipt physical cleanup and private backup retention remain maintenance work. See [workflow](workflows/PLATFORM_ADMINISTRATION.md).


## Section 13 — 2026-11-03 (D37)

Section 13 is complete. Safeer runs locally at 0.14.0 with all thirteen migrations applied. All 118 automated checks passed (15 unit/server and 103 native PostgreSQL), including scoped read-only financial access and a 20,002-movement pagination/export-limit fixture. Source and built Finance browser workflows passed 16 layouts each. The private backup matched 1532 files and passed a protected restore/start/stop check; the existing account, settings and 49 legacy tables passed integrity comparisons. Existing financial rules are unchanged. See [financial reports](workflows/FINANCIAL_REPORTS.md) and [Section 13](archive/SECTION_13_FINANCE.md). Stop before Section 14.

## Historical Section 12 checkpoint — 2026-11-03 (D36)

Section 12 is complete. The local app runs 0.13.0 with all twelve migrations applied and the original account/settings preserved. It adds the owner-approved responsive driver workspace, assigned-trip manifests, printed ticket QRs, separate verification/boarding, journey events and incidents. All 109 automated checks passed (13 unit/server and 96 native PostgreSQL). Source and built driver workflows passed 32 language/theme/viewport combinations; the built station regression passed another 32. The private backup matched 1512 files, passed a protected restore/start/stop check, and the upgraded account/credentials/settings and 45 legacy tables passed integrity comparisons. Flutter remains deferred. See [driver workflow](workflows/DRIVER_BOARDING.md) and [Section 12](archive/SECTION_12_BOARDING.md). Stop before Section 13. Earlier per-section entries retain historical results.

Local upgrade D34 (2026-11-02) changes no business policy. Existing identity and company history are preserved; new permissions remain explicit grants for existing company roles. Current implementations through Section 12 are described in their numbered workflows; early prototype-only statements below are historical. D36 records the implemented driver/boarding rules.

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

## Section 06 trip rules (D27)

Trip access is company-wide; managing also needs company-wide route, fleet and driver reads. Support grants gain no trip access. A trip copies its route, stops, and at assignment its bus, seat-layout revision, seat count and driver name, so later edits never change it. Times use the company timezone and each stop stores whole minutes after departure, strictly increasing from 0.

Status moves only from draft to published, and from draft or published to canceled with a reason; canceled is final. Publishing needs an approved company, an active bus and driver, a fare above zero and a future departure. Published trips keep their time and fare. One bus or driver cannot overlap two live trips, and replacing either keeps history and needs a reason. Upcoming assignments protect a bus or driver from deactivation. Trip readers see a driver's name but never contact details. Fares are stored in minor units as a snapshot; nothing is sold. Section 08 must add rules for reassigning trips once seats can be reserved.

## Section 07 marketplace rules (D28)

A company appears only when approved and self-listed; listing defaults to off. Public contact details are separate from private company contact fields. Only published trips with a future departure and a current assignment appear. Search matches a trip's first and last stop because a fare covers the whole trip. Seats shown are the bus's total until Section 08 adds availability. No passenger details are collected.

## Section 08 seat hold rules (D30)

A hold takes 1-10 seats on one published, future trip of an approved, listed company, all or none. It lasts the company's hold minutes as set when it was made, ending by departure. It carries no passenger details until Section 09. Holds cover the whole trip because fares do. Expiry follows the database clock, not the job or the browser. A hold closes once, by expiring, by its passenger, by staff with a reason and current password, or by the trip being canceled. A seat map change is refused while seats are held. These rules implement the reservation invariants above; payment, tickets and cancellation policy remain open.

## Section 09 passenger rules (D31)

Every held seat has a traveler's full name, and the booking has one required mobile number; a traveler may add their own number. No age or date of birth is collected, and a child with a seat is named on it. Seats and details commit together. A passenger can reopen a booking with its reference and mobile number, seeing a masked number and shortened names, and can view or release but not change it. Staff correct details only while seats are held, with a reason and current password, and old values are not kept. Names, numbers and staff-written reasons are erased 90 days after the trip ends, whatever the booking's outcome. This resolves the open child/group and retention policy above for local development; it needs legal review before real data is collected.

## Section 10 ticketing rules (D32)

Payment is for the full amount only. Cash is always available; each company can enable bank transfer and mobile wallet, which need a typed transaction reference and connect to nothing. Only cash counts toward the drawer. Every payment and refund needs the person's open session at a counter. Payment, receipt, tickets and seat confirmation commit together. A paid passenger cancellation gets a full refund until departure and nothing after; a canceled trip always gets a full refund, with no fees or company cutoffs. Any ticketing employee can refund, with a reason and their current password, and the refund goes out by the method it came in. A hold that has ended can be paid late only with the late-payment permission and a reason, if the seats are still free and the seat map has not changed. Closing a session keeps any difference and requires a note, which is cleared 90 days later. A trip cannot be canceled once it has arrived. Later prints are marked as copies. Final receipt wording, tax and legal retention are not decided and need review before real use.

## Section 11 luggage rules (D33)

A traveler can say what luggage they have when booking. It is only their word. Staff register bags on valid paid tickets only, before departure, recording type, pieces and weight, with no allowance or fee. A bag moves registered, tagged, loaded, in transit, unloaded, collected, one step at a time; the only step back is loaded to tagged, with a reason. Any luggage staff can report a problem; it shows while open, keeps the recorded state and blocks handover, and resolving it takes a separate permission, an outcome and the current password. Handover needs the ticket number or the booking's mobile number. Before travel a bag can be returned with a reason. A ticket cannot be refunded while its bags are with the company. Resolving a missing bag as settled or closed marks it lost, which ends custody and allows the refund. A bag cannot be marked in transit before departure or moved forward on a canceled trip. The tag does not show the ticket number. Printing again replaces the tag and stops the old QR working. Bag descriptions, handling notes, reasons and problem notes are erased with the passenger's details; the bag's number, weight and history stay.
