/**
 * Cloudflare Pages Function — /api/workspace
 * Implements the same GET/PUT contract as server/index.mjs but against D1
 * (edge SQLite). No localhost restriction; auth is enforced by Cloudflare Access
 * at the edge before this function is reached.
 */

import { PHOTO_PATH } from '../../shared/photos.mjs';
import { VIDEO_SCHEMAS, validVideos } from '../../shared/videos.mjs';
import type { D1Database, D1PreparedStatement } from '../d1-types';

interface Env {
  location_scout_db: D1Database;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// ──────────────────────────────────────────────────────────────────────────────
// Validation (ported from server/store.mjs — same rules, same error messages)
// ──────────────────────────────────────────────────────────────────────────────
function validate(state: unknown): void {
  const fail = (message: string): never => {
    const err = new Error(message) as Error & { status: number };
    err.status = 400;
    throw err;
  };
  const s = state as Record<string, unknown>;
  const string = (v: unknown) => typeof v === 'string' && (v as string).length <= 20000;
  const strings = (v: unknown) => Array.isArray(v) && (v as unknown[]).every(string);
  const id = (v: unknown) => string(v) && (v as string).length > 0 && (v as string).length < 160;
  const date = (v: unknown) => string(v) && Number.isFinite(Date.parse(v as string));
  const url = (v: unknown) => {
    try { return ['https:', 'http:'].includes(new URL(v as string).protocol); } catch { return false; }
  };
  const unique = (list: unknown[]) => new Set(list).size === list.length;

  if (!s || !Number.isInteger(s.revision) || !Array.isArray(s.locations) || !Array.isArray(s.tours))
    fail('Dữ liệu workspace không hợp lệ.');
  if ([...s.locations as unknown[], ...s.tours as unknown[]].some(v => !v || typeof v !== 'object'))
    fail('Bản ghi không hợp lệ.');
  if (!unique((s.locations as Record<string, unknown>[]).map(l => l.id)) ||
      !unique((s.tours as Record<string, unknown>[]).map(t => t.id)))
    fail('ID trùng lặp.');

  const allChildIds: Record<string, string[]> = { photos: [], videos: [], checklist: [], history: [], stops: [] };
  for (const l of s.locations as Record<string, unknown>[]) {
    if (!validVideos(l.videos)) fail('Video phải là clip đã tải lên, tối đa 15 giây và 4 clip/spot.');
    for (const v of (l.videos ?? []) as { id: string }[]) allChildIds.videos.push(v.id);
    if (!id(l.id) || !id(l.code) || !string(l.name) || !(l.name as string).trim() ||
        !['active', 'archived'].includes(l.status as string)) fail('Địa điểm không hợp lệ.');
    const c = l.coordinates as Record<string, unknown>;
    if (!c || !Number.isFinite(c.lat) || Math.abs(c.lat as number) > 90 ||
        !Number.isFinite(c.lng) || Math.abs(c.lng as number) > 180) fail('Tọa độ không hợp lệ.');
    for (const key of ['region', 'description', 'scouting_notes', 'best_time_to_shoot'])
      if (!string(l[key])) fail(`Trường ${key} không hợp lệ.`);
    if (!strings(l.camera_angles) || !strings(l.tags) || typeof l.drone_permitted !== 'boolean' ||
        !date(l.created_at) || !date(l.updated_at)) fail('Chi tiết địa điểm không hợp lệ.');
    if (!['not_scouted', 'candidate', 'scouted', 'approved'].includes(l.scouting_status as string) ||
        !string(l.access)) fail('Trạng thái khảo sát không hợp lệ.');
    const d = l.drive_reference as Record<string, unknown>;
    if (!d || !Number.isInteger(d.asset_count) || (d.asset_count as number) < 0 ||
        (d.folder_id !== undefined && !string(d.folder_id)) ||
        (d.folder_url && (!url(d.folder_url) || new URL(d.folder_url as string).hostname !== 'drive.google.com')) ||
        (d.last_synced_at && !date(d.last_synced_at))) fail('Liên kết Drive không hợp lệ.');
    for (const key of ['photos', 'checklist', 'history']) {
      if (!Array.isArray(l[key])) fail(`Thiếu ${key}.`);
      for (const item of l[key] as Record<string, unknown>[]) {
        if (!item || typeof item !== 'object') fail('Chi tiết không hợp lệ.');
        if (!id(item.id)) fail('ID chi tiết không hợp lệ.');
        allChildIds[key].push(item.id as string);
        if (key === 'photos' && (!(url(item.url) || PHOTO_PATH.test(String(item.url))) || !string(item.caption))) fail('Ảnh phải có URL http/https hoặc ảnh đã tải lên hợp lệ.');
        if (key === 'checklist' && (!string(item.label) || !(item.label as string).trim() || typeof item.done !== 'boolean')) fail('Checklist không hợp lệ.');
        if (key === 'history' && (!date(item.at) || !string(item.action))) fail('Lịch sử không hợp lệ.');
      }
    }
  }

  const locationIds = new Set((s.locations as Record<string, unknown>[]).map(l => l.id));
  for (const t of s.tours as Record<string, unknown>[]) {
    if (!id(t.id) || !id(t.code) || !string(t.title) || !(t.title as string).trim() ||
        !string(t.description) || !string(t.production_week) || !strings(t.assigned_crew) ||
        !date(t.created_at) || !date(t.updated_at) ||
        !['draft', 'planning', 'approved', 'completed', 'archived'].includes(t.status as string) ||
        !Array.isArray(t.stops)) fail('Tour không hợp lệ.');
    if (t.target_date && (!date(t.target_date) || !/^\d{4}-\d{2}-\d{2}$/.test(t.target_date as string))) fail('Ngày tour không hợp lệ.');
    const stops = t.stops as Record<string, unknown>[];
    if (stops.some(s => !s || typeof s !== 'object')) fail('Điểm dừng không hợp lệ.');
    if (!unique(stops.map(s => s.location_id))) fail('Một địa điểm chỉ được xuất hiện một lần trong tour.');
    stops.forEach((s, i) => {
      if (!id(s.id) || s.tour_id !== t.id || !locationIds.has(s.location_id) ||
          s.stop_order !== i + 1 || !Number.isInteger(s.planned_duration_minutes) ||
          (s.planned_duration_minutes as number) < 0 || !string(s.focus_scenes) ||
          !['scheduled', 'arrived', 'filmed', 'skipped'].includes(s.status as string)) fail('Điểm dừng không hợp lệ.');
      if (s.notes !== undefined && !string(s.notes)) fail('Ghi chú không hợp lệ.');
      if (s.target_arrival_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.target_arrival_time as string)) fail('Giờ đến không hợp lệ.');
      for (const k of ['ai_suggested', 'approved_by_human'])
        if (s[k] !== undefined && typeof s[k] !== 'boolean') fail('Cờ xác nhận không hợp lệ.');
      if (s.ai_suggested && !s.approved_by_human) fail('Điểm AI đề xuất cần được xác nhận.');
      allChildIds.stops.push(s.id as string);
    });
  }
  for (const ids of Object.values(allChildIds))
    if (!unique(ids)) fail('ID chi tiết trùng lặp.');
}

// ──────────────────────────────────────────────────────────────────────────────
// D1 read/write (mirrors server/store.mjs logic)
// ──────────────────────────────────────────────────────────────────────────────
// Schema is pre-applied via: wrangler d1 execute location-scout-db --remote --file=database/schema.sql
// No runtime DDL needed — avoids PRAGMA and multi-statement exec() limitations in D1.

async function readWorkspace(db: D1Database) {
  const meta = await db.prepare('SELECT revision FROM workspace_meta').first<{ revision: number }>();
  const revision = meta?.revision ?? 0;

  const locationRows = await db.prepare(
    'SELECT * FROM scout_locations ORDER BY created_at, id'
  ).all<Record<string, unknown>>();

  const locations = await Promise.all((locationRows.results ?? []).map(async (row) => {
    const { latitude, longitude, camera_angles, tags, drive_reference, drone_permitted, ...rest } = row;
    const videos = await db.prepare('SELECT id,url,caption,duration FROM location_videos WHERE location_id=? ORDER BY position').bind(row.id).all<{ id: string; url: string; caption: string; duration: number }>();
    const photos = await db.prepare(
      'SELECT id,url,caption FROM location_photos WHERE location_id=? ORDER BY position'
    ).bind(row.id).all<{ id: string; url: string; caption: string }>();
    const checklist = await db.prepare(
      'SELECT id,label,done FROM location_checklist WHERE location_id=? ORDER BY position'
    ).bind(row.id).all<{ id: string; label: string; done: number }>();
    const history = await db.prepare(
      'SELECT id,at,action FROM location_history WHERE location_id=? ORDER BY at DESC,id'
    ).bind(row.id).all<{ id: string; at: string; action: string }>();
    return {
      ...rest,
      id: row.id,
      coordinates: { lat: latitude, lng: longitude },
      camera_angles: JSON.parse(camera_angles as string),
      tags: JSON.parse(tags as string),
      drive_reference: JSON.parse(drive_reference as string),
      drone_permitted: Boolean(drone_permitted),
      photos: photos.results ?? [],
      videos: videos.results ?? [],
      checklist: (checklist.results ?? []).map(c => ({ ...c, done: Boolean(c.done) })),
      history: history.results ?? [],
    };
  }));

  const tourRows = await db.prepare('SELECT * FROM tours ORDER BY created_at,id').all<Record<string, unknown>>();
  const tours = await Promise.all((tourRows.results ?? []).map(async (t) => {
    const stops = await db.prepare(
      'SELECT * FROM tour_stops WHERE tour_id=? ORDER BY stop_order'
    ).bind(t.id).all<Record<string, unknown>>();
    return {
      ...t,
      target_date: t.target_date ?? undefined,
      assigned_crew: JSON.parse(t.assigned_crew as string),
      stops: (stops.results ?? []).map(s => ({
        ...s,
        notes: s.notes ?? undefined,
        target_arrival_time: s.target_arrival_time ?? undefined,
        ai_suggested: Boolean(s.ai_suggested),
        approved_by_human: Boolean(s.approved_by_human),
      })),
    };
  }));

  return { revision, locations, tours };
}

async function writeWorkspace(db: D1Database, state: Record<string, unknown>) {
  validate(state);
  const previous = await readWorkspace(db);
  if ((state.revision as number) !== previous.revision) {
    const err = new Error('Dữ liệu đã thay đổi ở cửa sổ khác. Tải lại trước khi lưu.') as Error & { status: number };
    err.status = 409;
    throw err;
  }
  state = { ...state, locations: (state.locations as Record<string, unknown>[]).map(l => l.videos === undefined ? { ...l, videos: previous.locations.find(old => old.id === l.id)?.videos || [] } : l) };
  validate(state);
  const prevLocIds = new Set(previous.locations.map((l: Record<string, unknown>) => l.id));
  const prevTourIds = new Set(previous.tours.map((t: Record<string, unknown>) => t.id));
  const nextLocIds = new Set((state.locations as Record<string, unknown>[]).map(l => l.id));
  const nextTourIds = new Set((state.tours as Record<string, unknown>[]).map(t => t.id));
  if ([...prevTourIds].some(id => !nextTourIds.has(id))) {
    const err = new Error('Không hỗ trợ xóa vĩnh viễn. Hãy dùng Archive.') as Error & { status: number };
    err.status = 400;
    throw err;
  }

  // Build batched statements
  const stmts: D1PreparedStatement[] = [];
  stmts.push(db.prepare('DELETE FROM tour_stops'));
  stmts.push(db.prepare('DELETE FROM location_photos'));
  stmts.push(db.prepare('DELETE FROM location_checklist'));
  stmts.push(db.prepare('DELETE FROM location_history'));
  stmts.push(db.prepare('DELETE FROM location_videos'));
  for (const id of prevLocIds) if (!nextLocIds.has(id)) stmts.push(db.prepare('DELETE FROM scout_locations WHERE id=?').bind(id));

  for (const l of state.locations as Record<string, unknown>[]) {
    const c = l.coordinates as { lat: number; lng: number };
    stmts.push(db.prepare(`INSERT INTO scout_locations
      (id,code,name,region,latitude,longitude,description,scouting_notes,camera_angles,
       best_time_to_shoot,drone_permitted,drive_reference,tags,status,scouting_status,access,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        code=excluded.code,name=excluded.name,region=excluded.region,
        latitude=excluded.latitude,longitude=excluded.longitude,
        description=excluded.description,scouting_notes=excluded.scouting_notes,
        camera_angles=excluded.camera_angles,best_time_to_shoot=excluded.best_time_to_shoot,
        drone_permitted=excluded.drone_permitted,drive_reference=excluded.drive_reference,
        tags=excluded.tags,status=excluded.status,scouting_status=excluded.scouting_status,
        access=excluded.access,created_at=excluded.created_at,updated_at=excluded.updated_at`).bind(
      l.id, l.code, l.name, l.region, c.lat, c.lng, l.description, l.scouting_notes,
      JSON.stringify(l.camera_angles), l.best_time_to_shoot, Number(l.drone_permitted),
      JSON.stringify(l.drive_reference), JSON.stringify(l.tags),
      l.status, l.scouting_status, l.access, l.created_at, l.updated_at
    ));
    ((l.videos ?? []) as Record<string, unknown>[]).forEach((v, i) => stmts.push(db.prepare('INSERT INTO location_videos (id,location_id,position,url,caption,duration) VALUES (?,?,?,?,?,?)').bind(v.id,l.id,i,v.url,v.caption,v.duration)));
    (l.photos as Record<string, unknown>[]).forEach((p, i) =>
      stmts.push(db.prepare('INSERT INTO location_photos (id,location_id,position,url,caption) VALUES (?,?,?,?,?)').bind(p.id, l.id, i, p.url, p.caption)));
    (l.checklist as Record<string, unknown>[]).forEach((c, i) =>
      stmts.push(db.prepare('INSERT INTO location_checklist (id,location_id,position,label,done) VALUES (?,?,?,?,?)').bind(c.id, l.id, i, c.label, Number(c.done))));
    (l.history as Record<string, unknown>[]).forEach(h =>
      stmts.push(db.prepare('INSERT INTO location_history (id,location_id,at,action) VALUES (?,?,?,?)').bind(h.id, l.id, h.at, h.action)));
  }

  for (const t of state.tours as Record<string, unknown>[]) {
    stmts.push(db.prepare(`INSERT INTO tours
      (id,code,title,description,status,production_week,target_date,assigned_crew,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        code=excluded.code,title=excluded.title,description=excluded.description,
        status=excluded.status,production_week=excluded.production_week,
        target_date=excluded.target_date,assigned_crew=excluded.assigned_crew,
        created_at=excluded.created_at,updated_at=excluded.updated_at`).bind(
      t.id, t.code, t.title, t.description, t.status, t.production_week,
      (t.target_date ?? null), JSON.stringify(t.assigned_crew), t.created_at, t.updated_at
    ));
    for (const s of t.stops as Record<string, unknown>[]) {
      stmts.push(db.prepare(`INSERT INTO tour_stops
        (id,tour_id,location_id,stop_order,target_arrival_time,planned_duration_minutes,
         focus_scenes,notes,status,ai_suggested,approved_by_human)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(
        s.id, s.tour_id, s.location_id, s.stop_order,
        (s.target_arrival_time ?? null), s.planned_duration_minutes, s.focus_scenes,
        (s.notes ?? null), s.status, Number(!!s.ai_suggested), Number(!!s.approved_by_human)
      ));
    }
  }

  stmts.push(db.prepare('UPDATE workspace_meta SET revision=revision+1'));

  await db.batch(stmts);
  return readWorkspace(db);
}

// ──────────────────────────────────────────────────────────────────────────────
// Pages Function handler
// ──────────────────────────────────────────────────────────────────────────────
export const onRequest = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  const db = env.location_scout_db;

  try {
    for (const sql of VIDEO_SCHEMAS) await db.prepare(sql).run();
    if (request.method === 'GET') {
      return json(200, await readWorkspace(db));
    }

    if (request.method === 'PUT') {
      const ct = request.headers.get('content-type') ?? '';
      if (!ct.startsWith('application/json')) return json(415, { error: 'JSON required.' });
      const body = await request.text();
      if (body.length > 5_000_000) return json(413, { error: 'Dữ liệu vượt quá 5 MB.' });
      const state = JSON.parse(body) as Record<string, unknown>;
      return json(200, await writeWorkspace(db, state));
    }

    return json(405, { error: 'Method not allowed.' });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    const status = e.status ?? (e instanceof SyntaxError ? 400 : 500);
    const message = e.status ? e.message : 'Không thể lưu hoặc đọc dữ liệu. Kiểm tra đầu vào và thử lại.';
    console.error(e.message);
    return json(status, { error: message });
  }
};
