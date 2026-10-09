import { spawn } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROFILE_DIR = resolve('E:/Tools/qn-location-scouting/.tmp/smoke-profile');
const DB_PATH = resolve('E:/Tools/qn-location-scouting/.tmp/smoke.sqlite');
const PORT = 3456;
const TARGET_URL = `http://127.0.0.1:${PORT}/`;

try { rmSync(PROFILE_DIR, { recursive: true, force: true }); } catch {}
try { rmSync(DB_PATH, { force: true }); } catch {}
mkdirSync(PROFILE_DIR, { recursive: true });

console.log('1. Starting local server with fresh SQLite database...');
const serverProc = spawn(process.execPath, ['server/index.mjs'], {
  cwd: 'E:/Tools/qn-location-scouting',
  env: { ...process.env, PORT: String(PORT), SCOUT_DB: DB_PATH },
  stdio: 'inherit'
});

await new Promise(r => setTimeout(r, 1500));

console.log('2. Launching headless Edge browser...');
const edgeProc = spawn(EDGE_PATH, [
  '--headless=new',
  '--remote-debugging-port=9223',
  `--user-data-dir=${PROFILE_DIR}`,
  '--window-size=1280,800',
  'about:blank'
], { stdio: 'ignore' });

let ws;
let msgId = 1;
const pending = new Map();

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

async function main() {
  try {
    await sleep(2000);
    const versionRes = await fetch('http://127.0.0.1:9223/json/version');
    const versionData = await versionRes.json();
    console.log('Connected to Edge:', versionData.Browser);

    const listRes = await fetch('http://127.0.0.1:9223/json/list');
    const targets = await listRes.json();
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];

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

    console.log(`3. Navigating to ${TARGET_URL}...`);
    await send('Page.navigate', { url: TARGET_URL });
    await sleep(2500);

    const statusText = await evaluate(`document.querySelector('.save-status')?.getAttribute('aria-label')`);
    console.log('Server connection status in UI:', statusText);
    if (!statusText?.includes('Đã kết nối')) {
      throw new Error(`Unexpected connection status: ${statusText}`);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Feature Check 1: Astra "Thêm spot trên map" placing mode
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Check 1: Astra Map Placing Pin Mode ---');
    const placeBtn = await evaluate(`
      (() => {
        const btn = document.querySelector('.place-pin-button');
        return { text: btn?.textContent, visible: Boolean(btn) };
      })()
    `);
    console.log('Place pin button:', placeBtn);
    if (!placeBtn.visible) throw new Error('Astra place-pin-button not found on map!');

    // Click button to activate placing mode
    await evaluate(`document.querySelector('.place-pin-button')?.click()`);
    await sleep(300);

    const isPlacing = await evaluate(`
      Boolean(document.querySelector('.place-pin-button.active')) &&
      Boolean(document.querySelector('.placing-hint'))
    `);
    console.log('Placing mode activated with hint:', isPlacing);
    if (!isPlacing) throw new Error('Placing mode did not activate!');

    // Now click on map to place pin
    const mapRect = await evaluate(`
      (() => {
        const r = document.querySelector('.leaflet-root')?.getBoundingClientRect();
        return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
      })()
    `);
    const clickX = Math.round(mapRect.x + mapRect.width * 0.45);
    const clickY = Math.round(mapRect.y + mapRect.height * 0.45);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: clickX, y: clickY, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: clickX, y: clickY, button: 'left', clickCount: 1 });
    await sleep(600);

    const modalAfterPlace = await evaluate(`
      (() => {
        const d = document.querySelector('dialog[open]');
        return {
          open: Boolean(d),
          lat: d?.querySelector('input[name="lat"]')?.value,
          lng: d?.querySelector('input[name="lng"]')?.value
        };
      })()
    `);
    console.log('Modal opened from map place:', modalAfterPlace);
    if (!modalAfterPlace.open || !modalAfterPlace.lat) throw new Error('Modal did not open with coordinates!');

    // Save Spot 1: Eo Gió
    await evaluate(`
      (() => {
        const d = document.querySelector('dialog[open]');
        d.querySelector('input[name="name"]').value = 'Eo Gió Quy Nhơn';
        d.querySelector('input[name="region"]').value = 'Nhơn Lý';
        d.querySelector('button.primary').click();
      })()
    `);
    await sleep(800);
    console.log('Spot 1 (Eo Gió) saved.');

    // Save Spot 2: Kỳ Co
    await evaluate(`document.querySelector('.place-pin-button')?.click()`);
    await sleep(300);
    const click2X = Math.round(mapRect.x + mapRect.width * 0.55);
    const click2Y = Math.round(mapRect.y + mapRect.height * 0.55);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: click2X, y: click2Y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: click2X, y: click2Y, button: 'left', clickCount: 1 });
    await sleep(600);

    await evaluate(`
      (() => {
        const d = document.querySelector('dialog[open]');
        d.querySelector('input[name="name"]').value = 'Bãi biển Kỳ Co';
        d.querySelector('input[name="region"]').value = 'Nhơn Lý';
        d.querySelector('button.primary').click();
      })()
    `);
    await sleep(800);
    console.log('Spot 2 (Kỳ Co) saved.');

    // ────────────────────────────────────────────────────────────────────────
    // Feature Check 2: Astra Tour Builder (Multi-Spot Tour Creation)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Check 2: Astra Tour Builder ---');
    // Open TourBuilder using the accessible header action.
    await evaluate(`
      (() => {
        const browseBtn = document.querySelector('button[aria-label="Xem tất cả spots"]');
        browseBtn?.click();
      })()
    `);
    await sleep(500);

    const builderOpen = await evaluate(`
      (() => {
        const d = document.querySelector('dialog[open]');
        const title = d?.querySelector('h2')?.textContent;
        const pickerRows = d?.querySelectorAll('.spot-picker-row').length;
        return { open: Boolean(d), title, pickerRows };
      })()
    `);
    console.log('Tour Builder dialog details:', builderOpen);
    if (!builderOpen.open || builderOpen.pickerRows !== 2) {
      throw new Error(`Tour Builder did not render properly: ${JSON.stringify(builderOpen)}`);
    }

    // Select both spots in TourBuilder and reorder them
    await evaluate(`
      (() => {
        const d = document.querySelector('dialog[open]');
        const checkboxes = d.querySelectorAll('.spot-picker-row input[type="checkbox"]');
        checkboxes.forEach(c => c.click());
      })()
    `);
    await sleep(300);

    const chosenCount = await evaluate(`
      document.querySelectorAll('.chosen-stops > div').length
    `);
    console.log('Chosen stops selected in builder:', chosenCount);
    if (chosenCount !== 2) throw new Error(`Expected 2 chosen stops, got ${chosenCount}`);

    // Set tour title and create tour
    const tourTitle = 'Khảo sát Duyên hải Nhơn Lý';
    await evaluate(`
      (() => {
        const d = document.querySelector('dialog[open]');
        const nameInput = d.querySelector('#new-tour-name');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(nameInput, ${JSON.stringify(tourTitle)});
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `);
    await sleep(300);

    const submitBtnDisabled = await evaluate(`
      document.querySelector('.builder-save button.primary')?.disabled
    `);
    console.log('Builder submit button disabled after title input:', submitBtnDisabled);

    await evaluate(`
      document.querySelector('.builder-save button.primary')?.click()
    `);
    await sleep(1500);

    // Verify tour is now active in Workspace
    const currentTourTitle = await evaluate(`
      (() => {
        const select = document.querySelector('#desktop-tour-choice');
        return select?.options[select.selectedIndex]?.text;
      })()
    `);
    console.log('Active tour in switcher after creation:', currentTourTitle);
    if (!currentTourTitle?.includes(tourTitle)) {
      throw new Error(`Created tour not selected: ${currentTourTitle}`);
    }

    const stopsInSidebar = await evaluate(`document.querySelectorAll('.stop-card').length`);
    console.log('Stops rendered in sidebar for new tour:', stopsInSidebar);
    if (stopsInSidebar !== 2) throw new Error(`Expected 2 stops in tour, got ${stopsInSidebar}`);

    // ────────────────────────────────────────────────────────────────────────
    // Feature Check 3: Astra Road Routing integration
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Check 3: Astra Road Routing UI Indicator ---');
    const routeSummary = await evaluate(`
      (() => {
        const el = document.querySelector('.route-summary');
        return { visible: Boolean(el), text: el?.textContent };
      })()
    `);
    console.log('Route summary element on map:', routeSummary);
    if (!routeSummary.visible) {
      throw new Error('Route summary element not rendered for multi-stop tour!');
    }

    console.log('\n========================================');
    console.log('ALL ASTRA FEATURES VERIFIED ON LOCAL SMOKE TEST! ✅');
    console.log('========================================\n');
  } finally {
    if (ws) ws.close();
    edgeProc.kill('SIGKILL');
    serverProc.kill('SIGKILL');
    try { rmSync(DB_PATH, { force: true }); } catch {}
  }
}

main().catch(err => {
  console.error('\n❌ Smoke test failed:', err);
  process.exit(1);
});
