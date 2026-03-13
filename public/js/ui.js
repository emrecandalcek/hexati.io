// ============================================================
// ui.js — HUD, overlays, shop, notifications
// ============================================================
class UI {
  constructor() {
    this.$fill    = document.getElementById('territory-fill');
    this.$pct     = document.getElementById('territory-pct');
    this.$lb      = document.getElementById('lb-entries');
    this.$feed    = document.getElementById('kill-feed');
    this.$kills   = document.getElementById('stat-kills');
    this.$deaths  = document.getElementById('stat-deaths');
    this.$time    = document.getElementById('stat-time');
    this.$notifs  = document.getElementById('notif-container');
    this.$powerup = document.getElementById('powerup-display');
    this.$death   = document.getElementById('death-overlay');
    this.$dstats  = document.getElementById('death-stats');
    this.$coins   = document.getElementById('hud-coins');
    this._puTimer = null;
  }

  updateScore(player, totalCells) {
    const pct = Math.min(100, player.territory/totalCells*100).toFixed(1);
    this.$fill.style.width = pct+'%';
    this.$pct.textContent  = pct+'%';
    this.$kills.textContent  = `KILLS: ${player.totalKills}`;
    this.$deaths.textContent = `DEATHS: ${player.deaths}`;
  }

  updateCoins(n) {
    if (this.$coins) this.$coins.textContent = `⬡ ${n}`;
  }

  updateTime(startMs) {
    this.$time.textContent = `TIME: ${Utils.formatTime(Date.now()-startMs)}`;
  }

  updateLeaderboard(entities, totalCells) {
    const sorted = entities.filter(e=>e.alive).sort((a,b)=>b.territory-a.territory).slice(0,8);
    this.$lb.innerHTML = sorted.map((e,i)=>{
      const pct=(e.territory/totalCells*100).toFixed(1);
      return `<div class="lb-row${e.id==='player'?' lb-player':''}">
        <span class="lb-rank">${i+1}</span>
        <span class="lb-color" style="background:${e.color}"></span>
        <span class="lb-name">${e.name}</span>
        <span class="lb-score">${pct}%</span>
      </div>`;
    }).join('');
  }

  killFeed(text, color) {
    const el = document.createElement('div');
    el.className='kill-entry'; el.style.color=color; el.textContent=text;
    this.$feed.prepend(el);
    while (this.$feed.children.length>5) this.$feed.lastChild.remove();
    setTimeout(()=>el.classList.add('fade-out'), CONFIG.KILL_FEED_MS-600);
    setTimeout(()=>el.remove(), CONFIG.KILL_FEED_MS);
  }

  notify(text, color) {
    const el = document.createElement('div');
    el.className='notif'; el.style.color=color; el.textContent=text;
    this.$notifs.appendChild(el);
    setTimeout(()=>el.classList.add('notif-out'), 1400);
    setTimeout(()=>el.remove(), 1900);
  }

  showPowerup(type, durationMs) {
    if (this._puTimer) clearTimeout(this._puTimer);
    const labels={speed:'⚡ SPEED BOOST',shield:'🛡 SHIELD ACTIVE',double:'✕2 DOUBLE CAPTURE'};
    this.$powerup.textContent=labels[type]||'';
    this.$powerup.className=`powerup-active powerup-${type}`;
    this._puTimer=setTimeout(()=>{
      this.$powerup.textContent=''; this.$powerup.className='';
    }, durationMs);
  }

  showDeath(player, cause) {
    const causeMap={self:'Crossed own trail',trail:'Trail was cut',
      bot:'Eliminated',boundary:'Hit boundary',danger:'Danger zone!'};
    const pct=(player.territory/(CONFIG.GRID_W*CONFIG.GRID_H)*100).toFixed(1);
    this.$dstats.innerHTML=[
      ['CAUSE',    causeMap[cause]||cause],
      ['TERRITORY',pct+'%'],
      ['KILLS',    player.totalKills],
      ['DEATHS',   player.deaths],
      ['COINS',    player.coins],
      ['SURVIVED', Utils.formatTime(Date.now()-player.startTime)],
    ].map(([k,v])=>`<div class="death-stat"><span>${k}</span><span>${v}</span></div>`).join('');
    this.$death.classList.add('active');
  }

  hideDeath()  { this.$death.classList.remove('active'); }
  showMenu()   { document.getElementById('menu-overlay').classList.add('active'); }
  hideMenu()   { document.getElementById('menu-overlay').classList.remove('active'); }
}
