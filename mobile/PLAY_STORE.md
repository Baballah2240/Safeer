# Publishing Safeer Driver and Safeer Booking on Google Play

D78 (2026-11-13): the apps are now the Flutter apps in [flutter/](flutter/README.md). The bundle script below (`mobile:release`, mobile/release.mjs) built the retired WebView apps and is no longer wired to npm. For the Flutter apps, build a bundle with `flutter build appbundle --release` in mobile/flutter/apps/safeer_passenger and apps/safeer_driver (same upload key and app IDs). The checklist, Play Console and data safety notes still apply; the Driver app also uses the camera for ticket scanning.

The apps are prepared for Play. Four things must happen before upload.

## Before you build

1. **Host Safeer on HTTPS.** Play reviewers use the app over the internet, so the USB loopback cannot be used. Store builds accept only a public `https://` address and system certificates. Hosting is not set up by this project.
2. **Set the privacy contact.** Put a monitored email in `SUPPORT_CONTACT` in [src/legal.js](../src/legal.js). The release script refuses to build while it is empty.
3. **Back up the upload key.** It was created once by `npm.cmd run mobile:upload-key` at `%USERPROFILE%\.android\safeer-upload.jks` with its passwords in `safeer-upload.properties`. Only your Windows user can read them. Copy both somewhere private. Never commit or share them.
4. **Have the legal text reviewed.** The privacy policy and deletion page are a draft based on what Safeer actually stores.

## Build

    npm.cmd run mobile:release -- --origin https://your.domain

This writes signed `safeer-driver-<code>.aab` and `safeer-booking-<code>.aab` with SHA-256 files to ignored `mobile/releases/play/`. Raise `versionCode` in `android/app/build.gradle` for every upload.

## Play Console

- Create two apps: `sd.safeer.driver` and `sd.safeer.booking`. Enroll in Play App Signing and upload the bundle.
- Privacy policy URL: `https://your.domain/privacy`. Account deletion URL: `https://your.domain/account-deletion`.
- Data safety form: collected are name, phone number (Booking), email and user IDs (Driver), purchase history recorded at stations, and app interactions for audit. Data is encrypted in transit. Nothing is shared with third parties for advertising. Deletion can be requested.
- Content rating questionnaire, target audience (not children), and app access: give reviewers a test driver account and a published trip.
- New personal developer accounts must run a closed test with testers before production. Start on the internal or closed testing track.

## What the store builds do

They target API 35 and need Android 8 or later. They use HTTPS only, with no cleartext traffic and no USB loopback. Navigation is restricted to your one origin. They need no permissions besides internet, have backup off and no advertising, and are signed with the upload key. Debug builds (`npm.cmd run mobile:build`) still use the USB tunnel to this computer.
