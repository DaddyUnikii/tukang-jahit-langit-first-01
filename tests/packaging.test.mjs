import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const path = new URL('../main.ts',import.meta.url);

test('packaging entrypoint is authored and delegates the dossier to the unchanged kit vendor',()=>{
  assert.ok(existsSync(path),'main.ts packaging entrypoint is missing');
  const source=readFileSync(path,'utf8');
  assert.ok(source.includes("from './vendor/makefun-game.ts'"),'uses the genuine kit builder');
  assert.ok(source.includes('MAKEFUN_OUTPUT_DIR'),'output path supports actual local execution');
  assert.ok(source.includes('buildDossier('));
  assert.ok(!/fetch\(|https?:\/\//.test(source),'packaging requires no network');
});
