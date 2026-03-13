// ============================================================
// server.js — HexDomain Multiplayer Server
// Express + Socket.io — Railway ready
// ============================================================
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');

const GameRoom   = require('./server/gameRoom');
const CONFIG     = require('./shared/config');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors:         { origin: '*', methods: ['GET','POST'] },
  pingTimeout:  20000,
  pingInterval: 10000,
});

// ── Static files ─────────────────────────────────────────────
// Serve shared/ files at /shared/
app.use('/shared', express.static(path.join(__dirname, 'shared')));
// Serve public/ at root
app.use(express.static(path.join(__dirname, 'public')));

// ── Room manager ─────────────────────────────────────────────
const rooms   = new Map();
const MAX_ROOMS = 20;

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    if (rooms.size >= MAX_ROOMS) return null;
    const room = new GameRoom(roomId, io);
    room.start();
    rooms.set(roomId, room);
  }
  return rooms.get(roomId);
}

function cleanupRoom(roomId) {
  const room = rooms.get(roomId);
  if (room && room.isEmpty()) {
    room.stop();
    rooms.delete(roomId);
    console.log(`[Server] Room ${roomId} removed`);
  }
}

// ── REST API ─────────────────────────────────────────────────
app.get('/api/rooms', (_req, res) => {
  const list = [];
  for (const [id, room] of rooms.entries()) {
    list.push({ id, players: room.getPlayerCount(), max: CONFIG.MAX_PLAYERS_PER_ROOM });
  }
  res.json(list);
});

app.get('/api/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

// ── Socket.io ────────────────────────────────────────────────
io.on('connection', socket => {
  console.log(`[Socket] +  ${socket.id}`);
  let currentRoom = null;

  socket.on('room:join', ({ roomId, name, color }) => {
    if (currentRoom) {
      currentRoom.removePlayer(socket.id);
      cleanupRoom(currentRoom.roomId);
      currentRoom = null;
    }

    const rid  = String(roomId || 'main').slice(0, 20).replace(/[^a-zA-Z0-9_-]/g, '') || 'main';
    const room = getOrCreateRoom(rid);

    if (!room) {
      socket.emit('room:error', { msg: 'Server dolu. Lütfen daha sonra tekrar dene.' });
      return;
    }

    const player = room.addPlayer(socket.id, name, color);
    if (!player) {
      socket.emit('room:error', { msg: 'Bu oda dolu (maks 8 oyuncu).' });
      return;
    }

    currentRoom = room;
    socket.emit('room:joined', { roomId: rid, playerId: player.id });
  });

  socket.on('input:dir',     dir      => currentRoom?.handleInput(socket.id, dir));
  socket.on('shop:buy',      ({ key }) => currentRoom?.handleShopBuy(socket.id, key));
  socket.on('player:respawn',()       => currentRoom?.handleRespawn(socket.id));

  socket.on('chat:msg', ({ text }) => {
    if (!currentRoom || !text) return;
    const player = currentRoom.players.get(socket.id);
    if (!player) return;
    const safe = String(text).slice(0, 80).replace(/</g, '&lt;');
    io.to(currentRoom.roomId).emit('chat:msg', { name: player.name, color: player.color, text: safe });
  });

  socket.on('ping_check', () => socket.emit('pong_check'));

  socket.on('disconnect', () => {
    console.log(`[Socket] -  ${socket.id}`);
    if (currentRoom) {
      currentRoom.removePlayer(socket.id);
      cleanupRoom(currentRoom.roomId);
      currentRoom = null;
    }
  });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎮 HexDomain Multiplayer — v${CONFIG.VERSION}`);
  console.log(`   Listening on port ${PORT}`);
  console.log(`   http://localhost:${PORT}\n`);
});
