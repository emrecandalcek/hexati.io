// ============================================================
// server.js  —  HEXATİ Multiplayer Server  v2.2
// Difficulty-based persistent rooms  |  Railway ready
// ============================================================
'use strict';

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');

const CONFIG   = require('./shared/config');
const GameRoom = require('./server/gameRoom');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors:          { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout:   20000,
  pingInterval:  10000,
  transports:    ['websocket', 'polling'],
});

// ── Static routes ─────────────────────────────────────────────
app.use('/shared', express.static(path.join(__dirname, 'shared')));
app.use(express.static(path.join(__dirname, 'public')));

// ── Geçerli yönler (input validation) ────────────────────────
const VALID_DIRS = new Set(['1,0', '-1,0', '0,1', '0,-1']);

// ── XSS koruması ─────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;');
}

// ── Room registry ─────────────────────────────────────────────
const rooms = new Map();

function initRooms() {
  for (const [diff, preset] of Object.entries(CONFIG.DIFFICULTIES)) {
    for (let n = 1; n <= preset.roomsPerDiff; n++) {
      const id   = `${diff}_${n}`;
      const room = new GameRoom(id, diff, io);
      room.start();
      rooms.set(id, room);
    }
  }
  console.log(`[Server] ${rooms.size} oda başlatıldı`);
  rooms.forEach((r, id) => console.log(`  ${id}  diff=${r.diff}  bots=${r.preset.botCount}`));
}

function pickRoom(diff) {
  const candidates = [...rooms.values()]
    .filter(r => r.diff === diff && r.players.size < r.preset.maxPlayers);
  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.players.size - a.players.size)[0];
}

// ── REST API ──────────────────────────────────────────────────
app.get('/api/rooms', (_req, res) => {
  const list = [...rooms.values()].map(r => r.toInfo());
  res.json(list);
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, uptime: process.uptime(), version: CONFIG.VERSION });
});

// ── Socket.io ─────────────────────────────────────────────────
io.on('connection', socket => {
  console.log(`[Socket] bağlandı  ${socket.id}`);

  let currentRoom = null;
  let inputCount  = 0;
  let inputWindow = Date.now();

  socket.on('room:join', (payload) => {
    if (!payload || typeof payload !== 'object') return;
    const { diff, roomId, name, color } = payload;

    if (currentRoom) { currentRoom.removePlayer(socket.id); currentRoom = null; }

    if (!CONFIG.DIFFICULTIES[diff]) {
      socket.emit('room:error', { msg: `Geçersiz zorluk: ${diff}` }); return;
    }

    const safeName  = escapeHtml((name || 'OYUNCU').toUpperCase().slice(0, 16));
    const safeColor = CONFIG.PLAYER_COLORS.includes(color) ? color : CONFIG.PLAYER_COLORS[0];

    let room;
    if (roomId && rooms.has(roomId) && rooms.get(roomId).diff === diff) {
      room = rooms.get(roomId);
      if (room.players.size >= room.preset.maxPlayers) {
        socket.emit('room:error', { msg: 'Bu oda dolu.' }); return;
      }
    } else {
      room = pickRoom(diff);
      if (!room) {
        socket.emit('room:error', { msg: 'Tüm odalar dolu. Kısa süre içinde tekrar dene.' }); return;
      }
    }

    const player = room.addPlayer(socket.id, safeName, safeColor);
    if (!player) { socket.emit('room:error', { msg: 'Odaya katılamadı.' }); return; }

    currentRoom = room;

    socket.emit('room:joined', { roomId: room.roomId, diff: room.diff, players: room.players.size });

    setImmediate(() => {
      const p = room.players.get(socket.id);
      if (!p) return;
      socket.emit('game:init', {
        myId:     p._pid || p.id,
        roomId:   room.roomId,
        diff:     room.diff,
        preset:   room.preset,
        gridData: room.grid.serialize(),
        gridW:    CONFIG.GRID_W,
        gridH:    CONFIG.GRID_H,
        entities: room.entities.map(e => e.toState()),
      });
    });

    console.log(`[Socket] ${socket.id} → oda ${room.roomId}  oyuncular=${room.players.size}`);
  });

  socket.on('room:leave', () => {
    if (currentRoom) { currentRoom.removePlayer(socket.id); currentRoom = null; }
  });

  // Rate-limit + validation
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
    if (!currentRoom || !payload || typeof payload !== 'object') return;
    const key = typeof payload.key === 'string' ? payload.key : null;
    if (!key || !CONFIG.SHOP[key]) return;
    currentRoom.handleShopBuy(socket.id, key);
  });

  socket.on('player:respawn', () => {
    if (currentRoom) currentRoom.handleRespawn(socket.id);
  });

  // Tam XSS koruması
  socket.on('chat:msg', (payload) => {
    if (!currentRoom || !payload || typeof payload !== 'object') return;
    const player = currentRoom.players.get(socket.id);
    if (!player) return;
    const raw = typeof payload.text === 'string' ? payload.text : '';
    if (!raw.trim()) return;
    const safe = escapeHtml(raw.slice(0, 80));
    io.to(currentRoom.roomId).emit('chat:msg', {
      name: player.name, color: player.color, text: safe,
    });
  });

  socket.on('ping_check', () => socket.emit('pong_check'));

  socket.on('disconnect', reason => {
    console.log(`[Socket] ayrıldı  ${socket.id}  neden=${reason}`);
    if (currentRoom) { currentRoom.removePlayer(socket.id); currentRoom = null; }
  });
});

// ── Başlat ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
initRooms();
server.listen(PORT, () => {
  console.log(`\n🎮 HEXATİ Multiplayer  v${CONFIG.VERSION}`);
  console.log(`   http://localhost:${PORT}\n`);
});
