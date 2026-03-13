// ============================================================
// shop.js — In-game shop logic
// ============================================================
class Shop {
  constructor(player, audio, ui) {
    this.player = player;
    this.audio  = audio;
    this.ui     = ui;
    this._open  = false;
    this._el    = document.getElementById('shop-overlay');
    this._buildUI();
    document.getElementById('btn-shop-close').onclick = () => this.close();
    document.addEventListener('keydown', e => {
      if (e.key === 'b' || e.key === 'B') this._open ? this.close() : this.open();
      if (e.key === 'Escape' && this._open) this.close();
    });
  }

  open() {
    this._open = true;
    this._refresh();
    this._el.classList.add('active');
    this.audio.click();
  }

  close() {
    this._open = false;
    this._el.classList.remove('active');
    this.audio.click();
  }

  isOpen() { return this._open; }

  _buildUI() {
    const grid = document.getElementById('shop-items');
    grid.innerHTML = '';
    for (const [key, item] of Object.entries(CONFIG.SHOP)) {
      const card = document.createElement('div');
      card.className = 'shop-card';
      card.dataset.key = key;
      card.innerHTML = `
        <div class="shop-icon">${item.icon}</div>
        <div class="shop-label">${item.label}</div>
        <div class="shop-desc">${item.desc}</div>
        <div class="shop-footer">
          <span class="shop-cost">⬡ ${item.cost}</span>
          <span class="shop-level"></span>
        </div>
        <button class="shop-buy-btn">BUY</button>
      `;
      card.querySelector('.shop-buy-btn').onclick = () => this._buy(key);
      grid.appendChild(card);
    }
  }

  _refresh() {
    document.getElementById('shop-coins-display').textContent = `⬡ ${this.player.coins}`;
    for (const [key, item] of Object.entries(CONFIG.SHOP)) {
      const card = document.querySelector(`.shop-card[data-key="${key}"]`);
      if (!card) continue;
      const level  = this.player.upgrades[key] || 0;
      const maxed  = level >= item.max;
      const afford = this.player.coins >= item.cost;
      card.querySelector('.shop-level').textContent = maxed ? 'MAXED' : `${level}/${item.max}`;
      const btn = card.querySelector('.shop-buy-btn');
      btn.disabled = maxed || !afford;
      btn.textContent = maxed ? 'MAXED' : (afford ? 'BUY' : 'NO COINS');
      card.classList.toggle('maxed',  maxed);
      card.classList.toggle('afford', !maxed && afford);
      card.classList.toggle('poor',   !maxed && !afford);
    }
  }

  _buy(key) {
    const item = CONFIG.SHOP[key];
    if (!item) return;
    const level = this.player.upgrades[key] || 0;
    if (level >= item.max) return;
    if (this.player.coins < item.cost) return;

    this.player.coins -= item.cost;
    this.player.upgrades[key] = level + 1;

    // Apply immediate effects
    if (key === 'trail_speed') {
      this.player.moveInterval = this.player._baseMoveInterval();
    }

    this.audio.powerup();
    this.ui.notify(`${item.icon} ${item.label} upgraded!`, '#2ed573');
    this._refresh();
  }
}
