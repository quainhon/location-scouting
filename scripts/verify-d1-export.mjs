import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

const [filename, expectedArg] = process.argv.slice(2);
if (!filename) {
  console.error('Usage: node scripts/verify-d1-export.mjs <backup.sql> [expected-location-count]');
  process.exit(2);
}

const expectedLocations = expectedArg === undefined ? undefined : Number(expectedArg);
if (expectedLocations !== undefined && (!Number.isInteger(expectedLocations) || expectedLocations < 0)) {
  console.error('Expected location count must be a non-negative integer.');
  process.exit(2);
}

const backupSql = await readFile(filename, 'utf8');
const database = new DatabaseSync(':memory:');
try {
  database.exec(backupSql);
  const integrity = database.prepare('PRAGMA integrity_check').get();
  if (integrity?.integrity_check !== 'ok') throw new Error('Restored SQLite integrity check failed.');
  const tables = new Set(database.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map(row => row.name));
  const required = ['scout_locations', 'tours', 'tour_stops', 'location_photos', 'location_checklist', 'location_history', 'location_videos', 'scout_photo_assets', 'scout_video_assets', 'scout_video_chunks', 'workspace_meta'];
  const missing = required.filter(table => !tables.has(table));
  if (missing.length) throw new Error(`Backup is missing required tables: ${missing.join(', ')}.`);
  const locations = database.prepare('SELECT COUNT(*) AS count FROM scout_locations').get().count;
  if (expectedLocations !== undefined && locations !== expectedLocations) {
    throw new Error(`Restored ${locations} locations; expected ${expectedLocations}.`);
  }
  const photos = database.prepare('SELECT COUNT(*) AS count FROM scout_photo_assets').get().count;
  const videoChunks = database.prepare('SELECT COUNT(*) AS count FROM scout_video_chunks').get().count;
  console.log(`Restore verification passed: ${locations} locations, ${photos} photo assets, ${videoChunks} video chunks.`);
} finally {
  database.close();
}
