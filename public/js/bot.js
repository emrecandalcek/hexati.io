// ============================================================
// bot.js — HEXATİ Bot AI (client-side, single-player)
// 3 state: expand / return / attack + stuck detection
// ============================================================
class Bot extends Entity {
  constructor(id, name, color, x, y, diffMult) {
    super(id, name, color, x, y);
    this.moveInterval = CONFIG.BOT_MOVE_BASE * diffMult + Utils.randInt(-20, 20);
    this.state        = 'expand';
    this.respawnCb    = null;
    this._stuckTimer  = 0;
    this._lastPos     = { x, y };
    this.isBot        = true;
  }

  update(dt, grid, entities, audio, ui, renderer) {
    if (!this.alive) return;
    this.tickPowerup(dt);
    this.moveTimer += dt;
    if (this.moveTimer < this.moveInterval) return;
    this.moveTimer -= this.moveInterval;

    // Takılma tespiti
    if (this.x === this._lastPos.x && this.y === this._lastPos.y) {
      this._stuckTimer++;
      if (this._stuckTimer >= 3) { this._pickSafeDir(grid); this._stuckTimer = 0; }
    } else {
      this._stuckTimer = 0;
    }
    this._lastPos = { x: this.x, y: this.y };

    this._think(grid, entities);
    if (!this._tryMove(grid, entities, audio, ui, renderer)) {
      this._pickSafeDir(grid);
      this._tryMove(grid, entities, audio, ui, renderer);
    }
  }

  _think(grid, entities) {
    if (!this.outside) {
      this.state = Math.random() < 0.82 ? 'expand' : 'attack';
    } else {
      if (this.trail.length > 22) this.state = Math.random() < 0.7 ? 'return' : this.state;
      if (this.trail.length > 45) this.state = 'return';
    }
    switch (this.state) {
      case 'expand': this._expandDir(grid);           break;
      case 'return': this._returnDir(grid);           break;
      case 'attack': this._attackDir(grid, entities); break;
    }
  }

  _tryMove(grid, entities, audio, ui, renderer) {
    const nx = this.x + this.dir.x, ny = this.y + this.dir.y;
    if (!grid.inBounds(nx, ny)) return false;

    const nextCell = grid.get(nx, ny);
    if (nextCell.trail === this.id) return false;
    if (nextCell.danger && this.outside)  return false;

    const prevX = this.x, prevY = this.y;

    if (nextCell.trail && nextCell.trail !== this.id) {
      const victim = entities.find(e => e.id === nextCell.trail);
      if (victim && victim.alive && !victim.isInvincible()) {
        victim._die('trail', grid, entities, audio, ui);
        if (victim.id === 'player') {
          ui?.killFeed(`${this.name} izini kesti!`, this.color);
          audio?.kill();
        }
        this.kills++;
        this.addCoins(CONFIG.COIN_KILL_VALUE);
        renderer?.spawnParticles(Utils.hexToPixel(nx, ny), this.color, 8);
      }
    }

    if (nextCell.coin) { this.addCoins(nextCell.coin); nextCell.coin = 0; }

    this.x = nx; this.y = ny;

    if (nextCell.owner === this.id) {
      if (this.outside && this.trail.length > 0) {
        // Son hex düzeltmesi
        const prevCell = grid.get(prevX, prevY);
        if (prevCell && prevCell.owner !== this.id && prevCell.trail !== this.id) {
          prevCell.trail = this.id;
          this.trail.push({ x: prevX, y: prevY });
        }
        FloodFill.capture(grid, this.id, this.trail, renderer);
        this.trail = []; this.outside = false;
        this.territory = grid.countOwned(this.id);
        this.state = 'expand';
      }
    } else {
      this.outside = true;
      const prevCell = grid.get(prevX, prevY);
      if (prevCell && prevCell.owner !== this.id) {
        prevCell.trail = this.id;
        this.trail.push({ x: prevX, y: prevY });
      } else if (this.trail.length === 0) {
        nextCell.trail = this.id;
        this.trail.push({ x: this.x, y: this.y });
      }
    }

    if (nextCell.powerup) { this.applyPowerup(nextCell.powerup); nextCell.powerup = null; }
    this.territory = grid.countOwned(this.id);
    return true;
  }

  _expandDir(grid) {
    const nx = this.x + this.dir.x, ny = this.y + this.dir.y;
    if (!grid.inBounds(nx, ny) || grid.get(nx, ny)?.trail === this.id || grid.get(nx, ny)?.danger)
      this._pickSafeDir(grid);
  }

  _returnDir(grid) {
    const own = this._nearestOwned(grid);
    if (!own) return;
    const adx = Math.abs(own.x - this.x), ady = Math.abs(own.y - this.y);
    const dx  = Math.sign(own.x - this.x), dy  = Math.sign(own.y - this.y);
    if (adx >= ady && dx) this.dir = { x: dx, y: 0 };
    else if (dy)           this.dir = { x: 0,  y: dy };
    else if (dx)           this.dir = { x: dx, y: 0 };
    const nx = this.x + this.dir.x, ny = this.y + this.dir.y;
    if (!grid.inBounds(nx, ny) || grid.get(nx, ny)?.trail === this.id) this._pickSafeDir(grid);
  }

  _attackDir(grid, entities) {
    let best = null, bestD = Infinity;
    for (const e of entities) {
      if (e.id === this.id || !e.alive || e.trail.length < 3) continue;
      const t = e.trail[e.trail.length >> 1];
      const d = Utils.dist(this, t);
      if (d < bestD) { bestD = d; best = t; }
    }
    if (!best || bestD > 25) { this.state = 'expand'; return; }
    const dx = Math.sign(best.x - this.x), dy = Math.sign(best.y - this.y);
    if (Math.abs(best.x - this.x) >= Math.abs(best.y - this.y) && dx) this.dir = { x: dx, y: 0 };
    else if (dy) this.dir = { x: 0, y: dy };
  }

  _pickSafeDir(grid) {
    const dirs = Utils.shuffle([...Utils.DIRS]);
    for (const d of dirs) {
      if (d.x === -this.dir.x && d.y === -this.dir.y) continue;
      const nx = this.x + d.x, ny = this.y + d.y;
      if (grid.inBounds(nx, ny) && !grid.get(nx, ny)?.trail && !grid.get(nx, ny)?.danger) {
        this.dir = d; return;
      }
    }
    for (const d of dirs) {
      const nx = this.x + d.x, ny = this.y + d.y;
      if (grid.inBounds(nx, ny) && !grid.get(nx, ny)?.danger) { this.dir = d; return; }
    }
  }

  _nearestOwned(grid) {
    let best = null, bestD = Infinity;
    for (let dx = -30; dx <= 30; dx++)
      for (let dy = -30; dy <= 30; dy++) {
        const c = grid.get(this.x + dx, this.y + dy);
        if (c?.owner === this.id) {
          const d = Math.abs(dx) + Math.abs(dy);
          if (d < bestD) { bestD = d; best = { x: this.x + dx, y: this.y + dy }; }
        }
      }
    return best;
  }

  _die(cause, grid, entities, audio, ui) {
    if (!this.alive) return;
    this.alive = false;
    grid.clearTrail(this.id);
    this.trail = []; this.outside = false;
    if (this.respawnCb) setTimeout(() => this.respawnCb(this), CONFIG.BOT_RESPAWN_DELAY);
  }
}
