// ============================================================
// audio.js — Procedural sound via Web Audio API
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
    } catch (_) { this.on = false; }
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  // Low-level: schedule a tone
  _tone(freq, type, vol, start, dur) {
    if (!this.on || !this.ctx) return;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime + start);
    const scaledVol = vol * this.volume;
    gain.gain.setValueAtTime(scaledVol, this.ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + start + dur);
    osc.start(this.ctx.currentTime + start);
    osc.stop(this.ctx.currentTime  + start + dur + 0.01);
  }

  // Ascending chime on territory capture
  capture() {
    this._tone(330, 'sine', 0.18, 0.00, 0.12);
    this._tone(495, 'sine', 0.18, 0.06, 0.12);
    this._tone(660, 'sine', 0.18, 0.12, 0.18);
  }

  // Crunchy kill hit
  kill() {
    this._tone(180, 'sawtooth', 0.25, 0.00, 0.06);
    this._tone( 90, 'sawtooth', 0.25, 0.06, 0.10);
    this._tone( 55, 'square',   0.15, 0.12, 0.15);
  }

  // Descending death fanfare
  death() {
    for (let i = 0; i < 6; i++) {
      this._tone(440 - i * 55, 'sawtooth', 0.20, i * 0.07, 0.10);
    }
  }

  // Three-note power-up ding
  powerup() {
    this._tone(523, 'sine', 0.18, 0.00, 0.07);
    this._tone(659, 'sine', 0.18, 0.07, 0.07);
    this._tone(784, 'sine', 0.20, 0.14, 0.18);
  }

  // Quick UI tick
  click() {
    this._tone(700, 'square', 0.12, 0, 0.04);
  }

  // Soft step sound (called on every move)
  step() {
    this._tone(160, 'sine', 0.04, 0, 0.03);
  }

  coinPickup() {
    this._tone(880, 'sine', 0.10, 0.00, 0.04);
    this._tone(1100,'sine', 0.08, 0.04, 0.05);
  }
}
