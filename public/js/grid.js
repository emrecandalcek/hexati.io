// ============================================================
// grid.js — Grid with O(1) counters + danger zones + coins
// ============================================================
class Grid {
  constructor(w, h) {
    this.w = w; this.h = h;
    this._counts = new Map();
    this.reset();
  }

  reset() {
    this._data = new Array(this.w * this.h).fill(null).map(() => ({
      owner:   null,
      trail:   null,
      powerup: null,
      coin:    0,
      danger:  false,
    }));
    this._counts.clear();
  }

  inBounds(x, y) { return x>=0 && y>=0 && x<this.w && y<this.h; }

  get(x, y) {
    if (!this.inBounds(x,y)) return null;
    return this._data[y*this.w+x];
  }

  _setOwner(cell, newId) {
    if (cell.owner === newId) return;
    if (cell.owner) this._counts.set(cell.owner, Math.max(0,(this._counts.get(cell.owner)||0)-1));
    cell.owner = newId;
    if (newId) this._counts.set(newId, (this._counts.get(newId)||0)+1);
  }

  countOwned(id) { return this._counts.get(id) || 0; }

  claimStart(cx, cy, radius, id) {
    for (let dx=-radius; dx<=radius; dx++)
      for (let dy=-radius; dy<=radius; dy++) {
        if (Math.abs(dx)+Math.abs(dy)>radius) continue;
        const c = this.get(cx+dx, cy+dy);
        if (c) { this._setOwner(c, id); c.trail=null; c.danger=false; }
      }
  }

  clearTrail(id) {
    for (const c of this._data) if (c.trail===id) c.trail=null;
  }

  wipeEntity(id) {
    for (const c of this._data) {
      if (c.owner===id) this._setOwner(c,null);
      if (c.trail===id) c.trail=null;
    }
  }

  // Spawn danger zones (red death hexes)
  spawnDangerZones(count) {
    let placed = 0, attempts = 0;
    const cx = this.w>>1, cy = this.h>>1;
    while (placed < count && attempts < 300) {
      attempts++;
      const x = Utils.randInt(3, this.w-3), y = Utils.randInt(3, this.h-3);
      // Keep clear of center
      if (Math.abs(x-cx)+Math.abs(y-cy) < 15) continue;
      const c = this.get(x,y);
      if (c && !c.owner && !c.danger) { c.danger=true; placed++; }
    }
  }
}
