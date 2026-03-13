// ============================================================
// powerup.js — Spawns and manages powerup tokens on the grid
// ============================================================
class PowerupSystem {
  constructor() {
    this.timer  = 0;
    this.active = [];  // { x, y, type, age }
    this.types  = ['speed', 'shield', 'double'];
  }

  update(dt, grid) {
    this.timer += dt;

    // Spawn
    if (this.timer >= CONFIG.POWERUP_SPAWN_MS) {
      this.timer = 0;
      if (this.active.length < CONFIG.MAX_POWERUPS_ON_MAP) {
        this._spawn(grid);
      }
    }

    // Age & expire
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
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = Utils.randInt(2, grid.w - 2);
      const y = Utils.randInt(2, grid.h - 2);
      const c = grid.get(x, y);
      if (c && !c.owner && !c.trail && !c.powerup) {
        const type = Utils.pick(this.types);
        c.powerup = type;
        this.active.push({ x, y, type, age: 0 });
        return;
      }
    }
  }
}
