# Section 12 preparation: driver access and boarding

Historical preparation under D35. Superseded by D36: the owner chose the local web client and assigned-driver boarding authority. Section 12 is now complete in local 0.13.0. See [current state](../CURRENT_STATE.md) and [workflow](../workflows/DRIVER_BOARDING.md). The questions and proposed checks below record the preparation checkpoint.

## Decisions awaiting the owner

1. Responsive driver workspace inside the current local application first, or a separate Flutter driver application as specified in the master plan? Remote phone access needs a separate network/server setup; the current service remains loopback-only.
2. Can an assigned driver verify tickets and board passengers as well as record departure, arrival and incidents, or must boarding remain a separate staff duty?

These answers determine the client and security model. No new role capability is granted while they are pending.

## Existing connections reviewed

- Drivers may link to a same-company membership through `drivers.member_id`. That link is not a login or permission grant. Identity already provides login, password changes, session expiry and revocation.
- Current trip assignments snapshot a bus and driver, preserve replacement history and reject overlapping assignments. Driver access must resolve the current assignment and active membership at every request; an old assignment or browser company selection grants nothing.
- Trips currently have draft, published and canceled states. Scheduled departure/arrival are not actual journey events. Record actual events separately without rewriting fare, stop or schedule snapshots.
- Paid tickets belong to a booking, seat allocation and payment. Refunded tickets remain in history. Booking references and sequential ticket numbers alone must not become bearer authorization for manifest access or boarding.
- Ticket printing currently returns numbers, without ticket QR codes. The luggage QR is a different opaque identifier and cannot verify a passenger ticket.
- Refunds currently use scheduled departure and trip cancellation rules (D32). Boarding and actual journey events must not silently change these financial policies. Validity must be checked again when boarding commits; a prior successful scan cannot authorize a subsequently refunded ticket.
- Luggage operations already have custody, scheduled-departure and refund guards (D33). Do not change them as a side effect of adding actual journey events.
- Passenger names, mobile numbers and free text follow the agreed erasure policy. Manifest and incident design must avoid unnecessary copied personal details and preserve that policy.

## Proposed implementation order, after decisions

1. Record the accepted client, permissions and exact journey/boarding rules in DECISIONS before implementing them.
2. Add an append-only migration for ticket verification, boarding and journey records. Preserve all old migration checksums. Enforce company ownership, assignment authority and immutable event history on the server/database.
3. Add authenticated same-origin API operations, CSRF checks and explicit OpenAPI contracts. Reuse existing identity rather than introducing a second driver password store.
4. Connect ticket issuance/printing to verification and the chosen Arabic/English driver client. Clearly distinguish checking a ticket from committing boarding. Keep existing passenger and station workflows working.
5. Test against disposable PostgreSQL, then verify responsive source and built clients. Update current documentation, mobile-facing notes and the section archive only with actual results.
6. Back up and restore-verify before upgrading the private local runtime. Preserve existing users and credentials. Archive completed source separately from private data and stop before Section 13.

## Required verification

| Area | Cases |
| --- | --- |
| Authority | Same-company assigned driver; unrelated driver; replaced assignment; disabled driver/member; revoked role/session; other company; forged actor/company input; direct restricted SQL |
| Ticket validity | Paid valid ticket; unpaid reference; refund; canceled trip; wrong trip; unknown/malformed QR; luggage QR; duplicate scan; duplicate boarding; concurrent requests |
| Journey | Ordered departure then arrival; repeated requests; stale browser state; canceled/unassigned trip; unauthorized actor; stored timestamps from the database |
| Privacy | Manifest limited to required fields; no token/PII in URLs or audit payloads; escaped names/incident text; passenger erasure remains effective |
| Compatibility | Existing reservations, station payment/refund, ticket copies, bus reassignment and luggage custody rules; old migration checksums; preserved local account |
| Interface | Arabic/English and RTL/LTR; both themes; keyboard/scanner entry; clear errors; mobile/desktop layouts; no false offline success |

This document is a preparation checkpoint, not a claim that these cases have passed or that a driver app is available.
