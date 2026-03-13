// ============================================================
// game.js — Game state manager (v2)
// ============================================================
class Game {
  constructor() {
    this.canvas     = document.getElementById('game');
    this.miniCanvas = document.getElementById('minimap');
    this.miniCanvas.width  = CONFIG.MINIMAP_PX;
    this.miniCanvas.height = CONFIG.MINIMAP_PX;

    this.grid      = new Grid(CONFIG.GRID_W, CONFIG.GRID_H);
    this.audio     = new AudioEngine();
    this.input     = new InputHandler();
    this.camera    = new Camera();
    this.renderer  = new Renderer(this.canvas, this.miniCanvas);
    this.ui        = new UI();
    this.powerups  = new PowerupSystem();
    this.coins     = new CoinSystem();
    this.shop      = null;

    this.player    = null;
    this.bots      = [];
    this.entities  = [];

    this.running   = false;
    this.lastTime  = 0;
    this.diffMult  = 1.0;

    this.fpsLimit  = 0;
    this._fpsInterval = 0;
    this._accumFPS = 0;

    // Load settings
    this._applySettings();
    this._initMenuEvents();
  }

  _applySettings() {
    try {
      const s = JSON.parse(localStorage.getItem('hexdomain_settings') || '{}');
      if (s.fpsLimit !== undefined) {
        this.fpsLimit = s.fpsLimit;
        this._fpsInterval = s.fpsLimit > 0 ? 1000 / s.fpsLimit : 0;
      }
      if (s.difficulty) {
        this.diffMult = CONFIG.DIFFICULTY[s.difficulty] ?? 1.0;
      }
    } catch(e) {}
  }

  _initMenuEvents() {
    const colorContainer = document.getElementById('color-options');
    let selectedColor    = CONFIG.PLAYER_COLORS[0];

    CONFIG.PLAYER_COLORS.forEach((color, i) => {
      const btn = document.createElement('div');
      btn.className = 'color-opt' + (i === 0 ? ' selected' : '');
      btn.style.background = color;
      btn.onclick = () => {
        document.querySelectorAll('.color-opt').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedColor = color;
        this.audio.click();
      };
      colorContainer.appendChild(btn);
    });

    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.diffMult = CONFIG.DIFFICULTY[btn.dataset.diff] ?? 1.0;
        this.audio.click();
      };
    });

    document.querySelectorAll('.fps-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.fps-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const v = parseInt(btn.dataset.fps);
        this.fpsLimit = v;
        this._fpsInterval = v > 0 ? 1000 / v : 0;
        this.audio.click();
      };
    });

    document.getElementById('btn-start').onclick = () => {
      this.audio.resume();
      this.audio.click();
      this.start(selectedColor);
    };

    document.getElementById('btn-respawn').onclick = () => {
      this.audio.resume();
      this.audio.click();
      this.ui.hideDeath();
      this._respawnPlayer();
    };

    document.getElementById('btn-menu').onclick = () => {
      this.running = false;
      this.ui.hideDeath();
      this.ui.showMenu();
    };

    // Escape key → menu
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.running) {
        this.running = false;
        this.ui.showMenu();
      }
    });

    window.addEventListener('resize', () => this.camera.resize(window.innerWidth, window.innerHeight));
  }

  start(playerColor) {
    this.ui.hideMenu();

    // Reinitialise grid with current CONFIG dimensions
    this.grid   = new Grid(CONFIG.GRID_W, CONFIG.GRID_H);
    this.powerups = new PowerupSystem();
    this.coins    = new CoinSystem();
    this.entities = [];
    this.bots     = [];

    const cx = CONFIG.GRID_W >> 1, cy = CONFIG.GRID_H >> 1;

    this.player = new Player('player', 'YOU', playerColor, cx, cy);
    this.grid.claimStart(cx, cy, CONFIG.START_AREA_RADIUS, 'player');
    this.player.territory = this.grid.countOwned('player');
    this.player.startTime = Date.now();
    this.player.snapPixelPos();
    this.entities.push(this.player);

    this.grid.spawnDangerZones(CONFIG.DANGER_ZONE_COUNT);

    const usedColors = new Set([playerColor]);
    for (let i = 0; i < CONFIG.BOT_COUNT; i++) {
      const color = CONFIG.PLAYER_COLORS.find(c => !usedColors.has(c)) ?? CONFIG.PLAYER_COLORS[i % 8];
      usedColors.add(color);
      let bx, by, att = 0;
      do {
        bx = Utils.randInt(4, CONFIG.GRID_W - 4);
        by = Utils.randInt(4, CONFIG.GRID_H - 4);
        att++;
      } while (att < 60 && Utils.dist({ x: bx, y: by }, { x: cx, y: cy }) < 14);

      const bot = new Bot(`bot_${i}`, CONFIG.BOT_NAMES[i % 8], color, bx, by, this.diffMult);
      bot.dir = Utils.pick(Utils.DIRS);
      bot.respawnCb = b => this._respawnBot(b);
      this.grid.claimStart(bx, by, CONFIG.START_AREA_RADIUS, bot.id);
      bot.territory = this.grid.countOwned(bot.id);
      bot.snapPixelPos();
      this.bots.push(bot);
      this.entities.push(bot);
    }

    this.shop = new Shop(this.player, this.audio, this.ui);

    const pp = Utils.hexToPixel(cx, cy);
    this.camera.snap(pp.x, pp.y);
    this.renderer.markMinimapDirty();

    this.running  = true;
    this.lastTime = performance.now();
    this._accumFPS = 0;
    requestAnimationFrame(t => this._loop(t));
  }

  _loop(now) {
    if (!this.running) return;

    const dt = Math.min(now - this.lastTime, 80);
    this.lastTime = now;

    if (this._fpsInterval > 0) {
      this._accumFPS = (this._accumFPS || 0) + dt;
      if (this._accumFPS < this._fpsInterval) {
        requestAnimationFrame(t => this._loop(t));
        return;
      }
      this._accumFPS -= this._fpsInterval;
    }

    this._update(dt);
    this._render(dt);
    requestAnimationFrame(t => this._loop(t));
  }

  _update(dt) {
    if (this.player.alive) {
      this.player.update(dt, this.input, this.grid, this.entities, this.audio, this.ui, this.renderer);
    }
    for (const bot of this.bots) {
      bot.update(dt, this.grid, this.entities, this.audio, this.ui, this.renderer);
    }
    this.powerups.update(dt, this.grid);
    this.coins.update(dt, this.grid);
    this.camera.follow(this.player.px, this.player.py);

    const total = CONFIG.GRID_W * CONFIG.GRID_H;
    this.ui.updateScore(this.player, total);
    this.ui.updateTime(this.player.startTime);
    this.ui.updateLeaderboard(this.entities, total);
    this.ui.updateCoins(this.player.coins);
  }

  _render(dt) {
    this.renderer.draw(this.grid, this.entities, this.camera, dt);
  }

  _respawnPlayer() {
    const cx = CONFIG.GRID_W >> 1, cy = CONFIG.GRID_H >> 1;
    this.player.respawn(this.grid, cx, cy);
    this.renderer.markMinimapDirty();

    // Save classic mode score on death
    if (typeof Storage !== 'undefined') {
      const total = CONFIG.GRID_W * CONFIG.GRID_H;
      const pct   = (this.player.territory / total * 100).toFixed(1);
      Storage.addScore('classic', {
        score:  parseFloat(pct),
        kills:  this.player.totalKills,
        deaths: this.player.deaths,
      });
    }
  }

  _respawnBot(bot) {
    if (!this.running) return;
    let bx, by, att = 0;
    do {
      bx = Utils.randInt(4, CONFIG.GRID_W - 4);
      by = Utils.randInt(4, CONFIG.GRID_H - 4);
      att++;
    } while (att < 60 && this.grid.get(bx, by)?.owner);

    bot.x = bx; bot.y = by;
    bot.dir = Utils.pick(Utils.DIRS);
    bot.trail = []; bot.outside = false;
    bot.alive = true; bot.state = 'expand'; bot.moveTimer = 0;
    this.grid.claimStart(bx, by, CONFIG.START_AREA_RADIUS, bot.id);
    bot.territory = this.grid.countOwned(bot.id);
    bot.snapPixelPos();
    this.renderer.markMinimapDirty();
  }
}
