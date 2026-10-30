# Safeer mobile status

## 0.2.0 - 2026-10-30, Section 01

- Release 1 now covers passenger transport and linked passenger luggage; freight is archived/deferred.
- Passenger prototype layout, Arabic/English copy and shared visual tokens are retained. Guest full-name/mobile and multi-seat booking are documented future requirements, not implemented mobile features.
- The target passenger/driver apps are Flutter clients of versioned APIs. Shared contracts/design assets stay in the repository; Flutter will use Dart models, not execute the existing JavaScript UI.
- No Flutter project, native build, accounts or production reservation API was created in Section 01.

## 0.1.0 - local foundation

- Passenger seat reservation, demo freight requests and company-specific reservation deadlines are explored in a responsive browser prototype.
- Web and future mobile-facing code live together in `src/`.
- No Android/iOS project, native app, installable APK, app-store release, OTP service or real staff/passenger authentication exists yet.
- All data is fictional, kept in the browser's memory and reset on refresh. Do not use real customer information.
