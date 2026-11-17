import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const source = new URL('../game/sky-render.js', import.meta.url);
const require = createRequire(import.meta.url);
const available = existsSync(source);
const SkyRender = available ? require(source.pathname) : {};

// Deliberately asserts a missing source/API rather than throwing on import.
test('renderer exists as an offline classic-script API', () => {
  assert.equal(available, true, 'game/sky-render.js must exist');
  for (const name of ['render', 'hitPin', 'hitBridge']) {
    assert.equal(typeof SkyRender[name], 'function', `SkyRender.${name} must be callable`);
  }
  assert.equal(globalThis.SkyRender, SkyRender);
});

const fixture = () => ({
  level: {
    id: 'render-fixture', title: 'Renderer fixture, not gameplay', budget: 200,
    maxSpan: 500, parMoves: 4, start: '1', goal: '4',
    nodes: [
      { id: '1', label: 'Spool', x: 180, y: 390, glow: 0, flower: false },
      { id: '2', label: 'Lantern', x: 440, y: 240, glow: 1, flower: true },
      { id: '3', label: 'Ferry', x: 730, y: 390, glow: 1, flower: false },
      { id: '4', label: 'Home', x: 1040, y: 280, glow: 0, flower: true }
    ], storms: [{ x: 600, y: 280, r: 55 }]
  }, phase: 'journey', current: '1',
  bridges: [{ a: '1', b: '2', strands: 1, cost: 31 }],
  threadLeft: 169, lostThread: 0, swarm: 1, rescued: [], collected: [],
  moves: 0, history: [], lastEvent: null
});

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

test('pin target includes a generous 32px logical radius', () => {
  const state = deepFreeze(fixture());
  assert.equal(SkyRender.hitPin(state, 180, 390), '1');
  assert.equal(SkyRender.hitPin(state, 212, 390), '1');
  assert.equal(SkyRender.hitPin(state, 212.01, 390), null);
  assert.equal(SkyRender.hitPin(state, 100, 100), null);
});

test('pin picking chooses nearest overlap and rejects invalid coordinates', () => {
  const state = fixture();
  state.level.nodes.push({ id: '5', label: 'Near', x: 208, y: 390 });
  const before = JSON.stringify(state);
  assert.equal(SkyRender.hitPin(state, 198, 390), '5');
  assert.equal(SkyRender.hitPin(state, 194, 390), '1', 'ties preserve level order');
  for (const point of [[NaN, 390], [180, Infinity], [undefined, 390]]) {
    assert.equal(SkyRender.hitPin(state, ...point), null);
  }
  assert.equal(SkyRender.hitPin(null, 180, 390), null);
  assert.equal(JSON.stringify(state), before);
});

test('bridge picking follows the visible sagging thread rather than an invisible chord', () => {
  const state = deepFreeze(fixture());
  // 300.17px span has 22.51px midspan sag in the renderer.
  assert.deepEqual(SkyRender.hitBridge(state, 310, 337.5), { a: '1', b: '2' });
  assert.deepEqual(SkyRender.hitBridge(state, 310, 349.5), { a: '1', b: '2' });
  assert.equal(SkyRender.hitBridge(state, 310, 380), null);
  assert.equal(SkyRender.hitBridge(state, 180, 390), null, 'pin owns its own target');
  assert.equal(SkyRender.hitBridge(state, NaN, 330), null);
  assert.equal(SkyRender.hitBridge(null, 310, 337.5), null);
});

// This recorder audits pure drawing calls without substituting gameplay.
// The companion browser harness exercises an actual CanvasRenderingContext2D.
function recordingContext() {
  const calls = [];
  const paints = [];
  let depth = 0;
  const gradient = { addColorStop() {} };
  const target = { canvas: { width: 1280, height: 720 }, calls, paints };
  const context = new Proxy(target, {
    get(object, name) {
      if (name in object) return object[name];
      if (name === 'depth') return depth;
      if (name === 'measureText') return text => ({ width: String(text).length * 7 });
      if (name === 'createLinearGradient' || name === 'createRadialGradient') return () => gradient;
      if (name === 'save') return () => { depth++; calls.push(['save']); };
      if (name === 'restore') return () => { depth--; calls.push(['restore']); };
      return (...args) => {
        for (const value of args) {
          if (typeof value === 'number') assert.ok(Number.isFinite(value), `${String(name)} coordinates must be finite`);
        }
        calls.push([name, ...args]);
      };
    },
    set(object, name, value) { paints.push([name, value]); object[name] = value; return true; }
  });
  return context;
}

test('render paints an immutable frozen scene and balances context state', () => {
  const state = deepFreeze(fixture());
  const view = deepFreeze({
    state, screen: 'play', mode: 'stitch', selected: '1', hover: '2',
    pointer: { x: 440, y: 240 }, time: 1250, flight: null, effects: []
  });
  const before = JSON.stringify(view);
  const ctx = recordingContext();
  assert.doesNotThrow(() => SkyRender.render(ctx, view));
  assert.equal(JSON.stringify(view), before, 'render must not alter view or model');
  assert.ok(ctx.calls.some(call => call[0] === 'fillRect' || call[0] === 'drawImage'), 'render must actually paint its scene');
  assert.equal(ctx.depth, 0, 'save/restore must balance');
});

test('paper islands keep every numbered pin and its name visibly identifiable', () => {
  const state = deepFreeze(fixture());
  const ctx = recordingContext();
  SkyRender.render(ctx, { state, screen: 'play', mode: 'guide', time: 0 });
  for (const node of state.level.nodes) {
    assert.ok(ctx.calls.some(call => call[0] === 'fillText' && call[1] === node.id && call[2] === node.x), `island ${node.id} must print its number`);
    assert.ok(ctx.calls.some(call => call[0] === 'fillText' && call[1] === node.label), `island ${node.id} must print its name`);
  }
  assert.ok(ctx.calls.filter(call => call[0] === 'lineTo').length > 400, 'islands need torn layered silhouettes, not only circles');
  assert.equal(ctx.depth, 0);
});

test('bridges use sagging gold running stitches with distinct strand capacities', () => {
  const state = fixture();
  state.bridges.push({ a: '3', b: '4', strands: 2, cost: 66 });
  deepFreeze(state);
  const ctx = recordingContext();
  SkyRender.render(ctx, { state, screen: 'play', mode: 'guide', time: 0 });
  assert.ok(ctx.calls.some(call => call[0] === 'quadraticCurveTo' && Math.abs(call[1] - 310) < 0.1 && call[2] > 350 && call[3] === 440 && call[4] === 240), 'bridge drawing and picking must share the actual curved thread');
  for (const label of ['I · 1', 'II · 3']) {
    assert.ok(ctx.calls.some(call => call[0] === 'fillText' && call[1] === label), `bridge capacity ${label} should be identifiable without color`);
  }
  assert.ok(ctx.calls.some(call => call[0] === 'setLineDash' && Array.isArray(call[1]) && call[1][0] === 3), 'yarn gets running stitch marks');
  assert.equal(ctx.depth, 0);
});

test('storm hazard has a clearance boundary and lightning rather than decorative scissors', () => {
  const state = deepFreeze(fixture());
  const ctx = recordingContext();
  SkyRender.render(ctx, { state, screen: 'play', mode: 'stitch', time: 400 });
  const { x, y, r } = state.level.storms[0];
  assert.ok(ctx.calls.some(call => call[0] === 'arc' && call[1] === x && call[2] === y && call[3] === r + 6), 'hazard outlines the true circular clearance zone');
  assert.ok(ctx.calls.some(call => call[0] === 'fillText' && call[1] === '!'), 'storm warns without color alone');
  assert.ok(ctx.paints.some(paint => paint[0] === 'fillStyle' && paint[1] === '#ffe3a4'), 'storm carries paper lightning');
  assert.equal(ctx.depth, 0);
});

test('stitch preview uses the selected pin and signals blocked chords', () => {
  const state = deepFreeze(fixture());
  const ctx = recordingContext();
  SkyRender.render(ctx, { state, screen: 'play', mode: 'stitch', selected: '2', pointer: { x: 760, y: 320 }, time: 0 });
  assert.ok(ctx.calls.some(call => call[0] === 'quadraticCurveTo' && call[3] === 760 && call[4] === 320), 'preview reaches logical pointer');
  assert.ok(ctx.paints.some(paint => paint[0] === 'strokeStyle' && paint[1] === '#ed987e'), 'storm-blocked preview uses coral warning');
  assert.equal(ctx.depth, 0);
});

test('cut hover highlights the actual bridge with a scissors glyph', () => {
  const state = deepFreeze(fixture());
  const ctx = recordingContext();
  SkyRender.render(ctx, { state, screen: 'play', mode: 'cut', pointer: { x: 310, y: 337.5 }, time: 0 });
  assert.ok(ctx.paints.some(paint => paint[0] === 'strokeStyle' && paint[1] === '#ed987e'), 'cut hover is coral');
  assert.ok(ctx.calls.some(call => call[0] === 'arc' && Math.abs(call[3] - 3.8) < 0.001), 'cut target draws the scissors handles');
  assert.equal(ctx.depth, 0);
});

test('current swarm rests above the current logical pin without a flight', () => {
  const state = fixture();
  state.current = '3'; state.swarm = 3;
  deepFreeze(state);
  const ctx = recordingContext();
  SkyRender.render(ctx, { state, screen: 'play', mode: 'guide', time: 0, flight: null });
  const bodies = ctx.calls.filter(call => call[0] === 'ellipse' && call[3] === 2.4 && call[4] === 3.8);
  assert.equal(bodies.filter(call => Math.abs(call[1] - 730) < 38 && call[2] < 360).length, 3, 'draw three actual flock fireflies above island 3');
  assert.equal(ctx.depth, 0);
});

test('normalised flight progress follows the actual sagging bridge and its own swarm', () => {
  const state = deepFreeze(fixture());
  const flight = deepFreeze({ from: '1', to: '2', progress: 0.5, swarm: 2 });
  const ctx = recordingContext();
  SkyRender.render(ctx, { state, screen: 'play', mode: 'guide', time: 0, flight });
  const bodies = ctx.calls.filter(call => call[0] === 'ellipse' && call[3] === 2.4 && call[4] === 3.8);
  assert.equal(bodies.length, 2, 'flight swarm is not state swarm');
  for (const body of bodies) {
    assert.ok(Math.abs(body[1] - 310) < 20 && body[2] > 302 && body[2] < 320, 'flock is above the curved midspan, not the current island or chord');
  }
  assert.equal(JSON.stringify(flight), '{"from":"1","to":"2","progress":0.5,"swarm":2}');
});

test('rescued islands show a stitched flag and collected flowers visibly dim', () => {
  const state = fixture();
  state.rescued = ['2']; state.collected = ['2'];
  deepFreeze(state);
  const ctx = recordingContext();
  SkyRender.render(ctx, { state, screen: 'play', mode: 'guide', time: 0 });
  assert.ok(ctx.calls.some(call => call[0] === 'fillText' && call[1] === '✓'), 'mended pickup receives a visible sewn check flag');
  assert.ok(ctx.paints.some(paint => paint[0] === 'fillStyle' && paint[1] === '#8f9674'), 'collected flower becomes dull paper rather than a glowing reward');
  assert.ok(ctx.calls.some(call => call[0] === 'fillText' && call[1] === '+1'), 'unrescued glow shows its pickup count');
  assert.equal(ctx.depth, 0);
});

test('title keeps real model pins out of the left DOM text region and draws right-side title art', () => {
  const state = deepFreeze(fixture());
  const ctx = recordingContext();
  SkyRender.render(ctx, { state, screen: 'title', mode: 'stitch', time: 1200 });
  for (const node of state.level.nodes) {
    assert.ok(!ctx.calls.some(call => call[0] === 'fillText' && (call[1] === node.id || call[1] === node.label)), 'title is decorative art, never a fake game board');
  }
  assert.ok(ctx.calls.some(call => call[0] === 'translate' && call[1] >= 720 && call[1] <= 1150), 'ornate island art belongs on the right');
  assert.equal(ctx.depth, 0);
});

test('empty night scene has bounded time-driven ambiance and reproducible drawing', () => {
  const state = fixture(); state.level.nodes = []; state.level.storms = []; state.bridges = [];
  deepFreeze(state);
  const a = recordingContext(), b = recordingContext(), repeated = recordingContext();
  for (const [ctx,time] of [[a,0],[b,3000],[repeated,0]]) SkyRender.render(ctx,{state,screen:'play',time});
  assert.notDeepEqual(a.calls,b.calls,'ambient paper clouds and threaded stars should breathe even without game pieces');
  assert.deepEqual(a.calls,repeated.calls,'fixed seeds and fixed time are reproducible');
  assert.ok(a.calls.filter(call=>call[0]==='arc'||call[0]==='ellipse').length < 500,'bounded ambient budget');
});

test('all screen variants and clamped flight endpoints keep frozen models unchanged', () => {
  const state = deepFreeze(fixture());
  const before = JSON.stringify(state);
  for (const screen of ['title','play','won','lost','book','ending']) {
    const ctx = recordingContext();
    const view = deepFreeze({state,screen,time:600,mode:'guide',flight:{from:'1',to:'2',progress:1.8,swarm:3},effects:[]});
    assert.doesNotThrow(()=>SkyRender.render(ctx,view), screen);
    assert.equal(ctx.depth,0,screen);
    assert.equal(JSON.stringify(state),before,screen);
  }
  const ctx = recordingContext();
  assert.doesNotThrow(()=>SkyRender.render(ctx,{state,screen:'play',time:NaN,flight:{from:'bad',to:'2',progress:NaN,swarm:0}}));
  assert.equal(ctx.depth,0);
});

test('bridge picking skips orphan edges and chooses nearest overlapping yarn deterministically', () => {
  const state=fixture();
  state.level.nodes=[{id:'1',x:200,y:300},{id:'2',x:600,y:300},{id:'3',x:200,y:312},{id:'4',x:600,y:312}];
  state.bridges=[{a:'missing',b:'2',strands:1},{a:'1',b:'2',strands:1},{a:'3',b:'4',strands:2}];
  const before=JSON.stringify(state);
  assert.deepEqual(SkyRender.hitBridge(state,400,341),{a:'3',b:'4'});
  assert.deepEqual(SkyRender.hitBridge(state,400,330),{a:'1',b:'2'});
  assert.equal(SkyRender.hitBridge(state,140,300),null);
  assert.equal(JSON.stringify(state),before);
  assert.equal(SkyRender.hitPin({level:{nodes:[]}},200,300),null);
});

test('paper crescent stays wholly below the gameplay HUD', () => {
  const ctx=recordingContext();
  SkyRender.render(ctx,{screen:'play',time:0});
  const moon=ctx.calls.find(call=>call[0]==='arc'&&call[1]===1157&&call[3]===39);
  assert.ok(moon,'paper crescent exists');
  assert.ok(moon[2]-moon[3]>=175,'moon must clear the HUD ending at y165');
});

test('optional flower emblem is large enough to distinguish its paper petals', () => {
  const state=deepFreeze(fixture());
  const ctx=recordingContext();
  SkyRender.render(ctx,{state,screen:'play',time:0});
  const flower=state.level.nodes.find(node=>node.flower);
  assert.ok(ctx.calls.some(call=>call[0]==='arc'&&call[3]>=3&&Math.abs(call[1]-(flower.x-32))<11&&Math.abs(call[2]-(flower.y+17))<11),'flower petals need a larger identifiable silhouette');
});
