// ============================================================
// audio.js — HEXATİ Prosedürel Ses Motoru (Web Audio API)
// ============================================================
class AudioEngine {
  constructor() {
    this.ctx    = null;
    this.on     = true;
    this.volume = 0.7;
    try {
      const s = JSON.parse(localStorage.getItem('hexati_settings') || '{}');
      if (s.soundEnabled === false) this.on = false;
      if (s.volume !== undefined) this.volume = s.volume / 100;
    } catch(e) {}
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(_) { this.on = false; }
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  _tone(freq, type, vol, start, dur) {
    if (!this.on || !this.ctx) return;
    try {
      const osc  = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + start);
      const scaledVol = Math.min(1, vol * this.volume);
      gain.gain.setValueAtTime(scaledVol, this.ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + start + dur);
      osc.start(this.ctx.currentTime + start);
      osc.stop(this.ctx.currentTime  + start + dur + 0.01);
    } catch(e) {}
  }

  // Bölge yakalama — yükselen akor
  capture() {
    this._tone(330, 'sine', 0.18, 0.00, 0.12);
    this._tone(495, 'sine', 0.18, 0.06, 0.12);
    this._tone(660, 'sine', 0.18, 0.12, 0.18);
  }

  // Kill sesi
  kill() {
    this._tone(180, 'sawtooth', 0.25, 0.00, 0.06);
    this._tone(90,  'sawtooth', 0.25, 0.06, 0.10);
    this._tone(55,  'square',   0.15, 0.12, 0.15);
  }

  // Ölüm fanfarı
  death() {
    for (let i = 0; i < 6; i++) {
      this._tone(440 - i * 55, 'sawtooth', 0.20, i * 0.07, 0.10);
    }
  }

  // Güçlendirme sesi
  powerup() {
    this._tone(440, 'sine', 0.20, 0.00, 0.08);
    this._tone(660, 'sine', 0.20, 0.08, 0.08);
    this._tone(880, 'sine', 0.20, 0.16, 0.14);
  }

  // Adım sesi (çok hafif)
  step() {
    this._tone(120, 'sine', 0.03, 0, 0.03);
  }

  // Coin toplama
  coinPickup() {
    this._tone(880, 'sine', 0.12, 0.00, 0.05);
    this._tone(1100,'sine', 0.10, 0.04, 0.06);
  }

  // UI tıklama
  click() {
    this._tone(400, 'sine', 0.08, 0, 0.04);
  }
}
