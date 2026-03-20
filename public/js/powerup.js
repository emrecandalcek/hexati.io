// ============================================================
// powerup.js — HEXATİ güçlendirici sistemi (tek oyuncu modlar)
// Spawn, expire, tip seçimi, görsel pulsating
// ============================================================
class PowerupSystem {
  constructor() {
    this.timer  = 0;
    this.active = [];  // { x, y, type, age }
    this.types  = ['speed', 'shield', 'double'];
  }

  update(dt, grid) {
    this.timer += dt;

    if (this.timer >= CONFIG.POWERUP_SPAWN_MS) {
      this.timer = 0;
      if (this.active.length < CONFIG.MAX_POWERUPS_ON_MAP) {
        this._spawn(grid);
      }
    }

    // Süre kontrolü
    for (let i = this.active.length - 1; i >= 0; i--) {
      this.active[i].age += dt;
      if (this.active[i].age >= CONFIG.POWERUP_LIFETIME_MS) {
        const { x, y, type } = this.active[i];
        const c = grid.get(x, y);
        if (c && c.powerup === type) c.powerup = null;
        this.active.splice(i, 1);
      }
    }
  }

  _spawn(grid) {
    // Haritada az bulunan tipi tercih et (dengeli dağılım)
    const typeCounts = { speed: 0, shield: 0, double: 0 };
    for (const a of this.active) typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
    const rarest = this.types.reduce((a, b) => typeCounts[a] <= typeCounts[b] ? a : b);

    for (let attempt = 0; attempt < 50; attempt++) {
      const x = Utils.randInt(2, grid.w - 2);
      const y = Utils.randInt(2, grid.h - 2);
      const c = grid.get(x, y);
      if (c && !c.owner && !c.trail && !c.powerup && !c.danger && !c.coin) {
        // %40 en nadir tip, %60 rastgele
        const type = Math.random() < 0.4 ? rarest : Utils.pick(this.types);
        c.powerup = type;
        this.active.push({ x, y, type, age: 0 });
        return;
      }
    }
  }

  // Tüm powerup'ları temizle
  clearAll(grid) {
    for (const { x, y, type } of this.active) {
      const c = grid.get(x, y);
      if (c && c.powerup === type) c.powerup = null;
    }
    this.active = [];
    this.timer  = 0;
  }

  get count() { return this.active.length; }

  // Her tipten kaç tane var
  get distribution() {
    const d = { speed: 0, shield: 0, double: 0 };
    for (const a of this.active) d[a.type] = (d[a.type] || 0) + 1;
    return d;
  }
}
