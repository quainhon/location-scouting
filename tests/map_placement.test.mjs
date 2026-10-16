// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { ScoutMap } from '../src/components/ScoutMap';

let host, root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const style = document.createElement('style');
  style.textContent = readFileSync('node_modules/tailwindcss/src/css/preflight.css', 'utf8') + '\n' + readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8');
  document.head.append(style);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root?.unmount()); host?.remove(); document.head.innerHTML = ''; vi.unstubAllGlobals(); });

it.each([false, true])('keeps tile sizing through placement, cancellation and pin click (mobile=%s)', async mobile => {
  vi.stubGlobal('matchMedia', () => ({ matches: mobile }));
  const props = { locations: [], stops: [], selectedId: '', onSelect: vi.fn(), onCreateDraft: vi.fn(), draftPoint: null, fitSignal: 0 };
  await act(async () => root.render(React.createElement(ScoutMap, props)));
  const container = host.querySelector('.leaflet-root');
  const tile = host.querySelector('img.leaflet-tile');
  expect(tile).not.toBeNull();
  expect(getComputedStyle(tile).maxWidth).toBe('none');
  const leafletClasses = [...container.classList].filter(name => name.startsWith('leaflet-'));
  for (let i = 0; i < 4; i++) {
    await act(async () => host.querySelector('.place-pin-button').click());
    expect(getComputedStyle(tile).maxWidth, 'Loaded tiles must keep Leaflet sizing after toggling placement').toBe('none');
    for (const name of leafletClasses) expect(container.classList.contains(name), name).toBe(true);
  }
  await act(async () => root.render(React.createElement(ScoutMap, { ...props, pickSignal: 1 })));
  expect(host.querySelector('.place-pin-button').getAttribute('aria-pressed')).toBe('true');
  expect(container.classList.contains('leaflet-container')).toBe(true);
  expect(getComputedStyle(tile).maxWidth).toBe('none');
  await act(async () => container.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 120, clientY: 120 })));
  expect(props.onCreateDraft).toHaveBeenCalledOnce();
  expect(host.querySelector('.place-pin-button').getAttribute('aria-pressed')).toBe('false');
  expect(host.querySelector('img.leaflet-tile')).toBe(tile);
  expect(getComputedStyle(tile).maxWidth).toBe('none');
});

