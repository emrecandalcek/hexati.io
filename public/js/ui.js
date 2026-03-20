// ============================================================
// ui.js — HEXATİ HUD, overlay, bildirim yöneticisi
// ============================================================
class UI {
  constructor() {
    this.$fill     = document.getElementById('territory-fill');
    this.$pct      = document.getElementById('territory-pct');
    this.$lb       = document.getElementById('lb-entries');
    this.$feed     = document.getElementById('kill-feed');
    this.$killsVal = document.getElementById('stat-kills-val');
    this.$deathsVal= document.getElementById('stat-deaths-val');
    this.$timeVal  = document.getElementById('stat-time-val');
    // Legacy (hidden ama bazı modlar yazıyor)
    this.$kills    = document.getElementById('stat-kills');
    this.$deaths   = document.getElementById('stat-deaths');
    this.$time     = document.getElementById('stat-time');
    this.$notifs   = document.getElementById('notif-container');
    this.$powerup  = document.getElementById('powerup-display');
    this.$death    = document.getElementById('death-overlay');
    this.$dstats   = document.getElementById('death-stats');
    this.$coins    = document.getElementById('hud-coins');
    this.$mode     = document.getElementById('hud-mode-badge');
    this._puTimer  = null;
    this._notifQ   = [];  // bildirim sırası (çakışma önleme)
  }

  updateScore(player, totalCells) {
    const pct = Math.min(100, player.territory / totalCells * 100).toFixed(1);
    if (this.$fill)      this.$fill.style.width = pct + '%';
    if (this.$pct)       this.$pct.textContent  = pct + '%';
    if (this.$killsVal)  this.$killsVal.textContent  = player.totalKills || 0;
    if (this.$deathsVal) this.$deathsVal.textContent = player.deaths     || 0;
    if (this.$kills)     this.$kills.textContent  = `KILLS: ${player.totalKills || 0}`;
    if (this.$deaths)    this.$deaths.textContent = `DEATHS: ${player.deaths || 0}`;
  }

  updateCoins(n) {
    if (this.$coins) this.$coins.textContent = `⬡ ${n}`;
  }

  updateTime(startMs) {
    const t = Utils.formatTime(Date.now() - startMs);
    if (this.$timeVal) this.$timeVal.textContent = t;
    if (this.$time)    this.$time.textContent    = `TIME: ${t}`;
  }

  updateLeaderboard(entities, totalCells) {
    if (!this.$lb) return;
    const sorted = entities.filter(e => e.alive)
      .sort((a, b) => b.territory - a.territory)
      .slice(0, 8);
    this.$lb.innerHTML = sorted.map((e, i) => {
      const pct = (e.territory / totalCells * 100).toFixed(1);
      const isPlayer = e.id === 'player';
      return `<div class="lb-row${isPlayer ? ' lb-player' : ''}">
        <span class="lb-rank">${i + 1}</span>
        <span class="lb-color" style="background:${e.color}"></span>
        <span class="lb-name">${e.name}</span>
        <span class="lb-score">${pct}%</span>
      </div>`;
    }).join('');
  }

  killFeed(text, color) {
    if (!this.$feed) return;
    const el = document.createElement('div');
    el.className = 'kill-entry';
    el.style.color = color;
    el.textContent = text;
    this.$feed.prepend(el);
    while (this.$feed.children.length > 5) this.$feed.lastChild.remove();
    setTimeout(() => el.classList.add('fade-out'), CONFIG.KILL_FEED_MS - 600);
    setTimeout(() => el.remove(), CONFIG.KILL_FEED_MS);
  }

  notify(text, color) {
    if (!this.$notifs) return;
    const el = document.createElement('div');
    el.className   = 'notif';
    el.style.color = color;
    el.textContent = text;
    this.$notifs.appendChild(el);
    setTimeout(() => el.classList.add('notif-out'), 1400);
    setTimeout(() => el.remove(), 1900);
  }

  showPowerup(type, durationMs) {
    if (!this.$powerup) return;
    if (this._puTimer) clearTimeout(this._puTimer);
    const labels = {
      speed:  '⚡ SPEED BOOST',
      shield: '🛡 SHIELD ACTIVE',
      double: '✕2 DOUBLE CAPTURE',
    };
    this.$powerup.textContent = labels[type] || '';
    this.$powerup.className   = `powerup-active powerup-${type}`;
    this._puTimer = setTimeout(() => {
      if (this.$powerup) { this.$powerup.textContent = ''; this.$powerup.className = ''; }
    }, durationMs);
  }

  showDeath(player, cause) {
    if (!this.$dstats || !this.$death) return;
    const causeMap = {
      self:     'Kendi izine bastı',
      trail:    'İzi kesildi',
      bot:      'Eliminate edildi',
      boundary: 'Sınır dışı',
      danger:   'Tehlike bölgesi!',
    };
    const total = CONFIG.GRID_W * CONFIG.GRID_H;
    const pct   = (player.territory / total * 100).toFixed(1);
    this.$dstats.innerHTML = [
      ['SEBEP',    causeMap[cause] || cause],
      ['BÖLGE',    pct + '%'],
      ['KILL',     player.totalKills],
      ['ÖLÜM',     player.deaths],
      ['COIN',     player.coins],
      ['SÜRE',     Utils.formatTime(Date.now() - player.startTime)],
    ].map(([k, v]) => `<div class="death-stat"><span>${k}</span><span>${v}</span></div>`)
     .join('');
    this.$death.classList.add('active');
  }

  hideDeath()  { this.$death?.classList.remove('active'); }
  showMenu()   { document.getElementById('menu-overlay')?.classList.add('active'); }
  hideMenu()   { document.getElementById('menu-overlay')?.classList.remove('active'); }
}
