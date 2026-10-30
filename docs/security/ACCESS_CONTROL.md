# Security and access-control design

**Status:** target design. Section 01 has no sign-in, user tables, business RLS policies or authenticated company APIs. The local prototype must use fictional data only. A demo company switch is not a security control.

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

Permissions are explicit capabilities such as `booking.create`, `payment.confirm`, `ticket.issue`, `cash.reconcile`, `luggage.register` and `boarding.verify`, combined with the resource's company/branch/station/trip scope. These are design identifiers, not seeded grants yet. Assignment checks must prevent privilege escalation and self-granting powers outside the actor's authorization.

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
