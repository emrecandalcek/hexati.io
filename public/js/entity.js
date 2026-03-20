// ============================================================
// entity.js — HEXATİ base entity — ZİGZAG FIX v2.2
//
// ZİGZAG KÖKENI:
//   hexToPixelSmooth → even satırlarda entity'yi hex merkezi değil
//   sağa 17px kaymış konuma çiziyordu.
//   FIX: updateLerp artık hexToPixel (gerçek hex merkezi) kullanıyor.
//   Kamera da hexToPixel ile takip ediyor; 17px yatay geçiş yumuşak
//   lerp ile (0.08 faktör) çerçeveler arasına yayılıyor → görünmez.
// ============================================================
class Entity {
  constructor(id, name, color, x, y) {
    this.id    = id;
    this.name  = name;
    this.color = color;
    this.x = x; this.y = y;

    // Piksel pozisyonu: gerçek hex merkezi (stagger dahil)
    const p = Utils.hexToPixel(x, y);
    this.px = p.x; this.py = p.y;

    this.dir     = { x: 1, y: 0 };
    this.trail   = [];
    this.outside = false;
    this.alive   = true;

    this.kills     = 0;
    this.territory = 0;
    this.coins     = 0;

    this.powerup    = null;
    this.powerupMs  = 0;
    this.shielded   = false;
    this.speedBoost = false;
    this.ghostMs    = 0;

    this.upgrades = {
      trail_speed:   0, capture_bonus: 0, shield_time: 0,
      trail_width:   0, radar: 0,         magnet:      0,
      ghost:         0, double_coins: 0,
    };

    this.moveTimer    = 0;
    this.moveInterval = CONFIG.MOVE_INTERVAL;
  }

  snapPixelPos() {
    // Gerçek hex merkezi — grid ile tam örtüşür
    const p = Utils.hexToPixel(this.x, this.y);
    this.px = p.x; this.py = p.y;
  }

  // Frame-rate bağımsız lerp — hex merkezine yumuşakça yaklaş
  // 0.22 faktörü: 190ms hareket aralığında ≥%97 yol alır, row-parity hop gizlenir
  updateLerp(dt) {
    const target = Utils.hexToPixel(this.x, this.y);
    const f = 1 - Math.pow(1 - 0.22, dt / 16.667);
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
    return CONFIG.MOVE_INTERVAL * Math.pow(0.85, this.upgrades.trail_speed || 0);
  }

  applyPowerup(type) {
    this.powerup = type;
    const bonus  = (this.upgrades.shield_time || 0) * 4000;
    this.powerupMs = CONFIG.POWERUP_DURATION_MS + bonus;
    if (type === 'speed') {
      this.speedBoost   = true;
      this.moveInterval = this._baseMoveInterval() * CONFIG.SPEED_MULTIPLIER;
    } else if (type === 'shield') {
      this.shielded = true;
    }
  }

  isInvincible() { return this.shielded || this.ghostMs > 0; }

  addCoins(n) {
    this.coins += n * (this.upgrades.double_coins ? 2 : 1);
  }
}
