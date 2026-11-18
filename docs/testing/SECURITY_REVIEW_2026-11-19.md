# Safeer security review - 2026-11-19 (D118)

Scope: everything added since the D72 audit (2026-11-12, commit 4bcc454), 53 commits. That covers billing, contracts and invoices with their PDFs, company branding and logos, stop-to-stop fares, trip hold hours, payment proofs, staff alerts and notification details, counter session manifests, contract terms, and the home and staff pages. The whole existing test suite was run again. This is a review and attack test, not proof that no defect remains.

## Method

- Code review of the new API code (apps/api/src), proxy (server.mjs), migrations 0023-0032 and the new front-end files.
- Every new SECURITY DEFINER database function was checked for a fixed search_path and for EXECUTE revoked from PUBLIC. Functions without their own permission check are callable only from other checked functions.
- New attack test tests/security-probe.integration.mjs, run against a disposable database:
  - **Access refusal:** anonymous callers, a luggage handler without the permission, and a full manager of another company are all refused. This covers 7 new read endpoints and 6 new write endpoints, including other-company IDs sent through the caller's own company path.
  - **Write protection:** forged writes without the CSRF token or from another origin are refused.
  - **Hostile input:** 1,105 requests (25 hostile values per field on 8 write endpoints) cover:
    - SQL and script text, path traversal, null bytes, huge strings, deep nesting and prototype pollution;
    - a fake SVG logo, impossible dates and out-of-range stop indexes;
    - non-JSON, truncated and oversized bodies.
- The full existing gate: npm run check (28/28), all database integration suites (162/162), and the headers, home, passenger privacy, booking hero, marketplace and Google sign-in tests.
- npm audit (production and development): 0 known vulnerabilities.
- Live site, read-only: the strict CSP and HSTS are served.

## Findings

No exploitable weakness was found in the reviewed code. Confirmed protections:

| Area | What protects it |
|---|---|
| Cross-site request forgery | Every non-GET needs the exact web origin plus a session-bound CSRF token. Cross-site fetches are refused, and bodies must be JSON. |
| Script injection (XSS) | Server values are escaped with e() (covering & < > " ') before they enter HTML. The CSP allows scripts only from Safeer's own files (no inline script, no eval, no frames, base-uri none, form-action self). The language parameter is whitelisted. |
| Uploaded images | Logos and payment proofs accept only PNG/JPEG/WebP data URLs and are checked by file signature and size, both in the API and by database CHECK constraints. They are served with their stored image type plus nosniff. SVG is refused. |
| Access to other companies' data | Permission checks run inside SECURITY DEFINER functions (company_has, company_actor). Tables use row level security and are revoked from PUBLIC, and the runtime role cannot create tables or change audit history. |
| SQL injection | All queries are parameterized, and hostile text is refused or stored as text. |
| Abuse and denial of service | Per-endpoint body limits (checked at the proxy and the API), header, request and keep-alive timeouts, limited headers per request, and per-visitor rate limits on public booking (429 seen in the probe). |
| Sessions | HttpOnly, SameSite=Strict, and Secure when hosted. |
| Leaking internals | Errors return stable codes. The probe found no stack traces or SQL text in any answer. |

## Change made

- **New headers:** Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Resource-Policy: same-origin are now sent on every page and file. They separate Safeer's windows from other sites' pages and stop other sites embedding its files. Google sign-in uses a full-page redirect, so it is unaffected (test:passenger-google passes).
- **Test:** tests/production.integration.mjs now checks both headers on every page.

## Open items (not changed)

- **HSTS:** has no includeSubDomains or preload, because other services may share mohbaba.online. Add them only once every subdomain is HTTPS-only.
- **Carried over from D72:** expired passenger sessions are removed only at that account's next sign-in, and the Cloudflare range list in server.mjs needs updating when Cloudflare publishes new ranges.
- **Flutter apps:** the published apps were not part of this review. Their PIN/biometric lock (D113) and local storage should get their own review.
- **Hosting account:** a review cannot cover leaked passwords, the Render and GitHub account security, or the domain registrar. Use two-factor sign-in on all of them.
