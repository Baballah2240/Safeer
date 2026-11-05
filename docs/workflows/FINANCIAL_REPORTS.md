# Finance reports and cash reconciliation

Section 13 (D37) reads existing station payments, refunds and cash sessions. It never changes a payment, issues a refund, adjusts a balance or approves a settlement. Existing financial questions remain recorded in [Section 10](../archive/SECTION_10_TICKETING.md).

## Access

In the staff workspace, open Companies → your company → **Finance**. An existing company role must explicitly receive `company.finance.read`. New company, branch and station manager templates include it; existing tenant-role copies remain unchanged. The interface also needs the existing `company.profile.read` capability to open the company workspace.

Company-wide readers see their company. Branch/station readers see only transactions processed through cash sessions in their permitted resources, even when the trip belongs to another route or station. Station/employee filters can narrow this access, never broaden it. Super Administrator retains access to all companies. Drivers and support grants gain no financial access. Finance read access grants no payment, refund or session-closing authority.

## Reports

Choose inclusive **From** and **To** posting dates, at most 31 days, using the company's timezone. Dates refer to when payment/refund was recorded, not the trip's scheduled departure. Optional station, employee and payment-method filters narrow transaction totals/history.

- Gross payments, refunds and net collections are shown separately for each currency, with ticket counts. Net collections equal payments minus refunds and are not profit; operating costs are not recorded in this module.
- Method summaries distinguish cash, bank transfer and mobile wallet. Those are existing offline payment records; there is no new gateway or transfer confirmation.
- Expand daily/employee/station/trip breakdowns for movement counts and net collections. A refund recorded later can make that day's net collections negative.
- Transaction history shows financial document references, dates, methods, amounts and operator/station labels. It omits passenger names, mobile numbers, payment references, free-text reasons and QR values. Labels use the current staff/station names; financial amounts and document history remain immutable.

Each successful report returns a database snapshot timestamp. Paging preserves it so new transactions do not move existing rows between pages. Applying filters creates a fresh snapshot. Every read/export/print request rechecks current authority. There are 75 transaction rows and 50 cash sessions per page; totals and breakdowns cover all matching movements, not only the current page.

## Cash reconciliation

The cash table includes sessions overlapping the chosen dates. It displays the counter, operator, opening/closing time, opening cash, cash received/refunded, expected cash, counted cash and difference. These amounts cover each session's full lifetime up to the snapshot. They are not only the date-filtered transactions. A payment-method filter does not change this table.

Expected cash is opening cash plus cash payments minus cash refunds. Transfers and wallets do not affect the drawer. Closed sessions retain the expectation/count/difference recorded when they closed. A historical snapshot before closure still shows that session as open. Sessions open over 24 hours are labeled; the report never closes them automatically.

Count and close a session using the existing **Station** workflow and its permissions. A difference still needs the existing closing note. Negative expected cash, refund eligibility, currency restrictions, self-refunds and forgotten-session rules remain unchanged from D32. Finance adds visibility and grants no new money controls.

## Export and print

**Export all transactions (CSV)** exports all matching movements at the selected snapshot, up to 10,000 rows. A larger export is refused with a message to narrow the dates/filters; it is never silently truncated. UTF-8 CSV retains Arabic labels, quotes text correctly and neutralizes spreadsheet-formula labels. Amounts are signed integer minor units (one unit = 100 minor units in the current system), with currency in a separate column. No currency conversion is performed.

**Print current pages** rechecks access, opens a report-only dialog and calls the browser print interface (including Save as PDF where available). It prints summary/breakdowns plus the currently selected transaction and cash-session pages, labeled with their page numbers. It does not pretend to print the complete paginated ledger. Report/export access is audited without passenger/search text.

## Local operation

The application remains at http://127.0.0.1:4320/staff on this computer. No native app, remote access or hosting is enabled. A source archive excludes the private runtime; existing accounts/history need the separate private backup. See [current state](../CURRENT_STATE.md) for actual verification and upgrade status.

After a bulk import/restore, the database owner must refresh table statistics (ANALYZE); keep normal PostgreSQL autovacuum enabled. Migration 0013 initializes statistics for existing history. See the section handover for the verified 20,002-movement fixture.
