# Safeer / سفير

Local foundation for a Sudan land-transport platform serving passenger bus operators and freight companies. This project is independent of Stocrant and Qatar School Time Table.

## Current stage

Version 0.1.0 is a working, fictional-data prototype for discussing the basics. It is not a live booking system. It has no real accounts, database, online payments, SMS integration or mobile binary. Its browser-memory data resets on refresh; different tabs/computers do not share seat inventory. Do not enter real passenger or customer information.

Confirmed scope:

- Passenger reservations **and** freight in the first release.
- Multiple independent companies, each ultimately limited to its own users, trips and customers.
- Each company sets an unpaid-reservation deadline; expired holds release their seats.
- Passengers reserve through the app; purchasing and payment collection happen outside it.
- A reservation reference comes first. Staff must confirm offline payment before the final travel ticket and payment receipt are issued.

## Open locally

Requires Node.js 24 or newer. No third-party packages are needed for this foundation.

```powershell
cd C:\Users\Lenovo\resturrant\stocrant\projects\Safeer
npm.cmd start
```

Open **http://127.0.0.1:4320**. The service binds only to the local computer. This differs from the school app's port. Stop with Ctrl+C. `SAFEER_PORT` can select another local port if needed.

## Try the basics

1. Open the overview and choose one of the two fictional companies using **Demo company**. This is a prototype switch, not a real user's company-selection permission.
2. Open **Passenger reservations**, choose a sample trip, then select an available seat. Review the sample fare and payment deadline, and use an invented passenger name.
3. Reserve the seat. A clearly unpaid **reservation reference** appears, with an optional print view. It is not proof of payment or a final travel ticket.
4. Close the reference and inspect the company's reservations. Cancel an active reservation to release its seat. Unpaid reservations also expire automatically at their timestamp.
5. Open **Freight requests** and submit a fictional customer, route, cargo category, package count and weight. Requests await the later quote/confirmation workflow; they do not assign a truck or confirm delivery.
6. Open **Company policy** to adjust the hold window for new reservations. Existing reservations keep their original deadline. A hold never extends past departure. The prototype uses a 5–1440 minute policy range; actual policy limits remain a business decision.
7. Switch company to inspect its separate sample records. Use **العربية / English** to change the interface language. Refresh the page to reset the entire demonstration.

All operators, customers, prices, routes and availability shown are fictional examples, not verified services, market fares or actual transport availability. Trip times are displayed in `Africa/Khartoum`.

## Important boundary: company separation

The prototype filters records by `companyId` and validates that a reservation belongs to the selected company's trip. It includes cross-company domain tests. However, all fixture data exists in the browser, there is no authentication, and the demo selector can switch companies. **This is not production access control.** Before real data is introduced, every backend query and mutation must be scoped by authenticated company membership, with server-side authorization and transaction-safe seat holds.

## What we should discuss next

See [BASICS.md](docs/BASICS.md) for the accepted decisions, workflows, proposed entities and unresolved questions. Final tickets follow staff-confirmed offline payment. We should now settle staff roles, payment confirmation controls, passenger sign-in, freight pricing and delivery proof before expanding the foundation.

## Development

```powershell
npm.cmd test
```

- `src/`: shared responsive web/mobile-facing prototype UI, demonstration data and domain rules.
- `server.mjs`: small Node.js static server, loopback-only, with an explicit asset allowlist and no write API.
- `tests/`: reservation expiry, collision rules, ownership, cargo validation and local-server boundaries.
- `mobile/UPDATES.md`: mobile-facing status. No Android/iOS shell or build exists yet.
- `docs/`: product decisions and staged implementation plan.

No cloud deployment, production database, payment integration or push notification service is configured. The starter uses plain JavaScript, HTML/CSS and Node.js without a bundler. Production web/mobile frameworks and database choices remain open for discussion.

## العربية

**سفير** مشروع مستقل لإدارة نقل الركاب والشحن البري في السودان. هذه نسخة محلية أولية للتجربة ومناقشة سير العمل، وليست نظام حجوزات فعلياً.

المتفق عليه: الركاب والشحن معاً، وشركات مستقلة ببيانات منفصلة، وموعد دفع تحدده الشركة وتنتهي بعده الحجوزات غير المدفوعة. لا يتم تحصيل الدفع داخل تطبيق الراكب.

شغل `npm.cmd start` ثم افتح `http://127.0.0.1:4320`. يمكنك تجربة اختيار المقعد ومرجع الحجز وطلب الشحن وسياسة انتهاء الحجز وتبديل العربية والإنجليزية. جميع البيانات وهمية وتمسح عند تحديث الصفحة. تسجيل الدخول وقاعدة البيانات والصلاحيات الفعلية والتذاكر النهائية وإيصالات الدفع وتطبيق الهاتف لم تُنفذ بعد.
