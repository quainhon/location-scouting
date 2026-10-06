import { useEffect, useRef, useState } from 'react';
import { Video, Upload, X } from 'lucide-react';
import { MAX_VIDEOS } from '../../shared/videos.mjs';
import { prepareVideo, uploadVideos, type DraftVideo, type SavedVideo } from '../utils/videos';
import '../videos.css';

export function useVideoDraft() {
  const [videos, setVideos] = useState<DraftVideo[]>([]);
  const current = useRef(videos); current.current = videos;
  useEffect(() => () => current.current.forEach(v => URL.revokeObjectURL(v.preview)), []);
  const clear = () => { current.current.forEach(v => URL.revokeObjectURL(v.preview)); setVideos([]); };
  return { videos, setVideos, clear };
}
export function VideoPicker({ videos, onChange, disabled, onPreparing, existingCount = 0 }: {
  videos: DraftVideo[]; onChange: (videos: DraftVideo[]) => void; disabled: boolean;
  onPreparing: (busy: boolean) => void; existingCount?: number;
}) {
  const camera = useRef<HTMLInputElement>(null); const library = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(''); const [preparing, setPreparing] = useState(false);
  const lock = useRef(false); const mounted = useRef(true);
  const notify = useRef(onPreparing); notify.current = onPreparing;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (lock.current) notify.current(false); }; }, []);
  async function select(files: File[]) {
    if (lock.current || disabled || !files.length) return;
    lock.current = true; setPreparing(true); onPreparing(true); setError('');
    const room = MAX_VIDEOS - existingCount - videos.length; const added: DraftVideo[] = []; const errors: string[] = [];
    if (files.length > room) errors.push('Mỗi spot tối đa ' + MAX_VIDEOS + ' video.');
    try {
      for (const file of files.slice(0, room)) {
        try { added.push(await prepareVideo(file)); } catch (e) { errors.push((e as Error).message); }
        if (!mounted.current) break;
      }
      if (mounted.current) { onChange([...videos, ...added]); setError(errors.join(' ')); }
      else added.forEach(v => URL.revokeObjectURL(v.preview));
    } finally { lock.current = false; if (mounted.current) { setPreparing(false); onPreparing(false); } }
  }
  const full = videos.length + existingCount >= MAX_VIDEOS;
  return <div className="scout-video-picker">
    <input ref={camera} hidden type="file" accept="video/mp4,video/quicktime,.mp4,.mov" capture="environment" aria-label="Quay video spot" onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void select(files); }} />
    <input ref={library} hidden type="file" accept="video/mp4,video/quicktime,.mp4,.mov" multiple aria-label="Chọn video spot" onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void select(files); }} />
    <div className="scout-video-actions"><button type="button" disabled={disabled || preparing || full} onClick={() => camera.current?.click()}><Video size={21} />Quay video</button><button type="button" disabled={disabled || preparing || full} onClick={() => library.current?.click()}><Upload size={21} />Chọn video</button></div>
    <small>{preparing ? 'Đang kiểm tra video…' : (videos.length + existingCount) + '/' + MAX_VIDEOS + ' clip · MP4/MOV · Tối đa 15 giây và 20 MB/clip'}</small>
    {videos.map((v, index) => <div className="scout-video-preview" key={v.id}><video controls playsInline preload="metadata" src={v.preview} aria-label={'Video đã chọn ' + (index + 1)} /><span>{v.duration.toFixed(1)} giây</span><button type="button" disabled={disabled || preparing} aria-label={'Bỏ video ' + (index + 1)} onClick={() => { URL.revokeObjectURL(v.preview); onChange(videos.filter(item => item.id !== v.id)); }}><X size={16} /></button></div>)}
    {error && <p role="alert" className="scout-error">{error}</p>}
  </div>;
}
export function VideoGallery({ videos }: { videos: SavedVideo[] }) {
  const [failed, setFailed] = useState<string[]>([]);
  return <section className="scout-video-gallery" aria-label="Video của spot">{!!videos.length && <h3>Video khảo sát</h3>}{videos.map(v => <figure key={v.id}><video controls playsInline preload="metadata" src={v.url} aria-label={v.caption || 'Video khảo sát'} onError={() => setFailed(ids => [...ids.filter(id => id !== v.id), v.id])} /><figcaption>{v.duration.toFixed(1)} giây</figcaption>{failed.includes(v.id) && <p role="alert">Chưa phát được clip. <a href={v.url} download>Tải video</a> để mở trên thiết bị.</p>}</figure>)}</section>;
}
export function AddLocationVideos({ existingCount, busy, onSave, onBusyChange }: {
  existingCount: number; busy: boolean; onSave: (videos: SavedVideo[]) => Promise<boolean>; onBusyChange: (busy: boolean) => void;
}) {
  const draft = useVideoDraft(); const [preparing, setPreparing] = useState(false); const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(''); const [progress, setProgress] = useState(''); const lock = useRef(false);
  useEffect(() => {
    if (!uploading && !draft.videos.length) return;
    const guard = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [uploading, draft.videos.length]);
  async function save() {
    if (lock.current || busy || preparing || !draft.videos.length) return;
    lock.current = true; setUploading(true); onBusyChange(true); setError('');
    try { const videos = await uploadVideos(draft.videos, setProgress); if (await onSave(videos)) draft.clear(); }
    catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setUploading(false); onBusyChange(false); }
  }
  return <section className="scout-add-videos"><h3>Thêm video ngắn</h3><VideoPicker videos={draft.videos} onChange={draft.setVideos} existingCount={existingCount} disabled={busy || uploading} onPreparing={value => { setPreparing(value); onBusyChange(value); }} />{error && <p role="alert" className="scout-error">{error}</p>}{!!draft.videos.length && <button type="button" disabled={busy || uploading || preparing} onClick={() => void save()}>{uploading ? progress : 'Lưu ' + draft.videos.length + ' video'}</button>}</section>;
}
