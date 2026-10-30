# SECTION_NN_NAME - archive template

Use a numbered entry under docs/archive/. Replace this checklist with evidence for the actual implemented section; never mark proposed work as completed.

1. **Section name/date/authorization:** owner instruction and exact permitted scope.
2. **Objectives:** acceptance criteria and explicitly excluded work.
3. **Implemented features:** source-backed behavior, separate from target design.
4. **Database changes:** migration IDs, objects, fresh/upgrade test evidence, deployment status.
5. **Files created/modified/removed:** modules and compatibility effects; link changelog.
6. **APIs:** implemented routes and contract version; distinguish future contracts.
7. **Permissions:** implemented enforcement and tests; explicitly note design-only controls.
8. **Business rules:** accepted decisions, changes/superseded rules and impact.
9. **Tests:** exact commands, environment, counts/results, failures and resolutions.
10. **Bugs fixed:** reproducible finding and verification, not generic cleanup claims.
11. **Remaining limitations:** unfinished features, deployment/service gaps, critical/high defects.
12. **Dependencies:** packages/runtime/services, pinned versions, configuration and secrets handling.
13. **Next section:** prerequisite/approval gate; never silently advance.
14. **Continuation instructions:** read CURRENT_STATE, recreate environment, run checks, locate checkpoint/archive checksum and preserve real data separately.

Record the source checkpoint commit in the generated archive manifest. Do not edit committed docs afterward merely to insert their own commit hash; this creates a circular checkpoint. Source archives exclude credentials, runtime databases, downloaded dependencies and build/test caches. A source archive is not a production-data backup.
