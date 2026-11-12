# Mobile app handover from Codex to Claude - 2026-11-12

Claude handed the Android apps to Codex on 2026-11-09 ([that handover](MOBILE_HANDOVER_2026-11-09.md), [Codex's continuation](MOBILE_CONTINUATION_2026-11-09.md)). The owner now hands them back to Claude. This page records the state at handover, checked on this computer at commit 2c99ecd, and the rules to keep.

## Where to work

- Repository: `C:\Users\Lenovo\source\Safeer`, GitHub `Baballah2240/Safeer` (public), branch `main`. The folder `stocrant/projects/Safeer` is an old copy with stale uncommitted edits: do not work, commit or build there.
- The owner and other tools also push to `main`. Run `git fetch` right before every push and rebase onto `origin/main`; never force-push.
- Pushing `main` redeploys https://safeer.mohbaba.online (Render) within a few minutes. Web changes reach installed apps when they reload; native changes need a new APK that the phone owner installs.

## State at handover

| Item | Booking | Driver |
| --- | --- | --- |
| Package | `sd.safeer.booking`, opens `/marketplace` | `sd.safeer.driver`, opens `/driver` |
| Version | 0.17.3 / 17003 (`defaultConfig`) | 0.18.4 / 18004 (`driver` flavor) |
| Published APK | release v0.17.3, `Safeer-Booking-0.17.3.apk` | release v0.18.4, `Safeer-Driver-0.18.4.apk` |
| SHA-256 | 6c8a03af0f27889b26476e0c5f1533242ba698d3749692168cac93c73b46ce9e | 3b69983b2d008e14050aba56beec9b8ff4b42de93cb730c90621061ea2f9839c |

- Signing: upload key `%USERPROFILE%\.android\safeer-upload.{jks,properties}`, certificate `CN=Safeer Upload, O=Safeer, C=SD`, SHA-256 a19fb6c1832196283aa3cf342ac4c2aa78b56d736702f8bccca1d8fcf8df7205. Every release so far uses this key. Losing it means every phone must uninstall to update.
- Toolchain: cached Eclipse Adoptium JDK 17 in `%USERPROFILE%\.gradle\jdks` (found by `mobile/build.mjs`; nothing on PATH), Gradle 8.14.3 wrapper, AGP 8.7.2, Android SDK platform 35, adb from WinGet platform-tools. The build runs `--offline`, so the dependency cache must stay. The gh CLI is not installed.
- Release tags on GitHub: v0.16.3, v0.17.0 to v0.17.3, v0.18.0 to v0.18.4.

## Checked at handover

- `npm run check:live`: 19/19 passed. Live site serves 2c99ecd (D73), database connected, maintenance jobs ok, update notice data matches `src/app-release.js`, both current APK downloads return 200.
- `npm run mobile:build`: signed release build and lint succeeded (incremental, no source change). Both APKs are byte-identical to the published ones (hashes above), same certificate, versions as in the table. Lint: 0 errors, 2 warnings per app (pinned target 35; API 33 back attribute). Gradle reports deprecations that block a future move to Gradle 9.
- `tests/mobile-shell.test.mjs`, `tests/app-update-data.test.mjs`, `tests/release.test.mjs`: 3/3 passed.
- `mobile:save` was not run, so `mobile/releases/` and `src/app-release.js` are unchanged.
- No phone was connected or installed. The owner declines physical-phone testing, so recent releases were checked by build, lint, compiled-code and browser tests only.

## What happened while Codex had the apps

| Date | Work | Native release |
| --- | --- | --- |
| 11-09 | D61 luggage safety; D62 rebuilt and verified Claude's 0.16.2; D63 separate Driver/Booking menus, repository made public | 0.16.3 (both) |
| 11-10 | D64 glass My Trips with protected paid-ticket QR | 0.17.0 (both) |
| 11-10 | D66 Driver trip dashboard and QR camera boarding; D67 Driver update discovery; Driver light/dark fix | Driver 0.18.0, 0.18.1 |
| 11-11 | Native progress strip removed | Booking 0.17.1, Driver 0.18.2 |
| 11-11 to 11-12 | Web only: minimal headers, branded loading, booking form, tracking page theme, body wordmark with separate fixed menu button, minimal Driver sidebar, Staff access app shell, Inter/Noto Sans Arabic fonts, shimmer loading | none |

Claude's releases in the same period: D71 brand palette and logo (Booking 0.17.2, Driver 0.18.3) and D72 tel:/mailto: links (Booking 0.17.3, Driver 0.18.4). Codex's scratch scripts and test output are in the ignored `.qa/` folder and are not part of any build.

## Rules to keep

- Booking and Driver have independent versions: Booking in `defaultConfig`, Driver in the `driver` flavor. Bump only the app whose native code or resources change. Web-only changes need no APK.
- The Android shell is not a security boundary; the server enforces all access. Release builds load only `https://safeer.mohbaba.online` (debug/USB builds only `http://127.0.0.1:4320`); the shell may leave the app only for `https://github.com/Baballah2240/Safeer/releases/...` downloads and user-tapped `tel:`/`mailto:` links. No JavaScript bridge; camera is granted only to the Driver app on `/driver`, video only.
- Never commit APKs, `mobile/releases/`, the upload key or its properties.
- Do not say a push deployed the site or updated a phone: check the site with `check:live`, and phones only update when their owner installs the APK.

## Releasing a new app version

1. Bump `versionCode`/`versionName` for the changed app in `mobile/android/app/build.gradle`.
2. Both apps: `npm.cmd run mobile:build` then `npm.cmd run mobile:save`. Driver only: `mobile:build:driver` then `mobile:save:driver`.
3. Commit the regenerated `src/app-release.js` with the source and a `mobile/UPDATES.md` entry, then fetch, rebase and push.
4. Right after the push the owner creates the GitHub release on the website: tag `v<versionName>`, title "Safeer Booking X.Y.Z" or "Safeer Driver X.Y.Z", attach the `.apk` and `.apk.sha256` from `mobile/releases/`. Until it exists the in-app update link returns 404.
5. Run `npm run check:live` to confirm the deployed commit and the APK links.

## Tests after mobile or shared UI changes

`npm.cmd run check` (unit tests, build, docs links). Browser and integration tests need `SAFEER_TEST_DATABASE_URL` pointing at a disposable PostgreSQL 16 (CI uses a `postgres:16` service and runs `npm run verify:release`). Mobile-related: `test:booking-menu:browser`, `test:driver-menu:browser`, `test:sidebar:browser`, `test:headers:browser`, `test:login:browser`, plus `tests/mobile-release.browser.mjs`, `tests/app-update-refresh.browser.mjs`, `tests/driver-dashboard.browser.mjs`, `tests/driver-theme.browser.mjs`, `tests/shimmer.browser.mjs` and `tests/passenger-app-account.browser.mjs`.

## Open items

- D68 step 3: My Trips across devices for signed-in passengers.
- D68 step 4: Google sign-in inside the Booking app needs a browser hand-off; the app currently explains that it works on the website. Google sign-in is not yet configured on Render.
- No agent has tested on a physical phone since 0.16.2. The phone links (D72), camera boarding (D66) and the new launcher icon (D71) are unverified on a real device.
- Google Play: not started ([steps](../../mobile/PLAY_STORE.md)). Check Play's current target API level before any upload; the apps target API 35.
- Gradle deprecations and the legacy system UI flags will need work before a Gradle 9 or newer SDK upgrade.
