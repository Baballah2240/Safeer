# Local identity setup and recovery

Section 02 is local development only. Use invented accounts/data; do not expose these loopback services through a tunnel or remote reverse proxy. Production HTTPS/session deployment and company access are not implemented.

## Windows quick start

From Safeer with Node 24+:

```powershell
npm.cmd ci
npm.cmd run local
```

The optional pinned Windows PostgreSQL 18.4 package is a development convenience, not a production distribution. The launcher runs hidden native processes, binds PostgreSQL/web/API only to 127.0.0.1, and creates a private `runtime/` directory restricted to the current Windows user and SYSTEM. It stores separate randomly generated migration-owner/runtime credentials in `local-settings.json`; these are private runtime configuration, never source code.

On the first fresh database, `runtime/first-login.txt` contains fictional `owner@safeer.local` and a generated temporary password. Open http://127.0.0.1:4320/staff, sign in, and change it. After changing the password the original temporary password is invalid. This file is not a password vault; remove it after saving your new password securely. There is no hard-coded default password.

Ctrl+C stops the servers and a database process started by that launcher. `runtime/postgres` persists across restarts; existing users/roles/sessions are retained. If a previously started private cluster is already running, the launcher reuses it and does not claim ownership of stopping that process. Do not delete runtime to resolve a forgotten password, port conflict or migration error. It is your development database, not a build cache.

No account from Stocrant, a school app or a live website is imported or modified. Source checkpoints exclude runtime/ entirely; copying source alone does not copy users/passwords/business history.

## Existing loopback PostgreSQL (Windows or other systems)

Create a separate empty Safeer development database using your local migration owner. Create a runtime login with NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT, NOBYPASSRLS and no ownership/membership in elevated roles. With psql, `\password safeer_app` sets its password interactively; do not put real passwords in example commands or Git.

Set SAFEER_DATABASE_URL privately to the migration-owner connection, then:

```powershell
npm.cmd run build
npm.cmd run db:migrate
npm.cmd run identity:grant -- --role safeer_app
```

Set SAFEER_AUTH_DATABASE_URL to that limited runtime connection. Run once on an empty identity database:

```powershell
npm.cmd run identity:bootstrap -- --email owner@safeer.local --name "Safeer Owner"
```

The CLI prints a generated temporary password once; protect that output. Re-running bootstrap when any user exists is refused. No bootstrap HTTP route exists. Then start the API:

```powershell
npm.cmd run identity:start
```

In another terminal, set SAFEER_AUTH_API_URL to http://127.0.0.1:4321, then run `npm.cmd run start:built`. The web port defaults to 4320 and must match SAFEER_WEB_ORIGIN on the API. `SAFEER_AUTH_DATABASE_URL` is never passed to the browser or static asset build. Environment examples are placeholders; this project does not automatically load .env files.

## Privileged owner recovery

Stop editing users, ensure you have a backup and set SAFEER_DATABASE_URL privately to the local privileged PostgreSQL owner connection, then:

```powershell
npm.cmd run identity:recover -- --email owner@safeer.local
```

This can recover only an existing protected owner account. It generates a new temporary password, reactivates that owner, increments credential/version counters, revokes all prior sessions, requires first-use password change and writes `owner.recovered` to identity audit. It does not create an unauthenticated web bypass or alter companies. The HTTP service rejects these elevated database credentials.

## Backup boundaries

The local backup command rejects linked database paths and checksums copied files. Its temporary restore directory is private before copying, uses an available loopback port, and is removed only after a successful stop, absent process marker and resolved-path/tree verification. A failed stop retains both the restore copy and original backup. The original private backup is never used as the writable restore-check database.

Keep an encrypted PostgreSQL backup and secure configuration backup separately from source archives. Stop the private cluster before a filesystem-level development copy; a running directory copy is not a verified database backup. Restore/disaster recovery/retention for production remains Section 15. Do not share runtime/, password files, native binary caches or database URLs in a customer source ZIP.
