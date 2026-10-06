-- Quài Nhơn Location Scout • SQLite • schema v1
-- This file is executed by server/store.mjs; no seed or mock records.
-- IDs are TEXT; timestamps are UTC ISO-8601. Arrays use valid JSON.
-- ScoutLocation 1:N TourStop N:1 Tour. Sequence belongs only to TourStop.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS workspace_meta (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  schema_version INTEGER NOT NULL DEFAULT 1,
  revision INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO workspace_meta(singleton) VALUES (1);
CREATE TABLE IF NOT EXISTS scout_locations (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  region TEXT NOT NULL DEFAULT '',
  latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
  description TEXT NOT NULL DEFAULT '',
  scouting_notes TEXT NOT NULL DEFAULT '',
  camera_angles TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(camera_angles)),
  best_time_to_shoot TEXT NOT NULL DEFAULT '',
  drone_permitted INTEGER NOT NULL DEFAULT 0 CHECK(drone_permitted IN (0,1)),
  drive_reference TEXT NOT NULL DEFAULT '{"asset_count":0}' CHECK(json_valid(drive_reference)),
  tags TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(tags)),
  status TEXT NOT NULL CHECK(status IN ('active','archived')),
  scouting_status TEXT NOT NULL DEFAULT 'not_scouted' CHECK(scouting_status IN ('not_scouted','candidate','scouted','approved')),
  access TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tours (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('draft','planning','approved','completed','archived')),
  production_week TEXT NOT NULL DEFAULT '', target_date TEXT,
  assigned_crew TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(assigned_crew)),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tour_stops (
  id TEXT PRIMARY KEY,
  tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE RESTRICT,
  location_id TEXT NOT NULL REFERENCES scout_locations(id) ON DELETE RESTRICT,
  stop_order INTEGER NOT NULL CHECK(stop_order >= 1),
  target_arrival_time TEXT,
  planned_duration_minutes INTEGER NOT NULL CHECK(planned_duration_minutes >= 0),
  focus_scenes TEXT NOT NULL DEFAULT '', notes TEXT,
  status TEXT NOT NULL CHECK(status IN ('scheduled','arrived','filmed','skipped')),
  ai_suggested INTEGER NOT NULL DEFAULT 0 CHECK(ai_suggested IN (0,1)),
  approved_by_human INTEGER NOT NULL DEFAULT 0 CHECK(approved_by_human IN (0,1)),
  UNIQUE(tour_id, stop_order), UNIQUE(tour_id, location_id)
);
CREATE INDEX IF NOT EXISTS tour_stops_location ON tour_stops(location_id);
CREATE TABLE IF NOT EXISTS location_photos (
  id TEXT PRIMARY KEY, location_id TEXT NOT NULL REFERENCES scout_locations(id),
  position INTEGER NOT NULL, url TEXT NOT NULL, caption TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS location_checklist (
  id TEXT PRIMARY KEY, location_id TEXT NOT NULL REFERENCES scout_locations(id),
  position INTEGER NOT NULL, label TEXT NOT NULL, done INTEGER NOT NULL CHECK(done IN (0,1))
);
CREATE TABLE IF NOT EXISTS location_history (
  id TEXT PRIMARY KEY, location_id TEXT NOT NULL REFERENCES scout_locations(id),
  at TEXT NOT NULL, action TEXT NOT NULL
);
-- API writes are transactional and use workspace_meta.revision for conflict detection.
-- Tour records cannot be hard-deleted through the API. Locations may be explicitly deleted after their tour stops and details are removed transactionally.
-- drive_reference stores folder_id/folder_url/asset_count/last_synced_at only;
-- referenced Drive content is not duplicated or claimed as synchronized.
-- Small, normalized JPEG scout captures; immutable content-addressed assets.
CREATE TABLE IF NOT EXISTS scout_photo_assets (
  id TEXT PRIMARY KEY,
  bytes BLOB NOT NULL CHECK(length(bytes) <= 1000000),
  created_at TEXT NOT NULL
);

-- Short video metadata and immutable assets. 1 MB chunks support local SQLite and D1.
CREATE TABLE IF NOT EXISTS location_videos (id TEXT PRIMARY KEY, location_id TEXT NOT NULL REFERENCES scout_locations(id), position INTEGER NOT NULL, url TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '', duration REAL NOT NULL CHECK(duration>0 AND duration<=15));
CREATE TABLE IF NOT EXISTS scout_video_assets (id TEXT PRIMARY KEY, mime TEXT NOT NULL, duration REAL NOT NULL, size INTEGER NOT NULL CHECK(size<=20000000), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS scout_video_chunks (asset_id TEXT NOT NULL REFERENCES scout_video_assets(id), position INTEGER NOT NULL, bytes BLOB NOT NULL CHECK(length(bytes)<=1000000), PRIMARY KEY(asset_id,position));
