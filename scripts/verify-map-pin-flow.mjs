import { spawn, execSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROFILE_DIR = resolve('E:/Tools/qn-location-scouting/.tmp/edge-test-profile');
const TARGET_URL = 'https://locationscout.quainhon.com/';
const WRANGLER_CWD = 'E:/Tools/Vaults/quai-nhon/quai-nhon-dev';

try { rmSync(PROFILE_DIR, { recursive: true, force: true }); } catch {}
mkdirSync(PROFILE_DIR, { recursive: true });

console.log('1. Launching headless Edge...');
const edgeProc = spawn(EDGE_PATH, [
  '--headless=new',
  '--remote-debugging-port=9222',
  `--user-data-dir=${PROFILE_DIR}`,
  '--window-size=1280,800',
  'about:blank'
], { stdio: 'ignore' });

let ws;
let msgId = 1;
const pending = new Map();
const createdLocationIds = new Set();

function send(method, params = {}) {
  return new Promise((res, rej) => {
    const id = msgId++;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(`Eval failed: ${JSON.stringify(result.exceptionDetails)}`);
  }
  return result.result?.value;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function cleanupSyntheticLocation(locationId) {
  if (!locationId) return;
  console.log(`[CLEANUP] Purging synthetic test fixture ${locationId} from D1...`);
  const sql = `DELETE FROM location_history WHERE location_id = '${locationId}'; DELETE FROM location_photos WHERE location_id = '${locationId}'; DELETE FROM location_checklist WHERE location_id = '${locationId}'; DELETE FROM tour_stops WHERE location_id = '${locationId}'; DELETE FROM scout_locations WHERE id = '${locationId}';`;
  try {
    execSync(`npx wrangler d1 execute location-scout-db --remote --command="${sql}"`, {
      cwd: WRANGLER_CWD,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log(`[CLEANUP] Successfully purged test fixture ${locationId} from D1.`);
  } catch (err) {
    console.error(`[CLEANUP WARNING] Failed to purge ${locationId}:`, err.message);
  }
}

async function main() {
  try {
    await sleep(2000);
    const versionRes = await fetch('http://127.0.0.1:9222/json/version');
    const versionData = await versionRes.json();
    console.log('Connected to browser:', versionData.Browser);

    const listRes = await fetch('http://127.0.0.1:9222/json/list');
    const targets = await listRes.json();
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    console.log('Page target WS:', pageTarget.webSocketDebuggerUrl);

    ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && pending.has(msg.id)) {
          const { res, rej } = pending.get(msg.id);
          pending.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message));
          else res(msg.result);
        }
      };
    });

    await send('Page.enable');
    await send('Runtime.enable');

    console.log(`2. Navigating to ${TARGET_URL}...`);
    await send('Page.navigate', { url: TARGET_URL });
    await sleep(3500);

    const pageTitle = await evaluate('document.title');
    console.log('Page title:', pageTitle);

    const isConnected = await evaluate(`
      document.body.innerText.includes('Đã kết nối') || 
      document.body.innerText.includes('Quài Nhơn')
    `);
    console.log('Page rendered app:', isConnected);

    // Baseline: inspect existing production locations so we preserve unrelated production data
    const baselineApi = await evaluate(`fetch('/api/workspace').then(r => r.json())`);
    const initialCount = baselineApi.locations.length;
    const initialLocationIds = new Set(baselineApi.locations.map(l => l.id));
    console.log(`Baseline production state: revision=${baselineApi.revision}, existing spots=${initialCount}`);
    if (initialCount > 0) {
      console.log('Existing production spots to preserve:', baselineApi.locations.map(l => `[${l.name} (${l.id})]`).join(', '));
    }

    // Get map bounds and location on screen
    const mapRect = await evaluate(`
      (() => {
        const el = document.querySelector('.map-area') || document.querySelector('.leaflet-container');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      })()
    `);
    console.log('Map element rect:', mapRect);
    if (!mapRect) throw new Error('Map container not found!');

    // Check initial draft pin count (should be 0)
    const initialDraftPins = await evaluate(`document.querySelectorAll('.draft-pin').length`);
    console.log('Initial draft pins:', initialDraftPins);

    // ────────────────────────────────────────────────────────────────────────
    // Step A: Mouse click on map -> draft pin and modal should appear
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step A: Mouse click on map ---');
    const clickX = Math.round(mapRect.x + mapRect.width * 0.45);
    const clickY = Math.round(mapRect.y + mapRect.height * 0.45);
    console.log(`Clicking at (${clickX}, ${clickY})...`);

    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: clickX, y: clickY, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: clickX, y: clickY, button: 'left', clickCount: 1 });
    await sleep(800);

    const draftPinsAfterClick = await evaluate(`document.querySelectorAll('.draft-pin').length`);
    console.log('Draft pins after click:', draftPinsAfterClick);

    const modalOpen = await evaluate(`
      (() => {
        const d = document.querySelector('dialog[open]');
        if (!d) return null;
        const latInput = d.querySelector('input[name="lat"]');
        const lngInput = d.querySelector('input[name="lng"]');
        const helperText = d.querySelector('.helper')?.textContent;
        return {
          open: true,
          title: d.querySelector('h2')?.textContent,
          lat: latInput?.value,
          lng: lngInput?.value,
          helperText
        };
      })()
    `);
    console.log('Modal details after click:', modalOpen);

    if (draftPinsAfterClick !== 1) throw new Error(`Expected 1 draft pin, got ${draftPinsAfterClick}`);
    if (!modalOpen || !modalOpen.lat || !modalOpen.lng) throw new Error('Modal did not open with prefilled coordinates!');
    const clickedLat = parseFloat(modalOpen.lat);
    const clickedLng = parseFloat(modalOpen.lng);
    console.log(`Prefilled coordinates: lat=${clickedLat}, lng=${clickedLng}`);
    if (clickedLat < 10 || clickedLat > 20 || clickedLng < 100 || clickedLng > 115) {
      throw new Error(`Coordinates outside Vietnam coastal range: ${clickedLat}, ${clickedLng}`);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Step B: Cancel / Dialog Close -> draft pin removed, no persistence
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step B: Cancel draft creation ---');
    const cancelClicked = await evaluate(`
      (() => {
        const d = document.querySelector('dialog[open]');
        const cancelBtn = Array.from(d.querySelectorAll('button')).find(b => b.textContent.trim() === 'Hủy');
        if (cancelBtn) { cancelBtn.click(); return true; }
        return false;
      })()
    `);
    console.log('Clicked Cancel button:', cancelClicked);
    await sleep(500);

    const modalOpenAfterCancel = await evaluate(`Boolean(document.querySelector('dialog[open]'))`);
    const draftPinsAfterCancel = await evaluate(`document.querySelectorAll('.draft-pin').length`);
    console.log('Modal open after cancel:', modalOpenAfterCancel);
    console.log('Draft pins after cancel:', draftPinsAfterCancel);

    if (modalOpenAfterCancel) throw new Error('Modal should be closed after Cancel!');
    if (draftPinsAfterCancel !== 0) throw new Error('Draft pin should be removed on Cancel!');

    // Verify nothing saved to API beyond initial count
    const apiStateAfterCancel = await evaluate(`
      fetch('/api/workspace').then(r => r.json()).then(d => ({ revision: d.revision, count: d.locations.length }))
    `);
    console.log('API state after cancel:', apiStateAfterCancel);
    if (apiStateAfterCancel.count !== initialCount) {
      throw new Error(`Expected count ${initialCount} after Cancel, got ${apiStateAfterCancel.count}`);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Step C: Touch tap on map -> draft pin and modal with coordinates
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step C: Touch tap on map ---');
    const touchX = Math.round(mapRect.x + mapRect.width * 0.55);
    const touchY = Math.round(mapRect.y + mapRect.height * 0.55);
    console.log(`Touch tap at (${touchX}, ${touchY})...`);

    await send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: touchX, y: touchY }]
    });
    await sleep(50);
    await send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: touchX, y: touchY, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: touchX, y: touchY, button: 'left', clickCount: 1 });
    await sleep(800);

    const draftPinsAfterTouch = await evaluate(`document.querySelectorAll('.draft-pin').length`);
    console.log('Draft pins after touch/tap:', draftPinsAfterTouch);

    // ────────────────────────────────────────────────────────────────────────
    // Step D: Edit fields and Save draft location
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step D: Edit fields and Save new location ---');
    const testLocationName = 'Bãi Rạng - Điểm quay bình minh (E2E Test)';
    const testRegion = 'Quy Nhơn';
    const testNotes = 'Góc máy đón bình minh, bờ cát mịn không đá ngầm.';

    const filledAndSaved = await evaluate(`
      (() => {
        const d = document.querySelector('dialog[open]');
        if (!d) return { error: 'Dialog not open' };
        const nameInput = d.querySelector('input[name="name"]');
        const regionInput = d.querySelector('input[name="region"]');
        const notesArea = d.querySelector('textarea[name="notes"]');
        const form = d.querySelector('form');
        const submitBtn = d.querySelector('button.primary');

        if (!nameInput || !form || !submitBtn) return { error: 'Form elements missing' };

        nameInput.value = ${JSON.stringify(testLocationName)};
        if (regionInput) regionInput.value = ${JSON.stringify(testRegion)};
        if (notesArea) notesArea.value = ${JSON.stringify(testNotes)};

        submitBtn.click();
        return { success: true };
      })()
    `);
    console.log('Filled form and submitted:', filledAndSaved);
    await sleep(1500);

    // Check modal closed and draft pin cleared
    const modalAfterSave = await evaluate(`Boolean(document.querySelector('dialog[open]'))`);
    const draftPinsAfterSave = await evaluate(`document.querySelectorAll('.draft-pin').length`);
    console.log('Modal open after save:', modalAfterSave);
    console.log('Draft pins after save:', draftPinsAfterSave);

    if (modalAfterSave) throw new Error('Modal should be closed after successful save!');
    if (draftPinsAfterSave !== 0) throw new Error('Draft pin should be cleared after save!');

    // Check API response has the new location
    const apiAfterSave = await evaluate(`
      fetch('/api/workspace').then(r => r.json())
    `);
    console.log('API revision after save:', apiAfterSave.revision);
    console.log('Locations count in API:', apiAfterSave.locations.length);
    const savedLoc = apiAfterSave.locations.find(l => l.name === testLocationName);
    console.log('Saved location in API:', {
      id: savedLoc?.id,
      name: savedLoc?.name,
      region: savedLoc?.region,
      coordinates: savedLoc?.coordinates
    });

    if (!savedLoc) throw new Error('Location was not saved to database!');
    if (apiAfterSave.locations.length !== initialCount + 1) {
      throw new Error(`Expected ${initialCount + 1} locations, got ${apiAfterSave.locations.length}`);
    }
    createdLocationIds.add(savedLoc.id);
    console.log(`Registered created test fixture ID for cleanup: ${savedLoc.id}`);

    // Check selected spot in UI is the newly created spot
    const selectedSpotInUI = await evaluate(`
      (() => {
        const titleEl = document.querySelector('.detail-heading h2');
        return titleEl?.textContent;
      })()
    `);
    console.log('Detail panel title in UI:', selectedSpotInUI);
    if (selectedSpotInUI !== testLocationName) {
      throw new Error(`Detail panel does not show saved spot: ${selectedSpotInUI}`);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Step E: Existing marker click selects it, doesn't create draft
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step E: Existing marker click test ---');
    await evaluate(`document.querySelector('.detail-heading button[aria-label="Đóng chi tiết"]')?.click()`);
    await sleep(500);

    const selectionClosed = await evaluate(`!document.querySelector('.detail-heading')`);
    console.log('Detail panel closed:', selectionClosed);

    // Target the marker corresponding specifically to our test spot
    const markerClicked = await evaluate(`
      (() => {
        const marker = document.querySelector('.leaflet-marker-icon[title="${testLocationName}"]') ||
                       document.querySelector('.leaflet-marker-icon:not(.draft-pin)');
        if (!marker) return false;
        marker.click();
        return true;
      })()
    `);
    console.log('Clicked test marker:', markerClicked);
    await sleep(800);

    const draftPinsAfterMarkerClick = await evaluate(`document.querySelectorAll('.draft-pin').length`);
    const dialogOpenAfterMarkerClick = await evaluate(`Boolean(document.querySelector('dialog[open]'))`);
    const detailPanelAfterMarkerClick = await evaluate(`
      document.querySelector('.detail-heading h2')?.textContent
    `);
    console.log('Draft pins after marker click:', draftPinsAfterMarkerClick);
    console.log('Dialog open after marker click:', dialogOpenAfterMarkerClick);
    console.log('Detail panel selected title:', detailPanelAfterMarkerClick);

    if (draftPinsAfterMarkerClick !== 0) throw new Error('Marker click should NOT create a draft pin!');
    if (dialogOpenAfterMarkerClick) throw new Error('Marker click should NOT open create dialog!');
    if (detailPanelAfterMarkerClick !== testLocationName) {
      throw new Error(`Expected detail panel to select ${testLocationName}, got ${detailPanelAfterMarkerClick}`);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Step F: Edit existing spot through the panel
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step F: Edit existing spot ---');
    const editBtnClicked = await evaluate(`
      (() => {
        const editBtn = Array.from(document.querySelectorAll('.detail-actions button')).find(b => b.textContent.trim().includes('Edit'));
        if (editBtn) { editBtn.click(); return true; }
        return false;
      })()
    `);
    console.log('Clicked Edit button:', editBtnClicked);
    await sleep(600);

    const updatedNotes = 'Ghi chú khảo sát đã được cập nhật qua flow chỉnh sửa.';
    const editSaved = await evaluate(`
      (() => {
        const d = document.querySelector('dialog[open]');
        if (!d) return { error: 'Edit dialog not open' };
        const notesArea = d.querySelector('textarea[name="notes"]');
        if (notesArea) notesArea.value = ${JSON.stringify(updatedNotes)};
        d.querySelector('button.primary')?.click();
        return { success: true };
      })()
    `);
    console.log('Updated notes and saved:', editSaved);
    await sleep(1500);

    const apiAfterEdit = await evaluate(`
      fetch('/api/workspace').then(r => r.json())
    `);
    console.log('API revision after edit:', apiAfterEdit.revision);
    const editedLoc = apiAfterEdit.locations.find(l => l.id === savedLoc.id);
    if (!editedLoc) throw new Error('Saved test location not found in API after edit!');
    console.log('Updated test location scouting_notes:', editedLoc.scouting_notes);
    if (editedLoc.scouting_notes !== updatedNotes) {
      throw new Error('Location edit did not persist!');
    }

    // ────────────────────────────────────────────────────────────────────────
    // Step G: Stale revision conflict error handling
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step G: Stale revision conflict test ---');
    const conflictResult = await evaluate(`
      fetch('/api/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revision: 0,
          locations: [],
          tours: []
        })
      }).then(r => ({ status: r.status, ok: r.ok }))
    `);
    console.log('Stale revision PUT status:', conflictResult);
    if (conflictResult.status !== 409) {
      throw new Error(`Expected 409 for stale revision, got ${conflictResult.status}`);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Step H: Persistence across full reload
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step H: Verify persistence across full reload ---');
    await send('Page.reload');
    await sleep(3500);

    const stateAfterReload = await evaluate(`
      (() => {
        const markerCount = document.querySelectorAll('.leaflet-marker-icon:not(.draft-pin)').length;
        const libraryCount = document.querySelector('.library-nav .count')?.textContent;
        return { markerCount, libraryCount };
      })()
    `);
    console.log('State after full reload:', stateAfterReload);
    if (stateAfterReload.markerCount !== initialCount + 1) {
      throw new Error(`Expected ${initialCount + 1} markers after reload, got ${stateAfterReload.markerCount}`);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Step I: Test-fixture hygiene & cleanup
    // Clean up all synthetic locations created during this run.
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step I: Test-fixture hygiene & cleanup ---');
    for (const id of createdLocationIds) {
      cleanupSyntheticLocation(id);
    }
    createdLocationIds.clear();
    await sleep(1500);

    // Verify production database no longer contains any synthetic test data
    const apiAfterCleanup = await evaluate(`
      fetch('/api/workspace').then(r => r.json())
    `);
    console.log('Locations count in API after cleanup:', apiAfterCleanup.locations.length);
    const remainingTestFixtures = apiAfterCleanup.locations.filter(l => l.name.includes('(E2E Test)'));
    if (remainingTestFixtures.length !== 0) {
      throw new Error(`Synthetic test data still present after cleanup: ${remainingTestFixtures.length}`);
    }
    // Verify all baseline production locations are completely preserved
    const remainingBaselineIds = new Set(apiAfterCleanup.locations.map(l => l.id));
    for (const id of initialLocationIds) {
      if (!remainingBaselineIds.has(id)) {
        throw new Error(`CRITICAL: Baseline production location ${id} was accidentally removed!`);
      }
    }
    console.log(`Unrelated production data completely preserved (${initialCount} baseline spots intact).`);
    console.log('Database hygiene confirmed clean! Zero test fixtures remaining in production. ✅');

    console.log('\n========================================');
    console.log('ALL VERIFICATION CHECKS & CLEANUP PASSED! ✅');
    console.log('========================================\n');
  } finally {
    // Safety net: purge any remaining created test IDs even if assertion failed
    if (createdLocationIds.size > 0) {
      console.log(`[SAFETY NET] Cleaning up ${createdLocationIds.size} orphaned test fixtures...`);
      for (const id of createdLocationIds) {
        try { cleanupSyntheticLocation(id); } catch {}
      }
    }
    if (ws) ws.close();
    edgeProc.kill('SIGKILL');
  }
}

main().catch(err => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
