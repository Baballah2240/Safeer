# Section 07 - Passenger marketplace and company pages

Authorized by the owner's "next" on 2026-11-02, decision D28. Version 0.8.0. Status: source complete and verified. One owner step is open: upgrading the existing private local database (below).

## Delivered source

A public marketplace at /marketplace where anyone can search published trips by origin, destination and date, sort by departure, price or journey length, and open a company page at /company/{slug} showing its details, contact, routes, bus types and upcoming trips. Companies control their own public page from a new Public page section. No account is needed and no passenger details are collected.

Migration 0007 adds company_public_profiles with row security and three anonymous read functions, each listing its exact fields. Migrations 0001-0006 are unchanged. Listing defaults to off, so existing companies stay private until they opt in.

New API operations: anonymous GET public/cities, public/companies, public/companies/:slug and public/trips; GET/PUT companies/:id/public-profile, requiring company.profile.manage, with CSRF and the current password for writes.

Files added: database/migrations/0007_marketplace.sql, apps/api/src/public.service.ts, marketplace.html, src/marketplace.js, src/marketplace.css, src/public-page.js, tests/marketplace.integration.mjs, tests/marketplace.browser.mjs, the marketplace workflow and this handover. No Stocrant or school files are changed.

## Verification and issues

73 automated checks passed on a disposable PostgreSQL instance, without failures or skips: 13 unit/server and 60 native PostgreSQL (10 database, 12 identity, 10 company, 8 route, 7 fleet, 8 trip, 5 marketplace). Marketplace browser checks passed 32 Arabic/English dark/light layouts per source and built run at 1920, 1366, 390 and 320 pixels with no browser or security-policy errors. Trip and passenger browser suites also passed.

Coverage: unlisted, unapproved, suspended, draft and canceled records staying hidden; private drivers, registrations, bus codes and company contacts never appearing; filter validation; direct table access blocked for the runtime role; stored text never running as script; only profile managers changing the page.

## Open owner step: upgrade the private local database

The real runtime/ database is still at Section 04. The automated session was not permitted to stop the running local launcher, so migrations 0005-0007 and their backup are still to run.

1. Stop the running local launcher.
2. npm.cmd run local:backup -- Section-07
3. npm.cmd run local

Do not run step 3 if step 2 reports a failure.

## Checkpoint

Source checkpoint: archives/Safeer-0.8.0-Section-07-2026-11-02.zip, generated from the committed source. It excludes accounts, credentials, runtime databases, backups, native caches and node_modules.

## Limits and next section

Local only, so "public" means this computer until hosting is authorized. Search matches a trip's first and last stops only. Up to 100 trips per search and 200 listed companies, without pagination. Seats shown are the bus's total, not availability. Logos are deferred until file storage exists; pages show the company's initial. There is no rate limiting on public routes yet, which hosting must add. Stop before Section 08 (seat inventory and temporary reservations) until the owner approves it. Continue from [CURRENT_STATE](../CURRENT_STATE.md).
