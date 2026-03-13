// ============================================================
// coins.js — Coin spawning system
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
    // Expire old coins
    for (let i = this.active.length-1; i >= 0; i--) {
      this.active[i].age += dt;
      if (this.active[i].age >= CONFIG.COIN_LIFETIME_MS) {
        const {x,y} = this.active[i];
        const c = grid.get(x,y);
        if (c) c.coin = 0;
        this.active.splice(i,1);
      }
    }
  }

  _spawn(grid) {
    for (let attempt=0; attempt<50; attempt++) {
      const x = Utils.randInt(2, grid.w-2);
      const y = Utils.randInt(2, grid.h-2);
      const c = grid.get(x,y);
      if (c && !c.owner && !c.trail && !c.coin && !c.powerup && !c.danger) {
        const value = Utils.pick([1,1,2,2,3,5]);
        c.coin = value;
        this.active.push({x,y,value,age:0});
        return;
      }
    }
  }
}
