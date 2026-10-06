/**
 * Quài Nhơn Location Scout — Domain Model & Invariants
 * 
 * Core Invariant: ScoutLocation -> Tour -> TourStop
 * 1. ScoutLocation is reusable and independent: may exist without a tour, or participate in multiple tours.
 * 2. Per-tour sequence/order belongs to TourStop (`stop_order`), never globally to ScoutLocation.
 * 3. Removing a TourStop never deletes or mutates the underlying ScoutLocation or its Drive association.
 * 4. Archive is reversible; permanent deletion requires explicit confirmation and removes linked tour stops.
 * 5. Google Drive content is referenced (`drive_url`, `folder_id`), never duplicated.
 * 6. AI recommendations require explicit human approval before mutating routes.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface DriveReference {
  folder_id?: string;
  folder_url?: string;
  asset_count: number;
  last_synced_at?: string;
}

export type LocationStatus = 'active' | 'archived';

export interface ScoutLocation {
  id: string;
  code: string; // e.g. "QN-LOC-001"
  name: string;
  region: string; // e.g. "Quy Nhơn", "Hoài Hải", "Phù Cát", "Tuy Phước"
  coordinates: GeoPoint;
  description: string;
  scouting_notes: string;
  camera_angles: string[];
  best_time_to_shoot: string; // e.g. "05:00 - 06:30 (Bình Minh)"
  drone_permitted: boolean;
  drive_reference: DriveReference;
  tags: string[];
  status: LocationStatus;
  created_at: string;
  updated_at: string;
  scouting_status?: 'not_scouted' | 'candidate' | 'scouted' | 'approved';
  access?: string;
  photos?: { id: string; url: string; caption: string }[];
  videos?: { id: string; url: string; caption: string; duration: number }[];
  checklist?: { id: string; label: string; done: boolean }[];
  history?: { id: string; at: string; action: string }[];
}

export type TourStatus = 'draft' | 'planning' | 'approved' | 'completed' | 'archived';

export interface TourStop {
  id: string;
  tour_id: string;
  location_id: string;
  stop_order: number; // 1-indexed order within this specific tour
  target_arrival_time?: string; // e.g. "05:15"
  planned_duration_minutes: number;
  focus_scenes: string;
  notes?: string;
  status: 'scheduled' | 'arrived' | 'filmed' | 'skipped';
  ai_suggested?: boolean;
  approved_by_human?: boolean;
}

export interface Tour {
  id: string;
  code: string; // e.g. "QN-TOUR-2026-W41"
  title: string;
  description: string;
  status: TourStatus;
  production_week: string; // e.g. "2026-W41"
  target_date?: string;
  assigned_crew: string[];
  stops: TourStop[];
  created_at: string;
  updated_at: string;
}

/**
 * Denormalized stop view for UI presentation combining TourStop with its linked ScoutLocation.
 */
export interface HydratedTourStop extends TourStop {
  location: ScoutLocation;
}

/**
 * Extension Boundaries: Explicit definitions for deferred production capabilities.
 */
export interface MapProviderConfig {
  provider: 'mock_canvas' | 'leaflet' | 'google_maps' | 'mapbox';
  api_key_configured: boolean;
}

export interface DriveIntegrationConfig {
  enabled: boolean;
  mode: 'reference_only';
  root_folder_id?: string;
}
