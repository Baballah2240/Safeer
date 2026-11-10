# Local driver workspace

## D66 current phone workflow - 2026-11-10

Use Safeer Driver 0.18.0 connected to https://safeer.mohbaba.online/driver. The active assigned trip opens on the dashboard. Scan ticket starts the QR camera in one tap; an accepted QR boards immediately, refreshes the count/list and keeps the camera ready. Remove the ticket before scanning another one. Already scanned never adds a second boarding. Wrong trip/invalid/boarding closed do not board. Validation unavailable pauses automatic scanning; Retry validation resends the same ticket safely, including when a previous server reply was lost.

Passenger list searches names, seats and booking codes and filters All/Waiting/Boarded. Back or leaving scanning stops the camera. Backgrounding the app stops it; use Start camera on return. Flashlight is optional and enabled only when supported. For permission denial or unsupported camera, choose Manual code entry; Check ticket then Confirm boarding remains the explicit printed-number/hardware flow. No offline boarding. Camera frames remain on the device and no audio is requested. Next stop uses known schedule/phase only; no live ETA is fabricated. Booking is a separate unchanged 0.17.0 APK. The historical local-only limitations below are superseded by D57/D66.

Open http://127.0.0.1:4320/driver, or use **Driver workspace** in the staff sidebar. It shares the existing account, session and password with `/staff`. Change a temporary password in the company workspace before operating trips. Language and theme controls are available on both pages. This is a responsive local web client; no Flutter app or remote phone connection exists yet.

## Manager setup

1. Approve the company, create its routes and seat maps, then add buses and driver records using the existing workflows.
2. Create the driver's staff account under Companies → Members. New companies have an **Assigned driver** role; assign it at company scope. It grants `company.driver.operate`, whose database checks narrow access to current driver assignments. It does not grant general bookings, contact details, payments or fleet access.
3. Existing companies keep their previous roles unchanged. An authorized manager must explicitly create a company-scope driver role with `company.driver.operate`, or add that permission to an appropriate existing role. Ensure the manager has permission to delegate it. Super Administrator can make these changes.
4. In Companies → Drivers, edit the driver and link the same-company staff member. Linking creates no login and grants no permissions by itself.
5. Assign that driver and a bus to a published trip. The driver sees only trips whose current assignment points to their active driver/member record. Reassigning the trip removes the former driver's access.

Company-wide supervisors need `company.journeys.manage`; new company administrator templates include it and the permission needed to delegate driver access. Existing company role copies need explicit grants. Branch/station grants cannot broaden into company-wide journey authority. Super Administrator can supervise all companies.

## Station to driver workflow

Authorized station staff confirm offline payment and print tickets from the booking. Each ticket includes its own opaque QR. Later copies retain the same QR and are marked as copies. A reservation reference, ticket number or luggage tag is not a passenger boarding QR.

The driver signs in, selects an assigned trip and opens the manifest. It contains passenger names, seats, ticket numbers and current boarding/validity state, without contact numbers or payment/luggage collection details. Viewing the manifest is audited.

Use a keyboard-style scanner to enter the printed ticket QR into **Scan or paste ticket QR**. Press Enter or **Check ticket**. Check the displayed name and seat, then select **Confirm boarding**. Checking alone does not board the passenger. A repeated boarding request returns the existing record; it never boards a second time. QR values stay out of URLs and audit payloads.

Boarding opens 24 hours before scheduled departure and closes at actual departure or scheduled arrival. An unpaid, refunded, wrong-trip or canceled ticket is invalid. Payment/refund and cancellation state are checked again when boarding commits. A refund before scheduled departure remains possible after boarding under the existing D32 policy; the manifest then marks that ticket invalid.

## Journey and incident records

**Record departure** becomes valid at scheduled departure time. The confirmation shows the number of valid passengers who have not boarded; it does not silently mark them boarded. **Record arrival** follows recorded departure. Both use database timestamps and are safe to retry. The schedule is never overwritten. Once actual departure is recorded, assignment changes are blocked; after actual arrival the trip cannot be canceled to reopen refunds. Emergency assignment corrections need a future explicitly designed workflow.

Use **Report incident** for delay, breakdown, safety or other events. Enter operational facts without passenger names or contact details. A trip accepts at most 100 incidents. A request whose response is uncertain keeps its exact payload/key for retry; fields stay locked until that request is confirmed. The browser does not persist incident or passenger data in local storage. Switching trips asks before discarding an unfinished incident; refreshing the page loses unsent drafts.

Names follow the existing passenger erasure schedule. Incident notes are cleared 90 days after scheduled arrival; event types, dates and actor IDs remain as operational history. Private backups are retained separately and must still follow the owner's backup-retention policy.

## Limits

No camera scanning, offline boarding, native installation, deployment, push notifications or Section 13 financial reports. A connection failure never reports success. Use **Refresh** to reload current assignments and status; writes always recheck authority. This local service cannot currently be reached by another phone or laptop.
