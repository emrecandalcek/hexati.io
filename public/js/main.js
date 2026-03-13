// ============================================================
// main.js — Bootstrap
// ============================================================
window.addEventListener('load', () => {
  window.game = new Game();
  console.log('%cHexDomain loaded ✔', 'color:#00d4ff;font-weight:bold;font-size:14px');
});

// Save cumulative stats when leaving classic mode
window.addEventListener('beforeunload', () => {
  if (window.game?.player && typeof Storage !== 'undefined') {
    const p = window.game.player;
    Storage.addStats({
      gamesPlayed:  1,
      totalKills:   p.totalKills  || 0,
      totalDeaths:  p.deaths      || 0,
      totalCapture: p.territory   || 0,
      timePlayed:   Date.now() - (p.startTime || Date.now()),
    });
  }
});
