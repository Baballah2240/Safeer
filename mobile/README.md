# Safeer Android USB test apps

Two independent installed apps reuse the real responsive web application in src/:

| App | Android package | Home |
| --- | --- | --- |
| Safeer Driver | sd.safeer.driver | /driver |
| Safeer Booking | sd.safeer.booking | /marketplace |

Version: 0.16.0-usb.4 (16004), debug-signed local test channel, Android 8/API 26 or later. Tested on the connected LGN-NX1 Android 16/API 36 phone. No Flutter client, camera scan, offline queue, online payment, remote server or store release is included. All booking, payment, session, company and assigned-driver rules remain enforced by the existing backend. The phone has separate app cookies/storage; it does not automatically inherit a computer sign-in.

The current owner-selected palette is black and brown, with cream/brown light mode. The native shell and icon match the shared bento/glass web UI.

## Use the installed apps

1. Keep Safeer running on this Windows computer at http://127.0.0.1:4320 (npm.cmd run local if not already running).
2. Connect the Android phone by USB, enable USB debugging and accept the computer authorization prompt.
3. From projects/Safeer run npm.cmd run mobile:usb after reconnecting/restarting the phone. This forwards the phone's port 4320 to the same loopback service on the computer. No firewall opening or Wi-Fi server is required.
4. Open Safeer Booking to find trips/reserve seats or retrieve a reservation. The company must be approved/listed and have a future published assigned trip before it appears. An empty marketplace is expected until the manager completes this configuration.
5. Open Safeer Driver and sign in with a manager-created account linked to an active company driver record, granted driver access and assigned to a trip. No shared/default driver password is supplied or created by installation. Current assignment/membership controls still apply.

Booking has no native title/Home/Refresh/Print toolbar; use its menu for trip search, My booking, staff access and Settings (appearance/language). Driver keeps Home, Refresh and Android print/save-PDF controls. Driver native print handoff exists; physical printer acceptance remains untested. Back navigates within the app. The interface retains Arabic/English and light/dark controls. If disconnected, restore the server/cable/tunnel and press Retry. Closing or uninstalling an app does not delete server records, but uninstalling Booking removes its locally saved opaque booking keys; reference/mobile recovery remains available.

The computer, Safeer process and USB tunnel must stay connected for live operations. Installing an APK does not make Safeer available over mobile data or another network. Hosting/HTTPS and a remote-client security design need separate implementation.

## Build, save and install

Install Android SDK platform/build tools 35, platform-tools/adb, Gradle 8.14.3 and compatible JDK 17 or 21. Windows build.mjs uses JAVA_HOME or a compatible cached Gradle JDK; it rejects the installed JDK 25 for this Gradle version. Pinned AGP 8.7.2/Gradle dependencies must already be cached because the build runs offline. On a new build computer, provision those trusted tools/dependencies before running it.

    npm.cmd run mobile:build
    npm.cmd run mobile:save
    npm.cmd run mobile:install

Build runs both debug variants and Android lint. Save writes both APKs, individual SHA-256 sidecars and latest.json into ignored mobile/releases/. Install validates saved checksums, selects exactly one authorized physical USB phone, restores the local tunnel, installs both APKs with replacement preserving existing app data, and checks installed versions. It refuses checksum mismatch, ambiguous devices, an unavailable server or unexpected packages. A signature conflict stops installation; do not uninstall an existing app just to bypass it without preserving its local booking keys.

Keep the debug signing key in the private Android user directory to preserve update compatibility. It is never source-controlled. Production signing, current store target/API requirements, Play distribution and secure remote delivery are separate work. Android lint has zero errors; known warnings are the pinned target 35 and the API 33 back-navigation attribute ignored on older devices. Gradle/API deprecation notices remain with the pinned toolchain.

WebView allows only http://127.0.0.1:4320 navigation/resources; other cleartext hosts, file/content access, mixed content, third-party cookies and native JS bridges are disabled. Cloud/device transfer excludes app data on Android 12+, with backup disabled on earlier versions too. JavaScript/DOM storage are required by the shared app, and existing server CSP/CSRF/Host controls remain intact. No credentials are embedded. See the official [Android WebView guide](https://developer.android.com/develop/ui/views/layout/webapps/webview) and [ADB guide](https://developer.android.com/tools/adb).
