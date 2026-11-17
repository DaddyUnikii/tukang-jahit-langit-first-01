import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('the static game page declares the complete start and restart controls', () => {
  const path = resolve(root, 'game/index.html');
  assert.ok(existsSync(path), 'the playable HTML page is missing');
  const html = readFileSync(path, 'utf8');
  for (const id of ['scene','title-panel','start-btn','restart-btn','result-panel']) {
    assert.ok(html.includes(`id="${id}"`), `missing user-facing ${id}`);
  }
  assert.ok(!/<script[^>]+type=["']module/.test(html), 'openable file:// uses classic local scripts');
  assert.ok(!/(?:src|href)=["'](?:https?:|\/\/)/.test(html), 'no CDN/network dependencies');
});

test('the interface CSS preserves a bounded logical scene with usable focus and results layering', () => {
  const path = resolve(root, 'game/style.css');
  assert.ok(existsSync(path), 'responsive interface styling has not been implemented');
  const css = readFileSync(path, 'utf8');
  for(const term of ['[hidden]', ':focus-visible', '#game-shell', '#scene', 'aspect-ratio', '.result-panel']) {
    assert.ok(css.includes(term), `missing interface behavior ${term}`);
  }
  assert.ok(!/https?:\/\//.test(css), 'no remote fonts or background images');
});
