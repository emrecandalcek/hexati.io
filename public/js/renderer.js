// ============================================================
// renderer.js — Batch renderer + FPS counter + particles
//               + coins + danger zones + smooth lerp
// ============================================================
class Renderer {
  constructor(canvas, miniCanvas) {
    this.canvas  = canvas;
    this.mini    = miniCanvas;
    this.t       = 0;

    this.particles    = new ParticleSystem();
    this.minimapDirty = true;

    // Load settings
    this.showFPS      = true;
    this.showParticles = true;
    try {
      const s = JSON.parse(localStorage.getItem('hexdomain_settings') || '{}');
      if (s.showFPS    !== undefined) this.showFPS       = s.showFPS;
      if (s.particles  !== undefined) this.showParticles = s.particles;
    } catch(e) {}

    this._miniOff     = document.createElement('canvas');
    this._miniOff.width  = CONFIG.MINIMAP_PX;
    this._miniOff.height = CONFIG.MINIMAP_PX;

    this._colorMap    = {};
    this._pendingPowerups = null;

    // FPS tracking
    this._fpsSamples  = [];
    this._fpsDisplay  = 0;
    this._fpsTimer    = 0;

    // Resize FIRST so canvas has correct pixel dimensions before getContext
    this._resize();
    // Get contexts AFTER resize so they're bound to correct dimensions
    this.ctx     = canvas.getContext('2d');
    this.mctx    = miniCanvas.getContext('2d');
    this._miniOffCtx  = this._miniOff.getContext('2d');

    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    // Re-acquire context — resizing canvas resets it
    this.ctx = this.canvas.getContext('2d');
    // Keep camera vw/vh in sync so isVisible() culling is correct
    if (this._camera) {
      this._camera.vw = window.innerWidth;
      this._camera.vh = window.innerHeight;
    }
  }

  markMinimapDirty() { this.minimapDirty = true; }

  spawnParticles(worldPos, color, count) {
    if (!this.showParticles) return;
    this.particles.emit(worldPos.x, worldPos.y, color, count);
  }

  // ── Main draw ─────────────────────────────────────────────
  draw(grid, entities, camera, dt) {
    // Keep camera reference for resize sync
    this._camera = camera;
    // Ensure canvas pixel size matches window (guards against late resize)
    if (this.canvas.width !== window.innerWidth || this.canvas.height !== window.innerHeight) {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
      camera.vw = window.innerWidth;
      camera.vh = window.innerHeight;
    }
    this.t += 0.04;
    const ctx = this.ctx;
    if (!ctx) return;  // context not ready yet
    const W = this.canvas.width, H = this.canvas.height;

    // FPS sampling
    this._fpsTimer += dt;
    this._fpsSamples.push(dt);
    if (this._fpsSamples.length > 60) this._fpsSamples.shift();
    if (this._fpsTimer > 500) {
      this._fpsTimer = 0;
      const avg = this._fpsSamples.reduce((a,b)=>a+b,0) / this._fpsSamples.length;
      this._fpsDisplay = Math.round(1000/avg);
    }

    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = CONFIG.EMPTY_COLOR;
    ctx.fillRect(0,0,W,H);

    this._colorMap = {};
    for (const e of entities) this._colorMap[e.id] = e.color;

    // Lerp all entities
    for (const e of entities) if (e.alive) e.updateLerp(dt);

    this._drawGrid(grid, camera, ctx);
    this._drawEntities(entities, camera, ctx);
    if (this.showParticles) {
      this.particles.update(dt);
      this.particles.draw(ctx, camera);
    }
    this._drawMinimap(grid, entities);
    if (this.showFPS) this._drawFPS(ctx);
  }

  // ── Batch grid draw ───────────────────────────────────────
  _drawGrid(grid, camera, ctx) {
    const S = CONFIG.HEX_SIZE, S1 = S - 1.2;
    const HW = CONFIG.HEX_W;  // actual hex pixel width ~34px
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 3);

    const ownedBuckets  = {};
    const trailBuckets  = {};
    const dangerPath    = new Path2D();
    const emptyPath     = new Path2D();
    let emptyCount = 0, dangerCount = 0;

    this._pendingPowerups = [];
    this._pendingCoins    = [];

    for (let col=0; col<grid.w; col++) {
      for (let row=0; row<grid.h; row++) {
        const wp = Utils.hexToPixel(col, row);
        if (!camera.isVisible(wp.x, wp.y, HW * 2)) continue;
        const sp   = camera.toScreen(wp.x, wp.y);
        const cell = grid.get(col, row);

        if (cell.danger) {
          this._addHexToPath(dangerPath, sp.x, sp.y, S1);
          dangerCount++;
        } else if (cell.trail) {
          const c = this._colorMap[cell.trail];
          if (c) {
            if (!trailBuckets[c]) trailBuckets[c] = [];
            trailBuckets[c].push({x:sp.x, y:sp.y});
          }
        } else if (cell.owner) {
          const c = this._colorMap[cell.owner];
          if (c) {
            if (!ownedBuckets[c]) ownedBuckets[c] = new Path2D();
            this._addHexToPath(ownedBuckets[c], sp.x, sp.y, S1);
          }
        } else {
          this._addHexToPath(emptyPath, sp.x, sp.y, S1);
          emptyCount++;
        }

        if (cell.powerup) this._pendingPowerups.push({x:sp.x, y:sp.y, type:cell.powerup});
        if (cell.coin)    this._pendingCoins.push({x:sp.x, y:sp.y, value:cell.coin});
      }
    }

    // Empty
    if (emptyCount>0) {
      ctx.fillStyle='#101828'; ctx.strokeStyle='#0e1624'; ctx.lineWidth=0.5;
      ctx.fill(emptyPath); ctx.stroke(emptyPath);
    }

    // Danger zones — pulsing red
    if (dangerCount>0) {
      const dAlpha = 0.35 + 0.35*Math.sin(this.t*4);
      ctx.fillStyle = `rgba(255,50,50,${dAlpha})`;
      ctx.strokeStyle = '#ff2222';
      ctx.lineWidth = 1;
      ctx.fill(dangerPath); ctx.stroke(dangerPath);
    }

    // Owned
    for (const [color, path] of Object.entries(ownedBuckets)) {
      ctx.fillStyle   = color;
      ctx.strokeStyle = Utils.darken(color, 0.45);
      ctx.lineWidth   = 1;
      ctx.fill(path); ctx.stroke(path);
    }

    // Trail (pulsed alpha)
    const savedAlpha = ctx.globalAlpha;
    for (const [color, cells] of Object.entries(trailBuckets)) {
      const tp = new Path2D();
      for (const {x,y} of cells) this._addHexToPath(tp, x, y, S1);
      ctx.globalAlpha = 0.45 + 0.55*pulse;
      ctx.fillStyle   = color;
      ctx.fill(tp);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.2;
      ctx.stroke(tp);
    }
    ctx.globalAlpha = savedAlpha;

    // Power-up icons
    for (const {x,y,type} of this._pendingPowerups) this._drawPowerupIcon(ctx,x,y,type);
    // Coin icons
    for (const {x,y,value} of this._pendingCoins)   this._drawCoin(ctx,x,y,value);
  }

  _addHexToPath(path, cx, cy, size) {
    for (let i=0; i<6; i++) {
      const angle = Math.PI/3*i - Math.PI/6;
      const px = cx + size*Math.cos(angle);
      const py = cy + size*Math.sin(angle);
      i===0 ? path.moveTo(px,py) : path.lineTo(px,py);
    }
    path.closePath();
  }

  // ── Entities ──────────────────────────────────────────────
  _drawEntities(entities, camera, ctx) {
    for (const e of entities) {
      if (!e.alive) continue;
      if (!camera.isVisible(e.px, e.py)) continue;
      const sp = camera.toScreen(e.px, e.py);
      const isPlayer = e.id === 'player';
      const r = isPlayer ? 11 : 8;

      // Ghost glow
      if (e.ghostMs > 0) {
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r+9, 0, Math.PI*2);
        ctx.strokeStyle = Utils.hexAlpha('#ffffff', 0.3*Math.sin(this.t*8));
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Shield halo
      if (e.shielded) {
        const haloR = r + 7 + 3*Math.sin(this.t*4);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, haloR, 0, Math.PI*2);
        ctx.strokeStyle = Utils.hexAlpha('#00d4ff', 0.5+0.35*Math.sin(this.t*3));
        ctx.lineWidth = 2.5; ctx.stroke();
      }

      // Speed ring
      if (e.speedBoost) {
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r+5, 0, Math.PI*2);
        ctx.strokeStyle = Utils.hexAlpha('#ffd700', 0.5);
        ctx.lineWidth = 2; ctx.stroke();
      }

      // Body
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r, 0, Math.PI*2);
      ctx.fillStyle   = isPlayer ? '#ffffff' : e.color;
      ctx.fill();
      ctx.strokeStyle = e.color;
      ctx.lineWidth   = isPlayer ? 3 : 2;
      ctx.stroke();

      // Direction dot
      ctx.beginPath();
      ctx.arc(sp.x+e.dir.x*(r+5), sp.y+e.dir.y*(r+5), 3, 0, Math.PI*2);
      ctx.fillStyle = isPlayer ? e.color : Utils.darken(e.color,0.7);
      ctx.fill();

      // Bot name
      if (!isPlayer) {
        ctx.font='600 10px JetBrains Mono,monospace';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle=Utils.hexAlpha('#fff',0.75);
        ctx.fillText(e.name, sp.x, sp.y-r-9);
        ctx.textBaseline='alphabetic';
      }

      // Player coin count floating above
      if (isPlayer) {
        ctx.font='bold 11px Orbitron,monospace';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle='#ffd700';
        ctx.fillText(`⬡${e.coins}`, sp.x, sp.y-r-22);
        ctx.textBaseline='alphabetic';
      }
    }
  }

  _drawPowerupIcon(ctx, x, y, type) {
    const colors = {speed:'#ffd700',shield:'#00d4ff',double:'#2ed573'};
    const labels = {speed:'⚡',shield:'🛡',double:'✕2'};
    const pulse  = 0.7+0.3*Math.sin(this.t*5);
    ctx.beginPath();
    ctx.arc(x,y,9,0,Math.PI*2);
    ctx.fillStyle=Utils.hexAlpha(colors[type],0.85*pulse); ctx.fill();
    ctx.strokeStyle=colors[type]; ctx.lineWidth=1.5; ctx.stroke();
    ctx.font='9px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#fff'; ctx.fillText(labels[type],x,y);
    ctx.textBaseline='alphabetic';
  }

  _drawCoin(ctx, x, y, value) {
    const pulse = 0.8+0.2*Math.sin(this.t*6);
    const color = value>=5?'#ff6b35':value>=3?'#ffd700':'#ffeb80';
    ctx.beginPath();
    ctx.arc(x,y,7*pulse,0,Math.PI*2);
    ctx.fillStyle=Utils.hexAlpha(color, 0.9); ctx.fill();
    ctx.strokeStyle=color; ctx.lineWidth=1.2; ctx.stroke();
    ctx.font='bold 8px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#1a1000'; ctx.fillText(value,x,y);
    ctx.textBaseline='alphabetic';
  }

  // ── FPS counter ───────────────────────────────────────────
  _drawFPS(ctx) {
    const fps = this._fpsDisplay;
    const color = fps>=55?'#2ed573':fps>=30?'#ffa502':'#ff4757';
    ctx.font='bold 11px JetBrains Mono,monospace';
    ctx.textAlign='right'; ctx.textBaseline='top';
    ctx.fillStyle=color;
    ctx.fillText(`${fps} FPS`, this.canvas.width-12, 12);
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  }

  // ── Minimap ───────────────────────────────────────────────
  _drawMinimap(grid, entities) {
    // Always rebuild colorMap before minimap (may have changed)
    for (const e of entities) this._colorMap[e.id] = e.color;
    const PX=CONFIG.MINIMAP_PX, cw=PX/grid.w, ch=PX/grid.h;
    if (this.minimapDirty) {
      this.minimapDirty = false;
      const mc = this._miniOffCtx;
      mc.fillStyle='#080c14'; mc.fillRect(0,0,PX,PX);
      for (let i=0; i<grid._data.length; i++) {
        const c = grid._data[i];
        const col=i%grid.w, row=(i/grid.w)|0;
        if (c.danger) {
          mc.fillStyle='rgba(255,50,50,0.5)';
          mc.fillRect(col*cw, row*ch, cw+0.5, ch+0.5);
        } else if (c.owner) {
          const color = this._colorMap[c.owner];
          if (color) { mc.fillStyle=color; mc.fillRect(col*cw,row*ch,cw+0.5,ch+0.5); }
        }
      }
    }
    const mc = this.mctx;
    mc.drawImage(this._miniOff,0,0);
    for (const e of entities) {
      if (!e.alive) continue;
      mc.beginPath();
      mc.arc(e.x*cw, e.y*ch, e.id==='player'?3:2, 0, Math.PI*2);
      mc.fillStyle = e.id==='player'?'#fff':e.color;
      mc.fill();
    }
  }
}
