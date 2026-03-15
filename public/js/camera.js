// ============================================================
// camera.js — Smooth-following viewport (jitter-free)
// ============================================================
class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.tx = 0;  // smooth target
    this.ty = 0;
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    // Higher = snappier, lower = floatier.  0.10–0.14 feels smooth.
    this.smooth = 0.10;
    // Separate x/y smooth so diagonal moves don't double-jitter
    this._vx = 0;
    this._vy = 0;
  }

  resize(w, h) { this.vw = w; this.vh = h; }

  snap(wx, wy) {
    this.tx = wx - this.vw * 0.5;
    this.ty = wy - this.vh * 0.5;
    this.x  = this.tx;
    this.y  = this.ty;
    this._vx = 0;
    this._vy = 0;
  }

  // Frame-rate-independent exponential smoothing
  follow(wx, wy, dt) {
    this.tx = wx - this.vw * 0.5;
    this.ty = wy - this.vh * 0.5;
    // Use dt for frame-rate independence; fallback to 16ms if not provided
    const ms = dt || 16.667;
    const f  = 1 - Math.pow(1 - this.smooth, ms / 16.667);
    this.x = this.x + (this.tx - this.x) * f;
    this.y = this.y + (this.ty - this.y) * f;
  }

  isVisible(wx, wy, pad = 60) {
    const sx = wx - this.x, sy = wy - this.y;
    return sx > -pad && sy > -pad && sx < this.vw + pad && sy < this.vh + pad;
  }

  toScreen(wx, wy) {
    return { x: wx - this.x, y: wy - this.y };
  }
}
