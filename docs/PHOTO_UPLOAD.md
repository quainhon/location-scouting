# Scout photo capture and storage

## User flow

On mobile, Quick Capture offers **Chụp ảnh** (`capture="environment"`) and **Chọn ảnh** (multiple files). The operating system chooses the camera/file UI; desktop browsers generally open a file chooser for both. Picked photos have thumbnails and individual removal buttons. Nothing uploads until **Lưu địa điểm**. Location details also offer the same picker and **Lưu N ảnh** for existing places. The gallery displays every saved photo.

The client prepares images sequentially, strips metadata by canvas re-encoding, and reduces them to JPEG at up to 1920px on the longest edge, reducing further to fit under 1,000,000 bytes. There are at most 12 photos per location through this picker. Input files are limited to 20 MB / 48 MP. JPEG, PNG and WebP are supported; HEIC/HEIF depends on browser decoding support and produces an actionable JPEG conversion message when unavailable.

Uploads precede the workspace save. On upload or workspace failure, the form retains its photos and location identity for retry while mounted. Save and media controls are disabled during preparation/upload. The UI only reports success after the workspace write succeeds. Reloading with unsaved photos uses the browser's standard before-unload guard. Draft blobs are not an offline queue and are lost if the user proceeds with reload or closes the app. Existing-place photo drafts should be saved before closing the details sheet.

## Persistence and access

- `PUT /api/photos/<sha256>` accepts bounded JPEG bytes; `GET` returns the image.
- URLs stored in `location_photos` are relative same-origin paths. Old HTTP(S) URLs continue working. Workspace JSON/export contains references, not image bytes.
- Bytes live in `scout_photo_assets`, in the same SQLite file locally and the existing `location_scout_db` D1 binding on Cloudflare. This is durable storage, not a browser object URL or a worker filesystem.
- `database/schema.sql` includes the additive table. The Pages photo adapter also creates it idempotently on first storage access, so no extra service/bucket/credential is required. No location/tour data is migrated or removed.
- Pages routes rely on the same existing Cloudflare Access protection as `/api/workspace`. Protect the whole hostname, including `/api/photos/*`, and protect preview deployments before using real photos. GET responses are private-cache only; uploading does not make files public or change Drive sharing.
- Hash-addressed PUT is idempotent: retrying the same bytes reuses storage. Payload signature, digest, size, MIME and upload origin are checked server-side. JPEG-only responses set `nosniff`.
- Archive/restore and workspace rewrites preserve binary assets. Unreferenced uploads from a failed/abandoned save are retained for safe retry; automatic garbage collection is not implemented. Backup the complete database to include image bytes; JSON export alone is not an image backup.

This implementation suits compressed scouting photos. It deliberately does not store originals or video. Storage counts toward the existing database capacity. The 1 MB bound stays below [D1's 2 MB row/BLOB limit](https://developers.cloudflare.com/d1/platform/limits/); larger media libraries should move the asset adapter to dedicated media storage while preserving these URLs.

## Verification

`npm run build` type-checks the photo Pages adapter as well as the frontend. `npm test` checks upload/retrieval, duplicate retry, size/type/hash/origin rejection, expired-login HTML, partial upload retries, D1 binary adapter behavior, and SQLite photo persistence after reopening and archive/restore.

Browser checks used a separate local test database: two-image selection, thumbnail removal, capture/save, reload and server-backed image loading, adding an image to an existing place, gallery navigation, and the `capture="environment"` input. Physical phone camera permission/capture still needs a device smoke test after deployment. No production data or deployment was modified.
