// ============================================================
// server/gameRoom.js  —  One persistent game room
// Difficulty-aware, always running, accepts multiple players
// ============================================================
'use strict';

const CONFIG    = require('../shared/config');
const Utils     = require('../shared/utils');
const Grid      = require('../shared/grid');
const FloodFill = require('../shared/floodfill');

// Expose as globals so entity files can reach them
global.CONFIG    = CONFIG;
global.Utils     = Utils;
global.FloodFill = FloodFill;

const ServerPlayer = require('./player');
const ServerBot    = require('./bot');

class GameRoom {
  // roomId   e.g. "easy_1", "hard_2"
  // diff     difficulty key: 'easy' | 'normal' | 'hard'
  // io       Socket.io server instance
  constructor(roomId, diff, io) {
    this.roomId   = roomId;
    this.diff     = diff;
    this.preset   = CONFIG.DIFFICULTIES[diff];
    this.io       = io;

    this.grid     = new Grid(CONFIG.GRID_W, CONFIG.GRID_H);
    this.players  = new Map();   // socketId → ServerPlayer
    this.bots     = [];
    this.entities = [];          // combined for collision checks

    this._powerupTimer   = 0;
    this._coinTimer      = 0;
    this._activePowerups = [];
    this._activeCoins    = [];
    this._pendingEvents  = [];

    this._lastTick = Date.now();
    this._tickInterval      = null;
    this._broadcastInterval = null;
  }

  // ── Lifecycle ─────────────────────────────────────────────
  start() {
    this.grid.reset();
    this.grid.spawnDangerZones(this.preset.dangerZones);
    this._spawnInitialBots();
    this._lastTick = Date.now();
    this._tickInterval      = setInterval(() => this._tick(), CONFIG.TICK_RATE_MS);
    this._broadcastInterval = setInterval(() => this._broadcastState(), CONFIG.STATE_BROADCAST_MS);
    console.log(`[Room ${this.roomId}] started  diff=${this.diff}  bots=${this.preset.botCount}`);
  }

  // Rooms never stop — they run forever
  // (called only on server shutdown if needed)
  destroy() {
    clearInterval(this._tickInterval);
    clearInterval(this._broadcastInterval);
  }

  // ── Player management ─────────────────────────────────────
  addPlayer(socketId, name, color) {
    if (this.players.size >= this.preset.maxPlayers) return null;

    // Resolve color conflict
    const usedColors = new Set([
      ...[...this.players.values()].map(p => p.color),
      ...this.bots.map(b => b.color),
    ]);
    const finalColor = usedColors.has(color)
      ? (CONFIG.PLAYER_COLORS.find(c => !usedColors.has(c)) ?? color)
      : color;

    const { x, y } = this._findSpawnPos();
    const pid     = `p_${socketId.slice(0, 8)}_${Date.now().toString(36).slice(-4)}`;
    const player  = new ServerPlayer(pid, name || 'PLAYER', finalColor, x, y, socketId);
    player.moveInterval = CONFIG.MOVE_INTERVAL;

    this.grid.claimStart(x, y, CONFIG.START_AREA_RADIUS, pid);
    player.territory = this.grid.countOwned(pid);

    this.players.set(socketId, player);
    this._rebuildEntities();

    // ── Join socket.io room so broadcasts reach this client ──
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) socket.join(this.roomId);

    // ── Notify everyone else in the room ─────────────────────
    socket?.to(this.roomId).emit('game:playerJoined', { entity: player.toState() });

    console.log(`[Room ${this.roomId}] +player  ${name}  id=${pid}  total=${this.players.size}`);
    player._pid = pid;
    return player;
  }

  // Send game:init to a specific socket (called from server.js after room:joined)
  sendInitTo(socketId, socketObj) {
    const player = this.players.get(socketId);
    if (!player) {
      console.error(`[Room ${this.roomId}] sendInitTo: player not found for ${socketId}`);
      return;
    }
    this._sendInit(socketId, player._pid || player.id, socketObj);
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (!player) return;

    this.grid.wipeEntity(player.id);
    this.players.delete(socketId);
    this._rebuildEntities();

    // Leave socket.io room
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) socket.leave(this.roomId);

    this.io.to(this.roomId).emit('game:playerLeft', { id: player.id, name: player.name });
    console.log(`[Room ${this.roomId}] -player  ${player.name}  remaining=${this.players.size}`);
  }

  // ── Input handlers ────────────────────────────────────────
  handleInput(socketId, dir) {
    this.players.get(socketId)?.queueDir(dir);
  }

  handleShopBuy(socketId, key) {
    const player = this.players.get(socketId);
    if (!player) return;
    if (player.buyUpgrade(key)) {
      this.io.sockets.sockets.get(socketId)
        ?.emit('game:shopOk', { key, upgrades: player.upgrades, coins: player.coins });
    }
  }

  handleRespawn(socketId) {
    const player = this.players.get(socketId);
    if (!player || player.alive) return;
    const { x, y } = this._findSpawnPos();
    player.respawn(this.grid, x, y);
    this.io.to(this.roomId).emit('game:respawn', { entity: player.toState() });
  }

  // ── Game tick (server-authoritative logic) ────────────────
  _tick() {
    const now = Date.now();
    const dt  = Math.min(now - this._lastTick, 120);
    this._lastTick = now;

    const ents = this.entities;

    for (const player of this.players.values()) {
      const evs = player.update(dt, this.grid, ents);
      if (evs.length) this._pendingEvents.push(...evs);
    }

    for (const bot of this.bots) {
      const evs = bot.update(dt, this.grid, ents);
      if (evs.length) this._pendingEvents.push(...evs);
    }

    // Powerup spawning
    this._powerupTimer += dt;
    if (this._powerupTimer >= CONFIG.POWERUP_SPAWN_MS) {
      this._powerupTimer = 0;
      if (this._activePowerups.length < CONFIG.MAX_POWERUPS_ON_MAP) this._spawnPowerup();
    }
    this._tickPowerupExpiry(dt);

    // Coin spawning
    this._coinTimer += dt;
    if (this._coinTimer >= CONFIG.COIN_SPAWN_MS) {
      this._coinTimer = 0;
      if (this._activeCoins.length < CONFIG.MAX_COINS) this._spawnCoin();
    }
    this._tickCoinExpiry(dt);

    // Flush events to everyone in room
    if (this._pendingEvents.length > 0) {
      this.io.to(this.roomId).emit('game:events', this._pendingEvents);
      this._pendingEvents = [];
    }
  }

  // ── State broadcast ───────────────────────────────────────
  _broadcastState() {
    const patches = this.grid.flushDirty();
    this.io.to(this.roomId).emit('game:state', {
      entities: this.entities.map(e => e.toState()),
      patches,
    });
  }

  // ── Initial full snapshot ─────────────────────────────────
  _sendInit(socketId, myId, socketObj) {
    // Accept socket object directly to avoid lookup failure
    const socket = socketObj || this.io.sockets.sockets.get(socketId);
    if (!socket) {
      console.error(`[Room ${this.roomId}] _sendInit: socket not found for ${socketId}`);
      return;
    }
    socket.emit('game:init', {
      myId,
      roomId:   this.roomId,
      diff:     this.diff,
      preset:   this.preset,
      gridData: this.grid.serialize(),
      gridW:    CONFIG.GRID_W,
      gridH:    CONFIG.GRID_H,
      entities: this.entities.map(e => e.toState()),
    });
    console.log(`[Room ${this.roomId}] game:init sent to ${socketId} myId=${myId}`);
  }

  // ── Powerup helpers ───────────────────────────────────────
  _spawnPowerup() {
    const types = ['speed', 'shield', 'double'];
    for (let a = 0; a < 40; a++) {
      const x = Utils.randInt(2, CONFIG.GRID_W-2), y = Utils.randInt(2, CONFIG.GRID_H-2);
      const c = this.grid.get(x, y);
      if (c && !c.owner && !c.trail && !c.powerup && !c.danger) {
        const type = Utils.pick(types);
        this.grid.setPowerup(x, y, type);
        this._activePowerups.push({ x, y, age: 0 });
        return;
      }
    }
  }

  _tickPowerupExpiry(dt) {
    for (let i = this._activePowerups.length - 1; i >= 0; i--) {
      this._activePowerups[i].age += dt;
      if (this._activePowerups[i].age >= CONFIG.POWERUP_LIFETIME_MS) {
        const { x, y } = this._activePowerups[i];
        const c = this.grid.get(x, y);
        if (c?.powerup) this.grid.setPowerup(x, y, null);
        this._activePowerups.splice(i, 1);
      }
    }
  }

  _spawnCoin() {
    for (let a = 0; a < 50; a++) {
      const x = Utils.randInt(2, CONFIG.GRID_W-2), y = Utils.randInt(2, CONFIG.GRID_H-2);
      const c = this.grid.get(x, y);
      if (c && !c.owner && !c.trail && !c.coin && !c.powerup && !c.danger) {
        const val = Utils.pick([1, 1, 2, 2, 3, 5]);
        this.grid.setCoin(x, y, val);
        this._activeCoins.push({ x, y, age: 0 });
        return;
      }
    }
  }

  _tickCoinExpiry(dt) {
    for (let i = this._activeCoins.length - 1; i >= 0; i--) {
      this._activeCoins[i].age += dt;
      if (this._activeCoins[i].age >= CONFIG.COIN_LIFETIME_MS) {
        const { x, y } = this._activeCoins[i];
        const c = this.grid.get(x, y);
        if (c?.coin) this.grid.setCoin(x, y, 0);
        this._activeCoins.splice(i, 1);
      }
    }
  }

  // ── Bot management ────────────────────────────────────────
  _spawnInitialBots() {
    const usedColors = new Set();
    for (let i = 0; i < this.preset.botCount; i++) {
      const color = CONFIG.PLAYER_COLORS.find(c => !usedColors.has(c))
                 ?? CONFIG.PLAYER_COLORS[i % CONFIG.PLAYER_COLORS.length];
      usedColors.add(color);

      const name  = CONFIG.BOT_NAMES[i % CONFIG.BOT_NAMES.length];
      const botId = `bot_${this.roomId}_${i}`;
      const { x, y } = this._findSpawnPos();

      const bot = new ServerBot(botId, name, color, x, y, this.preset.botSpeedMult);
      bot.dir       = Utils.pick(Utils.DIRS);
      bot.respawnCb = b => this._respawnBot(b);

      this.grid.claimStart(x, y, CONFIG.START_AREA_RADIUS, botId);
      bot.territory = this.grid.countOwned(botId);
      this.bots.push(bot);
    }
    this._rebuildEntities();
  }

  _respawnBot(bot) {
    const delay = this.preset.botRespawnDelay ?? CONFIG.BOT_RESPAWN_DELAY;
    setTimeout(() => {
      const { x, y } = this._findSpawnPos();
      bot.x = x; bot.y = y;
      bot.dir       = Utils.pick(Utils.DIRS);
      bot.trail     = [];
      bot.outside   = false;
      bot.alive     = true;
      bot.state     = 'expand';
      bot.moveTimer = 0;
      this.grid.claimStart(x, y, CONFIG.START_AREA_RADIUS, bot.id);
      bot.territory = this.grid.countOwned(bot.id);
    }, delay);
  }

  // ── Helpers ───────────────────────────────────────────────
  _findSpawnPos() {
    const cx = CONFIG.GRID_W >> 1, cy = CONFIG.GRID_H >> 1;
    for (let a = 0; a < 200; a++) {
      const x = Utils.randInt(4, CONFIG.GRID_W - 4);
      const y = Utils.randInt(4, CONFIG.GRID_H - 4);
      if (Utils.dist({ x, y }, { x: cx, y: cy }) > 10
          && !this.grid.get(x, y)?.owner) return { x, y };
    }
    return { x: Utils.randInt(4, CONFIG.GRID_W-4), y: Utils.randInt(4, CONFIG.GRID_H-4) };
  }

  _rebuildEntities() {
    this.entities = [...this.players.values(), ...this.bots];
  }

  getPlayerCount() { return this.players.size; }

  toInfo() {
    return {
      roomId:   this.roomId,
      diff:     this.diff,
      label:    this.preset.label,
      color:    this.preset.color,
      icon:     this.preset.icon,
      players:  this.players.size,
      max:      this.preset.maxPlayers,
      bots:     this.bots.filter(b => b.alive).length,
    };
  }
}

module.exports = GameRoom;
