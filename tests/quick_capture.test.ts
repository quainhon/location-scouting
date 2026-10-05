import { describe, expect, it } from 'vitest';
import { createQuickCapture, isToday, scoutLabel } from '../src/utils/quickCapture';

describe('Mobile quick capture', () => {
  it('creates an unnamed standalone location with valid defaults and optional fields empty', () => {
    const location = createQuickCapture({ lat: 13.7, lng: 109.2 }, '', '', '');
    expect(location.name).toMatch(/^Scout #/);
    expect(location.scouting_status).toBe('not_scouted');
    expect(location.photos).toEqual([]);
    expect(location.tags).toEqual([]);
    expect(location.history).toHaveLength(1);
    expect(location).not.toHaveProperty('tour_id');
    expect(Number.isFinite(Date.parse(location.created_at))).toBe(true);
  });
  it('preserves notes and a known impression, rejecting unknown impressions', () => {
    expect(createQuickCapture({ lat: 0, lng: 0 }, ' Beach ', ' Dawn ', 'good')).toMatchObject({ name: 'Beach', scouting_notes: 'Dawn', tags: ['scout:rating:good'] });
    expect(createQuickCapture({ lat: 0, lng: 0 }, '', '', 'invalid').tags).toEqual([]);
  });
  it.each([{ lat: NaN, lng: 0 }, { lat: 91, lng: 0 }, { lat: 0, lng: -181 }])('rejects invalid coordinates %s', point => {
    expect(() => createQuickCapture(point, '', '', '')).toThrow();
  });
  it('uses local calendar dates for Today, and maps legacy review status', () => {
    const today = new Date(2026, 9, 5, 0, 1);
    expect(isToday(new Date(2026, 9, 5, 23, 59).toISOString(), today)).toBe(true);
    expect(isToday(new Date(2026, 9, 4, 23, 59).toISOString(), today)).toBe(false);
    expect(scoutLabel({ ...createQuickCapture({ lat: 0, lng: 0 }, '', '', ''), scouting_status: 'candidate' })).toBe('Cần xem lại');
  });
});
