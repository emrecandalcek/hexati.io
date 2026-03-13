// ============================================================
// server/gameRoom.js — One game session (room)
// ============================================================
const CONFIG    = require('../shared/config');
const Utils     = require('../shared/utils');
const Grid      = require('../shared/grid');
const FloodFill = require('../shared/floodfill');

// Make globals available inside entity files
global.CONFIG    = CONFIG;
global.Utils     = Utils;
global.FloodFill = FloodFill;

const ServerPlayer = require('./player');
const ServerBot    = require('./bot');

class GameRoom {
  constructor(roomId, io) {
    this.roomId   = roomId;
    this.io       = io;
    this.grid     = new Grid(CONFIG.GRID_W, CONFIG.GRID_H);
    this.players  = new Map();   // socketId → ServerPlayer
    this.bots     = [];
    this.entities = [];          // players + bots combined

    this.running  = false;
    this._tick    = null;
    this._broadcastTick = null;

    this._powerupTimer = 0;
    this._coinTimer    = 0;
    this._activeCoins  = [];
    this._activePowerups = [];

    this._lastTick = Date.now();
    this._events   = [];          // queued events to broadcast
  }

  // ── Lifecycle ─────────────────────────────────────────────
  start() {
    this.grid.reset();
    this.grid.spawnDangerZones(CONFIG.DANGER_ZONE_COUNT);
    this._spawnBots();
    this.running = true;
    this._lastTick = Date.now();
    this._tick = setInterval(() => this._update(), CONFIG.TICK_RATE_MS);
    this._broadcastTick = setInterval(() => this._broadcastState(), CONFIG.STATE_BROADCAST_MS);
    console.log(`[Room ${this.roomId}] Started`);
  }

  stop() {
    this.running = false;
    clearInterval(this._tick);
    clearInterval(this._broadcastTick);
    console.log(`[Room ${this.roomId}] Stopped`);
  }

  isEmpty() { return this.players.size === 0; }

  // ── Player join / leave ───────────────────────────────────
  addPlayer(socketId, name, color) {
    if (this.players.size >= CONFIG.MAX_PLAYERS_PER_ROOM) return null;

    const usedColors = new Set([...this.players.values()].map(p=>p.color).concat(this.bots.map(b=>b.color)));
    const finalColor = usedColors.has(color)
      ? CONFIG.PLAYER_COLORS.find(c => !usedColors.has(c)) ?? color
      : color;

    const { x, y } = this._findSpawnPos();
    const pid = `p_${socketId.slice(0,8)}`;
    const player = new ServerPlayer(pid, name || 'UNKNOWN', finalColor, x, y, socketId);
    player.moveInterval = CONFIG.MOVE_INTERVAL;

    this.grid.claimStart(x, y, CONFIG.START_AREA_RADIUS, pid);
    player.territory = this.grid.countOwned(pid);
    this.players.set(socketId, player);
    this._rebuildEntities();

    // Send full initial state to this player
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.join(this.roomId);
      socket.emit('game:init', {
        myId:     pid,
        gridData: this.grid.serialize(),
        gridW:    CONFIG.GRID_W,
        gridH:    CONFIG.GRID_H,
        entities: this._allEntityStates(),
        config:   { HEX_SIZE: CONFIG.HEX_SIZE },
      });
    }

    // Tell everyone else a player joined
    this.io.to(this.roomId).except(socketId).emit('game:playerJoined', { entity: player.toState() });
    console.log(`[Room ${this.roomId}] Player joined: ${name} (${pid})`);
    return player;
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (!player) return;
    this.grid.wipeEntity(player.id);
    this.players.delete(socketId);
    this._rebuildEntities();
    this.io.to(this.roomId).emit('game:playerLeft', { id: player.id });
    console.log(`[Room ${this.roomId}] Player left: ${player.name}`);
    if (this.isEmpty()) this.stop();
  }

  // ── Input from client ─────────────────────────────────────
  handleInput(socketId, dir) {
    const player = this.players.get(socketId);
    if (player) player.queueDir(dir);
  }

  handleShopBuy(socketId, key) {
    const player = this.players.get(socketId);
    if (!player) return;
    if (player.buyUpgrade(key)) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) socket.emit('game:shopOk', { key, upgrades: player.upgrades, coins: player.coins });
    }
  }

  handleRespawn(socketId) {
    const player = this.players.get(socketId);
    if (!player || player.alive) return;
    const { x, y } = this._findSpawnPos();
    player.respawn(this.grid, x, y);
    this.io.to(this.roomId).emit('game:respawn', { entity: player.toState() });
  }

  // ── Game loop ─────────────────────────────────────────────
  _update() {
    if (!this.running) return;
    const now = Date.now();
    const dt  = Math.min(now - this._lastTick, 120);
    this._lastTick = now;

    const allEntities = this.entities;

    // Update players
    for (const player of this.players.values()) {
      const evs = player.update(dt, this.grid, allEntities, this);
      this._events.push(...evs);
    }

    // Update bots
    for (const bot of this.bots) {
      const evs = bot.update(dt, this.grid, allEntities, this);
      this._events.push(...evs);
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

    // Flush events immediately
    if (this._events.length > 0) {
      this.io.to(this.roomId).emit('game:events', this._events);
      this._events = [];
    }
  }

  _broadcastState() {
    if (!this.running) return;
    const patches = this.grid.flushDirty();
    this.io.to(this.roomId).emit('game:state', {
      entities: this._allEntityStates(),
      patches,
    });
  }

  // ── Powerup / Coin systems ────────────────────────────────
  _spawnPowerup() {
    const types = ['speed', 'shield', 'double'];
    for (let a = 0; a < 40; a++) {
      const x = Utils.randInt(2, CONFIG.GRID_W-2), y = Utils.randInt(2, CONFIG.GRID_H-2);
      const c = this.grid.get(x, y);
      if (c && !c.owner && !c.trail && !c.powerup && !c.danger) {
        const type = Utils.pick(types);
        this.grid.setPowerup(x, y, type);
        this._activePowerups.push({ x, y, type, age: 0 });
        return;
      }
    }
  }

  _tickPowerupExpiry(dt) {
    for (let i = this._activePowerups.length-1; i >= 0; i--) {
      this._activePowerups[i].age += dt;
      if (this._activePowerups[i].age >= CONFIG.POWERUP_LIFETIME_MS) {
        const { x, y } = this._activePowerups[i];
        const c = this.grid.get(x, y);
        if (c && c.powerup) this.grid.setPowerup(x, y, null);
        this._activePowerups.splice(i, 1);
      }
    }
  }

  _spawnCoin() {
    for (let a = 0; a < 50; a++) {
      const x = Utils.randInt(2, CONFIG.GRID_W-2), y = Utils.randInt(2, CONFIG.GRID_H-2);
      const c = this.grid.get(x, y);
      if (c && !c.owner && !c.trail && !c.coin && !c.powerup && !c.danger) {
        const val = Utils.pick([1,1,2,2,3,5]);
        this.grid.setCoin(x, y, val);
        this._activeCoins.push({ x, y, val, age: 0 });
        return;
      }
    }
  }

  _tickCoinExpiry(dt) {
    for (let i = this._activeCoins.length-1; i >= 0; i--) {
      this._activeCoins[i].age += dt;
      if (this._activeCoins[i].age >= CONFIG.COIN_LIFETIME_MS) {
        const { x, y } = this._activeCoins[i];
        const c = this.grid.get(x, y);
        if (c && c.coin) this.grid.setCoin(x, y, 0);
        this._activeCoins.splice(i, 1);
      }
    }
  }

  // ── Bot management ────────────────────────────────────────
  _spawnBots() {
    const usedColors = new Set(CONFIG.PLAYER_COLORS.slice(0, 1));
    for (let i = 0; i < CONFIG.BOT_COUNT; i++) {
      const color = CONFIG.PLAYER_COLORS.find(c => !usedColors.has(c)) ?? CONFIG.PLAYER_COLORS[i % 8];
      usedColors.add(color);
      const { x, y } = this._findSpawnPos();
      const bot = new ServerBot(`bot_${i}`, CONFIG.BOT_NAMES[i % 8], color, x, y, 1.0);
      bot.dir = Utils.pick(Utils.DIRS);
      bot.respawnCb = b => this._respawnBot(b);
      this.grid.claimStart(x, y, CONFIG.START_AREA_RADIUS, bot.id);
      bot.territory = this.grid.countOwned(bot.id);
      this.bots.push(bot);
    }
    this._rebuildEntities();
  }

  _respawnBot(bot) {
    if (!this.running) return;
    const { x, y } = this._findSpawnPos();
    bot.x = x; bot.y = y;
    bot.dir = Utils.pick(Utils.DIRS);
    bot.trail = []; bot.outside = false;
    bot.alive = true; bot.state = 'expand'; bot.moveTimer = 0;
    this.grid.claimStart(x, y, CONFIG.START_AREA_RADIUS, bot.id);
    bot.territory = this.grid.countOwned(bot.id);
  }

  // ── Helpers ───────────────────────────────────────────────
  _findSpawnPos() {
    const cx = CONFIG.GRID_W >> 1, cy = CONFIG.GRID_H >> 1;
    for (let a = 0; a < 100; a++) {
      const x = Utils.randInt(4, CONFIG.GRID_W-4), y = Utils.randInt(4, CONFIG.GRID_H-4);
      if (Utils.dist({x,y},{x:cx,y:cy}) > 12 && !this.grid.get(x,y)?.owner) return { x, y };
    }
    return { x: Utils.randInt(4, CONFIG.GRID_W-4), y: Utils.randInt(4, CONFIG.GRID_H-4) };
  }

  _rebuildEntities() {
    this.entities = [...this.players.values(), ...this.bots];
  }

  _allEntityStates() {
    return this.entities.map(e => e.toState());
  }

  getPlayerCount() { return this.players.size; }
}

module.exports = GameRoom;
