# Section 02 acceptance tests

Run from Safeer:

- `npm test`: prototype/luggage regression, identity input validation, salted scrypt/correct-wrong-password behavior, bounded hash capacity, opaque cookie/CSRF handling and server asset/liveness restrictions.
- `npm run build`: compile strict TypeScript/NestJS and build/checksum all allowlisted public assets.
- `npm run test:db`: foundation migration tests, using an isolated PostgreSQL instance.
- `npm run test:identity`: native identity API integration tests, using separate disposable databases and real restricted runtime roles.
- `npm run test:identity:browser`: real staff workflows with a disposable identity database and isolated Chrome. Set SAFEER_BROWSER_BUILT=1 to test generated assets.
- `npm run test:browser`: preserved public passenger/luggage example; run source and built modes.
- `npm run check:docs`, `npm audit --omit=dev` and `git diff --check`.

Native identity tests require SAFEER_TEST_DATABASE_URL pointing only to a disposable loopback PostgreSQL administrator with CREATE/DROP DATABASE/ROLE permissions. Each fixture creates randomly named Safeer databases/roles, applies the same migrations/grants as runtime, closes all connections and drops only its own objects. Missing configuration fails instead of silently skipping. The role used for HTTP requests cannot create tables or edit audit/permission history.

Cover first-use restrictions, cookie flags and secret hashing; current/wrong/expired/revoked credentials; CSRF/Origin/cookie/bearer injection; malformed/oversized JSON and unknown authority fields; generic unknown/disabled-user errors and durable throttling; scoped-role FK enforcement; configurable permission revocation; support restrictions; stale and duplicate writes; owner template protection and simultaneous last-owner demotions; session ownership; immutable redacted audit; one-time bootstrap and privileged recovery; refusal of elevated API DB credentials.

Browser checks exercise real sign-in and generated credentials, user creation and HTML escaping, role assignment/create/edit, temporary-password change, restricted support menus, current-session revocation, account switching, expired-session recovery during an open form and EN/AR 1920x1080, 1366x768 and 390x844 layouts. Screenshots are taken after one-time secrets are dismissed, never while a temporary password is visible. Translations/role editors and all error displays use escaped text.

The local-launch check must confirm loopback listeners, private runtime ACLs, generated first-login credentials, persistence across stop/restart, graceful owned-process shutdown and absence of credentials/runtime files from source/archive. No production database, real passenger data or live account is used. Remote HTTPS, MFA, mobile keychain/bearer flows, company memberships/RLS and business operations are not acceptance claims for Section 02.
