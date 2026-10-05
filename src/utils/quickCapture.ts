import type { GeoPoint, ScoutLocation } from '../types/scout';

export const impressions = [
  { value: 'great', icon: '😍', label: 'Rất đẹp' },
  { value: 'good', icon: '👍', label: 'Tốt' },
  { value: 'maybe', icon: '🤔', label: 'Cân nhắc' },
  { value: 'no', icon: '👎', label: 'Không hợp' },
] as const;

export function createQuickCapture(point: GeoPoint, name: string, notes: string, rating: string): ScoutLocation {
  if (!Number.isFinite(point.lat) || Math.abs(point.lat) > 90 || !Number.isFinite(point.lng) || Math.abs(point.lng) > 180) throw new Error('Cần chọn vị trí hợp lệ.');
  const id = crypto.randomUUID();
  const at = new Date().toISOString();
  return {
    id, code: `QN-LOC-${id.slice(0, 8).toUpperCase()}`,
    name: name.trim() || `Scout #${id.slice(0, 6).toUpperCase()}`,
    coordinates: point, region: '', description: '', scouting_notes: notes.trim(),
    camera_angles: [], best_time_to_shoot: '', drone_permitted: false,
    drive_reference: { asset_count: 0 }, tags: impressions.some(i => i.value === rating) ? [`scout:rating:${rating}`] : [],
    status: 'active', scouting_status: 'not_scouted', access: '', photos: [], checklist: [],
    history: [{ id: crypto.randomUUID(), at, action: 'Lưu nhanh từ mobile' }], created_at: at, updated_at: at,
  };
}

export function isToday(at: string, today = new Date()): boolean {
  return new Date(at).toLocaleDateString() === today.toLocaleDateString();
}

export function scoutLabel(location: ScoutLocation): string {
  return location.scouting_status === 'approved' ? 'Giữ lại' : location.scouting_status === 'scouted' ? 'Đã khảo sát' : 'Cần xem lại';
}
