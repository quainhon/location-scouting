import { ScoutLocation, Tour, TourStop, HydratedTourStop } from '../types/scout';

/**
 * Domain Invariant 1:
 * Adding a stop to a Tour attaches the ScoutLocation by reference via `location_id`.
 * The per-tour sequence is strictly tracked via `stop_order`.
 */
export function addStopToTour(
  tour: Tour,
  location: ScoutLocation,
  params: {
    planned_duration_minutes?: number;
    focus_scenes?: string;
    target_arrival_time?: string;
    notes?: string;
  } = {}
): Tour {
  // Check if already in tour
  const exists = tour.stops.some((s) => s.location_id === location.id);
  if (exists || location.status === 'archived') {
    return tour;
  }

  const nextOrder = tour.stops.length + 1;
  const newStop: TourStop = {
    id: crypto.randomUUID(),
    tour_id: tour.id,
    location_id: location.id,
    stop_order: nextOrder,
    planned_duration_minutes: params.planned_duration_minutes ?? 45,
    focus_scenes: params.focus_scenes ?? location.scouting_notes.slice(0, 60),
    target_arrival_time: params.target_arrival_time,
    notes: params.notes,
    status: 'scheduled',
    ai_suggested: false,
    approved_by_human: true,
  };

  return {
    ...tour,
    stops: [...tour.stops, newStop],
    updated_at: new Date().toISOString(),
  };
}

/**
 * Domain Invariant 2 & 3:
 * Removing a TourStop from a Tour:
 * - Drops the TourStop from the tour's sequence.
 * - Re-indexes remaining stops to ensure contiguous 1..N order.
 * - Leaves the underlying ScoutLocation completely untouched in the library.
 */
export function removeStopFromTour(tour: Tour, stopId: string): Tour {
  const filtered = tour.stops.filter((s) => s.id !== stopId);
  const reindexed = filtered.map((stop, idx) => ({
    ...stop,
    stop_order: idx + 1,
  }));

  return {
    ...tour,
    stops: reindexed,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Domain Invariant 4:
 * Reordering stops updates their `stop_order` within the tour.
 * ScoutLocation objects remain strictly unaffected.
 */
export function reorderTourStops(tour: Tour, orderedStopIds: string[]): Tour {
  const stopMap = new Map(tour.stops.map((s) => [s.id, s]));
  const reordered: TourStop[] = [];

  [...new Set(orderedStopIds)].forEach((id) => {
    const stop = stopMap.get(id);
    if (stop) {
      reordered.push({
        ...stop,
        stop_order: reordered.length + 1,
      });
    }
  });

  // Preserve any stops not explicitly listed at the end
  tour.stops.forEach((stop) => {
    if (!orderedStopIds.includes(stop.id)) {
      reordered.push({
        ...stop,
        stop_order: reordered.length + 1,
      });
    }
  });

  return {
    ...tour,
    stops: reordered,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Move a stop up or down in sequence.
 */
export function moveStop(tour: Tour, stopId: string, direction: 'up' | 'down'): Tour {
  const index = tour.stops.findIndex((s) => s.id === stopId);
  if (index === -1) return tour;
  if (direction === 'up' && index === 0) return tour;
  if (direction === 'down' && index === tour.stops.length - 1) return tour;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  const newStops = [...tour.stops];
  const [removed] = newStops.splice(index, 1);
  newStops.splice(targetIndex, 0, removed);

  return {
    ...tour,
    stops: newStops.map((stop, idx) => ({
      ...stop,
      stop_order: idx + 1,
    })),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Domain Invariant 5:
 * Soft delete / Archive:
 * Hard delete is disabled; status transitions to 'archived'.
 */
export function archiveLocation(location: ScoutLocation): ScoutLocation {
  return {
    ...location,
    status: 'archived',
    updated_at: new Date().toISOString(),
  };
}

export function restoreLocation(location: ScoutLocation): ScoutLocation {
  return {
    ...location,
    status: 'active',
    updated_at: new Date().toISOString(),
  };
}

/**
 * Hydrates tour stops by linking their referenced ScoutLocations.
 */
export function hydrateTourStops(
  tour: Tour,
  locations: ScoutLocation[]
): HydratedTourStop[] {
  const locMap = new Map(locations.map((l) => [l.id, l]));
  const sortedStops = [...tour.stops].sort((a, b) => a.stop_order - b.stop_order);

  return sortedStops
    .map((stop) => {
      const location = locMap.get(stop.location_id);
      if (!location) return null;
      return {
        ...stop,
        location,
      };
    })
    .filter((s): s is HydratedTourStop => s !== null);
}

/** Builds one independent tour from a user's ordered selection; never mutates the library. */
export function populateTour(tour: Tour, locations: ScoutLocation[], selectedIds: string[]): Tour {
  const uniqueIds = [...new Set(selectedIds)];
  if (!uniqueIds.length) throw new Error('Hãy chọn ít nhất một spot.');
  return uniqueIds.reduce((next, id) => {
    const location = locations.find(l => l.id === id && l.status === 'active');
    if (!location) throw new Error('Một spot đã bị lưu trữ hoặc không còn tồn tại. Hãy chọn lại.');
    return addStopToTour(next, location);
  }, tour);
}

