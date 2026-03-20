// ============================================================
// floodfill.js — HEXATİ BFS flood-fill (client, single-player)
// ============================================================
const FloodFill = {

  capture(grid, id, trail, renderer) {
    const W = grid.w, H = grid.h;

    // 1. Trail hücrelerini sahiplen
    for (const { x, y } of trail) {
      const c = grid.get(x, y);
      if (c) { grid._setOwner(c, id); c.trail = null; }
    }

    // 2. Sınır BFS
    const visited = new Uint8Array(W * H);
    const queue   = [];
    let   head    = 0;

    const enqueue = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x;
      if (visited[i] || grid._data[i].owner === id) return;
      visited[i] = 1;
      queue.push(i);
    };

    for (let x = 0; x < W; x++) { enqueue(x, 0); enqueue(x, H - 1); }
    for (let y = 1; y < H - 1; y++) { enqueue(0, y); enqueue(W - 1, y); }

    while (head < queue.length) {
      const i  = queue[head++];
      const cx = i % W, cy = (i / W) | 0;
      enqueue(cx + 1, cy); enqueue(cx - 1, cy);
      enqueue(cx, cy + 1); enqueue(cx, cy - 1);
    }

    // 3. Ziyaret edilmemiş hücreler → yakalandı
    let captured = 0;
    for (let i = 0; i < W * H; i++) {
      if (!visited[i] && grid._data[i].owner !== id) {
        grid._setOwner(grid._data[i], id);
        grid._data[i].trail = null;
        captured++;
      }
    }

    if (captured > 0 && renderer) renderer.markMinimapDirty();
    return captured;
  },
};
