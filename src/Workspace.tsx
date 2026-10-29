import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Compass, Map as MapIcon, Plus, X, Search, Archive, MapPin, Clock, Hourglass, Car, FileText, Star, Copy, ExternalLink, Pencil, LocateFixed, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, GripVertical, FolderOpen, Check, Download, Route, Camera, ListChecks, History, LoaderCircle, Trash2 } from 'lucide-react';
import type { ScoutLocation, Tour } from './types/scout';
import { addStopToTour, removeStopFromTour, moveStop, reorderTourStops, hydrateTourStops, populateTour } from './utils/invariants';
import { ScoutMap } from './components/ScoutMap';
import { DesktopRouteMap } from './components/DesktopRouteMap';
import { TourBuilder } from './components/MobileTours';

import { PHOTO_PATH } from '../shared/photos.mjs';
import { MobileScout } from './components/MobileScout';
import { AddLocationPhotos } from './components/ScoutPhotos';
import { AddLocationVideos, VideoGallery } from './components/ScoutVideos';
import { impressions, isToday } from './utils/quickCapture';

type WorkspaceData = { revision: number; locations: ScoutLocation[]; tours: Tour[] };
const statusLabels = { not_scouted: 'Not scouted', candidate: 'Candidate', scouted: 'Scouted', approved: 'Approved' };
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const stamp = (l: ScoutLocation, action: string): ScoutLocation => ({ ...l, updated_at: now(), history: [{ id: uid(), at: now(), action }, ...(l.history || [])] });
const text = (data: FormData, key: string) => String(data.get(key) || '').trim();
const lines = (value: string) => value.split('\n').map(v => v.trim()).filter(Boolean);
function Empty({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) { return <div className="empty"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{children}</p></div>; }
function Photo({ url, name, className = '' }: { url?: string; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return url && !failed ? <img className={className} src={url} alt={name} onError={() => setFailed(true)} referrerPolicy="no-referrer" /> : <div className={`photo-placeholder ${className}`}><Camera size={25} /><span>{url ? 'Không tải được ảnh' : 'Chưa có ảnh'}</span></div>;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="Đóng" onClick={onClose}><X /></button></div>{children}</dialog>;
}

export function Workspace() {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState('');
  const [saving, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const busy = saving || mediaBusy;
  const lock = useRef(false);
  const [activeId, setActiveId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [library, setLibrary] = useState<'active' | 'archived' | null>(null);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryView, setLibraryView] = useState<'all' | 'today' | 'review'>('all');
  const [edit, setEdit] = useState<ScoutLocation | 'new' | null>(null);
  const [draftPoint, setDraftPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [tourEditor, setTourEditor] = useState(false);
  const [durationEditor, setDurationEditor] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 650px)').matches);
  const [mobileHome, setMobileHome] = useState(true);
  const [mobileStops, setMobileStops] = useState(false);
  const [mobileDetails, setMobileDetails] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [desktopRouteOpen, setDesktopRouteOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 650px)');
    const update = () => setIsMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [tab, setTab] = useState('Details');
  const [photoIndex, setPhotoIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [checkLabel, setCheckLabel] = useState('');
  const [fitSignal, setFitSignal] = useState(0);
  const draggedStop = useRef('');
  const tour = data?.tours.find(t => t.id === activeId) || data?.tours[0];
  const selected = data?.locations.find(l => l.id === selectedId);
  const stops = tour && data ? hydrateTourStops(tour, data.locations) : [];
  const selectedStop = stops.find(s => s.location_id === selectedId);
  const photos = selected?.photos || [];
  const selectedImpression = selected ? impressions.find(i => selected.tags.includes(`scout:rating:${i.value}`)) : undefined;
  const todayCount = data?.locations.filter(l => l.status === 'active' && isToday(l.created_at)).length || 0;
  const reviewCount = data?.locations.filter(l => l.status === 'active' && !['scouted', 'approved'].includes(l.scouting_status || '')).length || 0;
  const libraryItems = (data?.locations || []).filter(l => {
    if (!library || l.status !== library) return false;
    if (library === 'active' && libraryView === 'today' && !isToday(l.created_at)) return false;
    if (library === 'active' && libraryView === 'review' && ['scouted', 'approved'].includes(l.scouting_status || '')) return false;
    return `${l.name} ${l.region} ${l.scouting_notes}`.toLocaleLowerCase('vi').includes(libraryQuery.toLocaleLowerCase('vi'));
  });
  async function load() {
    try { const res = await fetch('/api/workspace'); if (!res.ok) throw new Error('Không kết nối được database. Hãy chạy npm run dev hoặc npm start.'); setData(await res.json()); setError(''); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { setPhotoIndex(0); setTab('Details'); setCheckLabel(''); }, [selectedId]);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 3500); return () => clearTimeout(timer); }, [message]);
  function chooseTour(id: string) {
    setActiveId(id); setSelectedId(''); setDesktopRouteOpen(false); setMobileHome(false); setMobileStops(false); setMobileDetails(false); setFitSignal(n => n + 1);
  }
  function selectSpot(id: string) { setSelectedId(id); setMobileStops(false); setMobileDetails(false); }
  function openLibrary(view: 'all' | 'today' | 'review' = 'all', target: 'active' | 'archived' = 'active') { setLibraryView(target === 'archived' ? 'all' : view); setLibraryQuery(''); setLibrary(target); }
  function browseSpots() { setError(''); setLibrary(null); setBuilderOpen(true); }
  async function createSelectedTour(title: string, ids: string[]) {
    if (!data || busy) return false;
    const id = uid(); const timestamp = now();
    try {
      const next = populateTour({ id, code: `QN-TOUR-${id.slice(0, 8).toUpperCase()}`, title, description: '', production_week: '', assigned_crew: [], status: 'planning', stops: [], created_at: timestamp, updated_at: timestamp }, data.locations, ids);
      if (await save({ ...data, tours: [...data.tours, next], locations: data.locations.map(l => ids.includes(l.id) ? stamp(l, `Thêm vào tour “${title}”`) : l) })) {
        setBuilderOpen(false); chooseTour(id); return true;
      }
    } catch (e) { setError((e as Error).message); }
    return false;
  }
  function openNewLocation(point?: { lat: number; lng: number }) {
    setError('');
    setDraftPoint(point ?? null);
    setEdit('new');
  }
  function closeEditor() {
    setEdit(null);
    setDraftPoint(null);
    setError('');
  }
  async function save(next: WorkspaceData) {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError('');
    try {
      const res = await fetch('/api/workspace', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      const result = await res.json(); if (!res.ok) throw new Error(result.error || 'Không lưu được dữ liệu.');
      setData(result); return true;
    } catch (e) { setError((e as Error).message); return false; }
    finally { lock.current = false; setBusy(false); }
  }
  async function createLocation(location: ScoutLocation): Promise<boolean> {
    try {
      const response = await fetch('/api/workspace');
      if (!response.ok) throw new Error('Chưa kết nối được máy chủ để đồng bộ điểm đang chờ.');
      const latest = await response.json() as WorkspaceData;
      if (latest.locations.some(item => item.id === location.id)) { setData(latest); setError(''); return true; }
      return save({ ...latest, locations: [...latest.locations, location] });
    } catch (e) { setError((e as Error).message); return false; }
  }
  async function updateLocation(l: ScoutLocation, action: string) {
    if (!data) return false;
    return save({ ...data, locations: data.locations.map(item => item.id === l.id ? stamp(l, action) : item) });
  }
  async function updateTour(next: Tour, locationId?: string, action?: string) {
    if (!data) return;
    return save({ ...data, tours: data.tours.map(t => t.id === next.id ? next : t), locations: data.locations.map(l => l.id === locationId && action ? stamp(l, action) : l) });
  }
  async function deleteTour(target: Tour): Promise<boolean> {
    if (!data || busy) return false;
    const confirmed = window.confirm(`Xóa lộ trình "${target.title}" và ${target.stops.length} điểm dừng? Các spot vẫn được giữ trong thư viện. Thao tác này không thể hoàn tác.`);
    if (!confirmed) return false;
    const remainingTours = data.tours.filter(item => item.id !== target.id);
    const saved = await save({ ...data, tours: remainingTours });
    if (saved) {
      setActiveId(remainingTours[0]?.id || '');
      setSelectedId('');
      setDesktopRouteOpen(false);
      setMobileHome(false);
      setMobileStops(false);
      setMobileDetails(false);
      setFitSignal(n => n + 1);
      setMessage(`Đã xóa lộ trình "${target.title}". Các spot vẫn được giữ trong thư viện.`);
    }
    return saved;
  }
  async function deleteLocation(location: ScoutLocation) {
    if (!data || busy) return false;
    const linkedTours = data.tours.filter(t => t.stops.some(s => s.location_id === location.id));
    const impact = linkedTours.length ? ' Spot cũng sẽ bị gỡ khỏi ' + linkedTours.length + ' lộ trình.' : '';
    if (!window.confirm('Xóa vĩnh viễn spot ' + location.name + '?' + impact + ' Liên kết ảnh, checklist và lịch sử của spot sẽ bị xóa. Không thể hoàn tác.')) return false;
    const tours = data.tours.map(t => {
      const stops = t.stops.filter(s => s.location_id !== location.id).map((s, index) => ({ ...s, stop_order: index + 1 }));
      return stops.length === t.stops.length ? t : { ...t, stops, updated_at: now() };
    });
    const saved = await save({ ...data, locations: data.locations.filter(l => l.id !== location.id), tours });
    if (saved) { setSelectedId(''); setMobileDetails(false); setLibrary(null); setMessage('Đã xóa spot và cập nhật các lộ trình liên quan.'); }
    return saved;
  }
  async function add(l: ScoutLocation) {
    if (!tour) { setTourEditor(true); return; }
    if (l.status === 'archived' || tour.stops.some(s => s.location_id === l.id)) return;
    await updateTour(addStopToTour(tour, l), l.id, `Thêm vào tour “${tour.title}”`); setSelectedId(l.id);
  }
  function exportData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `location-scout-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
  }
  async function saveLocation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!data) return;
    const form = new FormData(e.currentTarget); const old = edit !== 'new' ? edit : null; const id = old?.id || uid();
    const lat = Number(form.get('lat')); const lng = Number(form.get('lng'));
    if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) { setError('Tọa độ không hợp lệ. Hãy chọn lại pin hoặc nhập vĩ độ/kinh độ hợp lệ.'); return; }
    const folder = text(form, 'folder');
    let folderId: string | undefined;
    if (folder) { try { const url = new URL(folder); if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' || !url.pathname.includes('/folders/')) throw new Error(); folderId = url.pathname.split('/folders/')[1].split('/')[0]; if (!folderId) throw new Error(); } catch { setError('Nhập liên kết thư mục https://drive.google.com/drive/folders/… hợp lệ.'); return; } }
    const photoUrls = [...new Set(lines(text(form, 'photos')))];
    if (photoUrls.some(url => { if (PHOTO_PATH.test(url)) return false; try { return !['http:', 'https:'].includes(new URL(url).protocol); } catch { return true; } })) { setError('Mỗi ảnh cần một URL http/https hợp lệ.'); return; }
    const location: ScoutLocation = stamp({
      id, code: old?.code || `QN-LOC-${id.slice(0, 8).toUpperCase()}`, name: text(form, 'name'), region: text(form, 'region'),
      coordinates: { lat, lng }, description: text(form, 'description'), scouting_notes: text(form, 'notes'),
      best_time_to_shoot: text(form, 'time'), camera_angles: lines(text(form, 'highlights')), tags: old?.tags || [], drone_permitted: old?.drone_permitted || false,
      status: old?.status || 'active', scouting_status: text(form, 'status') as ScoutLocation['scouting_status'], access: text(form, 'access'),
      drive_reference: { ...old?.drive_reference, folder_url: folder || undefined, folder_id: folderId, asset_count: old?.drive_reference.asset_count || 0 },
      photos: photoUrls.map(url => old?.photos?.find(p => p.url === url) || { id: uid(), url, caption: '' }),
      videos: old?.videos || [], checklist: old?.checklist || [], history: old?.history || [], created_at: old?.created_at || now(), updated_at: now(),
    }, old ? 'Cập nhật thông tin địa điểm' : 'Tạo địa điểm');
    const locations = old ? data.locations.map(l => l.id === old.id ? location : l) : [...data.locations, location];
    let tours = data.tours;
    if (!old && form.get('addToTour') && tour) tours = tours.map(t => t.id === tour.id ? addStopToTour(t, location) : t);
    if (await save({ ...data, locations, tours })) { setEdit(null); setDraftPoint(null); setSelectedId(id); setPhotoIndex(0); setMobileHome(false); setMobileDetails(false); }
  }
  async function saveTour(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!data) return;
    const form = new FormData(e.currentTarget); const id = uid();
    const next: Tour = { id, code: `QN-TOUR-${id.slice(0, 8).toUpperCase()}`, title: text(form, 'title'), description: '', production_week: '', target_date: text(form, 'date') || undefined, assigned_crew: [], status: 'planning', stops: [], created_at: now(), updated_at: now() };
    if (await save({ ...data, tours: [...data.tours, next] })) { chooseTour(id); setTourEditor(false); }
  }

  return <div className={`app ${isMobile && mobileHome ? 'mobile-home-active' : ''} ${mobileStops ? 'mobile-stops-open' : ''} ${mobileDetails ? 'mobile-details-open' : ''}`}>
    <header className={`app-header ${isMobile ? 'scout-hide-header' : ''}`}><a className="brand" href="/" aria-label="Quài Nhơn Location Scout"><div className="brand-mark"><Compass size={35} strokeWidth={2.1} /></div><span>Quài Nhơn<strong>Location Scout</strong></span></a>
      <div className="tour-switch"><select id="desktop-tour-choice" aria-label="Chọn tour" value={tour?.id || ''} onChange={e => chooseTour(e.target.value)}><option value="" disabled>Chọn lộ trình của bạn</option>{data?.tours.map(t => <option key={t.id} value={t.id}>{t.title} · {t.stops.length} điểm</option>)}</select><button className="icon-button" title="Chọn spots để tạo tour" aria-label="Chọn spots để tạo tour" onClick={browseSpots} disabled={!data || busy}><Plus size={18} /></button>{tour && <button className="icon-button delete-tour-button" title={`Xóa lộ trình: ${tour.title}`} aria-label={`Xóa lộ trình: ${tour.title}`} onClick={() => void deleteTour(tour)} disabled={busy}><Trash2 size={16} /></button>}</div>
      <span className="save-status" role="status" aria-label={busy ? 'Đang lưu' : data ? 'Đã kết nối' : 'Đang kết nối'} title={busy ? 'Đang lưu' : data ? 'Đã kết nối' : 'Đang kết nối'}>{busy ? <LoaderCircle className="spin" size={14} /> : <span className={`connection-dot ${data ? '' : 'pending'}`} />}</span>
      <div className="header-actions">{tour && stops.length >= 2 && <button aria-label="Xem route toàn màn hình" onClick={() => setDesktopRouteOpen(true)}><Route size={19} /><span>Route</span></button>}<button aria-label="Xem tất cả spots" onClick={browseSpots}><MapIcon size={19} /><span>Thư viện</span></button><button className="primary" onClick={() => openNewLocation()} disabled={!data || busy}><Plus size={19} /> Thêm spot</button><button className="avatar" title="Xuất bản sao dữ liệu JSON" aria-label="Xuất dữ liệu" onClick={exportData} disabled={!data}><Download size={19} /></button></div>
    </header>
    {error && <div className="error-banner" role="alert">{error}<button onClick={() => void load()} disabled={busy}>Tải lại dữ liệu</button><button className="icon-button" onClick={() => setError('')} aria-label="Đóng thông báo"><X size={16} /></button></div>}
    {isMobile && <MobileScout locations={data?.locations || []} tours={data?.tours || []} activeTourId={tour?.id || ''} ready={!!data} busy={busy} error={error} onChooseTour={chooseTour} onCreateTour={createSelectedTour} onUpdateTour={async (next, locationId, action) => (await updateTour(next, locationId, action)) ?? false} onDelete={deleteLocation} onDeleteTour={deleteTour} onEdit={setEdit} onUpdate={updateLocation} onCreate={createLocation} />}
    {!isMobile && <main className={`workspace ${selected ? 'spot-open' : 'spot-closed'}`}>
      <aside className="sidebar"><div className="sidebar-heading"><h2>Điểm dừng <span>({stops.length})</span></h2><button className="mobile-only icon-button" aria-label="Thu gọn danh sách điểm" onClick={() => setMobileStops(false)}><X size={19} /></button></div>
        <div className="stops-scroll">{!data ? <Empty icon={<LoaderCircle className="spin" />} title={error ? 'Chưa kết nối' : 'Đang mở workspace'}>Dữ liệu được đọc từ database trên máy.</Empty> : stops.length === 0 ? <Empty icon={<MapPin />} title={tour ? 'Chưa có điểm' : 'Chưa có lộ trình'}>{tour ? 'Thêm spot trên bản đồ để bắt đầu.' : 'Tạo lộ trình để bắt đầu.'}</Empty> : stops.map((s, i) => <div key={s.id} draggable={!busy} onDragStart={() => { draggedStop.current = s.id; }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!tour || busy || !draggedStop.current || draggedStop.current === s.id) return; const ids = tour.stops.map(item => item.id).filter(id => id !== draggedStop.current); ids.splice(ids.indexOf(s.id), 0, draggedStop.current); void updateTour(reorderTourStops(tour, ids)); draggedStop.current = ''; }} onDragEnd={() => { draggedStop.current = ''; }} className={`stop-card ${selectedId === s.location_id ? 'selected' : ''}`}>
          <GripVertical size={15} className="grip" /><button className="stop-select" onClick={() => selectSpot(s.location_id)}><span className="number">{s.stop_order}</span><Photo url={s.location.photos?.[0]?.url} name={s.location.name} className="stop-photo" /><span className="stop-text"><strong>{s.location.name}</strong><span className="status-line"><i className={`dot ${s.location.scouting_status || 'not_scouted'}`} />{s.location.status === 'archived' ? 'Archived' : statusLabels[s.location.scouting_status || 'not_scouted']}</span></span></button>
          <div className="stop-order"><button title="Di chuyển lên" aria-label={`Di chuyển ${s.location.name} lên`} disabled={i === 0 || busy} onClick={() => tour && void updateTour(moveStop(tour, s.id, 'up'))}><ArrowUp size={14} /></button><button title="Di chuyển xuống" aria-label={`Di chuyển ${s.location.name} xuống`} disabled={i === stops.length - 1 || busy} onClick={() => tour && void updateTour(moveStop(tour, s.id, 'down'))}><ArrowDown size={14} /></button></div>
        </div>)}
        {!tour && <button className="add-stop" disabled={!data || busy} onClick={() => setTourEditor(true)}><Plus size={18} />Tạo lộ trình</button>}
        {tour && stops.length > 0 && <div className="tour-summary"><span>{stops.length} điểm dừng</span><span><Clock size={13} /> {stops.reduce((sum, s) => sum + s.planned_duration_minutes, 0)} phút tại điểm</span></div>}
        </div>
        <div className="library-nav"><button onClick={() => openLibrary('all')}><span className="nav-icon"><MapIcon /></span>Thư viện<span className="count">{data?.locations.filter(l => l.status === 'active').length || 0}</span></button><button onClick={() => openLibrary('all', 'archived')}><span className="nav-icon"><Archive /></span>Lưu trữ<span className="count">{data?.locations.filter(l => l.status === 'archived').length || 0}</span></button></div>
      </aside>
      <section className="map-area" aria-label="Bản đồ địa điểm">{(!isMobile || !mobileHome) && <ScoutMap locations={data?.locations || []} stops={stops} selectedId={selectedId} onSelect={selectSpot} onCreateDraft={point => { if (!data || busy || edit) return; openNewLocation(point); }} draftPoint={draftPoint} fitSignal={fitSignal} />}
        <div className="map-search"><Search size={20} /><input aria-label="Tìm địa điểm đã lưu" placeholder="Tìm spot…" value={query} onChange={e => setQuery(e.target.value)} />{query && <button className="icon-button" aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={15} /></button>}
          {query && <div className="search-results">{data?.locations.filter(l => l.status === 'active' && `${l.name} ${l.region} ${l.scouting_notes}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))).map(l => <button key={l.id} onClick={() => { selectSpot(l.id); setQuery(''); }}><MapPin size={16} /><span>{l.name}<small>{l.region}</small></span></button>)}{!data?.locations.some(l => l.status === 'active' && `${l.name} ${l.region} ${l.scouting_notes}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))) && <p>Chưa có địa điểm phù hợp trong thư viện.</p>}</div>}
        </div>
        
        
        {isMobile && !mobileHome && <>
          <button className="mobile-stops-toggle" aria-expanded={mobileStops} onClick={() => setMobileStops(v => !v)}><Route size={17} />{stops.length} điểm dừng · {mobileStops ? 'Thu gọn' : 'Xem danh sách'}</button>
          {selected && !mobileDetails && !mobileStops && <div className="mobile-spot-peek"><span className="number">{selectedStop?.stop_order || <MapPin size={15} />}</span><strong>{selected.name}</strong><button onClick={() => setMobileDetails(true)}>Chi tiết</button><button className="icon-button" aria-label="Bỏ chọn spot" onClick={() => setSelectedId('')}><X size={17} /></button></div>}
        </>}
      </section>
      <aside className={`detail-panel ${selected ? 'has-selection' : ''}`}>
        {!selected ? <div className="detail-empty"><div className="detail-kicker">YOUR NEXT LOCATION</div><div className="empty-illustration"><MapIcon size={78} strokeWidth={1} /><span><MapPin size={30} /></span></div><h2>Mỗi địa điểm,<br />một câu chuyện.</h2><p>Chọn một pin trên bản đồ hoặc thêm địa điểm để lưu ảnh, ghi chú và kế hoạch khảo sát.</p><button className="primary" onClick={() => openNewLocation()} disabled={!data || busy}><Plus size={18} />Thêm địa điểm</button><div className="empty-foot"><LocateFixed size={15} />Thông tin thật. Lộ trình của bạn.</div></div> : <>
          <div className="detail-heading"><span className="number">{selectedStop?.stop_order || <MapPin size={16} />}</span><h2>{selected.name}</h2><button className="icon-button" aria-label="Đóng chi tiết" onClick={() => { setSelectedId(''); setMobileDetails(false); }}><X size={21} /></button></div>
          <div className="detail-toolbar"><label className="status-control"><i className={`dot ${selected.scouting_status || 'not_scouted'}`} /><select aria-label="Trạng thái khảo sát" disabled={busy} value={selected.scouting_status || 'not_scouted'} onChange={e => void updateLocation({ ...selected, scouting_status: e.target.value as ScoutLocation['scouting_status'] }, `Trạng thái: ${statusLabels[e.target.value as keyof typeof statusLabels]}`)}>{Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label><a className="button subtle" href={`https://www.google.com/maps/search/?api=1&query=${selected.coordinates.lat},${selected.coordinates.lng}`} target="_blank" rel="noreferrer"><ExternalLink size={16} />Open in Maps</a></div>
          <div className="detail-scroll"><div className="gallery"><Photo url={photos[Math.min(photoIndex, photos.length - 1)]?.url} name={selected.name} className="hero-photo" />{photos.length > 1 && <><button className="gallery-prev" aria-label="Ảnh trước" onClick={() => setPhotoIndex(i => (i - 1 + photos.length) % photos.length)}><ChevronLeft /></button><button className="gallery-next" aria-label="Ảnh tiếp theo" onClick={() => setPhotoIndex(i => (i + 1) % photos.length)}><ChevronRight /></button></>}{photos.length > 0 && <span className="photo-count">{Math.min(photoIndex + 1, photos.length)} / {photos.length}</span>}</div>
          <div className="thumbnails">{photos.map((p, i) => <button key={p.id} className={i === photoIndex ? 'active' : ''} onClick={() => setPhotoIndex(i)} aria-label={`Xem ảnh ${i + 1}`}><Photo url={p.url} name={`Ảnh ${i + 1}`} /></button>)}<button className="add-photo" aria-label="Thêm ảnh" onClick={() => setEdit(selected)} disabled={busy}><Plus size={22} /></button></div>
          <AddLocationPhotos key={selected.id + '-photos'} existingCount={selected.photos?.length || 0} busy={busy} onBusyChange={setMediaBusy} onSave={newPhotos => updateLocation({ ...selected, photos: [...(selected.photos || []).filter(p => !newPhotos.some(n => n.id === p.id)), ...newPhotos] }, `Thêm ${newPhotos.length} ảnh khảo sát`)} />
          <VideoGallery videos={selected.videos || []} /><AddLocationVideos key={selected.id} existingCount={selected.videos?.length || 0} busy={busy} onBusyChange={setMediaBusy} onSave={videos => updateLocation({ ...selected, videos: [...(selected.videos || []).filter(v => !videos.some(n => n.id === v.id)), ...videos] }, 'Thêm video khảo sát')} />
          <div className="tabs" role="tablist" aria-label="Thông tin địa điểm">{['Details', 'Folder', 'Notes', 'Checklist', 'History'].map(t => <button key={t} id={`tab-${t}`} role="tab" aria-selected={tab === t} aria-controls="detail-content" className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
          <div id="detail-content" role="tabpanel" aria-labelledby={`tab-${tab}`} className="tab-content">
          {tab === 'Details' && <><div className="desktop-impressions" aria-label="Cảm nhận địa điểm">{impressions.map(i => <button key={i.value} aria-pressed={selectedImpression?.value === i.value} disabled={busy} onClick={() => { const tags = selected.tags.filter(tag => !tag.startsWith('scout:rating:')); if (selectedImpression?.value !== i.value) tags.push(`scout:rating:${i.value}`); void updateLocation({ ...selected, tags }, `Cảm nhận: ${selectedImpression?.value === i.value ? 'Bỏ đánh giá' : i.label}`); }}><span>{i.icon}</span>{i.label}</button>)}</div><dl className="facts"><div><dt><MapPin />Coordinates</dt><dd>{selected.coordinates.lat.toFixed(4)}, {selected.coordinates.lng.toFixed(4)}<button className="icon-button" aria-label="Sao chép tọa độ" onClick={() => { void navigator.clipboard.writeText(`${selected.coordinates.lat}, ${selected.coordinates.lng}`).then(() => setMessage('Đã sao chép tọa độ.')).catch(() => setError('Trình duyệt không cho phép sao chép.')); }}><Copy size={16} /></button></dd></div><div><dt><Clock />Best time</dt><dd>{selected.best_time_to_shoot || 'Chưa ghi nhận'}</dd></div><div><dt><Hourglass />Duration</dt><dd>{selectedStop ? `${selectedStop.planned_duration_minutes} minutes` : 'Chưa có trong tour'}</dd></div><div><dt><Car />Access</dt><dd>{selected.access || 'Chưa ghi nhận'}</dd></div></dl>
            <section className="detail-section"><FileText /><div><h3>Why here</h3><p>{selected.description || 'Chưa có mô tả. Thêm những điều đáng chú ý ở địa điểm này.'}</p></div></section><section className="detail-section"><Star /><div><h3>Highlights</h3>{selected.camera_angles.length ? <ul>{selected.camera_angles.map((a, i) => <li key={i}>{a}</li>)}</ul> : <p>Chưa có góc quay hoặc điểm nổi bật.</p>}</div></section><section className="detail-section"><Pencil /><div><h3>Notes</h3><p className="note-box">{selected.scouting_notes || 'Chưa có ghi chú khảo sát.'}</p></div></section>
          </>}
          {tab === 'Folder' && <><div className="tab-title"><FolderOpen /><h3>Thư mục tư liệu</h3></div>{selected.drive_reference.folder_url ? <a className="folder-link" href={selected.drive_reference.folder_url} target="_blank" rel="noreferrer"><FolderOpen size={30} /><span>Mở thư mục Google Drive<small>{selected.drive_reference.folder_id}</small></span><ExternalLink size={16} /></a> : <p className="muted">Chưa liên kết thư mục cho địa điểm này.</p>}<p className="helper">Mở thư mục gốc để xem tư liệu. Quyền truy cập do Google Drive quản lý.</p><button onClick={() => setEdit(selected)} disabled={busy}><Pencil size={16} />Sửa liên kết</button></>}
          {tab === 'Notes' && <form key={`${selected.id}-${selected.updated_at}`} onSubmit={e => { e.preventDefault(); void updateLocation({ ...selected, scouting_notes: text(new FormData(e.currentTarget), 'notes') }, 'Cập nhật ghi chú').then(ok => ok && setMessage('Đã lưu ghi chú.')); }}><label>Ghi chú thực địa<textarea name="notes" rows={9} defaultValue={selected.scouting_notes} placeholder="Lối vào, liên hệ, lưu ý khi quay…" /></label><button className="primary" disabled={busy}><Check size={16} />Lưu ghi chú</button></form>}
          {tab === 'Checklist' && <><div className="tab-title"><ListChecks /><h3>Chuẩn bị khảo sát</h3><span className="count">{selected.checklist?.filter(c => c.done).length || 0}/{selected.checklist?.length || 0}</span></div>{!selected.checklist?.length && <p className="muted">Thêm những việc cần chuẩn bị cho địa điểm này.</p>}{selected.checklist?.map(c => <div className="check-row" key={c.id}><label><input type="checkbox" checked={c.done} disabled={busy} onChange={() => void updateLocation({ ...selected, checklist: selected.checklist?.map(item => item.id === c.id ? { ...item, done: !item.done } : item) }, `${c.done ? 'Mở lại' : 'Hoàn thành'}: ${c.label}`)} /><span className={c.done ? 'done' : ''}>{c.label}</span></label><button className="icon-button" disabled={busy} aria-label={`Xóa ${c.label}`} onClick={() => void updateLocation({ ...selected, checklist: selected.checklist?.filter(item => item.id !== c.id) }, `Bỏ checklist: ${c.label}`)}><X size={15} /></button></div>)}<form className="check-form" onSubmit={e => { e.preventDefault(); if (checkLabel.trim()) void updateLocation({ ...selected, checklist: [...(selected.checklist || []), { id: uid(), label: checkLabel.trim(), done: false }] }, `Thêm checklist: ${checkLabel.trim()}`).then(ok => ok && setCheckLabel('')); }}><input aria-label="Việc cần chuẩn bị" placeholder="Thêm việc cần chuẩn bị…" value={checkLabel} onChange={e => setCheckLabel(e.target.value)} required /><button disabled={busy || !checkLabel.trim()} aria-label="Thêm checklist"><Plus size={18} /></button></form></>}
          {tab === 'History' && <><div className="tab-title"><History /><h3>Lịch sử địa điểm</h3></div>{selected.history?.map(h => <div className="history-item" key={h.id}><span /><div><p>{h.action}</p><time dateTime={h.at}>{new Date(h.at).toLocaleString('vi-VN')}</time></div></div>)}</>}
          </div></div>
          <div className="detail-actions"><button disabled={busy || !tour || !!selectedStop || selected.status === 'archived'} onClick={() => void add(selected)}><Plus size={16} />Add to Tour</button><button onClick={() => setEdit(selected)} disabled={busy}><Pencil size={16} />Edit</button><button className="danger" disabled={busy || !selectedStop} onClick={() => tour && selectedStop && void updateTour(removeStopFromTour(tour, selectedStop.id), selected.id, `Bỏ pin khỏi tour “${tour.title}”`)}><MapPin size={16} />Remove Pin</button><button disabled={busy} onClick={() => void updateLocation({ ...selected, status: selected.status === 'active' ? 'archived' : 'active' }, selected.status === 'active' ? 'Lưu trữ địa điểm' : 'Khôi phục địa điểm')}><Archive size={16} />{selected.status === 'archived' ? 'Restore' : 'Archive'}</button><button className='danger' disabled={busy} onClick={() => void deleteLocation(selected)}><Trash2 size={16} />Delete spot</button></div>
        </>}
      </aside>
    </main>}
    {!isMobile && desktopRouteOpen && tour && stops.length >= 2 && <DesktopRouteMap tour={tour} stops={stops} busy={busy} onClose={() => setDesktopRouteOpen(false)} onUpdateTour={updateTour} />}
    {message && <div role="status" className="toast"><Check size={16} />{message}</div>}
    {builderOpen && <Modal title="Chọn spots để tạo tour" onClose={() => setBuilderOpen(false)}><TourBuilder locations={data?.locations || []} busy={busy} error={error} onCreate={createSelectedTour} /></Modal>}
    {library && <Modal title={library === 'archived' ? 'Archived Spots' : libraryView === 'today' ? 'Hôm nay' : libraryView === 'review' ? 'Cần xem lại' : 'Scout Library'} onClose={() => setLibrary(null)}><div className="library-body"><div className="library-tools"><div className="input-icon"><Search size={18} /><input aria-label="Tìm trong thư viện" placeholder="Tìm theo tên hoặc khu vực…" value={libraryQuery} onChange={e => setLibraryQuery(e.target.value)} /></div><button onClick={() => { setLibrary(null); openNewLocation(); }} disabled={!data || busy}><Plus size={17} />Add Spot</button></div>{library === 'active' && <div className="library-filter-bar"><button aria-pressed={libraryView === 'all'} onClick={() => setLibraryView('all')}>Tất cả</button><button aria-pressed={libraryView === 'today'} onClick={() => setLibraryView('today')}>Hôm nay <b>{todayCount}</b></button><button aria-pressed={libraryView === 'review'} onClick={() => setLibraryView('review')}>Cần xem lại <b>{reviewCount}</b></button></div>}<div className="library-grid">{libraryItems.map(l => <article className="library-card" key={l.id}><Photo url={l.photos?.[0]?.url} name={l.name} /><h3>{l.name}</h3><p>{l.region || 'Chưa ghi khu vực'}</p><div><button onClick={() => { setSelectedId(l.id); setLibrary(null); setMobileHome(false); setMobileDetails(true); }}>Xem chi tiết</button>{library === 'archived' ? <button disabled={busy} onClick={() => void updateLocation({ ...l, status: 'active' }, 'Khôi phục địa điểm')}>Restore</button> : <button disabled={busy || !tour || tour.stops.some(s => s.location_id === l.id)} onClick={() => void add(l)}>{tour?.stops.some(s => s.location_id === l.id) ? 'Đã trong tour' : 'Add to Tour'}</button>}</div></article>)}</div>{!libraryItems.length && <Empty icon={library === 'archived' ? <Archive /> : <MapIcon />} title={libraryQuery ? 'Không tìm thấy địa điểm' : 'Chưa có địa điểm'}>{library === 'archived' ? 'Những địa điểm được lưu trữ sẽ xuất hiện ở đây.' : 'Thêm địa điểm thật để xây dựng thư viện khảo sát của bạn.'}</Empty>}</div></Modal>}
    {tourEditor && <Modal title="Tạo lộ trình khảo sát" onClose={() => setTourEditor(false)}><form className="editor-form" onSubmit={saveTour}><label>Tên tour<input name="title" required maxLength={150} autoFocus placeholder="Tên lộ trình của bạn" /></label><label>Ngày khảo sát<input name="date" type="date" /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" onClick={() => setTourEditor(false)}>Hủy</button><button className="primary" disabled={busy || !data}>Tạo tour</button></div></form></Modal>}
    {edit && <Modal title={edit === 'new' ? 'Thêm địa điểm khảo sát' : 'Chỉnh sửa địa điểm'} onClose={closeEditor}><form className="editor-form" onSubmit={saveLocation}>{edit === 'new' && draftPoint && <p className="helper">Pin tạm trên bản đồ · chưa được lưu. Bạn có thể chỉnh tọa độ trước khi lưu.</p>}
      <div className="form-grid"><label className="full">Tên địa điểm<input autoFocus name="name" required maxLength={150} defaultValue={edit === 'new' ? '' : edit.name} placeholder="Tên địa điểm thực tế" /></label><label>Khu vực<input name="region" defaultValue={edit === 'new' ? '' : edit.region} /></label><label>Trạng thái<select name="status" defaultValue={edit === 'new' ? 'not_scouted' : edit.scouting_status || 'not_scouted'}>{Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label><label>Vĩ độ<input name="lat" type="number" step="any" min="-90" max="90" required defaultValue={edit === 'new' ? draftPoint?.lat ?? '' : edit.coordinates.lat} /></label><label>Kinh độ<input name="lng" type="number" step="any" min="-180" max="180" required defaultValue={edit === 'new' ? draftPoint?.lng ?? '' : edit.coordinates.lng} /></label><label>Thời điểm phù hợp<input name="time" defaultValue={edit === 'new' ? '' : edit.best_time_to_shoot} /></label><label>Đường vào / phương tiện<input name="access" defaultValue={edit === 'new' ? '' : edit.access} /></label><label className="full">Why here<textarea name="description" rows={2} defaultValue={edit === 'new' ? '' : edit.description} /></label><label className="full">Highlights · mỗi dòng một mục<textarea name="highlights" rows={2} defaultValue={edit === 'new' ? '' : edit.camera_angles.join('\n')} /></label><label className="full">Ghi chú<textarea name="notes" rows={3} defaultValue={edit === 'new' ? '' : edit.scouting_notes} /></label><label className="full">Liên kết thư mục Google Drive<input name="folder" type="url" placeholder="https://drive.google.com/drive/folders/…" defaultValue={edit === 'new' ? '' : edit.drive_reference.folder_url} /></label><label className="full">URL ảnh thực tế · mỗi dòng một URL<textarea name="photos" rows={3} defaultValue={edit === 'new' ? '' : edit.photos?.map(p => p.url).join('\n')} /><span className="helper">Dùng liên kết trực tiếp tới ảnh có quyền xem. Không tự tải tư liệu từ Drive.</span></label></div>
      {edit === 'new' && tour && <label className="inline-check"><input type="checkbox" name="addToTour" defaultChecked />Thêm vào “{tour.title}”</label>}
      {edit !== 'new' && selectedStop && <p className="helper">Thời lượng dừng hiện tại: {selectedStop.planned_duration_minutes} phút. <button type="button" onClick={() => { setEdit(null); setTab('Details'); setDurationEditor(true); }}>Sửa thời lượng</button></p>}
      {error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" onClick={closeEditor}>Hủy</button><button className="primary" disabled={busy}><Check size={16} />Lưu địa điểm</button></div></form></Modal>}
    {durationEditor && tour && selectedStop && <Modal title="Thời lượng điểm dừng" onClose={() => setDurationEditor(false)}><form className="editor-form" onSubmit={e => { e.preventDefault(); const minutes = Number(new FormData(e.currentTarget).get('minutes')); void updateTour({ ...tour, updated_at: now(), stops: tour.stops.map(s => s.id === selectedStop.id ? { ...s, planned_duration_minutes: minutes } : s) }).then(ok => ok && setDurationEditor(false)); }}><label>Thời lượng (phút)<input autoFocus name="minutes" type="number" min="0" step="1" required defaultValue={selectedStop.planned_duration_minutes} /></label><button className="primary" disabled={busy}>Lưu thời lượng</button></form></Modal>}
  </div>;
}
