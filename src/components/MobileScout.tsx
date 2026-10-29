import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowDown, ArrowUp, Check, ChevronRight, ExternalLink, LocateFixed, Map as MapIcon, MapPin, Plus, RefreshCw, Route, Search, Trash2, X } from 'lucide-react';
import type { GeoPoint, ScoutLocation, Tour } from '../types/scout';
import { hydrateTourStops, moveStop, removeStopFromTour } from '../utils/invariants';
import { ScoutMap } from './ScoutMap';
import { createQuickCapture, impressions, isToday, scoutLabel } from '../utils/quickCapture';
import '../scout-mobile.css';
import { AddLocationPhotos, PhotoGallery, PhotoPicker, usePhotoDraft } from './ScoutPhotos';
import { uploadPhotos } from '../utils/photos';
import { TourBuilder } from './MobileTours';
import { AddLocationVideos, VideoGallery, VideoPicker, useVideoDraft } from './ScoutVideos';
import { uploadVideos } from '../utils/videos';
import { googleMapsDirectionsUrl } from '../utils/routing';
import { listQueuedCaptures, recordQueuedCaptureFailure, removeQueuedCapture, saveQueuedCapture, type QueuedCapture } from '../utils/offlineCaptures';

type Props = {
  locations: ScoutLocation[]; tours: Tour[]; activeTourId: string; ready: boolean; busy: boolean; error: string;
  onCreate: (location: ScoutLocation) => Promise<boolean>;
  onCreateTour: (title: string, ids: string[]) => Promise<boolean>;
  onChooseTour: (id: string) => void;
  onUpdateTour: (tour: Tour, locationId?: string, action?: string) => Promise<boolean>;
  onUpdate: (location: ScoutLocation, action: string) => Promise<boolean>;
  onDelete: (location: ScoutLocation) => Promise<boolean>;
  onDeleteTour: (tour: Tour) => Promise<boolean>;
  onEdit: (location: ScoutLocation) => void;
};

export function MobileScout({ locations, tours, activeTourId, ready, busy, error, onCreate, onCreateTour, onChooseTour, onUpdateTour, onUpdate, onDelete, onDeleteTour, onEdit }: Props) {
  const photoDraft = usePhotoDraft();
  const videoDraft = useVideoDraft();
  const [mediaBusy, setMediaBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [queued, setQueued] = useState<QueuedCapture[]>([]);
  const [queuedPhotoPreviews, setQueuedPhotoPreviews] = useState<Record<string, NonNullable<ScoutLocation['photos']>>>({});
  const [syncingId, setSyncingId] = useState('');
  const [online, setOnline] = useState(() => navigator.onLine);
  const [queueAvailable, setQueueAvailable] = useState(() => 'indexedDB' in globalThis);
  const submitLock = useRef(false);
  const syncLock = useRef(false);
  const queueRetryTimer = useRef<number | undefined>(undefined);
  const onCreateRef = useRef(onCreate); onCreateRef.current = onCreate;
  const working = busy || mediaBusy || uploading;
  const [page, setPage] = useState<'map' | 'route' | 'library'>('map');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [routeMapOpen, setRouteMapOpen] = useState(false);
  const [routeSelectedId, setRouteSelectedId] = useState('');
  const [routeReorderOpen, setRouteReorderOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [capture, setCapture] = useState(false);
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [gps, setGps] = useState('');
  const [locating, setLocating] = useState(false);
  const [rating, setRating] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState('');
  const [fit, setFit] = useState(0);
  const [pickSignal, setPickSignal] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const routeDialog = useRef<HTMLDialogElement>(null);
  const gpsRequest = useRef(0);
  const captureId = useRef<ScoutLocation | null>(null);
  const active = locations.filter(l => l.status === 'active');
  const availableTours = tours.filter(t => t.status !== 'archived');
  const currentTour = tours.find(t => t.id === activeTourId) || availableTours[0] || tours[0];
  const currentStops = currentTour ? hydrateTourStops(currentTour, locations) : [];
  const routeMaps = (() => {
    try { return { url: googleMapsDirectionsUrl(currentStops.map(stop => stop.location.coordinates), true), error: '' }; }
    catch (e) { return { url: '', error: (e as Error).message }; }
  })();
  const routeSelectedStop = currentStops.find(stop => stop.location_id === routeSelectedId);
  const routeSelectedIndex = routeSelectedStop ? currentStops.findIndex(stop => stop.id === routeSelectedStop.id) : -1;
  const knownLocationIds = new Set(locations.map(location => location.id));
  const displayLocations = [...locations, ...queued.filter(item => !knownLocationIds.has(item.id)).map(item => ({ ...item.location, photos: queuedPhotoPreviews[item.id] ?? [] }))];
  const pendingIds = useMemo(() => new Set(queued.map(item => item.id)), [queued]);
  const selected = displayLocations.find(l => l.id === selectedId);
  const selectedIsQueued = !!selected && queued.some(item => item.id === selected.id);
  const activeDisplay = displayLocations.filter(l => l.status === 'active');
  const scoutedCount = activeDisplay.filter(l => ['scouted', 'approved'].includes(l.scouting_status || '')).length;
  const queueStatus = syncingId
    ? 'Đang gửi điểm và ảnh lên máy chủ…'
    : !online
      ? 'Ngoại tuyến · điểm và ảnh vẫn được giữ trên điện thoại.'
      : queued[0]?.lastError
        ? `${queued[0].lastError} Điểm vẫn nằm trong hàng đợi và sẽ tự thử lại.`
        : 'Đã lưu trên điện thoại · sẽ đồng bộ khi có mạng.';
  function setQueueSnapshot(items: QueuedCapture[]) {
    setQueued(current => current.length === items.length && current.every((item, index) => {
      const next = items[index];
      return item.id === next?.id && item.retryCount === next?.retryCount && item.nextAttemptAt === next?.nextAttemptAt && item.lastError === next?.lastError;
    }) ? current : items);
  }
  const visible = displayLocations.filter(l => {
    if (filter === 'archived' ? l.status !== 'archived' : l.status !== 'active') return false;
    if (filter === 'today' && !isToday(l.created_at)) return false;
    if (filter === 'scouted' && !['scouted', 'approved'].includes(l.scouting_status || '')) return false;
    if (filter === 'review' && ['scouted', 'approved'].includes(l.scouting_status || '')) return false;
    return `${l.name} ${l.region} ${l.scouting_notes}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'));
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  useEffect(() => { if (capture || selected) dialog.current?.showModal(); }, [capture, selectedId]);
  useEffect(() => {
    const element = routeDialog.current;
    if (!element) return;
    if (builderOpen && !element.open) element.showModal();
    else if (!builderOpen && element.open) element.close();
  }, [builderOpen]);
  useEffect(() => { if (activeTourId) setFit(n => n + 1); }, [activeTourId]);
  useEffect(() => { if (!routeMapOpen) { setRouteSelectedId(''); setRouteReorderOpen(false); } }, [routeMapOpen]);
  useEffect(() => () => { gpsRequest.current++; }, []);
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try { const items = await listQueuedCaptures(); if (mounted) { setQueueSnapshot(items); setQueueAvailable(true); } return items; }
      catch { if (mounted) setQueueAvailable(false); return null; }
    };
    const handleOnline = () => { setOnline(true); void syncQueue(true); };
    const handleOffline = () => setOnline(false);
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      setOnline(navigator.onLine);
      void refresh().then(items => { if (items?.length && navigator.onLine) void syncQueue(true); });
    };
    void refresh().then(items => { if (items?.length && navigator.onLine) void syncQueue(true); });
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      mounted = false;
      if (queueRetryTimer.current !== undefined) window.clearTimeout(queueRetryTimer.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);
  useEffect(() => {
    const previews: Record<string, NonNullable<ScoutLocation['photos']>> = {};
    for (const item of queued) {
      previews[item.id] = item.photos.map(photo => ({ id: photo.id, url: URL.createObjectURL(photo.blob), caption: photo.name }));
    }
    setQueuedPhotoPreviews(previews);
    return () => { for (const photos of Object.values(previews)) photos.forEach(photo => URL.revokeObjectURL(photo.url)); };
  }, [queued]);
  useEffect(() => {
    if (!photoDraft.photos.length && !videoDraft.videos.length && !uploading) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [photoDraft.photos.length, videoDraft.videos.length, uploading]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
  function scheduleQueueRetry(delayMs: number) {
    if (queueRetryTimer.current !== undefined) window.clearTimeout(queueRetryTimer.current);
    queueRetryTimer.current = window.setTimeout(() => {
      queueRetryTimer.current = undefined;
      void syncQueue();
    }, Math.max(250, delayMs));
  }
  async function syncQueue(force = false) {
    if (syncLock.current) return;
    if (!navigator.onLine) { setOnline(false); return; }
    if (queueRetryTimer.current !== undefined) { window.clearTimeout(queueRetryTimer.current); queueRetryTimer.current = undefined; }
    syncLock.current = true;
    let syncedCount = 0;
    let failedMessage = '';
    try {
      const items = await listQueuedCaptures();
      setQueueSnapshot(items); setQueueAvailable(true);
      for (const item of items) {
        if (!navigator.onLine) { setOnline(false); break; }
        if (!force && item.nextAttemptAt && item.nextAttemptAt > Date.now()) {
          scheduleQueueRetry(item.nextAttemptAt - Date.now());
          break;
        }
        setSyncingId(item.id);
        const videoPreviews: string[] = [];
        try {
          const photos = await uploadPhotos(item.photos.map(photo => ({ ...photo, preview: '' })), setProgress);
          const videoDrafts = item.videos.map(video => {
            const preview = URL.createObjectURL(video.blob); videoPreviews.push(preview);
            return { ...video, blob: new File([video.blob], video.name, { type: video.mime }), preview };
          });
          const videos = await uploadVideos(videoDrafts, setProgress);
          const confirmed = await onCreateRef.current({ ...item.location, photos, videos });
          if (!confirmed) throw new Error(error || 'Máy chủ chưa xác nhận địa điểm.');
          await removeQueuedCapture(item.id);
          const remaining = await listQueuedCaptures();
          setQueueSnapshot(remaining);
          syncedCount++;
        } catch (e) {
          const rawMessage = (e as Error).message || '';
          const message = /failed to fetch|network|load failed|timeout/i.test(rawMessage)
            ? 'Kết nối bị gián đoạn.'
            : rawMessage.slice(0, 180) || 'Máy chủ chưa xác nhận địa điểm.';
          try {
            const failed = await recordQueuedCaptureFailure(item.id, message);
            const remaining = await listQueuedCaptures();
            setQueueSnapshot(remaining);
            if (failed?.nextAttemptAt) scheduleQueueRetry(failed.nextAttemptAt - Date.now());
          } catch { /* Keep the in-memory queue visible even if retry metadata cannot be written. */ }
          failedMessage = `Chưa đồng bộ “${item.location.name}”. Điểm và ảnh vẫn được giữ trên điện thoại.`;
          break;
        } finally { videoPreviews.forEach(URL.revokeObjectURL); }
      }
      if (failedMessage) setNotice(failedMessage);
      else if (syncedCount > 0) setNotice(syncedCount === 1 ? 'Đã đồng bộ 1 địa điểm.' : `Đã đồng bộ ${syncedCount} địa điểm.`);
    } catch {
      setNotice('Không đọc được hàng đợi ngoại tuyến. Điểm vẫn còn trên thiết bị.');
    } finally { setSyncingId(''); syncLock.current = false; }
  }
  function locate() {
    const request = ++gpsRequest.current;
    setLocating(true); setGps('Đang tìm vị trí…');
    if (!navigator.geolocation) { setLocating(false); setGps('Thiết bị chưa hỗ trợ GPS. Hãy chọn trên bản đồ.'); return; }
    navigator.geolocation.getCurrentPosition(position => {
      if (request !== gpsRequest.current) return;
      setLocating(false); setPoint({ lat: position.coords.latitude, lng: position.coords.longitude });
      setGps(`GPS · sai số khoảng ${Math.round(position.coords.accuracy)} m`);
    }, () => {
      if (request !== gpsRequest.current) return;
      setLocating(false); setGps('Chưa lấy được GPS. Thử lại hoặc chọn trên bản đồ.');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }
  function startCapture(position?: GeoPoint) {
    setSelectedId(''); setCapture(true);
    if (position) { gpsRequest.current++; setLocating(false); setPoint(position); setGps('Vị trí bạn chọn trên bản đồ'); }
    else if (!point) locate();
  }
  function close() {
    if (working) return;
    gpsRequest.current++; setLocating(false); setCapture(false); setSelectedId('');
  }
  async function submit() {
    if (!point || working || submitLock.current) return;
    submitLock.current = true; setUploading(true); setPhotoError('');
    try {
      const draft = captureId.current || createQuickCapture(point, name, notes, rating);
      captureId.current = draft;
      const location = { ...draft, coordinates: point, name: name.trim() || draft.name, scouting_notes: notes.trim(), tags: rating ? [`scout:rating:${rating}`] : [], photos: [], videos: [] };
      const queuedCapture: QueuedCapture = {
        id: location.id,
        createdAt: location.created_at,
        location,
        photos: photoDraft.photos.map(({ id, name: photoName, blob }) => ({ id, name: photoName, blob })),
        videos: videoDraft.videos.map(({ id, name: videoName, blob, duration, mime }) => ({ id, name: videoName, blob, duration, mime })),
      };
      if (queueAvailable) {
        try {
          await saveQueuedCapture(queuedCapture);
          setQueued(items => [...items.filter(item => item.id !== queuedCapture.id), queuedCapture].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
          setQueueAvailable(true);
          gpsRequest.current++; setLocating(false); setCapture(false); setPoint(null); setName(''); setNotes(''); setRating(''); captureId.current = null;
          photoDraft.clear(); videoDraft.clear();
          setPage('map'); setFit(n => n + 1);
          setNotice(online ? 'Đã lưu trên điện thoại · đang chờ máy chủ xác nhận đồng bộ.' : 'Đã lưu trên điện thoại · chờ đồng bộ khi có mạng.');
          if (navigator.onLine) window.setTimeout(() => void syncQueue(true), 0);
          return;
        } catch (e) {
          setQueueAvailable(false);
          if (!navigator.onLine) throw e;
        }
      }
      if (!navigator.onLine) throw new Error('Chưa lưu được trên thiết bị. Hãy giữ màn hình này mở và thử lại khi có kết nối.');
      const photos = await uploadPhotos(photoDraft.photos, setProgress);
      const videos = await uploadVideos(videoDraft.videos, setProgress);
      setProgress('Đang lưu địa điểm…');
      captureId.current = { ...location, photos, videos };
      if (await onCreate(captureId.current)) {
        gpsRequest.current++; setLocating(false); setCapture(false); setPoint(null); setName(''); setNotes(''); setRating(''); captureId.current = null;
        photoDraft.clear(); videoDraft.clear();
        setPage('map'); setFit(n => n + 1);
        setNotice('Đã lưu địa điểm và ảnh. Sẵn sàng cho điểm tiếp theo.');
      }
    } catch (e) { setPhotoError((e as Error).message); }
    finally { submitLock.current = false; setUploading(false); setProgress(''); }
  }
  function navigate(next: typeof page) { setRouteMapOpen(false); setPage(next); setFilter('all'); setQuery(''); }
  const tabs = [['map', MapIcon, 'Bản đồ'], ['route', Route, 'Lộ trình'], ['library', Archive, 'Thư viện']] as const;
  return <div className="scout-mobile">
    {routeMapOpen && currentTour && currentStops.length >= 2 && <section className="scout-route-map-fullscreen" aria-label={`Lộ trình ${currentTour.title}`}>
      <ScoutMap locations={currentStops.map(stop => stop.location)} stops={currentStops} selectedId={routeSelectedId} onSelect={id => { setRouteSelectedId(id); setRouteReorderOpen(false); }} onCreateDraft={() => {}} draftPoint={null} fitSignal={fit} showThumbnails focusSelected={false} compactControls />
      <button className="scout-route-map-close" aria-label="Thoát xem route" onClick={() => setRouteMapOpen(false)}><X size={24} /></button>
      {routeSelectedStop && <div className={`scout-route-reorder ${routeReorderOpen ? 'open' : ''}`}>
        {routeReorderOpen && <div className="scout-route-reorder-actions">
          <button aria-label={`Đưa ${routeSelectedStop.location.name} lên trước`} disabled={working || routeSelectedIndex <= 0} onClick={() => void onUpdateTour(moveStop(currentTour, routeSelectedStop.id, 'up'), routeSelectedStop.location_id, 'Đổi thứ tự trên bản đồ route')}><ArrowUp size={18} /><span>Lên</span></button>
          <button aria-label={`Đưa ${routeSelectedStop.location.name} xuống sau`} disabled={working || routeSelectedIndex < 0 || routeSelectedIndex >= currentStops.length - 1} onClick={() => void onUpdateTour(moveStop(currentTour, routeSelectedStop.id, 'down'), routeSelectedStop.location_id, 'Đổi thứ tự trên bản đồ route')}><ArrowDown size={18} /><span>Xuống</span></button>
        </div>}
        <button className="scout-route-reorder-toggle" aria-expanded={routeReorderOpen} onClick={() => setRouteReorderOpen(open => !open)} disabled={working}><Route size={17} />Đổi vị trí <b>{routeSelectedStop.stop_order}</b></button>
      </div>}
    </section>}
    <main className="scout-content">
      {page === 'map' ? <section className="scout-map" aria-label="Bản đồ khảo sát">
        <ScoutMap locations={displayLocations} pendingIds={pendingIds} stops={currentStops} selectedId="" onSelect={setSelectedId} onCreateDraft={p => { if (!busy) startCapture(p); }} draftPoint={point} fitSignal={fit} pickSignal={pickSignal} compactControls />
      </section> : page === 'route' ? <section className="scout-list scout-route-list">
        <div className="scout-list-title"><div><p>ĐI THEO THỨ TỰ BẠN CHỌN</p><h1>Lộ trình</h1></div><button aria-label="Tạo lộ trình mới" disabled={!ready || working || !active.length} onClick={() => setBuilderOpen(true)}><Plus /></button></div>
        <label className="scout-route-select"><select aria-label="Chọn lộ trình trên điện thoại" value={currentTour?.id || ''} disabled={!availableTours.length} onChange={e => onChooseTour(e.target.value)}><option value="" disabled>{availableTours.length ? 'Chọn một lộ trình' : 'Chưa có lộ trình đã lưu'}</option>{availableTours.map(t => <option key={t.id} value={t.id}>{t.title} · {t.stops.length} điểm</option>)}</select></label>
        
        {currentTour ? <><div className="scout-route-heading"><div><h2>{currentTour.title}</h2></div><div className="scout-route-actions">{routeMaps.url ? <a className="scout-route-maps-link" hidden={currentStops.length < 2} href={routeMaps.url} target="_blank" rel="noreferrer"><ExternalLink size={16} />Mở tuyến trong Google Maps</a> : <button type="button" hidden={currentStops.length < 2} disabled aria-describedby="scout-route-maps-limit"><ExternalLink size={16} />Mở tuyến trong Google Maps</button>}<button onClick={() => { setRouteSelectedId(''); setRouteReorderOpen(false); setFit(n => n + 1); setRouteMapOpen(true); }} disabled={currentStops.length < 2}><MapIcon size={17} />Xem route</button><button className="scout-route-delete" onClick={() => void onDeleteTour(currentTour)} disabled={working}><Trash2 size={16} />Xóa</button></div></div>
          {!routeMaps.url && currentStops.length >= 2 && <p id="scout-route-maps-limit" className="scout-route-limit" role="status">{routeMaps.error}</p>}
          {currentStops.length ? <ol className="scout-route-stops">{currentStops.map((stop, index) => <li key={stop.id}><span className="number">{index + 1}</span><span className="scout-route-stop-copy"><strong>{stop.location.name}</strong><small>{stop.location.region || 'Chưa ghi khu vực'}</small></span><button aria-label={`Đưa ${stop.location.name} lên trước`} disabled={working || index === 0} onClick={() => void onUpdateTour(moveStop(currentTour, stop.id, 'up'))}><ArrowUp size={18} /></button><button aria-label={`Đưa ${stop.location.name} xuống sau`} disabled={working || index === currentStops.length - 1} onClick={() => void onUpdateTour(moveStop(currentTour, stop.id, 'down'))}><ArrowDown size={18} /></button><button className='route-remove' aria-label={'Xóa ' + stop.location.name + ' khỏi lộ trình'} title='Xóa khỏi lộ trình' disabled={working} onClick={() => { if (window.confirm('Xóa ' + stop.location.name + ' khỏi lộ trình này? Spot vẫn được giữ trong thư viện.')) void onUpdateTour(removeStopFromTour(currentTour, stop.id), stop.location_id, 'Xóa khỏi lộ trình của tour').then(ok => ok && setNotice('Đã xóa spot khỏi lộ trình.')); }}><Trash2 size={17} /></button></li>)}</ol> : <div className="scout-empty"><Route size={34} /><h2>Tour chưa có spot</h2><button onClick={() => setBuilderOpen(true)} disabled={!ready || working || !active.length}>Chọn spots</button></div>}
        </> : <div className="scout-empty"><Route size={34} /><h2>Chưa có lộ trình</h2><button onClick={() => setBuilderOpen(true)} disabled={!ready || working || !active.length}>Chọn spots</button></div>}
      </section> : <section className="scout-list">
        <div className="scout-list-title"><div><p>NHỮNG ĐIỂM BẠN TÌM THẤY</p><h1>Thư viện</h1></div><button aria-label="Thêm địa điểm" disabled={busy || (!queueAvailable && !online)} onClick={() => startCapture()}><Plus /></button></div>
        <label className="scout-search"><Search size={19} /><input aria-label="Tìm địa điểm" placeholder="Tên, khu vực hoặc ghi chú…" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <div className="scout-filters">{[['all', 'Tất cả'], ['scouted', 'Đã scout'], ['today', 'Hôm nay'], ['review', 'Cần xem lại'], ['archived', 'Lưu trữ']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <p className="scout-count">Đã scout {scoutedCount}/{activeDisplay.length}{queued.length ? ` · ${queued.length} chờ đồng bộ` : ''}</p>
        
        {!visible.length && <div className="scout-empty"><MapPin size={36} /><h2>{query ? 'Không tìm thấy' : 'Chưa có địa điểm'}</h2><button onClick={() => navigate('map')}>Về bản đồ</button></div>}
        {visible.map(l => { const pending = queued.some(item => item.id === l.id); return <button className="scout-card" key={l.id} onClick={() => setSelectedId(l.id)}><Thumbnail location={l} /><span><strong>{l.name}</strong><small>{new Date(l.created_at).toLocaleString('vi-VN', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })} · {l.region || 'Chưa ghi khu vực'}</small><em className={`scout-status-chip ${pending ? 'pending' : l.status === 'archived' ? 'archived' : l.scouting_status || 'not_scouted'}`}>{pending ? (syncingId === l.id ? 'Đang đồng bộ' : 'Chờ đồng bộ') : l.status === 'archived' ? 'Đã lưu trữ' : scoutLabel(l)}</em></span><ChevronRight size={18} /></button>; })}
      </section>}
    </main>
    {queued.length > 0 && <div className="scout-sync-bar" role="status" aria-live="polite">
      <div><strong>{queued.length} điểm chờ đồng bộ</strong><small>{queueStatus}</small></div>
      <button disabled={!online || !!syncingId} onClick={() => void syncQueue(true)}><RefreshCw size={16} />{syncingId ? 'Đang đồng bộ' : 'Đồng bộ ngay'}</button>
    </div>}
    <nav className="scout-nav" aria-label="Điều hướng mobile">{tabs.map(([key, Icon, label]) => <button key={key} aria-current={page === key ? 'page' : undefined} aria-label={label} title={label} onClick={() => navigate(key)}><Icon size={23} aria-hidden="true" /></button>)}</nav>
    <dialog className="scout-sheet scout-route-builder" ref={routeDialog} aria-labelledby="route-builder-title" onCancel={e => { e.preventDefault(); setBuilderOpen(false); }}>
      <div className="scout-handle" /><div className="scout-sheet-heading"><div><p>ĐI THEO THỨ TỰ BẠN CHỌN</p><h2 id="route-builder-title">Tạo lộ trình</h2></div><button aria-label="Đóng bộ chọn lộ trình" onClick={() => setBuilderOpen(false)}><X /></button></div>
      {builderOpen && <TourBuilder locations={locations} busy={working} error={error} onCreate={async (title, ids) => {
        const saved = await onCreateTour(title, ids);
        if (saved) { setBuilderOpen(false); setPage('map'); }
        return saved;
      }} />}
    </dialog>
    {(capture || selected) && <dialog className="scout-sheet" ref={dialog} aria-labelledby="scout-sheet-title" onCancel={e => { e.preventDefault(); close(); }}>
      <div className="scout-handle" /><div className="scout-sheet-heading"><div><p>{capture ? 'QUICK CAPTURE' : 'ĐỊA ĐIỂM CỦA BẠN'}</p><h2 id="scout-sheet-title">{capture ? 'Lưu spot' : selected?.name}</h2></div><button aria-label="Đóng bảng" disabled={working} onClick={close}><X /></button></div>
      {capture ? <form onSubmit={e => { e.preventDefault(); void submit(); }}>
        <div className="scout-position"><LocateFixed size={19} /><div><strong>{point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : 'Chưa có vị trí'}</strong><small role="status">{gps}</small></div></div>
        <div className="scout-location-actions"><button type="button" disabled={locating || working} onClick={locate}>Thử lại GPS</button><button type="button" disabled={working} onClick={() => { gpsRequest.current++; setLocating(false); setCapture(false); setPage('map'); setPickSignal(n => n + 1); }}>Chọn trên bản đồ</button></div>
        <PhotoPicker photos={photoDraft.photos} onChange={photoDraft.setPhotos} disabled={working} onPreparing={setMediaBusy} />
        <VideoPicker videos={videoDraft.videos} onChange={videoDraft.setVideos} disabled={working} onPreparing={setMediaBusy} />
        <fieldset className="scout-rating"><legend>Cảm nhận của bạn <small>Không bắt buộc</small></legend><div>{impressions.map(i => <button type="button" disabled={working} key={i.value} aria-pressed={rating === i.value} onClick={() => setRating(rating === i.value ? '' : i.value)}><span>{i.icon}</span>{i.label}</button>)}</div></fieldset>
        <details className="scout-extras"><summary>Thêm tên / ghi chú</summary><label>Tên địa điểm<input disabled={working} value={name} maxLength={150} onChange={e => setName(e.target.value)} placeholder="Để trống để đặt tên tự động" /></label><label>Ghi chú<textarea disabled={working} value={notes} maxLength={20000} rows={3} onChange={e => setNotes(e.target.value)} placeholder="Đường vào, giờ đẹp, điều cần kiểm tra…" /></label></details>
        {error && <p className="scout-error" role="alert">{error}</p>}
        {photoError && <p className="scout-error" role="alert">{photoError}</p>}<div className="scout-save"><button className="scout-primary" disabled={!point || (!queueAvailable && !online) || working || locating}><Check size={20} />{uploading ? progress || 'Đang lưu trên điện thoại…' : busy ? 'Đang lưu…' : 'Lưu địa điểm'}</button><small>{queueAvailable ? 'Lưu trên điện thoại trước; đồng bộ theo thứ tự khi có mạng.' : online ? 'Lưu trực tiếp khi có mạng.' : 'Bật IndexedDB để lưu ngoại tuyến.'}</small></div>
      </form> : selected && <div className="scout-detail"><PhotoGallery photos={selected.photos || []} name={selected.name} /><VideoGallery videos={selected.videos || []} /><AddLocationVideos key={selected.id + "-videos"} existingCount={selected.videos?.length || 0} busy={working || selectedIsQueued} onBusyChange={setMediaBusy} onSave={videos => onUpdate({ ...selected, videos: [...(selected.videos || []).filter(v => !videos.some(n => n.id === v.id)), ...videos] }, "Thêm video khảo sát")} /><AddLocationPhotos key={selected.id} existingCount={selected.photos?.length || 0} busy={working || selectedIsQueued} onBusyChange={setMediaBusy} onSave={photos => onUpdate({ ...selected, photos: [...(selected.photos || []).filter(p => !photos.some(n => n.id === p.id)), ...photos] }, `Thêm ${photos.length} ảnh khảo sát`)} />{selectedIsQueued && <p className="scout-queue-note">Địa điểm này đang chờ đồng bộ. Bạn có thể sửa hoặc lưu trữ sau khi máy chủ xác nhận.</p>}<p>{selected.region || 'Chưa ghi khu vực'} · {selectedIsQueued ? (syncingId === selected.id ? 'Đang đồng bộ' : 'Chờ đồng bộ') : scoutLabel(selected)}</p><p className="scout-detail-notes">{selected.scouting_notes || 'Chưa có ghi chú. Bạn có thể bổ sung sau.'}</p><a className="button" href={`https://www.google.com/maps/search/?api=1&query=${selected.coordinates.lat},${selected.coordinates.lng}`} target="_blank" rel="noreferrer"><ExternalLink size={17} />Mở trên Google Maps</a><div className="scout-detail-status">{[['not_scouted', 'Mới lưu'], ['scouted', 'Đã khảo sát'], ['approved', 'Giữ lại']].map(([value, label]) => <button key={value} disabled={working || selectedIsQueued} aria-pressed={selected.scouting_status === value || value === 'not_scouted' && selected.scouting_status === 'candidate'} onClick={() => void onUpdate({ ...selected, scouting_status: value as ScoutLocation['scouting_status'] }, `Trạng thái: ${label}`)}>{label}</button>)}</div>{error && <p className="scout-error" role="alert">{error}</p>}<button className="scout-primary" disabled={working || selectedIsQueued} onClick={() => { setSelectedId(''); onEdit(selected); }}>Chỉnh sửa chi tiết</button><button className="scout-archive" disabled={working || selectedIsQueued} onClick={() => void onUpdate({ ...selected, status: selected.status === 'active' ? 'archived' : 'active' }, selected.status === 'active' ? 'Lưu trữ địa điểm' : 'Khôi phục địa điểm').then(ok => { if (ok) { setSelectedId(''); setNotice('Đã cập nhật địa điểm.'); } })}><Archive size={16} />{selected.status === 'active' ? 'Lưu trữ địa điểm' : 'Khôi phục địa điểm'}</button><button className='scout-delete' disabled={working || selectedIsQueued} onClick={() => void onDelete(selected).then(ok => { if (ok) { setSelectedId(''); setNotice('Đã xóa spot.'); } })}><Trash2 size={16} />Xóa vĩnh viễn</button></div>}
    </dialog>}
    {notice && <div className="scout-notice" role="status"><Check size={18} />{notice}<button aria-label="Đóng thông báo" onClick={() => setNotice('')}><X size={16} /></button></div>}
  </div>;
}

function Thumbnail({ location }: { location: ScoutLocation }) {
  const [failed, setFailed] = useState(false);
  const url = location.photos?.[0]?.url;
  useEffect(() => setFailed(false), [url]);
  return url && !failed ? <img className="scout-thumb" src={url} alt={location.name} onError={() => setFailed(true)} referrerPolicy="no-referrer" /> : <span className="scout-thumb"><MapPin size={24} /></span>;
}
