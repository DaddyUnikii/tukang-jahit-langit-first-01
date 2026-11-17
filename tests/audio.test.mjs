import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

test('procedural audio safely stays silent without WebAudio and no user gesture', () => {
  const path = new URL('../game/sky-audio.js', import.meta.url);
  assert.ok(existsSync(path), 'procedural audio is not implemented');
  const Audio = require(path.pathname);
  const voice = Audio.create({});
  assert.equal(voice.enabled(), false);
  assert.doesNotThrow(() => voice.play('stitch'));
  assert.doesNotThrow(() => voice.unlock());
  assert.equal(voice.enabled(), false);
});

test('audio context is created only by unlock and muted play makes no oscillator', () => {
  const Audio = require(new URL('../game/sky-audio.js', import.meta.url).pathname);
  let created=0, started=0;
  class AudioContext {
    constructor() { created++; this.state='running'; this.currentTime=0; this.destination={}; }
    createGain() { return {connect(){},gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}}}; }
    createOscillator() { return {connect(){},frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},start(){started++},stop(){}}; }
    resume() { return Promise.resolve(); }
  }
  const voice=Audio.create({AudioContext});
  assert.equal(created,0);
  voice.play('stitch');
  assert.equal(started,0);
  voice.unlock();
  assert.equal(created,1);
  assert.equal(voice.enabled(),true);
  voice.play('stitch');
  assert.ok(started>0);
  voice.setMuted(true);
  const before=started;
  voice.play('win');
  assert.equal(started,before);
});
