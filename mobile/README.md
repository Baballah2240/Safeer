# Safeer Android apps

Two small Android apps open the real Safeer website (https://safeer.mohbaba.online) full screen. All screens come from the shared web code in `src/`, so website updates reach the apps without a reinstall. A new APK is only needed when the native shell, icon or colours change.

| App | Android package | Opens | Current version |
| --- | --- | --- | --- |
| Safeer Booking | sd.safeer.booking | /marketplace | 0.17.3 (17003) |
| Safeer Driver | sd.safeer.driver | /driver | 0.18.4 (18004) |

Android 8 (API 26) or later. Both apps are signed with the private Safeer upload key and published as GitHub releases (`v<versionName>`, files `Safeer-Booking-<v>.apk` / `Safeer-Driver-<v>.apk` with `.sha256`). The apps show an update notice when `src/app-release.js` names a newer version. Change history: [UPDATES.md](UPDATES.md). Native Flutter previews of both apps (D74, not published) are in [flutter/](flutter/README.md). Current handover: [docs/archive/MOBILE_HANDOVER_2026-11-12.md](../docs/archive/MOBILE_HANDOVER_2026-11-12.md).

## Install on a phone

Open the release page in the phone's browser, download the APK and install it; later versions install over it and keep the app's data. Or, with the phone connected by USB and USB debugging allowed, run `npm.cmd run mobile:install` after `mobile:save` (both apps). It checks the saved checksums, picks exactly one authorized phone and installs over the existing apps. A signature conflict stops it: do not uninstall Booking to get past it without warning the owner, because uninstalling deletes the booking keys saved on that phone (reference/mobile lookup still works).

## Build and release

Needs Android SDK platform 35 and build tools, a JDK 17 or 21 (`mobile/build.mjs` uses JAVA_HOME or the JDK cached in `%USERPROFILE%\.gradle\jdks`), the Gradle 8.14.3 wrapper and the AGP 8.7.2 dependencies already cached, because the build runs offline. Release builds also need `%USERPROFILE%\.android\safeer-upload.properties` and its `.jks`.

    npm.cmd run mobile:build          # both signed apps + lint
    npm.cmd run mobile:save           # APKs, .sha256, latest.json to mobile/releases/; regenerates src/app-release.js
    npm.cmd run mobile:build:driver   # Driver only
    npm.cmd run mobile:save:driver
    npm.cmd run mobile:build:usb      # debug apps that reach http://127.0.0.1:4320 through adb reverse
    npm.cmd run mobile:save:usb
    npm.cmd run mobile:usb            # restore the adb reverse tunnel for the debug apps

Booking's version is in `defaultConfig` of `android/app/build.gradle`, Driver's in the `driver` flavor; bump only the app that changes. Commit the regenerated `src/app-release.js`, push, then create the GitHub release with the saved files and run `npm run check:live`. Google Play bundles: see [PLAY_STORE.md](PLAY_STORE.md).

Lint has 0 errors and 2 known warnings per app (pinned target 35; the API 33 back attribute is ignored on older phones). Gradle reports deprecations from the pinned toolchain.

## How the shell behaves

- Full screen with swipe-reveal system bars. The page fills the camera cutout and receives its height as the CSS variable `--safe-top`; the keyboard and cutout stay clear of controls.
- Android Back closes an open drawer first, then goes back in the page history, then exits.
- If the site cannot be reached, a Retry screen appears (in Arabic or English); the app retries by itself when the internet returns and stays on the same page.
- The user agent ends with `SafeerApp/<versionCode> (<flavor>)` so the website can show the right update notice.

## Security

The shell is not an authority boundary: the server checks every permission. The WebView loads only its fixed origin (HTTPS site for release, USB loopback for debug). The only links that may leave the app are Safeer GitHub release downloads (opened in the phone browser so Android's installer verifies them) and phone/email links the user taps. File/content access, mixed content, third-party cookies, pop-up windows and native JavaScript bridges are disabled. Camera access is offered only to the Driver app on `/driver`, video only, for ticket scanning; frames stay on the phone. App data is excluded from backup and device transfer. No credentials are embedded. Never commit APKs, `mobile/releases/`, the upload key or its properties.
