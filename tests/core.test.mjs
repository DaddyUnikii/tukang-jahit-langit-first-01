import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const corePath = new URL('../game/sky-core.js', import.meta.url);
const contentPath = new URL('../game/levels.js', import.meta.url);
const solutionPath = new URL('./solutions.json', import.meta.url);
const SkyCore = fs.existsSync(corePath) ? require(corePath.pathname) : null;
const SkyLevels = fs.existsSync(contentPath) ? require(contentPath.pathname) : null;
const solutions = fs.existsSync(solutionPath) ? JSON.parse(fs.readFileSync(solutionPath, 'utf8')) : null;

function fixture(overrides = {}) {
  return {
    id: 'test', title: 'Test sky', subtitle: 'A small sky', hint: 'Follow the light.',
    budget: 120, maxSpan: 650, parMoves: 3, start: '1', goal: '3',
    nodes: [
      { id: '1', label: 'Spool', x: 180, y: 360, glow: 0, flower: false },
      { id: '2', label: 'Friend', x: 380, y: 360, glow: 1, flower: true },
      { id: '3', label: 'Home', x: 580, y: 360, glow: 0, flower: false }
    ],
    storms: [], ...overrides
  };
}

function api(name) {
  assert.ok(SkyCore, 'sky-core.js must exist before its API can be used');
  assert.equal(typeof SkyCore[name], 'function', `SkyCore.${name} must be implemented`);
  return SkyCore[name];
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function conserved(state) {
  assert.equal(state.threadLeft + state.lostThread + state.bridges.reduce((sum, b) => sum + b.cost, 0), state.level.budget);
  assert.ok(state.threadLeft >= 0 && state.lostThread >= 0 && state.swarm >= 1);
}

test('edge helpers use undirected keys, ceiling costs and strand capacities', () => {
  const level = fixture();
  assert.equal(api('edgeKey')('2', '1'), api('edgeKey')('1', '2'));
  assert.notEqual(api('edgeKey')('1', '2'), api('edgeKey')('1', '3'));
  assert.equal(api('bridgeCost')(level, '1', '2', 1), 20);
  assert.equal(api('bridgeCost')(level, '2', '1', 2), 40);
  const diagonal = fixture({ nodes: [
    { id: '1', x: 180, y: 360, glow: 0, flower: false },
    { id: '2', x: 201, y: 381, glow: 0, flower: false },
    { id: '3', x: 580, y: 360, glow: 0, flower: false }
  ] });
  assert.equal(api('bridgeCost')(diagonal, '1', '2', 1), 3);
  assert.equal(api('capacity')(1), 1);
  assert.equal(api('capacity')(2), 3);
  assert.equal(api('capacity')(0), 0);
  assert.equal(api('capacity')(3), 0);
  assert.equal(api('findBridge')(api('createState')(level), '1', '2'), null);
});

test('stitch spends finite thread and records an immutable planning snapshot', () => {
  const state = api('createState')(fixture());
  const before = clone(state);
  const result = api('command')(state, { type: 'stitch', a: '2', b: '1', strands: 1 });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'stitched');
  assert.notEqual(result.state, state);
  assert.deepEqual(state, before, 'successful commands must not edit their input');
  assert.deepEqual(result.state.bridges, [{ a: '1', b: '2', strands: 1, cost: 20 }]);
  assert.equal(result.state.threadLeft, 100);
  assert.equal(result.state.phase, 'planning');
  assert.equal(result.state.current, '1');
  assert.equal(result.state.history.length, 1);
  assert.equal('history' in result.state.history[0], false, 'snapshots cannot contain recursive history');
  assert.deepEqual(result.state.history[0].bridges, []);
  assert.deepEqual(result.event, { type: 'stitch', a: '1', b: '2', strands: 1, cost: 20 });
  assert.deepEqual(result.state.lastEvent, result.event);
  assert.equal(api('findBridge')(result.state, '2', '1').cost, 20);
  conserved(result.state);
});

function accepted(state, action) {
  const before = clone(state);
  const result = api('command')(state, action);
  assert.equal(result.ok, true, `${JSON.stringify(action)} rejected: ${result.code}`);
  assert.notEqual(result.state, state);
  assert.deepEqual(state, before, 'commands must not mutate their input');
  conserved(result.state);
  return result.state;
}

function rejected(state, action, code) {
  const before = clone(state);
  const result = api('command')(state, action);
  assert.equal(result.ok, false, `${JSON.stringify(action)} must reject`);
  assert.equal(result.code, code);
  assert.equal(result.state, state, 'rejection must preserve the identical state');
  assert.deepEqual(state, before, 'rejection must preserve every field');
  assert.notEqual(result.event, state.lastEvent, 'rejection feedback must remain separate');
  conserved(state);
}

test('stitch rejects malformed, duplicate, overlong and unaffordable requests without changes', () => {
  const state = api('createState')(fixture({ budget: 20, maxSpan: 210 }));
  rejected(state, null, 'invalid-action');
  rejected(state, { type: 'dance' }, 'invalid-action');
  rejected(state, { type: 'stitch', a: '1', b: '9', strands: 1 }, 'invalid-node');
  rejected(state, { type: 'stitch', a: 1, b: '2', strands: 1 }, 'invalid-node');
  rejected(state, { type: 'stitch', a: '1', b: '1', strands: 1 }, 'same-node');
  for (const strands of [undefined, 0, 3, 1.5, '1', NaN]) {
    rejected(state, { type: 'stitch', a: '1', b: '2', strands }, 'invalid-strands');
  }
  rejected(state, { type: 'stitch', a: '1', b: '3', strands: 1 }, 'too-far');
  rejected(state, { type: 'stitch', a: '1', b: '2', strands: 2 }, 'not-enough-thread');
  const stitched = accepted(state, { type: 'stitch', a: '1', b: '2', strands: 1 });
  assert.equal(stitched.threadLeft, 0, 'an exactly affordable bridge is legal');
  rejected(stitched, { type: 'stitch', a: '2', b: '1', strands: 1 }, 'duplicate');
  rejected(stitched, { type: 'stitch', a: '2', b: '3', strands: 1 }, 'not-enough-thread');
});

test('storm clearance uses the closed segment, including tangent and endpoint contact', () => {
  const action = { type: 'stitch', a: '1', b: '2', strands: 1 };
  for (const storm of [
    { x: 280, y: 360, r: 25 },
    { x: 280, y: 385, r: 25 },
    { x: 280, y: 391, r: 25 },
    { x: 120, y: 360, r: 54 }
  ]) {
    rejected(api('createState')(fixture({ storms: [storm] })), action, 'storm-blocked');
  }
  accepted(api('createState')(fixture({ storms: [{ x: 280, y: 391.1, r: 25 }] })), action);
  accepted(api('createState')(fixture({ storms: [{ x: 90, y: 360, r: 40 }] })), action);
  const diagonal = fixture({ nodes: [
    { id: '1', label: 'A', x: 180, y: 200, glow: 0, flower: false },
    { id: '2', label: 'B', x: 400, y: 420, glow: 1, flower: false },
    { id: '3', label: 'Home', x: 580, y: 360, glow: 0, flower: false }
  ], storms: [{ x: 300, y: 320, r: 12 }] });
  rejected(api('createState')(diagonal), action, 'storm-blocked');
  rejected(api('createState')(diagonal), { ...action, a: '2', b: '1' }, 'storm-blocked');
});

test('upgrading a single bridge charges only its incremental strand cost', () => {
  let state = api('createState')(fixture({ budget: 40 }));
  state = accepted(state, { type: 'stitch', a: '1', b: '2', strands: 1 });
  const before = clone(state);
  const result = api('command')(state, { type: 'stitch', a: '2', b: '1', strands: 2 });
  assert.equal(result.ok, true, 'an existing single must be upgradable');
  assert.equal(result.code, 'upgraded');
  assert.deepEqual(state, before);
  assert.equal(result.state.bridges.length, 1);
  assert.deepEqual(result.state.bridges[0], { a: '1', b: '2', strands: 2, cost: 40 });
  assert.equal(result.state.threadLeft, 0, 'upgrade must charge 20, not another full 40');
  assert.deepEqual(result.event, { type: 'upgrade', a: '1', b: '2', strands: 2, cost: 20 });
  conserved(result.state);
  rejected(result.state, { type: 'stitch', a: '1', b: '2', strands: 1 }, 'duplicate');
  rejected(result.state, { type: 'stitch', a: '2', b: '1', strands: 2 }, 'duplicate');
  const short = accepted(api('createState')(fixture({ budget: 39 })), { type: 'stitch', a: '1', b: '2', strands: 1 });
  rejected(short, { type: 'stitch', a: '1', b: '2', strands: 2 }, 'not-enough-thread');
});

test('cut refunds the full upgraded bridge once with no budget overflow', () => {
  let state = api('createState')(fixture({ budget: 40 }));
  state = accepted(state, { type: 'stitch', a: '1', b: '2', strands: 1 });
  state = accepted(state, { type: 'stitch', a: '2', b: '1', strands: 2 });
  const before = clone(state);
  const result = api('command')(state, { type: 'cut', a: '2', b: '1' });
  assert.equal(result.ok, true, 'cut must refund a sewn bridge');
  assert.equal(result.code, 'cut');
  assert.deepEqual(state, before);
  assert.deepEqual(result.state.bridges, []);
  assert.equal(result.state.threadLeft, 40);
  assert.deepEqual(result.event, { type: 'cut', a: '1', b: '2', strands: 2, cost: 40 });
  conserved(result.state);
  rejected(result.state, { type: 'cut', a: '1', b: '2' }, 'no-bridge');
  rejected(result.state, { type: 'cut', a: '1', b: '9' }, 'invalid-node');
});

test('launch starts a journey without movement, rescue or automatic solving', () => {
  let state = api('createState')(fixture());
  rejected(state, { type: 'move', to: '2' }, 'not-launched');
  const bare = accepted(state, { type: 'launch' });
  assert.equal(bare.phase, 'journey', 'launch must always be valid in planning');
  assert.equal(bare.current, '1');
  assert.equal(bare.moves, 0);
  assert.equal(bare.swarm, 1);
  assert.deepEqual(bare.rescued, []);
  rejected(bare, { type: 'launch' }, 'already-launched');
  state = accepted(state, { type: 'stitch', a: '1', b: '2', strands: 1 });
  const journey = accepted(state, { type: 'launch' });
  assert.deepEqual(journey.bridges, state.bridges, 'launch must keep the prepared bridges');
  assert.equal(journey.threadLeft, state.threadLeft);
  assert.deepEqual(journey.lastEvent, { type: 'launch', from: '1' });
  let sewing = accepted(journey, { type: 'stitch', a: '2', b: '3', strands: 2 });
  sewing = accepted(sewing, { type: 'cut', a: '2', b: '3' });
  assert.equal(sewing.phase, 'journey', 'sewing and cutting are legal at journey pins');
});

test('move requires a bridge and collects a pickup and flower only once', () => {
  let state = accepted(api('createState')(fixture()), { type: 'launch' });
  rejected(state, { type: 'move', to: '9' }, 'invalid-node');
  rejected(state, { type: 'move', to: '1' }, 'same-node');
  rejected(state, { type: 'move', to: '2' }, 'no-bridge');
  state = accepted(state, { type: 'stitch', a: '1', b: '2', strands: 2 });
  state = accepted(state, { type: 'move', to: '2' });
  assert.equal(state.current, '2');
  assert.equal(state.phase, 'journey');
  assert.equal(state.moves, 1);
  assert.equal(state.swarm, 2);
  assert.deepEqual(state.rescued, ['2']);
  assert.deepEqual(state.collected, ['2']);
  assert.deepEqual(state.lastEvent, { type: 'move', from: '1', to: '2', strands: 2, glows: 1 });
  state = accepted(state, { type: 'move', to: '1' });
  state = accepted(state, { type: 'move', to: '2' });
  assert.equal(state.moves, 3);
  assert.equal(state.swarm, 2);
  assert.deepEqual(state.rescued, ['2']);
  assert.deepEqual(state.collected, ['2']);
  assert.equal(state.lastEvent.glows, 0);
  const twin = fixture();
  twin.nodes[1].glow = 2;
  let two = accepted(api('createState')(twin), { type: 'stitch', a: '1', b: '2', strands: 1 });
  two = accepted(two, { type: 'launch' });
  two = accepted(two, { type: 'move', to: '2' });
  assert.equal(two.swarm, 3, 'capacity is checked before collecting the arrival pickup');
  assert.equal(two.lastEvent.glows, 2);
});

test('home gates victory until all pickups are rescued and freezes play after winning', () => {
  let state = api('createState')(fixture({ budget: 180 }));
  for (const [a, b, strands] of [['1', '3', 1], ['3', '2', 2]]) {
    state = accepted(state, { type: 'stitch', a, b, strands });
  }
  state = accepted(state, { type: 'launch' });
  state = accepted(state, { type: 'move', to: '3' });
  assert.equal(state.phase, 'journey');
  assert.equal(state.current, '3');
  assert.equal(state.lastEvent.reason, 'missing-glows', 'early home arrival must explain the gate');
  state = accepted(state, { type: 'move', to: '2' });
  state = accepted(state, { type: 'move', to: '3' });
  assert.equal(state.phase, 'won', 'arriving home after rescue must win');
  assert.equal(state.current, '3');
  assert.equal(state.moves, 3);
  assert.equal(state.lastEvent.type, 'win');
  for (const action of [
    { type: 'move', to: '2' }, { type: 'stitch', a: '1', b: '2', strands: 2 },
    { type: 'cut', a: '2', b: '3' }, { type: 'launch' }
  ]) rejected(state, action, 'finished');
  const goalPickup = fixture();
  goalPickup.nodes[1].glow = 0;
  goalPickup.nodes[2].glow = 2;
  let arrival = accepted(api('createState')(goalPickup), { type: 'stitch', a: '1', b: '3', strands: 1 });
  arrival = accepted(arrival, { type: 'launch' });
  arrival = accepted(arrival, { type: 'move', to: '3' });
  assert.equal(arrival.phase, 'won', 'goal pickups must be rescued before testing the goal gate');
  assert.equal(arrival.swarm, 3);
});

test('overweight crossing snaps the single bridge and loses its thread without moving', () => {
  let state = api('createState')(fixture());
  state = accepted(state, { type: 'stitch', a: '1', b: '2', strands: 1 });
  state = accepted(state, { type: 'stitch', a: '2', b: '3', strands: 1 });
  state = accepted(state, { type: 'launch' });
  state = accepted(state, { type: 'move', to: '2' });
  const before = clone(state);
  const result = api('command')(state, { type: 'move', to: '3' });
  assert.equal(result.ok, true, 'a snapped attempt is an undoable meaningful action');
  assert.equal(result.state.phase, 'lost', 'one strand cannot carry two fireflies');
  assert.equal(result.code, 'snapped');
  assert.deepEqual(state, before);
  assert.equal(result.state.current, '2', 'the flock stays at the departure pin');
  assert.equal(result.state.moves, 1, 'a failed crossing is not a successful move');
  assert.equal(result.state.swarm, 2);
  assert.equal(result.state.threadLeft, state.threadLeft, 'snapping never refunds');
  assert.equal(result.state.lostThread, 20);
  assert.equal(api('findBridge')(result.state, '2', '3'), null);
  assert.equal(result.state.bridges.length, 1);
  assert.deepEqual(result.event, { type: 'snap', a: '2', b: '3', from: '2', to: '3', strands: 1, cost: 20, reason: 'capacity' });
  assert.deepEqual(result.state.lastEvent, result.event);
  conserved(result.state);
  rejected(result.state, { type: 'cut', a: '1', b: '2' }, 'finished');
  rejected(result.state, { type: 'stitch', a: '2', b: '3', strands: 2 }, 'finished');
});

test('undo restores the previous snapshot from journey, loss and win, and reset is fresh', () => {
  let state = api('createState')(fixture({ budget: 180 }));
  rejected(state, { type: 'undo' }, 'no-history');
  for (const [a, b] of [['1', '2'], ['2', '3']]) state = accepted(state, { type: 'stitch', a, b, strands: 1 });
  state = accepted(state, { type: 'launch' });
  const prepared = state;
  state = accepted(state, { type: 'move', to: '2' });
  const afterPickup = state;
  state = accepted(state, { type: 'undo' });
  assert.deepEqual(state, prepared, 'undo must restore the exact pre-move snapshot');
  state = accepted(state, { type: 'move', to: '2' });
  const snapResult = api('command')(state, { type: 'move', to: '3' });
  assert.equal(snapResult.state.phase, 'lost');
  const restored = accepted(snapResult.state, { type: 'undo' });
  assert.deepEqual(restored, afterPickup, 'undo from a loss must return to before the crossing');
  assert.equal(restored.phase, 'journey');
  assert.equal(restored.lostThread, 0);
  assert.equal(api('findBridge')(restored, '2', '3').strands, 1);
  const winState = accepted(accepted(restored, { type: 'stitch', a: '2', b: '3', strands: 2 }), { type: 'move', to: '3' });
  assert.equal(winState.phase, 'won');
  const rewound = accepted(winState, { type: 'undo' });
  assert.equal(rewound.phase, 'journey', 'undo also works from a win');
  const reset = accepted(winState, { type: 'reset' });
  assert.deepEqual(reset, api('createState')(fixture({ budget: 180 })), 'reset must be a clean planning state');
  rejected(reset, { type: 'undo' }, 'no-history');
});

test('score deterministically rewards rescued glows, flowers, thread and par moves', () => {
  let state = api('createState')(fixture({ budget: 180, parMoves: 2 }));
  assert.deepEqual(api('score')(state), {
    points: 390, stars: 0, flowers: 0, totalFlowers: 1, rescued: 0, totalGlows: 2, threadLeft: 180, moves: 0
  });
  for (const [a, b, strands] of [['1', '2', 2], ['2', '3', 2]]) {
    state = accepted(state, { type: 'stitch', a, b, strands });
  }
  state = accepted(state, { type: 'launch' });
  state = accepted(state, { type: 'move', to: '2' });
  state = accepted(state, { type: 'move', to: '3' });
  assert.equal(state.phase, 'won');
  const score = api('score')(state);
  assert.deepEqual(score, {
    points: 370, stars: 3, flowers: 1, totalFlowers: 1,
    rescued: 1, totalGlows: 2, threadLeft: 100, moves: 2
  }, 'points = rescued*100 + flowers*70 + threadLeft*2 + max(0,parMoves-moves)*15');
  assert.deepEqual(api('score')(state), score, 'score must be deterministic');
  const slow = fixture({ budget: 180, parMoves: 1, nodes: [
    { id: '1', x: 180, y: 360, glow: 0, flower: false },
    { id: '2', x: 380, y: 360, glow: 0, flower: false },
    { id: '3', x: 580, y: 360, glow: 0, flower: false }
  ] });
  let plain = accepted(api('createState')(slow), { type: 'stitch', a: '1', b: '2', strands: 1 });
  plain = accepted(plain, { type: 'launch' });
  plain = accepted(plain, { type: 'move', to: '2' });
  plain = accepted(plain, { type: 'stitch', a: '2', b: '3', strands: 1 });
  plain = accepted(plain, { type: 'move', to: '3' });
  assert.equal(plain.phase, 'won');
  const stars = api('score')(plain);
  assert.equal(stars.stars, 2, 'zero optional flowers still satisfies the all-flowers condition');
  assert.equal(stars.totalFlowers, 0);
  assert.equal(stars.points, 280, '140 remaining thread with no rescues, flowers or par bonus');
});

test('twins score as two rescued glows rather than one visited pickup island', () => {
  const level = fixture();
  level.nodes[1].glow = 2;
  let state = accepted(api('createState')(level), { type: 'stitch', a: '1', b: '2', strands: 1 });
  state = accepted(state, { type: 'launch' });
  state = accepted(state, { type: 'move', to: '2' });
  const score = api('score')(state);
  assert.equal(score.rescued, 2, 'each rescued firefly earns its own 100 points');
  assert.equal(score.totalGlows, 3);
  assert.equal(score.points, 200 + 70 + 100 * 2 + 2 * 15);
});

function playSolution(index) {
  assert.ok(Array.isArray(SkyLevels), 'levels.js must exist and export an array');
  assert.ok(SkyLevels[index], `handcrafted level ${index + 1} must exist`);
  assert.ok(solutions && Array.isArray(solutions[index]?.actions), `level ${index + 1} needs recorded public solution actions`);
  assert.equal(solutions[index].id, SkyLevels[index].id);
  let state = api('createState')(SkyLevels[index]);
  for (const action of solutions[index].actions) state = accepted(state, action);
  assert.equal(state.phase, 'won', `level ${index + 1} must win through commands, not state editing`);
  assert.equal(state.current, state.level.goal);
  assert.equal(state.lostThread, 0);
  assert.equal(api('score')(state).rescued, state.level.nodes.reduce((sum, node) => sum + node.glow, 0));
  assert.equal(api('score')(state).stars, 3, 'the recorded route collects all flowers within par');
  return state;
}

test('level 1 introduces a single-strand flower detour through public actions', () => {
  const state = playSolution(0);
  assert.equal(state.level.id, 'night-1');
  assert.equal(state.level.nodes.length, 3);
  assert.equal(state.swarm, 1);
  assert.equal(state.moves, 2);
  assert.equal(state.threadLeft, 6);
});

test('level 2 has twins that make two incremental double-strand upgrades meaningful', () => {
  const winner = playSolution(1);
  assert.equal(winner.swarm, 3);
  assert.equal(winner.moves, 3);
  assert.equal(winner.threadLeft, 6);
  assert.ok(solutions[1].actions.filter(action => action.type === 'stitch' && action.strands === 2).length >= 2);
  let state = api('createState')(SkyLevels[1]);
  for (const [a, b] of [['1', '2'], ['2', '3'], ['3', '4']]) {
    state = accepted(state, { type: 'stitch', a, b, strands: 1 });
  }
  state = accepted(state, { type: 'launch' });
  state = accepted(state, { type: 'move', to: '2' });
  assert.equal(state.swarm, 3);
  const attempt = api('command')(state, { type: 'move', to: '3' });
  assert.equal(attempt.state.phase, 'lost', 'twins force a real capacity decision');
  let restored = accepted(attempt.state, { type: 'undo' });
  const remaining = restored.threadLeft;
  restored = accepted(restored, { type: 'stitch', a: '3', b: '2', strands: 2 });
  assert.equal(remaining - restored.threadLeft, api('bridgeCost')(SkyLevels[1], '2', '3', 1));
  restored = accepted(restored, { type: 'move', to: '3' });
  restored = accepted(restored, { type: 'stitch', a: '3', b: '4', strands: 2 });
  restored = accepted(restored, { type: 'move', to: '4' });
  assert.equal(restored.phase, 'won');
  const allDouble = [['1', '2'], ['2', '3'], ['3', '4']].reduce((sum, [a, b]) => sum + api('bridgeCost')(SkyLevels[1], a, b, 2), 0);
  assert.ok(allDouble > SkyLevels[1].budget, 'blindly doubling every bridge must be too expensive');
});

test('level 3 routes around a geometric storm rather than the straight shortcut', () => {
  const state = playSolution(2);
  assert.equal(state.level.nodes.length, 5);
  assert.equal(state.swarm, 2);
  assert.equal(state.moves, 4);
  rejected(api('createState')(state.level), { type: 'stitch', a: '1', b: '3', strands: 1 }, 'storm-blocked');
  rejected(api('createState')(state.level), { type: 'stitch', a: '2', b: '4', strands: 1 }, 'storm-blocked');
});

function canWinWithoutCut(level) {
  const initial = api('createState')(level);
  const queue = [initial];
  const seen = new Set();
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const state = queue[cursor];
    if (state.phase === 'won') return { possible: true, explored: cursor + 1 };
    if (state.phase === 'lost') continue;
    const actions = [{ type: 'launch' }];
    for (const node of level.nodes) actions.push({ type: 'move', to: node.id });
    for (let i = 0; i < level.nodes.length; i++) {
      for (let j = i + 1; j < level.nodes.length; j++) {
        for (const strands of [1, 2]) actions.push({ type: 'stitch', a: level.nodes[i].id, b: level.nodes[j].id, strands });
      }
    }
    for (const action of actions) {
      const result = api('command')(state, action);
      if (!result.ok) continue;
      const next = result.state;
      const key = JSON.stringify([next.phase, next.current, next.swarm, [...next.rescued].sort(),
        next.bridges.map(b => `${api('edgeKey')(b.a, b.b)}:${b.strands}`).sort()]);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return { possible: false, explored: queue.length };
}

test('level 4 requires cutting and reusing its tiny spool to win', () => {
  const state = playSolution(3);
  assert.equal(state.level.nodes.length, 5);
  assert.equal(state.threadLeft, 4);
  assert.equal(state.swarm, 3);
  assert.ok(solutions[3].actions.filter(action => action.type === 'cut').length >= 3);
  for (let i = 0; i < state.level.nodes.length; i++) {
    for (let j = i + 1; j < state.level.nodes.length; j++) {
      const result = api('command')(api('createState')(state.level), { type: 'stitch', a: state.level.nodes[i].id, b: state.level.nodes[j].id, strands: 1 });
      assert.equal(result.ok, j - i === 1, 'only neighboring chain islands can connect');
    }
  }
  const noCut = canWinWithoutCut(state.level);
  assert.equal(noCut.possible, false, 'exhaustive public actions without cut must not reach victory');
  assert.ok(noCut.explored > 10, 'verify a real state-space exploration, not a fabricated claim');
});

test('level 5 makes home a hub, gates early arrival, and needs heavier return trips', () => {
  const state = playSolution(4);
  assert.equal(state.level.nodes.length, 6);
  assert.equal(state.moves, 6);
  assert.equal(state.swarm, 3);
  assert.ok(solutions[4].actions.filter(action => action.type === 'move' && action.to === state.level.goal).length >= 3);
  let early = api('createState')(state.level);
  early = accepted(early, { type: 'stitch', a: state.level.start, b: state.level.goal, strands: 1 });
  early = accepted(early, { type: 'launch' });
  early = accepted(early, { type: 'move', to: state.level.goal });
  assert.equal(early.phase, 'journey');
  assert.equal(early.lastEvent.reason, 'missing-glows');
});

test('level 6 branches for a flower before the final rescue and reuses the branch thread', () => {
  const state = playSolution(5);
  assert.equal(state.level.nodes.length, 7);
  assert.equal(state.moves, 7);
  assert.equal(state.swarm, 3);
  assert.equal(state.threadLeft, 2);
  const moves = solutions[5].actions.filter(action => action.type === 'move').map(action => action.to);
  assert.deepEqual(moves, ['2', '3', '5', '3', '4', '6', '7']);
  rejected(api('createState')(state.level), { type: 'stitch', a: '3', b: '6', strands: 1 }, 'storm-blocked');
});

test('level 7 changes rescue order around a central storm with asymmetric return routes', () => {
  const state = playSolution(6);
  assert.equal(state.level.nodes.length, 6);
  assert.equal(state.moves, 5);
  assert.equal(state.swarm, 3);
  const moves = solutions[6].actions.filter(action => action.type === 'move').map(action => action.to);
  assert.deepEqual(moves, ['4', '3', '2', '5', '6']);
  rejected(api('createState')(state.level), { type: 'stitch', a: '2', b: '4', strands: 1 }, 'storm-blocked');
  rejected(api('createState')(state.level), { type: 'stitch', a: '1', b: '3', strands: 1 }, 'storm-blocked');
});

test('level 8 closes the campaign with two storms, flowers and a three-light journey', () => {
  const state = playSolution(7);
  assert.equal(SkyLevels.length, 8, 'the campaign must contain exactly eight nights');
  assert.equal(solutions.length, 8, 'each night must have one real action route');
  assert.equal(state.level.nodes.length, 8);
  assert.equal(state.level.storms.length, 2);
  assert.equal(state.moves, 7);
  assert.equal(state.swarm, 3);
  assert.equal(state.threadLeft, 30);
  rejected(api('createState')(state.level), { type: 'stitch', a: '1', b: '3', strands: 1 }, 'storm-blocked');
  rejected(api('createState')(state.level), { type: 'stitch', a: '4', b: '6', strands: 1 }, 'storm-blocked');
});

test('all eight levels obey the content contract and every route wins with three stars', () => {
  assert.equal(SkyLevels.length, 8, 'exactly eight handcrafted nights');
  assert.equal(solutions.length, 8);
  const ids = new Set();
  const titles = new Set();
  for (const [index, level] of SkyLevels.entries()) {
    assert.deepEqual(Object.keys(level).sort(), ['budget', 'goal', 'hint', 'id', 'maxSpan', 'nodes', 'parMoves', 'start', 'storms', 'subtitle', 'title'].sort());
    assert.ok(1 + level.nodes.reduce((sum, node) => sum + node.glow, 0) <= 3, 'no flock may exceed double-strand capacity');
    for (const key of ['id', 'title', 'subtitle', 'hint']) assert.equal(typeof level[key], 'string');
    assert.ok(level.hint.length > 8 && level.hint.length < 120, `level ${index + 1} hint must be short and actionable`);
    assert.ok(Number.isInteger(level.budget) && level.budget > 0);
    assert.ok(level.maxSpan > 0 && level.parMoves > 0);
    assert.ok(level.nodes.length >= 3 && level.nodes.length <= 8, `level ${index + 1} needs 3..8 pins`);
    assert.equal(ids.has(level.id), false, 'level ids must be unique');
    ids.add(level.id);
    assert.equal(titles.has(level.title), false, 'level titles must be unique');
    titles.add(level.title);
    const nodeIds = level.nodes.map(node => node.id);
    assert.equal(new Set(nodeIds).size, nodeIds.length, 'node ids must be unique');
    assert.notEqual(level.start, level.goal);
    assert.ok(nodeIds.includes(level.start) && nodeIds.includes(level.goal));
    assert.equal(level.nodes.find(node => node.id === level.start).glow, 0, 'the start holds the single initial firefly');
    for (const node of level.nodes) {
      assert.match(node.id, /^[1-8]$/, 'node ids are single digits for keyboard play');
      assert.equal(typeof node.label, 'string');
      assert.ok(node.x >= 140 && node.x <= 1090, `${node.id} x in pin bounds`);
      assert.ok(node.y >= 170 && node.y <= 525, `${node.id} y in pin bounds`);
      assert.ok(node.glow >= 0 && node.glow <= 2);
      assert.equal(typeof node.flower, 'boolean');
    }
    for (const storm of level.storms) {
      assert.ok(Number.isFinite(storm.x) && Number.isFinite(storm.y) && storm.r > 0);
      for (const node of level.nodes) {
        assert.ok(Math.hypot(storm.x - node.x, storm.y - node.y) > storm.r + 24, `storm must not swallow pin ${node.id}`);
      }
    }
    const winner = playSolution(index);
    assert.equal(api('score')(winner).stars, 3, `level ${index + 1} rewards all flowers within par`);
    assert.equal(winner.threadLeft >= 0, true);
  }
});

test('classic browser globals run all eight solutions identically to Node require', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(corePath, 'utf8'), context, { filename: 'sky-core.js' });
  vm.runInContext(fs.readFileSync(contentPath, 'utf8'), context, { filename: 'levels.js' });
  assert.equal(typeof context.SkyCore.command, 'function');
  assert.equal(context.SkyLevels.length, 8);
  assert.deepEqual(Object.keys(context.SkyCore).sort(), Object.keys(SkyCore).sort());
  assert.deepEqual(clone(context.SkyLevels), SkyLevels);
  for (const [index, solution] of solutions.entries()) {
    let browserState = context.SkyCore.createState(context.SkyLevels[index]);
    let nodeState = api('createState')(SkyLevels[index]);
    for (const action of solution.actions) {
      const browserResult = context.SkyCore.command(browserState, action);
      const nodeResult = api('command')(nodeState, action);
      assert.equal(browserResult.ok, true);
      assert.deepEqual(clone(browserResult), nodeResult, 'classic scripts and require must return identical deterministic results');
      browserState = browserResult.state;
      nodeState = nodeResult.state;
    }
    assert.equal(browserState.phase, 'won');
    assert.deepEqual(clone(context.SkyCore.score(browserState)), api('score')(nodeState));
  }
});

function freezeTree(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) freezeTree(item);
  return Object.freeze(value);
}

test('all routes accept deeply frozen inputs and reject without replacing any field', () => {
  for (const [index, solution] of solutions.entries()) {
    let state = api('createState')(freezeTree(clone(SkyLevels[index])));
    for (const action of solution.actions) {
      freezeTree(state);
      rejected(state, { type: 'stitch', a: '1', b: '9', strands: 1 }, state.phase === 'won' ? 'finished' : 'invalid-node');
      state = accepted(state, freezeTree(clone(action)));
      assert.equal(state.history.length <= 100, true);
      assert.ok(state.history.every(snapshot => !Object.hasOwn(snapshot, 'history')));
      assert.equal(state.rescued.length, new Set(state.rescued).size);
      assert.equal(state.collected.length, new Set(state.collected).size);
      assert.equal(state.swarm, 1 + state.rescued.reduce((sum, id) => sum + state.level.nodes.find(n => n.id === id).glow, 0));
    }
    const undone = accepted(freezeTree(state), { type: 'undo' });
    assert.equal(undone.phase, 'journey');
    const reset = accepted(freezeTree(state), { type: 'reset' });
    assert.deepEqual(reset, api('createState')(SkyLevels[index]));
    rejected(reset, { type: 'undo' }, 'no-history');
  }
});

test('cut and upgrade undo exactly and history stays bounded after 120 actions', () => {
  let state = api('createState')(fixture());
  for (let i = 0; i < 60; i++) {
    state = accepted(freezeTree(state), { type: 'stitch', a: '1', b: '2', strands: 1 });
    state = accepted(freezeTree(state), { type: 'cut', a: '2', b: '1' });
  }
  assert.equal(state.history.length, 100);
  assert.ok(state.history.every(snapshot => !Object.hasOwn(snapshot, 'history')));
  const beforeUpgrade = accepted(state, { type: 'stitch', a: '1', b: '2', strands: 1 });
  const doubled = accepted(beforeUpgrade, { type: 'stitch', a: '2', b: '1', strands: 2 });
  const restoredSingle = accepted(doubled, { type: 'undo' });
  assert.deepEqual(restoredSingle.bridges, beforeUpgrade.bridges);
  assert.equal(restoredSingle.threadLeft, beforeUpgrade.threadLeft);
  const cut = accepted(doubled, { type: 'cut', a: '1', b: '2' });
  const restoredDouble = accepted(cut, { type: 'undo' });
  assert.deepEqual(restoredDouble.bridges, doubled.bridges);
  assert.equal(restoredDouble.threadLeft, doubled.threadLeft);
  for (let i = 0; i < 100; i++) state = accepted(freezeTree(state), { type: 'undo' });
  assert.equal(state.history.length, 0);
  rejected(state, { type: 'undo' }, 'no-history');
});

test('span boundary, skipped flowers and reset from loss follow the contract', () => {
  const exact = api('createState')(fixture({ maxSpan: 200 }));
  accepted(exact, { type: 'stitch', a: '1', b: '2', strands: 1 });
  rejected(api('createState')(fixture({ maxSpan: 199.99 })), { type: 'stitch', a: '1', b: '2', strands: 1 }, 'too-far');
  let shortcut = api('createState')(SkyLevels[0]);
  shortcut = accepted(shortcut, { type: 'stitch', a: '1', b: '3', strands: 1 });
  shortcut = accepted(shortcut, { type: 'launch' });
  shortcut = accepted(shortcut, { type: 'move', to: '3' });
  assert.equal(shortcut.phase, 'won', 'optional flowers never block completion');
  assert.equal(api('score')(shortcut).stars, 2);
  let broken = api('createState')(SkyLevels[1]);
  broken = accepted(broken, { type: 'stitch', a: '1', b: '2', strands: 1 });
  broken = accepted(broken, { type: 'stitch', a: '2', b: '3', strands: 1 });
  broken = accepted(broken, { type: 'launch' });
  broken = accepted(broken, { type: 'move', to: '2' });
  broken = accepted(broken, { type: 'move', to: '3' });
  assert.equal(broken.phase, 'lost');
  assert.equal(api('score')(broken).stars, 0);
  assert.deepEqual(accepted(broken, { type: 'reset' }), api('createState')(SkyLevels[1]));
});

test('createState makes a detached, exact planning state', () => {
  const level = fixture();
  const before = clone(level);
  const state = api('createState')(level);
  assert.deepEqual(state, {
    level: before, phase: 'planning', current: '1', bridges: [], threadLeft: 120,
    lostThread: 0, swarm: 1, rescued: [], collected: [], moves: 0, history: [], lastEvent: null
  });
  assert.notEqual(state.level, level);
  assert.notEqual(state.level.nodes, level.nodes);
  level.nodes[0].x = 999;
  assert.equal(state.level.nodes[0].x, 180, 'caller edits must not alter the stored level');
  conserved(state);
});
