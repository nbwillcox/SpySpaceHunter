/* HUD, banners and the decorative side panels. */
(function (G) {
  'use strict';
  const U = G.U, C = G.C, GFX = G.gfx, TAU = U.TAU;
  const W = C.W, H = C.H;
  const HUD = {};
  const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';

  const GS = 2, gcache = new Map();
  /* a glowing string is blurred once into a small canvas and cached; numbers (the score changes all the time) are drawn digit by digit from that cache, so a new value never costs a new blur */
  function glowEntry(s, size, color, weight, glow) {
    const key = s + '|' + size + '|' + color + '|' + weight + '|' + glow;
    let e = gcache.get(key);
    if (!e) {
      if (gcache.size > 160) gcache.clear();
      const f = weight + ' ' + (size * GS) + 'px ' + FONT, c = document.createElement('canvas'), cx = c.getContext('2d');
      cx.font = f;
      const tw = cx.measureText(s).width, pad = 16 * GS;
      c.width = Math.ceil(tw + pad * 2); c.height = Math.ceil(size * GS * 1.5 + pad * 2);
      cx.font = f; cx.textAlign = 'left'; cx.textBaseline = 'alphabetic';
      cx.shadowColor = glow; cx.shadowBlur = 10 * GS; cx.fillStyle = color; cx.fillText(s, pad, pad + size * GS);
      e = { c, tw: tw / GS, pad: pad / GS, by: pad / GS + size };
      gcache.set(key, e);
    }
    return e;
  }
  function glowText(ctx, s, x, y, size, color, align, weight, glow) {
    if (s.length > 1 && /^[0-9,.+x -]+$/.test(s)) {
      const gl = []; let tw = 0;
      for (const ch of s) { const e = glowEntry(ch, size, color, weight, glow); gl.push(e); tw += e.tw; }
      let pen = x + (align === 'center' ? -tw / 2 : align === 'right' ? -tw : 0);
      for (const e of gl) { ctx.drawImage(e.c, pen - e.pad, y - e.by, e.c.width / GS, e.c.height / GS); pen += e.tw; }
      return;
    }
    const e = glowEntry(s, size, color, weight, glow), ox = align === 'center' ? -e.tw / 2 : align === 'right' ? -e.tw : 0;
    ctx.drawImage(e.c, x + ox - e.pad, y - e.by, e.c.width / GS, e.c.height / GS);
  }
  function txt(ctx, s, x, y, size, color, align, weight, glow) {
    weight = weight || 800;
    if (glow) { glowText(ctx, s, x, y, size, color, align, weight, glow); return; }
    ctx.font = weight + ' ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color; ctx.fillText(s, x, y);
  }
  HUD.txt = txt;

  /* little glyphs for the ammo row */
  const ICON = {
    mg(c, x, y) { c.fillStyle = '#9ff3ff'; for (let i = -1; i <= 1; i++) c.fillRect(x + i * 4 - 1, y - 6, 2, 12); },
    missile(c, x, y) { c.fillStyle = '#d8dcec'; c.fillRect(x - 2, y - 6, 4, 11); c.fillStyle = '#ff3dd0'; c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 2, y - 6); c.lineTo(x - 2, y - 6); c.fill(); c.fillStyle = '#7a86a8'; c.fillRect(x - 5, y + 1, 3, 5); c.fillRect(x + 2, y + 1, 3, 5); },
    oil(c, x, y) { c.fillStyle = '#10101c'; c.strokeStyle = '#ff3dd0'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(x, y, 8, 6, 0.3, 0, TAU); c.fill(); c.stroke(); },
    mine(c, x, y) { c.fillStyle = '#2a2f44'; c.strokeStyle = '#ff5a6a'; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.beginPath(); c.moveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); c.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); c.stroke(); } },
    smoke(c, x, y) { c.fillStyle = '#9aa4c0'; for (const [dx, dy, r] of [[-4, 2, 4], [3, 1, 5], [0, -3, 4]]) { c.beginPath(); c.arc(x + dx, y + dy, r, 0, TAU); c.fill(); } },
    emp(c, x, y) { c.strokeStyle = '#37e6ff'; c.lineWidth = 1.6; c.beginPath(); c.arc(x, y, 7, 0, TAU); c.stroke(); c.fillStyle = '#ffd24a'; c.beginPath(); c.moveTo(x + 1, y - 6); c.lineTo(x - 3, y + 1); c.lineTo(x, y + 1); c.lineTo(x - 1, y + 6); c.lineTo(x + 3, y - 1); c.lineTo(x, y - 1); c.closePath(); c.fill(); },
    shield(c, x, y) { c.strokeStyle = '#5ae6ff'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(x, y - 8); c.lineTo(x + 6, y - 5); c.lineTo(x + 6, y + 1); c.quadraticCurveTo(x + 6, y + 6, x, y + 8); c.quadraticCurveTo(x - 6, y + 6, x - 6, y + 1); c.lineTo(x - 6, y - 5); c.closePath(); c.stroke(); },
  };

  HUD.draw = function (ctx, g) {
    if (g.demo) return;
    const P = g.player, spr = GFX.spr, touch = !!(window.TK && window.TK.on);
    const grad = ctx.createLinearGradient(0, 0, 0, 84);
    grad.addColorStop(0, 'rgba(2,4,18,0.82)'); grad.addColorStop(1, 'rgba(2,4,18,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, 84);
    txt(ctx, 'SCORE', 16, 16, 11, '#ff7ad9', 'left', 800);
    txt(ctx, U.fmt(g.score), 16, 38, 24, '#ffffff', 'left', 800, 'rgba(255,90,210,0.8)');
    txt(ctx, 'CREDITS ' + U.fmt(g.credits), 16, 56, 12, '#ffd24a', 'left', 800);
    const z = C.ZONES[Math.max(0, g.zone)];
    txt(ctx, z.name, W / 2, 16, 11, '#7ee8ff', 'center', 800);
    txt(ctx, 'LAP ' + (g.lap + 1), W / 2, 36, 20, '#ffffff', 'center', 800, 'rgba(90,220,255,0.8)');
    const dl = ((g.dist % C.LAP) + C.LAP) % C.LAP, bx = W / 2 - 60;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, 46, 120, 4);
    for (const zz of C.ZONES) { ctx.fillStyle = zz.surface === 'road' ? '#ff7ad9' : zz.surface === 'water' ? '#37e6ff' : '#ffd24a'; ctx.globalAlpha = 0.45; ctx.fillRect(bx + 120 * zz.start / C.LAP, 46, 120 * zz.len / C.LAP - 1, 4); }
    ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.fillRect(bx + 120 * dl / C.LAP - 1, 43, 2, 10);
    for (let i = 0; i < Math.max(0, g.lives - 1); i++) GFX.draw(ctx, spr.life, W - 24 - i * 22, 24, 0, 0.8, 0.8);
    txt(ctx, 'CARS', W - 16, 54, 10, '#7ee8ff', 'right', 800);
    /* damage meter (smoke, fire and slow handling follow it) and armor plates */
    const dmg = P.dmg / 100, segs = 12, sx = 16, sy = 66;
    for (let i = 0; i < segs; i++) {
      const on = i < Math.ceil(dmg * segs - 0.001) && dmg > 0, hue = U.lerp(120, 0, Math.min(1, (i / (segs - 1)) * 1.1));
      ctx.fillStyle = on ? 'hsl(' + hue + ',90%,55%)' : 'rgba(255,255,255,0.12)'; ctx.fillRect(sx + i * 10, sy, 8, 7);
    }
    txt(ctx, 'DAMAGE', sx + segs * 10 + 6, sy + 7, 9, dmg > 0.6 && Math.floor(g.time * 4) % 2 ? '#ff5a6a' : '#9fb7d8', 'left', 800);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i < P.armor ? (P.armorInt > 0 ? '#7ee8ff' : '#ff8a4a') : 'rgba(255,255,255,0.12)'; ctx.fillRect(sx + i * 12, sy + 11, 10, 4); }
    if (P.armor > 0) txt(ctx, P.armorInt > 0 ? 'ARMOR' : 'ARMOR BROKEN', sx + 40, sy + 16, 8, P.armorInt > 0 ? '#7ee8ff' : '#ff8a4a', 'left', 800);
    /* edge warning */
    if (P.edgeT > 0 && P.mode === 'car') {
      const left = P.x < W / 2, a = 0.25 + 0.2 * Math.sin(g.time * 30);
      const eg = ctx.createLinearGradient(left ? C.ROAD_L : C.ROAD_R, 0, left ? C.ROAD_L + 60 : C.ROAD_R - 60, 0); eg.addColorStop(0, 'rgba(255,40,60,' + a + ')'); eg.addColorStop(1, 'rgba(255,40,60,0)');
      ctx.fillStyle = eg; ctx.fillRect(left ? C.ROAD_L : C.ROAD_R - 60, 0, 60, H);
    }
    /* the gadget row */
    const boat = P.mode === 'boat';
    const slots = [['mg', 'mg', 'SPACE', P.ammo.mg], ['missile', 'missile', 'C', P.ammo.missile], ['oil', boat ? 'mine' : 'oil', 'Z', P.ammo.oil], ['smoke', 'smoke', 'X', P.ammo.smoke], ['emp', 'emp', 'V', P.ammo.emp], ['shield', 'shield', 'B', P.ammo.shield]];
    const sw = 60, x0 = W / 2 - slots.length * sw / 2;
    ctx.fillStyle = 'rgba(2,4,18,0.62)'; ctx.fillRect(x0 - 4, H - 46, slots.length * sw + 8, 42);
    slots.forEach((s, i) => {
      const x = x0 + i * sw, fl = g.hudFlash[s[0]] > 0, n = s[3], low = n <= 0;
      ctx.fillStyle = fl && Math.floor(g.time * 12) % 2 ? 'rgba(255,60,80,0.45)' : 'rgba(255,255,255,0.07)'; ctx.fillRect(x + 2, H - 44, sw - 4, 38);
      ctx.globalAlpha = low ? 0.35 : 1; ICON[s[1]](ctx, x + 16, H - 28); ctx.globalAlpha = 1;
      txt(ctx, s[0] === 'mg' && n > 999 ? '--' : String(n), x + 28, H - 24, 15, low ? '#ff5a6a' : s[0] === 'mg' && n < 30 ? '#ffd24a' : '#ffffff', 'left', 800);
      if (!touch) txt(ctx, s[2], x + sw / 2, H - 10, 8, '#7f95b8', 'center', 800);
    });
    /* the turbo meter, just above the gadget row */
    {
      const bw = 170, bx2 = W / 2 - bw / 2 + 18, by = H - 58, fl = g.hudFlash.turbo > 0 && Math.floor(g.time * 12) % 2, frac = P.tb / 100;
      ctx.fillStyle = 'rgba(2,4,18,0.62)'; ctx.fillRect(bx2 - 62, by - 5, bw + 70, 14);
      txt(ctx, 'TURBO', bx2 - 6, by + 6, 9, P.tbLock ? '#ff5a6a' : '#ffb05a', 'right', 800);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(bx2, by, bw, 8);
      ctx.fillStyle = P.tbLock ? (fl ? '#ffffff' : '#ff4a6a') : P.tbOn ? '#fff2b0' : frac >= 1 ? '#7ee8ff' : '#ff9a3c';
      ctx.fillRect(bx2, by, bw * frac, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(bx2 + bw * 0.35 - 1, by - 1, 1.5, 10);
      if (!touch) txt(ctx, 'SHIFT / W', bx2 + bw + 4, by + 7, 8, '#7f95b8', 'left', 800);
    }
    if (P.offT > 0.05 && P.mode === 'car' && Math.floor(g.time * 10) % 2) txt(ctx, 'OFF THE ROAD!  STEER BACK', W / 2, 130, 17, '#ff6a6a', 'center', 900, 'rgba(255,40,60,0.8)');
    HUD.banner(ctx, g);
    if (g.truck && g.truck.state === 'shop') txt(ctx, 'SUPPLY TRUCK', W / 2, 120, 18, '#ff7a82', 'center', 900, 'rgba(255,60,70,0.8)');
  };

  HUD.banner = function (ctx, g) {
    const b = g.banner;
    if (!b) return;
    const k = b.t / b.life;
    const a = k < 0.1 ? k / 0.1 : k > 0.82 ? Math.max(0, (1 - k) / 0.18) : 1;
    const sc = 1 + (k < 0.1 ? (0.1 - k) * 3 : 0);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2, H * 0.36);
    ctx.scale(sc, sc);
    txt(ctx, b.text, 0, 0, b.text.length > 14 ? 34 : 44, '#ffffff', 'center', 900, 'rgba(255,90,210,1)');
    if (b.sub) txt(ctx, b.sub, 0, 32, 20, '#ffd24a', 'center', 800, 'rgba(255,200,60,0.9)');
    ctx.restore();
  };

  /* decorative panels on wide windows; coords are screen pixels */
  const paintSides = function (ctx, v, g) {
    const sw = v.ox;
    if (sw < 150) return;
    const sc = Math.min(1.15, sw / 240), cx1 = sw / 2, cx2 = v.ox + W * v.s + sw / 2, top = v.oy + 70 * sc;
    const col = 'rgba(160,215,255,0.8)';
    ctx.save();
    txt(ctx, 'SPY SPACE HUNTER', cx1, top, 15 * sc, '#ffffff', 'center', 900, 'rgba(255,90,210,0.9)');
    const help = ['STEER', '← →  /  A D  /  MOUSE', 'MACHINE GUN', 'SPACE  /  LEFT CLICK', 'TURBO (HOLD)', 'SHIFT  /  W  /  ↑', 'OIL / MINE   SMOKE', 'Z   X', 'MISSILE   EMP   SHIELD', 'C   V   B', 'PAUSE', 'P  /  ESC'];
    help.forEach((s, i) => txt(ctx, s, cx1, top + 44 * sc + i * 20 * sc, (i % 2 ? 12 : 10) * sc, i % 2 ? col : '#ff7ad9', 'center', i % 2 ? 700 : 800));
    txt(ctx, 'TOP DRIVERS', cx2, top, 15 * sc, '#ffffff', 'center', 900, 'rgba(255,90,210,0.9)');
    G.scores.list.slice(0, 7).forEach((r, i) => txt(ctx, (i + 1) + '. ' + r.name + '  ' + U.fmt(r.score), cx2, top + 34 * sc + i * 22 * sc, 13 * sc, i === 0 ? '#ffd24a' : col, 'center', 700));
    txt(ctx, 'FREE TO PLAY & SHARE', cx2, top + 230 * sc, 10 * sc, '#ff7ad9', 'center', 800);
    txt(ctx, 'github.com/nbwillcox', cx2, top + 248 * sc, 12 * sc, col, 'center', 700);
    txt(ctx, '/SpySpaceHunter', cx2, top + 264 * sc, 12 * sc, col, 'center', 700);
    ctx.restore();
  };

  let sideCache = null, sideKey = '';
  HUD.sides = function (ctx, v, g) {
    if (v.ox < 150) return;
    const key = [v.w, v.h, v.rs.toFixed(2), Math.round(v.ox), Math.round(v.oy), v.s.toFixed(3), G.scores.list.slice(0, 7).map((r) => r.name + r.score).join(',')].join('|');
    if (key !== sideKey || !sideCache) {
      sideKey = key;
      const pw = Math.round(v.ox * v.rs), ph = Math.round(v.h * v.rs);
      const full = document.createElement('canvas');
      full.width = Math.round(v.w * v.rs); full.height = ph;
      const x = full.getContext('2d');
      x.scale(v.rs, v.rs);
      paintSides(x, v, g);
      const strip = (sx) => { const c = document.createElement('canvas'); c.width = pw; c.height = ph; c.getContext('2d').drawImage(full, sx, 0, pw, ph, 0, 0, pw, ph); return c; };
      sideCache = { l: strip(0), r: strip(full.width - pw) };
    }
    ctx.drawImage(sideCache.l, 0, 0, v.ox, v.h);
    ctx.drawImage(sideCache.r, v.w - v.ox, 0, v.ox, v.h);
  };

  G.hud = HUD;
})((window.SGS = window.SGS || {}));
