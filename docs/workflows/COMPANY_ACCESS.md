# Company access workflow

Section 03 / 0.4.0. Local development only. The passenger example does not create real company bookings.

1. Sign in as Super Admin, change a temporary password if prompted, and open **Companies**.
2. Choose **Create company**. Enter both names, an English URL slug, contact details if available, reservation-hold minutes (5-1440), timezone and language. Confirm with your current password.
3. The company starts pending; its creator receives a company-administrator membership. Open **Edit company** and approve it when ready. Only Super Admin changes approval/slug. Suspended, pending and archived companies are unavailable to ordinary staff.
4. In **Branches & stations**, create a branch, then its stations. Codes are unique within the company. Stations retain their original branch; identifiers/tenant ownership cannot be reassigned through edits. Deactivation preserves history and removes dependent scoped access.
5. In **Company staff**, create a new local account, choose a company role and its branch/station as required. Add up to ten scoped assignments when needed. The generated temporary password is shown once; share it privately. The employee must change it at first sign-in. Linking an existing global account is a Super Admin action.
6. Use **Company roles** for tenant-specific permissions. Global templates affect new companies only. Role scope remains fixed; create a new role for another scope. A manager cannot grant permissions they do not hold in the target resource. Keep an active company administrator with profile/staff/role read and staff/role management permissions.
7. Use **Support access** for a recorded, read-only platform-support grant. Super Admin selects an existing active platform-support account, reason, 1-24 hours and read permissions. Company managers can inspect their grants; only Super Admin creates/revokes them. No financial access exists. Expired/revoked grants confer no access.
8. Review **Company audit** for the latest 100 events visible in your scope. Events contain actor/target IDs, action and time, never passwords or full request payloads.

Company administrators see their company; branch/station managers see only authorized resources and relevant members. One assigned company opens directly without a selector. More than one authorized company permits switching only among that returned list. Merely knowing or changing a company ID grants nothing.

Editing a membership changes only the local alias, membership active state and scoped assignments. It does not deactivate a global user or reset a password shared with another company. Company-scoped credential recovery is intentionally unavailable; Super Admin can use the existing platform user recovery tools. Ask another administrator to change your own access if doing so would leave you unable to audit the operation; last-administrator protection applies first.

The documented local bounds are enforced instead of truncating lists silently: 200 companies, 100 branches, 200 stations, 500 members and 50 roles per company; 10 assignments/member; 500 support-history rows/company. These are development bounds; later production work must introduce appropriate pagination/scale controls.
