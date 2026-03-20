// ============================================================
// player.js — HEXATİ İnsan Oyuncu (client-side, v2.2)
// Son-hex iz düzeltmesi + TRAIL BUG düzeltmesi dahil
// ============================================================
class Player extends Entity {
  constructor(id, name, color, x, y) {
    super(id, name, color, x, y);
    this.deaths     = 0;
    this.totalKills = 0;
    this.startTime  = Date.now();
    this.deathCause = null;
    this.combo      = 0;
    this.comboTimer = 0;
    this.lives      = 3;  // Survival modu için (diğer modlar önemsemez)
  }

  update(dt, input, grid, entities, audio, ui, renderer) {
    if (!this.alive) return;
    const expired = this.tickPowerup(dt);
    if (expired) ui.notify('Güçlendirme sona erdi', '#6c7a89');

    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    if (this.upgrades.magnet) this._magnetCoins(grid);

    this.moveTimer += dt;
    if (this.moveTimer < this.moveInterval) return;
    this.moveTimer -= this.moveInterval;

    const d = input.consume();
    if (d) this.trySetDir(d);
    this._step(grid, entities, audio, ui, renderer);
  }

  _step(grid, entities, audio, ui, renderer) {
    const nx = this.x + this.dir.x;
    const ny = this.y + this.dir.y;
    const prevX = this.x, prevY = this.y;

    if (!grid.inBounds(nx, ny)) {
      this._die('boundary', grid, entities, audio, ui); return;
    }

    const nextCell = grid.get(nx, ny);

    if (nextCell.trail === this.id) {
      this._die('self', grid, entities, audio, ui); return;
    }

    if (nextCell.danger && this.outside && !this.isInvincible()) {
      this._die('danger', grid, entities, audio, ui); return;
    }

    // Düşman izi kes
    if (nextCell.trail && nextCell.trail !== this.id) {
      const enemy = entities.find(e => e.id === nextCell.trail);
      if (enemy && enemy.alive && !enemy.isInvincible()) {
        enemy._die('trail', grid, entities, audio, ui);
        ui.killFeed(`SEN ${enemy.name} izini kestin!`, this.color);
        this.kills++;
        this.totalKills++;
        this.addCoins(CONFIG.COIN_KILL_VALUE);
        audio.kill();
        renderer?.spawnParticles(Utils.hexToPixel(nx, ny), this.color, 12);
      }
    }

    // Coin topla
    if (nextCell.coin) {
      this.addCoins(nextCell.coin);
      nextCell.coin = 0;
      audio.coinPickup?.();
      renderer?.spawnParticles(Utils.hexToPixel(nx, ny), '#ffd700', 6);
    }

    this.x = nx; this.y = ny;
    audio.step();

    if (nextCell.owner === this.id) {
      if (this.outside && this.trail.length > 0) {
        // Son hex düzeltmesi: bölgeye dönerken son dış hücreyi trail'e ekle
        const prevCell = grid.get(prevX, prevY);
        if (prevCell && prevCell.owner !== this.id && prevCell.trail !== this.id) {
          prevCell.trail = this.id;
          this.trail.push({ x: prevX, y: prevY });
        }

        let captured = FloodFill.capture(grid, this.id, this.trail, renderer);

        // Capture bonus upgrade
        const bonusMult = 1 + (this.upgrades.capture_bonus || 0) * 0.2;
        const extraCells = Math.floor(captured * (bonusMult - 1));
        if (extraCells > 0) this._expandCapture(grid, extraCells);

        this.trail    = [];
        this.outside  = false;
        this.territory = grid.countOwned(this.id);

        const coinEarned = Math.floor(captured / 5) * CONFIG.COIN_CAPTURE_BONUS;
        if (coinEarned > 0) this.addCoins(coinEarned);

        this.combo++;
        this.comboTimer = 4000;
        if (this.combo > 1) {
          ui.notify(`COMBO ×${this.combo}! +${this.combo * 2} coin`, '#ffd700');
          this.addCoins(this.combo * 2);
        }

        if (this.upgrades.ghost) this.ghostMs = 1200;

        audio.capture();
        if (captured > 8) ui.notify(`+${captured} hücre!`, this.color);
        if (renderer) {
          renderer.markMinimapDirty();
          renderer.spawnParticles(Utils.hexToPixel(this.x, this.y), this.color, 18);
        }
      }
    } else {
      this.outside = true;

      if (nextCell.powerup) {
        this.applyPowerup(nextCell.powerup);
        audio.powerup();
        ui.showPowerup(nextCell.powerup, this.powerupMs);
        ui.notify(
          nextCell.powerup === 'speed'  ? '⚡ HIZ BOOST'    :
          nextCell.powerup === 'shield' ? '🛡 KALKAN AKTİF' : '✕2 ÇİFT YAKALAMA',
          nextCell.powerup === 'speed'  ? '#ffd700' :
          nextCell.powerup === 'shield' ? '#00d4ff'  : '#2ed573'
        );
        nextCell.powerup = null;
      }

      // Trail iz düzeltmesi: iz'i terk ettiğimiz hücreye bırak
      const prevCell = grid.get(prevX, prevY);
      if (prevCell && prevCell.owner !== this.id) {
        prevCell.trail = this.id;
        this.trail.push({ x: prevX, y: prevY });
      } else if (this.trail.length === 0) {
        nextCell.trail = this.id;
        this.trail.push({ x: this.x, y: this.y });
      }

      // Geniş iz upgrade
      if (this.upgrades.trail_width) {
        for (const d of Utils.DIRS) {
          const nc = grid.get(prevX + d.x, prevY + d.y);
          if (nc && !nc.owner && !nc.trail) nc.trail = this.id;
        }
      }

      if (this.trail.length >= CONFIG.MAX_TRAIL) {
        ui.notify('İz limiti! Geri dön!', '#ff4757');
      }
    }

    this.territory = grid.countOwned(this.id);
  }

  _magnetCoins(grid) {
    const R = 3;
    for (let dx = -R; dx <= R; dx++)
      for (let dy = -R; dy <= R; dy++) {
        const c = grid.get(this.x + dx, this.y + dy);
        if (c?.coin) { this.addCoins(c.coin); c.coin = 0; }
      }
  }

  _expandCapture(grid, extra) {
    let added = 0;
    for (let r = 1; r < 8 && added < extra; r++)
      for (let dx = -r; dx <= r && added < extra; dx++)
        for (let dy = -r; dy <= r && added < extra; dy++) {
          const c = grid.get(this.x + dx, this.y + dy);
          if (c && !c.owner) { grid._setOwner(c, this.id); added++; }
        }
  }

  _die(cause, grid, entities, audio, ui) {
    if (!this.alive) return;
    this.alive      = false;
    this.deaths++;
    this.deathCause = cause;
    this.combo      = 0;
    grid.clearTrail(this.id);
    this.trail   = [];
    this.outside = false;
    audio.death();
    ui.showDeath(this, cause);
  }

  respawn(grid, cx, cy) {
    grid.wipeEntity(this.id);
    this.x = cx; this.y = cy;
    this.dir        = { x: 1, y: 0 };
    this.trail      = [];
    this.outside    = false;
    this.alive      = true;
    this.shielded   = false;
    this.speedBoost = false;
    this.ghostMs    = 0;
    this.powerup    = null;
    this.powerupMs  = 0;
    this.moveInterval = this._baseMoveInterval();
    this.moveTimer  = 0;
    this.combo      = 0;
    grid.claimStart(cx, cy, CONFIG.START_AREA_RADIUS, this.id);
    this.territory = grid.countOwned(this.id);
    this.snapPixelPos();
  }
}
