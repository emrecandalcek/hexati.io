// ============================================================
// entity.js — Base class with lerp + upgrades + coins
// ============================================================
class Entity {
  constructor(id, name, color, x, y) {
    this.id    = id;
    this.name  = name;
    this.color = color;
    this.x = x; this.y = y;

    // Smooth pixel position (no row-stagger zigzag)
    const p = Utils.hexToPixelSmooth(x, y);
    this.px = p.x; this.py = p.y;

    this.dir     = { x: 1, y: 0 };
    this.trail   = [];
    this.outside = false;
    this.alive   = true;

    this.kills     = 0;
    this.territory = 0;

    // Economy
    this.coins = 0;

    // Power-ups (temporary)
    this.powerup    = null;
    this.powerupMs  = 0;
    this.shielded   = false;
    this.speedBoost = false;
    this.ghostMs    = 0;   // invincibility frames after capture

    // Upgrades (permanent, bought from shop)
    this.upgrades = {
      trail_speed:   0,
      capture_bonus: 0,
      shield_time:   0,
      trail_width:   0,
      radar:         0,
      magnet:        0,
      ghost:         0,
      double_coins:  0,
    };

    // Timing
    this.moveTimer    = 0;
    this.moveInterval = CONFIG.MOVE_INTERVAL;
  }

  snapPixelPos() {
    const p = Utils.hexToPixelSmooth(this.x, this.y);
    this.px = p.x; this.py = p.y;
  }

  // Frame-rate-independent lerp toward smooth target (no row-stagger zigzag)
  updateLerp(dt) {
    const target = Utils.hexToPixelSmooth(this.x, this.y);
    const f = 1 - Math.pow(1 - 0.28, dt / 16.667);
    this.px = Utils.lerp(this.px, target.x, f);
    this.py = Utils.lerp(this.py, target.y, f);
  }

  trySetDir(d) {
    if (d.x === -this.dir.x && d.y === -this.dir.y) return;
    this.dir = d;
  }

  tickPowerup(dt) {
    let expired = false;
    if (this.powerupMs > 0) {
      this.powerupMs -= dt;
      if (this.powerupMs <= 0) {
        this.powerup = null;
        this.shielded = false;
        this.speedBoost = false;
        this.moveInterval = this._baseMoveInterval();
        this.powerupMs = 0;
        expired = true;
      }
    }
    if (this.ghostMs > 0) this.ghostMs -= dt;
    return expired;
  }

  _baseMoveInterval() {
    const speedLvl = this.upgrades.trail_speed || 0;
    return CONFIG.MOVE_INTERVAL * Math.pow(0.85, speedLvl);
  }

  applyPowerup(type) {
    this.powerup   = type;
    const shieldBonus = (this.upgrades.shield_time || 0) * 4000;
    this.powerupMs = CONFIG.POWERUP_DURATION_MS + shieldBonus;
    if (type === 'speed') {
      this.speedBoost   = true;
      this.moveInterval = this._baseMoveInterval() * CONFIG.SPEED_MULTIPLIER;
    } else if (type === 'shield') {
      this.shielded = true;
    }
  }

  isInvincible() {
    return this.shielded || this.ghostMs > 0;
  }

  addCoins(n) {
    const mult = (this.upgrades.double_coins ? 2 : 1);
    this.coins += n * mult;
  }
}
