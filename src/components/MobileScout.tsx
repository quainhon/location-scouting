import { useEffect, useRef, useState } from 'react';
import { Archive, Check, ChevronRight, Compass, ExternalLink, LocateFixed, Map as MapIcon, MapPin, Plus, Search, X } from 'lucide-react';
import type { GeoPoint, ScoutLocation } from '../types/scout';
import { ScoutMap } from './ScoutMap';
import { createQuickCapture, impressions, isToday, scoutLabel } from '../utils/quickCapture';
import '../scout-mobile.css';
import { AddLocationPhotos, PhotoGallery, PhotoPicker, usePhotoDraft } from './ScoutPhotos';
import { uploadPhotos } from '../utils/photos';

type Props = {
  locations: ScoutLocation[]; ready: boolean; busy: boolean; error: string;
  onCreate: (location: ScoutLocation) => Promise<boolean>;
  onUpdate: (location: ScoutLocation, action: string) => Promise<boolean>;
  onEdit: (location: ScoutLocation) => void;
};

export function MobileScout({ locations, ready, busy, error, onCreate, onUpdate, onEdit }: Props) {
  const photoDraft = usePhotoDraft();
  const [mediaBusy, setMediaBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [photoError, setPhotoError] = useState('');
  const submitLock = useRef(false);
  const working = busy || mediaBusy || uploading;
  const [page, setPage] = useState<'map' | 'scouts' | 'library'>('map');
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
  const [session, setSession] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [fit, setFit] = useState(0);
  const [pickSignal, setPickSignal] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const gpsRequest = useRef(0);
  const captureId = useRef<ScoutLocation | null>(null);
  const active = locations.filter(l => l.status === 'active');
  const selected = locations.find(l => l.id === selectedId);
  const today = active.filter(l => isToday(l.created_at));
  const visible = locations.filter(l => {
    if (filter === 'archived' ? l.status !== 'archived' : l.status !== 'active') return false;
    if (filter === 'today' && !isToday(l.created_at)) return false;
    if (filter === 'review' && ['scouted', 'approved'].includes(l.scouting_status || '')) return false;
    return `${l.name} ${l.region} ${l.scouting_notes}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'));
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  useEffect(() => { if (capture || selected) dialog.current?.showModal(); }, [capture, selectedId]);
  useEffect(() => () => { gpsRequest.current++; }, []);
  useEffect(() => {
    if (!photoDraft.photos.length && !uploading) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [photoDraft.photos.length, uploading]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    if (!session) return;
    const update = () => setElapsed(Math.floor((Date.now() - session) / 1000));
    update(); const timer = setInterval(update, 1000); return () => clearInterval(timer);
  }, [session]);
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
      const photos = await uploadPhotos(photoDraft.photos, setProgress);
      setProgress('Đang lưu địa điểm…');
      captureId.current = { ...draft, coordinates: point, name: name.trim() || draft.name, scouting_notes: notes.trim(), tags: rating ? [`scout:rating:${rating}`] : [], photos };
      if (await onCreate(captureId.current)) {
        gpsRequest.current++; setLocating(false); setCapture(false); setPoint(null); setName(''); setNotes(''); setRating(''); captureId.current = null;
        photoDraft.clear();
        setPage('map'); setFit(n => n + 1); if (session) setSessionCount(n => n + 1);
        setNotice('Đã lưu địa điểm và ảnh. Sẵn sàng cho điểm tiếp theo.');
      }
    } catch (e) { setPhotoError((e as Error).message); }
    finally { submitLock.current = false; setUploading(false); setProgress(''); }
  }
  function navigate(next: typeof page) { setPage(next); setFilter(next === 'scouts' ? 'today' : 'all'); setQuery(''); }
  const tabs = [['map', MapIcon, 'Bản đồ'], ['scouts', MapPin, 'Đã scout'], ['library', Archive, 'Thư viện']] as const;
  return <div className="scout-mobile">
    <header className="scout-header"><span className="scout-brand"><Compass size={25} /><span>QUÀI NHƠN<strong>Location Scout</strong></span></span><span className="scout-connection">{busy ? 'Đang lưu…' : ready ? 'Sẵn sàng' : 'Đang kết nối…'}</span></header>
    <main className="scout-content">
      {page === 'map' ? <section className="scout-map" aria-label="Bản đồ khảo sát">
        <ScoutMap locations={active} stops={[]} selectedId="" onSelect={setSelectedId} onCreateDraft={p => { if (ready && !busy) startCapture(p); }} draftPoint={point} fitSignal={fit} pickSignal={pickSignal} />
        <div className="scout-map-top"><button onClick={() => navigate('library')}><Search size={18} />Tìm địa điểm đã lưu</button><div className="scout-chips"><button onClick={() => navigate('scouts')}>Hôm nay <b>{today.length}</b></button><button onClick={() => { navigate('library'); setFilter('review'); }}>Cần xem lại <b>{active.filter(l => !['scouted', 'approved'].includes(l.scouting_status || '')).length}</b></button></div></div>
        <div className="scout-map-bottom">
          {session ? <div className="scout-session"><span><i />Đang scout <b>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</b></span><small>{sessionCount} điểm đã lưu · Không ghi hành trình GPS</small><button onClick={() => { setNotice(`Kết thúc buổi scout · ${sessionCount} điểm đã lưu.`); setSession(null); }}>Kết thúc</button></div> : <button className="scout-session-start" onClick={() => { setSession(Date.now()); setSessionCount(0); }}>Bắt đầu buổi scout <ChevronRight size={16} /></button>}
          <button className="scout-primary" disabled={!ready || busy} onClick={() => startCapture()}><Plus size={25} />{point || name || notes || rating || photoDraft.photos.length ? 'TIẾP TỤC SCOUT' : 'SCOUT'}</button>
          <span className="scout-caption">Lưu điểm trước · Bổ sung chi tiết sau</span>
        </div>
      </section> : <section className="scout-list">
        <div className="scout-list-title"><div><p>NHỮNG ĐIỂM BẠN TÌM THẤY</p><h1>{page === 'scouts' ? 'Đã scout' : 'Thư viện'}</h1></div><button aria-label="Thêm địa điểm" disabled={!ready || busy} onClick={() => startCapture()}><Plus /></button></div>
        <label className="scout-search"><Search size={19} /><input aria-label="Tìm địa điểm" placeholder="Tên, khu vực hoặc ghi chú…" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <div className="scout-filters">{[['all', 'Tất cả'], ['today', 'Hôm nay'], ['review', 'Cần xem lại'], ...(page === 'library' ? [['archived', 'Lưu trữ']] : [])].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <p className="scout-count">{visible.length} địa điểm</p>
        {!visible.length && <div className="scout-empty"><MapPin size={36} /><h2>{query ? 'Chưa tìm thấy điểm phù hợp' : 'Một điểm hay đang chờ bạn'}</h2><p>{query ? 'Thử tên khác hoặc thay bộ lọc.' : 'Mở bản đồ và nhấn + Scout để lưu điểm đầu tiên.'}</p><button onClick={() => navigate('map')}>Về bản đồ</button></div>}
        {visible.map(l => <button className="scout-card" key={l.id} onClick={() => setSelectedId(l.id)}><Thumbnail location={l} /><span><strong>{l.name}</strong><small>{new Date(l.created_at).toLocaleString('vi-VN', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })} · {l.region || 'Chưa ghi khu vực'}</small><em>{impressions.find(i => l.tags.includes(`scout:rating:${i.value}`))?.icon} {l.status === 'archived' ? 'Đã lưu trữ' : scoutLabel(l)}</em></span><ChevronRight size={18} /></button>)}
      </section>}
    </main>
    <nav className="scout-nav" aria-label="Điều hướng mobile">{tabs.map(([key, Icon, label]) => <button key={key} aria-current={page === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon size={21} /><span>{label}</span></button>)}</nav>
    {(capture || selected) && <dialog className="scout-sheet" ref={dialog} aria-labelledby="scout-sheet-title" onCancel={e => { e.preventDefault(); close(); }}>
      <div className="scout-handle" /><div className="scout-sheet-heading"><div><p>{capture ? 'QUICK CAPTURE' : 'ĐỊA ĐIỂM CỦA BẠN'}</p><h2 id="scout-sheet-title">{capture ? 'Lưu một điểm hay' : selected?.name}</h2></div><button aria-label="Đóng bảng" disabled={working} onClick={close}><X /></button></div>
      {capture ? <form onSubmit={e => { e.preventDefault(); void submit(); }}>
        <div className="scout-position"><LocateFixed size={19} /><div><strong>{point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : 'Chưa có vị trí'}</strong><small role="status">{gps}</small></div></div>
        <div className="scout-location-actions"><button type="button" disabled={locating || working} onClick={locate}>Thử lại GPS</button><button type="button" disabled={working} onClick={() => { gpsRequest.current++; setLocating(false); setCapture(false); setPage('map'); setPickSignal(n => n + 1); }}>Chọn trên bản đồ</button></div>
        <PhotoPicker photos={photoDraft.photos} onChange={photoDraft.setPhotos} disabled={busy || uploading} onPreparing={setMediaBusy} />
        <fieldset className="scout-rating"><legend>Cảm nhận của bạn <small>Không bắt buộc</small></legend><div>{impressions.map(i => <button type="button" disabled={working} key={i.value} aria-pressed={rating === i.value} onClick={() => setRating(rating === i.value ? '' : i.value)}><span>{i.icon}</span>{i.label}</button>)}</div></fieldset>
        <details className="scout-extras"><summary>Thêm tên / ghi chú</summary><label>Tên địa điểm<input disabled={working} value={name} maxLength={150} onChange={e => setName(e.target.value)} placeholder="Để trống để đặt tên tự động" /></label><label>Ghi chú<textarea disabled={working} value={notes} maxLength={20000} rows={3} onChange={e => setNotes(e.target.value)} placeholder="Đường vào, giờ đẹp, điều cần kiểm tra…" /></label></details>
        {error && <p className="scout-error" role="alert">{error}</p>}
        {photoError && <p className="scout-error" role="alert">{photoError}</p>}<div className="scout-save"><button className="scout-primary" disabled={!point || !ready || working || locating}><Check size={20} />{uploading ? progress || 'Đang chuẩn bị…' : busy ? 'Đang lưu…' : 'Lưu địa điểm'}</button><small>Đóng bảng vẫn giữ bản nháp trong lần mở này.</small></div>
      </form> : selected && <div className="scout-detail"><PhotoGallery photos={selected.photos || []} name={selected.name} /><AddLocationPhotos key={selected.id} existingCount={selected.photos?.length || 0} busy={busy} onBusyChange={setMediaBusy} onSave={photos => onUpdate({ ...selected, photos: [...(selected.photos || []).filter(p => !photos.some(n => n.id === p.id)), ...photos] }, `Thêm ${photos.length} ảnh khảo sát`)} /><p>{selected.region || 'Chưa ghi khu vực'} · {scoutLabel(selected)}</p><p className="scout-detail-notes">{selected.scouting_notes || 'Chưa có ghi chú. Bạn có thể bổ sung sau.'}</p><a className="button" href={`https://www.google.com/maps/search/?api=1&query=${selected.coordinates.lat},${selected.coordinates.lng}`} target="_blank" rel="noreferrer"><ExternalLink size={17} />Mở trên Google Maps</a><div className="scout-detail-status">{[['not_scouted', 'Mới lưu'], ['scouted', 'Đã khảo sát'], ['approved', 'Giữ lại']].map(([value, label]) => <button key={value} disabled={working} aria-pressed={selected.scouting_status === value || value === 'not_scouted' && selected.scouting_status === 'candidate'} onClick={() => void onUpdate({ ...selected, scouting_status: value as ScoutLocation['scouting_status'] }, `Trạng thái: ${label}`)}>{label}</button>)}</div>{error && <p className="scout-error" role="alert">{error}</p>}<button className="scout-primary" disabled={working} onClick={() => { setSelectedId(''); onEdit(selected); }}>Chỉnh sửa chi tiết</button><button className="scout-archive" disabled={working} onClick={() => void onUpdate({ ...selected, status: selected.status === 'active' ? 'archived' : 'active' }, selected.status === 'active' ? 'Lưu trữ địa điểm' : 'Khôi phục địa điểm').then(ok => { if (ok) { setSelectedId(''); setNotice('Đã cập nhật địa điểm.'); } })}><Archive size={16} />{selected.status === 'active' ? 'Lưu trữ địa điểm' : 'Khôi phục địa điểm'}</button></div>}
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
