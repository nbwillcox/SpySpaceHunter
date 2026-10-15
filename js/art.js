/* Vehicle, boat, truck and hazard art: every sprite is drawn with canvas vector calls (top-down, nose up) and cached. No image files. */
(function (G) {
  'use strict';
  const U = G.U, GFX = G.gfx, TAU = U.TAU, mk = GFX.mk, lg = GFX.lg, rg = GFX.rg, mirror = GFX.mirror, flashOf = GFX.flashOf;
  const A = (GFX.art = GFX.art || {});

  /* ---- palettes ---- */
  const PAL = {
    navy: { body: '#1b2f6e', hi: '#3a5fc8', dark: '#0a1334', trim: '#5a8cff' },
    black: { body: '#1d1d2b', hi: '#4c4c66', dark: '#06060b', trim: '#b4b4d6' },
    velvet: { body: '#7d1b3d', hi: '#c43a68', dark: '#31081a', trim: '#ff5c8a' },
    teal: { body: '#17a898', hi: '#58e8d4', dark: '#0a4a44', trim: '#b0fff2' },
    amber: { body: '#d9a020', hi: '#ffe27a', dark: '#6a4a08', trim: '#fff2b0' },
    white: { body: '#c9d4e6', hi: '#ffffff', dark: '#5a6a88', trim: '#ffffff' },
    orange: { body: '#d9601c', hi: '#ffa060', dark: '#6a2a08', trim: '#ffd0a0' },
    lime: { body: '#6cb02c', hi: '#b8f070', dark: '#2a5010', trim: '#e0ffb0' },
    sky: { body: '#2f86d8', hi: '#80c4ff', dark: '#10365e', trim: '#d0eaff' },
    spy: { body: '#d6e0f0', hi: '#ffffff', dark: '#56688e', trim: '#37e6ff' },
    red: { body: '#b3141f', hi: '#ff4a52', dark: '#4a060b', trim: '#ffb0b0' },
  };
  /* the old-school enemy look: midnight navy, black and dark velvet red, plus two-tone mixes of the three */
  const ENEMY = [['navy', 'navy'], ['black', 'black'], ['velvet', 'velvet'], ['navy', 'velvet'], ['black', 'velvet'], ['black', 'navy'], ['velvet', 'black'], ['navy', 'black']];
  const CIV = ['teal', 'amber', 'white', 'orange', 'lime', 'sky'];
  A.ENEMY_PALS = ENEMY.length; A.CIV_PALS = CIV.length;

  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  function shell(c, w, h, nose, tail) {                              /* tapered car body, nose up */
    const hw = w / 2, hh = h / 2;
    c.beginPath(); c.moveTo(-hw * nose, -hh); c.lineTo(hw * nose, -hh);
    c.quadraticCurveTo(hw, -hh, hw, -hh + hw * 0.8); c.lineTo(hw, hh - hw * 0.7); c.quadraticCurveTo(hw, hh, hw * tail, hh);
    c.lineTo(-hw * tail, hh); c.quadraticCurveTo(-hw, hh, -hw, hh - hw * 0.7); c.lineTo(-hw, -hh + hw * 0.8); c.quadraticCurveTo(-hw, -hh, -hw * nose, -hh); c.closePath();
  }
  function lights(c, w, h, o) {
    const hw = w / 2, hh = h / 2;
    c.save(); c.shadowColor = 'rgba(255,246,190,0.95)'; c.shadowBlur = 8; c.fillStyle = '#fff6c0';
    mirror(c, (k) => rr(k, hw * 0.42, -hh + 0.5, hw * 0.4, 3, 1)); c.restore();
    c.save(); c.shadowColor = 'rgba(255,40,60,0.95)'; c.shadowBlur = 7; c.fillStyle = o && o.tail ? o.tail : '#ff2a3a';
    mirror(c, (k) => rr(k, hw * 0.4, hh - 3.5, hw * 0.44, 2.6, 1)); c.restore();
  }
  function glass(c, x, y, w, h, r) {
    c.fillStyle = lg(c, 0, y, 0, y + h, [[0, '#7fb8ff'], [0.35, '#122046'], [1, '#050a1c']]); rr(c, x, y, w, h, r); c.fill();
    c.fillStyle = 'rgba(190,225,255,0.55)'; c.beginPath(); c.moveTo(x + w * 0.1, y + h * 0.15); c.lineTo(x + w * 0.45, y + h * 0.15); c.lineTo(x + w * 0.2, y + h * 0.85); c.lineTo(x + w * 0.05, y + h * 0.85); c.closePath(); c.fill();
  }
  function wheels(c, w, axles, wl) {
    const hw = w / 2; c.fillStyle = '#05060b';
    for (const ay of axles) mirror(c, (k) => rr(k, hw - 2.6, ay - (wl || 13) / 2, 5, wl || 13, 2));
  }

  /* a car, van or bus: o = { w, h, A (hood / trunk), B (cabin), cab: [y0, y1] as fractions of h, axles, kind } */
  function drawCar(c, o) {
    const w = o.w, h = o.h, hw = w / 2, hh = h / 2, P = o.A, Q = o.B || o.A, box = o.kind === 'van' || o.kind === 'bus';
    wheels(c, w, o.axles || [-hh * 0.6, hh * 0.58]);
    c.save(); c.shadowColor = o.glow || P.trim; c.shadowBlur = box ? 6 : 11; c.fillStyle = P.dark;
    if (box) rr(c, -hw, -hh, w, h, hw * 0.45); else shell(c, w, h, 0.62, 0.55); c.fill(); c.restore();
    c.fillStyle = lg(c, -hw, 0, hw, 0, [[0, P.dark], [0.3, P.body], [0.5, P.hi], [0.7, P.body], [1, P.dark]]);
    if (box) rr(c, -hw, -hh, w, h, hw * 0.45); else shell(c, w, h, 0.62, 0.55); c.fill();
    c.strokeStyle = P.trim; c.globalAlpha = 0.55; c.lineWidth = 0.9; c.stroke(); c.globalAlpha = 1;
    if (!box) { c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-hw * 0.3, -hh + 4); c.lineTo(-hw * 0.3, -hh * 0.4); c.moveTo(hw * 0.3, -hh + 4); c.lineTo(hw * 0.3, -hh * 0.4); c.stroke(); }
    const cy0 = (o.cab ? o.cab[0] : -0.34) * h, cy1 = (o.cab ? o.cab[1] : 0.3) * h, ch = cy1 - cy0;
    if (o.kind === 'bus') {
      c.fillStyle = lg(c, 0, -hh, 0, hh, [[0, Q.hi], [1, Q.body]]); rr(c, -hw + 2, -hh + 3, w - 4, h - 6, hw * 0.35); c.fill();
      glass(c, -hw + 4, -hh + 6, w - 8, 16, 3);
      for (let y = -hh + 28; y < hh - 16; y += 14) { c.fillStyle = '#0a1430'; mirror(c, (k) => rr(k, hw - 8, y, 5, 10, 1.4)); c.fillStyle = 'rgba(160,210,255,0.5)'; mirror(c, (k) => rr(k, hw - 7.5, y + 1, 1.4, 8, 0.7)); }
      c.fillStyle = Q.dark; rr(c, -hw * 0.5, -hh * 0.35, w * 0.5, h * 0.5, 3); c.fill(); c.fillStyle = Q.hi; c.globalAlpha = 0.5; rr(c, -hw * 0.35, -hh * 0.3, w * 0.3, h * 0.4, 2); c.fill(); c.globalAlpha = 1;
    } else {
      c.fillStyle = lg(c, -hw, 0, hw, 0, [[0, Q.dark], [0.4, Q.body], [0.55, Q.hi], [1, Q.dark]]); rr(c, -hw * 0.8, cy0, w * 0.8, ch, 5); c.fill();
      c.strokeStyle = Q.trim; c.globalAlpha = 0.5; c.lineWidth = 0.8; c.stroke(); c.globalAlpha = 1;
      glass(c, -hw * 0.68, cy0 + 1.5, w * 0.68, ch * 0.28, 3);
      glass(c, -hw * 0.62, cy1 - ch * 0.22 - 1.5, w * 0.62, ch * 0.22, 3);
      if (o.kind === 'limo' || o.kind === 'van') { const n = o.kind === 'limo' ? 3 : 1; for (let i = 0; i < n; i++) { const y = cy0 + ch * (0.36 + i * 0.2); c.fillStyle = '#0a1430'; mirror(c, (k) => rr(k, hw * 0.66, y, 2.6, ch * 0.14, 1)); } }
      c.fillStyle = Q.hi; c.globalAlpha = 0.55; rr(c, -hw * 0.3, cy0 + ch * 0.34, w * 0.3, ch * 0.3, 2); c.fill(); c.globalAlpha = 1;
    }
    if (o.kind === 'gunner') {                                       /* a roof gun pod */
      c.fillStyle = '#08080f'; c.beginPath(); c.arc(0, 2, 6, 0, TAU); c.fill(); c.strokeStyle = '#ff4a6a'; c.lineWidth = 1.4; c.stroke();
      c.fillStyle = '#c8c8e0'; mirror(c, (k) => k.fillRect(5, 1, 7, 2)); c.fillStyle = '#ff2a3a'; c.beginPath(); c.arc(0, 2, 1.8, 0, TAU); c.fill();
    }
    if (o.kind === 'slasher') {                                      /* dormant wheel blades */
      c.fillStyle = '#d8d8f0'; for (const ay of [-hh * 0.6, hh * 0.58]) mirror(c, (k) => { k.beginPath(); k.moveTo(hw + 0.5, ay - 5); k.lineTo(hw + 4, ay); k.lineTo(hw + 0.5, ay + 5); k.closePath(); k.fill(); });
    }
    if (o.kind === 'limo') { c.strokeStyle = '#c8b25a'; c.lineWidth = 1; c.beginPath(); c.moveTo(-hw + 2, -hh * 0.18); c.lineTo(hw - 2, -hh * 0.18); c.stroke(); }
    lights(c, w, h, o);
  }

  /* the player's sport car: low, wide, white and cyan with a magenta stripe and two gun ports */
  function drawSport(c, dmgLook) {
    const w = 30, h = 58, hw = 15, hh = 29;
    wheels(c, w + 2, [-17, 17], 14);
    c.save(); c.shadowColor = 'rgba(55,230,255,0.95)'; c.shadowBlur = 13; c.fillStyle = PAL.spy.dark; shell(c, w, h, 0.4, 0.78); c.fill(); c.restore();
    c.fillStyle = lg(c, -hw, 0, hw, 0, [[0, PAL.spy.dark], [0.3, PAL.spy.body], [0.5, '#ffffff'], [0.7, PAL.spy.body], [1, PAL.spy.dark]]); shell(c, w, h, 0.4, 0.78); c.fill();
    c.strokeStyle = '#37e6ff'; c.lineWidth = 1.1; c.stroke();
    c.fillStyle = '#ff3dd0'; c.fillRect(-1.6, -hh + 3, 3.2, h - 12);                       /* racing stripe */
    c.fillStyle = 'rgba(10,20,50,0.5)'; mirror(c, (k) => { k.beginPath(); k.moveTo(4, -hh + 8); k.lineTo(11, -hh * 0.2); k.lineTo(10, -hh * 0.1); k.lineTo(4, -hh + 12); k.closePath(); k.fill(); });
    glass(c, -hw * 0.55, -9, w * 0.55, 11, 3);                                              /* low cabin */
    c.fillStyle = lg(c, 0, -2, 0, 12, [[0, '#cfe0ff'], [1, '#6a86b8']]); rr(c, -hw * 0.5, 1, w * 0.5, 8, 2); c.fill();
    glass(c, -hw * 0.5, 10, w * 0.5, 6, 2);
    c.fillStyle = '#10163a'; rr(c, -hw + 1, hh - 6, w - 2, 4, 1.5); c.fill();               /* spoiler */
    c.fillStyle = '#37e6ff'; c.fillRect(-hw + 1, hh - 6, w - 2, 1);
    c.fillStyle = '#9aa6c8'; mirror(c, (k) => k.fillRect(hw * 0.38, -hh - 4, 2.4, 7));      /* gun ports */
    c.fillStyle = '#ff3dd0'; mirror(c, (k) => k.fillRect(hw * 0.38, -hh - 4, 2.4, 1.4));
    c.strokeStyle = '#37e6ff'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(hw - 3, 4); c.lineTo(hw + 3, 10); c.stroke();    /* antenna */
    lights(c, w, h, { tail: '#ff3dd0' });
  }

  /* boats: a pointed hull, a deck and a cockpit */
  function drawBoat(c, o) {
    const w = o.w, h = o.h, hw = w / 2, hh = h / 2, P = o.A, Q = o.B || o.A;
    c.save(); c.shadowColor = o.glow || P.trim; c.shadowBlur = 9; c.fillStyle = P.dark;
    c.beginPath(); c.moveTo(0, -hh - 2); c.quadraticCurveTo(hw, -hh * 0.35, hw, hh * 0.2); c.lineTo(hw * 0.85, hh); c.lineTo(-hw * 0.85, hh); c.lineTo(-hw, hh * 0.2); c.quadraticCurveTo(-hw, -hh * 0.35, 0, -hh - 2); c.closePath(); c.fill(); c.restore();
    c.fillStyle = lg(c, -hw, 0, hw, 0, [[0, P.dark], [0.35, P.body], [0.5, P.hi], [0.65, P.body], [1, P.dark]]);
    c.beginPath(); c.moveTo(0, -hh); c.quadraticCurveTo(hw * 0.85, -hh * 0.35, hw * 0.85, hh * 0.2); c.lineTo(hw * 0.72, hh - 2); c.lineTo(-hw * 0.72, hh - 2); c.lineTo(-hw * 0.85, hh * 0.2); c.quadraticCurveTo(-hw * 0.85, -hh * 0.35, 0, -hh); c.closePath(); c.fill();
    c.strokeStyle = P.trim; c.globalAlpha = 0.6; c.lineWidth = 1; c.stroke(); c.globalAlpha = 1;
    c.fillStyle = Q.body; rr(c, -hw * 0.45, -hh * 0.1, w * 0.45, h * 0.3, 4); c.fill(); c.strokeStyle = Q.trim; c.globalAlpha = 0.6; c.stroke(); c.globalAlpha = 1;
    glass(c, -hw * 0.34, -hh * 0.04, w * 0.34, h * 0.14, 3);
    c.fillStyle = '#05060b'; rr(c, -hw * 0.3, hh - 7, w * 0.3, 7, 2); c.fill();                // outboard
    c.fillStyle = Q.hi; c.globalAlpha = 0.6; c.fillRect(-1, -hh * 0.9, 2, hh * 0.6); c.globalAlpha = 1;
    if (o.kind === 'gunboat') { c.fillStyle = '#08080f'; c.beginPath(); c.arc(0, -hh * 0.45, 5.5, 0, TAU); c.fill(); c.strokeStyle = '#ff4a6a'; c.lineWidth = 1.3; c.stroke(); c.fillStyle = '#c8c8e0'; c.fillRect(-1, -hh * 0.45 - 12, 2, 9); }
    if (o.kind === 'player') { c.fillStyle = '#ff3dd0'; c.fillRect(-1.2, -hh + 4, 2.4, hh * 0.9); c.fillStyle = '#9aa6c8'; mirror(c, (k) => k.fillRect(hw * 0.3, -hh + 1, 2.2, 6)); }
  }

  /* a helicopter body (the rotors are drawn live); big = the gunship */
  function drawHeli(c, o) {
    const P = o.A, Q = o.B || o.A, s = o.big ? 1.4 : 1;
    c.save(); c.scale(s, s);
    c.save(); c.shadowColor = P.trim; c.shadowBlur = 9; c.fillStyle = P.dark;
    c.beginPath(); c.moveTo(-2.4, 8); c.lineTo(-2, 40); c.lineTo(2, 40); c.lineTo(2.4, 8); c.closePath(); c.fill(); c.restore();      // tail boom
    c.fillStyle = lg(c, -2.4, 0, 2.4, 0, [[0, P.dark], [0.5, P.hi], [1, P.dark]]); c.beginPath(); c.moveTo(-2.4, 8); c.lineTo(-1.5, 38); c.lineTo(1.5, 38); c.lineTo(2.4, 8); c.closePath(); c.fill();
    c.fillStyle = P.body; c.beginPath(); c.moveTo(0, 33); c.lineTo(8, 41); c.lineTo(-8, 41); c.closePath(); c.fill();                 // tail fin
    c.fillStyle = '#10163a'; mirror(c, (k) => rr(k, 12, -2, 14, 6, 3));                                                                   // stub wings
    mirror(c, (k) => { k.fillStyle = P.hi; k.fillRect(11, -1, 16, 2); k.fillStyle = '#05060b'; k.fillRect(23, -4, 3, 8); k.fillStyle = '#ff4a6a'; k.fillRect(24, -6, 1.2, 4); });
    c.save(); c.shadowColor = P.trim; c.shadowBlur = 10; c.fillStyle = lg(c, -12, 0, 12, 0, [[0, P.dark], [0.4, P.body], [0.55, P.hi], [1, P.dark]]);
    c.beginPath(); c.ellipse(0, 0, 11.5, 22, 0, 0, TAU); c.fill(); c.restore();
    c.strokeStyle = P.trim; c.globalAlpha = 0.6; c.lineWidth = 1; c.beginPath(); c.ellipse(0, 0, 11.5, 22, 0, 0, TAU); c.stroke(); c.globalAlpha = 1;
    c.fillStyle = lg(c, 0, -22, 0, -4, [[0, '#8fc4ff'], [0.4, '#16264e'], [1, '#050a1c']]); c.beginPath(); c.ellipse(0, -12, 7, 10, 0, 0, TAU); c.fill();   // canopy
    c.fillStyle = 'rgba(200,230,255,0.55)'; c.beginPath(); c.ellipse(-2.5, -15, 1.6, 5, 0.1, 0, TAU); c.fill();
    c.fillStyle = Q.body; rr(c, -5, 3, 10, 10, 2); c.fill();                                                                              // engine cowl
    c.strokeStyle = '#05060b'; c.lineWidth = 1.6; mirror(c, (k) => { k.beginPath(); k.moveTo(9, -14); k.lineTo(10.5, 12); k.stroke(); });    // skids
    c.fillStyle = '#ff2a3a'; c.beginPath(); c.arc(0, 30, 1.6, 0, TAU); c.fill();
    c.restore();
  }

  /* the supply truck: an old-school long-nose red semi (cab, open trailer, ramp) */
  function drawCab(c) {
    const w = 46, h = 66, hw = 23, hh = 33;
    wheels(c, w + 2, [-hh * 0.5, hh * 0.5], 15);
    c.save(); c.shadowColor = 'rgba(255,60,70,0.9)'; c.shadowBlur = 11; c.fillStyle = PAL.red.dark; rr(c, -hw, -hh, w, h, 6); c.fill(); c.restore();
    c.fillStyle = lg(c, -hw, 0, hw, 0, [[0, PAL.red.dark], [0.3, PAL.red.body], [0.5, PAL.red.hi], [0.7, PAL.red.body], [1, PAL.red.dark]]);
    rr(c, -hw + 4, -hh, w - 8, 34, 5); c.fill(); rr(c, -hw, -hh * 0.05, w, hh * 1.05, 6); c.fill();                       // long hood + cab
    c.strokeStyle = '#ffb0b0'; c.globalAlpha = 0.5; c.lineWidth = 1; c.stroke(); c.globalAlpha = 1;
    c.fillStyle = '#d8dcec'; rr(c, -hw + 7, -hh - 1, w - 14, 4, 1.5); c.fill();                                                // chrome grille / bumper
    c.fillStyle = '#05060b'; for (let i = -2; i <= 2; i++) c.fillRect(i * 4 - 0.5, -hh + 1, 1, 2.4);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-1, -hh + 5, 2, 24);                                                           // hood seam
    glass(c, -hw + 5, -2, w - 10, 11, 3);
    c.fillStyle = PAL.red.hi; c.globalAlpha = 0.6; rr(c, -hw + 6, 11, w - 12, 15, 3); c.fill(); c.globalAlpha = 1;               // roof / sleeper
    c.fillStyle = '#9aa6c8'; mirror(c, (k) => { k.beginPath(); k.arc(hw - 4, 2, 2.4, 0, TAU); k.fill(); k.fillStyle = '#e8ecf8'; k.fillRect(hw - 4.6, -12, 1.8, 12); k.fillStyle = '#9aa6c8'; });   // exhaust stacks
    c.save(); c.shadowColor = 'rgba(255,246,190,0.95)'; c.shadowBlur = 9; c.fillStyle = '#fff6c0'; mirror(c, (k) => rr(k, hw - 9, -hh + 4, 6, 3, 1)); c.restore();
    c.save(); c.shadowColor = 'rgba(255,40,60,0.95)'; c.shadowBlur = 7; c.fillStyle = '#ff2a3a'; mirror(c, (k) => rr(k, hw - 9, hh - 4, 6, 2.6, 1)); c.restore();
  }
  function drawTrailer(c) {
    const w = 48, h = 188, hw = 24, hh = 94;
    wheels(c, w + 2, [hh - 38, hh - 22], 15);
    c.save(); c.shadowColor = 'rgba(255,60,70,0.75)'; c.shadowBlur = 9; c.fillStyle = '#26202c'; rr(c, -hw, -hh, w, h, 3); c.fill(); c.restore();
    c.fillStyle = '#b3141f'; rr(c, -hw, -hh, w, h, 3); c.fill();
    c.fillStyle = lg(c, -hw, 0, hw, 0, [[0, '#2a2f44'], [0.5, '#161a2c'], [1, '#2a2f44']]); rr(c, -hw + 4, -hh + 4, w - 8, h - 8, 2); c.fill();      // open cargo bed
    c.strokeStyle = 'rgba(120,140,190,0.35)'; c.lineWidth = 1; for (let y = -hh + 12; y < hh - 6; y += 12) { c.beginPath(); c.moveTo(-hw + 5, y); c.lineTo(hw - 5, y); c.stroke(); }
    c.fillStyle = '#e8ecf8'; mirror(c, (k) => { for (let y = -hh + 2; y < hh - 4; y += 16) k.fillRect(hw - 4, y, 3, 8); });                  // side stripes
    c.fillStyle = '#ffd24a'; for (let i = 0; i < 6; i++) c.fillRect(-hw + 4 + i * 7, hh - 3, 4, 2);                                           // tail gate
    c.save(); c.shadowColor = 'rgba(255,40,60,0.95)'; c.shadowBlur = 7; c.fillStyle = '#ff2a3a'; mirror(c, (k) => rr(k, hw - 8, hh - 3, 6, 2.6, 1)); c.restore();
  }
  function drawRamp(c) {
    const w = 38, h = 34, hw = 19;
    c.fillStyle = lg(c, 0, -17, 0, 17, [[0, '#6a7090'], [1, '#2a2f44']]); c.beginPath(); c.moveTo(-hw + 4, -17); c.lineTo(hw - 4, -17); c.lineTo(hw, 17); c.lineTo(-hw, 17); c.closePath(); c.fill();
    c.strokeStyle = '#ffd24a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-hw + 4, -17); c.lineTo(-hw, 17); c.moveTo(hw - 4, -17); c.lineTo(hw, 17); c.stroke();
    c.strokeStyle = '#ffd24a'; c.lineWidth = 2.4; for (let y = -12; y < 16; y += 9) { c.beginPath(); c.moveTo(-9, y); c.lineTo(0, y + 5); c.lineTo(9, y); c.stroke(); }
  }
  function drawBarge(c) {
    const w = 58, h = 214, hw = 29, hh = 107;
    c.save(); c.shadowColor = 'rgba(255,60,70,0.8)'; c.shadowBlur = 10; c.fillStyle = '#2a2230';
    c.beginPath(); c.moveTo(0, -hh - 4); c.lineTo(hw, -hh + 30); c.lineTo(hw, hh); c.lineTo(-hw, hh); c.lineTo(-hw, -hh + 30); c.closePath(); c.fill(); c.restore();
    c.fillStyle = lg(c, -hw, 0, hw, 0, [[0, '#7a1020'], [0.5, '#b3141f'], [1, '#7a1020']]);
    c.beginPath(); c.moveTo(0, -hh); c.lineTo(hw - 2, -hh + 30); c.lineTo(hw - 2, hh - 2); c.lineTo(-hw + 2, hh - 2); c.lineTo(-hw + 2, -hh + 30); c.closePath(); c.fill();
    c.fillStyle = '#1b2036'; c.beginPath(); c.moveTo(0, -hh + 10); c.lineTo(hw - 7, -hh + 36); c.lineTo(hw - 7, hh - 8); c.lineTo(-hw + 7, hh - 8); c.lineTo(-hw + 7, -hh + 36); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(120,140,190,0.35)'; c.lineWidth = 1; for (let y = -hh + 44; y < hh - 8; y += 12) { c.beginPath(); c.moveTo(-hw + 8, y); c.lineTo(hw - 8, y); c.stroke(); }
    c.fillStyle = '#e8ecf8'; mirror(c, (k) => { for (let y = -hh + 40; y < hh - 10; y += 14) k.fillRect(hw - 6, y, 3, 8); });
    c.fillStyle = '#ffd24a'; mirror(c, (k) => { for (let y = -hh + 14; y < hh - 6; y += 30) { k.beginPath(); k.arc(hw - 4, y, 2.4, 0, TAU); k.fill(); } });
    c.fillStyle = '#b3141f'; rr(c, -9, -hh + 26, 18, 14, 3); c.fill(); glass(c, -7, -hh + 28, 14, 8, 2);          // wheelhouse
  }

  /* hazards and projectiles */
  function drawOil(c) {
    c.fillStyle = rg(c, 0, 0, 2, 26, [[0, 'rgba(8,8,16,0.95)'], [0.7, 'rgba(10,10,22,0.85)'], [1, 'rgba(10,10,22,0)']]);
    c.beginPath(); c.moveTo(-24, 0); c.bezierCurveTo(-26, -16, -8, -26, 8, -22); c.bezierCurveTo(26, -18, 28, 4, 18, 16); c.bezierCurveTo(8, 28, -20, 24, -24, 0); c.fill();
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.55;
    c.strokeStyle = '#ff3dd0'; c.lineWidth = 2; c.beginPath(); c.arc(-4, -3, 12, 0.2, 1.8); c.stroke();
    c.strokeStyle = '#37e6ff'; c.beginPath(); c.arc(4, 4, 11, 3.4, 5.0); c.stroke();
    c.strokeStyle = '#ffd24a'; c.lineWidth = 1.4; c.beginPath(); c.arc(0, 0, 17, 5.2, 6.3); c.stroke();
  }
  function drawMine(c) {
    c.save(); c.shadowColor = 'rgba(255,60,70,0.8)'; c.shadowBlur = 8;
    c.fillStyle = rg(c, -3, -3, 1, 11, [[0, '#7a8098'], [0.5, '#2a2f44'], [1, '#0a0c18']]); c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.fill(); c.restore();
    c.fillStyle = '#9aa0b8'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; c.beginPath(); c.moveTo(Math.cos(a - 0.2) * 8.5, Math.sin(a - 0.2) * 8.5); c.lineTo(Math.cos(a) * 13.5, Math.sin(a) * 13.5); c.lineTo(Math.cos(a + 0.2) * 8.5, Math.sin(a + 0.2) * 8.5); c.closePath(); c.fill(); }
  }
  function drawRock(size, seed) {
    return (c) => {
      const rnd = GFX.mulberry(seed), n = 9, pts = [];
      for (let i = 0; i < n; i++) { const a = i / n * TAU, r = size * (0.7 + rnd() * 0.3); pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.9]); }
      c.save(); c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 8; c.fillStyle = '#1b2030'; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill(); c.restore();
      c.fillStyle = lg(c, -size, -size, size, size, [[0, '#8890a8'], [0.5, '#4a5068'], [1, '#1e2234']]); c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0] * 0.92, p[1] * 0.92) : c.moveTo(p[0] * 0.92, p[1] * 0.92))); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.moveTo(-size * 0.5, -size * 0.2); c.lineTo(-size * 0.1, -size * 0.6); c.lineTo(size * 0.25, -size * 0.35); c.lineTo(-size * 0.1, -size * 0.1); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-size * 0.2, size * 0.1); c.lineTo(size * 0.2, size * 0.5); c.moveTo(size * 0.1, -size * 0.1); c.lineTo(size * 0.5, 0); c.stroke();
    };
  }
  const bullet = (core, glow, w, h) => (c) => { c.save(); c.shadowColor = glow; c.shadowBlur = 8; c.fillStyle = core; rr(c, -w / 2, -h / 2, w, h, w / 2); c.fill(); c.restore(); c.fillStyle = '#fff'; rr(c, -w / 4, -h / 2 + 1, w / 2, h - 2, w / 4); c.fill(); };
  function drawMissile(c) {
    c.save(); c.shadowColor = 'rgba(255,160,40,0.9)'; c.shadowBlur = 8; c.fillStyle = '#d8dcec'; rr(c, -2.6, -11, 5.2, 20, 2.4); c.fill(); c.restore();
    c.fillStyle = '#ff3dd0'; c.beginPath(); c.moveTo(0, -14); c.lineTo(2.6, -9); c.lineTo(-2.6, -9); c.closePath(); c.fill();
    c.fillStyle = '#5a6a88'; mirror(c, (k) => { k.beginPath(); k.moveTo(2, 4); k.lineTo(6, 11); k.lineTo(2, 9); k.closePath(); k.fill(); });
  }
  function drawBomb(c) {
    c.save(); c.shadowColor = 'rgba(255,60,70,0.9)'; c.shadowBlur = 9; c.fillStyle = rg(c, -2, -2, 1, 9, [[0, '#6a7090'], [1, '#0a0c18']]); c.beginPath(); c.arc(0, 0, 7.5, 0, TAU); c.fill(); c.restore();
    c.fillStyle = '#ff2a3a'; c.beginPath(); c.arc(0, 0, 2.4, 0, TAU); c.fill();
    c.strokeStyle = '#9aa0b8'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-9, 0); c.lineTo(9, 0); c.moveTo(0, -9); c.lineTo(0, 9); c.stroke();
  }

  /* ---- cache and lookup ---- */
  const cache = {};
  const DIM = { sedan: [32, 60], gunner: [32, 60], slasher: [32, 60], limo: [34, 98], bike: [16, 36], civcar: [32, 60], civvan: [36, 72], civbus: [40, 118], patrol: [28, 60], gunboat: [32, 70] };
  A.dims = DIM;
  /* kind + palette index -> { c, w, h } and its white-flash twin */
  A.veh = function (kind, pal, flash) {
    const key = kind + ':' + pal + (flash ? 'F' : '');
    if (cache[key]) return cache[key];
    if (flash) return (cache[key] = flashOf(A.veh(kind, pal)));
    const d = DIM[kind], pw = d[0] + 14, ph = d[1] + 14;
    const [pa, pb] = kind.startsWith('civ') ? [PAL[CIV[pal % CIV.length]], PAL[CIV[pal % CIV.length]]] : (ENEMY[pal % ENEMY.length].map((k) => PAL[k]));
    const glow = kind.startsWith('civ') ? undefined : pa.trim;
    let s;
    if (kind === 'bike') s = mk(pw, ph, (c) => {
      c.save(); c.shadowColor = pa.trim; c.shadowBlur = 8; c.fillStyle = pa.dark; rr(c, -3.4, -15, 6.8, 30, 3); c.fill(); c.restore();
      c.fillStyle = '#05060b'; c.fillRect(-1.6, -17, 3.2, 8); c.fillRect(-1.6, 9, 3.2, 8);
      c.fillStyle = lg(c, -4, 0, 4, 0, [[0, pa.dark], [0.5, pa.hi], [1, pa.dark]]); rr(c, -3, -9, 6, 15, 3); c.fill();
      c.fillStyle = '#0a1228'; c.beginPath(); c.ellipse(0, 0, 4.6, 5, 0, 0, TAU); c.fill(); c.fillStyle = pb.body; c.beginPath(); c.arc(0, -1, 3.2, 0, TAU); c.fill();
      c.strokeStyle = '#9aa6c8'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-6, -8); c.lineTo(6, -8); c.stroke();
      c.fillStyle = '#fff6c0'; c.fillRect(-1.4, -16.5, 2.8, 1.6);
    });
    else if (kind === 'patrol' || kind === 'gunboat') s = mk(pw, ph, (c) => drawBoat(c, { w: d[0], h: d[1], A: pa, B: pb, glow, kind }));
    else {
      const o = { w: d[0], h: d[1], A: pa, B: pb, glow, kind: kind === 'civcar' ? 'sedan' : kind === 'civvan' ? 'van' : kind === 'civbus' ? 'bus' : kind };
      if (kind === 'limo') { o.cab = [-0.34, 0.4]; o.axles = [-d[1] * 0.34, d[1] * 0.0, d[1] * 0.34]; }
      if (kind === 'civvan') { o.cab = [-0.4, 0.38]; }
      if (kind === 'civbus') o.axles = [-d[1] * 0.3, d[1] * 0.3];
      s = mk(pw, ph, (c) => drawCar(c, o));
    }
    return (cache[key] = s);
  };
  A.heli = function (pal, big, flash) {
    const key = 'heli:' + pal + (big ? 'B' : '') + (flash ? 'F' : '');
    if (cache[key]) return cache[key];
    if (flash) return (cache[key] = flashOf(A.heli(pal, big)));
    const [pa, pb] = ENEMY[pal % ENEMY.length].map((k) => PAL[k]), z = big ? 1.4 : 1;
    return (cache[key] = mk(64 * z + 16, 90 * z + 16, (c) => drawHeli(c, { A: pa, B: pb, big })));
  };

  GFX.initArt = function () {
    const s = GFX.spr;
    s.sport = mk(52, 80, drawSport);
    s.sportF = flashOf(s.sport);
    s.pboat = mk(46, 82, (c) => drawBoat(c, { w: 28, h: 62, A: PAL.spy, B: PAL.spy, glow: '#37e6ff', kind: 'player' }));
    s.pboatF = flashOf(s.pboat);
    s.cab = mk(64, 84, drawCab); s.trailer = mk(66, 206, drawTrailer); s.ramp = mk(48, 40, drawRamp); s.barge = mk(80, 232, drawBarge);
    s.oil = mk(60, 56, drawOil); s.mine = mk(34, 34, drawMine);
    s.rock = [mk(46, 44, drawRock(20, 11)), mk(66, 62, drawRock(30, 23)), mk(92, 86, drawRock(42, 37))];
    s.bomb = mk(26, 26, drawBomb);
    s.mg = mk(8, 20, bullet('#9ff3ff', 'rgba(55,230,255,0.95)', 4, 16));
    s.missile = mk(18, 32, drawMissile);
    s.eb = mk(14, 14, bullet('#ffb23a', 'rgba(255,120,40,0.95)', 7, 7));
    s.ebm = mk(10, 22, bullet('#ff6a9a', 'rgba(255,60,120,0.95)', 4, 16));
    s.life = mk(26, 40, (c) => { c.scale(0.5, 0.5); drawSport(c); });
  };
})((window.SGS = window.SGS || {}));
