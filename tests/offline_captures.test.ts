import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { ScoutLocation } from '../src/types/scout';
import { listQueuedCaptures, MAX_SYNC_RETRY_DELAY_MS, recordQueuedCaptureFailure, removeQueuedCapture, saveQueuedCapture, syncRetryDelayMs, type QueuedCapture } from '../src/utils/offlineCaptures';

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

  it('persists failure details and schedules bounded exponential retries without dropping the capture', async () => {
    const queued = capture('retry-me', '2026-10-28T10:03:00.000Z', 'photo-bytes');
    await saveQueuedCapture(queued);

    const firstFailure = await recordQueuedCaptureFailure(queued.id, 'Kết nối bị gián đoạn.', 1000);
    expect(firstFailure).toMatchObject({ retryCount: 1, nextAttemptAt: 2000, lastError: 'Kết nối bị gián đoạn.' });
    expect((await listQueuedCaptures()).map(item => item.id)).toEqual(['retry-me']);

    const secondFailure = await recordQueuedCaptureFailure(queued.id, 'Kết nối bị gián đoạn.', 2000);
    expect(secondFailure).toMatchObject({ retryCount: 2, nextAttemptAt: 4000 });
    expect(await (await listQueuedCaptures())[0].photos[0].blob.text()).toBe('photo-bytes');
  });

  it('caps retry delays so a long outage does not overflow the timer', () => {
    expect(syncRetryDelayMs(1)).toBe(1000);
    expect(syncRetryDelayMs(2)).toBe(2000);
    expect(syncRetryDelayMs(3)).toBe(4000);
    expect(syncRetryDelayMs(100)).toBe(MAX_SYNC_RETRY_DELAY_MS);
  });
});
