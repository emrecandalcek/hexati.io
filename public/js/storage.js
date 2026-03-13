// ============================================================
// storage.js — Persistent localStorage manager
// ============================================================
const Storage = {
  _k: key => `hexdomain_${key}`,

  save(key, value) {
    try { localStorage.setItem(this._k(key), JSON.stringify(value)); } catch(e) {}
  },

  load(key, def = null) {
    try {
      const v = localStorage.getItem(this._k(key));
      return v !== null ? JSON.parse(v) : def;
    } catch(e) { return def; }
  },

  del(key) {
    try { localStorage.removeItem(this._k(key)); } catch(e) {}
  },

  // ── Score management ─────────────────────────────────────
  addScore(mode, entry) {
    const scores = this.getScores(mode);
    scores.push({ ...entry, date: Date.now() });
    scores.sort((a, b) => b.score - a.score);
    scores.splice(10);
    this.save(`scores_${mode}`, scores);
  },

  getScores(mode) {
    return this.load(`scores_${mode}`, []);
  },

  clearScores(mode) {
    this.del(`scores_${mode}`);
  },

  clearAllScores() {
    ['classic','arcade','survival'].forEach(m => this.clearScores(m));
  },

  // ── Stats (cumulative) ────────────────────────────────────
  addStats(delta) {
    const s = this.getStats();
    s.gamesPlayed  = (s.gamesPlayed  || 0) + (delta.gamesPlayed  || 0);
    s.totalKills   = (s.totalKills   || 0) + (delta.totalKills   || 0);
    s.totalDeaths  = (s.totalDeaths  || 0) + (delta.totalDeaths  || 0);
    s.totalCapture = (s.totalCapture || 0) + (delta.totalCapture || 0);
    s.timePlayed   = (s.timePlayed   || 0) + (delta.timePlayed   || 0);
    this.save('stats', s);
  },

  getStats() {
    return this.load('stats', {
      gamesPlayed: 0, totalKills: 0, totalDeaths: 0,
      totalCapture: 0, timePlayed: 0,
    });
  },

  // ── Settings ─────────────────────────────────────────────
  getSettings() {
    return this.load('settings', {
      volume:     0.7,
      difficulty: 'normal',
      fpsLimit:   0,
      playerName: 'YOU',
      showFPS:    true,
      particles:  true,
    });
  },

  saveSettings(settings) {
    this.save('settings', settings);
  },
};
