# Safeer Android apps

D78 (2026-11-13): the published apps are the native Flutter apps in [flutter/](flutter/README.md). They call the Safeer API on https://safeer.mohbaba.online directly and do not open the website.

| App | Android package | Current version | Release file |
| --- | --- | --- | --- |
| Safeer Passenger | sd.safeer.booking | 0.19.0 (19000) | Safeer-Booking-0.19.0.apk |
| Safeer Driver | sd.safeer.driver | 0.19.0 (19000) | Safeer-Driver-0.19.0.apk |

Android 8 (API 26) or later on ARM phones. Both are signed with the private Safeer upload key and published as GitHub releases (`v<versionName>`, each APK with a `.sha256`). The website's download links (the home page's `/mobile/download/booking` and `/mobile/download/driver`, and the booking and driver pages) come from `src/app-release.js`. The apps have no in-app update notice yet, so a newer version reaches a phone only when it is downloaded again. Change history: [UPDATES.md](UPDATES.md).

The earlier WebView apps (Safeer Booking 0.17.4 and Safeer Driver 0.18.5, the `android/` project) are retired. The website shows them only "This app has been replaced" with the new app's download, which installs over them (same package and key, higher versionCode). Do not build or publish them again.

## Install on a phone

Open https://safeer.mohbaba.online/#apps (or the release page) in the phone's browser, download the APK and install it. It installs over the old app of the same kind, and later versions install over it. Or, with the phone connected by USB and USB debugging allowed, run `npm.cmd run mobile:install` after `mobile:save` (both apps). It checks the saved checksums, picks exactly one authorized phone and installs over the existing apps. A signature conflict stops it: do not uninstall the app to get past it without warning the owner, because uninstalling deletes what that phone saved (booking keys and saved tickets; reference/mobile lookup on the website still works).

## Build and release

Needs Flutter and the Android SDK ([flutter/README.md](flutter/README.md)), a JDK 17, and `%USERPROFILE%\.android\safeer-upload.properties` with its `.jks` (see [PLAY_STORE.md](PLAY_STORE.md)).

    npm.cmd run mobile:build          # both signed release APKs (live site, ARM phones)
    npm.cmd run mobile:save           # checks package, version and certificate; APKs, .sha256 and latest.json to mobile/releases/; regenerates src/app-release.js
    npm.cmd run mobile:build:driver   # Driver only (node mobile/flutter/tool/build-release.mjs --passenger-only for Passenger)
    npm.cmd run mobile:save:driver    # Driver only (node mobile/save.mjs --passenger-only for Passenger)

Each app's version is the `version: X.Y.Z+code` line in its pubspec.yaml, repeated as the label in its lib/src/app.dart that Settings shows (mobile:save refuses a mismatch); raise the code above the last published release of that app, and give the two apps different version names when only one of them changes (the release tag is `v<versionName>`). Commit the regenerated `src/app-release.js`, push, create the GitHub release with the saved files, then run `npm run check:live`. Google Play bundles: [PLAY_STORE.md](PLAY_STORE.md).

## The retired WebView apps (android/)

Kept for reference only. They opened the website full screen (/marketplace for Booking, /driver for Driver) and added `SafeerApp/<versionCode> (<flavor>)` to their user agent, which is how the website now recognises them. Their build scripts (mobile/build.mjs, usb.mjs, release.mjs) are no longer wired to npm.

### How the shell behaved

- Full screen with swipe-reveal system bars. The page fills the camera cutout and receives its height as the CSS variable `--safe-top`; the keyboard and cutout stay clear of controls.
- Android Back closes an open drawer first, then goes back in the page history, then exits.
- If the site cannot be reached, a Retry screen appears (in Arabic or English); the app retries by itself when the internet returns and stays on the same page.
- The user agent ends with `SafeerApp/<versionCode> (<flavor>)` so the website can show the right update notice.

### Security

The shell is not an authority boundary: the server checks every permission. The WebView loads only its fixed origin (HTTPS site for release, USB loopback for debug). The only links that may leave the app are Safeer GitHub release downloads (opened in the phone browser so Android's installer verifies them) and phone/email links the user taps. File/content access, mixed content, third-party cookies, pop-up windows and native JavaScript bridges are disabled. Camera access is offered only to the Driver app on `/driver`, video only, for ticket scanning; frames stay on the phone. App data is excluded from backup and device transfer. No credentials are embedded. Never commit APKs, `mobile/releases/`, the upload key or its properties.
