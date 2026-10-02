# Architecture Decisions & Product Model — Quài Nhơn Location Scout

## 1. Domain Model Hierarchy & Ownership Invariant

The core data model follows a strict 3-tier hierarchy:
```
ScoutLocation (1) <----> (*) TourStop (*) <---- (1) Tour
```

### Invariants:
1. **Independent Reusability**: `ScoutLocation` is independent and reusable. It exists in the global Scout Library without requiring an active tour, and can be referenced by multiple independent tours simultaneously.
2. **Local Sequence Ownership**: Sequence ordering (`stop_order`: 1, 2, 3...) strictly belongs to `TourStop`, never globally to `ScoutLocation`. Different tours visiting the same location can sequence it at different stops.
3. **Reference-Only Mutation**: Removing a `TourStop` from a `Tour` deletes only the link in that specific itinerary. It NEVER mutates, archives, or deletes the underlying `ScoutLocation` or its attached Google Drive folder/files.
4. **Soft Delete / Archival**: Hard deletion is disabled by default. Locations transition to `status: 'archived'` to preserve shoot history, notes, and asset links.
5. **Zero Drive Duplication**: Google Drive assets and folders are referenced by ID and URL (`drive_reference.folder_id`), never copied or mirrored in local storage.
6. **Human Authority on AI Changes**: AI agents may propose stops or route sequences, but cannot silently mutate approved routes, archive locations, or publish official tour plans without explicit human confirmation.

---

## 2. Desktop-First 3-Area Workspace Design

```
+-----------------------------------------------------------------------------------+
|  Header: Tour Switcher | Duration & Stops Count | Invariant Safety Status         |
+-----------------------------------------------------------------------------------+
|  AREA 1: Tour Stops List  |  AREA 2: Location Canvas   |  AREA 3: Detail Panel    |
|  (~300px - 340px)         |  (Interactive SVG / Map)   |  (~360px - 380px)        |
|                           |                            |                          |
|  - Sequence badges #1..N  |  - Quy Nhơn / Bình Định    |  - Coordinates & Region  |
|  - Reorder (Up / Down)    |    coastal geography       |  - Best time to shoot    |
|  - Arrival & Duration     |  - Route polyline sequence |  - Drone permission pill |
|  - Remove stop (safe)     |  - Interactive stop pins   |  - Camera angles check   |
|  - "+ Thêm Điểm" CTA      |  - Selection sync          |  - Drive assets card     |
|                           |  - Zoom / Layer controls   |  - Tour link / unlink    |
+-----------------------------------------------------------------------------------+
```

---

## 3. Explicitly Deferred Capabilities (Stage 1 Boundary)

To maintain a clean, resilient, and verifiable Stage 1 foundation, the following capabilities are explicitly deferred:

| Deferred Area | Current Stage 1 Foundation | Production Extension Path |
| :--- | :--- | :--- |
| **Map Provider** | Stylized SVG vector map projecting Quy Nhơn coordinates (13.5°N - 14.3°N) with interactive pins & polyline route sequence. | Leaflet / Mapbox GL / Google Maps JS SDK with vector tile layers. |
| **Google Drive Integration** | Formal schema reference (`drive_reference: { folder_id, folder_url, asset_count }`). | Headless Service Account / OAuth token integration via QN Shared Drive. |
| **Backend & Persistence** | In-memory React state initialized from canonical domain mocks; pure invariant mutation functions (`src/utils/invariants.ts`). | SQLite (via QNCC DB or standalone Node/Bun backend) with REST/WebSocket APIs. |
| **Routing Optimization** | Manual order adjustment via `moveStop` and `reorderTourStops` with sequence preservation. | OSRM / Google Directions API calculating driving travel times across Bình Định roads. |
| **Autonomous AI Scout** | Architecture flags `ai_suggested?: boolean` and `approved_by_human?: boolean`. | Gemini 2.5 Flash copilot proposing stops based on sunrise times and weather. |
| **QNCC Integration** | Standalone web application foundation with clean domain contracts. | Embedded subview or micro-frontend inside Hiển's QNCC Operations Center. |
