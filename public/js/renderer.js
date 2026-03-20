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

      // px/py: multiplayer plain obje — updateLerp yok, manuel set edildi
      const rawPx = e.px;
      const rawPy = e.py;
      const fallback = Utils.hexToPixel(e.x, e.y);
      const px = (rawPx !== undefined && !isNaN(rawPx)) ? rawPx : fallback.x;
      const py = (rawPy !== undefined && !isNaN(rawPy)) ? rawPy : fallback.y;
      const sp = camera.toScreen(px, py);

      const S       = CONFIG.HEX_SIZE;
      const isLocal = e.id === this.localPlayerId;

      // Görünürlük kontrolü — ekran dışıysa çizme
      if (sp.x < -S * 3 || sp.x > this.canvas.width + S * 3) continue;
      if (sp.y < -S * 3 || sp.y > this.canvas.height + S * 3) continue;

      ctx.save();

      // Ghost efekti
      if (e.ghostMs > 0) ctx.globalAlpha = 0.45 + 0.45 * Math.sin(this.t * 10);

      // ─────────────────────────────────────────────────────
      // KATMAN 1: Dış pulsating halka — her renkten ayırt edilir
      // Lokal oyuncu: beyaz, daha büyük. Diğer: entity rengi, ince
      // ─────────────────────────────────────────────────────
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 5);
      const ringR = isLocal ? S * 1.05 + pulse * S * 0.12
                            : S * 0.95 + pulse * S * 0.08;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = isLocal ? '#ffffff' : Utils.hexAlpha(e.color, 0.9);
      ctx.lineWidth   = isLocal ? 3 : 2;
      ctx.stroke();

      // ─────────────────────────────────────────────────────
      // KATMAN 2: Gövde hex — trail hex'inden BELİRGİN şekilde farklı
      // Trail hex rengi: e.color (düz)
      // Entity gövdesi: beyaz dolgulu iç + renkli çerçeve = kolayca ayırt edilir
      // ─────────────────────────────────────────────────────
      Utils.hexPath(ctx, sp.x, sp.y, S * 0.82);
      ctx.fillStyle = '#ffffff';          // beyaz iç dolgu
      ctx.fill();

      Utils.hexPath(ctx, sp.x, sp.y, S * 0.82);
      ctx.strokeStyle = e.color;
      ctx.lineWidth   = 3.5;
      ctx.stroke();

      // ─────────────────────────────────────────────────────
      // KATMAN 3: Renk çekirdeği — entity renginde küçük merkez
      // ─────────────────────────────────────────────────────
      Utils.hexPath(ctx, sp.x, sp.y, S * 0.52);
      ctx.fillStyle = e.color;
      ctx.fill();

      // ─────────────────────────────────────────────────────
      // KATMAN 4: Yön göstergesi — nereye gittiği belli
      // ─────────────────────────────────────────────────────
      const dirX = (e.dir?.x || 0) * S * 0.28;
      const dirY = (e.dir?.y || 0) * S * 0.28;
      ctx.beginPath();
      ctx.arc(sp.x + dirX, sp.y + dirY, S * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // ─────────────────────────────────────────────────────
      // KATMAN 5: Kalkan halkası
      // ─────────────────────────────────────────────────────
      if (e.shielded) {
        const shieldAlpha = 0.6 + 0.4 * Math.sin(this.t * 6);
        ctx.globalAlpha   = shieldAlpha;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, S * 1.2, 0, Math.PI * 2);
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth   = 3;
        ctx.stroke();
        ctx.globalAlpha = e.ghostMs > 0 ? (0.45 + 0.45 * Math.sin(this.t * 10)) : 1;
      }

      // ─────────────────────────────────────────────────────
      // KATMAN 6: İsim etiketi — koyu gölgeli, her zeminde okunur
      // ─────────────────────────────────────────────────────
      ctx.globalAlpha  = 0.95;
      ctx.shadowColor  = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur   = 5;
      ctx.fillStyle    = isLocal ? '#ffffff' : '#e8e8e8';
      ctx.font         = isLocal
        ? `bold ${(S * 0.58)|0}px "Orbitron", sans-serif`
        : `${(S * 0.46)|0}px "Orbitron", sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(e.name.slice(0, 8), sp.x, sp.y - S * 0.95);
      ctx.shadowBlur   = 0;
      ctx.globalAlpha  = 1;

      // Hız boost ikonu
      if (e.speedBoost) {
        ctx.font         = `${(S * 0.55)|0}px sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', sp.x + S * 0.72, sp.y - S * 0.1);
      }

      ctx.restore();
    }
  }

  // ── FPS sayacı  // ── FPS sayacı ───────────────────────────────────────────
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

  // ── Minimap ─────────────────────────────────────────────
  _drawMinimap(grid, entities) {
    if (!grid || !this.mctx) return;
    if (!entities) entities = [];

    const PX  = CONFIG.MINIMAP_PX;
    const cw  = PX / grid.w;
    const ch  = PX / grid.h;
    const mc  = this.mctx;
    const off = this._miniOffCtx;

    // Renk tablosu — entity id → renk
    const colorLookup = {};
    for (const e of entities) colorLookup[e.id] = e.color;

    // Grid katmanı: sadece grid değişince yeniden çiz
    if (this.minimapDirty) {
      this.minimapDirty = false;

      off.fillStyle = '#080c14';
      off.fillRect(0, 0, PX, PX);

      for (let i = 0; i < grid._data.length; i++) {
        const c   = grid._data[i];
        const col = i % grid.w;
        const row = (i / grid.w) | 0;
        const x   = col * cw;
        const y   = row * ch;

        if (c.danger) {
          off.fillStyle = 'rgba(255,60,60,0.6)';
          off.fillRect(x, y, cw + 0.5, ch + 0.5);
        } else if (c.owner) {
          const color = colorLookup[c.owner];
          if (color) {
            off.fillStyle = Utils.hexAlpha(color, 0.75);
            off.fillRect(x, y, cw + 0.5, ch + 0.5);
          }
        }
      }

      // Trail katmanı — radar upgrade varsa bot izleri de
      const localE   = entities.find(e => e.id === this.localPlayerId);
      const hasRadar = localE?.upgrades?.radar;

      for (let i = 0; i < grid._data.length; i++) {
        const c = grid._data[i];
        if (!c.trail) continue;
        const col   = i % grid.w;
        const row   = (i / grid.w) | 0;
        const owner = entities.find(e => e.id === c.trail);
        if (!owner) continue;
        if (owner.isBot && !hasRadar) continue;
        off.fillStyle = Utils.hexAlpha(owner.color, 0.9);
        off.fillRect(col * cw, row * ch, cw + 0.5, ch + 0.5);
      }
    }

    // Offscreen'i minimap canvas'ına kopyala
    mc.clearRect(0, 0, PX, PX);
    mc.drawImage(this._miniOff, 0, 0);

    // Entity noktaları — her frame çizilir (hareket ediyor)
    for (const e of entities) {
      if (!e.alive) continue;
      const ex = e.x * cw;
      const ey = e.y * ch;
      const isLocal = e.id === this.localPlayerId;

      if (isLocal) {
        // Lokal oyuncu: beyaz, daha büyük, çerçeveli
        mc.beginPath();
        mc.arc(ex, ey, 3.5, 0, Math.PI * 2);
        mc.fillStyle = '#ffffff';
        mc.fill();
        mc.beginPath();
        mc.arc(ex, ey, 4.5, 0, Math.PI * 2);
        mc.strokeStyle = e.color;
        mc.lineWidth   = 1.5;
        mc.stroke();
      } else {
        mc.beginPath();
        mc.arc(ex, ey, e.isBot ? 1.8 : 2.5, 0, Math.PI * 2);
        mc.fillStyle = e.color;
        mc.fill();
      }
    }

    // Minimap çerçevesi
    mc.strokeStyle = 'rgba(0,212,255,0.25)';
    mc.lineWidth   = 1;
    mc.strokeRect(0.5, 0.5, PX - 1, PX - 1);
  }
}
