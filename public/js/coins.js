// ============================================================
// coins.js — HEXATİ coin sistemi (tek oyuncu modlar)
// Spawn, expire, manyetik çekim, görsel flash
// ============================================================
class CoinSystem {
  constructor() {
    this.timer  = 0;
    this.active = [];  // { x, y, value, age }
  }

  update(dt, grid) {
    this.timer += dt;
    if (this.timer >= CONFIG.COIN_SPAWN_MS) {
      this.timer = 0;
      if (this.active.length < CONFIG.MAX_COINS) this._spawn(grid);
    }
    // Süresi dolmuş coinleri kaldır
    for (let i = this.active.length - 1; i >= 0; i--) {
      this.active[i].age += dt;
      if (this.active[i].age >= CONFIG.COIN_LIFETIME_MS) {
        const { x, y } = this.active[i];
        const c = grid.get(x, y);
        if (c) c.coin = 0;
        this.active.splice(i, 1);
      }
    }
  }

  _spawn(grid) {
    // Birden fazla değer denemesi — optimum yer bul
    for (let attempt = 0; attempt < 60; attempt++) {
      const x = Utils.randInt(2, grid.w - 2);
      const y = Utils.randInt(2, grid.h - 2);
      const c = grid.get(x, y);
      if (c && !c.owner && !c.trail && !c.coin && !c.powerup && !c.danger) {
        // Ağırlıklı rastgele değer: 1 en sık, 5 en nadir
        const value = Utils.pick([1, 1, 1, 2, 2, 3, 5]);
        c.coin = value;
        this.active.push({ x, y, value, age: 0 });
        return;
      }
    }
  }

  // Belirli bir noktadaki coini zorla topla (admin/debug)
  forceCollect(grid, x, y) {
    const c = grid.get(x, y);
    if (!c || !c.coin) return 0;
    const val = c.coin;
    c.coin = 0;
    const idx = this.active.findIndex(a => a.x === x && a.y === y);
    if (idx !== -1) this.active.splice(idx, 1);
    return val;
  }

  // Haritadaki tüm coinleri temizle
  clearAll(grid) {
    for (const { x, y } of this.active) {
      const c = grid.get(x, y);
      if (c) c.coin = 0;
    }
    this.active = [];
    this.timer  = 0;
  }

  get count() { return this.active.length; }
}
