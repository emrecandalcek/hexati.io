// ============================================================
// server.js — HEXATİ Multiplayer Server  v2.3
// Auth + Admin Panel + Profile sistemi eklendi
// ============================================================
'use strict';

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const crypto     = require('crypto');
const cookieParser = require('cookie-parser');

const CONFIG      = require('./shared/config');
const GameRoom    = require('./server/gameRoom');
const Auth        = require('./server/auth');
const { Users, Logs, Stats, ServerConfig } = require('./server/db');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors:         { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout:  20000,
  pingInterval: 10000,
  transports:   ['websocket', 'polling'],
});

// ── Middleware ────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(Auth.middleware);

// ── Static routes ─────────────────────────────────────────────
app.use('/shared', express.static(path.join(__dirname, 'shared')));
app.use(express.static(path.join(__dirname, 'public')));

// ── Validation & security ─────────────────────────────────────
const VALID_DIRS  = new Set(['1,0', '-1,0', '0,1', '0,-1']);
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

// ── Room registry ─────────────────────────────────────────────
const rooms        = new Map();
let   configOverrides = {};

function applyConfigOverrides() {
  const ov = ServerConfig.get();
  for (const [k, v] of Object.entries(ov)) {
    if (k.startsWith('_')) continue;
    if (CONFIG[k] !== undefined) CONFIG[k] = v;
  }
}

function initRooms() {
  applyConfigOverrides();
  for (const [diff, preset] of Object.entries(CONFIG.DIFFICULTIES)) {
    for (let n = 1; n <= preset.roomsPerDiff; n++) {
      const id   = `${diff}_${n}`;
      const room = new GameRoom(id, diff, io);
      room.start();
      rooms.set(id, room);
    }
  }
  Logs.info('server', `${rooms.size} oda başlatıldı`);
  console.log(`[Server] ${rooms.size} oda başlatıldı`);
}

function pickRoom(diff) {
  const candidates = [...rooms.values()]
    .filter(r => r.diff === diff && r.players.size < r.preset.maxPlayers && !r._closed);
  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.players.size - a.players.size)[0];
}

// ══════════════════════════════════════════════════════════════
// AUTH API
// ══════════════════════════════════════════════════════════════

// Kayıt
app.post('/api/auth/register', async (req, res) => {
  const { username, password, email } = req.body || {};
  if (!username || !password) return res.json({ ok: false, error: 'Kullanıcı adı ve şifre zorunlu' });
  if (username.length < 3 || username.length > 20) return res.json({ ok: false, error: 'İsim 3-20 karakter olmalı' });
  if (password.length < 6) return res.json({ ok: false, error: 'Şifre en az 6 karakter' });
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.json({ ok: false, error: 'Sadece harf, rakam ve _' });

  const hash = await Auth.hashPassword(password);
  const user = Users.create(username, hash, email || '');
  if (!user) return res.json({ ok: false, error: 'Bu kullanıcı adı zaten alınmış' });

  const token = Auth.generateToken(user.username, user.role);
  Users.update(username, { lastLogin: Date.now(), lastIP: req.ip });
  Logs.info('auth', `Yeni kayıt: ${username} (${user.role})`);

  res.cookie('hexati_token', token, { httpOnly: true, maxAge: 7*24*3600*1000 });
  res.json({ ok: true, token, user: sanitizeUser(user) });
});

// Giriş
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.json({ ok: false, error: 'Bilgiler eksik' });

  const user = Users.get(username);
  if (!user) return res.json({ ok: false, error: 'Kullanıcı bulunamadı' });
  if (user.banned) return res.json({ ok: false, error: `Hesabınız yasaklandı: ${user.banReason}` });

  const ok = await Auth.verifyPassword(password, user.passwordHash);
  if (!ok) {
    Logs.warn('auth', `Başarısız giriş: ${username} IP:${req.ip}`);
    return res.json({ ok: false, error: 'Şifre yanlış' });
  }

  const token = Auth.generateToken(user.username, user.role);
  Users.update(username, { lastLogin: Date.now(), lastIP: req.ip });
  Logs.info('auth', `Giriş: ${username} (${user.role})`);
  Stats.inc('totalConnections');

  res.cookie('hexati_token', token, { httpOnly: true, maxAge: 7*24*3600*1000 });
  res.json({ ok: true, token, user: sanitizeUser(user) });
});

// Çıkış
app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.hexati_token;
  if (token) Auth.revokeToken(token);
  res.clearCookie('hexati_token');
  res.json({ ok: true });
});

// Mevcut kullanıcı
app.get('/api/auth/me', Auth.requireAuth, (req, res) => {
  const user = Users.get(req.session_user.username);
  if (!user) return res.json({ ok: false });
  res.json({ ok: true, user: sanitizeUser(user) });
});

// ── Profil ────────────────────────────────────────────────────
app.get('/api/profile/:username', (req, res) => {
  const user = Users.get(req.params.username);
  if (!user) return res.json({ ok: false, error: 'Bulunamadı' });
  res.json({ ok: true, user: sanitizeUser(user) });
});

app.post('/api/profile/update', Auth.requireAuth, async (req, res) => {
  const { color, email, newPassword, currentPassword } = req.body || {};
  const user = Users.get(req.session_user.username);
  if (!user) return res.json({ ok: false });

  const updates = {};
  if (color && CONFIG.PLAYER_COLORS.includes(color)) updates.color = color;
  if (email) updates.email = email.slice(0, 100);

  if (newPassword) {
    if (newPassword.length < 6) return res.json({ ok: false, error: 'Yeni şifre en az 6 karakter' });
    const ok = await Auth.verifyPassword(currentPassword || '', user.passwordHash);
    if (!ok) return res.json({ ok: false, error: 'Mevcut şifre yanlış' });
    updates.passwordHash = await Auth.hashPassword(newPassword);
  }

  Users.update(req.session_user.username, updates);
  res.json({ ok: true });
});

// Skor kaydet (oyun sonrası)
app.post('/api/profile/score', Auth.requireAuth, (req, res) => {
  const { mode, score, kills, deaths, cells, duration } = req.body || {};
  if (!mode) return res.json({ ok: false });
  Users.addMatchHistory(req.session_user.username, { mode, score, kills, deaths, cells, duration });
  res.json({ ok: true });
});

// ── Public API ────────────────────────────────────────────────
app.get('/api/rooms', (_req, res) => {
  res.json([...rooms.values()].map(r => r.toInfo()));
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, uptime: process.uptime(), version: CONFIG.VERSION });
});

app.get('/api/leaderboard', (_req, res) => {
  const users = Users.list()
    .sort((a, b) => (b.totalKills - a.totalKills))
    .slice(0, 50)
    .map((u, i) => ({
      rank: i + 1, username: u.username, color: u.color,
      totalKills: u.totalKills, totalGames: u.totalGames,
      bestClassic: u.bestScores?.classic || 0,
    }));
  res.json(users);
});

// ══════════════════════════════════════════════════════════════
// ADMIN API — Tümü /api/admin/* — requireAdmin
// ══════════════════════════════════════════════════════════════

// Genel durum
app.get('/api/admin/dashboard', Auth.requireAdmin, (_req, res) => {
  const roomList = [...rooms.values()].map(r => r.toInfo());
  const totalPlayers = roomList.reduce((s, r) => s + r.players, 0);
  const dbStats = Stats.get();
  res.json({
    server: {
      uptime:    process.uptime(),
      memory:    process.memoryUsage(),
      nodeVer:   process.version,
      platform:  process.platform,
      version:   CONFIG.VERSION,
    },
    rooms: { total: rooms.size, active: roomList.filter(r => r.players > 0).length, list: roomList },
    players: { online: totalPlayers, registered: Users.count(), sessions: Auth.activeSessionCount() },
    stats:   dbStats,
    config:  { TICK_RATE_MS: CONFIG.TICK_RATE_MS, STATE_BROADCAST_MS: CONFIG.STATE_BROADCAST_MS,
               MOVE_INTERVAL: CONFIG.MOVE_INTERVAL, BOT_MOVE_BASE: CONFIG.BOT_MOVE_BASE,
               MAX_COINS: CONFIG.MAX_COINS, DANGER_ZONE_COUNT: CONFIG.DANGER_ZONE_COUNT },
  });
});

// ── Oda yönetimi ──────────────────────────────────────────────
app.get('/api/admin/rooms', Auth.requireAdmin, (_req, res) => {
  const list = [...rooms.entries()].map(([id, r]) => ({
    ...r.toInfo(),
    closed:   r._closed || false,
    tickRate: CONFIG.TICK_RATE_MS,
    entities: r.entities.length,
    activePowerups: r._activePowerups?.length || 0,
    activeCoins:    r._activeCoins?.length    || 0,
    players_detail: [...r.players.values()].map(p => ({
      id: p.id, name: p.name, color: p.color,
      kills: p.kills, territory: p.territory, coins: p.coins, alive: p.alive,
    })),
  }));
  res.json(list);
});

// Odayı kapat/aç
app.post('/api/admin/rooms/:id/toggle', Auth.requireAdmin, (req, res) => {
  const room = rooms.get(req.params.id);
  if (!room) return res.json({ ok: false, error: 'Oda bulunamadı' });
  room._closed = !room._closed;
  if (room._closed) {
    // Tüm oyuncuları at
    for (const sid of room.players.keys()) {
      const sock = io.sockets.sockets.get(sid);
      sock?.emit('room:error', { msg: 'Bu oda yönetici tarafından kapatıldı.' });
    }
    io.to(room.roomId).emit('server:announcement', { msg: '⚠ Bu oda kapatıldı.' });
    Logs.warn('admin', `Oda kapatıldı: ${room.roomId}`);
  } else {
    Logs.info('admin', `Oda açıldı: ${room.roomId}`);
  }
  res.json({ ok: true, closed: room._closed });
});

// Odaya bot ekle
app.post('/api/admin/rooms/:id/addbot', Auth.requireAdmin, (req, res) => {
  const room = rooms.get(req.params.id);
  if (!room) return res.json({ ok: false, error: 'Oda yok' });
  room._spawnExtraBot && room._spawnExtraBot();
  Logs.info('admin', `Bot eklendi: ${room.roomId}`);
  res.json({ ok: true });
});

// Odadaki tüm botları kaldır
app.post('/api/admin/rooms/:id/clearbots', Auth.requireAdmin, (req, res) => {
  const room = rooms.get(req.params.id);
  if (!room) return res.json({ ok: false });
  for (const bot of room.bots) {
    bot.alive = false;
    room.grid.wipeEntity(bot.id);
  }
  room.bots = [];
  room._rebuildEntities();
  Logs.info('admin', `Botlar temizlendi: ${room.roomId}`);
  res.json({ ok: true });
});

// Odayı sıfırla (grid + botlar)
app.post('/api/admin/rooms/:id/reset', Auth.requireAdmin, (req, res) => {
  const room = rooms.get(req.params.id);
  if (!room) return res.json({ ok: false });
  // Oyuncuları bilgilendir
  io.to(room.roomId).emit('server:announcement', { msg: '🔄 Oda sıfırlanıyor...' });
  setTimeout(() => {
    room.grid.reset();
    room.grid.spawnDangerZones(room.preset.dangerZones);
    room.bots = [];
    room._activePowerups = [];
    room._activeCoins    = [];
    room._spawnInitialBots();
    for (const [sid, player] of room.players) {
      const pos = room._findSpawnPos();
      player.respawn(room.grid, pos.x, pos.y);
    }
    io.to(room.roomId).emit('server:reload', {});
    Logs.info('admin', `Oda sıfırlandı: ${room.roomId}`);
  }, 2000);
  res.json({ ok: true });
});

// Sunucu duyurusu (tüm odalara)
app.post('/api/admin/announce', Auth.requireAdmin, (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.json({ ok: false });
  io.emit('server:announcement', { msg: escapeHtml(message.slice(0, 200)) });
  Logs.info('admin', `Duyuru: ${message}`);
  res.json({ ok: true });
});

// ── Oyuncu yönetimi ───────────────────────────────────────────
app.get('/api/admin/players', Auth.requireAdmin, (_req, res) => {
  const users = Users.list();
  // Online durumu ekle
  const onlineNames = new Set();
  for (const room of rooms.values()) {
    for (const p of room.players.values()) onlineNames.add(p.name.toLowerCase());
  }
  const result = users.map(u => ({
    ...u,
    online: onlineNames.has(u.username.toLowerCase()),
  }));
  res.json(result);
});

app.get('/api/admin/players/:username', Auth.requireAdmin, (req, res) => {
  const user = Users.get(req.params.username);
  if (!user) return res.json({ ok: false, error: 'Yok' });
  // Online mu?
  let onlineIn = null;
  for (const room of rooms.values()) {
    for (const p of room.players.values()) {
      if (p.name.toLowerCase() === req.params.username.toLowerCase()) {
        onlineIn = room.roomId;
      }
    }
  }
  res.json({ ok: true, user: sanitizeUser(user), onlineIn });
});

// Oyuncuyu kickle (odadan at)
app.post('/api/admin/players/:username/kick', Auth.requireAdmin, (req, res) => {
  const { reason } = req.body || {};
  let kicked = false;
  for (const room of rooms.values()) {
    for (const [sid, p] of room.players) {
      if (p.name.toLowerCase() === req.params.username.toLowerCase()) {
        const sock = io.sockets.sockets.get(sid);
        sock?.emit('room:error', { msg: `Kicklendi: ${reason || 'Yönetici kararı'}` });
        sock?.disconnect(true);
        room.removePlayer(sid);
        kicked = true;
      }
    }
  }
  Logs.warn('admin', `Kick: ${req.params.username} — ${reason || '-'}`);
  res.json({ ok: true, kicked });
});

// Yasakla/yasağı kaldır
app.post('/api/admin/players/:username/ban', Auth.requireAdmin, (req, res) => {
  const { reason } = req.body || {};
  const user = Users.get(req.params.username);
  if (!user) return res.json({ ok: false, error: 'Yok' });
  if (user.role === 'admin') return res.json({ ok: false, error: 'Admin yasaklanamaz' });
  Users.update(req.params.username, { banned: true, banReason: reason || 'Kural ihlali' });
  Auth.revokeAllForUser(req.params.username);
  Logs.warn('admin', `Banlama: ${req.params.username} — ${reason}`);
  res.json({ ok: true });
});

app.post('/api/admin/players/:username/unban', Auth.requireAdmin, (req, res) => {
  Users.update(req.params.username, { banned: false, banReason: '' });
  Logs.info('admin', `Ban kaldırıldı: ${req.params.username}`);
  res.json({ ok: true });
});

// Rol değiştir
app.post('/api/admin/players/:username/role', Auth.requireAdmin, (req, res) => {
  const { role } = req.body || {};
  if (!['admin','moderator','player'].includes(role)) return res.json({ ok: false });
  Users.update(req.params.username, { role });
  Auth.revokeAllForUser(req.params.username); // yeniden giriş gerektirir
  Logs.info('admin', `Rol değişti: ${req.params.username} → ${role}`);
  res.json({ ok: true });
});

// Oyuncu istatistiklerini sıfırla
app.post('/api/admin/players/:username/resetstats', Auth.requireAdmin, (req, res) => {
  Users.update(req.params.username, {
    totalGames: 0, totalKills: 0, totalDeaths: 0,
    totalCapture: 0, timePlayed: 0,
    bestScores: { classic: 0, arcade: 0, survival: 0 },
    matchHistory: [],
  });
  Logs.info('admin', `İstatistik sıfırlandı: ${req.params.username}`);
  res.json({ ok: true });
});

// Oyuncuyu sil
app.delete('/api/admin/players/:username', Auth.requireAdmin, (req, res) => {
  if (req.session_user.username === req.params.username) return res.json({ ok: false, error: 'Kendinizi silemezsiniz' });
  Users.delete(req.params.username);
  Logs.warn('admin', `Hesap silindi: ${req.params.username}`);
  res.json({ ok: true });
});

// ── Config yönetimi ───────────────────────────────────────────
app.get('/api/admin/config', Auth.requireAdmin, (_req, res) => {
  res.json({
    live:   { ...CONFIG },
    saved:  ServerConfig.get(),
    fields: [
      { key:'TICK_RATE_MS',         label:'Tick Hızı (ms)',         type:'number', min:20,  max:200 },
      { key:'STATE_BROADCAST_MS',   label:'State Yayını (ms)',       type:'number', min:50,  max:500 },
      { key:'MOVE_INTERVAL',        label:'Oyuncu Hızı (ms)',        type:'number', min:80,  max:400 },
      { key:'BOT_MOVE_BASE',        label:'Bot Hızı (ms)',           type:'number', min:80,  max:400 },
      { key:'BOT_RESPAWN_DELAY',    label:'Bot Respawn (ms)',        type:'number', min:500, max:15000 },
      { key:'MAX_TRAIL',            label:'Maks Trail Uzunluğu',     type:'number', min:20,  max:500 },
      { key:'POWERUP_SPAWN_MS',     label:'Powerup Spawn (ms)',      type:'number', min:2000,max:60000 },
      { key:'POWERUP_LIFETIME_MS',  label:'Powerup Ömrü (ms)',       type:'number', min:5000,max:60000 },
      { key:'COIN_SPAWN_MS',        label:'Coin Spawn (ms)',         type:'number', min:1000,max:30000 },
      { key:'MAX_COINS',            label:'Maks Coin Sayısı',        type:'number', min:0,   max:100 },
      { key:'DANGER_ZONE_COUNT',    label:'Tehlike Bölgesi Sayısı',  type:'number', min:0,   max:50 },
      { key:'MAX_POWERUPS_ON_MAP',  label:'Maks Powerup Haritada',   type:'number', min:0,   max:20 },
      { key:'COIN_KILL_VALUE',      label:'Kill Coin Değeri',        type:'number', min:0,   max:100 },
      { key:'COIN_CAPTURE_BONUS',   label:'Capture Coin Bonusu',     type:'number', min:0,   max:20 },
    ],
  });
});

app.post('/api/admin/config', Auth.requireAdmin, (req, res) => {
  const { key, value } = req.body || {};
  if (!key || value === undefined) return res.json({ ok: false });
  const num = parseFloat(value);
  if (isNaN(num)) return res.json({ ok: false, error: 'Geçersiz değer' });
  CONFIG[key] = num;
  ServerConfig.set(key, num);
  Logs.info('admin', `Config değişti: ${key} = ${num}`);
  res.json({ ok: true, key, value: num });
});

app.post('/api/admin/config/reset', Auth.requireAdmin, (_req, res) => {
  ServerConfig.reset();
  Logs.info('admin', 'Config sıfırlandı');
  res.json({ ok: true });
});

// ── Loglar ────────────────────────────────────────────────────
app.get('/api/admin/logs', Auth.requireAdmin, (req, res) => {
  const { limit = 200, level, category } = req.query;
  res.json(Logs.get(parseInt(limit), level || null, category || null));
});

app.delete('/api/admin/logs', Auth.requireAdmin, (_req, res) => {
  Logs.clear();
  res.json({ ok: true });
});

// ── Live monitor ──────────────────────────────────────────────
app.get('/api/admin/live', Auth.requireAdmin, (_req, res) => {
  const data = [...rooms.values()].map(r => ({
    roomId:   r.roomId,
    diff:     r.diff,
    closed:   r._closed || false,
    players:  [...r.players.values()].map(p => ({
      id: p.id, name: p.name, color: p.color,
      x: p.x, y: p.y, alive: p.alive, kills: p.kills,
      territory: p.territory, coins: p.coins,
      outside: p.outside, trailLen: p.trail?.length || 0,
      upgrades: p.upgrades, powerup: p.powerup,
    })),
    bots: r.bots.map(b => ({
      id: b.id, name: b.name, color: b.color,
      alive: b.alive, territory: b.territory, state: b.state,
    })),
    powerups: r._activePowerups?.length || 0,
    coins:    r._activeCoins?.length    || 0,
  }));
  res.json(data);
});

// ── Aktif oturumlar ───────────────────────────────────────────
app.get('/api/admin/sessions', Auth.requireAdmin, (_req, res) => {
  res.json(Auth.getActiveSessions());
});

app.post('/api/admin/sessions/revoke/:username', Auth.requireAdmin, (req, res) => {
  Auth.revokeAllForUser(req.params.username);
  res.json({ ok: true });
});

// ── Socket.io ─────────────────────────────────────────────────
io.on('connection', socket => {
  Logs.game('socket', `Bağlandı: ${socket.id}`);
  Stats.inc('totalConnections');

  let currentRoom = null;
  let inputCount  = 0;
  let inputWindow = Date.now();

  socket.on('room:join', (payload) => {
    if (!payload || typeof payload !== 'object') return;
    const { diff, roomId, name, color } = payload;

    if (currentRoom) { currentRoom.removePlayer(socket.id); currentRoom = null; }
    if (!CONFIG.DIFFICULTIES[diff]) { socket.emit('room:error', { msg: `Geçersiz zorluk: ${diff}` }); return; }

    const safeName  = escapeHtml((name || 'OYUNCU').toUpperCase().slice(0, 16));
    const safeColor = CONFIG.PLAYER_COLORS.includes(color) ? color : CONFIG.PLAYER_COLORS[0];

    let room;
    if (roomId && rooms.has(roomId) && rooms.get(roomId).diff === diff) {
      room = rooms.get(roomId);
      if (room._closed) { socket.emit('room:error', { msg: 'Bu oda kapatılmış.' }); return; }
      if (room.players.size >= room.preset.maxPlayers) { socket.emit('room:error', { msg: 'Oda dolu.' }); return; }
    } else {
      room = pickRoom(diff);
      if (!room) { socket.emit('room:error', { msg: 'Tüm odalar dolu.' }); return; }
    }

    const player = room.addPlayer(socket.id, safeName, safeColor);
    if (!player) { socket.emit('room:error', { msg: 'Katılamadı.' }); return; }

    currentRoom = room;
    Stats.inc('totalGames');
    Logs.game('join', `${safeName} → ${room.roomId}`);

    socket.emit('room:joined', { roomId: room.roomId, diff: room.diff, players: room.players.size });
    setImmediate(() => {
      const p = room.players.get(socket.id);
      if (!p) return;
      socket.emit('game:init', {
        myId: p._pid || p.id, roomId: room.roomId, diff: room.diff,
        preset: room.preset, gridData: room.grid.serialize(),
        gridW: CONFIG.GRID_W, gridH: CONFIG.GRID_H,
        entities: room.entities.map(e => e.toState()),
      });
    });
  });

  socket.on('room:leave', () => {
    if (currentRoom) { currentRoom.removePlayer(socket.id); currentRoom = null; }
  });

  socket.on('input:dir', dir => {
    if (!currentRoom || !dir || typeof dir !== 'object') return;
    if (typeof dir.x !== 'number' || typeof dir.y !== 'number') return;
    if (!VALID_DIRS.has(`${dir.x},${dir.y}`)) return;
    const now = Date.now();
    if (now - inputWindow > 200) { inputCount = 0; inputWindow = now; }
    if (++inputCount > 10) return;
    currentRoom.handleInput(socket.id, { x: dir.x, y: dir.y });
  });

  socket.on('shop:buy', (payload) => {
    if (!currentRoom || !payload) return;
    const key = typeof payload.key === 'string' ? payload.key : null;
    if (!key || !CONFIG.SHOP[key]) return;
    currentRoom.handleShopBuy(socket.id, key);
  });

  socket.on('player:respawn', () => { if (currentRoom) currentRoom.handleRespawn(socket.id); });

  socket.on('chat:msg', (payload) => {
    if (!currentRoom || !payload) return;
    const player = currentRoom.players.get(socket.id);
    if (!player) return;
    const raw = typeof payload.text === 'string' ? payload.text : '';
    if (!raw.trim()) return;
    const safe = escapeHtml(raw.slice(0, 80));
    io.to(currentRoom.roomId).emit('chat:msg', { name: player.name, color: player.color, text: safe });
    Logs.game('chat', `[${currentRoom.roomId}] ${player.name}: ${safe}`);
  });

  socket.on('ping_check', () => socket.emit('pong_check'));

  socket.on('disconnect', reason => {
    Logs.game('socket', `Ayrıldı: ${socket.id} (${reason})`);
    if (currentRoom) { currentRoom.removePlayer(socket.id); currentRoom = null; }
  });
});

// ── Yardımcı ─────────────────────────────────────────────────
function sanitizeUser(u) {
  const { passwordHash, ...safe } = u;
  return safe;
}

// ── Başlat ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
initRooms();
server.listen(PORT, () => {
  console.log(`\n🎮 HEXATİ Multiplayer  v${CONFIG.VERSION}`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Admin: http://localhost:${PORT}/admin.html\n`);
});
