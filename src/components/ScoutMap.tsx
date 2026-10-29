import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Minus, Plus, MapPin, X, Car, LoaderCircle, Eye, EyeOff, Map as MapIcon, Satellite as SatelliteIcon } from 'lucide-react';
import type { ScoutLocation, HydratedTourStop, GeoPoint } from '../types/scout';
import { fetchDrivingRoute, routeKey, type DrivingRoute } from '../utils/routing';

// Location Scout opens on Quài Nhơn's core scouting area around Hoài Nhơn / Tam Quan.
const QUAI_NHON_CENTER: [number, number] = [14.48, 109.035];
const QUAI_NHON_DESKTOP_ZOOM = 13;
const QUAI_NHON_MOBILE_ZOOM = 12;
export function ScoutMap({ locations, stops, selectedId, onSelect, onCreateDraft, draftPoint, fitSignal, pickSignal = 0, showThumbnails = false, focusSelected = true, compactControls = false, pendingIds }: { locations: ScoutLocation[]; stops: HydratedTourStop[]; selectedId: string; onSelect: (id: string) => void; onCreateDraft: (point: GeoPoint) => void; draftPoint: GeoPoint | null; fitSignal: number; pickSignal?: number; showThumbnails?: boolean; focusSelected?: boolean; compactControls?: boolean; pendingIds?: ReadonlySet<string> }) {
  const root = useRef<HTMLDivElement>(null); const map = useRef<L.Map | null>(null);
  const [layer, setLayer] = useState<'satellite' | 'map'>('map');
  const mobileFallbackAttempted = useRef(false);
  const [tileError, setTileError] = useState(false); const [tileNotice, setTileNotice] = useState('');
  const [retry, setRetry] = useState(0); const [routeRetry, setRouteRetry] = useState(0);
  const [placing, setPlacing] = useState(false); const placingRef = useRef(false); placingRef.current = placing;
  useEffect(() => { if (pickSignal) setPlacing(true); }, [pickSignal]);
  const [zoom, setZoom] = useState(12);
  const [routing, setRouting] = useState<{ key: string; route?: DrivingRoute; error?: string }>({ key: '' });
  const [routeVisible, setRouteVisible] = useState(true);
  const select = useRef(onSelect); select.current = onSelect;
  const createDraft = useRef(onCreateDraft); createDraft.current = onCreateDraft;
  const stopsRef = useRef(stops); stopsRef.current = stops;
  const locationsRef = useRef(locations); locationsRef.current = locations;
  const coordinates = stops.map(s => s.location.coordinates); const key = routeKey(coordinates);
  useEffect(() => { setRouteVisible(true); }, [key]);
  const activeRoute = routeVisible && routing.key === key ? routing.route : undefined;
  const routingError = routeVisible && routing.key === key ? routing.error : undefined;
  const routeRef = useRef(activeRoute); routeRef.current = activeRoute;
  useEffect(() => {
    if (!root.current) return;
    const mobileViewport = window.matchMedia('(max-width: 650px)').matches;
    const instance = L.map(root.current, { zoomControl: false, dragging: true, touchZoom: true, scrollWheelZoom: true, doubleClickZoom: true, minZoom: 3, maxZoom: 20 }).setView(QUAI_NHON_CENTER, mobileViewport ? QUAI_NHON_MOBILE_ZOOM : QUAI_NHON_DESKTOP_ZOOM);
    map.current = instance;
    instance.on('zoomend', () => setZoom(instance.getZoom()));
    instance.on('click', (event: L.LeafletMouseEvent) => {
      if (!placingRef.current) return;
      setPlacing(false); createDraft.current({ lat: event.latlng.lat, lng: event.latlng.lng });
    });
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
    let live = true;
    let loaded = false;
    let errorCount = 0;
    let fallbackTimer: number | undefined;
    const fallbackOrReportError = () => {
      if (!live || loaded) return;
      if (layer === 'map' && !mobileFallbackAttempted.current) {
        mobileFallbackAttempted.current = true;
        setTileNotice('Bản đồ đường phố tải quá lâu. Đã chuyển sang Satellite.');
        setLayer('satellite');
      } else {
        setTileError(true);
      }
    };
    const tile = layer === 'satellite'
      ? L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false', { maxNativeZoom: 17, maxZoom: 20, attribution: 'Tiles © Esri — Esri, Maxar, Earthstar Geographics, GIS User Community' })
      : L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxNativeZoom: 19, maxZoom: 20, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
    tile.on('tileload', () => {
      if (!live) return;
      loaded = true;
      window.clearTimeout(fallbackTimer);
      setTileError(false);
    });
    tile.on('tileerror', () => {
      if (!live || loaded) return;
      errorCount += 1;
      if (errorCount >= 3) fallbackOrReportError();
    });
    tile.addTo(map.current);
    // Desktop previously had no tile watchdog. If requests stall instead of erroring,
    // Leaflet stays blank forever. Apply the same failover to desktop and mobile.
    fallbackTimer = window.setTimeout(fallbackOrReportError, 6500);
    return () => { live = false; window.clearTimeout(fallbackTimer); tile.remove(); };
  }, [layer, retry]);
  useEffect(() => {
    if (!routeVisible || coordinates.length < 2) { setRouting({ key }); return; }
    const controller = new AbortController(); let timedOut = false;
    setRouting({ key });
    const timer = setTimeout(() => {
      const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
      void fetchDrivingRoute(coordinates, controller.signal).then(route => { if (!controller.signal.aborted) setRouting({ key, route }); }).catch(error => {
        if (!controller.signal.aborted || timedOut) setRouting({ key, error: timedOut ? 'Tính đường quá lâu. Hãy thử lại.' : error.message });
      }).finally(() => clearTimeout(timeout));
    }, 1100);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, routeRetry, routeVisible]);
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
      const pending = pendingIds?.has(l.id) || false;
      const photoUrl = showThumbnails && stop ? l.photos?.[0]?.url : undefined;
      const markerBody = document.createElement('span');
      markerBody.className = `pin ${photoUrl ? 'route-thumb-pin' : ''} ${selectedId === l.id ? 'selected' : ''} ${!stop ? 'library-pin' : ''} ${pending ? 'pending' : ''}`;
      if (photoUrl) {
        const image = document.createElement('img');
        image.src = photoUrl; image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
        markerBody.appendChild(image);
        const order = document.createElement('span');
        order.className = 'pin-order'; order.textContent = String(stop?.stop_order || '');
        markerBody.appendChild(order);
      } else {
        const order = document.createElement('span');
        order.textContent = String(stop?.stop_order || '•');
        markerBody.appendChild(order);
      }
      const icon = L.divIcon({ className: 'map-marker', html: markerBody, iconSize: photoUrl ? [44, 52] : [38, 48], iconAnchor: photoUrl ? [22, 46] : [19, 46] });
      const tooltip = document.createElement('span'); tooltip.textContent = pending ? `${l.name} · Chờ đồng bộ` : l.name;
      L.marker([l.coordinates.lat, l.coordinates.lng], { icon, title: tooltip.textContent, keyboard: true, bubblingMouseEvents: false }).bindTooltip(tooltip, { direction: 'right', offset: [18, -20] }).on('click', () => select.current(l.id)).addTo(group);
    });
    if (draftPoint) {
      const icon = L.divIcon({ className: 'map-marker', html: '<span class="pin draft-pin"><span>+</span></span>', iconSize: [38, 48], iconAnchor: [19, 46] });
      L.marker([draftPoint.lat, draftPoint.lng], { icon, keyboard: false, interactive: false }).addTo(group);
    }
    return () => { group.remove(); };
  }, [locations, stops, selectedId, draftPoint, showThumbnails, pendingIds]);
  function fit() {
    const instance = map.current; if (!instance) return;
    const points = stopsRef.current.length ? stopsRef.current.map(s => s.location) : locationsRef.current.filter(l => l.status === 'active');
    const latlngs: [number, number][] = points.map(l => [l.coordinates.lat, l.coordinates.lng]);
    if (routeVisible && routeRef.current) latlngs.push(...routeRef.current.points);
    if (latlngs.length) instance.fitBounds(L.latLngBounds(latlngs), { paddingTopLeft: [40, 135], paddingBottomRight: [50, 140], maxZoom: points.length === 1 ? 17 : 16 });
    else instance.setView(QUAI_NHON_CENTER, window.matchMedia('(max-width: 650px)').matches ? QUAI_NHON_MOBILE_ZOOM : QUAI_NHON_DESKTOP_ZOOM);
  }
  useEffect(() => { fit(); }, [fitSignal, key, routeVisible]);
  // A selection focuses closely without continually resetting the user's pan/zoom.
  const selected = locations.find(l => l.id === selectedId);
  useEffect(() => { if (focusSelected && selected) map.current?.setView([selected.coordinates.lat, selected.coordinates.lng], Math.max(map.current.getZoom(), 17), { animate: false }); }, [focusSelected, selectedId, selected?.coordinates.lat, selected?.coordinates.lng]);
  return <>
    {/* Keep className stable: Leaflet owns runtime classes on this element. */}
    <div className="leaflet-root" data-placing={placing || undefined} ref={root} aria-label="Bản đồ tương tác: kéo để di chuyển, chụm hai ngón để zoom" />
    <div className="map-layers"><button className={layer === 'map' ? 'active' : ''} aria-label="Bản đồ" title="Bản đồ" aria-pressed={layer === 'map'} onClick={() => { mobileFallbackAttempted.current = false; setLayer('map'); setTileNotice(''); }}>{compactControls ? <MapIcon size={20} aria-hidden="true" /> : 'Map'}</button><button className={layer === 'satellite' ? 'active' : ''} aria-label="Vệ tinh" title="Vệ tinh" aria-pressed={layer === 'satellite'} onClick={() => { mobileFallbackAttempted.current = true; setLayer('satellite'); setTileNotice(''); }}>{compactControls ? <SatelliteIcon size={20} aria-hidden="true" /> : 'Satellite'}</button>{stops.length >= 2 && <button className={routeVisible ? 'active' : ''} aria-label={routeVisible ? 'Tắt tuyến đường' : 'Bật tuyến đường'} title={routeVisible ? 'Ẩn tuyến đường' : 'Hiện tuyến đường'} aria-pressed={routeVisible} onClick={() => setRouteVisible(visible => !visible)}>{compactControls ? routeVisible ? <Eye size={20} aria-hidden="true" /> : <EyeOff size={20} aria-hidden="true" /> : routeVisible ? 'Ẩn tuyến' : 'Hiện tuyến'}</button>}</div>
    <button className={`place-pin-button ${placing ? 'active' : ''}`} onClick={() => setPlacing(v => !v)} aria-pressed={placing} aria-label={placing ? 'Hủy đặt pin' : 'Đặt pin trên bản đồ'} title={placing ? 'Hủy đặt pin' : 'Đặt pin trên bản đồ'}>{placing ? <X size={20} aria-hidden="true" /> : <MapPin size={20} aria-hidden="true" />}{!compactControls && (placing ? 'Hủy' : 'Đặt pin')}</button>
    {placing && <div className="placing-hint" role="status">Kéo / zoom để tìm vị trí, rồi nhấp hoặc chạm bản đồ để đặt pin.</div>}
    <div className="map-controls"><button aria-label="Xem toàn bộ lộ trình" title="Xem toàn bộ lộ trình" onClick={fit}><LocateFixed size={21} /></button><div><button aria-label="Phóng to" disabled={zoom >= 20} onClick={() => map.current?.zoomIn()}><Plus size={23} /></button><button aria-label="Thu nhỏ" disabled={zoom <= 3} onClick={() => map.current?.zoomOut()}><Minus size={23} /></button></div></div>
    {(tileError || tileNotice) && <div className="map-error" role="status">{tileError ? 'Chưa tải được bản đồ. Kiểm tra kết nối mạng.' : tileNotice}{tileError && <button onClick={() => { mobileFallbackAttempted.current = false; setTileNotice(''); setRetry(n => n + 1); }}>Thử lại bản đồ</button>}<button aria-label="Đóng thông báo bản đồ" onClick={() => { setTileError(false); setTileNotice(''); }}><X size={14} /></button></div>}
    {routeVisible && stops.length >= 2 && <div className="route-summary" role="status">{activeRoute ? <><strong><Car size={16} />Ô tô · {(activeRoute.distance / 1000).toFixed(1)} km · ~{Math.max(1, Math.round(activeRoute.duration / 60))} phút đi</strong>{activeRoute.offRoad && <span>Một số pin cách đường ô tô trên 150 m; cần đi bộ đoạn cuối.</span>}</> : routingError ? <><span>{routingError}</span><button onClick={() => setRouteRetry(n => n + 1)}>Thử lại tuyến</button></> : <strong><LoaderCircle className="spin" size={16} />Đang tính tuyến ô tô…</strong>}<small>OSRM / FOSSGIS · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> · <a href="https://www.openstreetmap.org/" target="_blank" rel="noreferrer">Sửa bản đồ</a></small></div>}
  </>;
}
