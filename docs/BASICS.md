# Safeer: basics to agree before a full build

## Product purpose

One platform for independent Sudan passenger-bus and freight operators. Passenger and cargo workflows share company accounts, destinations and operational reporting, but they are different products: people occupy bus seats, while freight needs cargo information, quotes, vehicle capacity and delivery records.

## Accepted decisions

| Topic | Decision |
| --- | --- |
| First release | Passenger reservations and freight together |
| Companies | Multiple independent companies from the beginning |
| Visibility | Each company sees only its own staff, trips and customers |
| Online passenger app | Reservation only; no in-app purchase or payment collection |
| Unpaid reservations | Company-defined payment deadline, then automatic expiry and seat release |
| Travel ticket | Issued after authorized company staff confirm offline payment; a reservation reference is provided before payment |
| Current delivery | Local prototype and discussion; no live deployment or native mobile build |

## Keep these documents separate

- **Reservation reference:** identifies a requested seat and its payment deadline. It is not automatically a paid ticket or a receipt.
- **Travel ticket:** the boarding document, issued only after authorized company staff confirm offline payment.
- **Payment receipt:** evidence of a payment actually confirmed by authorized staff. Never print a receipt for an unpaid reservation.
- **Freight request:** the customer's cargo transport request. It is not an accepted quote or proof of delivery.
- **Shipment document:** the accepted cargo movement, later linked to price, vehicle, tracking events and delivery evidence.

The initial prototype prints only a visibly marked unpaid demo reservation reference. The agreed ticket timing is recorded here; real payment confirmations, tickets and receipts await the backend, staff accounts and authorization controls.

## Passenger flow

1. Choose company, destination and departure date/time.
2. View that trip's vehicle, seat layout, availability and fare.
3. Choose a seat and supply the agreed passenger information.
4. Create a reservation reference and a fixed expiry timestamp using the company's policy, capped at departure.
5. Pay the company outside the passenger app. The accepted payment channels and authorized staff must be defined.
6. Confirm payment, issue the final ticket and print the receipt according to the agreed rules.
7. If payment is not confirmed by the deadline, expire the reservation and release the seat. Keep the historical booking record.

The prototype covers steps 2–4 using sample trips and invented names, plus expiry/cancellation. Steps 5–6 follow the agreed payment-before-ticket rule, but await detailed staff/payment controls and real backend/account infrastructure.

## Freight flow

1. Request transport using origin, destination, customer, cargo category, package count and weight.
2. Staff review the request, dimensions/handling needs and available freight capacity.
3. Provide a quote and agree payment responsibility, collection and delivery terms.
4. Accept the quote and assign vehicle/driver or a cargo movement.
5. Record pickup, transport updates and delivery confirmation.
6. Issue the appropriate transport document and confirmed-payment receipt.

The prototype covers step 1 and the company's request list. Quoting, truck assignment, payments and delivery proof are not simulated as completed operations.

## First real backend: essential rules

- Company staff receive access through company membership; a normal staff account cannot change its tenant by sending another `companyId`.
- Model an explicit platform operator separately if cross-company administration is required. Its access and audit policy need agreement.
- Give passenger-facing search only the operator's published trip/fare data. Never expose company customer lists or internal records publicly.
- Claim seats using a database transaction/unique active-seat constraint. Browser checks cannot stop two phones from booking the same seat.
- Evaluate reservation expiry on the server during booking/payment actions and through a background expiry job. A phone's clock is not authoritative.
- Record trips and deadlines with timestamps plus the relevant local timezone. Changing company policy should not silently change an existing reservation's agreed deadline.
- A late payment attempt must recheck expiry and seat ownership before confirming a ticket. Expired seats may already belong to another passenger.
- Preserve payment, refund, cancellation and ticket audit trails. Do not treat a client button click as proof that money was received.
- Make retries idempotent so poor connectivity does not create duplicate reservations or payments. Decide how staff operate during outages before promising offline booking.
- Minimize passenger data. Agree which information is operationally required, who can view it and how long it is retained before collecting real records.

These are requirements for the real system, not claims about the current in-memory prototype.

## Proposed core records

| Area | Main records |
| --- | --- |
| Organization | Company, branch/office, user, company membership, role |
| Network | Destination, route, stop, service category |
| Fleet | Vehicle, bus seat layout, cargo capacity, driver assignment |
| Passenger operations | Trip, trip seat, fare, passenger, reservation, ticket |
| Offline money records | Staff payment confirmation, receipt, refund/cancellation record |
| Freight operations | Customer, freight request, quote, shipment, cargo items, delivery event |
| Controls | Reservation policy, document-number sequence, audit event |

Every private operational record needs a company owner. Shared platform destinations and public operator information can be modeled separately.

## Questions for our next discussion

1. Which offline payment channels are accepted, and what evidence does authorized staff need before confirming payment?
2. Can passengers reserve as guests, or must they verify a phone number? How should children or multiple passengers in one booking work?
3. Which staff roles are needed: owner, office manager, booking clerk, cashier, dispatcher, driver and freight officer? Who may cancel, refund or override a deadline?
4. Does an operator have multiple branches/agents? Can a reservation made in one office be paid in another?
5. How are fares set: route, trip, bus class, seat type, passenger category, luggage or cargo category?
6. How is freight quoted: weight, volume, package, truckload or a negotiated amount? Do sender and receiver both need records?
7. What is the boarding check: printed number, QR/barcode scan, passenger list or identity check? What equipment is available?
8. What are the cancellation, late-payment, no-show, refund and driver/offline procedures?

## Small implementation stages

1. **Now:** agree the workflows using this local passenger/freight prototype.
2. **Backend foundation:** real company/staff accounts, roles, durable database and audited server-side separation.
3. **Operational pilot:** transaction-safe reservations/expiry, actual passenger details, manual payment confirmation, tickets, receipts and the first freight quote/dispatch flow.
4. **Passenger mobile delivery:** choose the mobile approach, verification and notification channels; test on real devices and weak connections.
5. **Rollout:** hosting, backups, monitoring, operator onboarding, training and verified company isolation.

No production dates, prices or legal compliance guarantees are implied by this initial plan.
