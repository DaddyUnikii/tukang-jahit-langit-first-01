(function (root) {
  'use strict';

  // Hand-placed islands; no generated maps or runtime solution data.
  const levels = [
    {
      id: 'night-1', title: 'Tusuk Pertama', subtitle: 'One light, one small beginning',
      hint: 'A single strand carries one light. Visit the flower before home.',
      budget: 83, maxSpan: 750, parMoves: 2, start: '1', goal: '3',
      nodes: [
        { id: '1', label: 'Spool', x: 240, y: 400, glow: 0, flower: false },
        { id: '2', label: 'Petal', x: 570, y: 260, glow: 0, flower: true },
        { id: '3', label: 'Home', x: 950, y: 390, glow: 0, flower: false }
      ],
      storms: []
    },
    {
      id: 'night-2', title: 'Dua Sahabat', subtitle: 'A heavier little constellation',
      hint: 'Twins join at the second island. Add a second strand for the way ahead.',
      budget: 141, maxSpan: 350, parMoves: 3, start: '1', goal: '4',
      nodes: [
        { id: '1', label: 'Spool', x: 200, y: 410, glow: 0, flower: false },
        { id: '2', label: 'Twins', x: 430, y: 285, glow: 2, flower: false },
        { id: '3', label: 'Petal', x: 660, y: 410, glow: 0, flower: true },
        { id: '4', label: 'Home', x: 890, y: 285, glow: 0, flower: false }
      ],
      storms: []
    },
    {
      id: 'night-3', title: 'Pinggir Badai', subtitle: 'Sew around the thunder',
      hint: 'The storm blocks straight stitches. Follow its quiet upper edge.',
      budget: 165, maxSpan: 720, parMoves: 4, start: '1', goal: '5',
      nodes: [
        { id: '1', label: 'Spool', x: 180, y: 440, glow: 0, flower: false },
        { id: '2', label: 'Petal', x: 350, y: 220, glow: 0, flower: true },
        { id: '3', label: 'Lantern', x: 600, y: 185, glow: 1, flower: false },
        { id: '4', label: 'Ribbon', x: 830, y: 280, glow: 0, flower: true },
        { id: '5', label: 'Home', x: 1040, y: 450, glow: 0, flower: false }
      ],
      storms: [{ x: 550, y: 355, r: 115 }]
    },
    {
      id: 'night-4', title: 'Benang Pulang', subtitle: 'Nothing precious goes to waste',
      hint: 'Cut a bridge behind the flock and wind that thread into the next stitch.',
      budget: 58, maxSpan: 290, parMoves: 4, start: '1', goal: '5',
      nodes: [
        { id: '1', label: 'Spool', x: 160, y: 440, glow: 0, flower: false },
        { id: '2', label: 'Friend', x: 380, y: 290, glow: 1, flower: false },
        { id: '3', label: 'Petal', x: 600, y: 440, glow: 0, flower: true },
        { id: '4', label: 'Lantern', x: 820, y: 290, glow: 1, flower: false },
        { id: '5', label: 'Home', x: 1040, y: 440, glow: 0, flower: false }
      ],
      storms: []
    },
    {
      id: 'night-5', title: 'Rumah Menunggu', subtitle: 'Home keeps a lamp for everyone',
      hint: 'Home is a safe hub, not a finish until everyone returns. Strengthen return stitches.',
      budget: 124, maxSpan: 360, parMoves: 6, start: '1', goal: '2',
      nodes: [
        { id: '1', label: 'Spool', x: 220, y: 370, glow: 0, flower: false },
        { id: '2', label: 'Home', x: 500, y: 370, glow: 0, flower: false },
        { id: '3', label: 'Petal', x: 500, y: 180, glow: 0, flower: true },
        { id: '4', label: 'Friend', x: 780, y: 205, glow: 1, flower: false },
        { id: '5', label: 'Lantern', x: 790, y: 495, glow: 1, flower: false },
        { id: '6', label: 'Cloudlet', x: 1040, y: 355, glow: 0, flower: false }
      ],
      storms: [{ x: 850, y: 355, r: 60 }]
    },
    {
      id: 'night-6', title: 'Kebun Berliku', subtitle: 'A petal off the beaten stitch',
      hint: 'The garden is a round trip. Keep its return strand, then reclaim it.',
      budget: 64, maxSpan: 440, parMoves: 7, start: '1', goal: '7',
      nodes: [
        { id: '1', label: 'Spool', x: 150, y: 445, glow: 0, flower: false },
        { id: '2', label: 'Friend', x: 330, y: 315, glow: 1, flower: false },
        { id: '3', label: 'Fork', x: 510, y: 430, glow: 0, flower: false },
        { id: '4', label: 'Arch', x: 680, y: 300, glow: 0, flower: false },
        { id: '5', label: 'Garden', x: 510, y: 185, glow: 0, flower: true },
        { id: '6', label: 'Lantern', x: 850, y: 435, glow: 1, flower: false },
        { id: '7', label: 'Home', x: 1080, y: 235, glow: 0, flower: false }
      ],
      storms: [{ x: 695, y: 480, r: 62 }]
    },
    {
      id: 'night-7', title: 'Simpul Bulan', subtitle: 'Choose the order of the lights',
      hint: 'Take the low petal first. Rescue changes the weight of every return trip.',
      budget: 110, maxSpan: 590, parMoves: 5, start: '1', goal: '6',
      nodes: [
        { id: '1', label: 'Spool', x: 170, y: 355, glow: 0, flower: false },
        { id: '2', label: 'Friend', x: 390, y: 185, glow: 1, flower: false },
        { id: '3', label: 'Lantern', x: 650, y: 205, glow: 1, flower: false },
        { id: '4', label: 'Petal', x: 500, y: 515, glow: 0, flower: true },
        { id: '5', label: 'Ribbon', x: 810, y: 475, glow: 0, flower: true },
        { id: '6', label: 'Home', x: 1050, y: 330, glow: 0, flower: false }
      ],
      storms: [{ x: 440, y: 350, r: 80 }]
    },
    {
      id: 'night-8', title: 'Langit Utuh', subtitle: 'The last seam becomes a constellation',
      hint: 'Keep the upper seam clear, then reuse it below. Bring every light home.',
      budget: 80, maxSpan: 430, parMoves: 7, start: '1', goal: '8',
      nodes: [
        { id: '1', label: 'Spool', x: 145, y: 420, glow: 0, flower: false },
        { id: '2', label: 'Petal', x: 285, y: 220, glow: 0, flower: true },
        { id: '3', label: 'Friend', x: 485, y: 175, glow: 1, flower: false },
        { id: '4', label: 'Arch', x: 680, y: 255, glow: 0, flower: false },
        { id: '5', label: 'Lantern', x: 880, y: 175, glow: 1, flower: false },
        { id: '6', label: 'Ribbon', x: 1055, y: 360, glow: 0, flower: true },
        { id: '7', label: 'Garden', x: 825, y: 525, glow: 0, flower: true },
        { id: '8', label: 'Home', x: 590, y: 470, glow: 0, flower: false }
      ],
      storms: [{ x: 390, y: 330, r: 70 }, { x: 850, y: 345, r: 80 }]
    }
  ];

  root.SkyLevels = levels;
  if (typeof module !== 'undefined' && module.exports) module.exports = levels;
})(globalThis);
