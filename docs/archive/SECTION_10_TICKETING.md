# Section 10 - Station ticketing, payments, tickets and receipts

Authorized by the owner's "next" on 2026-11-02, decision D32. Version 0.11.0. Status: source complete and verified. One owner step is open: upgrading the existing private local database (below). The owner said they will return to the money flow later; the questions for that visit are listed below.

## Delivered source

Staff open a cash session at a counter, take full payment for a booking by cash, bank transfer or mobile wallet, sell walk-in seats, print tickets and receipts, and refund. Payment, receipt, tickets and seat confirmation commit together. Later prints are marked as copies. A hold that has ended can be paid late with a separate permission. Closing a session compares counted cash with the records and keeps any difference. Passengers see their ticket numbers, refunds and trip cancellations on their booking page.

Migration 0010 adds company_payment_settings, station_counters, cash_sessions, document_sequences, payments, receipts, tickets, refunds and document_prints, plus fixed functions. Migrations 0001-0009 are unchanged. The runtime role has no access to these tables. New permissions: company.ticketing.operate, company.payments.late and company.sessions.manage.

Files added: apps/api/src/ticketing.service.ts, database/migrations/0010_ticketing.sql, src/station.js, tests/ticketing.integration.mjs, tests/ticketing.browser.mjs, the station ticketing workflow and this handover. No Stocrant or school files are changed.

## Verification and issues

96 automated checks passed on a disposable PostgreSQL instance, without failures or skips: 13 unit/server and 83 native PostgreSQL (10 database, 12 identity, 10 company, 8 route, 7 fleet, 8 trip, 5 marketplace, 8 reservation, 6 passenger, 9 ticketing). The ticketing browser suite passed 32 Arabic/English dark/light layouts per source and built run at 1920, 1366, 390 and 320 pixels with no browser or security-policy errors. The passenger prototype, identity, company, route, fleet, trip, marketplace and reservation browser suites passed in built mode.

**The independent review was only partly completed.** A usage limit stopped it. Its security and station-screen reviewers finished, with 26 findings. Its money-handling reviewer and its separate verification step did not run. The findings were checked against the code by the same author who wrote it, who also read the money functions for totals, locks, repeats and numbering. That is not independent, so an independent money review is still owed before real money is handled.

Fixed from the review: station staff could read every passenger through the seat map and the empty booking list; a finished trip could be canceled to reopen refunds; session notes and reasons written after erasure were kept forever; a read-only role could use up the original print; money audit rows were invisible to station managers; several permission checks disagreed with the rule they display; the money functions trusted a named actor; a walk-in's history said the passenger held the seats; the sale form forgot the chosen payment method, so a retry could record a transfer as cash; a sale with a lost reply vanished without a message and could be sold twice; Print again made uncounted originals; a double click used up the original; roles lacking booking access sold tickets they could not see; chosen seats looked free in the dark theme; a failed attempt reopened a booking later, even after sign-out; and a paid booking on a canceled trip said the tickets were confirmed. Smaller screen and message problems were fixed with them. The author's own read added one more: a retry of a completed sale was refused once the session had closed.

Not fixed: viewing a booking is still recorded without its station, so station managers cannot see those rows in the audit.

Erasure of session notes and later reasons was tested by moving stored dates. A full 90-day wait was not run. The print dialog is called in the browser tests, but no physical printer was used.

## Questions for the owner's return to the money flow

1. Station staff can now find a booking only by reference or full mobile number, not by name or from a list. The author tightened this to match "managers do not automatically see the whole company". Is that right for the counter?
2. A trip can be canceled up to its arrival time, so a breakdown on the road still gets refunds. Should the line be departure instead?
3. Transaction references on payments and refunds are kept forever as financial records, with a hint not to type phone numbers. A wallet reference can be the payer's number. Keep them, or erase them with the passenger's details?
4. A cash refund is allowed even if the drawer's expected total goes below zero. Should it be refused, or need a manager?
5. A forgotten session stays open until someone closes it. Should sessions close or warn automatically?
6. The same employee can take a payment and refund it, as chosen in D32. Is a report of those enough, or is a second person wanted? Section 13 could show this.
7. Each session uses SDG. A trip priced in another currency cannot be paid at a counter (CURRENCY_MISMATCH). Is SDG the only currency for release 1?
8. Final receipt wording, tax and legal retention are still undecided and need review before real use.

## Open owner step: upgrade the private local database

The real runtime/ database is still at Section 04. The automated session was not permitted to stop the running local launcher, so migrations 0005-0010 and their backup are still to run.

1. Stop the running local launcher.
2. npm.cmd run local:backup -- Section-10
3. npm.cmd run local

Do not run step 3 if step 2 reports a failure. Then add the new permissions to existing company roles.

## Checkpoint

Source checkpoint: archives/Safeer-0.11.0-Section-10-2026-11-02.zip, generated from the committed source. It excludes accounts, credentials, runtime databases, backups, native caches and node_modules.

## Limits and next section

Local only. Payments are recorded, not processed, and staff confirm transfers themselves. Partial and split payment are not available. Tickets have no QR code until Section 12. Stop before Section 11 (passenger luggage) until the owner approves it. Continue from [CURRENT_STATE](../CURRENT_STATE.md).
