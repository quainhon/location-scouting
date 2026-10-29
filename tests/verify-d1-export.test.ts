import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const verifierPath = fileURLToPath(new URL('../scripts/verify-d1-export.mjs', import.meta.url));

describe('D1 export verification', () => {
  it('checks active locations while preserving archived locations in the backup', () => {
    const directory = mkdtempSync(join(tmpdir(), 'location-scout-d1-export-'));
    try {
      const sqlFile = join(directory, 'backup.sql');
      const requiredTables = [
        'tours', 'tour_stops', 'location_photos', 'location_checklist', 'location_history',
        'location_videos', 'scout_photo_assets', 'scout_video_assets', 'scout_video_chunks', 'workspace_meta',
      ];
      const sql = [
        "CREATE TABLE scout_locations (id TEXT PRIMARY KEY, status TEXT NOT NULL CHECK(status IN ('active','archived')));",
        ...Array.from({ length: 7 }, (_, index) => `INSERT INTO scout_locations VALUES ('active-${index}', 'active');`),
        "INSERT INTO scout_locations VALUES ('archived-1', 'archived');",
        ...requiredTables.map(table => `CREATE TABLE ${table} (id TEXT);`),
      ].join('\n');
      writeFileSync(sqlFile, sql);

      const result = spawnSync(process.execPath, [verifierPath, sqlFile, '7'], { encoding: 'utf8' });

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('7 active locations, 1 archived locations');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
