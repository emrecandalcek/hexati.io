// ============================================================
// mode-survival.js — HEXATİ Survival Modu
// 3 can. Her 30s yeni bot + hızlanma. Skor = hayatta kalma süresi.
// ============================================================

class GameSurvival extends Game {
  constructor() {
    super();
    this._wave         = 0;
    this._waveTimer    = 0;
    this._surviveTime  = 0;
    this._gameOver     = false;
    this._botSpeedMult = 1.0;
  }

  _applySurvivalConfig() {
    CONFIG.BOT_COUNT         = 3;
    CONFIG.DANGER_ZONE_COUNT = 6;
    CONFIG.COIN_SPAWN_MS     = 5000;
    CONFIG.MAX_COINS         = 15;
  }

  start(playerColor) {
    this._applySurvivalConfig();
    this._wave         = 1;
    this._waveTimer    = 30000;
    this._surviveTime  = 0;
    this._gameOver     = false;
    this._botSpeedMult = 1.0;
    super.start(playerColor);

    // Oyun başladıktan sonra lives'ı set et
    this.player.lives = 3;

    if (this.ui.$mode) {
      this.ui.$mode.textContent = 'SURVIVAL W1';
      this.ui.$mode.style.color = '#ff4757';
    }

    this._updateLivesDisplay();
  }

  _updateLivesDisplay() {
    const el = document.getElementById('survival-lives');
    if (!el) return;
    const lives = this.player?.lives ?? 0;
    el.textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives));
  }

  _update(dt) {
    if (this._gameOver) return;

    this._surviveTime += dt;

    // Süre gösterimi
    const sec = Math.floor(this._surviveTime / 1000);
    const m = Math.floor(sec / 60), s = sec % 60;
    const timeStr = `${m}:${String(s).padStart(2,'0')}`;
    if (this.ui.$timeVal) this.ui.$timeVal.textContent = timeStr;

    // Dalga geri sayımı
    this._waveTimer -= dt;
    if (this._waveTimer <= 0) {
      this._waveTimer = 30000;
      this._nextWave();
    }

    // Mode badge: dalga + geri sayım
    const wSec = Math.ceil(this._waveTimer / 1000);
    if (this.ui.$mode) this.ui.$mode.textContent = `W${this._wave} (${wSec}s)`;

    super._update(dt);
    this._updateLivesDisplay();
  }

  _nextWave() {
    this._wave++;
    this._botSpeedMult *= 0.9;

    for (const bot of this.bots) {
      bot.moveInterval = Math.max(80, bot.moveInterval * 0.9);
    }

    this._spawnExtraBot();
    this.ui.notify(`⚠ WAVE ${this._wave}! +1 BOT`, '#ff4757');
  }

  _spawnExtraBot() {
    const usedColors = new Set(this.entities.map(e => e.color));
    const color = CONFIG.PLAYER_COLORS.find(c => !usedColors.has(c))
               ?? CONFIG.PLAYER_COLORS[this.bots.length % 8];
    const cx = CONFIG.GRID_W >> 1, cy = CONFIG.GRID_H >> 1;
    let bx, by, att = 0;
    do {
      bx = Utils.randInt(4, CONFIG.GRID_W - 4);
      by = Utils.randInt(4, CONFIG.GRID_H - 4);
      att++;
    } while (att < 60 && Utils.dist({ x: bx, y: by }, { x: cx, y: cy }) < 14);

    const name = CONFIG.BOT_NAMES[this.bots.length % CONFIG.BOT_NAMES.length];
    const bot  = new Bot(`bot_extra_${this._wave}`, name, color, bx, by, this._botSpeedMult);
    bot.dir = Utils.pick(Utils.DIRS);
    bot.respawnCb = b => this._respawnBot(b);
    this.grid.claimStart(bx, by, CONFIG.START_AREA_RADIUS, bot.id);
    bot.territory = this.grid.countOwned(bot.id);
    bot.snapPixelPos();
    this.bots.push(bot);
    this.entities.push(bot);
    this.renderer.markMinimapDirty();
  }

  // BUG FIX: can kaybı → 0 ise _endGame, değilse sadece respawn
  _respawnPlayer() {
    this.player.lives = (this.player.lives || 1) - 1;

    if (this.player.lives <= 0) {
      // Önce death overlay'i kapat, sonra end screen göster
      this.ui.hideDeath();
      this._endGame();
      return;
    }

    const cx = CONFIG.GRID_W >> 1, cy = CONFIG.GRID_H >> 1;
    this.player.respawn(this.grid, cx, cy);
    this.renderer.markMinimapDirty();
    this.ui.hideDeath();
    this.ui.notify(`💔 ${this.player.lives} CAN KALDI`, '#ff4757');
    this._updateLivesDisplay();
  }

  _endGame() {
    if (this._gameOver) return;
    this._gameOver = true;
    this.running   = false;

    const sec = Math.floor(this._surviveTime / 1000);

    Storage.addScore('survival', {
      score: sec,
      wave:  this._wave,
      kills: this.player.totalKills,
    });
    Storage.addStats({
      gamesPlayed:  1,
      totalKills:   this.player.totalKills,
      totalDeaths:  this.player.deaths,
      totalCapture: this.player.territory,
      timePlayed:   this._surviveTime,
    });

    const m = Math.floor(sec / 60), s = sec % 60;
    document.getElementById('surv-time-val').textContent  = `${m}:${String(s).padStart(2,'0')}`;
    document.getElementById('surv-wave-val').textContent  = this._wave;
    document.getElementById('surv-kills-val').textContent = this.player.totalKills;

    const best  = Storage.getScores('survival')[0];
    const isNew = best && best.score === sec && best.date > Date.now() - 3000;
    document.getElementById('surv-best-label').textContent =
      isNew ? '🏆 YENİ REKOR!' : `EN İYİ: ${best ? best.score + 's' : '—'}`;

    document.getElementById('survival-end-overlay').classList.add('active');
  }
}

window.addEventListener('load', () => {
  window.game = new GameSurvival();
});
