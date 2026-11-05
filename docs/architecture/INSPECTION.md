# Section 01 inspection

Baseline: commit `f06a638`, version 0.1.0, 16 tracked Safeer files. Inspected all source, style/HTML/SVG, package/lock files, tests, local server, instructions, mobile notes, README and original basics document. Existing ignored QA script/screenshots were reviewed; they are not production source. The working tree was clean before this section.

## Existing technology and behavior

- Plain JavaScript ES modules, HTML/CSS, Node 24 local HTTP server; no React/Next.js/NestJS/Flutter, database or external runtime package in 0.1.0.
- Browser-memory passenger seat example, duplicate-seat guard within one state object, deadline/cancellation example, demo company filtering and unpaid-reference print view.
- Fictional freight-request form/rules and sample rows. This is the intentional scope change recorded before removal in DECISIONS D01.
- Arabic/English prototype, RTL/LTR, responsive layout, allowlisted static assets, loopback binding and no HTTP write API.
- Six baseline tests passed before editing. No old binary/database migration or production business data exists in Safeer.

## Reusable work

Keep the passenger layout, clear unpaid-reference labeling, seat-grid interactions, escaping, locale copy, domain/fixture separation, timestamp-based example policy and local asset restrictions. Retain fixtures as invented data and mark the demo selector as a simulation. Preserve all old source in the pre-change verified archive.

## Findings and disposition

| Finding | Disposition |
| --- | --- |
| Old passenger-plus-freight scope conflicts with approved passenger-only release | Archive 0.1.0 before removing active freight UI/data/rules/tests; update instructions/docs |
| Browser company filter is not security; all fixture data is public in the client | Keep strong prototype labeling; auth/tenant enforcement scheduled for 02-03; no real data permitted |
| No shared inventory/transactions/jobs across browser tabs | Not promoted to backend; real engine reserved for 08 |
| Existing booking supports one invented name/seat, no mobile contact/group booking | Clearly document gap against approved guest/multi-seat requirements; implementation belongs to 08-09 |
| UI translation dictionary and large template rendering were combined | Extract translations and shared style tokens; preserve working views rather than rewriting them into unused frameworks |
| Runtime city labels also require translation after extraction | Restore catalog-derived Arabic city/status values and add unit/browser regression checks; do not prune dynamic keys using UI literals alone |
| Public asset lists would otherwise diverge between a new build and the server | Use one config/assets.mjs allowlist |
| No build or migration tooling | Add reproducible asset build, liveness contract and transactional/checksummed PostgreSQL migration foundation |
| Page-hide cleanup stopped expiry permanently after back/forward-cache restore | Restart the single timer on pageshow; add browser regression coverage |
| Cancellation had no confirmation | Add bilingual confirmation for the demo cancellation action |
| Old QA browser script imported the school project's helper | Add self-contained Safeer browser helper/tests; no application or test coupling to school-display |
| No unused third-party runtime dependencies at baseline | Add only pinned pg for implemented migration tooling; do not install unused target frameworks |

The compressed style/template files are still prototype code, not the final reusable Next.js component system. Rewriting the entire UI now would exceed the section and discard tested work. The target component/modules boundaries and migration path are documented.

## Scope and safety

Only Safeer and its dedicated workflow/documentation are changed. No installed app, school archive, Stocrant data or external account is modified. Native PostgreSQL QA uses a separate temporary cluster. No real user accounts, tenant/RLS business policies, payment APIs or future business-table stubs are added in this section.
