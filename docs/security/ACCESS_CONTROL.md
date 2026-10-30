# Security and access-control design

**Status:** Section 02 implements local identity/platform authorization. Company memberships, scoped company roles, business RLS policies and authenticated company APIs remain Section 03 or later. The separate passenger prototype remains fictional; its company switch is not a security control.

## Implemented identity protections

Adaptive asynchronous scrypt uses N=32768/r=8/p=3, random 16-byte salts and 64-byte derived keys. Passwords are 14-128 characters for new credentials, bounded to 512 UTF-8 bytes; hashing admits at most two concurrent jobs and rejects overload. Login attempts (eight per normalized login, 120 per local IP per 15 minutes) and password reauthentication (eight failures, 120 work attempts per user per 15 minutes) are database limited. Unknown and disabled users get the same login error, with dummy hashing for unknown identities.

Sessions use random 32-byte opaque cookies and store SHA-256 hashes only. They expire after 12 hours or 30 minutes idle and recheck user activation, credential version, role activity and permission grants. Password changes/resets revoke all prior sessions; self-change issues a fresh session/CSRF token. Users can revoke only their own session IDs. Each account has at most ten active sessions.

Browser cookies are HttpOnly, SameSite=Strict, scoped to `/api/v1`; **Secure is intentionally absent only for the strictly loopback HTTP development service**. Remote binding, proxy trust, cross-origin credentials and production deployment are not enabled. Mutations require the exact configured web Origin and a session-derived HMAC CSRF token, except pre-session login which still requires Origin. Bearer headers, cross-site fetch metadata and duplicate/malformed session cookies are rejected. CSRF/session secrets never enter local storage.

Privileged changes require the actor's current password and reauthorize inside the identity transaction lock. Role grants cannot exceed the actor's permissions; only an existing protected owner can grant/change owner accounts. The protected owner template cannot be edited, and concurrent demotions/deactivation cannot remove the last active owner. User/role edits use expected versions. A role label or browser flag never grants access.

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

The implemented catalog has six `identity.*` capabilities for users, roles, platform assignments and audit. Owner has all six; support defaults to identity users/roles read only. Company/branch/station/trip templates have no global identity grants and cannot be assigned before Section 03. Business capabilities such as `booking.create`, `payment.confirm`, `ticket.issue`, `cash.reconcile`, `luggage.register` and `boarding.verify` remain design identifiers, combined with validated resource ownership in their owning sections.

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
