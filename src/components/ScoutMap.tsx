import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Minus, Plus } from 'lucide-react';
import type { ScoutLocation, HydratedTourStop, GeoPoint } from '../types/scout';
export function ScoutMap({ locations, stops, selectedId, onSelect, onCreateDraft, draftPoint, fitSignal }: { locations: ScoutLocation[]; stops: HydratedTourStop[]; selectedId: string; onSelect: (id: string) => void; onCreateDraft: (point: GeoPoint) => void; draftPoint: GeoPoint | null; fitSignal: number }) {
  const root = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [layer, setLayer] = useState<'satellite' | 'map'>('satellite');
  const [tileError, setTileError] = useState(false);
  const [retry, setRetry] = useState(0);
  const select = useRef(onSelect); select.current = onSelect;
  const createDraft = useRef(onCreateDraft); createDraft.current = onCreateDraft;
  useEffect(() => {
    if (!root.current) return;
    const instance = L.map(root.current, { zoomControl: false }).setView([14.03, 109.17], 9);
    map.current = instance;
    instance.on('click', (event: L.LeafletMouseEvent) => createDraft.current({ lat: event.latlng.lat, lng: event.latlng.lng }));
    const observer = new ResizeObserver(() => instance.invalidateSize()); observer.observe(root.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    setTileError(false);
    const tile = layer === 'satellite' ? L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles © Esri — Esri, Maxar, Earthstar Geographics, GIS User Community' }) : L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
    tile.on('tileerror', () => setTileError(true)); tile.addTo(map.current);
    return () => { tile.remove(); };
  }, [layer, retry]);
  useEffect(() => {
    if (!map.current) return;
    const group = L.layerGroup().addTo(map.current);
    if (stops.length > 1) L.polyline(stops.map(s => [s.location.coordinates.lat, s.location.coordinates.lng]), { color: '#078aff', weight: 4, opacity: .95, dashArray: '8 8' }).addTo(group);
    locations.filter(l => l.status === 'active' || stops.some(s => s.location_id === l.id)).forEach(l => {
      const stop = stops.find(s => s.location_id === l.id);
      const icon = L.divIcon({ className: 'map-marker', html: `<span class="pin ${selectedId === l.id ? 'selected' : ''} ${!stop ? 'library-pin' : ''}"><span>${stop?.stop_order || '•'}</span></span>`, iconSize: [38, 48], iconAnchor: [19, 46] });
      const tooltip = document.createElement('span'); tooltip.textContent = l.name;
      L.marker([l.coordinates.lat, l.coordinates.lng], { icon, title: l.name, keyboard: true, bubblingMouseEvents: false }).bindTooltip(tooltip, { direction: 'right', offset: [18, -20] }).on('click', () => select.current(l.id)).addTo(group);
    });
    if (draftPoint) {
      const draftIcon = L.divIcon({ className: 'map-marker', html: '<span class="pin draft-pin"><span>+</span></span>', iconSize: [38, 48], iconAnchor: [19, 46] });
      const draftTooltip = document.createElement('span'); draftTooltip.textContent = 'Điểm mới — chưa lưu';
      L.marker([draftPoint.lat, draftPoint.lng], { icon: draftIcon, keyboard: false, interactive: false }).bindTooltip(draftTooltip, { permanent: false, direction: 'right', offset: [18, -20] }).addTo(group);
    }
    return () => { group.remove(); };
  }, [locations, stops, selectedId, draftPoint]);
  function fit() {
    const points = stops.length ? stops.map(s => s.location) : locations.filter(l => l.status === 'active');
    if (points.length) map.current?.fitBounds(L.latLngBounds(points.map(l => [l.coordinates.lat, l.coordinates.lng])), { padding: [65, 85], maxZoom: 14 });
    else map.current?.setView([14.03, 109.17], 9);
  }
  const fitKey = stops.map(s => s.location_id).join(',');
  useEffect(() => { fit(); }, [fitSignal, fitKey]);
  useEffect(() => { const selected = locations.find(l => l.id === selectedId); if (selected) map.current?.panTo([selected.coordinates.lat, selected.coordinates.lng]); }, [selectedId]);
  return <><div className="leaflet-root" ref={root} /><div className="map-layers"><button className={layer === 'map' ? 'active' : ''} onClick={() => setLayer('map')}>Map</button><button className={layer === 'satellite' ? 'active' : ''} onClick={() => setLayer('satellite')}>Satellite</button></div><div className="map-controls"><button aria-label="Xem toàn bộ lộ trình" title="Xem toàn bộ lộ trình" onClick={fit}><LocateFixed size={21} /></button><div><button aria-label="Phóng to" onClick={() => map.current?.zoomIn()}><Plus size={23} /></button><button aria-label="Thu nhỏ" onClick={() => map.current?.zoomOut()}><Minus size={23} /></button></div></div>{tileError && <div className="map-error" role="status">Không tải được một số ô bản đồ. Kiểm tra mạng hoặc đổi lớp bản đồ.<button onClick={() => setRetry(n => n + 1)}>Thử lại</button></div>}</>;
}
