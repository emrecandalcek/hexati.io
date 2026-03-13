// ============================================================
// config.js — All game constants and tunable settings (v2)
// ============================================================
const CONFIG = {
  VERSION: '2.0',
  // Grid
  GRID_W: 80,
  GRID_H: 80,
  HEX_SIZE: 20,
  get HEX_W() { return Math.sqrt(3) * this.HEX_SIZE; },
  get HEX_H() { return 2 * this.HEX_SIZE; },

  // Movement (ms per logical step — larger = slower)
  MOVE_INTERVAL:  190,
  BOT_MOVE_BASE:  210,
  MAX_TRAIL:      150,
  START_AREA_RADIUS: 3,

  // Lerp smoothness (frame-rate independent factor base)
  // Applied as: factor = 1-(1-LERP_BASE)^(dt/16.67)
  LERP_BASE: 0.22,

  // Difficulty bot speed multipliers
  DIFFICULTY: { easy: 1.5, normal: 1.0, hard: 0.62 },

  // Bots
  BOT_COUNT: 6,
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
  COIN_TRAIL_VALUE:      2,   // coins per trail cell when closing
  COIN_KILL_VALUE:      15,
  COIN_CAPTURE_BONUS:    1,   // extra coin per 5 cells captured

  // Danger zones
  DANGER_ZONE_COUNT: 12,      // red hexes that kill on touch
  DANGER_SPAWN_MS: 30000,     // respawn after 30s

  // Shop item costs (coins)
  SHOP: {
    trail_speed:   { cost: 40,  max: 3, label: 'Speed Up',       desc: 'Move 15% faster each level',  icon: '⚡' },
    capture_bonus: { cost: 50,  max: 3, label: 'Capture Boost',  desc: '+20% area per capture',        icon: '⬡' },
    shield_time:   { cost: 60,  max: 3, label: 'Shield+',        desc: '+4s shield duration',          icon: '🛡' },
    trail_width:   { cost: 80,  max: 2, label: 'Wide Trail',     desc: 'Trail marks 3 cells wide',     icon: '➤' },
    radar:         { cost: 100, max: 1, label: 'Bot Radar',      desc: 'See bot trails on minimap',    icon: '📡' },
    magnet:        { cost: 70,  max: 1, label: 'Coin Magnet',    desc: 'Auto-collect nearby coins',    icon: '🧲' },
    ghost:         { cost: 120, max: 1, label: 'Ghost Mode',     desc: '1s invincible after capture',  icon: '👻' },
    double_coins:  { cost: 90,  max: 1, label: 'Double Coins',   desc: 'Earn 2× coins permanently',    icon: '✕2' },
  },

  // Visual
  PLAYER_COLORS: [
    '#00d4ff','#ff4757','#2ed573','#ffa502',
    '#a29bfe','#fd79a8','#fdcb6e','#00cec9',
  ],
  EMPTY_COLOR:  '#0b1120',
  GRID_STROKE:  '#131c2e',
  MINIMAP_PX:   130,
  KILL_FEED_MS: 3500,

  BOT_NAMES: ['CIPHER','NEXUS','VORTEX','PHANTOM','ECHO','PULSE','RAVEN','STORM'],
};
