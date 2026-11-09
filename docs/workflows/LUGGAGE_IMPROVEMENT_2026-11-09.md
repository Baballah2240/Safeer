# Luggage operational improvement - 2026-11-09

D61 authorizes improving the existing workflow. D33 remains the policy baseline. This is passenger luggage linked to paid tickets; freight and parcel delivery are outside this scope.

## Delivery and responsibility

| Step | Responsible role | Completion evidence |
| --- | --- | --- |
| Set up access | Company administrator | Explicit operate/resolve permissions assigned to appropriate staff; no automatic grants |
| Receive and register | Luggage operator | Correct paid ticket/traveler, pieces, measured weight and distinguishing description checked |
| Tag | Luggage operator | Newly printed opaque QR attached to the matching bag; replaced tag removed |
| Load and track | Luggage operator | Authorized one-step transitions recorded against the correct bag and current version |
| Resolve incidents | Authorized resolver | Outcome reviewed, current password supplied; permanent-loss warning considered for missing bags |
| Collect or return | Luggage operator | Ticket or booking-mobile proof checked, open exceptions resolved; early return includes a reason |
| End-of-shift review | Company supervisor | Outstanding custody and incidents checked using specific records; the latest-50 screen is not a complete inventory report |

## Improvements applied

- Remove previous actions immediately when a search starts; announce loading to assistive technology.
- Retain latest-request ordering and restore usable results only for the current search.
- Offer explicit refresh after other staff changes or a connection error. Refresh repeats the last submitted search.
- Explain the 50-record display bound at the bound, for both ticket/group and company lists.
- Warn that settling/closing a missing-bag exception permanently marks it Lost, ends custody and can unblock a separate refund.
- Preserve Arabic/English, RTL/LTR, both themes, keyboard scanner input and responsive shared web/mobile source.

## Acceptance gates

1. Unit/server checks, API build, public asset build and document links pass.
2. Disposable PostgreSQL luggage and ticketing integration checks preserve tenant isolation, custody/refund guards, replay handling, collection proof, exceptions, old-tag rejection and erasure.
3. Built browser checks cover registration, QR printing/replacement, travel transitions, missing-bag resolution warning, denied/accepted collection and passenger status.
4. Delay an older search, complete a newer one, then release the older response: current results remain current and old actions are absent during loading.
5. Fail refresh and recover explicitly: no old actions remain, no false success appears. Exercise the bounded-page notice with a synthetic response.
6. Verify Arabic/English, dark/light and 1920/1366/390/320px layouts without script/security errors.

## Release and remaining backlog

Publish only to the independent Safeer repository. A push is not deployment or phone installation. No migration or live account/record update is required by this follow-up. Existing Android clients reuse the updated shared page when the matching server is updated. Physical scanner/printer and phone acceptance remain an operator check.

Fees/allowances, camera scanning, driver luggage authority, full inventory pagination/reporting and recovery of bags previously closed as Lost need their own scope and policy decisions. No compensation or payment rule is introduced here.

## D61 verification result

Passed on 2026-11-09: 17 unit/server checks; API/public build (37 assets); document links; 15 luggage/ticketing integration tests on disposable PostgreSQL 16; the built luggage browser flow including search ordering/loading, failed-refresh recovery, 50-row guidance, missing-bag warning, QR/replacement, collection and 32 bilingual/theme/layout combinations. Both Android debug flavors built and linted successfully. Existing native deprecation/compatibility warnings remain. No real account, booking, payment or runtime migration was changed. Physical phone/printer/scanner and online deployment are not claimed.
