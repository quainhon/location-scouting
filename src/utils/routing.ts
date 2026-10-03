import type { GeoPoint } from '../types/scout';
export interface DrivingRoute { points: [number, number][]; distance: number; duration: number; offRoad: boolean }
export const ROUTING_BASE = 'https://routing.openstreetmap.de/routed-car/route/v1/driving/';
export function routeKey(points: GeoPoint[]): string { return points.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';'); }
export function drivingUrl(points: GeoPoint[]): string {
  if (points.length < 2 || points.length > 100 || points.some(p => !Number.isFinite(p.lat) || Math.abs(p.lat) > 90 || !Number.isFinite(p.lng) || Math.abs(p.lng) > 180)) throw new Error('Tuyến cần từ 2 đến 100 điểm có tọa độ hợp lệ.');
  return `${ROUTING_BASE}${routeKey(points)}?overview=full&geometries=geojson&steps=false&alternatives=false&generate_hints=false&radiuses=${points.map(() => 1000).join(';')}`;
}
export function parseDrivingRoute(payload: unknown): DrivingRoute {
  const data = payload as { code?: string; routes?: { distance: number; duration: number; geometry: { type: string; coordinates: number[][] } }[]; waypoints?: { distance: number }[] };
  if (!data || data.code !== 'Ok' || !data.routes?.[0]) throw new Error('Không tìm được đường ô tô giữa các điểm. Kiểm tra vị trí pin gần đường vào.');
  const route = data.routes[0]; const coords = route.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2 || route.geometry.type !== 'LineString' || !Number.isFinite(route.distance) || route.distance < 0 || !Number.isFinite(route.duration) || route.duration < 0 || coords.some(p => !Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90)) throw new Error('Dịch vụ trả về tuyến đường không hợp lệ.');
  return { points: coords.map(p => [p[1], p[0]]), distance: route.distance, duration: route.duration, offRoad: !!data.waypoints?.some(p => p.distance > 150) };
}
const cache = new Map<string, { at: number; route: DrivingRoute }>();
let nextRequestAt = 0;
export async function fetchDrivingRoute(points: GeoPoint[], signal: AbortSignal): Promise<DrivingRoute> {
  const key = routeKey(points); const saved = cache.get(key);
  if (saved && Date.now() - saved.at < 600000) return saved.route;
  const url = drivingUrl(points);
  const delay = Math.max(0, nextRequestAt - Date.now()); nextRequestAt = Date.now() + delay + 1100;
  await new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, delay);
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
  signal.throwIfAborted();
  const response = await fetch(url, { signal });
  const payload: unknown = await response.json();
  if (!response.ok) throw new Error('Dịch vụ tính đường đang bận. Hãy thử lại.');
  const route = parseDrivingRoute(payload);
  if (cache.size >= 40) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), route }); return route;
}
