# Safeer Flutter apps (D74)

Two native Flutter apps, **Safeer Passenger** and **Safeer Driver**, built from the "Safeer Glass" brief with the current Safeer fonts (Inter, Noto Sans Arabic) and colours (navy #0B2D5B, sky blue #1E90FF, orange #FF8C00 and the website's light/dark tokens). They use the existing Safeer API; nothing on the server changed. The published WebView apps in `mobile/android` stay the live apps until the owner decides otherwise (see "Status" below).

```
mobile/flutter/
  pubspec.yaml               pub workspace (one lock file for all three packages)
  packages/safeer_core/      theme, bundled fonts, English/Arabic strings, models, API client,
                             demo data, on-phone storage, shared widgets (glass panel, seat map,
                             QR view, status badges, buttons)
  apps/safeer_passenger/     Explore, Departures, seats, review, My Trips, ticket
  apps/safeer_driver/        sign-in, Today's Trips, scanner, scan results, passenger list
```

## Set up once

Flutter 3.47.9 (stable, Dart 3.13) is installed at `C:\Users\Lenovo\dev\flutter`. Add `C:\Users\Lenovo\dev\flutter\bin` to PATH, then:

    cd mobile/flutter
    flutter pub get

Android builds use the existing Android SDK (platform 36, build tools 36) and the JDK 17 under `%USERPROFILE%\.gradle\jdks` (set with `flutter config --jdk-dir`). The first build downloads Gradle 9.3.1, AGP 9.1, Kotlin 2.4 and NDK 28.2 (about 10 minutes); later builds take about 2 minutes.

## Run each app

Debug builds use labelled demo data, so both apps can be tried with no account, no trips and no internet. A "Demo data" banner or badge is on every demo screen.

    cd mobile/flutter/apps/safeer_passenger
    flutter run                                  # demo data
    flutter run --dart-define=SAFEER_DATA=live   # the live site, https://safeer.mohbaba.online

    cd mobile/flutter/apps/safeer_driver
    flutter run                                  # demo: tap "Continue as demo driver"
    flutter run --dart-define=SAFEER_DATA=live   # sign in with a real driver account

A local server can be used instead of the live site: run Safeer on the computer, `adb reverse tcp:4320 tcp:4320`, then add `--dart-define=SAFEER_ORIGIN=http://127.0.0.1:4320`. Debug builds allow plain HTTP to 127.0.0.1 only; release builds accept only HTTPS.

Do not book or board on the live site to test: that creates real holds and boarding records. Use demo data or a local server with a disposable database.

### Trying the demo

Passenger:
- Explore starts with Khartoum. Choosing Khartoum as the destination too shows the "different cities" error.
- Trips start or end in Khartoum. Any other pair, such as Kassala to Dongola, shows the empty state.
- The 13:15 departure is full.
- On the 08:30 departure, seats 3A and 3B are taken by "someone else" the first time you reserve them. This shows the seat-change notice.
- My Trips already holds a paid demo ticket (SF-DEM2TKT7, seat 7C, TKT-00001107) with a QR code. Settings > "Simulate no connection" shows it reopening from the saved copy.

Driver:
- The active trip is Khartoum to Port Sudan (coach SD-KH 4521), departing 45 minutes after the app starts. It has 23 valid tickets, 7 of them boarded.
- On the scanner, the flask button offers demo scans: valid TKT-00001109, the passenger demo ticket TKT-00001107, already scanned TKT-00001101, another trip's ticket TKT-00002001 and a refunded ticket TKT-00001124.
- Scanning the passenger app's demo QR with the driver phone also works.
- Settings > "Simulate no connection" makes scans "Pending verification". Turning it off checks them again.

## How it follows the server rules

- **Bookings** are reservations held for the company's deadline and paid at the station (`POST /public/holds`). Each review screen uses one booking key, so a retry after a lost answer returns the same booking. Seats someone else took (409 SEATS_UNAVAILABLE) send the passenger back to the seat map with a notice.
- **Tickets**: a QR appears only when the server returns one, for a paid ticket opened with this phone's booking key. The app paints the server's squares and never encodes a ticket. The booking key and the last server copy are kept in app-private storage (no cloud backup), so a paid ticket reopens without internet. It is labelled "Saved copy from …" until it refreshes.
- **Boarding**: a camera scan calls `/board`; a typed ticket number calls `/verify` and boards only after the driver confirms. Wrong-trip, invalid, refunded and closed-boarding answers never change the count. The count is computed from the server's passenger list (tickets with a boarding record), so repeated scans cannot raise it. While a scan is processing, further camera reads are ignored, and the same code is ignored for 3 seconds after.
- **Offline driver**: the server has no offline validation. A scan that cannot reach it is shown as "Pending verification", saved on the phone (opaque code only, no names) and not counted. It is sent again every 15 seconds, on resume, on refresh or with "Check now", and the server's answer replaces it.
- **Driver sign-in** uses the existing `/auth/login`. The app sends the site's Origin and the CSRF value from the sign-in reply. The session stays in memory, so the driver signs in again after closing the app; pending scans survive.

## Build

    cd mobile/flutter/apps/safeer_passenger   # or apps/safeer_driver
    flutter build apk --debug      # app ID sd.safeer.booking.dev / sd.safeer.driver.dev, installs beside the current apps
    flutter build apk --release    # app ID sd.safeer.booking / sd.safeer.driver, signed with the Safeer upload key

The APKs land in each app's `build/app/outputs/flutter-apk/`. Copies with a `SHA256SUMS` file are kept in the ignored `mobile/releases/flutter/`. Install a debug APK with `adb install -r <apk>` or by opening it on the phone.

Release builds refuse to start without `%USERPROFILE%\.android\safeer-upload.properties`. They are preview builds (version 0.1.0, versionCode 1), lower than the published WebView apps, so Android will not install them over those apps. Replacing the WebView apps needs a higher versionCode and the owner's decision. Nothing here is published, and `mobile:save` / `src/app-release.js` are for the WebView apps only.

## Check

    cd mobile/flutter/packages/safeer_core && flutter analyze && flutter test
    cd mobile/flutter/apps/safeer_passenger && flutter analyze && flutter test
    cd mobile/flutter/apps/safeer_driver && flutter analyze && flutter test

The app tests run the full Passenger and Driver flows on 360x640 and 320x568 phones, and at 1.6x text size, in English and Arabic. They check right-to-left layout and that no layout overflows. They also cover:
- the different-cities rule, the booking retry key and seat conflicts;
- a saved ticket reopening offline after a restart;
- duplicate scans leaving the count unchanged;
- suppression of repeat camera reads;
- wrong-trip and refunded tickets not boarding;
- pending scans being counted once after reconnecting;
- the API client's Origin, cookie and CSRF handling.

Against a real server, with fictional data in a throwaway database (the same `SAFEER_TEST_DATABASE_URL` as the other integration tests):

    npm run test:flutter:live      # from the repository root; needs flutter on PATH

This starts the website proxy and API on 127.0.0.1 and creates a company, two trips, paid tickets and a driver. It then runs `tool/live_api_test.dart` (both API clients) and `tool/live_boarding_test.dart` (the Driver boarding controller), and drops the database. Never run these against the hosted site.

Screenshots for review, using the real fonts:

    flutter test tool/screens_test.dart --update-goldens   # writes build/screens/*.png in each app

## Still needs a backend or a physical phone

- **Live data**: departures, seat maps, reservations, ticket QR codes, driver sign-in, trip lists, manifests and boarding all need the Safeer API. `npm run test:flutter:live` checks both clients against a real local server through the website proxy, covering Origin, CSRF and cookies, reply shapes, the booking retry key, seat conflicts, QR geometry, wrong-trip refusal and boarding once. They have not been run against the hosted site, which would create real records.
- **Camera**: scanning, the torch, the permission prompt and the denied-permission fallback need a real Android phone. Tests replace the camera.
- **No physical-phone test was done.** This PC has no Android emulator image, so installation, back gestures, the system date picker, outdoor contrast and the TalkBack labels have not been checked on a device.
- **Not in the Flutter apps yet**: shipments, company pages, booking lookup by reference and mobile, passenger accounts and Google sign-in, driver notifications, incidents, departure/arrival, and the in-app update notice. These still need the WebView apps.
