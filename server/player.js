// ============================================================
// server/player.js — Server-side human player
// ============================================================
const ServerEntity = require('./entity');

class ServerPlayer extends ServerEntity {
  constructor(id, name, color, x, y, socketId) {
    super(id, name, color, x, y);
    this.socketId  = socketId;
    this.deaths    = 0;
    this.isBot     = false;
    this._pendingDir = null;
    this.combo     = 0;
    this.comboTimer = 0;
  }

  queueDir(d) { this._pendingDir = d; }

  update(dt, grid, entities) {
    if (!this.alive) return [];
    const events = [];

    this.tickPowerup(dt);

    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // Magnet
    if (this.upgrades.magnet) this._magnetCoins(grid);

    this.moveTimer += dt;
    if (this.moveTimer < this.moveInterval) return events;
    this.moveTimer -= this.moveInterval;

    if (this._pendingDir) { this.trySetDir(this._pendingDir); this._pendingDir = null; }

    return this._step(grid, entities, room);
  }

  _step(grid, entities, room) {
    const events = [];
    const nx = this.x + this.dir.x, ny = this.y + this.dir.y;
    const prevX = this.x, prevY = this.y;

    if (!grid.inBounds(nx, ny)) {
      this._die('boundary', grid, events); return events;
    }

    const nextCell = grid.get(nx, ny);

    if (nextCell.trail === this.id) {
      this._die('self', grid, events); return events;
    }

    if (nextCell.danger && this.outside && !this.isInvincible()) {
      this._die('danger', grid, events); return events;
    }

    // Cut enemy trail
    if (nextCell.trail && nextCell.trail !== this.id) {
      const enemy = entities.find(e => e.id === nextCell.trail);
      if (enemy && enemy.alive && !enemy.isInvincible()) {
        enemy._die('trail', grid, events);
        this.kills++;
        this.addCoins(CONFIG.COIN_KILL_VALUE);
        events.push({ type: 'kill', killer: this.id, victim: enemy.id, pos: { x: nx, y: ny } });
      }
    }

    // Collect coin
    if (nextCell.coin) {
      this.addCoins(nextCell.coin);
      events.push({ type: 'coin', id: this.id, pos: { x: nx, y: ny }, val: nextCell.coin });
      grid.setCoin(nx, ny, 0);
    }

    this.x = nx; this.y = ny;

    if (nextCell.owner === this.id) {
      if (this.outside && this.trail.length > 0) {
        // LAST-HEX FIX
        const prevCell = grid.get(prevX, prevY);
        if (prevCell && prevCell.owner !== this.id && prevCell.trail !== this.id) {
          grid.setTrail(prevX, prevY, this.id);
          this.trail.push({ x: prevX, y: prevY });
        }

        const captured = FloodFill.capture(grid, this.id, this.trail);
        const bonusMult = 1 + (this.upgrades.capture_bonus || 0) * 0.2;
        const extra = Math.floor(captured * (bonusMult - 1));
        if (extra > 0) this._expandCapture(grid, extra);

        this.trail = []; this.outside = false;
        this.territory = grid.countOwned(this.id);

        const coinEarned = Math.floor(captured / 5) * CONFIG.COIN_CAPTURE_BONUS;
        if (coinEarned > 0) this.addCoins(coinEarned);

        this.combo++;
        this.comboTimer = 4000;
        const comboBonus = this.combo > 1 ? this.combo * 2 : 0;
        if (comboBonus) this.addCoins(comboBonus);

        if (this.upgrades.ghost) this.ghostMs = 1200;

        events.push({ type: 'capture', id: this.id, cells: captured, combo: this.combo, pos: { x: this.x, y: this.y } });
      }
    } else {
      this.outside = true;

      if (nextCell.powerup) {
        this.applyPowerup(nextCell.powerup);
        events.push({ type: 'powerup', id: this.id, ptype: nextCell.powerup });
        grid.setPowerup(nx, ny, null);
      }

      // TRAIL BUG FIX
      const prevCell = grid.get(prevX, prevY);
      if (prevCell && prevCell.owner !== this.id) {
        grid.setTrail(prevX, prevY, this.id);
        this.trail.push({ x: prevX, y: prevY });
      } else if (this.trail.length === 0) {
        grid.setTrail(nx, ny, this.id);
        this.trail.push({ x: this.x, y: this.y });
      }

      // Wide trail upgrade
      if (this.upgrades.trail_width) {
        for (const d of Utils.DIRS) {
          const nc = grid.get(prevX + d.x, prevY + d.y);
          if (nc && !nc.owner && !nc.trail) grid.setTrail(prevX + d.x, prevY + d.y, this.id);
        }
      }
    }

    this.territory = grid.countOwned(this.id);
    return events;
  }

  _magnetCoins(grid) {
    const R = 3;
    for (let dx = -R; dx <= R; dx++)
      for (let dy = -R; dy <= R; dy++) {
        const c = grid.get(this.x + dx, this.y + dy);
        if (c?.coin) { this.addCoins(c.coin); grid.setCoin(this.x + dx, this.y + dy, 0); }
      }
  }

  _expandCapture(grid, extra) {
    let added = 0;
    for (let r = 1; r < 8 && added < extra; r++)
      for (let dx = -r; dx <= r && added < extra; dx++)
        for (let dy = -r; dy <= r && added < extra; dy++) {
          const c = grid.get(this.x + dx, this.y + dy);
          if (c && !c.owner) { grid._setOwner(c, this.id, grid._idx(this.x + dx, this.y + dy)); added++; }
        }
  }

  _die(cause, grid, events) {
    if (!this.alive) return;
    this.alive = false; this.deaths++; this.combo = 0;
    grid.clearTrail(this.id);
    this.trail = []; this.outside = false;
    events.push({ type: 'death', id: this.id, cause });
  }

  respawn(grid, cx, cy) {
    grid.wipeEntity(this.id);
    this.x = cx; this.y = cy;
    this.dir = { x: 1, y: 0 }; this.trail = []; this.outside = false;
    this.alive = true; this.shielded = false; this.speedBoost = false;
    this.ghostMs = 0; this.powerup = null; this.powerupMs = 0;
    this.moveInterval = this._baseMoveInterval(); this.moveTimer = 0; this.combo = 0;
    grid.claimStart(cx, cy, CONFIG.START_AREA_RADIUS, this.id);
    this.territory = grid.countOwned(this.id);
  }

  buyUpgrade(key) {
    const item = CONFIG.SHOP[key];
    if (!item) return false;
    const level = this.upgrades[key] || 0;
    if (level >= item.max || this.coins < item.cost) return false;
    this.coins -= item.cost;
    this.upgrades[key] = level + 1;
    if (key === 'trail_speed') this.moveInterval = this._baseMoveInterval();
    return true;
  }
}

module.exports = ServerPlayer;
