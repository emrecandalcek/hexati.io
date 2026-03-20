// ============================================================
// server/db.js — HEXATİ JSON veritabanı
// Kullanıcılar, istatistikler, loglar, ban listesi
// ============================================================
'use strict';

const fs   = require('fs');
const path = require('path');

const DB_DIR  = path.join(__dirname, '../data');
const USERS_F = path.join(DB_DIR, 'users.json');
const LOGS_F  = path.join(DB_DIR, 'logs.json');
const STATS_F = path.join(DB_DIR, 'stats.json');
const CFG_F   = path.join(DB_DIR, 'server_config.json');

// data/ klasörü yoksa oluştur
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

function readJSON(file, def = {}) {
  try {
    if (!fs.existsSync(file)) return def;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { return def; }
}

function writeJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); return true; }
  catch { return false; }
}

// ── Kullanıcılar ─────────────────────────────────────────────
const Users = {
  getAll()         { return readJSON(USERS_F, {}); },
  get(username)    { return this.getAll()[username.toLowerCase()] || null; },
  getById(id)      { return Object.values(this.getAll()).find(u => u.id === id) || null; },

  create(username, passwordHash, email = '') {
    const all = this.getAll();
    const key = username.toLowerCase();
    if (all[key]) return null;
    const user = {
      id:          Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      username:    username,
      email:       email,
      passwordHash,
      role:        Object.keys(all).length === 0 ? 'admin' : 'player', // ilk kayıt admin
      color:       '#00d4ff',
      createdAt:   Date.now(),
      lastLogin:   null,
      lastIP:      null,
      banned:      false,
      banReason:   '',
      totalGames:  0,
      totalKills:  0,
      totalDeaths: 0,
      totalCapture:0,
      timePlayed:  0,
      bestScores:  { classic: 0, arcade: 0, survival: 0 },
      matchHistory:[],
    };
    all[key] = user;
    writeJSON(USERS_F, all);
    return user;
  },

  update(username, fields) {
    const all = this.getAll();
    const key = username.toLowerCase();
    if (!all[key]) return false;
    Object.assign(all[key], fields);
    return writeJSON(USERS_F, all);
  },

  delete(username) {
    const all = this.getAll();
    delete all[username.toLowerCase()];
    return writeJSON(USERS_F, all);
  },

  addMatchHistory(username, entry) {
    const all  = this.getAll();
    const key  = username.toLowerCase();
    if (!all[key]) return;
    const hist = all[key].matchHistory || [];
    hist.unshift({ ...entry, date: Date.now() });
    if (hist.length > 50) hist.splice(50);
    all[key].matchHistory = hist;
    // İstatistik güncelle
    all[key].totalGames   = (all[key].totalGames   || 0) + 1;
    all[key].totalKills   = (all[key].totalKills   || 0) + (entry.kills  || 0);
    all[key].totalDeaths  = (all[key].totalDeaths  || 0) + (entry.deaths || 0);
    all[key].totalCapture = (all[key].totalCapture || 0) + (entry.cells  || 0);
    all[key].timePlayed   = (all[key].timePlayed   || 0) + (entry.duration || 0);
    const mode = entry.mode;
    if (mode && entry.score > (all[key].bestScores[mode] || 0)) {
      all[key].bestScores[mode] = entry.score;
    }
    writeJSON(USERS_F, all);
  },

  count() { return Object.keys(this.getAll()).length; },
  list()  { return Object.values(this.getAll()).map(u => ({ ...u, passwordHash: undefined })); },
};

// ── Sunucu Logları ────────────────────────────────────────────
const Logs = {
  _buf: [],  // bellek tamponu (son 1000 log)

  add(level, category, message, meta = {}) {
    const entry = { id: Date.now() + Math.random(), ts: Date.now(), level, category, message, meta };
    this._buf.unshift(entry);
    if (this._buf.length > 1000) this._buf.splice(1000);
    // Dosyaya yaz (son 500)
    const saved = readJSON(LOGS_F, []);
    saved.unshift(entry);
    if (saved.length > 500) saved.splice(500);
    writeJSON(LOGS_F, saved);
    return entry;
  },

  info(cat, msg, meta)  { return this.add('info',  cat, msg, meta); },
  warn(cat, msg, meta)  { return this.add('warn',  cat, msg, meta); },
  error(cat, msg, meta) { return this.add('error', cat, msg, meta); },
  game(cat, msg, meta)  { return this.add('game',  cat, msg, meta); },

  get(limit = 100, level = null, category = null) {
    let logs = this._buf.length ? this._buf : readJSON(LOGS_F, []);
    if (level)    logs = logs.filter(l => l.level    === level);
    if (category) logs = logs.filter(l => l.category === category);
    return logs.slice(0, limit);
  },

  clear() {
    this._buf = [];
    writeJSON(LOGS_F, []);
  },
};

// ── Sunucu Config Overrides ───────────────────────────────────
const ServerConfig = {
  get()  { return readJSON(CFG_F, {}); },
  set(k, v) {
    const c = this.get();
    c[k] = v; c._updatedAt = Date.now();
    return writeJSON(CFG_F, c);
  },
  reset() { return writeJSON(CFG_F, { _updatedAt: Date.now() }); },
};

// ── Global İstatistikler ──────────────────────────────────────
const Stats = {
  get()  { return readJSON(STATS_F, { totalConnections: 0, totalGames: 0, startedAt: Date.now() }); },
  inc(field, val = 1) {
    const s = this.get();
    s[field] = (s[field] || 0) + val;
    s._updatedAt = Date.now();
    writeJSON(STATS_F, s);
  },
};

module.exports = { Users, Logs, Stats, ServerConfig };
