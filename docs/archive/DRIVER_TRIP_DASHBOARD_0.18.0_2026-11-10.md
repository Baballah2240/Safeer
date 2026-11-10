# Driver Trip Dashboard - 0.18.0, 2026-11-10

D66 implements the owner's Option B specification in the existing Safeer Driver stack, routes and authorized booking/trip data. No additional driver mockup was attached; the accepted violet-blue reference and written dashboard requirements were used. The owner requested a downloadable Driver-only version and declined connected-phone testing. Booking remains at 0.17.0/17000.

## Implementation

- Frosted route/departure/status card, valid boarded/total count and progress, primary Scan ticket, Passenger list below, scheduled next-stop data and explicitly unavailable live ETA.
- One-tap local video QR decoding, sharp scan frame, optional torch and printed ticket fallback. Accepted, already scanned, wrong trip, invalid, boarding closed and unavailable/retry states pair text with icons and high-contrast solid surfaces. Continuous identical frames do not repeatedly submit.
- Successful validation refreshes the authoritative manifest and counts while retaining the stream. A lost response pauses scanning and retries the same credential. Existing database locks and unique boarding record prevent duplicates; atomic alreadyBoarded distinguishes retries from the first commit. No QR credentials in storage, URLs, logs or audit payloads.
- Passenger name/seat/ticket/booking-reference search, All/Waiting/Boarded filters, scanner shortcut and responsive phone cards. Existing journey/incident operations, draft handling, shipments and assigned-driver/company permissions remain.
- Migration 0019 extends the existing private manifest core, preserves its denied runtime grant and D59 public wrapper, and adds minimal TICKET_WRONG_TRIP for opaque same-company QR only. Printed ticket numbers never search another trip. No new tables, role grants, booking/payment policy or production-data edits.
- Optional Android CAMERA belongs only to Driver; video capture requires the fixed approved origin and /driver. No audio grant or JavaScript bridge. The camera stops on navigation, background/pagehide, logout and authority loss. Browser policy permits camera only on /driver. Old Driver clients show the update requirement; Booking cannot request native camera.
- Platform BarcodeDetector when available; pinned jsQR 1.4.0 Apache-2.0 fallback is bundled with its license and provenance. No external frame service or CDN.

The upstream D65 operations dashboard/booking homepage and migration 0018 are preserved. Driver uses decision D66 and append-only migration 0019.

## Release

Signed Driver `sd.safeer.driver` 0.18.0 / 18000 uses the existing upload certificate. `mobile:build:driver` builds/lints only Driver; `mobile:save:driver` saves its ignored APK/checksum/latest-driver manifest and updates per-app release metadata. Booking APK metadata stays byte-for-byte on its existing release; legacy global version remains 17000 so older cached consumers do not offer Booking the Driver update.

Driver APK: 17,896 bytes; SHA-256 `7ecafb83cb831dc14f3f541976e47a63976f9ff8bfb7fe8b689ec09a2620a02f`.
Certificate SHA-256: `a19fb6c1832196283aa3cf342ac4c2aa78b56d736702f8bccca1d8fcf8df7205`.
Booking remains 16,732 bytes; SHA-256 `f2b4cd7ceacaccb8558452dcd53c59c1a61078d2727f72803e7796511c4cca7c`.

Public release: https://github.com/Baballah2240/Safeer/releases/tag/v0.18.0 (Driver APK and checksum only). Publishing and live verification are recorded below after completion. No install on a physical phone is claimed.

## Verification

Test receipts and screenshots are ignored `.qa/` artifacts and contain fictional data only. Unit/build, PostgreSQL migration/boarding/authority and actual browser getUserMedia with synthetic QR video verify the feature. The video is decoded by the real bundled jsQR fallback, with valid, duplicate, wrong-trip and invalid QR frames. A deliberately lost reply after server commit is retried without a second boarding. Phone layouts, passenger filtering/search, camera pause/Back cleanup and reduced motion are exercised. Legacy manual/boarding flows and separate app menus/update notices are regression checked.

Android release build and lint pass with 0 errors and the same 2 existing warnings (target SDK 35 and the API-33 Back attribute). Signature/version/permission inspection is performed on the saved final APK. Physical camera, autofocus, torch hardware and Android permission-prompt behavior remain untested on hardware by the owner's choice; automated checks do not replace that evidence.

## Primary camera references

- [Android PermissionRequest](https://developer.android.com/reference/android/webkit/PermissionRequest): grant only RESOURCE_VIDEO_CAPTURE for the approved page/resource.
- [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia): secure context and explicit camera permission.
- [MDN Barcode Detection API](https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API): feature detection and decoder fallback.

## Completed local release gate

- npm run check: 25 unit/server tests, API/static build (52 assets) and 78 documentation files pass.
- PostgreSQL 16: 22 distinct boarding, Driver dashboard, operations, security and shipment integration tests pass across the combined run and corrected operations-contract rerun. The operations assertions now expect the intentional TICKET_WRONG_TRIP response; counts remain unchanged for wrong/duplicate tickets.
- Eight built browser scripts pass on the integrated source: Driver dashboard camera/video, operations dashboard, manual ticket fallback (16 layouts), legacy boarding (16 layouts), Driver menu (40 layouts), Booking menu (40 layouts), sticky headers (64 combinations) and independent release notices. Shipment browser verification also passed before upstream integration; the integrated shipment backend suite passes.
- Saved final Driver APK verifies with Android v2 signing, version 18000/0.18.0 and the existing certificate above. Optional CAMERA is declared; neither microphone nor audio permission is present. Booking release metadata/hash is unchanged.
- Temporary test databases are separate loopback clusters and were stopped. No production boarding or booking transaction was used for verification.
