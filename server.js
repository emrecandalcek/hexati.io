// ============================================================
// server.js  —  HexDomain Multiplayer Server  v2.1
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

// ── Room registry ─────────────────────────────────────────────
// Structure:  rooms  Map<roomId, GameRoom>
// roomId format:  "<diff>_<n>"   e.g.  "easy_1", "normal_3"
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
  console.log(`[Server] ${rooms.size} rooms initialised`);
  rooms.forEach((r, id) => console.log(`  ${id}  diff=${r.diff}  bots=${r.preset.botCount}`));
}

// Auto-assign: pick the room for a difficulty with most players but still has space
function pickRoom(diff) {
  const candidates = [...rooms.values()]
    .filter(r => r.diff === diff && r.players.size < r.preset.maxPlayers);
  if (!candidates.length) return null;
  // Prefer room with most players (social), fallback to first
  return candidates.sort((a, b) => b.players.size - a.players.size)[0];
}

// ── REST API ──────────────────────────────────────────────────
app.get('/api/rooms', (_req, res) => {
  const list = [...rooms.values()].map(r => r.toInfo());
  res.json(list);
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, uptime: process.uptime() });
});

// ── Socket.io ─────────────────────────────────────────────────
io.on('connection', socket => {
  console.log(`[Socket] connect  ${socket.id}`);

  let currentRoom = null;  // GameRoom the socket is currently in

  // ── Join a room ──────────────────────────────────────────
  // Client sends: { diff, roomId?, name, color }
  //   diff   = 'easy' | 'normal' | 'hard'   (required)
  //   roomId = specific room id              (optional — auto-assign if omitted)
  socket.on('room:join', ({ diff, roomId, name, color }) => {
    // Leave previous room cleanly
    if (currentRoom) {
      currentRoom.removePlayer(socket.id);
      currentRoom = null;
    }

    // Validate difficulty
    if (!CONFIG.DIFFICULTIES[diff]) {
      socket.emit('room:error', { msg: `Geçersiz zorluk: ${diff}` });
      return;
    }

    // Pick a room
    let room;
    if (roomId && rooms.has(roomId) && rooms.get(roomId).diff === diff) {
      room = rooms.get(roomId);
      if (room.players.size >= room.preset.maxPlayers) {
        socket.emit('room:error', { msg: 'Bu oda dolu.' });
        return;
      }
    } else {
      room = pickRoom(diff);
      if (!room) {
        socket.emit('room:error', { msg: 'Tüm odalar dolu. Daha sonra tekrar dene.' });
        return;
      }
    }

    const player = room.addPlayer(socket.id, (name || 'PLAYER').toUpperCase().slice(0, 16), color);
    if (!player) {
      socket.emit('room:error', { msg: 'Odaya katılamadı.' });
      return;
    }

    currentRoom = room;
    // room:joined is confirmation (game:init comes right after from addPlayer)
    socket.emit('room:joined', {
      roomId:  room.roomId,
      diff:    room.diff,
      players: room.players.size,
    });

    console.log(`[Socket] ${socket.id} joined room ${room.roomId}  players=${room.players.size}`);
  });

  // ── Leave room (explicit) ────────────────────────────────
  socket.on('room:leave', () => {
    if (currentRoom) {
      currentRoom.removePlayer(socket.id);
      currentRoom = null;
    }
  });

  // ── Game input ───────────────────────────────────────────
  socket.on('input:dir', dir => {
    if (currentRoom) currentRoom.handleInput(socket.id, dir);
  });

  socket.on('shop:buy', ({ key }) => {
    if (currentRoom) currentRoom.handleShopBuy(socket.id, key);
  });

  socket.on('player:respawn', () => {
    if (currentRoom) currentRoom.handleRespawn(socket.id);
  });

  // ── Chat ─────────────────────────────────────────────────
  socket.on('chat:msg', ({ text }) => {
    if (!currentRoom || !text) return;
    const player = currentRoom.players.get(socket.id);
    if (!player) return;
    const safe = String(text).slice(0, 80).replace(/</g, '&lt;');
    io.to(currentRoom.roomId).emit('chat:msg', {
      name:  player.name,
      color: player.color,
      text:  safe,
    });
  });

  // ── Ping/pong (latency) ──────────────────────────────────
  socket.on('ping_check', () => socket.emit('pong_check'));

  // ── Disconnect ───────────────────────────────────────────
  socket.on('disconnect', reason => {
    console.log(`[Socket] disconnect  ${socket.id}  reason=${reason}`);
    if (currentRoom) {
      currentRoom.removePlayer(socket.id);
      currentRoom = null;
    }
  });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
initRooms();
server.listen(PORT, () => {
  console.log(`\n🎮 HexDomain Multiplayer  v${CONFIG.VERSION}`);
  console.log(`   http://localhost:${PORT}\n`);
});
