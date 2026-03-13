// ============================================================
// shared/utils.js — Pure helpers (server + client)
// ============================================================
const Utils = {
  hexToPixel(col, row) {
    const w = CONFIG.HEX_W;
    const h = CONFIG.HEX_H;
    const x = col * w + (row & 1 ? w * 0.5 : 0);
    const y = row * h * 0.75;
    return { x, y };
  },

  randInt(min, max) {
    return (Math.random() * (max - min + 1) | 0) + min;
  },

  pick(arr) {
    return arr[Math.random() * arr.length | 0];
  },

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.random() * (i + 1) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  dist(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  },

  lerp(a, b, t) { return a + (b - a) * t; },
  clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },

  formatTime(ms) {
    const s = ms / 1000 | 0;
    return `${s / 60 | 0}:${String(s % 60).padStart(2, '0')}`;
  },

  hexAlpha(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  },

  darken(hex, f) {
    const r = (parseInt(hex.slice(1, 3), 16) * f) | 0;
    const g = (parseInt(hex.slice(3, 5), 16) * f) | 0;
    const b = (parseInt(hex.slice(5, 7), 16) * f) | 0;
    return `rgb(${r},${g},${b})`;
  },

  DIRS: [
    { x: 1, y: 0 }, { x: -1, y: 0 },
    { x: 0, y: 1 }, { x: 0, y: -1 },
  ],
};

if (typeof module !== 'undefined') module.exports = Utils;
