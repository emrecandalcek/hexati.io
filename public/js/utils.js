// ============================================================
// utils.js — Pure helper functions
// ============================================================
const Utils = {

  // Pixel position of hex cell (col, row) in an offset-row grid.
  // Uses pointy-top hexagons; odd rows are shifted right by half a hex.
  hexToPixel(col, row) {
    const w = CONFIG.HEX_W;
    const h = CONFIG.HEX_H;
    const x = col * w + (row & 1 ? w * 0.5 : 0);
    const y = row * h * 0.75;
    return { x, y };
  },

  // Build a hex path on ctx centered at (cx, cy).
  hexPath(ctx, cx, cy, size) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 3 * i - Math.PI / 6;
      const px = cx + size * Math.cos(angle);
      const py = cy + size * Math.sin(angle);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  },

  // Integer random in [min, max]
  randInt(min, max) {
    return (Math.random() * (max - min + 1) | 0) + min;
  },

  // Random element from array
  pick(arr) {
    return arr[Math.random() * arr.length | 0];
  },

  // Shuffle array in place (Fisher-Yates)
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.random() * (i + 1) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  // Manhattan distance (square grid)
  dist(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  },

  // Linear interpolation
  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  // Clamp value
  clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  },

  // Format milliseconds as m:ss
  formatTime(ms) {
    const s = ms / 1000 | 0;
    return `${s / 60 | 0}:${String(s % 60).padStart(2, '0')}`;
  },

  // Hex color → rgba string with custom alpha
  hexAlpha(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  },

  // Darken hex color by factor (0–1)
  darken(hex, f) {
    const r = (parseInt(hex.slice(1, 3), 16) * f) | 0;
    const g = (parseInt(hex.slice(3, 5), 16) * f) | 0;
    const b = (parseInt(hex.slice(5, 7), 16) * f) | 0;
    return `rgb(${r},${g},${b})`;
  },

  // All 4 orthogonal directions
  DIRS: [
    { x: 1, y: 0 }, { x: -1, y: 0 },
    { x: 0, y: 1 }, { x: 0, y: -1 },
  ],
};
