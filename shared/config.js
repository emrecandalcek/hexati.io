// ============================================================
// shared/config.js — Shared constants (server + client)
// ============================================================
const CONFIG = {
  VERSION: '2.2',

  GRID_W: 80, GRID_H: 80, HEX_SIZE: 20,
  get HEX_W() { return Math.sqrt(3) * this.HEX_SIZE; },
  get HEX_H() { return 2 * this.HEX_SIZE; },

  MOVE_INTERVAL:  190,
  BOT_MOVE_BASE:  210,
  MAX_TRAIL:      150,
  START_AREA_RADIUS: 3,

  POWERUP_SPAWN_MS: 9000, POWERUP_LIFETIME_MS: 22000,
  POWERUP_DURATION_MS: 9000, SPEED_MULTIPLIER: 0.55,
  MAX_POWERUPS_ON_MAP: 5,

  COIN_SPAWN_MS: 4000, COIN_LIFETIME_MS: 25000,
  MAX_COINS: 20, COIN_TRAIL_VALUE: 2,
  COIN_KILL_VALUE: 15, COIN_CAPTURE_BONUS: 1,

  DANGER_ZONE_COUNT: 12,

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

  EMPTY_COLOR: '#0b1120', GRID_STROKE: '#131c2e',
  MINIMAP_PX: 130, KILL_FEED_MS: 3500,

  BOT_NAMES: ['CIPHER','NEXUS','VORTEX','PHANTOM','ECHO','PULSE','RAVEN','STORM',
              'APEX','BLAZE','COMET','DELTA','ENVY','FRAG','GHOST','HYDRA'],

  // ── DIFFICULTY PRESETS ─────────────────────────────────────
  DIFFICULTIES: {
    easy: {
      label: 'KOLAY', color: '#2ed573', icon: '🟢',
      desc:  'Yavaş botlar · Az tehlike · Yeni başlayanlar için',
      botCount: 3,      botSpeedMult: 1.8,
      dangerZones: 4,   maxTrail: 200,
      botRespawnDelay: 6000, roomsPerDiff: 3, maxPlayers: 8,
    },
    normal: {
      label: 'NORMAL', color: '#ffa502', icon: '🟡',
      desc:  'Dengeli botlar · Standart · Herkes için',
      botCount: 5,      botSpeedMult: 1.0,
      dangerZones: 12,  maxTrail: 150,
      botRespawnDelay: 4500, roomsPerDiff: 5, maxPlayers: 8,
    },
    hard: {
      label: 'ZOR', color: '#ff4757', icon: '🔴',
      desc:  'Agresif botlar · Çok tehlike · Profesyoneller için',
      botCount: 7,      botSpeedMult: 0.55,
      dangerZones: 22,  maxTrail: 100,
      botRespawnDelay: 2500, roomsPerDiff: 5, maxPlayers: 8,
    },
  },

  TICK_RATE_MS: 50,         // Server tick — fixed, 20/sec
  STATE_BROADCAST_MS: 100,  // State push to clients — 10/sec
  BOT_RESPAWN_DELAY: 4500,
};

if (typeof module !== 'undefined') module.exports = CONFIG;
