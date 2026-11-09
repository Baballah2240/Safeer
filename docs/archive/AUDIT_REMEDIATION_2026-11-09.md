# D56 - Audit remediation

Date: 2026-11-09 (Asia/Riyadh). Owner authorization: fix the reported audit issues; the owner explicitly approved publication of the support address. Existing data, accounts, authorities and financial rules remain intact.

## Implemented

- Search responses carry a generation check; older successes or failures cannot overwrite newer results. The URL uses the submitted filter snapshot. In-progress city/date values are separate ephemeral drafts and survive language/sort/result rendering.
- The shared config/http-limits.json permits 65,536 bytes for POST /api/v1/public/holds only. Proxy length/chunk guards and the API parser use the same limits. All other JSON endpoints retain 8,192-byte guards. A rejected oversized booking gets a specific bilingual explanation. Ten Arabic travelers with maximum UI name/luggage lengths now succeed through both API and proxy.
- Sidebar controls return to their own toolbar above navigation. The restore button remains fixed/reachable when navigation is hidden, header space is reserved, visibility/ARIA updates immediately and FLIP overflow is clipped without creating a new scrolling container.
- Privacy/deletion pages publish the approved monitored address. No legal workflow or account-deletion automation is claimed.
- Hosted Android connection errors describe internet/retry; debug errors retain USB instructions. Version .6/16006 preserves replacement signing and app data. Windows build invokes the Java wrapper directly rather than relying on current-directory batch resolution.
- npm run identity:recover:hosted provides explicit privileged operational recovery on Render, including optional email change. It rejects the application runtime role, accepts the actual users-table owner without requiring superuser, preserves owner authority, rolls back email conflicts, revokes prior sessions, clears targeted login throttles, forces first-use password change and writes an audit event. It is never called by HTTP or startup. No real owner reset was performed during remediation.
- The release runner now includes every browser script. A dedicated-repository PostgreSQL 16 CI workflow and a configurable isolated local binary path close the prior version/coverage gaps.

## Verification

Targeted PostgreSQL 18 tests passed for maximum Arabic bookings, endpoint bounds, hosted Secure/HttpOnly/SameSite cookies, Host/Origin enforcement and non-superuser recovery/duplicate rollback. Sidebar (32 combinations), headers (64 combinations) and marketplace race/draft regressions pass. Both debug Android variants build and lint successfully and APK/checksum/manifests are saved under ignored mobile/releases/.

All 17 unit/server checks and all 129 integration tests passed on an isolated PostgreSQL 16.15 cluster. All 20 browser scripts passed across the main run and a fresh-cluster continuation. The initial run exposed a test predicate dereferencing an absent loading-state badge in luggage; the predicate now waits without suppressing console errors or weakening the expected-state assertions. Luggage and all remaining scripts passed after correction. The original failed single-run receipt is preserved; the composite evidence is .qa/audit-remediation-verification.json and .qa/remediation-browser-tail.json. Remote CI must finish green before an online release. Both hosted HTTPS Android variants also compiled and passed lint. Every native variant has zero lint errors and two pre-existing compatibility warnings. Local service restart succeeded, its database is connected and all 37 served assets match the build.

## Deployment and hardware boundaries

The monorepo origin is Baballah2240/stocrant. The dedicated Baballah2240/Safeer repository referenced by hosting is private and the available Git session cannot authenticate to either repository. Render is not connected and no browser surface is available. Therefore an online deployment is not claimed from a monorepo push. The exact reviewed source must be published to Render's connected repository and deployed before comparing online hashes.

No authorized physical USB phone was available during the checks, so replacement installation and physical offline/error acceptance are not claimed. No production database, owner password, booking or payment was changed.

## Source checkpoint

The source is committed locally on the existing main branch; a source-only archive and checksum are saved under ignored archives/. GitHub push and verified Render deployment await authenticated access. Debug APKs/checksums/manifests remain private in mobile/releases/ and need an authorized USB phone for replacement installation.
