// ============================================================
// mode-arcade.js — HEXATİ Arcade / Zaman Yarışı Modu
// 90 saniyelik geri sayım. Skor = süre dolunca bölge%.
// Shop yok. Botlar hızlı. Tehlike bölgesi yok.
// ============================================================

class GameArcade extends Game {
  constructor() {
    super();
    this._timeLeft = 90000;
    this._gameOver = false;
  }

  _applyArcadeConfig() {
    CONFIG.BOT_MOVE_BASE     = 160;
    CONFIG.MOVE_INTERVAL     = 160;
    CONFIG.DANGER_ZONE_COUNT = 0;
    CONFIG.COIN_SPAWN_MS     = 6000;
    CONFIG.POWERUP_SPAWN_MS  = 6000;
  }

  start(playerColor) {
    this._applyArcadeConfig();
    this._timeLeft = 90000;
    this._gameOver = false;
    super.start(playerColor);

    // Mode badge
    if (this.ui.$mode) {
      this.ui.$mode.textContent = 'ARCADE';
      this.ui.$mode.style.color = '#ffa502';
    }
  }

  // FIX: Tek _update metodu — önceki kodda hem sınıf içinde hem
  // dışarıda prototype.patch vardı, timer iki kez hesaplanıyordu.
  _update(dt) {
    if (this._gameOver) return;
    super._update(dt);

    this._timeLeft -= dt;
    const sec = Math.max(0, Math.ceil(this._timeLeft / 1000));
    const m   = Math.floor(sec / 60), s = sec % 60;
    const str = `${m}:${String(s).padStart(2, '0')}`;

    // Büyük timer DOM elementi
    const timerEl = document.getElementById('arcade-timer');
    if (timerEl) {
      timerEl.textContent = str;
      timerEl.className   = this._timeLeft < 10000 ? 'warn' : '';
    }

    // stat-time-val (HUD)
    if (this.ui.$timeVal) this.ui.$timeVal.textContent = str;

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

    Storage.addScore('arcade', {
      score,
      kills:  this.player.totalKills,
      deaths: this.player.deaths,
    });
    Storage.addStats({
      gamesPlayed:  1,
      totalKills:   this.player.totalKills,
      totalDeaths:  this.player.deaths,
      totalCapture: this.player.territory,
      timePlayed:   90000,
    });

    document.getElementById('arcade-score-val').textContent = pct + '%';
    document.getElementById('arcade-kills-val').textContent = this.player.totalKills;

    const best  = Storage.getScores('arcade')[0];
    const isNew = best && best.score === score && best.date > Date.now() - 3000;
    document.getElementById('arcade-best-label').textContent =
      isNew ? '🏆 YENİ REKOR!' : `EN İYİ: ${best ? best.score + '%' : '—'}`;

    document.getElementById('arcade-end-overlay').classList.add('active');
  }
}

window.addEventListener('load', () => {
  window.game = new GameArcade();
});
