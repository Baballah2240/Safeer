# Platform administration and notifications

Section 14 (D38) is local web functionality. It reuses the existing identity, company, marketplace, trip and station records; no external service or new money workflow is introduced.

## Super Administrator

Sign in at http://127.0.0.1:4320/staff with your existing account, then open **Platform overview**. Only an active assignment to the reserved Super Administrator role grants this global screen. Editing that role's display name or clearing its editable grants does not remove its reserved authority. Tenant administrators and support users cannot access global analytics or platform settings.

The overview shows current company counts, approval/listing counts and active global accounts. Scheduled published departures and newly created bookings use the selected date range; they are not counts of actual departures or completed journeys. Financial figures are recorded payments, refunds and net collections, separated by currency. Net collections are not profit. All company statuses are included in collection totals, including suspended/archived companies with retained history.

Select inclusive **From/To** dates, at most 31 days. Global posting dates and the snapshot label use **UTC**; company Finance retains its existing company-timezone rules. Refunds use their own posting dates. Monetary values stay exact integer minor-unit strings. Company cards show 50 records/page with a complete company count. Each page/filter request is a fresh snapshot; it is not a frozen multi-page export. Reports omit passenger details, payment references, notes and QR values. Reads are audited.

**Manage company** opens the existing company workspace. Approval/status changes remain under its overview; public listing is under its public-page settings. Existing password confirmation, version conflicts, audit and last-administrator protections still apply. **Platform controls** links to company management, users, roles, identity audit and the inbox. No duplicate approval engine or new financial authority exists.

## Public service notice

Use **Edit notice** to enter plain text in both English and Arabic, check **Enabled**, and confirm your current password. Each language allows up to 500 characters and no control characters/newlines. Both translations are required when enabled. The notice appears on real marketplace/company/trip/booking pages after loading or refreshing; it is escaped as text, including HTML-looking input. Disabled public responses omit the text entirely. Editing is versioned and audited without copying notice content into audit logs.

The notice does not stop reservations or change company policies. There is no global booking switch, HTML editor, external image or remote delivery. An unavailable notice endpoint does not block booking retrieval. Open marketplace pages require a reload to receive notice changes.

## Staff and driver inbox

Open **Notifications** in the staff sidebar. The local driver header also links to this inbox using the same account/session. Select **Refresh** for new events, **Mark read** for one event, and **Older events** for the next page. **Latest events** returns to the newest page. Read receipts belong to the signed-in account and repeated writes are harmless. A read marker acknowledges an event; it does not resolve an incident, luggage problem or cash difference.

The feed includes events created after migration 0014 and visible within the last 90 days. There is no historical backfill. Newly authorized staff can see relevant earlier events in that window. Current authority is checked on every list and receipt write; revoked memberships/roles/driver assignments, inactive identities and suspended companies lose access. Old downloaded/screenshot data cannot be remotely erased. Events older than 90 days are hidden, while physical metadata/receipt cleanup and private backup retention remain maintenance work.

| Event | Current eligible viewers |
| --- | --- |
| Company registration/status; marketplace listing changes | Super Administrator only |
| Trip canceled | Super Administrator, company-wide trip readers or currently assigned authorized driver/journey supervisor |
| Journey incident reported | Super Administrator or company-wide journey supervisor |
| Cash difference at session closing | Super Administrator or finance reader authorized for that originating station |
| Luggage problem reported | Super Administrator or company-wide luggage resolver |

Events store only event codes, company/source IDs, revision and creation time. Responses add current company names and own read status; no passenger names/mobile, transaction references, monetary amounts, incident/bag/cancellation notes or QR secrets are copied. Use the authorized existing company/driver workflow to inspect the referenced record. Branch/station-only luggage resolvers receive no company-wide luggage alerts; cash alerts follow precise station scope. Support grants gain no new capabilities.

The database captures events in the same transaction as the source operation, with unique code/source/revision deduplication. Failed operations cannot leave a committed notification. PostgreSQL is the durable source; this local version uses request/refresh delivery without Redis, WebSockets, email, SMS or push.

## Continue safely

Keep runtime/ private and intact. A source ZIP does not contain existing users, passwords or business records. Read [current state](../CURRENT_STATE.md), [Section 14 handover](../archive/SECTION_14_PLATFORM.md) and [identity recovery](../database/IDENTITY_SETUP.md) before restoring/updating. Section 15 security/integration/optimization/production preparation requires the next owner instruction.
