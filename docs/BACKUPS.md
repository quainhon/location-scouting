# Database location and backups

## What the repository proves

- Local development defaults to `data/scout.sqlite` (`SCOUT_DB` can override the path). The local SQLite file contains the workspace tables and photo/video asset tables.
- `wrangler.toml` configures a Cloudflare Pages D1 binding named `location_scout_db`, backed by the D1 database named `location-scout-db` with ID `287042cd-e607-4a3f-9e2e-58ac830eedd1`. A binding in this file is deployment configuration; it does not prove that the public custom domain currently points at this Pages project or that this D1 database contains the team's current data.
- The repository does not identify the Cloudflare account owner, production Pages project, production database, or a completed backup destination. Verify the custom domain and binding in the Cloudflare dashboard before treating the configured D1 database as the live source of truth.
- Cloudflare D1 provides automatic [Time Travel recovery](https://developers.cloudflare.com/d1/reference/time-travel/) for points in the last 30 days in the Cloudflare account. This is useful for point-in-time recovery, but it is not the separate daily copy configured below.

## Daily D1 copy to R2

`.github/workflows/backup-d1.yml` uses Cloudflare's [`wrangler d1 export`](https://developers.cloudflare.com/d1/best-practices/import-export-data/) to export the full remote D1 database as SQL, restores it into an isolated in-memory SQLite database to check integrity and required tables, then uploads the SQL and SHA-256 checksum to a Cloudflare R2 bucket. The export includes workspace records and the photo/video binary asset tables; the browser JSON snapshot does not contain those bytes.

The workflow is not active until this repository is connected to GitHub with Actions enabled, the workflow is present on the default branch, and the team has configured:

1. A private R2 bucket controlled by the team (for example, `location-scout-backups`).
2. Repository secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, and `LOCATION_SCOUT_BACKUP_R2_BUCKET`.
3. A Cloudflare Account API token with D1 Write permission for the D1 export endpoint. The Actions run confirmed that D1 Read alone is rejected by this account's D1 export endpoint. In the dashboard policy UI, D1 Write applies account-wide; it can modify every D1 database in the account. Use this only when that scope is acceptable.
4. An R2 S3 API token with Object Read & Write scoped to the backup bucket. The workflow uses the S3-compatible API for R2 transfers so this access can stay limited to one bucket. Record its Access Key ID and Secret Access Key as the two R2 repository secrets.

After setup, run the workflow with **Run workflow** and leave the expected active location count at `7` for the current acceptance drill. Archived locations remain in the SQL backup and are counted separately. The job restores the export into isolated SQLite, uploads it, downloads the R2 copy, compares the bytes, and restores that copy again while checking the seven active locations. Confirm both objects appear in the private bucket. Scheduled runs occur daily at 02:17 UTC without a fixed point-count expectation. Each run uses a timestamped key and does not overwrite prior backups. Wrangler's D1 export output is captured and redacted so its temporary signed download URL is not written to Actions logs. The R2 bucket is a separate storage service in the team's Cloudflare account; choose another destination if policy requires a different provider or account.

## Restore verification

Download a specific SQL backup from the configured R2 bucket to a controlled machine, then restore it into an isolated SQLite database in memory and check the point count:

```sh
npx --yes wrangler@4 r2 object get location-scout-backups/location-scout/backups/<timestamp>.sql --remote --file=./location-scout-backup.sql
node scripts/verify-d1-export.mjs ./location-scout-backup.sql 7
```

Use the actual bucket name and object timestamp. The final `7` is for the current acceptance check only; it checks active locations and can be omitted for later backups after the expected active count changes. The verifier checks SQLite integrity, all core workspace and media tables, and reports active and archived location counts separately. It never connects to or changes production. For a full Cloudflare restore drill, create a separate temporary D1 database and execute the dump against that database only; verify its location count before deleting the temporary database.

## Local SQLite deployments

If the custom domain is actually served by a host running `server/index.mjs`, this D1 workflow will not back up that host's `SCOUT_DB`. Identify the host and data path first, then configure a host-side daily SQLite backup to a second controlled destination. Do not place a live SQLite file in a cloud-synced folder or copy it while relying on an uncheckpointed WAL. This repository has not been given access to that host or a second-destination credential, so no local-host copy or live seven-point restore has been performed here.
