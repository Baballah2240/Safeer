# Passenger luggage

Section 11 / 0.12.0. Staff register, tag, track and hand over passengers' bags. There are no fees.

## First setup, for a company admin

Add company.luggage.operate to the roles that handle bags, and company.luggage.resolve to whoever settles problems.

## Daily work

1. Scan a tag or type a ticket, tag, bag or booking number under Luggage.
2. To register a bag, search for the ticket and choose Register a bag. Enter the type, number of pieces and weight. Anything the traveler said they carry is shown beside the ticket.
3. Print the tag and fix it to the bag. The QR can only be printed at this moment. If a tag is lost or torn, choose Replace tag with a reason; the old one stops working, so take it off.
4. Mark the bag loaded, in transit and unloaded as it travels. In transit opens at the trip's departure time. If it went on the wrong bus, choose Take off the bus with a reason.
5. To hand over, ask for the ticket number or the mobile number on the booking.

## Problems

Anyone handling bags can report a problem. The bag shows Problem reported and cannot be handed over. Someone with the resolve permission records the outcome with their current password, and the bag goes back to its recorded state. A missing bag resolved as settled or closed becomes Lost, which cannot be undone, and its ticket can then be refunded.

## Refunds and canceled trips

A ticket cannot be refunded while its bags are with the company. Before travel, choose Return to passenger with a reason, then refund. On a canceled trip, take the bag off the bus first if it was loaded.

## Limits

Scanning uses a hardware scanner or typed input, not a camera. Weight is recorded only: no allowance or fee is applied. The driver's use of tags belongs to Section 12.

## D61 operator safeguards

A new search clears previous results and actions immediately. Refresh luggage repeats the last submitted search, not unsubmitted text. On connection failure, correct the connection and refresh; no successful move is assumed. If 50 bags are shown, this is a bounded view, not the entire inventory. Find an older bag using its specific bag/tag number. Earlier delayed responses cannot overwrite the latest result.

For missing-bag exceptions, Settled or Closed permanently marks the bag Lost and ends company custody; Found returns it to the recorded lifecycle. Read the warning before confirming with your password. This does not itself pay compensation or issue a refund.

See [the operational improvement plan](LUGGAGE_IMPROVEMENT_2026-11-09.md).
