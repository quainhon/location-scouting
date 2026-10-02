# Architecture

React + TypeScript renders a three-column scouting workspace. `src/Workspace.tsx` owns persisted state, forms, navigation and galleries; `src/components/ScoutMap.tsx` owns the real Leaflet map. `src/utils/invariants.ts` preserves location/tour separation.

`server/index.mjs` serves the built website and a localhost JSON API. In development, Vite proxies `/api` to port 3001. `server/store.mjs` validates snapshots and writes all changes in one SQLite transaction. Optimistic revisions prevent concurrent overwrites. The browser updates persisted state only after a successful response and keeps errors visible.

`database/schema.sql` is the executable source of truth. No records are seeded. Locations are independent entities; tour stop order is per-tour. Removing a stop never removes its location or Drive reference. Archival preserves route membership and can be reversed. Database files are ignored by Git.

Internet services are used only for basemap tiles, the optional web font, user-supplied image URLs and user-clicked external links. No Google Drive OAuth, routing engine, shared accounts or QNCC synchronization is implemented. This is a single-machine local application with a schema prepared for later integration.
