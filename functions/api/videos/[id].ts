import { videoResponse, VIDEO_SCHEMAS, VIDEO_CHUNK_BYTES } from '../../../shared/videos.mjs';
interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}
interface Database { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown> }
export async function onRequest({ request, params, env }: {
  request: Request; params: { id?: string | string[] }; env: { location_scout_db: Database };
}) {
  const db = env.location_scout_db;
  try {
    for (const sql of VIDEO_SCHEMAS) await db.prepare(sql).run();
    return await videoResponse(request, typeof params.id === 'string' ? params.id : '', {
      async get(id) {
        const asset = await db.prepare('SELECT mime,duration,size FROM scout_video_assets WHERE id=?').bind(id).first<{ mime: string; duration: number; size: number }>();
        if (!asset) return null;
        const bytes = new Uint8Array(asset.size);
        for (let at = 0; at < asset.size; at += VIDEO_CHUNK_BYTES) {
          const row = await db.prepare('SELECT bytes FROM scout_video_chunks WHERE asset_id=? AND position=?').bind(id, at / VIDEO_CHUNK_BYTES).first<{ bytes: ArrayBuffer | number[] }>();
          if (!row) throw new Error('Missing video chunk');
          bytes.set(new Uint8Array(row.bytes), at);
        }
        return { ...asset, bytes };
      },
      async put(id, asset) {
        const statements = [db.prepare('INSERT OR IGNORE INTO scout_video_assets (id,mime,duration,size,created_at) VALUES (?,?,?,?,?)').bind(id, asset.mime, asset.duration, asset.bytes.length, new Date().toISOString())];
        for (let at = 0; at < asset.bytes.length; at += VIDEO_CHUNK_BYTES) {
          statements.push(db.prepare('INSERT OR IGNORE INTO scout_video_chunks (asset_id,position,bytes) VALUES (?,?,?)').bind(id, at / VIDEO_CHUNK_BYTES, asset.bytes.slice(at, at + VIDEO_CHUNK_BYTES).buffer));
        }
        await db.batch(statements);
      },
    });
  } catch {
    return Response.json({ error: 'Chưa lưu hoặc đọc được video. Hãy thử lại.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
