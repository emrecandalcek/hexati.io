// ============================================================
// input.js — Keyboard (WASD / arrow) + touch swipe
// ============================================================
class InputHandler {
  constructor() {
    this._pending = null;   // next queued direction
    this._touch   = null;

    const map = {
      ArrowUp: {x:0,y:-1}, w:{x:0,y:-1}, W:{x:0,y:-1},
      ArrowDown:{x:0,y:1}, s:{x:0,y:1},  S:{x:0,y:1},
      ArrowLeft:{x:-1,y:0},a:{x:-1,y:0}, A:{x:-1,y:0},
      ArrowRight:{x:1,y:0},d:{x:1,y:0},  D:{x:1,y:0},
    };

    document.addEventListener('keydown', e => {
      if (map[e.key]) {
        this._pending = map[e.key];
        if (e.key.startsWith('Arrow')) e.preventDefault();
      }
    });

    // Touch swipe
    document.addEventListener('touchstart', e => {
      const t = e.touches[0];
      this._touch = { x: t.clientX, y: t.clientY };
    }, { passive: true });

    document.addEventListener('touchmove', e => {
      if (!this._touch) return;
      const dx = e.touches[0].clientX - this._touch.x;
      const dy = e.touches[0].clientY - this._touch.y;
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;

      if (Math.abs(dx) >= Math.abs(dy)) {
        this._pending = dx > 0 ? {x:1,y:0} : {x:-1,y:0};
      } else {
        this._pending = dy > 0 ? {x:0,y:1} : {x:0,y:-1};
      }
      this._touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
  }

  // Returns the queued direction and clears it
  consume() {
    const d = this._pending;
    this._pending = null;
    return d;
  }
}
