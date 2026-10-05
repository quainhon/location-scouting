import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Minus, Plus, MapPin, X, Car, LoaderCircle } from 'lucide-react';
import type { ScoutLocation, HydratedTourStop, GeoPoint } from '../types/scout';
import { fetchDrivingRoute, routeKey, type DrivingRoute } from '../utils/routing';
export function ScoutMap({ locations, stops, selectedId, onSelect, onCreateDraft, draftPoint, fitSignal, pickSignal = 0 }: { locations: ScoutLocation[]; stops: HydratedTourStop[]; selectedId: string; onSelect: (id: string) => void; onCreateDraft: (point: GeoPoint) => void; draftPoint: GeoPoint | null; fitSignal: number; pickSignal?: number }) {
  const root = useRef<HTMLDivElement>(null); const map = useRef<L.Map | null>(null);
  const [layer, setLayer] = useState<'satellite' | 'map'>('map');
  const mobileFallbackAttempted = useRef(false);
  const [tileError, setTileError] = useState(false); const [tileNotice, setTileNotice] = useState('');
  const [retry, setRetry] = useState(0); const [routeRetry, setRouteRetry] = useState(0);
  const [placing, setPlacing] = useState(false); const placingRef = useRef(false); placingRef.current = placing;
  useEffect(() => { if (pickSignal) setPlacing(true); }, [pickSignal]);
  const [zoom, setZoom] = useState(12);
  const [routing, setRouting] = useState<{ key: string; route?: DrivingRoute; error?: string }>({ key: '' });
  const select = useRef(onSelect); select.current = onSelect;
  const createDraft = useRef(onCreateDraft); createDraft.current = onCreateDraft;
  const stopsRef = useRef(stops); stopsRef.current = stops;
  const locationsRef = useRef(locations); locationsRef.current = locations;
  const coordinates = stops.map(s => s.location.coordinates); const key = routeKey(coordinates);
  const activeRoute = routing.key === key ? routing.route : undefined;
  const routingError = routing.key === key ? routing.error : undefined;
  const routeRef = useRef(activeRoute); routeRef.current = activeRoute;
  useEffect(() => {
    if (!root.current) return;
    const instance = L.map(root.current, { zoomControl: false, dragging: true, touchZoom: true, scrollWheelZoom: true, doubleClickZoom: true, minZoom: 3, maxZoom: 20 }).setView([13.776, 109.223], 12);
    map.current = instance;
    instance.on('zoomend', () => setZoom(instance.getZoom()));
    instance.on('click', (event: L.LeafletMouseEvent) => {
      if (!placingRef.current) return;
      setPlacing(false); createDraft.current({ lat: event.latlng.lat, lng: event.latlng.lng });
    });
    const mobileViewport = window.matchMedia('(max-width: 650px)').matches;
    let delayedResize: number | undefined;
    const refreshMapSize = () => {
      const invalidate = () => {
        if (map.current === instance) instance.invalidateSize({ pan: false, debounceMoveend: mobileViewport });
      };
      if (!mobileViewport) {
        window.requestAnimationFrame(invalidate);
        return;
      }
      window.requestAnimationFrame(() => window.requestAnimationFrame(invalidate));
      window.clearTimeout(delayedResize);
      delayedResize = window.setTimeout(invalidate, 180);
    };
    const observer = new ResizeObserver(refreshMapSize);
    observer.observe(root.current);
    if (mobileViewport) {
      window.addEventListener('orientationchange', refreshMapSize);
      window.addEventListener('pageshow', refreshMapSize);
      window.visualViewport?.addEventListener('resize', refreshMapSize);
    }
    refreshMapSize();
    return () => {
      window.clearTimeout(delayedResize);
      observer.disconnect();
      if (mobileViewport) {
        window.removeEventListener('orientationchange', refreshMapSize);
        window.removeEventListener('pageshow', refreshMapSize);
        window.visualViewport?.removeEventListener('resize', refreshMapSize);
      }
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    setTileError(false);
    let live = true; let failed = false; let loaded = false; let errorCount = 0;
    const mobileViewport = window.matchMedia('(max-width: 650px)').matches;
    let fallbackTimer: number | undefined;
    const switchToSatellite = () => {
      if (!live || failed || mobileFallbackAttempted.current) return;
      failed = true;
      mobileFallbackAttempted.current = true;
      window.clearTimeout(fallbackTimer);
      setTileNotice('Bản đồ đường phố chưa tải được. Đã chuyển sang ảnh vệ tinh.');
      setLayer('satellite');
    };
    const tile = layer === 'satellite'
      ? L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false', { maxNativeZoom: 17, maxZoom: 20, attribution: 'Tiles © Esri — Esri, Maxar, Earthstar Geographics, GIS User Community' })
      : L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxNativeZoom: 19, maxZoom: 20, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
    tile.on('tileload', () => {
      loaded = true;
      window.clearTimeout(fallbackTimer);
    });
    tile.on('tileerror', () => {
      if (!live || failed) return;
      errorCount += 1;
      if (layer === 'map' && mobileViewport) {
        if (errorCount >= 3) switchToSatellite();
      } else if (layer === 'satellite' && mobileViewport) {
        failed = true; setTileError(true);
      } else {
        failed = true;
        if (layer === 'satellite') { setTileNotice('Ảnh vệ tinh chưa có ở đây. Đã chuyển sang bản đồ đường phố.'); setLayer('map'); }
        else setTileError(true);
      }
    });
    tile.addTo(map.current);
    if (layer === 'map' && mobileViewport && !mobileFallbackAttempted.current) {
      fallbackTimer = window.setTimeout(() => {
        if (!loaded) switchToSatellite();
      }, 6000);
    }
    return () => { live = false; window.clearTimeout(fallbackTimer); tile.remove(); };
  }, [layer, retry]);
  useEffect(() => {
    if (coordinates.length < 2) { setRouting({ key }); return; }
    const controller = new AbortController(); let timedOut = false;
    setRouting({ key });
    const timer = setTimeout(() => {
      const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
      void fetchDrivingRoute(coordinates, controller.signal).then(route => { if (!controller.signal.aborted) setRouting({ key, route }); }).catch(error => {
        if (!controller.signal.aborted || timedOut) setRouting({ key, error: timedOut ? 'Tính đường quá lâu. Hãy thử lại.' : error.message });
      }).finally(() => clearTimeout(timeout));
    }, 1100);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, routeRetry]);
  useEffect(() => {
    if (!map.current) return;
    const group = L.layerGroup().addTo(map.current);
    if (activeRoute) L.polyline(activeRoute.points, { color: '#247c99', weight: 5, opacity: .95, interactive: false }).addTo(group);
    return () => { group.remove(); };
  }, [activeRoute]);
  useEffect(() => {
    if (!map.current) return;
    const group = L.layerGroup().addTo(map.current);
    locations.filter(l => l.status === 'active' || stops.some(s => s.location_id === l.id)).forEach(l => {
      const stop = stops.find(s => s.location_id === l.id);
      const icon = L.divIcon({ className: 'map-marker', html: `<span class="pin ${selectedId === l.id ? 'selected' : ''} ${!stop ? 'library-pin' : ''}"><span>${stop?.stop_order || '•'}</span></span>`, iconSize: [38, 48], iconAnchor: [19, 46] });
      const tooltip = document.createElement('span'); tooltip.textContent = l.name;
      L.marker([l.coordinates.lat, l.coordinates.lng], { icon, title: l.name, keyboard: true, bubblingMouseEvents: false }).bindTooltip(tooltip, { direction: 'right', offset: [18, -20] }).on('click', () => select.current(l.id)).addTo(group);
    });
    if (draftPoint) {
      const icon = L.divIcon({ className: 'map-marker', html: '<span class="pin draft-pin"><span>+</span></span>', iconSize: [38, 48], iconAnchor: [19, 46] });
      L.marker([draftPoint.lat, draftPoint.lng], { icon, keyboard: false, interactive: false }).addTo(group);
    }
    return () => { group.remove(); };
  }, [locations, stops, selectedId, draftPoint]);
  function fit() {
    const instance = map.current; if (!instance) return;
    const points = stopsRef.current.length ? stopsRef.current.map(s => s.location) : locationsRef.current.filter(l => l.status === 'active');
    const latlngs: [number, number][] = points.map(l => [l.coordinates.lat, l.coordinates.lng]);
    if (routeRef.current) latlngs.push(...routeRef.current.points);
    if (latlngs.length) instance.fitBounds(L.latLngBounds(latlngs), { paddingTopLeft: [40, 135], paddingBottomRight: [50, 140], maxZoom: points.length === 1 ? 17 : 16 });
    else instance.setView([13.776, 109.223], 12);
  }
  useEffect(() => { fit(); }, [fitSignal, key]);
  // A selection focuses closely without continually resetting the user's pan/zoom.
  const selected = locations.find(l => l.id === selectedId);
  useEffect(() => { if (selected) map.current?.setView([selected.coordinates.lat, selected.coordinates.lng], Math.max(map.current.getZoom(), 17), { animate: false }); }, [selectedId, selected?.coordinates.lat, selected?.coordinates.lng]);
  return <>
    <div className={`leaflet-root ${placing ? 'placing-pin' : ''}`} ref={root} aria-label="Bản đồ tương tác: kéo để di chuyển, chụm hai ngón để zoom" />
    <div className="map-layers"><button className={layer === 'map' ? 'active' : ''} onClick={() => { mobileFallbackAttempted.current = false; setLayer('map'); setTileNotice(''); }}>Map</button><button className={layer === 'satellite' ? 'active' : ''} onClick={() => { mobileFallbackAttempted.current = true; setLayer('satellite'); setTileNotice(''); }}>Satellite</button></div>
    <button className={`place-pin-button ${placing ? 'active' : ''}`} onClick={() => setPlacing(v => !v)} aria-pressed={placing}>{placing ? <X size={16} /> : <MapPin size={16} />}{placing ? 'Hủy đặt pin' : 'Thêm spot trên map'}</button>
    {placing && <div className="placing-hint" role="status">Kéo / zoom để tìm vị trí, rồi chạm để đặt pin.</div>}
    <div className="map-controls"><button aria-label="Xem toàn bộ lộ trình" title="Xem toàn bộ lộ trình" onClick={fit}><LocateFixed size={21} /></button><div><button aria-label="Phóng to" disabled={zoom >= 20} onClick={() => map.current?.zoomIn()}><Plus size={23} /></button><button aria-label="Thu nhỏ" disabled={zoom <= 3} onClick={() => map.current?.zoomOut()}><Minus size={23} /></button></div></div>
    {(tileError || tileNotice) && <div className="map-error" role="status">{tileError ? 'Chưa tải được bản đồ. Kiểm tra kết nối mạng.' : tileNotice}{tileError && <button onClick={() => setRetry(n => n + 1)}>Thử lại bản đồ</button>}<button aria-label="Đóng thông báo bản đồ" onClick={() => { setTileError(false); setTileNotice(''); }}><X size={14} /></button></div>}
    {stops.length >= 2 && <div className="route-summary" role="status">{activeRoute ? <><strong><Car size={16} />Ô tô · {(activeRoute.distance / 1000).toFixed(1)} km · ~{Math.max(1, Math.round(activeRoute.duration / 60))} phút đi</strong>{activeRoute.offRoad && <span>Một số pin cách đường ô tô trên 150 m; cần đi bộ đoạn cuối.</span>}</> : routingError ? <><span>{routingError}</span><button onClick={() => setRouteRetry(n => n + 1)}>Thử lại tuyến</button></> : <strong><LoaderCircle className="spin" size={16} />Đang tính tuyến ô tô…</strong>}<small>OSRM / FOSSGIS · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> · <a href="https://www.openstreetmap.org/" target="_blank" rel="noreferrer">Sửa bản đồ</a></small></div>}
  </>;
}
