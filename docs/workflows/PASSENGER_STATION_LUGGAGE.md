# Passenger, station and luggage workflows

Target workflows below are approved design. Only the old single-seat unpaid demo is currently executable.

## Booking states

`held -> confirmed -> completed`, with `held -> expired/cancelled` and policy-controlled paid cancellation/refund paths. Boarding/ticket/luggage states are separate records, not one overloaded booking status. Group bookings contain multiple passengers and allocations; the hold is atomic across all requested seats.

At expiry, the API or worker locks the booking and affected seat anchors, checks fresh database time and ownership, records expiry and releases active claims. Client countdowns derive from the server's expiresAt; reconnecting fetches the authoritative state. Repeated expiry work is idempotent.

## Station confirmation transaction

1. Verify employee membership, permission and station/counter/open-session scope.
2. Claim/validate the idempotency key and request hash in the same transaction.
3. Lock booking and seat allocations consistently. Refresh database time after lock waits; reject expired/reassigned claims.
4. Check total, currency, permitted method and payment evidence. A caller's `paid=true` is never sufficient.
5. Write valid payment/allocation, confirmed booking/claims, official ticket and receipt snapshots/numbers, cash movement, audit and outbox records atomically.
6. Commit, then render/print/send documents. Retry delivery from committed records without charging or issuing again.

If commit fails, no paid ticket may exist. If the response is lost after commit, the same idempotency key retrieves the original result. Expiry-versus-payment tests must cover both lock orderings at the exact boundary. A late payment follows an explicitly agreed resolution policy; it cannot steal a seat already reassigned.

## Luggage

The local passenger form now collects a yes/no declaration before reservation. Yes requires 1-300 trimmed characters describing the bags, colour and identifying details; no clears it. Keep the declaration on the reservation, passenger list and unpaid reference. Drafts survive seat/trip/language re-rendering and clear after successful reservation or company change. These are passenger-supplied details, not registered luggage, a paid allowance or a tag.

Register against a booking passenger/trip -> create unique tag/opaque QR -> verify tagging -> load -> in transit -> unload -> verify collection. Record each transition with actor/station/time. Exceptions and their resolution form separate events so the lifecycle history is preserved. Tag replacements reference the original; they do not create a second unlinked luggage record.

Paid tickets authorize travel according to policy; luggage registration/loading/collection does not change ticket payment state. Excess-luggage fees, allowance, collection verification, missed bags and incident handling require operational approval before Section 11 implementation.

## Boarding

The employee/driver authenticates for an assigned trip, scans an opaque ticket code, and the server checks company/trip assignment, paid/nonvoid ticket and prior boarding. Duplicate scans return the existing boarding result. Departure/arrival/completion events are recorded separately. Offline scanning conflict/reconciliation is not promised in release 1 until explicitly implemented and tested.
