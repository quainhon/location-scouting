import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { MAX_PHOTOS, preparePhoto, uploadPhotos, type DraftPhoto, type SavedPhoto } from '../utils/photos';

export function usePhotoDraft() {
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const current = useRef(photos); current.current = photos;
  useEffect(() => () => { current.current.forEach(p => URL.revokeObjectURL(p.preview)); }, []);
  const clear = () => { current.current.forEach(p => URL.revokeObjectURL(p.preview)); setPhotos([]); };
  return { photos, setPhotos, clear };
}

export function PhotoPicker({ photos, onChange, disabled, onPreparing, existingCount = 0 }: {
  photos: DraftPhoto[]; onChange: (photos: DraftPhoto[]) => void; disabled: boolean;
  onPreparing: (preparing: boolean) => void; existingCount?: number;
}) {
  const camera = useRef<HTMLInputElement>(null); const library = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(''); const [preparing, setPreparing] = useState(false);
  const lock = useRef(false); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const full = photos.length + existingCount >= MAX_PHOTOS;
  async function select(files: File[]) {
    if (lock.current || disabled || !files.length) return;
    lock.current = true; setPreparing(true); onPreparing(true); setError('');
    const room = MAX_PHOTOS - photos.length - existingCount;
    const added: DraftPhoto[] = []; const errors: string[] = [];
    if (files.length > room) errors.push(`Mỗi địa điểm tối đa ${MAX_PHOTOS} ảnh; chỉ chọn ${room} ảnh đầu.`);
    try {
      for (const file of files.slice(0, room)) {
        try { added.push(await preparePhoto(file)); } catch (e) { errors.push((e as Error).message); }
        if (!mounted.current) break;
      }
      if (mounted.current) { onChange([...photos, ...added]); setError(errors.join(' ')); }
      else added.forEach(p => URL.revokeObjectURL(p.preview));
    } finally { lock.current = false; if (mounted.current) { setPreparing(false); onPreparing(false); } }
  }
  return <div className="scout-photo-picker">
    <input ref={camera} type="file" accept="image/*" capture="environment" hidden aria-label="Chụp ảnh địa điểm" onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void select(files); }} />
    <input ref={library} type="file" accept="image/*" multiple hidden aria-label="Chọn ảnh địa điểm" onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void select(files); }} />
    <div className="scout-photo-actions"><button type="button" disabled={disabled || preparing || full} onClick={() => camera.current?.click()}><Camera size={25} /><strong>Chụp ảnh</strong></button><button type="button" disabled={disabled || preparing || full} onClick={() => library.current?.click()}><ImagePlus size={25} /><strong>Chọn ảnh</strong></button></div>
    <small className="scout-photo-help">{preparing ? 'Đang chuẩn bị ảnh…' : `${photos.length + existingCount}/${MAX_PHOTOS} ảnh · Tự thu nhỏ để tải nhanh`}</small>
    {!!photos.length && <div className="scout-photo-previews">{photos.map((p, index) => <div key={p.id}><img src={p.preview} alt={`Ảnh đã chọn ${index + 1}`} /><button type="button" disabled={disabled || preparing} aria-label={`Bỏ ảnh ${index + 1}`} onClick={() => { URL.revokeObjectURL(p.preview); onChange(photos.filter(item => item.id !== p.id)); }}><X size={16} /></button></div>)}</div>}
    {error && <p className="scout-error" role="alert">{error}</p>}
  </div>;
}

export function AddLocationPhotos({ existingCount, busy, onSave, onBusyChange }: { existingCount: number; busy: boolean; onSave: (photos: SavedPhoto[]) => Promise<boolean>; onBusyChange: (value: boolean) => void }) {
  const draft = usePhotoDraft(); const [preparing, setPreparing] = useState(false);
  const [uploading, setUploading] = useState(false); const [progress, setProgress] = useState(''); const [error, setError] = useState(''); const lock = useRef(false);
  useEffect(() => {
    if (!uploading && !draft.photos.length) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [uploading, draft.photos.length]);
  async function save() {
    if (lock.current || busy || preparing) return;
    lock.current = true; setUploading(true); onBusyChange(true); setError('');
    try {
      const photos = await uploadPhotos(draft.photos, setProgress); setProgress('Đang gắn ảnh vào địa điểm…');
      if (await onSave(photos)) draft.clear();
    } catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setUploading(false); onBusyChange(false); setProgress(''); }
  }
  return <section className="scout-add-photos"><h3>Thêm ảnh địa điểm</h3><PhotoPicker photos={draft.photos} onChange={draft.setPhotos} disabled={busy || uploading} onPreparing={value => { setPreparing(value); onBusyChange(value); }} existingCount={existingCount} />{error && <p className="scout-error" role="alert">{error}</p>}{!!draft.photos.length && <button type="button" className="scout-primary" disabled={busy || uploading || preparing} onClick={() => void save()}>{uploading ? progress : `Lưu ${draft.photos.length} ảnh`}</button>}</section>;
}

export function PhotoGallery({ photos, name }: { photos: SavedPhoto[]; name: string }) {
  const [index, setIndex] = useState(0); const [failed, setFailed] = useState(false);
  const photo = photos[Math.min(index, photos.length - 1)];
  useEffect(() => setFailed(false), [photo?.url]);
  if (!photo) return <div className="scout-gallery-empty"><Camera size={30} /><span>Chưa có ảnh</span></div>;
  return <div className="scout-photo-gallery">{failed ? <p role="status">Chưa tải được ảnh. <button onClick={() => { setFailed(false); }}>Thử lại</button></p> : <img className="scout-gallery-hero" src={photo.url} alt={`${name} · ảnh ${index + 1}`} referrerPolicy="no-referrer" onError={() => setFailed(true)} />}<div className="scout-gallery-thumbs">{photos.map((p, i) => <button key={p.id} type="button" aria-label={`Xem ảnh ${i + 1}`} aria-pressed={i === index} onClick={() => setIndex(i)}><img src={p.url} alt="" referrerPolicy="no-referrer" /></button>)}</div><small>{Math.min(index + 1, photos.length)}/{photos.length} ảnh</small></div>;
}
