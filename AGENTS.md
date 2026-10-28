# Safeer

- Independent logistics and passenger-transport project. Do not edit Stocrant or the school-display application for Safeer work.
- Current stage: local, fictional-data prototype and scope discussion. Do not imply production authentication, payment, ticket issuance or durable storage exists.
- Keep the service on 127.0.0.1. No deployment, external accounts, SMS delivery or online payment integration is authorized yet.
- Passenger reservations and freight are both in scope. Model their workflows separately.
- Support multiple companies from the start. Production access must be enforced on the server using authenticated company membership, never a browser company selector.
- Companies choose unpaid-reservation deadlines. Calculate expiry from timestamps and release seats when a hold expires.
- Online purchases and payment collection are outside the passenger app's scope. Issue a reservation reference first; only authorized staff may confirm offline payment, after which the final travel ticket and payment receipt can be issued. Staff roles and payment controls still need agreement before implementation.
- Keep responsive web/mobile-facing code together in src/. Record mobile-facing changes in mobile/UPDATES.md; no native mobile build is requested yet.
- Use invented demonstration data only. Do not store passenger IDs, real customer data, tokens or credentials in fixtures or source control.
- Validate relevant domain behavior with npm test. Browser-check affected interface behavior. Keep the initial foundation small and document decisions before expanding it.
