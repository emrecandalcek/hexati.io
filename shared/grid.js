// ============================================================
// shared/grid.js — Grid data structure (server + client)
// ============================================================
class Grid {
  constructor(w, h) {
    this.w = w; this.h = h;
    this._counts = new Map();
    this._dirty  = new Set();   // indices of cells changed since last flush
    this.reset();
  }

  reset() {
    this._data = new Array(this.w * this.h).fill(null).map(() => ({
      owner: null, trail: null, powerup: null, coin: 0, danger: false,
    }));
    this._counts.clear();
    this._dirty.clear();
  }

  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  get(x, y) {
    if (!this.inBounds(x, y)) return null;
    return this._data[y * this.w + x];
  }

  _idx(x, y) { return y * this.w + x; }

  _setOwner(cell, newId, idx) {
    if (cell.owner === newId) return;
    if (cell.owner) this._counts.set(cell.owner, Math.max(0, (this._counts.get(cell.owner) || 0) - 1));
    cell.owner = newId;
    if (newId) this._counts.set(newId, (this._counts.get(newId) || 0) + 1);
    if (idx !== undefined) this._dirty.add(idx);
  }

  countOwned(id) { return this._counts.get(id) || 0; }

  claimStart(cx, cy, radius, id) {
    for (let dx = -radius; dx <= radius; dx++)
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) + Math.abs(dy) > radius) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!this.inBounds(nx, ny)) continue;
        const idx = this._idx(nx, ny);
        const c = this._data[idx];
        if (c) {
          this._setOwner(c, id, idx);
          c.trail = null; c.danger = false;
          this._dirty.add(idx);
        }
      }
  }

  clearTrail(id) {
    for (let i = 0; i < this._data.length; i++) {
      if (this._data[i].trail === id) {
        this._data[i].trail = null;
        this._dirty.add(i);
      }
    }
  }

  wipeEntity(id) {
    for (let i = 0; i < this._data.length; i++) {
      const c = this._data[i];
      if (c.owner === id) { this._setOwner(c, null, i); this._dirty.add(i); }
      if (c.trail === id) { c.trail = null; this._dirty.add(i); }
    }
  }

  setTrail(x, y, id) {
    const idx = this._idx(x, y);
    const c = this._data[idx];
    if (c) { c.trail = id; this._dirty.add(idx); }
  }

  setCoin(x, y, val) {
    const idx = this._idx(x, y);
    const c = this._data[idx];
    if (c) { c.coin = val; this._dirty.add(idx); }
  }

  setPowerup(x, y, type) {
    const idx = this._idx(x, y);
    const c = this._data[idx];
    if (c) { c.powerup = type; this._dirty.add(idx); }
  }

  setDanger(x, y, val) {
    const idx = this._idx(x, y);
    const c = this._data[idx];
    if (c) { c.danger = val; this._dirty.add(idx); }
  }

  spawnDangerZones(count) {
    let placed = 0, attempts = 0;
    const cx = this.w >> 1, cy = this.h >> 1;
    while (placed < count && attempts < 300) {
      attempts++;
      const x = Utils.randInt(3, this.w - 3), y = Utils.randInt(3, this.h - 3);
      if (Math.abs(x - cx) + Math.abs(y - cy) < 15) continue;
      const idx = this._idx(x, y);
      const c = this._data[idx];
      if (c && !c.owner && !c.danger) {
        c.danger = true; this._dirty.add(idx); placed++;
      }
    }
  }

  // Returns dirty cell patches and clears dirty set
  flushDirty() {
    const patches = [];
    for (const idx of this._dirty) {
      const c = this._data[idx];
      patches.push([
        idx,
        c.owner  ? c.owner  : 0,
        c.trail  ? c.trail  : 0,
        c.powerup ? c.powerup : 0,
        c.coin   || 0,
        c.danger ? 1 : 0,
      ]);
    }
    this._dirty.clear();
    return patches;
  }

  // Apply patches from server (client-side)
  applyPatches(patches) {
    for (const [idx, owner, trail, powerup, coin, danger] of patches) {
      const c = this._data[idx];
      if (!c) continue;
      const prevOwner = c.owner;
      c.owner   = owner   || null;
      c.trail   = trail   || null;
      c.powerup = powerup || null;
      c.coin    = coin    || 0;
      c.danger  = danger  === 1;
      // Update owner counts for client
      if (prevOwner !== c.owner) {
        if (prevOwner) this._counts.set(prevOwner, Math.max(0, (this._counts.get(prevOwner) || 0) - 1));
        if (c.owner)   this._counts.set(c.owner, (this._counts.get(c.owner) || 0) + 1);
      }
    }
  }

  // Full serialisation for initial sync
  serialize() {
    return this._data.map(c => [
      c.owner   || 0,
      c.trail   || 0,
      c.powerup || 0,
      c.coin    || 0,
      c.danger  ? 1 : 0,
    ]);
  }

  deserialize(data) {
    this._counts.clear();
    for (let i = 0; i < data.length; i++) {
      const [owner, trail, powerup, coin, danger] = data[i];
      const c = this._data[i];
      c.owner   = owner   || null;
      c.trail   = trail   || null;
      c.powerup = powerup || null;
      c.coin    = coin    || 0;
      c.danger  = danger  === 1;
      if (c.owner) this._counts.set(c.owner, (this._counts.get(c.owner) || 0) + 1);
    }
  }
}

if (typeof module !== 'undefined') module.exports = Grid;
