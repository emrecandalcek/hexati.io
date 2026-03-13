// ============================================================
// server/entity.js — Server-side base entity
// ============================================================
class ServerEntity {
  constructor(id, name, color, x, y) {
    this.id    = id;
    this.name  = name;
    this.color = color;
    this.x = x; this.y = y;
    this.dir   = { x: 1, y: 0 };
    this.trail = [];
    this.outside  = false;
    this.alive    = true;
    this.kills    = 0;
    this.territory = 0;
    this.coins    = 0;
    this.powerup  = null;
    this.powerupMs = 0;
    this.shielded  = false;
    this.speedBoost = false;
    this.ghostMs   = 0;
    this.upgrades  = {
      trail_speed: 0, capture_bonus: 0, shield_time: 0,
      trail_width: 0, radar: 0, magnet: 0, ghost: 0, double_coins: 0,
    };
    this.moveTimer    = 0;
    this.moveInterval = CONFIG.MOVE_INTERVAL;
  }

  _baseMoveInterval() {
    return CONFIG.MOVE_INTERVAL * Math.pow(0.85, this.upgrades.trail_speed || 0);
  }

  trySetDir(d) {
    if (d.x === -this.dir.x && d.y === -this.dir.y) return;
    this.dir = d;
  }

  tickPowerup(dt) {
    if (this.powerupMs > 0) {
      this.powerupMs -= dt;
      if (this.powerupMs <= 0) {
        this.powerup = null; this.shielded = false; this.speedBoost = false;
        this.moveInterval = this._baseMoveInterval();
        this.powerupMs = 0;
        return true;
      }
    }
    if (this.ghostMs > 0) this.ghostMs -= dt;
    return false;
  }

  applyPowerup(type) {
    this.powerup  = type;
    const bonus   = (this.upgrades.shield_time || 0) * 4000;
    this.powerupMs = CONFIG.POWERUP_DURATION_MS + bonus;
    if (type === 'speed') {
      this.speedBoost = true;
      this.moveInterval = this._baseMoveInterval() * CONFIG.SPEED_MULTIPLIER;
    } else if (type === 'shield') {
      this.shielded = true;
    }
  }

  isInvincible() { return this.shielded || this.ghostMs > 0; }

  addCoins(n) {
    this.coins += n * (this.upgrades.double_coins ? 2 : 1);
  }

  // Serialise for client
  toState() {
    return {
      id:        this.id,
      name:      this.name,
      color:     this.color,
      x:         this.x,
      y:         this.y,
      dir:       this.dir,
      alive:     this.alive,
      outside:   this.outside,
      trail:     this.trail,
      kills:     this.kills,
      territory: this.territory,
      coins:     this.coins,
      powerup:   this.powerup,
      powerupMs: this.powerupMs,
      shielded:  this.shielded,
      speedBoost:this.speedBoost,
      ghostMs:   this.ghostMs,
      upgrades:  this.upgrades,
      isBot:     this.isBot || false,
    };
  }
}

module.exports = ServerEntity;
