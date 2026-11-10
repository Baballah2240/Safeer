# Driver update discovery - 2026-11-10, D67

The owner reports the old Driver layout and a missing update button. Live source/download checks confirmed Driver 0.18.0 on the public site. Source inspection found a discovery gap: release metadata was a one-time ES module import, returning to the app did not reload its document, and the old Refresh action refreshed trip data only. The native origin/cache of the owner's phone could not be inspected without a connected device. An old USB-channel client is also recovered by the published HTTPS Driver APK.

## Correction

Driver keeps its download link visible for current, old and unidentified app versions. Its menu adds bilingual Check for updates. It fetches public GET /mobile/releases (no-store, no credentials) on page start, foreground return, reconnection, menu opening, explicit check and a visible-page interval. Requests are coalesced and bounded. Only banner/link/status/version nodes change; no forced document reload, form replacement, camera replacement or account/session reset occurs.

The client accepts only versioned Safeer Driver/Booking APK URLs on the exact Baballah2240/Safeer GitHub release path, canonical tags, safe version values and valid hash/size fields. It rejects downgraded or invalid metadata and keeps the last known release on failure. Booking does not start the new automatic checks and retains its existing update behavior/version.

No native code or APK changes: Driver remains 0.18.0/18000; Booking remains 0.17.0/17000. Existing public APK hashes are preserved. No production booking/account writes, forced installation or physical-device verification.

## Recovery boundary

Code already loaded in an old page cannot acquire this fix until a fresh document load. The one-time recovery is to open [Safeer Driver 0.18.0](https://github.com/Baballah2240/Safeer/releases/download/v0.18.0/Safeer-Driver-0.18.0.apk) in the phone browser and install over the existing compatible signed Driver app. Future discovery then uses the new checks. The owner was given this direct recovery path during the fix; do not claim a web push itself updated their already-open page or installed the APK.

## Verification

Unit/server/build/docs and dedicated browser checks verify the no-store endpoint, current-client permanent download, a new release appearing while the page remains open, foreground/reconnect/manual checks, request coalescing, invalid/offline response retention and unchanged login input identity. The Driver camera regression also checks that refreshing metadata retains the same active MediaStream. Existing Driver/Booking menu checks cover responsive bilingual layouts and draft/focus behavior. Online deployment evidence is added after publication.

Local gate passed: 26 unit/server checks, 53-asset API/static build, documentation links, dedicated update-discovery browser reproduction, per-app release notice cases, real QR camera flow with stream-identity preservation, and 40 Driver plus 40 Booking menu layouts. Driver APK SHA-256 remains 7ecafb83cb831dc14f3f541976e47a63976f9ff8bfb7fe8b689ec09a2620a02f. No native rebuild was necessary for this web-only correction.

Online verification after source commit 8c98234: /mobile/releases returns the canonical release metadata with no-store; the four modified Driver/update assets match source; live browser checks show the download control for Driver builds 17000 and 18000, manual checking preserves the sign-in node, Booking 17000 receives no update notice, and health returns 200. Evidence is in ignored .qa/driver-update-discovery-live.json. Physical-phone installation remains the owner recovery step, not a claimed deployment result.
