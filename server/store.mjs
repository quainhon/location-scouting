import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { PHOTO_PATH } from '../shared/photos.mjs';

export function validate(state) {
  const fail = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
  const string = (v) => typeof v === 'string' && v.length <= 20000;
  const strings = (v) => Array.isArray(v) && v.every(string);
  const id = (v) => string(v) && v.length > 0 && v.length < 160;
  const date = (v) => string(v) && Number.isFinite(Date.parse(v));
  const url = (v) => { try { return ['https:', 'http:'].includes(new URL(v).protocol); } catch { return false; } };
  const unique = (list) => new Set(list).size === list.length;
  if (!state || !Number.isInteger(state.revision) || !Array.isArray(state.locations) || !Array.isArray(state.tours)) fail('Dữ liệu workspace không hợp lệ.');
  if ([...state.locations,...state.tours].some(v => !v || typeof v !== 'object')) fail('Bản ghi không hợp lệ.');
  if (!unique(state.locations.map(l => l.id)) || !unique(state.tours.map(t => t.id))) fail('ID trùng lặp.');
  const allChildIds = { photos: [], checklist: [], history: [], stops: [] };
  for (const l of state.locations) {
    if (!id(l.id) || !id(l.code) || !string(l.name) || !l.name.trim() || !['active','archived'].includes(l.status)) fail('Địa điểm không hợp lệ.');
    if (!l.coordinates || !Number.isFinite(l.coordinates.lat) || Math.abs(l.coordinates.lat)>90 || !Number.isFinite(l.coordinates.lng) || Math.abs(l.coordinates.lng)>180) fail('Tọa độ không hợp lệ.');
    for (const key of ['region','description','scouting_notes','best_time_to_shoot']) if (!string(l[key])) fail(`Trường ${key} không hợp lệ.`);
    if (!strings(l.camera_angles) || !strings(l.tags) || typeof l.drone_permitted !== 'boolean' || !date(l.created_at) || !date(l.updated_at)) fail('Chi tiết địa điểm không hợp lệ.');
    if (!['not_scouted','candidate','scouted','approved'].includes(l.scouting_status) || !string(l.access)) fail('Trạng thái khảo sát không hợp lệ.');
    const d = l.drive_reference;
    if (!d || !Number.isInteger(d.asset_count) || d.asset_count < 0 || (d.folder_id !== undefined && !string(d.folder_id)) || (d.folder_url && (!url(d.folder_url) || new URL(d.folder_url).hostname !== 'drive.google.com')) || (d.last_synced_at && !date(d.last_synced_at))) fail('Liên kết Drive không hợp lệ.');
    for (const key of ['photos','checklist','history']) {
      if (!Array.isArray(l[key])) fail(`Thiếu ${key}.`);
      for (const item of l[key]) {
        if (!item || typeof item !== 'object') fail('Chi tiết không hợp lệ.');
        if (!id(item.id)) fail('ID chi tiết không hợp lệ.');
        allChildIds[key].push(item.id);
        if (key === 'photos' && (!(url(item.url) || PHOTO_PATH.test(item.url)) || !string(item.caption))) fail('Ảnh phải có URL http/https hoặc ảnh đã tải lên hợp lệ.');
        if (key === 'checklist' && (!string(item.label) || !item.label.trim() || typeof item.done !== 'boolean')) fail('Checklist không hợp lệ.');
        if (key === 'history' && (!date(item.at) || !string(item.action))) fail('Lịch sử không hợp lệ.');
      }
    }
  }
  const locations = new Set(state.locations.map(l => l.id));
  for (const t of state.tours) {
    if (!id(t.id) || !id(t.code) || !string(t.title) || !t.title.trim() || !string(t.description) || !string(t.production_week) || !strings(t.assigned_crew) || !date(t.created_at) || !date(t.updated_at) || !['draft','planning','approved','completed','archived'].includes(t.status) || !Array.isArray(t.stops)) fail('Tour không hợp lệ.');
    if (t.target_date && (!date(t.target_date) || !/^\d{4}-\d{2}-\d{2}$/.test(t.target_date))) fail('Ngày tour không hợp lệ.');
    if (t.stops.some(s => !s || typeof s !== 'object')) fail('Điểm dừng không hợp lệ.');
    if (!unique(t.stops.map(s => s.location_id))) fail('Một địa điểm chỉ được xuất hiện một lần trong tour.');
    t.stops.forEach((s, i) => {
      if (!id(s.id) || s.tour_id !== t.id || !locations.has(s.location_id) || s.stop_order !== i + 1 || !Number.isInteger(s.planned_duration_minutes) || s.planned_duration_minutes < 0 || !string(s.focus_scenes) || !['scheduled','arrived','filmed','skipped'].includes(s.status)) fail('Điểm dừng không hợp lệ.');
      if (s.notes !== undefined && !string(s.notes)) fail('Ghi chú không hợp lệ.');
      if (s.target_arrival_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.target_arrival_time)) fail('Giờ đến không hợp lệ.');
      for (const k of ['ai_suggested','approved_by_human']) if (s[k] !== undefined && typeof s[k] !== 'boolean') fail('Cờ xác nhận không hợp lệ.');
      if (s.ai_suggested && !s.approved_by_human) fail('Điểm AI đề xuất cần được xác nhận.');
      allChildIds.stops.push(s.id);
    });
  }
  for (const ids of Object.values(allChildIds)) if (!unique(ids)) fail('ID chi tiết trùng lặp.');
}

export function openStore(filename) {
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
  function read() {
    const locations = db.prepare('SELECT * FROM scout_locations ORDER BY created_at, id').all().map(row => {
      const { latitude, longitude, ...l } = row;
      for (const k of ['camera_angles','tags','drive_reference']) l[k] = JSON.parse(l[k]);
      l.coordinates = { lat: latitude, lng: longitude }; l.drone_permitted = !!l.drone_permitted;
      l.photos = db.prepare('SELECT id,url,caption FROM location_photos WHERE location_id=? ORDER BY position').all(l.id);
      l.checklist = db.prepare('SELECT id,label,done FROM location_checklist WHERE location_id=? ORDER BY position').all(l.id).map(c => ({...c, done: !!c.done}));
      l.history = db.prepare('SELECT id,at,action FROM location_history WHERE location_id=? ORDER BY at DESC,id').all(l.id);
      return l;
    });
    const tours = db.prepare('SELECT * FROM tours ORDER BY created_at,id').all().map(t => ({ ...t, target_date: t.target_date ?? undefined, assigned_crew: JSON.parse(t.assigned_crew), stops: db.prepare('SELECT * FROM tour_stops WHERE tour_id=? ORDER BY stop_order').all(t.id).map(s => ({...s, notes:s.notes ?? undefined, target_arrival_time:s.target_arrival_time ?? undefined, ai_suggested:!!s.ai_suggested, approved_by_human:!!s.approved_by_human})) }));
    return { revision: db.prepare('SELECT revision FROM workspace_meta').get().revision, locations, tours };
  }
  const upsert = (table, row) => {
    const keys = Object.keys(row);
    db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${keys.filter(k => k !== 'id').map(k => `${k}=excluded.${k}`).join(',')}`).run(...Object.values(row).map(v => v === undefined ? null : v));
  };
  function write(state) {
    validate(state);
    db.exec('BEGIN IMMEDIATE');
    try {
      const previous = read();
      if (state.revision !== previous.revision) throw Object.assign(new Error('Dữ liệu đã thay đổi ở cửa sổ khác. Tải lại trước khi lưu.'), {status:409});
      if (previous.locations.some(l => !state.locations.some(n => n.id === l.id)) || previous.tours.some(t => !state.tours.some(n => n.id === t.id))) throw Object.assign(new Error('Không hỗ trợ xóa vĩnh viễn. Hãy dùng Archive.'), {status:400});
      db.exec('DELETE FROM tour_stops; DELETE FROM location_photos; DELETE FROM location_checklist; DELETE FROM location_history;');
      for (const l of state.locations) {
        const row = {};
        for (const k of ['id','code','name','region','description','scouting_notes','best_time_to_shoot','status','scouting_status','access','created_at','updated_at']) row[k] = l[k];
        Object.assign(row, { latitude:l.coordinates.lat, longitude:l.coordinates.lng, drone_permitted:Number(l.drone_permitted) });
        for (const k of ['camera_angles','tags','drive_reference']) row[k] = JSON.stringify(l[k]);
        upsert('scout_locations', row);
        l.photos.forEach((p,i) => upsert('location_photos', { id:p.id, location_id:l.id, position:i, url:p.url, caption:p.caption }));
        l.checklist.forEach((c,i) => upsert('location_checklist', { id:c.id, location_id:l.id, position:i, label:c.label, done:Number(c.done) }));
        l.history.forEach(h => upsert('location_history', { id:h.id, location_id:l.id, at:h.at, action:h.action }));
      }
      for (const t of state.tours) {
        const row = {};
        for (const k of ['id','code','title','description','status','production_week','target_date','created_at','updated_at']) row[k] = t[k];
        row.assigned_crew = JSON.stringify(t.assigned_crew); upsert('tours', row);
        for (const s of t.stops) {
          const stop = {};
          for (const k of ['id','tour_id','location_id','stop_order','target_arrival_time','planned_duration_minutes','focus_scenes','notes','status']) stop[k] = s[k];
          stop.ai_suggested = Number(!!s.ai_suggested); stop.approved_by_human = Number(!!s.approved_by_human); upsert('tour_stops',stop);
        }
      }
      db.exec('UPDATE workspace_meta SET revision=revision+1; COMMIT');
      return read();
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  const photos = {
    async get(id) { return db.prepare('SELECT bytes FROM scout_photo_assets WHERE id=?').get(id)?.bytes ?? null; },
    async put(id, bytes) { db.prepare('INSERT OR IGNORE INTO scout_photo_assets (id,bytes,created_at) VALUES (?,?,?)').run(id, bytes, new Date().toISOString()); },
  };
  return { read, write, photos, close: () => db.close() };
}
