import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const target = new URL('../game/sky-progress.js', import.meta.url);

test('progress starts at one unlocked evening even when storage is unavailable', () => {
  assert.ok(existsSync(target), 'progress persistence has not been implemented');
  const Progress = require(target.pathname);
  const save = Progress.load(null);
  assert.equal(save.unlocked, 1);
  assert.deepEqual(save.stars, []);
  assert.equal(save.language, 'en');
  assert.equal(save.muted, false);
});

test('untrusted stored progress is parsed, bounded and does not inherit injected properties', () => {
  const Progress = require(target.pathname);
  const stored = {getItem: () => JSON.stringify({unlocked:99, stars:[3,8,-1,'2',2.5,1],language:'id',muted:true,__proto__:{admin:true}})};
  const save = Progress.load(stored);
  assert.equal(save.unlocked, 8);
  assert.deepEqual(save.stars, [3,0,0,0,0,1]);
  assert.equal(save.language, 'id');
  assert.equal(save.muted, true);
  assert.equal(save.admin, undefined);
  assert.deepEqual(Progress.load({getItem: () => '{bad JSON'}), Progress.load(null));
  assert.deepEqual(Progress.load({getItem: () => {throw Error('blocked')}}), Progress.load(null));
});

test('only a earned completion unlocks the next night and keeps the best stars', () => {
  const Progress = require(target.pathname);
  assert.equal(typeof Progress.complete, 'function', 'completion persistence is missing');
  const base = Progress.load(null);
  const next = Progress.complete(base, 0, 2);
  assert.equal(base.unlocked, 1, 'does not mutate prior progress');
  assert.equal(next.unlocked, 2);
  assert.deepEqual(next.stars, [2]);
  assert.equal(Progress.complete(next,0,1).stars[0],2);
  assert.equal(Progress.complete(base,6,3).unlocked,1, 'a locked night cannot grant progress');
  let written='';
  assert.equal(Progress.save({setItem:(k,v)=>{written=v;}}, next),true);
  assert.deepEqual(JSON.parse(written),next);
  assert.equal(Progress.save({setItem:()=>{throw Error('blocked')}},next),false);
});
