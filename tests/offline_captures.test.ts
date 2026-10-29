import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { ScoutLocation } from '../src/types/scout';
import { listQueuedCaptures, removeQueuedCapture, saveQueuedCapture, type QueuedCapture } from '../src/utils/offlineCaptures';

const location = (id: string, createdAt: string): ScoutLocation => ({
  id,
  code: `QN-${id}`,
  name: id,
  region: '',
  coordinates: { lat: 14.4, lng: 109 },
  description: '',
  scouting_notes: '',
  camera_angles: [],
  best_time_to_shoot: '',
  drone_permitted: false,
  drive_reference: { asset_count: 0 },
  tags: [],
  status: 'active',
  scouting_status: 'not_scouted',
  access: '',
  photos: [],
  videos: [],
  checklist: [],
  history: [],
  created_at: createdAt,
  updated_at: createdAt,
});

function capture(id: string, createdAt: string, bytes: string): QueuedCapture {
  return {
    id,
    createdAt,
    location: location(id, createdAt),
    photos: [{ id: `photo-${id}`, name: `${id}.jpg`, blob: new Blob([bytes], { type: 'image/jpeg' }) }],
    videos: [],
  };
}

describe('offline capture storage', () => {
  it('retains photo Blobs, lists captures in creation order, and removes only confirmed IDs', async () => {
    const later = capture('offline-later', '2026-10-28T10:02:00.000Z', 'later-photo-bytes');
    const earlier = capture('offline-earlier', '2026-10-28T10:01:00.000Z', 'earlier-photo-bytes');
    await saveQueuedCapture(later);
    await saveQueuedCapture(earlier);

    const queued = await listQueuedCaptures();
    expect(queued.map(item => item.id)).toEqual(['offline-earlier', 'offline-later']);
    expect(await queued[0].photos[0].blob.text()).toBe('earlier-photo-bytes');
    expect(queued[0].location.id).toBe(queued[0].id);

    await removeQueuedCapture('offline-earlier');
    expect((await listQueuedCaptures()).map(item => item.id)).toEqual(['offline-later']);
  });
});
