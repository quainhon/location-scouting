# Mobile Scout UI

At widths up to 650px, the workspace opens directly on the map. Desktop retains the existing tour workspace.

## Capture

- + Scout opens a native dialog styled as a bottom sheet. Location permission is requested only after this action.
- GPS failure offers retry or explicit map placement. A valid position is required; name, notes and impression are optional.
- A generated name supplies the existing server's required name field. Ratings use `scout:rating:*` entries in the existing tags array.
- Capture first saves the point payload and photo/video Blobs to IndexedDB on this device. It can be saved without network; pending entries appear immediately on the map and in the library with **Chờ đồng bộ**. Pending map pins are amber, and a persistent sync bar shows the queue count and **Đồng bộ ngay** on every mobile tab.
- When online, queued captures upload one at a time in creation order. Sync starts on app open, the browser `online` event, return to a visible tab, and the manual button. Failed entries stay in IndexedDB with their error and retry schedule; automatic retries use exponential delays from 1 second up to 5 minutes. The queue entry is removed only after the revision-aware workspace API confirms the location.
- Every quick capture receives one UUID at capture time. Retrying reuses that ID; the workspace API and SQLite/D1 primary key upsert preserve one row for the same ID. The sync path reads the latest workspace before writing, so it does not blindly replay a stale snapshot after a revision conflict.
- Reloading the app keeps queued capture data, photos, and retry metadata in IndexedDB. If the browser cannot open IndexedDB, offline save is disabled and the online server flow remains available.
- A queued location cannot be edited, have its survey status changed, or be archived until sync is confirmed. The detail view explains this while the queue owns the local payload and attached media.

## Review

The four tabs are Map, Routes, Scouts, and Library. Routes lets you select a saved tour, create a tour by selecting active spots and setting their order, then move saved stops up or down. Opening View route returns to the map with the selected tour pins and real driving route in that order. Today uses the device's local calendar date. Search covers name, region and notes. Existing candidate/not_scouted records appear as needing review; scouted and approved retain their existing stored values. Archive is reversible from Library → Archived. On a route, a stop can be removed without deleting the library spot. Permanent spot deletion is available from spot details after an explicit confirmation and also removes the spot from every linked tour.

## Scope

The session control counts elapsed time and successful captures in this open mobile view. It explicitly does not record a GPS route or persist sessions. Photo capture/upload is supported (see PHOTO_UPLOAD.md). Audio, AI and undo are not implemented. Existing photo URLs remain viewable and editable. Photo storage adds one independent table and API route; production deployment is separate.

## Verification

Run `npm run build` and `npm test`. Quick capture tests cover default records, invalid coordinates, optional ratings, legacy status mapping and local-day filtering. Offline queue tests cover Blob persistence, creation order, retry metadata and bounded exponential backoff. The D1 workspace test simulates a committed create with a lost response and confirms retrying the same UUID keeps one spot.

Manual checks: 360/390/430px mobile layouts; map placement without GPS; save and reopen a point; rating persistence; notes editing; archive/restore; failed save/retry; desktop at 1280px. Use a separate SCOUT_DB for manual test records. Physical-phone acceptance still requires airplane-mode captures, force-close/reopen, a second-device visibility check, mid-sync network interruption, and a lost-response test; automated repository tests do not substitute for those device checks.
