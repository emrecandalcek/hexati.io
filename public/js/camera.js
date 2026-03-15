// ============================================================
// camera.js — Smooth-following viewport
// ============================================================
class Camera {
  constructor() {
    this.x = 0;   // world-px of viewport top-left
    this.y = 0;
    this.tw = 0;  // target
    this.th = 0;
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    this.smooth = 0.12;
  }

  resize(w, h) { this.vw = w; this.vh = h; }

  // Snap camera to target immediately (no lerp)
  snap(wx, wy) {
    this.x = wx - this.vw * 0.5;
    this.y = wy - this.vh * 0.5;
    this.tw = this.x;
    this.th = this.y;
  }

  follow(wx, wy) {
    this.tw = wx - this.vw * 0.5;
    this.th = wy - this.vh * 0.5;
    this.x = Utils.lerp(this.x, this.tw, this.smooth);
    this.y = Utils.lerp(this.y, this.th, this.smooth);
  }

  // Is a world point visible?
  isVisible(wx, wy, pad = 60) {
    const sx = wx - this.x, sy = wy - this.y;
    return sx > -pad && sy > -pad && sx < this.vw + pad && sy < this.vh + pad;
  }

  toScreen(wx, wy) {
    return { x: wx - this.x, y: wy - this.y };
  }
}
