export const MAX_PHOTO_BYTES = 1_000_000;
export const PHOTO_ID = /^[a-f0-9]{64}$/;
export const PHOTO_PATH = /^\/api\/photos\/[a-f0-9]{64}$/;
export const PHOTO_SCHEMA = `CREATE TABLE IF NOT EXISTS scout_photo_assets (
  id TEXT PRIMARY KEY, bytes BLOB NOT NULL CHECK(length(bytes) <= 1000000), created_at TEXT NOT NULL
)`;

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// One protocol for Pages/D1 and the local SQLite server. Binary payloads never
// travel in the revisioned workspace snapshot or become public Drive links.
export async function photoResponse(request, id, storage) {
  if (!PHOTO_ID.test(id)) return json(400, { error: 'Mã ảnh không hợp lệ.' });
  if (!['GET', 'PUT'].includes(request.method)) return json(405, { error: 'Method not allowed.' });
  if (request.method === 'GET') {
    const bytes = await storage.get(id);
    return bytes ? new Response(bytes, { headers: {
      'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Disposition': `inline; filename="scout-${id.slice(0, 12)}.jpg"`,
    } }) : json(404, { error: 'Không tìm thấy ảnh.' });
  }
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') return json(403, { error: 'Origin not allowed.' });
  if (request.headers.get('content-type')?.split(';')[0] !== 'image/jpeg') return json(415, { error: 'Ảnh cần được chuyển sang JPEG trước khi tải lên.' });
  if (Number(request.headers.get('content-length')) > MAX_PHOTO_BYTES) return json(413, { error: 'Ảnh sau nén phải nhỏ hơn 1 MB.' });
  const reader = request.body?.getReader();
  if (!reader) return json(400, { error: 'Thiếu dữ liệu ảnh.' });
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_PHOTO_BYTES) { await reader.cancel(); return json(413, { error: 'Ảnh sau nén phải nhỏ hơn 1 MB.' }); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  if (size < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff || bytes[size - 2] !== 0xff || bytes[size - 1] !== 0xd9) return json(415, { error: 'Dữ liệu không phải ảnh JPEG hợp lệ.' });
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== id) return json(400, { error: 'Ảnh tải lên bị thay đổi. Hãy chọn lại ảnh.' });
  await storage.put(id, bytes);
  return json(200, { url: `/api/photos/${id}` });
}
