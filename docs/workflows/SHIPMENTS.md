# Shipments

D59 / migration 0016. Staff receive parcels sent without a traveler, take the fee at drop-off, send them on a published trip, and hand them over at the destination office to the recorded receiver.

## First setup, for a company admin

1. Add the permissions to the roles that need them. Existing company roles are not changed automatically.
   - `company.shipments.operate`: receive and take payment, print tags, move, hand over, return and report problems.
   - `company.shipments.resolve`: resolve reported problems (asks for the current password).
   - `company.shipments.prices`: set the price list.
2. Open **Shipments → Price list** and set one fixed price for each item type: Envelope, Small parcel, Large parcel and Other item. An item type with no price, or one marked unavailable, cannot be chosen.

## At the origin office

1. Open a cash session at the counter, as for ticket sales. Shipments cannot be taken without one, and the fee goes into that session.
2. Choose **New shipment**. Pick the published trip, the destination office, then enter the sender's and receiver's full names and phone numbers.
3. Add each item with its type and weight (up to 20 items). The total is the sum of the item prices.
4. Choose the payment method (cash, or a bank or wallet reference when the company allows it).
5. Tick the contents check: no cash, weapons, hazardous goods, live animals or perishable food.
6. Save. The receipt opens for printing. Give the sender the receipt: it shows the **tracking code** (SH-…).
7. Choose **Print tag** and fix the tag to the parcel. Its QR code is shown only once; a lost tag needs **Replace tag** with a reason.
8. When it goes on the bus, choose **Mark loaded**. To take it off before departure, choose **Take off the bus** with a reason.
9. Before it is loaded, **Return to sender** (with a reason) closes it. Safeer does not refund the fee; any refund is handled by the company outside Safeer.

## On the way and at the destination

- **Mark in transit** is available once the trip has departed. The driver's trip page lists the shipment numbers, item counts and destination offices, but no names or phone numbers.
- At the destination office, choose **Mark arrived**.
- To hand it over, choose **Hand over to receiver** and ask for the receiver's phone number and full name. Both must match what the sender gave; spacing and capital letters do not matter. If they do not match, Safeer refuses and the parcel stays with the office.

## Problems

Anyone with the operate permission can report a problem (damaged, missing, wrong bus, other). A shipment with an open problem cannot move or be handed over. Someone with the resolve permission records the outcome. For a missing shipment, **Settled** or **Closed** marks it **Lost** permanently.

## Tracking for senders and receivers

The Safeer website has a **Track a shipment** page (Booking menu → Track a shipment, or `/track`). It needs the tracking code from the receipt and shows only the status, the offices, the company, the trip and the item count. It never shows names, phone numbers, the internal shipment number or the price. A shipment with an open problem shows as delayed.

## Money and records

- The fee counts in the cash session total when it is closed, in the company finance report (as a payment with its receipt number) and in the platform totals.
- Receipt numbers share the company's receipt sequence with ticket payments.
- Sender and receiver names, phone numbers, item descriptions and problem notes are erased automatically 90 days after the trip arrives. Amounts, receipt numbers and the tracking status are kept.
- History, payments and tags cannot be edited or deleted.
