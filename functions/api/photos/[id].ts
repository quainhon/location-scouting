import { photoResponse, PHOTO_SCHEMA } from '../../../shared/photos.mjs';

// Structural types keep this adapter checked alongside the client, without
// adding Workers globals to the browser TypeScript environment.
interface Database {
  prepare(sql: string): {
    bind(...values: unknown[]): ReturnType<Database['prepare']>;
    first<T>(): Promise<T | null>;
    run(): Promise<unknown>;
  };
}
export async function onRequest({ request, params, env }: {
  request: Request; params: { id?: string | string[] }; env: { location_scout_db: Database };
}): Promise<Response> {
  try {
    return await photoResponse(request, typeof params.id === 'string' ? params.id : '', {
      async get(id) {
        // Additive, idempotent migration: existing Pages deployments need no new binding.
        await env.location_scout_db.prepare(PHOTO_SCHEMA).run();
        const row = await env.location_scout_db.prepare('SELECT bytes FROM scout_photo_assets WHERE id=?').bind(id).first<{ bytes: ArrayBuffer | number[] }>();
        return row ? new Uint8Array(row.bytes) : null;
      },
      async put(id, bytes) {
        await env.location_scout_db.prepare(PHOTO_SCHEMA).run();
        await env.location_scout_db.prepare('INSERT OR IGNORE INTO scout_photo_assets (id,bytes,created_at) VALUES (?,?,?)').bind(id, bytes.buffer, new Date().toISOString()).run();
      },
    });
  } catch {
    return Response.json({ error: 'Chưa lưu hoặc đọc được ảnh. Hãy thử lại.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
