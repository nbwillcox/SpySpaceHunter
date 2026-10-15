/* The world: the zone loop, the road / water strips that scroll past (each painted once, then cached) and the surface under the car. */
(function (G) {
  'use strict';
  const U = G.U, C = G.C, GFX = G.gfx, TAU = U.TAU, W = C.W, H = C.H, ST = C.STRIP, L = C.ROAD_L, R = C.ROAD_R;
  const Road = {};
  G.road = Road;
  const N = C.ZONES.reduce((a, z) => a + z.strips, 0);
  Road.N = N;

  /* what kind of strip sits at strip index k of the lap */
  Road.zoneIndex = function (distLap) { let i = 0; while (i < C.ZONES.length - 1 && distLap >= C.ZONES[i + 1].start) i++; return i; };
  const DOCK1 = ['dockRoad', 'dockRoad', 'dockRoad', 'dockRoad', 'ramp1', 'dockWater', 'dockWater'];
  const DOCK2 = ['dockWater', 'dockWater', 'ramp2', 'dockRoad', 'dockRoad', 'dockRoad', 'dockRoad'];
  Road.stripType = function (k) {
    if (k < 0) return 'city';
    const idx = k % N, zi = Road.zoneIndex(idx * ST), z = C.ZONES[zi], local = idx - z.start / ST;
    if (z.id === 'dock1') return DOCK1[local];
    if (z.id === 'dock2') return DOCK2[local];
    return z.id;
  };
  Road.surfaceAt = function (dist) {
    const d = ((dist % C.LAP) + C.LAP) % C.LAP, z = C.ZONES[Road.zoneIndex(d)];
    if (z.surface !== 'dock') return z.surface;
    const into = d - z.start;
    return z.id === 'dock1' ? (into < z.convert ? 'road' : 'water') : (into < z.convert ? 'water' : 'road');
  };

  /* ---------------- painting ---------------- */
  const hex = (h, a) => { const n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; };
  function speckle(x, x0, y0, w, h, n, cols, rnd, size) { for (let i = 0; i < n; i++) { x.fillStyle = cols[Math.floor(rnd() * cols.length)]; x.fillRect(x0 + rnd() * w, y0 + rnd() * h, size || 1.2, size || 1.2); } }

  function asphalt(x, rnd, o) {
    const g = x.createLinearGradient(L, 0, R, 0);
    g.addColorStop(0, o.a); g.addColorStop(0.5, o.b); g.addColorStop(1, o.a);
    x.fillStyle = g; x.fillRect(L, 0, R - L, ST);
    speckle(x, L, 0, R - L, ST, 260, o.dots, rnd);
    if (o.cracks) { x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 1; for (let i = 0; i < 6; i++) { let cx = L + rnd() * (R - L), cy = rnd() * ST; x.beginPath(); x.moveTo(cx, cy); for (let j = 0; j < 4; j++) { cx += (rnd() - 0.5) * 22; cy += 10 + rnd() * 14; x.lineTo(cx, cy); } x.stroke(); } }
    if (o.wet) { x.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) { const px = L + rnd() * (R - L), py = rnd() * ST, r = 30 + rnd() * 50; x.fillStyle = GFX.rg(x, px, py, 0, r, [[0, hex(o.wet[i % o.wet.length], 0.11)], [1, hex(o.wet[i % o.wet.length], 0)]]); x.fillRect(px - r, py - r, r * 2, r * 2); } x.globalCompositeOperation = 'source-over'; }
    x.strokeStyle = o.lane; x.lineWidth = 2; x.setLineDash([30, 30]);
    for (let k = 1; k < C.LANES; k++) { x.beginPath(); x.moveTo(L + k * C.LANE_W, 0); x.lineTo(L + k * C.LANE_W, ST); x.stroke(); }
    x.setLineDash([]);
    x.lineWidth = 3.2; x.strokeStyle = o.edgeL; x.beginPath(); x.moveTo(L + 2, 0); x.lineTo(L + 2, ST); x.stroke();
    x.strokeStyle = o.edgeR; x.beginPath(); x.moveTo(R - 2, 0); x.lineTo(R - 2, ST); x.stroke();
    x.globalCompositeOperation = 'lighter'; x.lineWidth = 7; x.globalAlpha = 0.18;
    x.strokeStyle = o.edgeL; x.beginPath(); x.moveTo(L + 2, 0); x.lineTo(L + 2, ST); x.stroke(); x.strokeStyle = o.edgeR; x.beginPath(); x.moveTo(R - 2, 0); x.lineTo(R - 2, ST); x.stroke();
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  }
  function water(x, rnd, o, x0, x1, y0, y1) {
    const g = x.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, o.a); g.addColorStop(0.5, o.b); g.addColorStop(1, o.a);
    x.fillStyle = g; x.fillRect(x0, y0, x1 - x0, y1 - y0);
    x.lineWidth = 1.4;
    for (let i = 0; i < o.waves; i++) {
      const px = x0 + rnd() * (x1 - x0 - 40), py = y0 + rnd() * (y1 - y0), len = 20 + rnd() * 40;
      x.strokeStyle = 'rgba(' + o.wave + ',' + (0.07 + rnd() * 0.12) + ')'; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + len / 2, py - 3 - rnd() * 3, px + len, py); x.stroke();
    }
    speckle(x, x0, y0, x1 - x0, y1 - y0, 40, ['rgba(180,240,255,0.5)', 'rgba(255,255,255,0.35)'], rnd, 1.4);
  }
  function foam(x, xe, side, rnd, n) {                       /* a white lapping edge along the bank */
    x.fillStyle = 'rgba(220,245,255,0.55)';
    for (let i = 0; i < n; i++) { const y = rnd() * ST, r = 2 + rnd() * 3; x.beginPath(); x.arc(xe + side * rnd() * 5, y, r, 0, TAU); x.fill(); }
    x.strokeStyle = 'rgba(220,245,255,0.5)'; x.lineWidth = 2; x.beginPath(); x.moveTo(xe, 0); x.lineTo(xe, ST); x.stroke();
  }
  const NEON = ['#37e6ff', '#ff3dd0', '#ffb347', '#7dffb0', '#a98bff'];

  function rooftops(x, side, rnd, wetDim) {                   /* big neon-trimmed rooftops in the side band */
    const x0 = side < 0 ? 0 : R + 12, w = side < 0 ? L - 12 : W - R - 12;
    let y = 4 + rnd() * 10;
    while (y < ST - 30) {
      const h = Math.min(ST - 6 - y, 46 + rnd() * 70), col = NEON[Math.floor(rnd() * NEON.length)];
      x.fillStyle = '#080b16'; x.fillRect(x0, y, w, h);
      x.fillStyle = 'rgba(255,255,255,0.03)'; x.fillRect(x0, y, w, 3);
      x.strokeStyle = col; x.lineWidth = 1.6; x.strokeRect(x0 + 1, y + 1, w - 2, h - 2);
      x.globalCompositeOperation = 'lighter'; x.strokeStyle = hex(col, 0.3); x.lineWidth = 5; x.strokeRect(x0 + 1, y + 1, w - 2, h - 2); x.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 3 + Math.floor(rnd() * 3); i++) {
        const px = x0 + 6 + rnd() * (w - 22), py = y + 6 + rnd() * (h - 16), t = rnd();
        if (t < 0.4) { x.fillStyle = '#141a2c'; x.fillRect(px, py, 9 + rnd() * 6, 7 + rnd() * 5); x.strokeStyle = 'rgba(120,150,200,0.5)'; x.strokeRect(px + 0.5, py + 0.5, 8, 6); }
        else if (t < 0.7) { x.fillStyle = hex(NEON[Math.floor(rnd() * NEON.length)], 0.55); x.fillRect(px, py, 10, 4); }
        else { x.fillStyle = '#ff2a3a'; x.beginPath(); x.arc(px + 3, py + 3, 1.8, 0, TAU); x.fill(); }
      }
      if (rnd() < 0.3) { x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 1; x.beginPath(); x.arc(x0 + w / 2, y + h / 2, Math.min(w, h) * 0.3, 0, TAU); x.stroke(); }
      y += h + 6 + rnd() * 8;
    }
    x.fillStyle = '#2a2e40'; x.fillRect(side < 0 ? L - 12 : R, 0, 12, ST);                       /* concrete barrier */
    x.fillStyle = side < 0 ? '#37e6ff' : '#ff3dd0'; x.fillRect(side < 0 ? L - 3 : R + 2, 0, 1.6, ST);
  }

  const PAINT = {
    city(x, rnd) {
      x.fillStyle = '#05070f'; x.fillRect(0, 0, W, ST);
      rooftops(x, -1, rnd); rooftops(x, 1, rnd);
      asphalt(x, rnd, { a: '#0b0d18', b: '#151826', dots: ['#1e2236', '#080a12', '#262b44'], lane: 'rgba(190,225,255,0.32)', edgeL: '#37e6ff', edgeR: '#ff3dd0', wet: ['#37e6ff', '#ff3dd0', '#ffb347'] });
    },
    desert(x, rnd) {
      const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#2f1d12'); g.addColorStop(0.5, '#3a2616'); g.addColorStop(1, '#2f1d12'); x.fillStyle = g; x.fillRect(0, 0, W, ST);
      for (let i = 0; i < 14; i++) { const side = rnd() < 0.5 ? -1 : 1, px = side < 0 ? rnd() * (L - 8) : R + 8 + rnd() * (W - R - 8), py = rnd() * ST; x.fillStyle = hex(rnd() < 0.5 ? '#6a4630' : '#241408', 0.5); x.beginPath(); x.ellipse(px, py, 14 + rnd() * 18, 6 + rnd() * 10, rnd() * 3, 0, TAU); x.fill(); }
      speckle(x, 0, 0, W, ST, 420, ['#54361f', '#1d1008', '#6a4630'], rnd);
      for (let i = 0; i < 7; i++) { const side = rnd() < 0.5 ? -1 : 1, px = side < 0 ? 8 + rnd() * (L - 24) : R + 14 + rnd() * (W - R - 26), py = 10 + rnd() * (ST - 20);
        if (rnd() < 0.55) { x.strokeStyle = '#3d7a3a'; x.lineWidth = 3; x.lineCap = 'round'; x.beginPath(); x.moveTo(px - 5, py); x.lineTo(px + 5, py); x.moveTo(px, py - 5); x.lineTo(px, py + 5); x.stroke(); x.strokeStyle = '#7ad16a'; x.lineWidth = 1; x.beginPath(); x.moveTo(px - 4, py); x.lineTo(px + 4, py); x.stroke(); }
        else { x.fillStyle = '#1c1410'; x.beginPath(); x.moveTo(px - 7, py + 2); x.lineTo(px - 2, py - 6); x.lineTo(px + 6, py - 3); x.lineTo(px + 7, py + 4); x.closePath(); x.fill(); x.fillStyle = 'rgba(255,200,140,0.2)'; x.fillRect(px - 3, py - 4, 5, 2); } }
      x.fillStyle = '#3a3026'; x.fillRect(L - 9, 0, 9, ST); x.fillRect(R, 0, 9, ST); speckle(x, L - 9, 0, 9, ST, 40, ['#6a5a46', '#2a2218'], rnd);
      asphalt(x, rnd, { a: '#241f1c', b: '#34302c', dots: ['#3a3430', '#1a1614', '#4a443c'], cracks: true, lane: 'rgba(255,230,160,0.4)', edgeL: '#ffb347', edgeR: '#ffb347' });
    },
    town(x, rnd) {
      const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#0a1c1a'); g.addColorStop(0.5, '#0d2622'); g.addColorStop(1, '#0a1c1a'); x.fillStyle = g; x.fillRect(0, 0, W, ST);
      speckle(x, 0, 0, W, ST, 340, ['#133a2e', '#06120f', '#1c4a38'], rnd);
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? 4 : R + 18, w = side < 0 ? L - 24 : W - R - 22; let y = 8 + rnd() * 16;
        while (y < ST - 40) {
          const hh = 34 + rnd() * 26, ww = Math.min(w, 34 + rnd() * 18), px = x0 + (w - ww) / (side < 0 ? 1 : 1) * rnd();
          x.fillStyle = '#05080f'; x.fillRect(px + 2, y + 3, ww, hh);
          const roof = ['#3a2a52', '#5a2a3a', '#2a3a58', '#4a3a24'][Math.floor(rnd() * 4)];
          x.fillStyle = roof; x.fillRect(px, y, ww, hh);
          x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(px, y, ww, hh / 2); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px, y + hh / 2, ww, hh / 2);
          x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(px, y + hh / 2); x.lineTo(px + ww, y + hh / 2); x.stroke();
          x.fillStyle = '#d8d0c0'; x.fillRect(px + ww * 0.65, y + 5, 5, 7);
          x.fillStyle = hex('#ffd27a', 0.8); x.fillRect(px + 4, y + hh - 7, 6, 3);
          y += hh + 10 + rnd() * 18;
          if (rnd() < 0.7) { const tx = x0 + rnd() * w, ty = y - 6 - rnd() * 10, tr = 6 + rnd() * 5; x.fillStyle = '#0a3a22'; x.beginPath(); x.arc(tx, ty, tr, 0, TAU); x.fill(); x.fillStyle = '#1a6a3c'; x.beginPath(); x.arc(tx - 1.5, ty - 1.5, tr * 0.6, 0, TAU); x.fill(); }
        }
      }
      x.fillStyle = '#3a4050'; x.fillRect(L - 10, 0, 10, ST); x.fillRect(R, 0, 10, ST); x.fillStyle = '#5a6278'; x.fillRect(L - 10, 0, 1.4, ST); x.fillRect(R + 8.6, 0, 1.4, ST);
      for (let i = 0; i < 3; i++) { const side = i % 2 ? 1 : -1, ly = 40 + i * 110 + rnd() * 30, lx = side < 0 ? L - 5 : R + 5; x.globalCompositeOperation = 'lighter'; x.fillStyle = GFX.rg(x, lx, ly, 0, 26, [[0, 'rgba(255,214,130,0.8)'], [0.3, 'rgba(255,190,90,0.3)'], [1, 'rgba(255,170,60,0)']]); x.fillRect(lx - 26, ly - 26, 52, 52); x.globalCompositeOperation = 'source-over'; x.fillStyle = '#fff2c0'; x.beginPath(); x.arc(lx, ly, 2.2, 0, TAU); x.fill(); }
      asphalt(x, rnd, { a: '#171b24', b: '#222733', dots: ['#2a3040', '#0e1118', '#323a50'], lane: 'rgba(255,255,255,0.3)', edgeL: '#ffffff', edgeR: '#ffffff' });
      if (rnd() < 0.5) { x.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 16; i++) x.fillRect(L + 4 + i * 24.5, 170 + rnd() * 2, 14, 18); }            /* a crosswalk */
    },
    dockRoad(x, rnd) {
      x.fillStyle = '#10141e'; x.fillRect(0, 0, W, ST); speckle(x, 0, 0, W, ST, 300, ['#1c2232', '#080a12', '#262e44'], rnd);
      for (const side of [-1, 1]) { const x0 = side < 0 ? 4 : R + 14, w = side < 0 ? L - 22 : W - R - 18; let y = 10 + rnd() * 14;
        while (y < ST - 40) { const h = 28 + rnd() * 34, col = ['#b3401c', '#1c5ab3', '#c8a020', '#2a7a4a', '#7a2a8a'][Math.floor(rnd() * 5)];
          x.fillStyle = '#05070c'; x.fillRect(x0 + 2, y + 2, w, h); x.fillStyle = col; x.fillRect(x0, y, w, h); x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 1; for (let k = x0 + 5; k < x0 + w - 2; k += 6) { x.beginPath(); x.moveTo(k, y + 2); x.lineTo(k, y + h - 2); x.stroke(); }
          x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(x0, y, w, 3); y += h + 8 + rnd() * 14; } }
      x.fillStyle = '#ffd24a'; for (let y = 0; y < ST; y += 24) { x.fillRect(L - 10, y, 10, 12); x.fillRect(R, y + 12, 10, 12); } x.fillStyle = '#10141e'; for (let y = 0; y < ST; y += 24) { x.fillRect(L - 10, y + 12, 10, 12); x.fillRect(R, y, 10, 12); }
      asphalt(x, rnd, { a: '#14171f', b: '#1e222e', dots: ['#2a3040', '#0c0e14', '#323a50'], lane: 'rgba(255,214,90,0.35)', edgeL: '#ffd24a', edgeR: '#ffd24a' });
    },
    dockWater(x, rnd) {
      x.fillStyle = '#04141f'; x.fillRect(0, 0, W, ST);
      water(x, rnd, { a: '#05233a', b: '#0a3c5e', waves: 46, wave: '160,225,255' }, L, R, 0, ST);
      for (const side of [-1, 1]) { const x0 = side < 0 ? 0 : R, w = side < 0 ? L : W - R;
        x.fillStyle = '#2a1f16'; x.fillRect(x0, 0, w, ST); x.fillStyle = '#4a3624'; for (let y = 0; y < ST; y += 9) { x.fillRect(x0 + 2, y + 1, w - 4, 7); } x.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 0; y < ST; y += 9) x.fillRect(x0 + 2, y + 7, w - 4, 1.4);
        for (let i = 0; i < 3; i++) { const ly = 40 + i * 120, lx = side < 0 ? L - 6 : R + 6; x.fillStyle = '#6a7090'; x.beginPath(); x.arc(lx, ly, 3.4, 0, TAU); x.fill(); x.globalCompositeOperation = 'lighter'; x.fillStyle = GFX.rg(x, lx, ly, 0, 22, [[0, 'rgba(255,190,110,0.7)'], [1, 'rgba(255,150,60,0)']]); x.fillRect(lx - 22, ly - 22, 44, 44); x.globalCompositeOperation = 'source-over'; } }
      foam(x, L, 1, rnd, 18); foam(x, R, -1, rnd, 18);
    },
    river(x, rnd) { riverCommon(x, rnd, false); },
    rapids(x, rnd) { riverCommon(x, rnd, true); },
  };
  function riverCommon(x, rnd, rough) {
    x.fillStyle = '#06130e'; x.fillRect(0, 0, W, ST);
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? 0 : R, w = side < 0 ? L : W - R;
      x.fillStyle = rough ? '#1a1c24' : '#0c2a1e'; x.fillRect(x0, 0, w, ST); speckle(x, x0, 0, w, ST, 160, rough ? ['#2a2e3c', '#0c0e14', '#40465a'] : ['#12402c', '#061a12', '#1c5a3c'], rnd);
      for (let i = 0; i < 6; i++) { const px = x0 + 6 + rnd() * (w - 12), py = 8 + rnd() * (ST - 16), r = 6 + rnd() * 8;
        if (rough || rnd() < 0.3) { x.fillStyle = '#2e3346'; x.beginPath(); x.ellipse(px, py, r, r * 0.8, rnd() * 3, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,0.2)'; x.beginPath(); x.ellipse(px - 1, py - 1, r * 0.5, r * 0.35, 0, 0, TAU); x.fill(); }
        else { x.fillStyle = '#082a18'; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill(); x.fillStyle = '#18703c'; x.beginPath(); x.arc(px - 1.5, py - 1.5, r * 0.62, 0, TAU); x.fill(); } }
    }
    water(x, rnd, rough ? { a: '#041a30', b: '#0a3a62', waves: 64, wave: '200,240,255' } : { a: '#06283a', b: '#0b4a5c', waves: 40, wave: '150,240,230' }, L, R, 0, ST);
    if (rough) { x.strokeStyle = 'rgba(235,250,255,0.5)'; x.lineWidth = 2; for (let i = 0; i < 16; i++) { const px = L + 10 + rnd() * (R - L - 20), py = rnd() * (ST - 50), len = 20 + rnd() * 34; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + (rnd() - 0.5) * 8, py + len / 2, px, py + len); x.stroke(); } }
    foam(x, L, 1, rnd, rough ? 34 : 18); foam(x, R, -1, rnd, rough ? 34 : 18);
  }
  function ramp(x, rnd, up) {                                 /* up = water at the bottom, road on top (ramp2); else road at the bottom (ramp1) */
    const rd = (y0, y1) => { x.save(); x.beginPath(); x.rect(0, y0, W, y1 - y0); x.clip(); PAINT.dockRoad(x, GFX.mulberry(rnd() * 1e9 | 0)); x.restore(); };
    const wt = (y0, y1) => { x.save(); x.beginPath(); x.rect(0, y0, W, y1 - y0); x.clip(); PAINT.dockWater(x, GFX.mulberry(rnd() * 1e9 | 0)); x.restore(); };
    if (up) { rd(0, 150); wt(210, ST); } else { wt(0, 150); rd(210, ST); }
    const y0 = up ? 150 : 150, g = x.createLinearGradient(0, y0, 0, y0 + 60);
    g.addColorStop(0, up ? '#14171f' : '#0a3c5e'); g.addColorStop(0.5, '#2a3a4a'); g.addColorStop(1, up ? '#0a3c5e' : '#14171f');
    x.fillStyle = g; x.fillRect(L, y0, R - L, 60);                                          /* the slipway */
    x.strokeStyle = '#ffd24a'; x.lineWidth = 2.4; for (let k = 0; k < 5; k++) { const yy = y0 + 8 + k * 11; x.beginPath(); x.moveTo(L + 6, yy); x.lineTo((L + R) / 2, yy + (up ? -6 : 6)); x.lineTo(R - 6, yy); x.stroke(); }
    x.fillStyle = 'rgba(220,245,255,0.5)'; for (let i = 0; i < 18; i++) { x.beginPath(); x.arc(L + 4 + rnd() * (R - L - 8), (up ? 140 : 214) + rnd() * 20, 1.8 + rnd() * 2, 0, TAU); x.fill(); }
  }
  PAINT.ramp1 = (x, rnd) => ramp(x, rnd, false);
  PAINT.ramp2 = (x, rnd) => ramp(x, rnd, true);

  const cache = {}, TYPES = Object.keys(PAINT);
  Road.strip = function (type, variant) {
    const key = type + variant;
    let c = cache[key];
    if (c) return c;
    c = document.createElement('canvas'); c.width = W; c.height = ST;
    const x = c.getContext('2d'); x.lineJoin = 'round';
    PAINT[type](x, GFX.mulberry(TYPES.indexOf(type) * 7919 + variant * 104729 + 17));
    return (cache[key] = c);
  };
  /* paint the strips a zone will use a little at a time, so the next zone is ready before the car gets there */
  Road.warm = function (zi) {
    const z = C.ZONES[zi % C.ZONES.length], first = z.start / ST;
    for (let i = 0; i < z.strips; i++) { const t = Road.stripType(first + i); for (let v = 0; v < 3; v++) { if (!cache[t + v]) { setTimeout(() => Road.strip(t, v), 40 * (i * 3 + v)); } } }
  };

  const hash = (k) => ((Math.imul(k, 2654435761) >>> 0) >> 5) % 3;
  Road.draw = function (ctx, g) {
    const base = g.dist, k0 = Math.floor((base - (H - C.CAR_Y) - 4) / ST), k1 = Math.floor((base + C.CAR_Y) / ST);
    for (let k = k0; k <= k1; k++) {
      const top = C.CAR_Y - ((k + 1) * ST - base);
      ctx.drawImage(Road.strip(Road.stripType(k), hash(k)), 0, Math.round(top), W, ST + 1);
    }
  };
  /* drifting glints on the water */
  Road.drawWaterFx = function (ctx, g) {
    const d = g.dist, s = Road.surfaceAt(d + 200);
    if (s !== 'water' && Road.surfaceAt(d - 100) !== 'water') return;
    const t = g.time;
    ctx.save(); ctx.beginPath(); ctx.rect(L, 0, R - L, H); ctx.clip();
    ctx.strokeStyle = 'rgba(200,240,255,0.22)'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 26; i++) {
      const px = L + ((i * 137) % (R - L)), py = (i * 53 + d * 1.05 + Math.sin(t + i) * 4) % (H + 60) - 30, len = 12 + (i % 5) * 5;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + 3, py + len / 2, px, py + len); ctx.stroke();
    }
    ctx.restore();
  };
})((window.SGS = window.SGS || {}));
