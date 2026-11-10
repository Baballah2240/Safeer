# My Trips glass redesign - 0.17.0 - 2026-11-10

The owner supplied the My Trips reference and requested its visual language using real Safeer routes, stack and booking data. D64 records authorization. The implementation keeps Booking and Driver separate, preserves the D59 shipment commit and introduces no new framework, guest account or online payment policy.

## Design and navigation

| Role | Exact color |
| --- | --- |
| Selected tabs | #6234D9 |
| Primary buttons | #295BE0 |
| Background glow | #586DF4 |
| Pickup marker | #FF4961 |
| Drop-off marker | #FB3D75 |
| Labeled status badge | #F8C152 |

Booking uses translucent rounded cards with thin light borders and an opaque, readable photo overlay. Upcoming/Past show actual device-owned reservations; the next card prioritizes chronology and stable same-time ordering. The real journey timeline, boarding instructions, seat numbers and paid-ticket QR are linked through existing /hold/:reference pages. Book gains passenger intent while retaining existing route/seat/hold/payment flow. Profile exposes truthful guest settings. Book/Trips/Profile sit in a frosted, safe-area-aware bottom bar. Driver receives matching scoped colors/native recovery surfaces while retaining its own menus, assignments and boarding authority. Staff tools retain their existing theme. Motion respects reduced-motion preferences and transparency/forced-color fallbacks.

## Data, security and migration

Migration 0017 adds a read-only passenger_booking(reference,accessHash,mobile) projection with fixed search_path and no PUBLIC execution. Exactly one proof must match the same booking. Device-key reads receive exact historical stop/timezone/timestamp snapshots and existing valid paid-ticket credentials; the API converts them to QR vector geometry and removes raw token fields. Reference/mobile reads retain the existing masked names/contact fields and never receive QR. Refund/cancellation removes QR presentation. No existing migration checksum or booking/payment row is changed. Runtime grants and the reviewed security catalog are extended explicitly.

Existing keys remain local. A route-only cache preserves public schedule fields without names, phones or QR credentials. Device-owned bookings are bounded at 50 with explicit guidance and manual lookup. Missing/failed data is identified rather than invented. No real production booking or payment is created for testing. Rollback must keep the reviewed migration/grant/security-catalog combination consistent; do not restore an old security catalog alone after installing 0017.

## Artwork

The coach is a neutral generated illustration, not a photograph of the assigned fleet. Saved asset: [src/coach-journey.jpg](../../src/coach-journey.jpg), approximately 217 KB. It was generated with the built-in image_gen tool and format-optimized for delivery. The full final prompt and provenance are in [COACH_ASSET_PROMPT](../design/COACH_ASSET_PROMPT.md). The user-supplied mockup is the layout reference, not a replacement for real route/booking data.

## Verification and publication

Automated evidence is collected on disposable PostgreSQL 16 with fictional identities. Standard checks include 21 unit/server cases and the 44-asset build. Targeted projection/passenger/reservation/ticket/security integration checks cover correct/wrong proof, masked recovery, QR decoding against the existing ticket credential, refund/cancellation revocation and preserved payment/idempotency/erasure rules. Migration upgrade/checksum/rollback tests retain existing history. The dedicated browser flow covers Trips/ticket/Profile in 16 language/theme/phone/tablet combinations, empty/cancelled/history states, exact colors, sharp QR clearance, reduced motion and an actual two-passenger search/hold/station-payment/ticket journey. Existing marketplace, reservation, ticketing, luggage, menus, headers, login, driver and shipment compatibility checks run on the integrated source. Final receipts are recorded below after completion.

Android website-channel packages: sd.safeer.driver and sd.safeer.booking, version 0.17.0 / code 17000. Both are signed using the unchanged Safeer upload certificate; private signing material and APKs are excluded from Git. Build/lint and Android signature checks passed; lint retains zero errors/two known compatibility warnings per flavor. Physical phone installation is a separate user action.

| APK | Bytes | SHA-256 |
| --- | --- | --- |
| Safeer-Driver-0.17.0.apk | 16720 | 47a34f9f532013f6e259c77976532d3a72a7574267812303f72a1432e470a03e |
| Safeer-Booking-0.17.0.apk | 16732 | f2b4cd7ceacaccb8558452dcd53c59c1a61078d2727f72803e7796511c4cca7c |

Public release target: [v0.17.0](https://github.com/Baballah2240/Safeer/releases/tag/v0.17.0). A source push is not deployment or installation; independently verify live source/health, old-version update links and unauthenticated APK hashes before reporting publication complete.

## Final source verification

Passed: 21 unit/server tests; 11 PostgreSQL migration/checksum/upgrade cases; 28 targeted passenger/proof/reservation/ticket/security integration cases; the focused QR proof/independent-decoder case again after its final assertion; 16 new Trips/ticket/Profile language-theme-device combinations plus the full two-passenger paid-ticket journey. The View ticket fragment preserves the loaded QR and direct fragments scroll after loading. The QR stays fully clear of sticky headers/bottom navigation. Refresh failures preserve saved links and show unavailable data instead of a false empty history; retry recovers.

Twelve existing compatibility browser scripts passed on the integrated D59+0017 source: marketplace, reservations, ticketing, luggage, Booking menu, Driver menu, headers, login, marketplace regression, release notices, manual ticket fallback and shipments. Individual coverage includes marketplace 32 layouts, reservations 48, ticketing 32, luggage 32, both menus 40 each, headers 64 and manual fallback 16. Source screenshots were inspected in light/dark and Arabic/English, including the sharp paid-ticket QR. Native release build/lint/signature checks passed for both packages; lint is zero errors/two existing warnings per flavor. No physical installation or production test reservation is claimed.

## Public delivery verified - 2026-11-10

Code commit 27de28e is on Safeer main and [release v0.17.0](https://github.com/Baballah2240/Safeer/releases/tag/v0.17.0) is public with both signed APKs and checksum sidecars. Both unauthenticated downloads returned HTTP 200 and matched the exact sizes/SHA-256 values above. Live marketplace.js, passenger-ui.js, passenger-glass.css, app-release.js and driver.js match the reviewed text after normalizing encoding/line endings. Live API health returned HTTP 200 with a connected database and healthy hold/retention maintenance.

Read-only live browser checks passed for English/Arabic empty My Trips, Profile, existing route-search fields with ten passenger options, the separate Driver screen and exact selected-tab/primary colors. Installed 0.16.3 user agents receive the matching 0.17.0 APK link for each app; a 0.17.0 identity receives no spurious update notice. No real booking key was accessed and no production reservation, ticket, payment or account was created/reset for verification. The paid QR/itinerary/cancellation flows were verified against disposable PostgreSQL with fictional data. Physical phone installation remains the user's action.
