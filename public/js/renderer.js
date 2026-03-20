// ============================================================
// renderer.js — HEXATİ Batch Renderer v2.2
// Grid + Entity + FPS + Minimap (Radar upgrade dahil)
// ============================================================
class Renderer {
  constructor(canvas, miniCanvas) {
    this.canvas  = canvas;
    this.mini    = miniCanvas;
    this.t       = 0;
    this._camera = null;

    this.particles    = new ParticleSystem();
    this.minimapDirty = true;

    this.showFPS       = true;
    this.showParticles = true;
    try {
      const s = JSON.parse(localStorage.getItem('hexati_settings') || '{}');
      if (s.showFPS    !== undefined) this.showFPS       = s.showFPS;
      if (s.particles  !== undefined) this.showParticles = s.particles;
    } catch(e) {}

    this._miniOff             = document.createElement('canvas');
    this._miniOff.width       = CONFIG.MINIMAP_PX;
    this._miniOff.height      = CONFIG.MINIMAP_PX;
    this._colorMap            = {};
    this._pendingPowerups     = null;
    this._pendingCoins        = null;
    this.localPlayerId        = 'player';

    // FPS izleme
    this._fpsSamples = [];
    this._fpsDisplay = 0;
    this._fpsTimer   = 0;

    this._setCanvasSize(window.innerWidth, window.innerHeight);

    this.ctx         = canvas.getContext('2d');
    this.mctx        = miniCanvas.getContext('2d');
    this._miniOffCtx = this._miniOff.getContext('2d');

    window.addEventListener('resize', () => {
      this._setCanvasSize(window.innerWidth, window.innerHeight);
      this.ctx = this.canvas.getContext('2d');
      if (this._camera) {
        this._camera.vw = this.canvas.width;
        this._camera.vh = this.canvas.height;
      }
    });
  }

  _setCanvasSize(w, h) {
    if (!w || !h) return;
    this.canvas.width  = w;
    this.canvas.height = h;
  }

  initCamera(camera) {
    this._camera = camera;
    camera.vw = this.canvas.width;
    camera.vh = this.canvas.height;
  }

  forceResize(camera) { this.initCamera(camera); }
  markMinimapDirty()  { this.minimapDirty = true; }

  spawnParticles(worldPos, color, count) {
    if (!this.showParticles) return;
    this.particles.emit(worldPos.x, worldPos.y, color, count);
  }

  // ── Ana çizim ─────────────────────────────────────────────
  draw(grid, entities, camera, dt) {
    this._camera = camera;
    this.t += 0.04;
    const ctx = this.ctx;
    if (!ctx) return;
    const W = this.canvas.width, H = this.canvas.height;
    if (W === 0 || H === 0) return;

    // FPS örnekleme
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

    for (const e of entities) if (e.alive && typeof e.updateLerp === 'function') e.updateLerp(dt);

    this._drawGrid(grid, camera, ctx);
    this._drawEntities(entities, camera, ctx);
    if (this.showParticles) {
      this.particles.update(dt);
      this.particles.draw(ctx, camera);
    }
    this._drawMinimap(grid, entities);
    if (this.showFPS) this._drawFPS(ctx);
  }

  // ── Grid çizimi (batch) ───────────────────────────────────
  _drawGrid(grid, camera, ctx) {
    const S = CONFIG.HEX_SIZE, S1 = S - 1.2;
    const HW = CONFIG.HEX_W;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 3);

    const ownedBuckets = {};
    const trailBuckets = {};
    const dangerPath   = new Path2D();
    const emptyPath    = new Path2D();
    let dangerCount = 0;

    this._pendingPowerups = [];
    this._pendingCoins    = [];

    for (let col = 0; col < grid.w; col++) {
      for (let row = 0; row < grid.h; row++) {
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
            trailBuckets[c].push({ x: sp.x, y: sp.y });
          }
        } else if (cell.owner) {
          const c = this._colorMap[cell.owner];
          if (c) {
            if (!ownedBuckets[c]) ownedBuckets[c] = [];
            ownedBuckets[c].push({ x: sp.x, y: sp.y });
          }
        } else {
          this._addHexToPath(emptyPath, sp.x, sp.y, S1);
        }

        if (cell.powerup) this._pendingPowerups.push({ sp, type: cell.powerup });
        if (cell.coin)    this._pendingCoins.push({ sp, val: cell.coin });
      }
    }

    // Boş hexler
    ctx.fillStyle = CONFIG.GRID_STROKE;
    ctx.fill(emptyPath);

    // Sahip olunan hexler
    for (const [color, cells] of Object.entries(ownedBuckets)) {
      const path = new Path2D();
      for (const { x, y } of cells) this._addHexToPath(path, x, y, S1);
      ctx.fillStyle = Utils.hexAlpha(color, 0.6);
      ctx.fill(path);
      ctx.strokeStyle = color;
      ctx.lineWidth   = 0.5;
      ctx.stroke(path);
    }

    // Trail hexler
    for (const [color, cells] of Object.entries(trailBuckets)) {
      const path = new Path2D();
      for (const { x, y } of cells) this._addHexToPath(path, x, y, S1 - 1);
      ctx.fillStyle = color;
      ctx.fill(path);
    }

    // Tehlike bölgeleri (pulsating kırmızı)
    if (dangerCount > 0) {
      ctx.fillStyle = `rgba(255,${20 + pulse * 30 | 0},${20 + pulse * 20 | 0},${0.6 + pulse * 0.2})`;
      ctx.fill(dangerPath);
    }

    // Güçlendiriciler
    for (const { sp, type } of this._pendingPowerups) {
      this._drawPowerup(ctx, sp.x, sp.y, type, S);
    }

    // Coinler
    for (const { sp, val } of this._pendingCoins) {
      this._drawCoin(ctx, sp.x, sp.y, val, S);
    }
  }

  _addHexToPath(path, cx, cy, size) {
    path.moveTo(cx + size * Math.cos(-Math.PI / 6), cy + size * Math.sin(-Math.PI / 6));
    for (let i = 1; i < 6; i++) {
      const a = Math.PI / 3 * i - Math.PI / 6;
      path.lineTo(cx + size * Math.cos(a), cy + size * Math.sin(a));
    }
    path.closePath();
  }

  _drawPowerup(ctx, cx, cy, type, S) {
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
    const r = S * 0.45 + pulse * 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const colors = { speed: '#ffd700', shield: '#00d4ff', double: '#2ed573' };
    ctx.fillStyle = Utils.hexAlpha(colors[type] || '#fff', 0.3 + pulse * 0.2);
    ctx.fill();
    ctx.strokeStyle = colors[type] || '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = colors[type] || '#fff';
    ctx.font = `${S * 0.55}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(type === 'speed' ? '⚡' : type === 'shield' ? '🛡' : '✕2', cx, cy + 1);
    ctx.restore();
  }

  _drawCoin(ctx, cx, cy, val, S) {
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 3 + cx);
    const r = S * 0.3 + pulse * 1.5;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = Utils.hexAlpha('#ffd700', 0.7 + pulse * 0.2);
    ctx.fill();
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (val > 1) {
      ctx.fillStyle = '#7a5200';
      ctx.font = `bold ${S * 0.4}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(val, cx, cy + 0.5);
    }
    ctx.restore();
  }

  // ── Entity çizimi ─────────────────────────────────────────
  _drawEntities(entities, camera, ctx) {
    for (const e of entities) {
      if (!e.alive) continue;
      // px/py undefined ise (multiplayer ilk frame) grid pozisyonunu kullan
      const px = (e.px !== undefined && !isNaN(e.px)) ? e.px : Utils.hexToPixel(e.x, e.y).x;
      const py = (e.py !== undefined && !isNaN(e.py)) ? e.py : Utils.hexToPixel(e.x, e.y).y;
      const sp = camera.toScreen(px, py);
      const S  = CONFIG.HEX_SIZE;
      const isLocal = e.id === this.localPlayerId;

      // Gövde
      ctx.save();
      ctx.beginPath();
      this._addHexToPath(new Path2D(), sp.x, sp.y, S * 0.7);
      Utils.hexPath(ctx, sp.x, sp.y, S * 0.72);
      ctx.fillStyle = e.color;
      ctx.fill();

      // Kalkan efekti
      if (e.shielded) {
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, S * 0.85, 0, Math.PI * 2);
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth   = 2.5;
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(this.t * 6);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Ghost (invincibility) efekti
      if (e.ghostMs > 0) {
        ctx.globalAlpha = 0.4 + 0.4 * Math.sin(this.t * 10);
      }

      // İsim etiketi (lokal oyuncu için büyük, botlar için küçük)
      ctx.fillStyle = '#fff';
      ctx.font      = isLocal ? `bold ${S * 0.55}px "Orbitron", sans-serif`
                               : `${S * 0.45}px "Orbitron", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.globalAlpha = 0.9;
      ctx.fillText(e.name.slice(0, 8), sp.x, sp.y - S * 0.8);
      ctx.globalAlpha = 1;

      // Hız boost oku
      if (e.speedBoost) {
        ctx.fillStyle   = '#ffd700';
        ctx.font        = `${S * 0.5}px sans-serif`;
        ctx.textBaseline= 'middle';
        ctx.fillText('⚡', sp.x + S * 0.6, sp.y);
      }

      ctx.restore();
    }
  }

  // ── FPS sayacı ───────────────────────────────────────────
  _drawFPS(ctx) {
    const fps = this._fpsDisplay;
    const color = fps >= 55 ? '#2ed573' : fps >= 30 ? '#ffa502' : '#ff4757';
    ctx.save();
    ctx.fillStyle    = color;
    ctx.font         = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`${fps} FPS`, this.canvas.width - 12, 12);
    ctx.restore();
  }

  // ── Minimap ───────────────────────────────────────────────
  _drawMinimap(grid, entities) {
    if (!grid) return;
    if (!entities) entities = [];

    const colorLookup = {};
    for (const e of entities) colorLookup[e.id] = e.color;

    const PX = CONFIG.MINIMAP_PX, cw = PX / grid.w, ch = PX / grid.h;

    if (this.minimapDirty) {
      this.minimapDirty = false;
      const mc = this._miniOffCtx;
      mc.fillStyle = '#080c14';
      mc.fillRect(0, 0, PX, PX);
      for (let i = 0; i < grid._data.length; i++) {
        const c = grid._data[i];
        const col = i % grid.w, row = (i / grid.w) | 0;
        if (c.danger) {
          mc.fillStyle = 'rgba(255,50,50,0.5)';
          mc.fillRect(col * cw, row * ch, cw + 0.5, ch + 0.5);
        } else if (c.owner) {
          const color = colorLookup[c.owner];
          if (color) { mc.fillStyle = color; mc.fillRect(col * cw, row * ch, cw + 0.5, ch + 0.5); }
        }
      }
    }

    const mc = this.mctx;
    mc.drawImage(this._miniOff, 0, 0);

    // Radar upgrade: minimap'te bot izlerini göster
    const localPlayer = entities.find(e => e.id === this.localPlayerId);
    const hasRadar    = localPlayer?.upgrades?.radar;
    if (hasRadar) {
      for (let i = 0; i < grid._data.length; i++) {
        const c = grid._data[i];
        if (!c.trail) continue;
        const trailOwner = entities.find(e => e.id === c.trail);
        if (!trailOwner || !trailOwner.isBot) continue;
        const col = i % grid.w, row = (i / grid.w) | 0;
        mc.fillStyle = Utils.hexAlpha(trailOwner.color, 0.7);
        mc.fillRect(col * cw, row * ch, cw + 0.5, ch + 0.5);
      }
    }

    // Entity noktaları
    for (const e of entities) {
      if (!e.alive) continue;
      const isLocal = e.id === this.localPlayerId;
      mc.beginPath();
      mc.arc(e.x * cw, e.y * ch, isLocal ? 3 : 2, 0, Math.PI * 2);
      mc.fillStyle = isLocal ? '#fff' : e.color;
      mc.fill();
    }
  }
}
