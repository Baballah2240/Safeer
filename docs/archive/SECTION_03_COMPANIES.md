# Section 03 - companies and isolation

Version 0.4.0, 2026-10-31. Authorized by the owner's latest "next", recorded as D24.

## Delivered

Real local company workspaces with approval/settings, branches, stations, tenant-owned roles, multi-scope memberships, one-time staff onboarding, read-only expiring support grants and append-only company audit. Integrated with the existing authenticated staff interface, bilingual dark/light design and platform role tools. No Stocrant or school files are changed.

Migration 0003 adds eleven RLS-protected company tables and nine company permissions. Composite FKs and immutable ownership prevent cross-company resource links. Raw transaction-local session capabilities identify the actor; membership/role/resource status and database-time support expiry enforce scope. Identity and company mutations use the existing transaction lock; deferred administrator checks protect against concurrent lockout and global account deactivation. Global role templates copy into new company roles without rewriting existing company copies.

## Boundaries

Local loopback only. No public company pages, routes, fleet, trips, real bookings, money/tickets or native mobile app are built. Stations acquire city references in Section 04. Driver/boarding trip roles wait for actual trips. Shared global account linking/recovery remains a Super Admin task. Source checkpoints exclude business databases and credentials.

## Verification

Verified 43 automated checks (13 unit/server and 30 native PostgreSQL), with no failures or skips. Company browser workflows passed in source and built modes across 72 layouts each; existing identity workflows passed in both modes across 60 layouts each, and passenger/luggage checks passed in both modes. The private backup was restored in isolation and verified; the existing local account, credentials and first-login file are unchanged.

The native migration/identity/company suite covers upgrade preservation, cross-company/resource reads and writes, raw runtime RLS, invalid links/flags, permission escalation, support expiry/revocation, shared identities, company status, concurrent last-admin changes and rollback. Browser workflows cover real company creation/approval, branches/stations and station edits, role create/edit, employee onboarding/assignment, support grant/revoke and single-company station isolation across 72 Arabic/English dark/light responsive layouts per source/built run. Existing identity and passenger/luggage workflows are checked separately.

Private local database backup and account-preservation receipts precede applying the migration to runtime/. Verification evidence and the exact commit are included in archives/Safeer-0.4.0-Section-03-2026-10-31.zip. Prior verified archives remain separate. ZIP CRC, file hashes and exclusions are checked at handover.

## Next section

Stop before Section 04 (cities/routes/destinations and ordered stops). Obtain explicit owner approval before continuing. Start with [CURRENT_STATE](../CURRENT_STATE.md).
