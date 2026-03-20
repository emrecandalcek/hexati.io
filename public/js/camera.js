// ============================================================
// camera.js — HEXATİ smooth-following viewport  v2.2
//
// ZİGZAG FIX: Kamera artık hexToPixel (gerçek stagger) takip eder.
// Even/odd satır geçişinde 17px yatay kayma, düşük smooth faktörü
// (0.08) sayesinde ~12 frame (~200ms) içinde yayılır → görünmez.
// ============================================================
class Camera {
  constructor() {
    this.x  = 0; this.y  = 0;
    this.tx = 0; this.ty = 0;
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    // Daha düşük smooth: row-parity geçişindeki 17px hop gizlenir
    this.smooth = 0.08;
  }

  resize(w, h) { this.vw = w; this.vh = h; }

  snap(wx, wy) {
    this.tx = wx - this.vw * 0.5;
    this.ty = wy - this.vh * 0.5;
    this.x  = this.tx;
    this.y  = this.ty;
  }

  // Frame-rate bağımsız üstel yumuşatma
  follow(wx, wy, dt) {
    this.tx = wx - this.vw * 0.5;
    this.ty = wy - this.vh * 0.5;
    const ms = dt || 16.667;
    const f  = 1 - Math.pow(1 - this.smooth, ms / 16.667);
    this.x  += (this.tx - this.x) * f;
    this.y  += (this.ty - this.y) * f;
  }

  isVisible(wx, wy, pad = 60) {
    const sx = wx - this.x, sy = wy - this.y;
    return sx > -pad && sy > -pad && sx < this.vw + pad && sy < this.vh + pad;
  }

  toScreen(wx, wy) {
    return { x: wx - this.x, y: wy - this.y };
  }
}
