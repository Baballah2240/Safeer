# Backup restore check (D128)

Render keeps backups of the hosted database `safeer-db`. A backup only counts once it has been restored and checked. Do this **once a month** and after any big data change. It takes about 15 minutes and changes nothing on the live site.

1. **Restore into a new database.** In the Render dashboard open `safeer-db` > **Recovery**, choose a recent time and restore it as a **new** database (for example `safeer-db-restore-check`). Never restore over `safeer-db`.
2. **Copy both external connection URLs.** On each database page, copy the *External Database URL*. Keep them out of chat, files and Git.
3. **Compare.** On the computer with this repository:

   ```powershell
   $env:SAFEER_SOURCE_DATABASE_URL = '<live safeer-db URL>'
   $env:SAFEER_RESTORED_DATABASE_URL = '<restored database URL>'
   npm run backup:compare
   Remove-Item Env:SAFEER_SOURCE_DATABASE_URL, Env:SAFEER_RESTORED_DATABASE_URL
   ```

   Both connections are read-only. The script lists every table with its live and restored row count. `PASS` means every table exists and holds data where the live one does (the copy is from an earlier moment, so small differences are normal). `FAIL` names the missing or empty tables: contact Render support before relying on that backup.
4. **Delete the restored database** in Render, so it stops costing money and no extra copy of passenger data stays around.
5. **Write down** the date and result (for example in `docs/CHANGELOG.md` or your own log).
