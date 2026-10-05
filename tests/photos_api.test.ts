import { describe, expect, it, vi } from 'vitest';
import { MAX_PHOTO_BYTES, photoResponse, type PhotoStorage } from '../shared/photos.mjs';
import { onRequest } from '../functions/api/photos/[id]';
import { uploadPhotos, type DraftPhoto } from '../src/utils/photos';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 0xff, 0xd9]);
const hash = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)))].map(b => b.toString(16).padStart(2, '0')).join('');
const storage = (): PhotoStorage => {
  const entries = new Map<string, Uint8Array>();
  return { get: async id => entries.get(id) || null, put: async (id, bytes) => { entries.set(id, bytes); } };
};
const request = (id: string, bytes = jpeg, headers: Record<string, string> = {}) => new Request(`https://scout.test/api/photos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg', ...headers }, body: bytes });

describe('photo API contract shared by local and Pages', () => {
  it('uploads idempotently and serves private JPEG bytes', async () => {
    const db = storage(); const id = await hash(jpeg);
    for (let i = 0; i < 2; i++) {
      const res = await photoResponse(request(id), id, db);
      expect(res.status).toBe(200); expect(await res.json()).toEqual({ url: `/api/photos/${id}` });
    }
    const res = await photoResponse(new Request(`https://scout.test/api/photos/${id}`), id, db);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(jpeg);
    expect(res.headers.get('cache-control')).toContain('private');
    expect(res.headers.get('content-type')).toBe('image/jpeg');
  });
  it('rejects cross-origin upload, wrong types, corrupt bytes and mismatched hashes', async () => {
    const db = storage(); const id = await hash(jpeg);
    expect((await photoResponse(request(id, jpeg, { origin: 'https://evil.test' }), id, db)).status).toBe(403);
    expect((await photoResponse(request(id, jpeg, { 'Content-Type': 'image/svg+xml' }), id, db)).status).toBe(415);
    expect((await photoResponse(request(id, new Uint8Array([1, 2, 3, 4])), id, db)).status).toBe(415);
    expect((await photoResponse(request('a'.repeat(64)), 'a'.repeat(64), db)).status).toBe(400);
    expect(await db.get(id)).toBeNull();
  });
  it('enforces size while streaming even without Content-Length', async () => {
    const bytes = new Uint8Array(MAX_PHOTO_BYTES + 1); const id = 'b'.repeat(64);
    expect((await photoResponse(request(id, bytes), id, storage())).status).toBe(413);
  });
  it('does not read storage for invalid IDs, and returns missing images as 404', async () => {
    const db = storage(); const spy = vi.spyOn(db, 'get');
    expect((await photoResponse(new Request('https://scout.test/api/photos/..'), '..', db)).status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
    expect((await photoResponse(new Request('https://scout.test'), 'a'.repeat(64), db)).status).toBe(404);
  });
  it('Pages adapter binds binary bytes and reads D1 numeric-array results', async () => {
    const id = await hash(jpeg); let stored: number[] | null = null;
    const db = { prepare(sql: string) {
      let values: unknown[] = [];
      return {
        bind(...params: unknown[]) { values = params; return this; },
        async run() { if (sql.startsWith('INSERT')) stored = [...new Uint8Array(values[1] as ArrayBuffer)]; },
        async first<T>() { return (stored ? { bytes: stored } : null) as T | null; },
      };
    } };
    expect((await onRequest({ request: request(id), params: { id }, env: { location_scout_db: db } })).status).toBe(200);
    const response = await onRequest({ request: new Request(`https://scout.test/api/photos/${id}`), params: { id }, env: { location_scout_db: db } });
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(jpeg);
  });
});

describe('client upload retries', () => {
  const photos: DraftPhoto[] = [1, 2].map(i => ({ id: `p${i}`, name: `photo${i}.jpg`, preview: `blob:${i}`, blob: new Blob([jpeg], { type: 'image/jpeg' }) }));
  it('fails explicitly for a partial upload and can retry using the same saved photo IDs', async () => {
    const db = storage(); let calls = 0;
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls++;
      if (calls === 2) return Response.json({ error: 'Mất kết nối' }, { status: 503 });
      return photoResponse(new Request(`https://scout.test${url}`, init), url.split('/').pop()!, db);
    });
    try {
      await expect(uploadPhotos(photos, () => {})).rejects.toThrow('Mất kết nối');
      const saved = await uploadPhotos(photos, () => {});
      expect(saved.map(p => p.id)).toEqual(['p1', 'p2']);
      expect(saved.every(p => /^\/api\/photos\/[a-f0-9]{64}$/.test(p.url))).toBe(true);
    } finally { vi.unstubAllGlobals(); }
  });
  it('does not treat an authentication redirect HTML page as a successful upload', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html>Login</html>', { headers: { 'content-type': 'text/html' } }));
    try { await expect(uploadPhotos(photos, () => {})).rejects.toThrow('đăng nhập'); }
    finally { vi.unstubAllGlobals(); }
  });
});
