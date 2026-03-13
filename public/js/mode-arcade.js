// ============================================================
// mode-arcade.js — Arcade / Time Attack mode
// 90-second countdown. Score = territory% at time up.
// No shop. Faster bots. No danger zones.
// ============================================================

class GameArcade extends Game {
  constructor() {
    super();
    this._timeLeft  = 90000; // 90 seconds
    this._gameOver  = false;
    this._timerEl   = null;
  }

  // Override CONFIG for arcade tuning
  _applyArcadeConfig() {
    CONFIG.BOT_MOVE_BASE      = 160;   // faster bots
    CONFIG.MOVE_INTERVAL      = 160;   // faster player
    CONFIG.DANGER_ZONE_COUNT  = 0;     // no danger zones
    CONFIG.COIN_SPAWN_MS      = 6000;
    CONFIG.POWERUP_SPAWN_MS   = 6000;
  }

  start(playerColor) {
    this._applyArcadeConfig();
    this._timeLeft = 90000;
    this._gameOver = false;
    super.start(playerColor);
    document.getElementById('stat-mode').textContent = 'ARCADE';
    document.getElementById('stat-mode').style.color = '#ffa502';
  }

  _update(dt) {
    if (this._gameOver) return;
    super._update(dt);

    this._timeLeft -= dt;
    const sec = Math.max(0, Math.ceil(this._timeLeft / 1000));
    const m = Math.floor(sec / 60), s = sec % 60;
    const timeStr = `${m}:${String(s).padStart(2,'0')}`;
    document.getElementById('stat-time').textContent = `⏱ ${timeStr}`;

    // Color warning at <10s
    const el = document.getElementById('stat-time');
    el.style.color = this._timeLeft < 10000 ? '#ff4757' : this._timeLeft < 30000 ? '#ffa502' : '';

    if (this._timeLeft <= 0) {
      this._timeLeft = 0;
      this._endGame();
    }
  }

  _endGame() {
    if (this._gameOver) return;
    this._gameOver = true;
    this.running   = false;

    const total = CONFIG.GRID_W * CONFIG.GRID_H;
    const pct   = (this.player.territory / total * 100).toFixed(1);
    const score = parseFloat(pct);

    // Save score
    Storage.addScore('arcade', {
      score,
      kills:  this.player.totalKills,
      deaths: this.player.deaths,
    });
    Storage.addStats({
      gamesPlayed: 1,
      totalKills:  this.player.totalKills,
      totalDeaths: this.player.deaths,
      totalCapture: this.player.territory,
      timePlayed:  90000,
    });

    // Show result overlay
    document.getElementById('arcade-score-val').textContent = pct + '%';
    document.getElementById('arcade-kills-val').textContent = this.player.totalKills;

    const best = Storage.getScores('arcade')[0];
    const isNew = best && best.score === score && best.date > Date.now() - 3000;
    document.getElementById('arcade-best-label').textContent = isNew ? '🏆 YENİ REKOR!' : `EN İYİ: ${best ? best.score+'%' : '—'}`;

    document.getElementById('arcade-end-overlay').classList.add('active');
  }
}

window.addEventListener('load', () => {
  window.game = new GameArcade();
});

// Patch: update big timer DOM element each frame
const _origArcadeUpdate = GameArcade.prototype._update;
GameArcade.prototype._update = function(dt) {
  _origArcadeUpdate.call(this, dt);
  const el = document.getElementById('arcade-timer');
  if (!el) return;
  const sec = Math.max(0, Math.ceil(this._timeLeft / 1000));
  const m = Math.floor(sec / 60), s = sec % 60;
  el.textContent = `${m}:${String(s).padStart(2,'0')}`;
  el.className = this._timeLeft < 10000 ? 'warn' : '';
};
