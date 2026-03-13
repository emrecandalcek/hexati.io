// ============================================================
// particles.js — Lightweight canvas particle system
// ============================================================
class ParticleSystem {
  constructor() {
    this._pool = [];
  }

  // Emit n particles from world pixel position {x,y}
  emit(wx, wy, color, count) {
    for (let i=0; i<count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3;
      this._pool.push({
        wx, wy,
        vx: Math.cos(angle)*speed,
        vy: Math.sin(angle)*speed,
        color,
        life: 1.0,
        decay: 0.025 + Math.random()*0.035,
        r:    2 + Math.random()*3,
      });
    }
  }

  update(dt) {
    const s = dt / 16.667;
    for (let i=this._pool.length-1; i>=0; i--) {
      const p = this._pool[i];
      p.wx   += p.vx * s;
      p.wy   += p.vy * s;
      p.vy   += 0.08 * s;   // gravity
      p.life -= p.decay * s;
      if (p.life <= 0) this._pool.splice(i,1);
    }
  }

  draw(ctx, camera) {
    for (const p of this._pool) {
      if (!camera.isVisible(p.wx, p.wy, 20)) continue;
      const sp = camera.toScreen(p.wx, p.wy);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, p.r * p.life, 0, Math.PI*2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
