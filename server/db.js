// ============================================================
// server/db.js — HEXATİ veritabanı katmanı  v2.3
// JSON flat-file + bellek cache + debounce yazma
// Restart-safe: kullanıcılar + config + session kalıcı
// ============================================================
'use strict';

const fs   = require('fs');
const path = require('path');

const DB_DIR       = path.join(__dirname, '../data');
const USERS_F      = path.join(DB_DIR, 'users.json');
const LOGS_F       = path.join(DB_DIR, 'logs.json');
const STATS_F      = path.join(DB_DIR, 'stats.json');
const CFG_F        = path.join(DB_DIR, 'server_config.json');
const SESSIONS_F   = path.join(DB_DIR, 'sessions.json');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// ── Yardımcılar ───────────────────────────────────────────────
function readJSON(file, def) {
  try {
    if (!fs.existsSync(file)) return def;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { return def; }
}

// Debounced yazma — aynı dosyaya art arda yazmaları birleştirir
const _writeTimers = new Map();
function writeJSON(file, data, delay = 0) {
  if (_writeTimers.has(file)) clearTimeout(_writeTimers.get(file));
  if (delay === 0) {
    try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); return true; }
    catch { return false; }
  }
  _writeTimers.set(file, setTimeout(() => {
    _writeTimers.delete(file);
    try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch {}
  }, delay));
  return true;
}

// ── Kullanıcılar — bellek cache ───────────────────────────────
let _usersCache = null;
let _usersDirty = false;

function getUsersCache() {
  if (!_usersCache) _usersCache = readJSON(USERS_F, {});
  return _usersCache;
}

function flushUsers() {
  if (!_usersDirty || !_usersCache) return;
  _usersDirty = false;
  writeJSON(USERS_F, _usersCache);
}

// Periyodik flush (30sn)
setInterval(flushUsers, 30000);
// Process exit'te de yaz
process.on('exit', flushUsers);
process.on('SIGINT', () => { flushUsers(); process.exit(0); });
process.on('SIGTERM', () => { flushUsers(); process.exit(0); });

const Users = {
  getAll() { return getUsersCache(); },

  get(username) {
    return getUsersCache()[username.toLowerCase()] || null;
  },

  getById(id) {
    return Object.values(getUsersCache()).find(u => u.id === id) || null;
  },

  create(username, passwordHash, email = '') {
    const all = getUsersCache();
    const key = username.toLowerCase();
    if (all[key]) return null;

    const user = {
      id:           Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      username,
      email,
      passwordHash,
      role:         Object.keys(all).length === 0 ? 'admin' : 'player',
      color:        '#00d4ff',
      createdAt:    Date.now(),
      lastLogin:    null,
      lastIP:       null,
      banned:       false,
      banReason:    '',
      totalGames:   0,
      totalKills:   0,
      totalDeaths:  0,
      totalCapture: 0,
      timePlayed:   0,
      bestScores:   { classic: 0, arcade: 0, survival: 0 },
      matchHistory: [],
    };
    all[key] = user;
    _usersDirty = true;
    flushUsers();   // Kayıt anında yaz
    return user;
  },

  update(username, fields) {
    const all = getUsersCache();
    const key = username.toLowerCase();
    if (!all[key]) return false;
    Object.assign(all[key], fields);
    _usersDirty = true;
    writeJSON(USERS_F, all, 2000); // 2sn debounce
    return true;
  },

  delete(username) {
    const all = getUsersCache();
    delete all[username.toLowerCase()];
    _usersDirty = true;
    flushUsers();
    return true;
  },

  addMatchHistory(username, entry) {
    const all = getUsersCache();
    const key = username.toLowerCase();
    if (!all[key]) return;
    const hist = all[key].matchHistory || [];
    hist.unshift({ ...entry, date: Date.now() });
    if (hist.length > 50) hist.splice(50);
    all[key].matchHistory = hist;
    all[key].totalGames   = (all[key].totalGames   || 0) + 1;
    all[key].totalKills   = (all[key].totalKills   || 0) + (entry.kills   || 0);
    all[key].totalDeaths  = (all[key].totalDeaths  || 0) + (entry.deaths  || 0);
    all[key].totalCapture = (all[key].totalCapture || 0) + (entry.cells   || 0);
    all[key].timePlayed   = (all[key].timePlayed   || 0) + (entry.duration|| 0);
    if (entry.mode && entry.score > (all[key].bestScores[entry.mode] || 0)) {
      all[key].bestScores[entry.mode] = entry.score;
    }
    _usersDirty = true;
    writeJSON(USERS_F, all, 3000); // 3sn debounce
  },

  count() { return Object.keys(getUsersCache()).length; },
  list()  {
    return Object.values(getUsersCache()).map(({ passwordHash, ...u }) => u);
  },
};

// ── Log sistemi — bellek ring buffer + toplu disk yazma ───────
const LOG_BUFFER_MAX = 2000;
const LOG_DISK_MAX   = 1000;
let   _logBuf        = readJSON(LOGS_F, []).slice(0, LOG_BUFFER_MAX);  // başlangıçta diskten yükle
let   _logDirty      = false;

// 10sn'de bir diskten farklıysa yaz
setInterval(() => {
  if (!_logDirty) return;
  _logDirty = false;
  writeJSON(LOGS_F, _logBuf.slice(0, LOG_DISK_MAX));
}, 10000);

const Logs = {
  add(level, category, message, meta = {}) {
    const entry = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      ts: Date.now(), level, category, message, meta,
    };
    _logBuf.unshift(entry);
    if (_logBuf.length > LOG_BUFFER_MAX) _logBuf.splice(LOG_BUFFER_MAX);
    _logDirty = true;
    return entry;
  },

  info(cat, msg, meta)  { return this.add('info',  cat, msg, meta); },
  warn(cat, msg, meta)  { return this.add('warn',  cat, msg, meta); },
  error(cat, msg, meta) { return this.add('error', cat, msg, meta); },
  game(cat, msg, meta)  { return this.add('game',  cat, msg, meta); },

  get(limit = 200, level = null, category = null) {
    let logs = _logBuf;
    if (level)    logs = logs.filter(l => l.level    === level);
    if (category) logs = logs.filter(l => l.category === category);
    return logs.slice(0, limit);
  },

  clear() {
    _logBuf   = [];
    _logDirty = false;
    writeJSON(LOGS_F, []);
  },
};

// ── Kalıcı session store (restart-safe) ──────────────────────
let _sessionsCache = null;

function getSessionsCache() {
  if (!_sessionsCache) {
    _sessionsCache = readJSON(SESSIONS_F, {});
    // Süresi geçmişleri temizle
    const now = Date.now();
    for (const [k, v] of Object.entries(_sessionsCache)) {
      if (v.exp < now) delete _sessionsCache[k];
    }
  }
  return _sessionsCache;
}

const SessionStore = {
  set(token, data) {
    const s = getSessionsCache();
    s[token] = data;
    writeJSON(SESSIONS_F, s, 500); // 500ms debounce
  },
  get(token) {
    const s = getSessionsCache();
    const sess = s[token];
    if (!sess) return null;
    if (sess.exp < Date.now()) { this.delete(token); return null; }
    return sess;
  },
  delete(token) {
    const s = getSessionsCache();
    delete s[token];
    writeJSON(SESSIONS_F, s, 500);
  },
  deleteAllForUser(username) {
    const s = getSessionsCache();
    for (const [k, v] of Object.entries(s)) {
      if (v.username === username) delete s[k];
    }
    writeJSON(SESSIONS_F, s, 500);
  },
  getAll() {
    const s   = getSessionsCache();
    const now = Date.now();
    return Object.entries(s)
      .filter(([, v]) => v.exp > now)
      .map(([tok, v]) => ({ ...v, tokenPreview: tok.slice(0, 8) + '...' }));
  },
  count() {
    const s   = getSessionsCache();
    const now = Date.now();
    return Object.values(s).filter(v => v.exp > now).length;
  },
};

// ── Sunucu Config ─────────────────────────────────────────────
let _cfgCache = null;

const ServerConfig = {
  get() {
    if (!_cfgCache) _cfgCache = readJSON(CFG_F, {});
    return _cfgCache;
  },
  set(k, v) {
    const c = this.get();
    c[k] = v; c._updatedAt = Date.now();
    writeJSON(CFG_F, c);
    return true;
  },
  reset() {
    _cfgCache = {};
    writeJSON(CFG_F, { _updatedAt: Date.now() });
  },
};

// ── Global İstatistikler ──────────────────────────────────────
let _statsCache = null;

const Stats = {
  get() {
    if (!_statsCache) _statsCache = readJSON(STATS_F, { startedAt: Date.now() });
    return _statsCache;
  },
  inc(field, val = 1) {
    const s = this.get();
    s[field] = (s[field] || 0) + val;
    s._updatedAt = Date.now();
    writeJSON(STATS_F, s, 5000); // 5sn debounce
  },
};

module.exports = { Users, Logs, Stats, ServerConfig, SessionStore };
