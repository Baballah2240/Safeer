# Station ticketing

Section 10 / 0.11.0. Staff take payment at a counter and issue tickets and receipts. No real payment system is connected.

## First setup, for a company admin

1. Add company.ticketing.operate and company.bookings.read to the roles that sell tickets. Add company.payments.late and company.sessions.manage only where needed.
2. In Station, add a counter at a station.
3. Turn on bank transfer or mobile wallet if the company accepts them. Cash is always on.

## Daily work

1. Open a session at your counter, entering the cash in the drawer.
2. To sell to someone at the counter, choose a trip, seats, names and a mobile number, then the payment method.
3. To take payment for an existing booking, open it in Bookings and choose Pay. Bank transfer and wallet need the transaction reference you were given.
4. Print the tickets and receipt. Any later print is marked as a copy.
5. At the end of the day, count the drawer and close the session. Any difference is kept and needs a note.

## Refunds

Open the booking and choose Refund, with a reason and your current password. A passenger cancellation is refunded in full until departure and not after. A canceled trip is always refunded in full. The refund goes out by the method it came in, and your session must be open.

## Late payment

A hold that has ended can be paid only with the late-payment permission and a reason, if its seats are still free and the seat map has not changed.

## Limits

Payments are recorded, not processed: staff confirm a transfer or wallet payment themselves. Partial and split payment are not available. Tickets have no QR code until Section 12. Receipt wording, tax and legal retention are not decided.
