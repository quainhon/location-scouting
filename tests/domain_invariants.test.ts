import { describe, it, expect } from 'vitest';
import { ScoutLocation, Tour } from '../src/types/scout';
import {
  addStopToTour,
  removeStopFromTour,
  reorderTourStops,
  moveStop,
  archiveLocation,
  restoreLocation,
  hydrateTourStops,
} from '../src/utils/invariants';

describe('Location Scouting Domain Invariants', () => {
  const mockLocation1: ScoutLocation = {
    id: 'loc-1',
    code: 'QN-LOC-001',
    name: 'Bãi Xép — Gành Bà',
    region: 'Quy Nhơn',
    coordinates: { lat: 13.6938, lng: 109.2312 },
    description: 'Bờ biển nguyên sơ rạn đá',
    scouting_notes: 'Flycam đón bình minh',
    camera_angles: ['Bay thấp 15m'],
    best_time_to_shoot: '05:00 - 06:30',
    drone_permitted: true,
    drive_reference: {
      folder_id: 'drive-folder-001',
      folder_url: 'https://drive.google.com/drive/folders/drive-folder-001',
      asset_count: 12,
    },
    tags: ['Bờ Biển', 'Bình Minh'],
    status: 'active',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  };

  const mockLocation2: ScoutLocation = {
    id: 'loc-2',
    code: 'QN-LOC-002',
    name: 'Mũi Vi Rồng',
    region: 'Hoài Hải',
    coordinates: { lat: 14.3012, lng: 109.1124 },
    description: 'Vách đá hình miệng rồng',
    scouting_notes: 'ASMR sóng biển',
    camera_angles: ['Góc rộng mõm đá'],
    best_time_to_shoot: '15:30 - 17:30',
    drone_permitted: true,
    drive_reference: {
      folder_id: 'drive-folder-002',
      folder_url: 'https://drive.google.com/drive/folders/drive-folder-002',
      asset_count: 25,
    },
    tags: ['Hoài Hải', 'Sóng Biển'],
    status: 'active',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  };

  const initialTour: Tour = {
    id: 'tour-101',
    code: 'QN-TOUR-W41',
    title: 'Tour Khảo Sát Tuần 41',
    description: 'Tiền trạm bờ biển',
    status: 'planning',
    production_week: '2026-W41',
    assigned_crew: ['Quyền', 'Hiển'],
    stops: [],
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  };

  it('INVARIANT 1: ScoutLocation is independent and reusable across multiple tours', () => {
    // Add loc1 to tour A
    const tourA = addStopToTour(initialTour, mockLocation1);
    expect(tourA.stops).toHaveLength(1);
    expect(tourA.stops[0].location_id).toBe('loc-1');
    expect(tourA.stops[0].stop_order).toBe(1);

    // Add same loc1 to tour B
    const initialTourB: Tour = { ...initialTour, id: 'tour-102', code: 'QN-TOUR-W42' };
    const tourB = addStopToTour(initialTourB, mockLocation1);
    expect(tourB.stops).toHaveLength(1);
    expect(tourB.stops[0].location_id).toBe('loc-1');

    // ScoutLocation itself has NO tour_id or sequence order property
    expect((mockLocation1 as any).tour_id).toBeUndefined();
    expect((mockLocation1 as any).stop_order).toBeUndefined();
  });

  it('INVARIANT 2: Per-tour sequence belongs to TourStop, not ScoutLocation', () => {
    let tour = addStopToTour(initialTour, mockLocation1);
    tour = addStopToTour(tour, mockLocation2);

    expect(tour.stops).toHaveLength(2);
    expect(tour.stops[0].stop_order).toBe(1);
    expect(tour.stops[0].location_id).toBe('loc-1');
    expect(tour.stops[1].stop_order).toBe(2);
    expect(tour.stops[1].location_id).toBe('loc-2');
  });

  it('INVARIANT 3: Removing a TourStop never deletes or mutates ScoutLocation or Drive association', () => {
    let tour = addStopToTour(initialTour, mockLocation1);
    tour = addStopToTour(tour, mockLocation2);
    const stop1Id = tour.stops[0].id;

    // Remove stop 1 from tour
    const updatedTour = removeStopFromTour(tour, stop1Id);

    // Tour has 1 stop left, re-indexed to order 1
    expect(updatedTour.stops).toHaveLength(1);
    expect(updatedTour.stops[0].location_id).toBe('loc-2');
    expect(updatedTour.stops[0].stop_order).toBe(1);

    // Crucial check: mockLocation1 remains completely intact
    expect(mockLocation1.id).toBe('loc-1');
    expect(mockLocation1.status).toBe('active');
    expect(mockLocation1.drive_reference.folder_id).toBe('drive-folder-001');
    expect(mockLocation1.drive_reference.asset_count).toBe(12);
  });

  it('INVARIANT 4: Reordering stops preserves contiguous 1..N order and does not mutate locations', () => {
    let tour = addStopToTour(initialTour, mockLocation1);
    tour = addStopToTour(tour, mockLocation2);
    const [stop1, stop2] = tour.stops;

    // Move stop2 up
    const movedTour = moveStop(tour, stop2.id, 'up');
    expect(movedTour.stops[0].id).toBe(stop2.id);
    expect(movedTour.stops[0].stop_order).toBe(1);
    expect(movedTour.stops[1].id).toBe(stop1.id);
    expect(movedTour.stops[1].stop_order).toBe(2);

    // Reorder explicitly
    const reorderedTour = reorderTourStops(tour, [stop2.id, stop1.id]);
    expect(reorderedTour.stops[0].id).toBe(stop2.id);
    expect(reorderedTour.stops[0].stop_order).toBe(1);
    expect(reorderedTour.stops[1].id).toBe(stop1.id);
    expect(reorderedTour.stops[1].stop_order).toBe(2);
  });

  it('INVARIANT 5: Soft delete / archive is enforced over hard deletion', () => {
    const archived = archiveLocation(mockLocation1);
    expect(archived.status).toBe('archived');
    expect(archived.id).toBe(mockLocation1.id);

    const restored = restoreLocation(archived);
    expect(restored.status).toBe('active');
  });

  it('INVARIANT 6: Hydration links TourStops to ScoutLocations cleanly', () => {
    let tour = addStopToTour(initialTour, mockLocation1);
    tour = addStopToTour(tour, mockLocation2);

    const hydrated = hydrateTourStops(tour, [mockLocation1, mockLocation2]);
    expect(hydrated).toHaveLength(2);
    expect(hydrated[0].location.name).toBe('Bãi Xép — Gành Bà');
    expect(hydrated[1].location.name).toBe('Mũi Vi Rồng');
  });
});
