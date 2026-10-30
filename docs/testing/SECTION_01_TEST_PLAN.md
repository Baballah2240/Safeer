# Section 01 verification

## Executable checks

| Command | Purpose |
| --- | --- |
| npm ci | Reproduce pinned migration-client dependencies |
| npm test | Passenger example boundaries/ownership/cancellation, migration configuration/file checks and local server/liveness/private-file restrictions |
| npm run build | Parse/copy all allowlisted public assets and generate a SHA-256 build manifest |
| npm run check:docs | Required documents/categories and local Markdown-link integrity |
| npm run test:db | Native PostgreSQL apply/re-run, drift rejection, transaction rollback, concurrent migration runners, constraint enforcement, schema permissions and CLI status |
| npm run test:browser | Passenger-only navigation, seat/reference/cancellation, print escaping, timer restoration, demo company scoping, Arabic reference and responsive views |
| SAFEER_BROWSER_BUILT=1 + npm run test:browser | Same browser regression against generated assets |
| npm audit --json | Known package advisories at verification time, not a general security guarantee |

Database tests require SAFEER_TEST_DATABASE_URL for a disposable loopback PostgreSQL instance. They fail without configuration; they do not silently skip. Chrome uses an isolated profile; CHROME_EXE may specify its executable. Screenshots and native QA receipts stay in ignored .qa/. Official test results/counts are recorded in CURRENT_STATE and the section archive after execution.

## Applicable versus future tests

Section 01 cannot truthfully claim authenticated tenant isolation, real payment/ticket integrity, RLS, multi-seat booking or bus reassignment behavior. Those modules do not exist. The existing ownership tests exercise in-memory demo functions only, and migration-concurrency tests serialize schema runners only.

The real reservation test matrix is mandatory for Section 08/10: simultaneous requests for one seat; all-or-none multi-seat holds; expiry/reassignment; payment at the exact boundary in both lock orderings; duplicate hold/payment submissions; mobile and station competition; post-booking bus/layout changes; non-overlapping and overlapping route segments; rollback and lost-response recovery. Use independent database connections and the actual runtime role. Later authorization tests must include every role, inactive membership, resource scope, support grants and cross-company object identifiers.

Network interruption, reconnect, offline policy, notification retry, restore/load tests, ticket/luggage QR scans and financial reconciliation must be added with their owning modules. Rendering a page is not an acceptance test for these workflows.
