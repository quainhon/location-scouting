import { MAX_PHOTO_BYTES } from '../../shared/photos.mjs';
import type { ScoutLocation } from '../types/scout';

export const MAX_PHOTOS = 12;
export type DraftPhoto = { id: string; name: string; blob: Blob; preview: string };
export type SavedPhoto = NonNullable<ScoutLocation['photos']>[number];

export async function preparePhoto(file: File): Promise<DraftPhoto> {
  if (file.size > 20_000_000) throw new Error(`${file.name}: ảnh gốc vượt 20 MB.`);
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type) && !(file.type === '' && /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))) throw new Error(`${file.name}: hãy chọn JPEG, PNG hoặc WebP.`);
  const source = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = source;
    try { await image.decode(); } catch { throw new Error(`${file.name}: không đọc được ảnh. Với HEIC, hãy xuất JPEG rồi chọn lại.`); }
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 48_000_000) throw new Error(`${file.name}: độ phân giải quá lớn (tối đa 48 MP).`);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d'); if (!context) throw new Error('Trình duyệt chưa hỗ trợ xử lý ảnh.');
    let edge = 1920;
    for (let pass = 0; pass < 4; pass++) {
      const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      // Re-encoding strips EXIF and keeps uploads small; the location supplies GPS.
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Không nén được ảnh.')), 'image/jpeg', 0.82 - pass * 0.08));
      if (blob.size <= MAX_PHOTO_BYTES) return { id: crypto.randomUUID(), name: file.name, blob, preview: URL.createObjectURL(blob) };
      edge = Math.round(edge * 0.75);
    }
    throw new Error(`${file.name}: không thể thu nhỏ ảnh dưới 1 MB.`);
  } finally { URL.revokeObjectURL(source); image.src = ''; }
}

export async function uploadPhotos(photos: DraftPhoto[], progress: (message: string) => void): Promise<SavedPhoto[]> {
  const saved: SavedPhoto[] = [];
  for (const [index, photo] of photos.entries()) {
    progress(`Đang tải ảnh ${index + 1}/${photos.length}…`);
    const bytes = await photo.blob.arrayBuffer();
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
    const path = `/api/photos/${hash}`;
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(path, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: photo.blob, signal: controller.signal });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Phiên đăng nhập hết hạn hoặc máy chủ chưa hỗ trợ tải ảnh. Hãy đăng nhập lại và thử lại.');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Không tải được ảnh ${index + 1}.`);
      if (result.url !== path) throw new Error('Máy chủ trả về đường dẫn ảnh không hợp lệ.');
      saved.push({ id: photo.id, url: path, caption: photo.name });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('Tải ảnh quá lâu. Ảnh vẫn được giữ để thử lại.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  return saved;
}
