(function (root) {
  'use strict';

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createState(level) {
    const savedLevel = copy(level);
    return {
      level: savedLevel,
      phase: 'planning',
      current: savedLevel.start,
      bridges: [],
      threadLeft: savedLevel.budget,
      lostThread: 0,
      swarm: 1,
      rescued: [],
      collected: [],
      moves: 0,
      history: [],
      lastEvent: null
    };
  }

  function edgeKey(a, b) {
    return a < b ? a + ':' + b : b + ':' + a;
  }

  function nodeAt(level, id) {
    return level.nodes.find(node => node.id === id) || null;
  }

  function bridgeCost(level, a, b, strands) {
    const from = nodeAt(level, a);
    const to = nodeAt(level, b);
    if (!from || !to) return Infinity;
    return Math.ceil(Math.hypot(from.x - to.x, from.y - to.y) / 10) * strands;
  }

  function capacity(strands) {
    return strands === 1 ? 1 : strands === 2 ? 3 : 0;
  }

  function findBridge(state, a, b) {
    const key = edgeKey(a, b);
    return state.bridges.find(bridge => edgeKey(bridge.a, bridge.b) === key) || null;
  }

  // History contains detached snapshots with no nested history, at most 100.
  function finish(state, next, event, code) {
    const previous = copy(state);
    delete previous.history;
    next.history = state.history.slice(-99).concat(previous);
    next.lastEvent = event;
    return { ok: true, code, state: next, event };
  }

  function reject(state, code) {
    return { ok: false, code, state, event: { type: 'reject', reason: code } };
  }

  // Closest point on a closed segment, so tangent and endpoint hits count.
  function stormBlocked(level, from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy;
    return level.storms.some(storm => {
      const projection = lengthSquared ? ((storm.x - from.x) * dx + (storm.y - from.y) * dy) / lengthSquared : 0;
      const t = Math.max(0, Math.min(1, projection));
      return Math.hypot(storm.x - (from.x + t * dx), storm.y - (from.y + t * dy)) <= storm.r + 6;
    });
  }

  function command(state, action) {
    if (action && action.type === 'undo') {
      if (!state.history.length) return reject(state, 'no-history');
      const snapshot = copy(state.history[state.history.length - 1]);
      const restored = copy(snapshot);
      restored.history = state.history.slice(0, -1);
      return { ok: true, code: 'undone', state: restored, event: { type: 'undo', to: restored.phase, from: state.phase } };
    }
    if (action && action.type === 'reset') {
      return { ok: true, code: 'reset', state: createState(state.level), event: { type: 'reset', to: 'planning', from: state.phase } };
    }
    if (state.phase === 'won' || state.phase === 'lost') return reject(state, 'finished');
    if (action && action.type === 'launch') {
      if (state.phase !== 'planning') return reject(state, 'already-launched');
      const next = copy(state);
      next.phase = 'journey';
      return finish(state, next, { type: 'launch', from: state.current }, 'launched');
    }
    if (action && action.type === 'move') {
      if (state.phase === 'planning') return reject(state, 'not-launched');
      const destination = nodeAt(state.level, action.to);
      if (!destination) return reject(state, 'invalid-node');
      if (action.to === state.current) return reject(state, 'same-node');
      const bridge = findBridge(state, state.current, action.to);
      if (!bridge) return reject(state, 'no-bridge');
      if (state.swarm > capacity(bridge.strands)) {
        const next = copy(state);
        next.phase = 'lost';
        next.bridges = next.bridges.filter(item => edgeKey(item.a, item.b) !== edgeKey(bridge.a, bridge.b));
        next.lostThread += bridge.cost;
        const event = { type: 'snap', a: bridge.a, b: bridge.b, from: state.current, to: action.to, strands: bridge.strands, cost: bridge.cost, reason: 'capacity' };
        return finish(state, next, event, 'snapped');
      }
      const next = copy(state);
      next.current = action.to;
      next.moves += 1;
      const glows = destination.glow && !next.rescued.includes(action.to) ? destination.glow : 0;
      if (glows) {
        next.rescued.push(action.to);
        next.swarm += glows;
      }
      if (destination.flower && !next.collected.includes(action.to)) next.collected.push(action.to);
      const event = { type: 'move', from: state.current, to: action.to, strands: bridge.strands, glows };
      let code = 'moved';
      if (action.to === state.level.goal) {
        const allRescued = state.level.nodes.every(node => !node.glow || next.rescued.includes(node.id));
        if (allRescued) {
          next.phase = 'won';
          event.type = 'win';
          code = 'won';
        } else {
          event.reason = 'missing-glows';
          code = 'missing-glows';
        }
      }
      return finish(state, next, event, code);
    }
    if (!action || !['stitch', 'cut'].includes(action.type)) return reject(state, 'invalid-action');
    const from = nodeAt(state.level, action.a);
    const to = nodeAt(state.level, action.b);
    if (!from || !to) return reject(state, 'invalid-node');
    if (action.a === action.b) return reject(state, 'same-node');
    if (action.type === 'cut') {
      const bridge = findBridge(state, action.a, action.b);
      if (!bridge) return reject(state, 'no-bridge');
      const next = copy(state);
      next.bridges = next.bridges.filter(item => edgeKey(item.a, item.b) !== edgeKey(action.a, action.b));
      next.threadLeft += bridge.cost;
      return finish(state, next, { type: 'cut', a: bridge.a, b: bridge.b, strands: bridge.strands, cost: bridge.cost }, 'cut');
    }
    if (!capacity(action.strands)) return reject(state, 'invalid-strands');
    if (Math.hypot(from.x - to.x, from.y - to.y) > state.level.maxSpan) return reject(state, 'too-far');
    if (stormBlocked(state.level, from, to)) return reject(state, 'storm-blocked');
    const existing = findBridge(state, action.a, action.b);
    if (existing && action.strands <= existing.strands) return reject(state, 'duplicate');
    const a = action.a < action.b ? action.a : action.b;
    const b = action.a < action.b ? action.b : action.a;
    const fullCost = bridgeCost(state.level, a, b, action.strands);
    const cost = fullCost - (existing ? existing.cost : 0);
    if (cost > state.threadLeft) return reject(state, 'not-enough-thread');
    const next = copy(state);
    const bridge = { a, b, strands: action.strands, cost: fullCost };
    if (existing) {
      next.bridges[next.bridges.findIndex(item => edgeKey(item.a, item.b) === edgeKey(a, b))] = bridge;
    } else {
      next.bridges.push(bridge);
    }
    next.threadLeft -= cost;
    return finish(state, next, { type: existing ? 'upgrade' : 'stitch', a, b, strands: action.strands, cost }, existing ? 'upgraded' : 'stitched');
  }

  function score(state) {
    const flowers = state.collected.length;
    const totalFlowers = state.level.nodes.filter(node => node.flower).length;
    const rescued = state.rescued.reduce((sum, id) => sum + nodeAt(state.level, id).glow, 0);
    const totalGlows = 1 + state.level.nodes.reduce((sum, node) => sum + node.glow, 0);
    const parBonus = Math.max(0, state.level.parMoves - state.moves) * 15;
    const stars = state.phase === 'won' ? 1 + Number(flowers === totalFlowers) + Number(state.moves <= state.level.parMoves) : 0;
    // Rescued glows 100, optional flowers 70, unspent thread 2, under-par moves 15.
    const points = rescued * 100 + flowers * 70 + state.threadLeft * 2 + parBonus;
    return { points, stars, flowers, totalFlowers, rescued, totalGlows, threadLeft: state.threadLeft, moves: state.moves };
  }

  const api = { createState, command, edgeKey, bridgeCost, capacity, findBridge, score };
  root.SkyCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
