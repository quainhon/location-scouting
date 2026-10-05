# Mobile Scout UI

At widths up to 650px, the workspace opens directly on the map. Desktop retains the existing tour workspace.

## Capture

- + Scout opens a native dialog styled as a bottom sheet. Location permission is requested only after this action.
- GPS failure offers retry or explicit map placement. A valid position is required; name, notes and impression are optional.
- A generated name supplies the existing server's required name field. Ratings use `scout:rating:*` entries in the existing tags array.
- Capture saves through the existing revision-aware workspace API. No tour is added or modified.
- Closing the sheet retains its draft in component memory. Successful save clears it. Reloading or switching to desktop does not preserve drafts.
- Failed saves retain the draft and its ID for retry. On a revision conflict, reload workspace data before retrying.

## Review

The three tabs are Map, Scouts, and Library. Today uses the device's local calendar date. Search covers name, region and notes. Existing candidate/not_scouted records appear as needing review; scouted and approved retain their existing stored values. Archive is reversible from Library → Archived.

## Scope

The session control counts elapsed time and successful captures in this open mobile view. It explicitly does not record a GPS route or persist sessions. Camera upload, audio, AI, offline capture/sync and undo are not implemented. Media placeholders say they are unavailable; existing photo URLs remain viewable and editable. No database schema, backend or production deployment changes.

## Verification

Run `npm run build` and `npm test`. Quick capture tests cover default records, invalid coordinates, optional ratings, legacy status mapping and local-day filtering.

Manual checks: 360/390/430px mobile layouts; map placement without GPS; save and reopen a point; rating persistence; notes editing; archive/restore; failed save/retry; desktop at 1280px. Use a separate SCOUT_DB for manual test records.
