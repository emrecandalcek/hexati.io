// ============================================================
// shared/config.js — Shared constants (server + client)
// ============================================================
const CONFIG = {
  VERSION: '2.0',

  // Grid
  GRID_W: 80,
  GRID_H: 80,
  HEX_SIZE: 20,
  get HEX_W() { return Math.sqrt(3) * this.HEX_SIZE; },
  get HEX_H() { return 2 * this.HEX_SIZE; },

  // Movement (ms per step)
  MOVE_INTERVAL:  190,
  BOT_MOVE_BASE:  210,
  MAX_TRAIL:      150,
  START_AREA_RADIUS: 3,

  LERP_BASE: 0.22,

  DIFFICULTY: { easy: 1.5, normal: 1.0, hard: 0.62 },

  // Bots
  BOT_COUNT: 4,
  BOT_RESPAWN_DELAY: 4500,

  // Power-ups
  POWERUP_SPAWN_MS:    9000,
  POWERUP_LIFETIME_MS: 22000,
  POWERUP_DURATION_MS:  9000,
  SPEED_MULTIPLIER:    0.55,
  MAX_POWERUPS_ON_MAP: 5,

  // Coins
  COIN_SPAWN_MS:      4000,
  COIN_LIFETIME_MS:  25000,
  MAX_COINS:            20,
  COIN_TRAIL_VALUE:      2,
  COIN_KILL_VALUE:      15,
  COIN_CAPTURE_BONUS:    1,

  // Danger zones
  DANGER_ZONE_COUNT: 12,
  DANGER_SPAWN_MS: 30000,

  // Shop
  SHOP: {
    trail_speed:   { cost: 40,  max: 3, label: 'Speed Up',      icon: '⚡' },
    capture_bonus: { cost: 50,  max: 3, label: 'Capture Boost', icon: '⬡' },
    shield_time:   { cost: 60,  max: 3, label: 'Shield+',       icon: '🛡' },
    trail_width:   { cost: 80,  max: 2, label: 'Wide Trail',    icon: '➤' },
    radar:         { cost: 100, max: 1, label: 'Bot Radar',     icon: '📡' },
    magnet:        { cost: 70,  max: 1, label: 'Coin Magnet',   icon: '🧲' },
    ghost:         { cost: 120, max: 1, label: 'Ghost Mode',    icon: '👻' },
    double_coins:  { cost: 90,  max: 1, label: 'Double Coins',  icon: '✕2' },
  },

  PLAYER_COLORS: [
    '#00d4ff','#ff4757','#2ed573','#ffa502',
    '#a29bfe','#fd79a8','#fdcb6e','#00cec9',
    '#e17055','#55efc4','#74b9ff','#b2bec3',
  ],

  EMPTY_COLOR:  '#0b1120',
  GRID_STROKE:  '#131c2e',
  MINIMAP_PX:   130,
  KILL_FEED_MS: 3500,

  BOT_NAMES: ['CIPHER','NEXUS','VORTEX','PHANTOM','ECHO','PULSE','RAVEN','STORM'],

  // Multiplayer
  MAX_PLAYERS_PER_ROOM: 8,
  TICK_RATE_MS: 50,          // server tick every 50ms
  STATE_BROADCAST_MS: 100,   // full state broadcast every 100ms
};

if (typeof module !== 'undefined') module.exports = CONFIG;
