(function (root) {
  'use strict';

  const WIDTH = 1280;
  const HEIGHT = 720;
  const TAU = Math.PI * 2;
  const INK = '#092737';
  const GOLD = '#edc979';
  const MINT = '#bcf0d5';
  const CORAL = '#ed987e';
  let background = null;

  function seeded(seed) {
    let value = seed >>> 0;
    return function () {
      value += 0x6d2b79f5;
      let n = value;
      n = Math.imul(n ^ n >>> 15, n | 1);
      n ^= n + Math.imul(n ^ n >>> 7, n | 61);
      return ((n ^ n >>> 14) >>> 0) / 4294967296;
    };
  }

  function polygon(ctx, points, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function disc(ctx, x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }

  function glow(ctx, x, y, radius, color) {
    const light = ctx.createRadialGradient(x, y, 0, x, y, radius);
    light.addColorStop(0, color);
    light.addColorStop(1, 'rgba(0,0,0,0)');
    disc(ctx, x, y, radius, light);
  }

  function makeCanvas(width, height) {
    if (!root.document || typeof root.document.createElement !== 'function') return null;
    try {
      const canvas = root.document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas.getContext('2d') ? canvas : null;
    } catch (_) { return null; }
  }

  function drawBackground(ctx) {
    const ink = ctx.createLinearGradient(0, 0, 170, HEIGHT);
    ink.addColorStop(0, '#071e2e');
    ink.addColorStop(0.42, '#153f4d');
    ink.addColorStop(0.73, '#265760');
    ink.addColorStop(1, '#081f2e');
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    glow(ctx, 1090, 300, 360, '#dec38b15');
    glow(ctx, 490, 390, 540, '#76c9be0a');

    // Three cut-paper horizons give the ocean its depth.
    polygon(ctx, [[0,520],[96,505],[199,528],[324,502],[468,534],[610,515],
      [730,528],[874,498],[1005,514],[1176,486],[1280,515],[1280,720],[0,720]], '#163f4d');
    polygon(ctx, [[0,554],[157,540],[300,563],[475,549],[620,562],[805,539],
      [949,554],[1094,535],[1280,549],[1280,720],[0,720]], '#123545');
    polygon(ctx, [[0,611],[200,594],[400,608],[616,588],[817,602],[1049,588],
      [1280,610],[1280,720],[0,720]], '#0c2a3b');

    // Reproducible sparse ink flecks and stars; no random per-frame grain.
    const random = seeded(0x519a1);
    for (let i = 0; i < 170; i++) {
      const x = random() * WIDTH;
      const y = 125 + random() * 438;
      const size = random() * 1.05 + 0.4;
      disc(ctx, x, y, size, i % 6 ? '#c5dfc341' : '#ebd1a668');
    }
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = '#9fd1bd12';
    for (let i = 0; i < 125; i++) {
      const x = random() * WIDTH;
      const y = random() * HEIGHT;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4 + random() * 9, y - 1); ctx.stroke();
    }
    for (let i = 0; i < 25; i++) {
      const x = random() * WIDTH;
      const y = 585 + random() * 125;
      ctx.strokeStyle = i % 4 ? '#76b5aa17' : '#e1c79822';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 16, y - 2, x + 35 + random() * 60, y); ctx.stroke();
    }

    // A paper crescent wholly below the DOM gameplay HUD.
    glow(ctx, 1157, 234, 115, '#eed4a51c');
    disc(ctx, 1157, 234, 39, '#c3aa7b');
    disc(ctx, 1153, 229, 38, '#ecddbc');
    disc(ctx, 1166, 215, 33, '#1a3d47');
    ctx.strokeStyle = '#e6d4ab38'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(1157, 234, 52, 0.45, 2.65); ctx.stroke();
    ctx.setLineDash([2, 7]);
    ctx.beginPath(); ctx.arc(1157, 234, 58, 0.45, 2.65); ctx.stroke();
    ctx.setLineDash([]);
    const shade = ctx.createRadialGradient(630, 350, 180, 630, 350, 810);
    shade.addColorStop(0, '#061a2300'); shade.addColorStop(1, '#03152194');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  const islandCache = new Map();

  function hash(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
    return value >>> 0;
  }

  function islandSize(node) {
    const random = seeded(hash(String(node.id) + ':' + node.x));
    return { width: 142 + random() * 24, depth: node.y > 490 ? 39 : 50 + random() * 10 };
  }

  function tornContour(anchors, random, amount = 1.7) {
    const points = [];
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      const b = anchors[(i + 1) % anchors.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const length = Math.hypot(dx, dy);
      const count = Math.max(2, Math.ceil(length / 7));
      for (let j = 0; j < count; j++) {
        const t = j / count;
        const tear = (random() - 0.5) * amount * (j % 2 ? 1.5 : 0.8);
        points.push([a[0] + dx * t - dy / length * tear, a[1] + dy * t + dx / length * tear]);
      }
    }
    return points;
  }

  function plant(ctx, x, y, scale, random) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.strokeStyle = '#557359'; ctx.lineWidth = 1.2;
    const height = 15 + random() * 12;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-3, -height / 2, 0, -height); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const leafY = -5 - i * 6;
      const side = i % 2 ? 1 : -1;
      polygon(ctx, [[0,leafY],[side*7,leafY-9],[side*8,leafY-3]], i % 2 ? '#9baf82' : '#6d8e6c');
    }
    ctx.restore();
  }

  function littleTree(ctx, x, y, height, lean) {
    ctx.strokeStyle = '#826f54'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + lean, y - height + 5); ctx.stroke();
    polygon(ctx, [[x-13,y-9],[x+lean,y-height],[x+12,y-10],[x+5,y-10],[x+11,y-4],[x-12,y-5],[x-7,y-11]], '#345f51');
    polygon(ctx, [[x-8,y-15],[x+lean,y-height],[x+6,y-16],[x+1,y-19]], '#7d9d79');
  }

  function house(ctx, x, y) {
    glow(ctx, x + 4, y - 20, 68, '#edbb713d');
    polygon(ctx, [[x-20,y],[x-19,y-27],[x+17,y-27],[x+21,y]], '#c79d77');
    polygon(ctx, [[x-16,y-26],[x+16,y-26],[x+17,y],[x-16,y]], '#f1d5a5');
    polygon(ctx, [[x-26,y-25],[x-3,y-46],[x+24,y-25],[x+22,y-21],[x-25,y-21]], '#713f3c');
    polygon(ctx, [[x-25,y-26],[x-3,y-46],[x+23,y-26],[x+7,y-29],[x-3,y-39],[x-15,y-27]], '#c17866');
    polygon(ctx, [[x+9,y-34],[x+9,y-46],[x+15,y-46],[x+16,y-30]], '#ac806a');
    ctx.fillStyle = '#8c7054'; ctx.fillRect(x - 3, y - 15, 9, 15);
    ctx.fillStyle = '#efd795'; ctx.fillRect(x - 1, y - 13, 5, 11);
    ctx.fillStyle = '#846a50'; ctx.fillRect(x - 12, y - 21, 8, 9); ctx.fillRect(x + 8, y - 21, 8, 9);
    ctx.fillStyle = '#ffe5a4'; ctx.fillRect(x - 11, y - 20, 6, 7); ctx.fillRect(x + 9, y - 20, 6, 7);
    ctx.strokeStyle = '#b18b60'; ctx.lineWidth = 0.8;
    for (const wx of [x - 8, x + 12]) {
      ctx.beginPath(); ctx.moveTo(wx, y - 20); ctx.lineTo(wx, y - 13); ctx.moveTo(wx - 3, y - 16.5); ctx.lineTo(wx + 3, y - 16.5); ctx.stroke();
    }
    polygon(ctx, [[x-7,y+1],[x+8,y+1],[x+12,y+5],[x-9,y+5]], '#e8cfa8');
    ctx.strokeStyle = '#746e5438';
    ctx.beginPath(); ctx.moveTo(x - 18, y - 6); ctx.lineTo(x - 5, y - 6); ctx.moveTo(x + 8, y - 4); ctx.lineTo(x + 18, y - 4); ctx.stroke();
  }

  function lighthouse(ctx, x, y) {
    polygon(ctx, [[x-7,y],[x-4,y-33],[x+3,y-33],[x+8,y]], '#c8c6a0');
    polygon(ctx, [[x-2,y],[x,y-33],[x+3,y-33],[x+8,y]], '#8c9b80');
    polygon(ctx, [[x-6,y-25],[x+5,y-25],[x+6,y-21],[x-6,y-21]], '#a16e58');
    polygon(ctx, [[x-7,y-32],[x-7,y-42],[x+6,y-42],[x+6,y-32]], '#9ba794');
    ctx.fillStyle = '#ebce84'; ctx.fillRect(x - 4, y - 40, 8, 7);
    polygon(ctx, [[x-10,y-42],[x,y-50],[x+10,y-42]], '#53796a');
    ctx.fillStyle = '#44655c'; ctx.fillRect(x - 1, y - 14, 3, 7);
    glow(ctx, x, y - 37, 35, '#d5e8ac36');
    ctx.strokeStyle = '#d6ce9666'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(x - 12, y - 31); ctx.lineTo(x + 12, y - 31); ctx.stroke();
  }

  function spool(ctx, x, y) {
    polygon(ctx, [[x-7,y-26],[x+7,y-25],[x+5,y-2],[x-5,y-1]], '#8d7056');
    ctx.fillStyle = '#d8bf89'; ctx.fillRect(x - 6, y - 23, 12, 19);
    ctx.strokeStyle = '#8c8765'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(x - 6, y - 21 + i * 2.2); ctx.lineTo(x + 6, y - 20 + i * 2.2); ctx.stroke(); }
    polygon(ctx, [[x-10,y-27],[x+9,y-27],[x+11,y-23],[x-9,y-23]], '#e7cca2');
    polygon(ctx, [[x-10,y-3],[x+9,y-3],[x+10,y],[x-8,y]], '#cbb38a');
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(x + 6, y - 5); ctx.bezierCurveTo(x + 12, y - 3, x + 11, y + 9, x + 23, y + 6); ctx.stroke();
  }

  function drawIslandPaper(ctx, node, level) {
    const random = seeded(hash(level.id + ':' + node.id));
    const size = islandSize(node);
    const w = size.width / 2;
    const d = size.depth;
    const top = [[-w,8],[-w+12,0],[-w+26,-5],[-27,-9],[2,-6],[w-30,-11],
      [w-10,-4],[w+2,7],[w-3,14],[w-24,22],[24,25],[-18,25],[-w+19,19]];
    const body = [[-w+2,9],[-w+21,0],[w-13,0],[w,12],[w-13,d-15],[w-33,d-8],
      [18,d+2],[-4,d-5],[-30,d],[-w+24,d-10],[-w+13,d-27]];

    ctx.save();
    ctx.shadowColor = '#03162194'; ctx.shadowBlur = 15; ctx.shadowOffsetY = 11;
    polygon(ctx, tornContour(body, random, 2.2), '#7d6a58');
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    polygon(ctx, tornContour(body.map(([x,y]) => [x-1,y-4]), random), '#ab8068');
    polygon(ctx, tornContour(body.map(([x,y]) => [x-2,y-9]), random), '#d3a383');
    polygon(ctx, tornContour(body.map(([x,y]) => [x-1,y-14]), random), '#e4bb93');
    polygon(ctx, tornContour(top, random, 2.5), '#f0d6b3');
    ctx.lineWidth = 0.85;
    ctx.strokeStyle = '#fae6c085';
    polygon(ctx, tornContour(top.map(([x,y]) => [x*0.98,y-1]), random, 0.7), null, '#fae6c085');

    // Flaked fibres at the underside, and short grain marks on the paper face.
    ctx.strokeStyle = '#8c67534a'; ctx.lineWidth = 0.7;
    for (let i = 0; i < 27; i++) {
      const x = (random() - 0.5) * (size.width - 29);
      const y = 10 + random() * (d - 28);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2 + random() * 9, y + 0.5); ctx.stroke();
    }
    ctx.strokeStyle = '#f2d0a882';
    for (let i = 0; i < 11; i++) {
      const x = (random() - 0.5) * (size.width - 38);
      const y = d - 13 + random() * 7;
      ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 3, y + 1); ctx.stroke();
    }
    ctx.strokeStyle = '#876f4f61'; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(-w+15, 19); ctx.quadraticCurveTo(0, 33, w-14, 18); ctx.stroke();
    ctx.setLineDash([]);

    // Small sage-green paper blades, always away from the numbered pin.
    for (const x of [-w+18,-w+31,w-19,w-31]) {
      const y = x < 0 ? -1 : -3;
      const h = 6 + random() * 5;
      polygon(ctx, [[x-7,y+4],[x-5,y-h],[x-1,y+1],[x+3,y-h-3],[x+5,y+2],[x+9,y-h+3],[x+8,y+5]], '#748d67');
    }
    plant(ctx, -w+27, -2, 0.85, random);
    plant(ctx, w-19, -3, 0.7, random);
    if (node.id === level.goal) {
      littleTree(ctx, -w+23, -2, 32, -2);
      house(ctx, 30, -4);
      polygon(ctx, [[18,3],[31,3],[26,13],[12,14]], '#c4b88e');
    } else if (node.id === level.start) {
      spool(ctx, -40, -4);
      littleTree(ctx, 43, -6, 28, 3);
    } else if (node.glow > 0) {
      lighthouse(ctx, -43, -3);
      littleTree(ctx, 45, -6, 29, 1);
    } else {
      littleTree(ctx, -43, -3, 32 + random() * 9, -2);
      if (random() > 0.4) littleTree(ctx, 42, -6, 23, 2);
    }
    ctx.restore();
  }

  function islandPaper(ctx, node, level) {
    const key = [level.id,node.id,node.x,node.y,node.glow,level.start,level.goal].join(':');
    let canvas = islandCache.get(key);
    if (!canvas) {
      canvas = makeCanvas(224, 168);
      if (canvas) {
        const off = canvas.getContext('2d');
        off.translate(112, 92);
        off.lineJoin = 'round'; off.lineCap = 'round';
        drawIslandPaper(off, node, level);
        if (islandCache.size >= 32) islandCache.delete(islandCache.keys().next().value);
        islandCache.set(key, canvas);
      }
    }
    if (canvas) ctx.drawImage(canvas, node.x - 112, node.y - 92);
    else { ctx.save(); ctx.translate(node.x, node.y); drawIslandPaper(ctx, node, level); ctx.restore(); }
  }

  function drawPinMarks(ctx, node, state) {
    const rescued = Array.isArray(state.rescued) && state.rescued.includes(node.id);
    const collected = Array.isArray(state.collected) && state.collected.includes(node.id);
    if (node.flower) {
      const fx = node.x - 32, fy = node.y + 17;
      const color = collected ? '#8f9674' : '#e9a58d';
      ctx.strokeStyle = '#65794f'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(fx, fy + 4); ctx.lineTo(fx, fy + 10); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const angle = i / 5 * TAU - Math.PI / 2;
        disc(ctx, fx + Math.cos(angle) * 4.7, fy + Math.sin(angle) * 4.7, 3.1, color);
      }
      disc(ctx, fx, fy, 2, collected ? '#6f7758' : '#f7d68f');
    }
    if (rescued) {
      const fx = node.x + 22, fy = node.y - 30;
      ctx.strokeStyle = '#dfc18c'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(fx, fy + 15); ctx.lineTo(fx, fy - 11); ctx.stroke();
      polygon(ctx, [[fx + 1, fy - 11], [fx + 15, fy - 7], [fx + 1, fy - 2]], '#c9e4c5', '#f6e3b3');
      ctx.font = 'bold 8px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#214839'; ctx.fillText('✓', fx + 6, fy - 6.6);
    } else if (node.glow > 0) {
      ctx.font = '600 9px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f3d591'; ctx.fillText('+' + node.glow, node.x + 27, node.y - 19);
    }
  }

  function drawPin(ctx, node, state, view) {
    const selected = view.selected === node.id;
    const hovered = view.hover === node.id;
    const current = state.current === node.id;
    const accent = view.mode === 'cut' ? CORAL : selected ? GOLD : MINT;
    if (selected || hovered || current) {
      glow(ctx, node.x, node.y, selected ? 47 : 38, selected ? '#edc97938' : '#bcf0d52b');
      ctx.strokeStyle = current ? MINT : accent; ctx.lineWidth = selected ? 1.8 : 1;
      ctx.setLineDash(selected ? [3, 4] : []);
      ctx.beginPath(); ctx.arc(node.x, node.y, selected ? 27 : 24, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    disc(ctx, node.x, node.y + 2, 19, '#69583fa3');
    disc(ctx, node.x, node.y, 18, '#d9bd80');
    disc(ctx, node.x, node.y - 0.8, 15.7, INK);
    ctx.strokeStyle = '#f6db9b'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(node.x, node.y, 18, 3.7, 5.8); ctx.stroke();
    ctx.font = '600 18px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f4dfaf'; ctx.fillText(node.id, node.x, node.y + 1);
    ctx.textBaseline = 'middle'; ctx.font = '600 11px Georgia, serif';
    const name = String(node.label || node.id);
    const width = islandSize(node).width - 24;
    if (ctx.measureText(name).width > width) ctx.font = '600 9px Georgia, serif';
    ctx.fillStyle = '#554e39'; ctx.fillText(name, node.x, node.y + 33, width);
    drawPinMarks(ctx, node, state);
    if (current) {
      polygon(ctx, [[node.x-4,node.y+25],[node.x,node.y+28],[node.x+4,node.y+25]], MINT);
    }
  }

  function traceThread(ctx, curve, offset = 0) {
    ctx.beginPath(); ctx.moveTo(curve.a.x, curve.a.y + offset);
    ctx.quadraticCurveTo(curve.cx, curve.cy + offset, curve.b.x, curve.b.y + offset);
  }

  function capsule(ctx, x, y, width, height, fill, stroke) {
    const r = height / 2;
    ctx.beginPath(); ctx.moveTo(x - width / 2 + r, y - r);
    ctx.lineTo(x + width / 2 - r, y - r);
    ctx.quadraticCurveTo(x + width / 2, y - r, x + width / 2, y);
    ctx.quadraticCurveTo(x + width / 2, y + r, x + width / 2 - r, y + r);
    ctx.lineTo(x - width / 2 + r, y + r);
    ctx.quadraticCurveTo(x - width / 2, y + r, x - width / 2, y);
    ctx.quadraticCurveTo(x - width / 2, y - r, x - width / 2 + r, y - r); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function drawBridge(ctx, bridge, a, b) {
    const curve = bridgeCurve(a, b);
    const offsets = bridge.strands === 2 ? [-2.4, 2.4] : [0];
    ctx.save();
    ctx.strokeStyle = '#edc9790b'; ctx.lineWidth = bridge.strands === 2 ? 20 : 15;
    traceThread(ctx, curve); ctx.stroke();
    ctx.strokeStyle = '#edc97920'; ctx.lineWidth = bridge.strands === 2 ? 11 : 8;
    traceThread(ctx, curve); ctx.stroke();
    for (const offset of offsets) {
      traceThread(ctx, curve, offset); ctx.strokeStyle = '#65543b'; ctx.lineWidth = 3.3; ctx.stroke();
      traceThread(ctx, curve, offset); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.8; ctx.stroke();
      traceThread(ctx, curve, offset); ctx.strokeStyle = '#ffedb9'; ctx.lineWidth = 1.25;
      ctx.setLineDash([3, 7]); ctx.stroke(); ctx.setLineDash([]);
    }
    // Tiny diagonal needle pricks articulate hand sewing, not a solid graph edge.
    ctx.strokeStyle = '#fae7b989'; ctx.lineWidth = 0.8;
    const count = Math.min(32, Math.floor(curve.span / 19));
    for (let i = 1; i < count; i++) {
      const t = i / count;
      if (Math.abs(t - 0.5) < 0.09) continue;
      const p = curvePoint(curve, t);
      ctx.beginPath(); ctx.moveTo(p.x-2.2, p.y-3); ctx.lineTo(p.x+2.2, p.y+3); ctx.stroke();
    }
    const mid = curvePoint(curve, 0.5);
    ctx.lineWidth = 0.8;
    capsule(ctx, mid.x, mid.y, 43, 20, '#0d2c38ed', '#d7b97792');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '600 10px Georgia, serif';
    ctx.fillStyle = '#f4ddb0'; ctx.fillText(bridge.strands === 2 ? 'II · 3' : 'I · 1', mid.x, mid.y + 0.2);
    ctx.restore();
  }

  const stormCache = new Map();

  function cloudPath(ctx, x, y, width, height, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x-width*0.49, y+height*0.15);
    ctx.bezierCurveTo(x-width*0.65,y-height*0.02,x-width*0.47,y-height*0.52,x-width*0.24,y-height*0.31);
    ctx.bezierCurveTo(x-width*0.18,y-height*0.75,x+width*0.12,y-height*0.73,x+width*0.23,y-height*0.36);
    ctx.bezierCurveTo(x+width*0.47,y-height*0.60,x+width*0.64,y-height*0.08,x+width*0.45,y+height*0.20);
    ctx.lineTo(x+width*0.34,y+height*0.29); ctx.lineTo(x+width*0.18,y+height*0.24);
    ctx.lineTo(x+width*0.04,y+height*0.32); ctx.lineTo(x-width*0.10,y+height*0.27);
    ctx.lineTo(x-width*0.26,y+height*0.34); ctx.lineTo(x-width*0.43,y+height*0.23); ctx.closePath();
    if (fill) { ctx.fillStyle=fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle=stroke; ctx.stroke(); }
  }

  function drawStormPaper(ctx, radius) {
    const width = radius * 1.62;
    const height = radius * 0.91;
    glow(ctx, 0, 0, radius + 8, '#d1785b12');
    ctx.shadowColor = '#031a279e'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 7;
    cloudPath(ctx, 1, 7, width, height, '#142c3c');
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    cloudPath(ctx, -1, 1, width, height, '#344b58', '#81919248');
    cloudPath(ctx, -3, -5, width * 0.88, height * 0.85, '#52676a');
    ctx.lineWidth = 0.8;
    cloudPath(ctx, -4, -7, width * 0.83, height * 0.8, null, '#adad8b59');
    const random = seeded(radius * 891);
    ctx.strokeStyle = '#b3c5b61e';
    for (let i = 0; i < 16; i++) {
      const x = (random()-0.5)*width*0.72;
      const y = (random()-0.5)*height*0.47;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+3+random()*8,y-1); ctx.stroke();
    }
  }

  function drawStorm(ctx, storm, time) {
    const { x, y, r } = storm;
    if (![x,y,r].every(Number.isFinite) || r <= 0) return;
    ctx.save();
    ctx.lineWidth=1;
    ctx.strokeStyle='#daaa824e'; ctx.setLineDash([2,7]);
    ctx.beginPath(); ctx.arc(x,y,r+6,0,TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle='#cf907567'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.arc(x,y,r+6,0.45,0.7); ctx.arc(x,y,r+6,2.45,2.7); ctx.arc(x,y,r+6,4.48,4.73); ctx.stroke();
    const key=String(r);
    let canvas=stormCache.get(key);
    if (!canvas) {
      const size=Math.ceil(r*2+44);
      canvas=makeCanvas(size,size);
      if (canvas) {
        const off=canvas.getContext('2d'); off.translate(size/2,size/2); drawStormPaper(off,r);
        if (stormCache.size>=12) stormCache.delete(stormCache.keys().next().value);
        stormCache.set(key,canvas);
      }
    }
    if (canvas) ctx.drawImage(canvas,x-canvas.width/2,y-canvas.height/2);
    else { ctx.save();ctx.translate(x,y);drawStormPaper(ctx,r);ctx.restore(); }
    const breathe=0.7+Math.sin(time*0.0015+x)*0.12;
    glow(ctx,x-1,y+5,28,'#f4c67a'+Math.round(breathe*34).toString(16).padStart(2,'0'));
    polygon(ctx,[[x+3,y-13],[x-10,y+5],[x-2,y+5],[x-7,y+25],[x+10,y+2],[x+3,y+2],[x+11,y-13]],'#ffe3a4');
    ctx.lineWidth=0.8; capsule(ctx,x,y+r-8,17,17,'#2d414a','#dcaa8399');
    ctx.fillStyle='#f3c9a0';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 12px Georgia, serif';ctx.fillText('!',x,y+r-8);
    ctx.restore();
  }

  function drawPreview(ctx, state, view) {
    if (view.mode !== 'stitch' || !view.selected || view.flight) return;
    const a = state.level.nodes.find(node => node.id === view.selected);
    const hovered = state.level.nodes.find(node => node.id === view.hover);
    const b = hovered || view.pointer;
    if (!a || !b || ![b.x,b.y].every(Number.isFinite) || Math.hypot(b.x-a.x,b.y-a.y)<8) return;
    const curve = bridgeCurve(a,b);
    const blocked = curve.span > state.level.maxSpan || (state.level.storms || []).some(storm =>
      segmentDistanceSq(storm.x,storm.y,a,b) <= (storm.r+6)**2);
    ctx.save();
    ctx.lineWidth=11;ctx.strokeStyle=blocked?'#ed987e13':'#edc97917';traceThread(ctx,curve);ctx.stroke();
    ctx.lineWidth=1.5;ctx.strokeStyle=blocked?CORAL:GOLD;ctx.setLineDash([7,6]);traceThread(ctx,curve);ctx.stroke();ctx.setLineDash([]);
    const angle=Math.atan2(b.y-a.y,b.x-a.x);
    ctx.translate(b.x,b.y);ctx.rotate(angle);
    ctx.lineWidth=1.5;ctx.strokeStyle=blocked?CORAL:'#fae9ba';
    ctx.beginPath();ctx.moveTo(-10,-2);ctx.lineTo(3,0);ctx.lineTo(-10,2);ctx.stroke();
    ctx.beginPath();ctx.ellipse(-6,0,2,0.8,0,0,TAU);ctx.stroke();
    ctx.restore();
  }

  function drawCutHover(ctx, state, view) {
    if (view.mode !== 'cut' || !view.pointer || view.flight) return;
    const hit=hitBridge(state,view.pointer.x,view.pointer.y);
    if (!hit) return;
    const a=state.level.nodes.find(node=>node.id===hit.a);
    const b=state.level.nodes.find(node=>node.id===hit.b);
    const curve=bridgeCurve(a,b);
    const p=curvePoint(curve,0.5);
    ctx.save();
    ctx.strokeStyle='#ed987e25';ctx.lineWidth=13;traceThread(ctx,curve);ctx.stroke();
    ctx.strokeStyle=CORAL;ctx.lineWidth=2;ctx.setLineDash([5,4]);traceThread(ctx,curve);ctx.stroke();ctx.setLineDash([]);
    disc(ctx,p.x,p.y,16,'#122d39');
    ctx.translate(p.x,p.y);ctx.rotate(-0.35);ctx.lineWidth=1.7;ctx.strokeStyle=CORAL;
    for (const y of [-4,4]) { ctx.beginPath();ctx.arc(-5,y,3.8,0,TAU);ctx.stroke(); }
    ctx.beginPath();ctx.moveTo(-2,-3);ctx.lineTo(9,6);ctx.moveTo(-2,3);ctx.lineTo(9,-6);ctx.stroke();
    disc(ctx,1,0,1.5,'#fae9bc');ctx.restore();
  }

  function firefly(ctx, x, y, index, time, trail) {
    const gold = index % 3 === 1;
    const color = gold ? '#f6d782' : MINT;
    ctx.save();
    if (trail && trail.length > 1) {
      ctx.strokeStyle=gold?'#f6d78244':'#bcf0d548';ctx.lineWidth=1.1;
      ctx.beginPath();ctx.moveTo(trail[0].x,trail[0].y);
      for (let i=1;i<trail.length;i++) ctx.lineTo(trail[i].x,trail[i].y);
      ctx.stroke();
      for (let i=0;i<trail.length-1;i+=2) disc(ctx,trail[i].x,trail[i].y,0.9,i%4?'#c9e9cf22':'#f4d58c31');
    }
    glow(ctx,x,y,30,gold?'#efcc7538':'#bcf0d53a');
    glow(ctx,x,y,11,gold?'#ffda8894':'#bbf3d89a');
    const flutter=0.45+Math.abs(Math.sin(time*0.016+index*1.9))*0.55;
    ctx.fillStyle='#d9efcc77';ctx.beginPath();
    ctx.ellipse(x-3.1,y-1.5,3.6,1.25+flutter,-0.7,0,TAU);
    ctx.ellipse(x+3.1,y-1.5,3.6,1.25+flutter,0.7,0,TAU);ctx.fill();
    ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,2.4,3.8,0.05,0,TAU);ctx.fill();
    disc(ctx,x,y-2,1.25,'#faffdf');
    ctx.strokeStyle='#f1f5c899';ctx.lineWidth=0.65;
    ctx.beginPath();ctx.moveTo(x-1,y-3);ctx.lineTo(x-2.5,y-5);ctx.moveTo(x+1,y-3);ctx.lineTo(x+2.5,y-5);ctx.stroke();
    ctx.restore();
  }

  function drawSwarm(ctx, state, view, time) {
    const flight=view.flight;
    const from=flight&&state.level.nodes.find(item=>item.id===flight.from);
    const to=flight&&state.level.nodes.find(item=>item.id===flight.to);
    const travelling=from&&to&&Number.isFinite(flight.progress);
    const node=state.level.nodes.find(item=>item.id===state.current);
    if (!travelling&&!node) return;
    const quantity=travelling?flight.swarm:state.swarm;
    const count=Math.max(1,Math.min(3,Number.isFinite(quantity)?quantity:1));
    if (travelling) {
      const curve=bridgeCurve(from,to);
      const progress=Math.max(0,Math.min(1,flight.progress));
      // Higher at an island, close above the stitched arc at midspan.
      const elevation=t=>26+Math.abs(t-0.5)*50;
      for (let i=0;i<count;i++) {
        const p=curvePoint(curve,progress);
        const offset=(i-(count-1)/2)*13;
        const x=p.x+offset;
        const y=p.y-elevation(progress)+Math.sin(time*0.006+i*2)*3;
        const trail=[];
        for (let j=7;j>=0;j--) {
          const t=Math.max(0,progress-j*0.009);
          const q=curvePoint(curve,t);
          trail.push({x:q.x+offset,y:q.y-elevation(t)+Math.sin(time*0.006+i*2-j*0.25)*3});
        }
        firefly(ctx,x,y,i,time,trail);
      }
      return;
    }
    for (let i=0;i<count;i++) {
      const x=node.x+(i-(count-1)/2)*17+Math.sin(time*0.0016+i*2.8)*3;
      const y=node.y-51+Math.sin(time*0.002+i*2)*4;
      const trail=[];
      for (let j=7;j>=0;j--) trail.push({x:x-j*2,y:y+Math.sin(time*0.002-j*0.35+i)*3});
      firefly(ctx,x,y,i,time,trail);
    }
  }

  let titlePaper = null;

  function star(ctx,x,y,size,color) {
    polygon(ctx,[[x,y-size],[x+size*0.25,y-size*0.25],[x+size,y],[x+size*0.25,y+size*0.25],
      [x,y+size],[x-size*0.25,y+size*0.25],[x-size,y],[x-size*0.25,y-size*0.25]],color);
  }

  function drawTitlePaper(ctx) {
    glow(ctx,1000,384,259,'#accbb515');
    ctx.strokeStyle='#d6c39026';ctx.lineWidth=1;ctx.setLineDash([2,9]);
    ctx.beginPath();ctx.ellipse(1000,370,181,159,-0.3,0,TAU);ctx.stroke();ctx.setLineDash([]);
    ctx.strokeStyle='#d7c0933f';ctx.lineWidth=0.75;
    ctx.beginPath();ctx.ellipse(1000,370,190,168,-0.3,-1.75,0.9);ctx.stroke();
    const constellation=[[758,195],[823,169],[858,217],[912,193],[946,244],[1005,230],[1070,259],[1110,226]];
    ctx.strokeStyle='#d4cca76b';ctx.lineWidth=0.8;ctx.setLineDash([3,5]);
    ctx.beginPath();ctx.moveTo(...constellation[0]);for(const point of constellation.slice(1))ctx.lineTo(...point);ctx.stroke();ctx.setLineDash([]);
    for(let i=0;i<constellation.length;i++){const [x,y]=constellation[i];star(ctx,x,y,i%3?3:5,'#dcd4b599');disc(ctx,x,y,1.1,'#f6e5b9');}
    const artLevel={id:'title-illustration',start:'spool',goal:'cottage'};
    const pieces=[
      {id:'lookout',x:786,y:306,glow:1,scale:0.83},
      {id:'grove',x:840,y:482,glow:0,scale:0.75},
      {id:'cottage',x:1016,y:412,glow:0,scale:1.65}
    ];
    for(const node of pieces){ctx.save();ctx.translate(node.x,node.y);ctx.scale(node.scale,node.scale);drawIslandPaper(ctx,node,artLevel);ctx.restore();}
    for(const [a,b] of [[pieces[0],pieces[2]],[pieces[1],pieces[2]]]){
      const curve=bridgeCurve(a,b);ctx.strokeStyle='#f1d08829';ctx.lineWidth=9;traceThread(ctx,curve);ctx.stroke();
      for(const offset of [-2,2]){ctx.strokeStyle=GOLD;ctx.lineWidth=1.3;traceThread(ctx,curve,offset);ctx.stroke();ctx.setLineDash([3,7]);ctx.strokeStyle='#fbe8ba';traceThread(ctx,curve,offset);ctx.stroke();ctx.setLineDash([]);}
      star(ctx,curve.cx,curvePoint(curve,0.5).y,5,'#eedab2');
    }
    // Suspended paper stars make the stitching theme legible before play.
    ctx.strokeStyle='#d8c49158';ctx.lineWidth=0.8;
    for(const [x,y,drop] of [[951,437,51],[1062,443,41],[1138,419,52]]){
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+drop);ctx.stroke();star(ctx,x,y+drop,5,'#cfc4a1');
    }
    cloudPath(ctx,1120,525,146,30,'#64807918');
    cloudPath(ctx,760,538,111,28,'#61867716');
  }

  function drawTitle(ctx,time) {
    const quiet=ctx.createLinearGradient(0,0,764,0);
    quiet.addColorStop(0,'#071f2ed9');quiet.addColorStop(0.78,'#081f2ebe');quiet.addColorStop(1,'#08263100');
    ctx.fillStyle=quiet;ctx.fillRect(0,0,WIDTH,HEIGHT);
    if(!titlePaper){titlePaper=makeCanvas(WIDTH,HEIGHT);if(titlePaper)drawTitlePaper(titlePaper.getContext('2d'));}
    if(titlePaper)ctx.drawImage(titlePaper,0,0);else drawTitlePaper(ctx);
    for(let i=0;i<3;i++){
      const x=973+i*18+Math.sin(time*0.0014+i*2.4)*5;
      const y=335+Math.sin(time*0.0019+i)*9;
      firefly(ctx,x,y,i,time,[{x:x-24,y:y+3},{x:x-13,y:y-2},{x,y}]);
    }
  }

  // Ambient inventory: 170 fixed stars, 125 grain strokes, 25 ocean lines,
  // 23 constellation stars, 6 paper clouds and 14 drift motes = 363 items.
  // Static art is cached; time only breathes ambiance and visible transitions.
  const driftRandom = seeded(0x91fe);
  const driftMotes = Array.from({ length: 14 }, () => ({
    x: driftRandom() * WIDTH, y: 236 + driftRandom() * 307,
    phase: driftRandom() * TAU, speed: 0.00025 + driftRandom() * 0.0004
  }));
  const skyConstellations = [
    [[66,270],[99,241],[143,277],[117,306],[163,334]],
    [[647,173],[695,141],[745,173],[775,152],[814,171],[853,141]],
    [[1005,517],[1020,539],[1069,551],[1113,532],[1148,549]],
    [[332,514],[386,533],[434,510],[467,537],[514,523],[542,549],[581,533]]
  ];

  function drawAmbient(ctx,time) {
    ctx.save();
    ctx.lineWidth=0.65;
    for(let i=0;i<skyConstellations.length;i++) {
      const points=skyConstellations[i];
      ctx.strokeStyle='#b5ceb32d';ctx.setLineDash([2,5]);
      ctx.beginPath();ctx.moveTo(...points[0]);for(const point of points.slice(1))ctx.lineTo(...point);ctx.stroke();ctx.setLineDash([]);
      for(let j=0;j<points.length;j++){
        const [x,y]=points[j];
        const light=0.32+Math.sin(time*0.00065+i+j*1.3)*0.10;
        ctx.globalAlpha=light;star(ctx,x,y,j%3?2.3:3.5,'#f0e0b2');
      }
      ctx.globalAlpha=1;
    }
    const clouds=[[55,482,172,36],[266,553,181,34],[594,578,238,37],[884,534,146,28],[1195,467,195,43],[610,186,111,21]];
    for(let i=0;i<clouds.length;i++){
      const [x,y,w,h]=clouds[i];const shift=Math.sin(time*0.00013+i*2)*7;
      cloudPath(ctx,x+shift,y+3,w,h,'#051d271e');
      cloudPath(ctx,x+shift-3,y,w,h,'#a5bb9820');
    }
    for(let i=0;i<driftMotes.length;i++){
      const mote=driftMotes[i];const angle=time*mote.speed+mote.phase;
      const x=mote.x+Math.sin(angle)*9;const y=mote.y+Math.cos(angle*0.8)*5;
      ctx.strokeStyle=i%4?'#bce4bf22':'#f4d58625';ctx.lineWidth=0.65;
      ctx.beginPath();ctx.moveTo(x-5,y+1);ctx.lineTo(x,y);ctx.stroke();
      disc(ctx,x,y,i%4?1:1.4,i%4?'#b5dcba79':'#edce7b81');
    }
    ctx.restore();
  }

  function render(ctx, view) {
    if (!ctx || typeof ctx.fillRect !== 'function') return;
    ctx.save();
    try {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      if (!background) {
        background = makeCanvas(WIDTH, HEIGHT);
        if (background) drawBackground(background.getContext('2d'));
      }
      if (background) ctx.drawImage(background, 0, 0);
      else drawBackground(ctx);
      const time = view && Number.isFinite(view.time) ? view.time : 0;
      if (view && view.screen === 'title') { drawTitle(ctx,time); return; }
      drawAmbient(ctx,time);
      const state = view && view.state;
      if (state && state.level && Array.isArray(state.level.nodes)) {
        for (const storm of state.level.storms || []) drawStorm(ctx, storm, time);
        const nodes = state.level.nodes.slice().sort((a, b) => a.y - b.y);
        for (const node of nodes) islandPaper(ctx, node, state.level);
        for (const bridge of state.bridges || []) {
          const a = nodes.find(node => node.id === bridge.a);
          const b = nodes.find(node => node.id === bridge.b);
          if (a && b) drawBridge(ctx, bridge, a, b);
        }
        drawPreview(ctx,state,view);
        drawCutHover(ctx,state,view);
        for (const node of nodes) drawPin(ctx, node, state, view);
        drawSwarm(ctx,state,view,time);
      }
    } finally { ctx.restore(); }
  }
  function hitPin(state, x, y) {
    if (!state || !state.level || !Array.isArray(state.level.nodes) ||
        !Number.isFinite(x) || !Number.isFinite(y)) return null;
    let nearest = null;
    let best = 32 * 32;
    for (const node of state.level.nodes) {
      const distance = (x - node.x) ** 2 + (y - node.y) ** 2;
      if (distance <= best && (nearest === null || distance < best)) {
        nearest = node.id;
        best = distance;
      }
    }
    return nearest;
  }
  // One shared quadratic geometry for drawing, flight and picking.
  // Its midpoint drops by sag, unlike the straight storm-clearance chord.
  function bridgeCurve(a, b) {
    const span = Math.hypot(b.x - a.x, b.y - a.y);
    const sag = Math.max(12, Math.min(30, span * 0.075));
    return { a, b, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 + sag * 2, span };
  }

  function curvePoint(curve, t) {
    const u = 1 - t;
    return {
      x: u * u * curve.a.x + 2 * u * t * curve.cx + t * t * curve.b.x,
      y: u * u * curve.a.y + 2 * u * t * curve.cy + t * t * curve.b.y
    };
  }

  function segmentDistanceSq(x, y, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length)) : 0;
    return (x - a.x - dx * t) ** 2 + (y - a.y - dy * t) ** 2;
  }

  function hitBridge(state, x, y) {
    if (!state || !state.level || !Array.isArray(state.level.nodes) ||
        !Array.isArray(state.bridges) || !Number.isFinite(x) || !Number.isFinite(y) ||
        hitPin(state, x, y) !== null) return null;
    let nearest = null;
    let best = Infinity;
    for (const bridge of state.bridges) {
      const a = state.level.nodes.find(node => node.id === bridge.a);
      const b = state.level.nodes.find(node => node.id === bridge.b);
      if (!a || !b || ![a.x, a.y, b.x, b.y].every(Number.isFinite)) continue;
      const curve = bridgeCurve(a, b);
      let previous = a;
      let distance = Infinity;
      for (let i = 1; i <= 40; i++) {
        const next = curvePoint(curve, i / 40);
        distance = Math.min(distance, segmentDistanceSq(x, y, previous, next));
        previous = next;
      }
      const radius = bridge.strands === 2 ? 17 : 14;
      if (distance <= radius * radius && distance < best) {
        nearest = { a: bridge.a, b: bridge.b };
        best = distance;
      }
    }
    return nearest;
  }

  const api = { render, hitPin, hitBridge };
  root.SkyRender = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
