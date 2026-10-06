export const MAX_VIDEO_SECONDS = 15;
export const MAX_VIDEO_BYTES = 20_000_000;
export const MAX_VIDEOS = 4;
export const VIDEO_CHUNK_BYTES = 1_000_000;
export const VIDEO_ID = /^[a-f0-9]{64}$/;
export const VIDEO_PATH = /^\/api\/videos\/[a-f0-9]{64}$/;
export const VIDEO_SCHEMAS = [
  "CREATE TABLE IF NOT EXISTS location_videos (id TEXT PRIMARY KEY, location_id TEXT NOT NULL REFERENCES scout_locations(id), position INTEGER NOT NULL, url TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '', duration REAL NOT NULL CHECK(duration>0 AND duration<=15))",
  "CREATE TABLE IF NOT EXISTS scout_video_assets (id TEXT PRIMARY KEY, mime TEXT NOT NULL, duration REAL NOT NULL, size INTEGER NOT NULL CHECK(size<=20000000), created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS scout_video_chunks (asset_id TEXT NOT NULL REFERENCES scout_video_assets(id), position INTEGER NOT NULL, bytes BLOB NOT NULL CHECK(length(bytes)<=1000000), PRIMARY KEY(asset_id,position))",
];
// Inspect MP4/MOV container timing on the server; never trust a duration header.
export function videoDuration(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (at) => String.fromCharCode(...bytes.subarray(at, at + 4));
  function boxes(start, end) {
    const out = [];
    while (start < end) {
      if (start + 8 > end) throw new Error('Video bị thiếu dữ liệu.');
      let size = view.getUint32(start); let header = 8;
      if (size === 1) { if (start + 16 > end) throw new Error('Video bị lỗi.'); size = Number(view.getBigUint64(start + 8)); header = 16; }
      if (!size) size = end - start;
      if (!Number.isSafeInteger(size) || size < header || start + size > end) throw new Error('Video bị lỗi.');
      out.push({ type: text(start + 4), start: start + header, end: start + size }); start += size;
    }
    return out;
  }
  function timing(box) {
    if (!box || box.start + 4 > box.end) throw new Error('Không đọc được thời lượng video.');
    const version = bytes[box.start]; if (version !== 0 && version !== 1) throw new Error('Video không được hỗ trợ.');
    const at = box.start + (version === 1 ? 20 : 12);
    if (at + (version === 1 ? 12 : 8) > box.end) throw new Error('Video bị thiếu dữ liệu.');
    const scale = view.getUint32(at);
    const ticks = version === 1 ? Number(view.getBigUint64(at + 4)) : view.getUint32(at + 4);
    const seconds = ticks / scale;
    if (!scale || !Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_VIDEO_SECONDS) throw new Error('Video phải dài hơn 0 và không quá 15 giây.');
    return seconds;
  }
  const root = boxes(0, bytes.length); const moov = root.find(b => b.type === 'moov');
  if (!root.some(b => b.type === 'ftyp') || !moov || !root.some(b => b.type === 'mdat' && b.end > b.start)) throw new Error('Hãy chọn video MP4 hoặc MOV hợp lệ.');
  const children = boxes(moov.start, moov.end);
  const movie = timing(children.find(b => b.type === 'mvhd')); let video = false; let longest = movie;
  for (const track of children.filter(b => b.type === 'trak')) {
    const mdia = boxes(track.start, track.end).find(b => b.type === 'mdia'); if (!mdia) continue;
    const media = boxes(mdia.start, mdia.end); const handler = media.find(b => b.type === 'hdlr');
    if (handler && handler.start + 12 <= handler.end && text(handler.start + 8) === 'vide') {
      video = true; longest = Math.max(longest, timing(media.find(b => b.type === 'mdhd')));
    }
  }
  if (!video) throw new Error('File không chứa hình ảnh video.');
  return longest;
}
export function validVideos(videos) {
  return videos === undefined || (Array.isArray(videos) && videos.length <= MAX_VIDEOS && videos.every(v =>
    v && typeof v.id === 'string' && v.id.length > 0 && v.id.length < 160 && VIDEO_PATH.test(v.url) &&
    typeof v.caption === 'string' && v.caption.length <= 20000 && Number.isFinite(v.duration) && v.duration > 0 && v.duration <= MAX_VIDEO_SECONDS));
}
const json = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function videoResponse(request, id, storage) {
  if (!VIDEO_ID.test(id)) return json(400, { error: 'Mã video không hợp lệ.' });
  if (!['GET', 'HEAD', 'PUT'].includes(request.method)) return json(405, { error: 'Method not allowed.' });
  if (request.method !== 'PUT') {
    const asset = await storage.get(id); if (!asset) return json(404, { error: 'Không tìm thấy video.' });
    const size = asset.bytes.length; const headers = {
      'Content-Type': asset.mime, 'Cache-Control': 'private, max-age=3600', 'Accept-Ranges': 'bytes',
      'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin',
    };
    const range = request.headers.get('range');
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      let start = match?.[1] ? Number(match[1]) : 0;
      let end = match?.[2] ? Number(match[2]) : size - 1;
      if (match && !match[1] && match[2]) { start = Math.max(0, size - Number(match[2])); end = size - 1; }
      if (!match || (!match[1] && !match[2]) || start >= size || start > end) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': 'bytes */' + size } });
      end = Math.min(end, size - 1);
      return new Response(request.method === 'HEAD' ? null : asset.bytes.slice(start, end + 1), { status: 206, headers: { ...headers, 'Content-Length': String(end - start + 1), 'Content-Range': 'bytes ' + start + '-' + end + '/' + size } });
    }
    return new Response(request.method === 'HEAD' ? null : asset.bytes, { headers: { ...headers, 'Content-Length': String(size) } });
  }
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') return json(403, { error: 'Origin not allowed.' });
  const mime = request.headers.get('content-type')?.split(';')[0];
  if (!['video/mp4', 'video/quicktime'].includes(mime)) return json(415, { error: 'Chỉ nhận video MP4 hoặc MOV.' });
  if (Number(request.headers.get('content-length')) > MAX_VIDEO_BYTES) return json(413, { error: 'Video tối đa 20 MB.' });
  const reader = request.body?.getReader(); if (!reader) return json(400, { error: 'Thiếu video.' });
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > MAX_VIDEO_BYTES) { await reader.cancel(); return json(413, { error: 'Video tối đa 20 MB.' }); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let duration;
  try { duration = videoDuration(bytes); } catch (e) { return json(415, { error: e.message }); }
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== id) return json(400, { error: 'Video tải lên bị thay đổi. Hãy chọn lại.' });
  await storage.put(id, { bytes, mime, duration });
  return json(200, { url: '/api/videos/' + id, duration });
}
