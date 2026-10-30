# Section archives and source checkpoints

Numbered Markdown entries in this directory are permanent source-controlled handovers. Compressed source ZIPs live under the ignored project `archives/` folder, with SHA-256 sidecars and per-file manifests. The source repository retains history; ZIPs do not include its entire .git database.

- Pre-change checkpoint: `archives/Safeer-0.1.0-before-passenger-scope-2026-10-30.zip`, 16 files from f06a638. This preserves the superseded passenger-plus-freight prototype. Verified SHA-256: `c96957d4d5211abadd2fcf7527d2fc03655ab42dc45da3525583fda40b0ee1f0`.
- Section 01 entry: [SECTION_01_FOUNDATION.md](SECTION_01_FOUNDATION.md).
- Final Section 01 ZIP: `archives/Safeer-0.2.0-Section-01-2026-10-30.zip`, generated and verified at handover. Its manifest records the exact source commit, file hashes and verification receipts. It includes the small historical checkpoint for recovery of intentionally removed freight code.

To continue, extract into a new folder, read docs/CURRENT_STATE.md first, run npm ci, npm test and npm run build. Do not point integration tests at real operational databases. Follow database/MIGRATIONS documentation for a disposable local PostgreSQL instance. Keep real business-data backups separately and securely; no runtime credentials or customer databases belong in a source archive.
