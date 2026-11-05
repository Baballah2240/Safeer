# Section 11 - Passenger luggage

Authorized by the owner's "next" on 2026-11-02, decision D33. Version 0.12.0. Source and local upgrade are complete and verified; see the D34 update below.

## Delivered source

Travelers can say what luggage they have when booking, on the passenger and walk-in forms. Staff use a new Luggage section to scan or search, register bags on paid tickets with type, pieces and weight, print QR tags, move bags one step at a time, report and resolve problems, and hand bags over against the ticket or mobile number. A ticket cannot be refunded while its bags are with the company. Passengers see their bags and status on their booking page.

Migration 0011 adds luggage_records, luggage_tags, luggage_events, luggage_exceptions and booking_passengers.luggage_note, plus fixed functions. Migrations 0001-0010 are unchanged. The runtime role has no access to these tables. New permissions: company.luggage.operate and company.luggage.resolve. New dependencies: qrcode-generator 2.0.4 (MIT) to draw the QR, and jsqr 1.4.0 (Apache-2.0) for tests only.

Files added: apps/api/src/luggage.service.ts, database/migrations/0011_luggage.sql, src/luggage.js, tests/luggage.integration.mjs, tests/luggage.browser.mjs, the luggage workflow and this handover. No Stocrant or school files are changed.

## Correction to Section 09

Business rules already asked for a luggage declaration per traveler at booking. Section 09 missed it. This section adds it as one optional note, where empty means none, rather than a separate yes/no.

## Verification and issues

102 automated checks passed on a disposable PostgreSQL instance, without failures or skips: 13 unit/server and 89 native PostgreSQL (10 database, 12 identity, 10 company, 8 route, 7 fleet, 8 trip, 5 marketplace, 8 reservation, 6 passenger, 9 ticketing, 6 luggage). The luggage browser suite passed 32 Arabic/English dark/light layouts per source and built run at 1920, 1366, 390 and 320 pixels with no browser or security-policy errors. The printed QR was read back by an independent decoder. The passenger prototype, identity, company, route, fleet, trip, marketplace, reservation and ticketing browser suites passed in built mode.

An independent review covered this section and the Section 10 money review that a usage limit had stopped. All four reviewers finished, with 26 findings, and none was refuted by verification. It found no error in the money totals, locks, repeats or numbering.

Fixed in luggage: the tag printed the ticket number, which alone was enough to collect the bag; a lost bag had no end state, so it blocked a refund until staff recorded a false handover; a bag could be marked in transit before its bus left or on a canceled trip, which also avoided the reason needed for a return; a bag showed its old bus after the trip's bus changed; staff could walk sequential numbers to read passengers' names; notes could be written after erasure and stayed forever; every new Arabic error and permission appeared as a raw code; pressing Escape destroyed a QR that cannot be shown again; a lost reply on tagging or registering led to dead ends or a duplicate bag; two people could silently retire each other's new tag; edits and tag changes were missing from the audit; and smaller screen problems, including focus for the next scan.

Fixed in Section 10: a sale in doubt was forgotten on leaving the screen, so it could be sold twice. It now survives leaving the screen. On sign-out it is dropped with a warning to check Bookings first, because a different person must not finish it. A receipt printed from a stale screen now shows a later refund, and a counter can no longer be deactivated while a session is opening on it.

Not fixed, because the risk is low or it is a design choice: the server still accepts a sale from a role without booking access, with the money correct and only the screen stopping it; the search limit is held in memory, so it resets when the API restarts, and it does not cover the separate bookings search. Viewing a booking is still recorded without its station.

Hand-over checks are not limited in number, because only signed-in staff can attempt them. Erasure was tested by moving stored dates. A full 90-day wait was not run. No physical printer or scanner was used.

## Decisions the author made, for the owner to check

1. Resolving a missing bag as settled or closed marks it Lost. This ends the company's custody and lets the refund go ahead. It cannot be undone, so a bag found later needs a note outside the system.
2. A bag cannot be marked in transit before the trip's scheduled departure, so a bus leaving early waits for its clock.
3. A staff member can type up to 300 numbers an hour under Luggage. Scans do not count.
4. The ticket number is left off the tag, so a bag's tag alone cannot collect it. Anyone holding the ticket or knowing the booking's mobile number still can, as the owner chose.

## Completed local upgrade (D34, 2026-11-02)

The owner explicitly approved backup, update and restart. The previously running 0.5.0 launcher was stopped. Its stale database marker was checked against the missing process, and PostgreSQL performed normal recovery before backup; no runtime data or marker was manually deleted. A clean physical backup matched 1378 files and was started independently in a protected temporary restore directory, then stopped before verified cleanup. The original backup is retained privately. Migrations 0005-0011 are now applied and local health reports 0.12.0 with a connected database. The existing account/credentials/settings, role labels and all 18 preserved legacy tables are unchanged. No company records exist in this runtime yet.

For future upgrades: stop the launcher, run npm.cmd run local:backup -- Section-11, then npm.cmd run local only after backup verification succeeds.

Never continue after a failed backup check. Existing company role copies still need new permissions explicitly assigned; this upgrade does not silently broaden access.

## Open owner step: push to GitHub

The Safeer commits from Section 04 onward are on local main and have not reached GitHub, because the automated session has no GitHub login. The owner runs git push origin main from their own terminal. That push also carries school-display commits and the developer portfolio commit 2afd97b, which was not made in this work, so check it first. A push does not deploy anything.

## Waiting for the owner

The owner said they will return to the money flow later. Eight questions for that visit are in [Section 10](SECTION_10_TICKETING.md). Four luggage rules chosen by the author are listed above under decisions to check.

## Checkpoint

Source checkpoint: archives/Safeer-0.12.0-Section-11-2026-11-02.zip, generated from the committed source. It excludes accounts, credentials, runtime databases, backups, native caches and node_modules.

## Limits and next section

Local only. There is no allowance or fee, no camera scanning and no driver use of tags yet. Stop before Section 12 (driver client, QR verification, boarding) until the owner approves it. Continue from [CURRENT_STATE](../CURRENT_STATE.md).
