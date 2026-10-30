# Safeer

- Independent Sudan passenger-transport project. Do not edit Stocrant or the school-display application for Safeer work.
- Current stage: local, fictional-data prototype and scope discussion. Do not imply production authentication, payment, ticket issuance or durable storage exists.
- Keep the service on 127.0.0.1. No deployment, external accounts, SMS delivery or online payment integration is authorized yet.
- Follow docs/decisions/MASTER_INSTRUCTIONS_2026-10-30.md. Release 1 is passenger transport and passenger luggage only; freight/parcels are deferred. Record changes in docs/DECISIONS.md before implementing them.
- Support multiple companies from the start. Production access must be enforced on the server using authenticated company membership, never a browser company selector.
- Companies choose unpaid-reservation deadlines. Calculate expiry from timestamps and release seats when a hold expires.
- Online purchases and payment collection are outside the passenger app's scope. Issue a reservation reference first; only authorized staff may confirm offline payment, after which the final travel ticket and payment receipt can be issued. Staff roles and payment controls still need agreement before implementation.
- Keep responsive web/mobile-facing code together in src/. Record mobile-facing changes in mobile/UPDATES.md; no native mobile build is requested yet.
- Use invented demonstration data only. Do not store passenger IDs, real customer data, tokens or credentials in fixtures or source control.
- Work one numbered section at a time. Current authorization is SECTION 01 only. Do not start SECTION 02 without explicit owner approval, even after Section 01 passes.
- Update docs/PROJECT_MASTER.md, DEVELOPMENT_ROADMAP.md, DATABASE_SCHEMA.md, BUSINESS_RULES.md, SYSTEM_ARCHITECTURE.md, CHANGELOG.md, CURRENT_STATE.md, DECISIONS.md and the relevant docs/archive/SECTION_*.md at each section handover.
- Validate relevant domain behavior with npm test, the build and affected browser checks. Apply/test executable migrations on an isolated PostgreSQL instance; do not claim proposed tables or future access controls are implemented.
