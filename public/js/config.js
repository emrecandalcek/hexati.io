// ============================================================
// config.js — HEXATİ oyun sabitleri ve ayarları (client v2.2)
// ============================================================
const CONFIG = {
  VERSION: '2.2',

  // Grid
  GRID_W: 80, GRID_H: 80, HEX_SIZE: 20,
  get HEX_W() { return Math.sqrt(3) * this.HEX_SIZE; },
  get HEX_H() { return 2 * this.HEX_SIZE; },

  // Hareket (ms/adım — büyük = yavaş)
  MOVE_INTERVAL:  190,
  BOT_MOVE_BASE:  210,
  MAX_TRAIL:      150,
  START_AREA_RADIUS: 3,

  // Lerp (frame-rate bağımsız kamera yumuşatma)
  LERP_BASE: 0.22,

  // Zorluk: bot hız çarpanı (client-only, single-player modlar için)
  DIFFICULTY: { easy: 1.5, normal: 1.0, hard: 0.62 },

  // Botlar
  BOT_COUNT: 6,
  BOT_RESPAWN_DELAY: 4500,

  // Power-up'lar
  POWERUP_SPAWN_MS:    9000,
  POWERUP_LIFETIME_MS: 22000,
  POWERUP_DURATION_MS: 9000,
  SPEED_MULTIPLIER:    0.55,
  MAX_POWERUPS_ON_MAP: 5,

  // Coin
  COIN_SPAWN_MS:    4000,
  COIN_LIFETIME_MS: 25000,
  MAX_COINS:           20,
  COIN_TRAIL_VALUE:     2,
  COIN_KILL_VALUE:     15,
  COIN_CAPTURE_BONUS:   1,

  // Tehlike bölgeleri
  DANGER_ZONE_COUNT: 12,

  // Shop ürünleri
  SHOP: {
    trail_speed:   { cost: 40,  max: 3, label: 'Speed Up',      desc: 'Her seviye %15 daha hızlı',    icon: '⚡' },
    capture_bonus: { cost: 50,  max: 3, label: 'Capture Boost', desc: '+%20 alan bonusu/capture',      icon: '⬡' },
    shield_time:   { cost: 60,  max: 3, label: 'Shield+',       desc: '+4s kalkan süresi',             icon: '🛡' },
    trail_width:   { cost: 80,  max: 2, label: 'Wide Trail',    desc: '3 hücre genişliğinde iz',       icon: '➤' },
    radar:         { cost: 100, max: 1, label: 'Bot Radar',     desc: 'Minimap\'te bot izleri',        icon: '📡' },
    magnet:        { cost: 70,  max: 1, label: 'Coin Magnet',   desc: 'Yakın coinleri topla',          icon: '🧲' },
    ghost:         { cost: 120, max: 1, label: 'Ghost Mode',    desc: 'Capture sonrası 1.2s dokunulmaz',icon: '👻' },
    double_coins:  { cost: 90,  max: 1, label: 'Double Coins',  desc: 'Kalıcı 2x coin kazanımı',       icon: '✕2' },
  },

  // Renkler (12 renk — multiplayer için ek renkler)
  PLAYER_COLORS: [
    '#00d4ff', '#ff4757', '#2ed573', '#ffa502',
    '#a29bfe', '#fd79a8', '#fdcb6e', '#00cec9',
    '#e17055', '#55efc4', '#74b9ff', '#b2bec3',
  ],

  // Görsel
  EMPTY_COLOR:  '#0b1120',
  GRID_STROKE:  '#131c2e',
  MINIMAP_PX:   130,
  KILL_FEED_MS: 3500,

  // Bot isimleri
  BOT_NAMES: [
    'CIPHER', 'NEXUS', 'VORTEX', 'PHANTOM',
    'ECHO',   'PULSE', 'RAVEN',  'STORM',
    'APEX',   'BLAZE', 'COMET',  'DELTA',
    'ENVY',   'FRAG',  'GHOST',  'HYDRA',
  ],
};
