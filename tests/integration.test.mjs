import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, ROOT), 'utf8');

// A file:// style page: classic scripts in document order, one real engine,
// real levels and real progress code. Only the canvas 2D context is stubbed,
// because Node has no raster backend.
function page() {
  const elements = new Map();
  class Element {
    constructor(id) { this.id = id; this.hidden = false; this.textContent = ''; this.disabled = false; this.children = []; this.listeners = {}; this.style = {setProperty() {}}; this.dataset = {}; this.attributes = {}; this.classList = {add() {}, remove() {}, toggle() {}}; }
    addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
    click() { if (!this.disabled) for (const fn of this.listeners.click ?? []) fn({target: this, preventDefault() {}}); }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    getAttribute(key) { return this.attributes[key]; }
    append(...items) { this.children.push(...items); }
    replaceChildren(...items) { this.children = [...items]; }
    getBoundingClientRect() { return {left: 0, top: 0, width: 1280, height: 720}; }
    getContext() { return {save() {}, restore() {}}; }
    setPointerCapture() {}
  }
  const node = id => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
  const frames = [];
  const saved = [];
  const listeners = {};
  let store = null;
  const context = vm.createContext({
    document: {
      getElementById: node,
      querySelectorAll: () => [],
      createElement: tag => new Element(tag),
      documentElement: {lang: 'en'},
      addEventListener() {}
    },
    console, setTimeout, clearTimeout,
    performance: {now: () => 0},
    requestAnimationFrame: fn => { frames.push(fn); return frames.length; },
    cancelAnimationFrame() {},
    localStorage: {getItem: () => store, setItem: (key, value) => { store = value; saved.push(value); }},
    addEventListener(type, fn) { (listeners[type] ??= []).push(fn); },
    matchMedia: () => ({matches: false})
  });
  context.window = context;
  for (const file of ['game/levels.js', 'game/sky-core.js', 'game/sky-progress.js', 'game/sky-audio.js']) {
    vm.runInContext(read(file), context, {filename: file});
  }
  context.SkyRender = {render() {}, hitPin: (state, x, y) => {
    let best = 32 * 32, found = null;
    for (const n of state.level.nodes) {
      const d = (x - n.x) ** 2 + (y - n.y) ** 2;
      if (d <= best) { best = d; found = n.id; }
    }
    return found;
  }, hitBridge: (state, x, y) => {
    for (const bridge of state.bridges) {
      const a = state.level.nodes.find(n => n.id === bridge.a);
      const b = state.level.nodes.find(n => n.id === bridge.b);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= 900) return {a: bridge.a, b: bridge.b};
    }
    return null;
  }};
  vm.runInContext(read('game/sky-game.js'), context, {filename: 'game/sky-game.js'});
  let clock = 0;
  const pump = () => {
    let guard = 0;
    while (context.skyDebug.snapshot().flight && guard++ < 200) {
      const fn = frames.shift();
      if (!fn) break;
      fn(clock += 1000);
    }
  };
  const at = id => context.skyDebug.snapshot().state.level.nodes.find(n => n.id === id);
  const pointer = (x, y, type = 'pointerup') => {
    const canvas = node('scene');
    const event = {clientX: x, clientY: y, button: 0, pointerId: 1, preventDefault() {}, target: canvas};
    for (const fn of canvas.listeners[type] ?? []) fn(event);
  };
  const key = value => {
    const event = {key: value, target: {tagName: 'BODY'}, repeat: false, preventDefault() {}};
    for (const fn of listeners.keydown ?? []) fn(event);
  };
  return {context, node, frames, saved, pump, at, pointer, key};
}

// Genuine end-to-end play: every evening is solved by dispatching real pointer
// gestures and button presses at island coordinates. Solutions come from the
// test fixture file, never from a shipped autoplay hook.
const solutions = JSON.parse(read('tests/solutions.json'));

test('all eight evenings are winnable through pointer and button input only', () => {
  const {context, node, pump, at, pointer} = page();
  assert.equal(solutions.length, 8);
  assert.equal(context.SkyLevels.length, 8);
  node('start-btn').click();
  for (let index = 0; index < solutions.length; index++) {
    assert.equal(context.skyDebug.snapshot().state.level.id, solutions[index].id, 'next evening must be selected');
    for (const action of solutions[index].actions) {
      if (action.type === 'stitch') {
        node('stitch-btn').click();
        node(action.strands === 2 ? 'double-btn' : 'single-btn').click();
        const from = at(action.a), to = at(action.b);
        pointer(from.x, from.y, 'pointerdown');
        pointer(to.x, to.y, 'pointerup');
      } else if (action.type === 'cut') {
        node('cut-btn').click();
        const a = at(action.a), b = at(action.b);
        pointer((a.x + b.x) / 2, (a.y + b.y) / 2);
      } else if (action.type === 'launch') {
        node('launch-btn').click();
      } else if (action.type === 'move') {
        node('guide-btn').click();
        const to = at(action.to);
        pointer(to.x, to.y);
        pump();
      }
      assert.notEqual(context.skyDebug.snapshot().state.phase, 'lost', `evening ${index+1}: ${JSON.stringify(action)} must be safe`);
    }
    const final = context.skyDebug.snapshot();
    assert.equal(final.screen === 'won' || final.screen === 'ending', true, `evening ${index + 1} must reach its result`);
    assert.equal(final.state.phase, 'won', `evening ${index + 1} is won`);
    // Leave the result panel before the next evening.
    node('next-btn').click();
    if (context.skyDebug.snapshot().screen === 'ending') node('home-btn').click();
  }
});

test('a bridge that cannot hold the grown flock snaps, and undo returns the crossing', () => {
  const {context, node, pump, at, pointer} = page();
  // Evening 2: a single bridge to the twins, then the flock has three lights.
  node('start-btn').click();
  for (const action of solutions[0].actions) {
    if (action.type === 'stitch') {
      pointer(at(action.a).x, at(action.a).y, 'pointerdown');
      pointer(at(action.b).x, at(action.b).y);
    } else if (action.type === 'launch') node('launch-btn').click();
    else if (action.type === 'move') { pointer(at(action.to).x, at(action.to).y); pump(); }
  }
  node('next-btn').click();
  const snapshot = context.skyDebug.snapshot();
  assert.equal(snapshot.state.level.id, 'night-2');
  assert.equal(node('result-panel').hidden, true);
  node('stitch-btn').click();
  node('single-btn').click();
  let from = at('1'), to = at('2');
  pointer(from.x, from.y, 'pointerdown');
  pointer(to.x, to.y, 'pointerup');
  node('single-btn').click();
  from = at('2'); to = at('3');
  pointer(from.x, from.y, 'pointerdown');
  pointer(to.x, to.y, 'pointerup');
  node('launch-btn').click();
  node('guide-btn').click();
  to = at('2');
  pointer(to.x, to.y);
  pump();
  assert.equal(context.skyDebug.snapshot().state.swarm, 3);
  pointer(at('2').x, at('2').y);
  pointer(at('3').x, at('3').y);
  pump();
  const lost = context.skyDebug.snapshot();
  assert.equal(lost.state.phase, 'lost', 'three lights cannot cross one strand');
  assert.equal(node('undo-loss-btn').hidden, false);
  node('undo-loss-btn').click();
  const restored = context.skyDebug.snapshot();
  assert.equal(restored.state.phase, 'journey');
  assert.equal(restored.state.current, '2');
  assert.equal(restored.state.swarm, 3);
});

test('finishing an evening stores stars and unlocks the next, and the last evening ends the campaign', () => {
  const {context, node, pump, at, pointer} = page();
  node('start-btn').click();
  for (const action of solutions[0].actions) {
    if (action.type === 'stitch') {
      node('stitch-btn').click();
      node('single-btn').click();
      pointer(at(action.a).x, at(action.a).y, 'pointerdown');
      pointer(at(action.b).x, at(action.b).y, 'pointerup');
    } else if (action.type === 'launch') node('launch-btn').click();
    else if (action.type === 'move') { node('guide-btn').click(); pointer(at(action.to).x, at(action.to).y); pump(); }
  }
  const won = context.skyDebug.snapshot();
  assert.equal(won.screen, 'won');
  assert.ok(won.stars >= 1, 'a finished evening earns at least one star');
  assert.equal(node('star-rating').textContent.length, 3, 'three star slots are shown');
  const stored = JSON.parse(context.localStorage.getItem('tukang-jahit-langit-v1'));
  assert.equal(stored.unlocked, 2, 'the next evening is unlocked on disk');
  assert.equal(stored.stars[0], won.stars);
  node('next-btn').click();
  assert.equal(context.skyDebug.snapshot().state.level.id, 'night-2');
});

function act(page, action, wait = true) {
  const {node, pointer, at, pump} = page;
  if (action.type === 'stitch') {
    node('stitch-btn').click();
    node(action.strands === 2 ? 'double-btn' : 'single-btn').click();
    const from = at(action.a), to = at(action.b);
    pointer(from.x, from.y, 'pointerdown');
    pointer(to.x, to.y);
  } else if (action.type === 'cut') {
    node('cut-btn').click();
    const from = at(action.a), to = at(action.b);
    pointer((from.x + to.x) / 2, (from.y + to.y) / 2);
  } else if (action.type === 'launch') node('launch-btn').click();
  else if (action.type === 'move') {
    node('guide-btn').click();
    const to = at(action.to);
    pointer(to.x, to.y);
    if (wait) pump();
  } else assert.fail(`Unknown solution action: ${action.type}`);
}

for (const lastIndex of [0, 7]) {
  test(`D1 Nightbook during evening ${lastIndex + 1} winning flight preserves Next lifecycle`, () => {
    const p = page();
    p.node('start-btn').click();
    for (let index = 0; index <= lastIndex; index++) {
      const actions = solutions[index].actions;
      for (const action of actions.slice(0, -1)) act(p, action);
      assert.equal(actions.at(-1).type, 'move');
      act(p, actions.at(-1), false);
      assert.equal(p.context.skyDebug.snapshot().state.phase, 'won');
      assert.ok(p.context.skyDebug.snapshot().flight, 'the book request must overlap a real winning flight');
      if (index === lastIndex) p.node('book-btn').click();
      p.pump();
      if (index === lastIndex) {
        p.node('book-back-btn').click();
        assert.equal(p.context.skyDebug.snapshot().screen, 'won', 'book close must not restore stale play after the result');
        p.node('book-btn').click();
        assert.equal(p.context.skyDebug.snapshot().screen, 'book');
        p.key('Escape');
        assert.equal(p.context.skyDebug.snapshot().screen, 'won');
      }
      p.node('next-btn').click();
      if (index < 7) assert.equal(p.context.skyDebug.snapshot().levelIndex, index + 1);
      else {
        assert.equal(p.context.skyDebug.snapshot().screen, 'ending');
        assert.equal(p.node('next-btn').hidden, true);
        p.node('book-btn').click();
        p.node('book-back-btn').click();
        p.node('book-back-btn').click();
        assert.equal(p.context.skyDebug.snapshot().screen, 'ending');
      }
    }
  });
}

for (const modal of ['help', 'book']) {
  test(`D2 Restart behind ${modal} preserves the bridged puzzle until modal closes`, () => {
    const p = page();
    p.node('start-btn').click();
    act(p, solutions[0].actions[0]);
    p.node(`${modal}-btn`).click();
    assert.equal(p.node(`${modal}-panel`).hidden, false);
    const before = p.context.skyDebug.snapshot();
    assert.equal(before.state.bridges.length, 1, 'a reset must be observable');
    p.key('r');
    assert.deepEqual(p.context.skyDebug.snapshot(), before, 'keyboard restart must remain blocked');
    p.node('restart-btn').click();
    assert.deepEqual(p.context.skyDebug.snapshot(), before, 'button restart must not discard bridges behind a modal');
    assert.equal(p.node(`${modal}-panel`).hidden, false, 'blocked restart must leave the modal open');
    p.key('Escape');
    p.node('restart-btn').click();
    const fresh = p.context.skyDebug.snapshot();
    assert.equal(fresh.screen, 'play');
    assert.equal(fresh.state.phase, 'planning');
    assert.equal(fresh.state.bridges.length, 0);
    assert.equal(fresh.state.threadLeft, fresh.state.level.budget);
    act(p, solutions[0].actions[0]);
    p.key('r');
    assert.equal(p.context.skyDebug.snapshot().state.bridges.length, 0, 'ordinary keyboard restart still works');
  });

  test(`D2 ${modal} blocks reachable gameplay buttons and pin gestures`, () => {
    const p = page();
    p.node('start-btn').click();
    act(p, solutions[0].actions[0]);
    p.node(`${modal}-btn`).click();
    const before = p.context.skyDebug.snapshot();
    for (const id of ['double-btn', 'single-btn', 'guide-btn', 'cut-btn', 'stitch-btn', 'launch-btn', 'undo-btn', 'retry-btn', 'next-btn', 'start-btn', 'continue-btn', 'home-btn']) {
      p.node(id).click();
      assert.deepEqual(p.context.skyDebug.snapshot(), before, `${id} cannot mutate gameplay behind ${modal}`);
      assert.equal(p.node(`${modal}-panel`).hidden, false);
    }
    for (const key of ['s', 'g', 'c', '1', '2', ' ', 'u', 'z', 'r']) p.key(key);
    const from = p.at('1'), to = p.at('2');
    p.pointer(from.x, from.y, 'pointerdown');
    p.pointer(to.x, to.y);
    assert.deepEqual(p.context.skyDebug.snapshot(), before);
    p.key('Escape');
    assert.equal(p.node(`${modal}-panel`).hidden, true);
    if (modal === 'book') {
      p.node('book-btn').click();
      p.node('level-list').children[0].click();
      assert.equal(p.node('book-panel').hidden, true, 'explicit Nightbook level selection remains usable');
      assert.equal(p.context.skyDebug.snapshot().state.bridges.length, 0);
    }
  });
}

function reachLoss(p) {
  p.node('start-btn').click();
  for (const action of solutions[0].actions) act(p, action);
  p.node('next-btn').click();
  act(p, {type: 'stitch', a: '1', b: '2', strands: 1});
  act(p, {type: 'stitch', a: '2', b: '3', strands: 1});
  act(p, {type: 'launch'});
  act(p, {type: 'move', to: '2'});
  act(p, {type: 'move', to: '3'}, false);
  assert.equal(p.context.skyDebug.snapshot().state.phase, 'lost');
  assert.ok(p.context.skyDebug.snapshot().flight);
}

test('D1 Nightbook during loss flight preserves result and loss Retry remains usable', () => {
  const p = page();
  reachLoss(p);
  p.node('book-btn').click();
  p.pump();
  p.node('book-back-btn').click();
  assert.equal(p.context.skyDebug.snapshot().screen, 'lost', 'book close cannot restore stale play after loss');
  p.node('book-btn').click();
  p.key('Escape');
  assert.equal(p.context.skyDebug.snapshot().screen, 'lost');
  p.node('retry-btn').click();
  const fresh = p.context.skyDebug.snapshot();
  assert.equal(fresh.levelIndex, 1);
  assert.equal(fresh.screen, 'play');
  assert.equal(fresh.state.phase, 'planning');
  assert.equal(fresh.state.bridges.length, 0);
  assert.equal(fresh.state.threadLeft, fresh.state.level.budget);
});

test('D2 flight rejects Restart and Retry until the crossing settles', () => {
  const p = page();
  p.node('start-btn').click();
  for (const action of solutions[0].actions.slice(0, -1)) act(p, action);
  act(p, solutions[0].actions.at(-1), false);
  const before = p.context.skyDebug.snapshot();
  assert.ok(before.flight);
  for (const id of ['restart-btn', 'retry-btn']) {
    p.node(id).click();
    assert.deepEqual(p.context.skyDebug.snapshot(), before, `${id} cannot cancel an active crossing`);
  }
  p.key('r');
  assert.deepEqual(p.context.skyDebug.snapshot(), before);
  p.pump();
  p.node('restart-btn').click();
  assert.equal(p.context.skyDebug.snapshot().state.phase, 'planning');
});

test('D2 help over won result blocks Next and Retry until help closes', () => {
  const p = page();
  p.node('start-btn').click();
  for (const action of solutions[0].actions) act(p, action);
  p.node('help-btn').click();
  const before = p.context.skyDebug.snapshot();
  for (const id of ['next-btn', 'retry-btn']) {
    p.node(id).click();
    assert.deepEqual(p.context.skyDebug.snapshot(), before, `${id} cannot bypass result help`);
  }
  p.key('Escape');
  p.node('next-btn').click();
  assert.equal(p.context.skyDebug.snapshot().levelIndex, 1);
});

test('D2 help over loss result blocks Retry and undo until help closes', () => {
  const p = page();
  reachLoss(p);
  p.pump();
  p.node('help-btn').click();
  const before = p.context.skyDebug.snapshot();
  for (const id of ['retry-btn', 'undo-loss-btn', 'undo-btn']) {
    p.node(id).click();
    assert.deepEqual(p.context.skyDebug.snapshot(), before, `${id} cannot bypass loss help`);
  }
  p.key('Escape');
  p.node('undo-loss-btn').click();
  assert.equal(p.context.skyDebug.snapshot().state.phase, 'journey');
  assert.equal(p.context.skyDebug.snapshot().screen, 'play');
});

for (const control of ['card', 'book-back-btn']) {
  test(`D2 help layered over Nightbook blocks ${control} until help closes`, () => {
    const p = page();
    p.node('start-btn').click();
    act(p, solutions[0].actions[0]);
    p.node('book-btn').click();
    p.node('help-btn').click();
    const before = p.context.skyDebug.snapshot();
    assert.equal(p.node('book-panel').hidden, false);
    assert.equal(p.node('help-panel').hidden, false);
    const click = () => control === 'card' ? p.node('level-list').children[0].click() : p.node(control).click();
    click();
    assert.deepEqual(p.context.skyDebug.snapshot(), before, `${control} cannot bypass layered help`);
    assert.equal(p.node('help-panel').hidden, false);
    assert.equal(p.node('book-panel').hidden, false);
    p.key('Escape');
    assert.equal(p.node('help-panel').hidden, true);
    assert.equal(p.context.skyDebug.snapshot().screen, 'book');
    click();
    assert.equal(p.context.skyDebug.snapshot().screen, 'play');
    assert.equal(p.node('book-panel').hidden, true);
  });
}
