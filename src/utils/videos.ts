import { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS } from '../../shared/videos.mjs';
import type { ScoutLocation } from '../types/scout';
export type SavedVideo = NonNullable<ScoutLocation['videos']>[number];
export type DraftVideo = { id: string; blob: File; preview: string; name: string; duration: number; mime: string };
export async function prepareVideo(file: File): Promise<DraftVideo> {
  if (!file.size || file.size > MAX_VIDEO_BYTES) throw new Error(file.name + ': video tối đa 20 MB.');
  const mime = file.type || (/\.mov$/i.test(file.name) ? 'video/quicktime' : /\.mp4$/i.test(file.name) ? 'video/mp4' : '');
  if (!['video/mp4', 'video/quicktime'].includes(mime)) throw new Error('Hãy chọn MP4 hoặc MOV.');
  const preview = URL.createObjectURL(file); const element = document.createElement('video');
  element.preload = 'metadata'; element.muted = true;
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Không đọc được video. Hãy thử xuất MP4 rồi chọn lại.')), 15000);
      element.onloadedmetadata = () => { clearTimeout(timer); resolve(element.duration); };
      element.onerror = () => { clearTimeout(timer); reject(new Error('Trình duyệt chưa đọc được video này. Hãy xuất MP4 rồi chọn lại.')); };
      element.src = preview;
    });
    if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_VIDEO_SECONDS) throw new Error('Video phải dài hơn 0 và không quá 15 giây. Hãy cắt clip rồi chọn lại.');
    return { id: crypto.randomUUID(), blob: file, name: file.name, preview, duration, mime };
  } catch (e) { URL.revokeObjectURL(preview); throw e; }
  finally { element.onloadedmetadata = null; element.onerror = null; element.removeAttribute('src'); element.load(); }
}
export async function uploadVideos(videos: DraftVideo[], progress: (message: string) => void): Promise<SavedVideo[]> {
  const saved: SavedVideo[] = [];
  for (const [index, video] of videos.entries()) {
    progress('Đang tải video ' + (index + 1) + '/' + videos.length + '…');
    const bytes = await video.blob.arrayBuffer();
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
    const path = '/api/videos/' + hash; const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const response = await fetch(path, { method: 'PUT', headers: { 'Content-Type': video.mime }, body: video.blob, signal: controller.signal });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Phiên đăng nhập hết hạn hoặc máy chủ chưa hỗ trợ video. Hãy đăng nhập và thử lại.');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Không tải được video.');
      if (result.url !== path || !Number.isFinite(result.duration) || result.duration <= 0 || result.duration > MAX_VIDEO_SECONDS) throw new Error('Máy chủ trả về thông tin video không hợp lệ.');
      saved.push({ id: video.id, url: path, caption: video.name, duration: result.duration });
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') throw new Error('Tải video quá lâu. Clip vẫn được giữ để thử lại.');
      throw e;
    } finally { clearTimeout(timer); }
  }
  return saved;
}
