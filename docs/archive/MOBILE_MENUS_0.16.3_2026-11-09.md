# Separate mobile menus - 0.16.3 - 2026-11-09

D63 records the owner's explicit approval to improve both distinct app menus, push Safeer source, make the repository public and publish both update APKs. Work is isolated from uncommitted shipment edits; Stocrant is not a source target.

## Delivered

Driver emphasizes assigned trips, passengers and boarding, with account actions in a separate group. Booking emphasizes finding trips and managing reservations, with a separate employee entry. Each menu has its own identity, bilingual descriptions, active-state icon tiles, compact appearance/language settings, privacy/support access and current release badge. Phone controls are at least 44px; backgrounds cannot scroll while a modal menu is open. Closing restores focus, drafts survive menu/theme/language operations, and landscape is supported. Replacement headers are measured immediately, and old observer entries cannot overwrite the current measurement.

## Packages and update

| App | Package | Start page | Version |
| --- | --- | --- | --- |
| Driver | sd.safeer.driver | /driver | 0.16.3 / 16300 |
| Booking | sd.safeer.booking | /marketplace | 0.16.3 / 16300 |

Both use the existing Safeer upload certificate and HTTPS website. The generated src/app-release.js drives update notices and contains exact download hashes. An installed 0.16.2 app is tested as outdated and receives its correct APK link; current/newer versions do not show a spurious update. The phone owner installs the downloaded update; no automatic install or device acceptance is claimed.

## Verification

Passed: 18 unit/server checks; API and 38-asset website build; documentation links; sidebar 32 layouts; Booking menu 40 layouts; Driver menu 40 signed-in/out layouts; headers 64 combinations; Staff/Driver login regressions; marketplace ordering/draft regressions; Android-browser/old/current/newer app release notices. Arabic/English, both themes, 320/390px phones and 568x320 landscape are covered. Menu screenshots were inspected. Tests use disposable PostgreSQL 16 and fictional identities.

Both release APKs built and passed signature verification with the existing certificate. Android package/version inspection confirms distinct IDs, 16300 and minimum API 26. Lint has zero errors and two pre-existing compatibility warnings per flavor. An initial menu test observed the asynchronous startup replacement; it now waits for startup while the dedicated login suite retains startup-race checks. A real replacement-header timing issue was fixed and the original header assertion passed on rerun.

## Artifacts

| File | Bytes | SHA-256 |
| --- | --- | --- |
| Safeer-Driver-0.16.3.apk | 16716 | 8e9747e8409cf4da4993cfb8c1e767adaee1b1f029da862d0dfd1acd3133ccbc |
| Safeer-Booking-0.16.3.apk | 16728 | e660b16a63f5cc580579b0a222635e231f00846262ca857cd696ecb802669e51 |

APKs/checksum manifests remain ignored. Publish these exact APKs and sidecars under the public GitHub release [v0.16.3](https://github.com/Baballah2240/Safeer/releases/tag/v0.16.3). Before publication, scan available tracked history for known private-key/provider-token patterns and check artifact digests. Independently verify unauthenticated APK downloads and live old-version notices after release; a Git push alone proves neither. No real account, booking, payment or runtime database is changed.
