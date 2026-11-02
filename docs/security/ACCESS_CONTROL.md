# Security and access-control design

**Status:** Section 02 implements local identity/platform authorization. Section 03 implements company memberships, scoped roles, tenant RLS and authenticated company APIs. The separate passenger prototype remains fictional; its company switch is not a security control.

## Implemented identity protections

Adaptive asynchronous scrypt uses N=32768/r=8/p=3, random 16-byte salts and 64-byte derived keys. Passwords are 14-128 characters for new credentials, bounded to 512 UTF-8 bytes; hashing admits at most two concurrent jobs and rejects overload. Login attempts (eight per normalized login, 120 per local IP per 15 minutes) and password reauthentication (eight failures, 120 work attempts per user per 15 minutes) are database limited. Unknown and disabled users get the same login error, with dummy hashing for unknown identities.

Sessions use random 32-byte opaque cookies and store SHA-256 hashes only. They expire after 12 hours or 30 minutes idle and recheck user activation, credential version, role activity and permission grants. Password changes/resets revoke all prior sessions; self-change issues a fresh session/CSRF token. Users can revoke only their own session IDs. Each account has at most ten active sessions.

Browser cookies are HttpOnly, SameSite=Strict, scoped to `/api/v1`; **Secure is intentionally absent only for the strictly loopback HTTP development service**. Remote binding, proxy trust, cross-origin credentials and production deployment are not enabled. Mutations require the exact configured web Origin and a session-derived HMAC CSRF token, except pre-session login which still requires Origin. Bearer headers, cross-site fetch metadata and duplicate/malformed session cookies are rejected. CSRF/session secrets never enter local storage.

Privileged changes require the actor's current password and reauthorize inside the identity transaction lock. Role grants cannot exceed the actor's permissions; only an existing protected owner can grant/change owner accounts. Super Administrators may edit every role template, including their own. Their effective permissions always include the catalog, independently of editable grants. Only Super Administrators may edit owner or non-platform roles. Concurrent demotions/deactivation, including owner-role deactivation, cannot remove the last active owner. User/role edits use expected versions. A role label or browser flag never grants access.

No unauthenticated HTTP bootstrap or public password-reset shortcut exists. The first owner is created once using local tooling and a generated temporary password. Recovery requires the local privileged DB connection and revokes old sessions, requires password change and records an audit event. No email/SMS reset delivery, MFA, mobile bearer-token storage, remote HTTPS hosting or production security audit is claimed; these require explicit follow-up before remote use.

## Initial roles and configurable permissions

| Role | Intended resource scope | Initial capability boundary |
| --- | --- | --- |
| Platform super administrator | Explicit platform scope | Authorized global management, privileged actions audited |
| Platform support administrator | Support tasks and explicit scoped grants | No sensitive company finance access by default; grants have approver, reason, permissions, expiry/revocation |
| Company administrator | Own company | Company operations/settings, own role assignments and authorized financial work |
| Branch manager | Assigned branch/stations | Branch operations and granted reports, no other-company access |
| Station manager | Assigned station | Station staff/counters, sessions and reconciliation within granted limits |
| Ticketing employee | Assigned station/counter/session | Reservations, authorized payment recording, ticket/receipt issuance; no historical money edits |
| Boarding employee | Assigned trips/station | Ticket/luggage verification and boarding, no general finance authority |
| Driver | Assigned trips | Necessary manifest/seat and trip-event information only |

The implemented catalog has six `identity.*` and nine `company.*` capabilities. Super Admin has the full catalog; support defaults to identity users/roles read only. Company/branch/station/trip templates have no global identity grants and cannot be assigned through platform assignments; company/branch/station roles use Section 03 memberships and trip roles wait for actual trips. Business capabilities such as `booking.create`, `payment.confirm`, `ticket.issue`, `cash.reconcile`, `luggage.register` and `boarding.verify` remain design identifiers, combined with validated resource ownership in their owning sections.

## Enforcement requirements for Sections 02-03

1. Authenticate server-side, validate session/token revocation/expiry, then resolve active membership. Never trust role/company flags from request JSON or local storage.
2. Use scoped repositories, same-company composite FKs and RLS policies. Set transaction-local tenant context only after membership verification; use pooled connections safely.
3. Application DB users neither own business tables nor have superuser/BYPASSRLS. Migration credentials are separate. Decide FORCE RLS per business table and test using the actual runtime role, not only a schema owner.
4. Public approved-company/trip/fare projections have explicit columns and publication filters; they cannot join manifests, private passenger rows, employees or finances.
5. Platform administration is a distinct authorized path. Support financial access uses explicit company/platform authorization policy and a scoped expiring grant; audit both the grant and its use.
6. Guest booking references are not credentials. Store hashed high-entropy capabilities; use verified-contact recovery if implemented. Guest booking does not require a passenger account.
7. Minimize driver manifest fields, bind QR validation to the assigned trip, rate-limit lookup/scan/hold endpoints, and avoid predictable identifiers exposing PII.

## Other baseline requirements

Passwords use a reviewed adaptive hash, unique generated secrets, hardened sessions and password-reset/revocation rules in Section 02. No fixed default administrator password. Browser sessions need HttpOnly/Secure/SameSite cookies, CSRF protection where applicable, exact-origin checks and authenticated WebSocket subscription authorization. Mobile tokens require secure storage and rotation/revocation design; do not copy a browser cookie implementation blindly.

Validate all DTOs, use parameterized SQL, redact PII/secrets from logs, enforce request/response limits, constrain file uploads and keep documents private. Audit sensitive decisions without storing full passenger or credential payloads. Define retention, backups, restore access and incident handling before production. No legal/regulatory compliance guarantee is made by this technical foundation.

Section 01's loopback-only asset server, CSP, private-file allowlist, no write API, private migration namespaces and sanitized database CLI failures are implemented safeguards. They do not substitute for future application security.

## References checked for this implementation

- [NestJS authentication](https://docs.nestjs.com/security/authentication) and [authorization](https://docs.nestjs.com/security/authorization).
- [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): the implemented scrypt work settings are one listed memory/work tradeoff.
- [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) and [CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). Local HTTP is explicitly an isolated development exception, not the recommended transport for a remote session.


## Implemented Section 03 company isolation

CompanyService reauthorizes inside the shared transaction lock and sets a raw session capability only with transaction-local set_config. SQL helpers independently validate its hash against an active non-temporary identity/session, idle/absolute expiry and credential version. Arbitrary actor/company IDs, a browser selector or a super flag confer no access. An ordinary platform role with company-named permissions also confers no membership.

Eleven tenant tables have RLS, explicit same-company service predicates, composite foreign keys and immutable-ownership triggers. Runtime is not an owner/BYPASSRLS/DDL role. Private SECURITY DEFINER helpers use a fixed trusted search_path and fully qualified objects; PUBLIC execution is revoked. Startup verifies expected RLS tables. Policies derive company/branch/station permission scope from active memberships, company roles and active parent resources. Assignment/grant ceilings are checked in both service and RLS. Mixed-scope memberships cannot be replaced by a manager who controls only a subset. No credentials or raw tokens are stored in company records/audit.

The last capable active company administrator is protected by deferred checks on company users/assignments/roles/permissions and global-user updates, under the same lock. Operations that remove the actor own company access before an audit can complete are refused. Archive instead of deleting company history; global credentials are changed only through the existing platform identity tools.

Support access requires an active reserved platform-support role, reason, explicit Super Admin grant, approved company, selected read-only codes, non-revocation and database-time expiry. Company managers may inspect grants but cannot create/revoke them. No financial permissions exist in this section. Local-only policies, limited capacities and tests do not constitute a production security certification. HTTPS, proxy trust, recovery delivery, MFA, load/performance and final security review remain future deployment work.

The implementation follows PostgreSQL documented [row security behavior](https://www.postgresql.org/docs/18/ddl-rowsecurity.html) and [SECURITY DEFINER precautions](https://www.postgresql.org/docs/18/sql-createfunction.html), including separate non-owner runtime credentials and restricted helper execution.

## Section 04

Cities/routes/stops add three RLS tables (14 total). A valid transaction-local raw session is mandatory. Only Super Admin mutates the shared catalog. Company route reads use company_can without branch/station parameters; management also requires resource reads, so scoped grants cannot broaden access. Existing tenant roles remain unchanged during migration. Explicit read-only support may select route access; expiry/revocation/status are rechecked before returning data. City changes enter identity audit, route changes company audit. Composite station/company/city FKs and deferred route/resource validation enforce consistency beneath the API. No public marketplace endpoint is added.

## Section 05

Seat layouts, revisions, seats, buses and drivers add five RLS tables (19 total). A valid transaction-local raw session is mandatory. Fleet and driver reads use company_can without branch or station parameters, so narrower grants never match. Writes also require the matching manage permission, company profile read for audit and the current password. Driver contact details need driver read permission, and fleet access does not reveal them. Support grants cannot include fleet or driver permissions. Linking a driver to a staff member grants nothing.

## Section 06

Trips, trip stops and assignments add three RLS tables (22 total). A valid transaction-local raw session is mandatory. Reads use company_can without branch or station parameters. Writes also require company-wide route, fleet and driver reads, company profile read for audit and the current password. Trip readers never receive driver contact details. Support grants cannot include trip permissions.

## Section 07

Four anonymous GET routes exist. They use no session and call fixed projections that exclude drivers, registrations, bus codes, staff and private contacts. All other routes keep their checks. Public profile changes need company.profile.manage, CSRF and the current password. Public routes have no rate limit yet; hosting must add one before any public exposure.
