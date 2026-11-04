# Safeer

- Independent Sudan passenger-transport project. Do not edit Stocrant or the school-display application for Safeer work.
- Current authorized stage: Section 15 (D39), USB Android apps (D40) and the verified bento/liquid-glass shared UI refresh (D41) are complete locally. Keep the service loopback-only and preserve users/data. No hosting or store release is authorized; stop pending the owner's next instruction.
- Keep the service on 127.0.0.1. No deployment, external accounts, SMS delivery or online payment integration is authorized yet.
- Follow docs/decisions/MASTER_INSTRUCTIONS_2026-10-30.md. Release 1 is passenger transport and passenger luggage only; freight/parcels are deferred. Record changes in docs/DECISIONS.md before implementing them.
- Support multiple companies from the start. Production access must be enforced on the server using authenticated company membership, never a browser company selector.
- Companies choose unpaid-reservation deadlines. Calculate expiry from timestamps and release seats when a hold expires.
- Online purchases and payment collection are outside the passenger app's scope. Issue a reservation reference first; only authorized staff may confirm offline payment, after which the final travel ticket and payment receipt can be issued. Follow the implemented D32 payment controls; later financial policy changes need explicit agreement.
- Keep responsive web/mobile-facing code together in src/. Android local USB launchers live in mobile/android/ and reuse the running shared web application. Update mobile/UPDATES.md, build/lint, run npm.cmd run mobile:save, and verify install on the intended USB device. Never commit APKs, Gradle caches, SDK paths or signing material.
- Use invented demonstration data only. Do not store passenger IDs, real customer data, tokens or credentials in fixtures or source control.
- Work one numbered section at a time. The owner's latest "next" approves SECTION 15 (D39), preserving existing money rules and scoped driver/finance controls. Test, document and archive the completed local checkpoint, then stop. Deployment or later features need a new owner instruction.
- Owner-authorized follow-up: the passenger prototype collects a luggage yes/no declaration and required description (1-300 trimmed characters when yes). This does not authorize full Section 11 operations or Section 02; see D16 in docs/DECISIONS.md.
- Update docs/PROJECT_MASTER.md, DEVELOPMENT_ROADMAP.md, DATABASE_SCHEMA.md, BUSINESS_RULES.md, SYSTEM_ARCHITECTURE.md, CHANGELOG.md, CURRENT_STATE.md, DECISIONS.md and the relevant docs/archive/SECTION_*.md at each section handover.
- Validate relevant domain behavior with npm test, the build and affected browser checks. Apply/test executable migrations on an isolated PostgreSQL instance; do not claim proposed tables or future access controls are implemented.
