/* Every other vehicle on the road and the water: traffic, the enemy cars, bikes, helicopters, boats, mines and rocks. Movement, AI, bumper-car collisions, crashes and drawing. */
(function (G) {
  'use strict';
  const U = G.U, C = G.C, FX = G.fx, GFX = G.gfx, A = G.audio, Road = G.road, TAU = U.TAU, W = C.W, H = C.H, L = C.ROAD_L, R = C.ROAD_R;
  const V = {};
  G.veh = V;
  let uid = 0;

  /* team: enemy (score), civ (do not hurt), neutral (rocks). Boxes are slightly smaller than the sprites. */
  const DEF = {
    sedan: { team: 'enemy', w: 29, h: 54, mass: 1.1, hp: 3, pts: 100 },
    limo: { team: 'enemy', w: 31, h: 90, mass: 2.6, hp: 14, pts: 400 },
    gunner: { team: 'enemy', w: 29, h: 54, mass: 1.0, hp: 4, pts: 200 },
    slasher: { team: 'enemy', w: 29, h: 54, mass: 1.0, hp: 3, pts: 200 },
    bike: { team: 'enemy', w: 13, h: 30, mass: 0.35, hp: 1, pts: 50 },
    heli: { team: 'enemy', air: true, w: 54, h: 62, mass: 3, hp: 10, pts: 600 },
    civcar: { team: 'civ', w: 29, h: 54, mass: 1.1, hp: 3 },
    civvan: { team: 'civ', w: 33, h: 66, mass: 1.8, hp: 5 },
    civbus: { team: 'civ', w: 37, h: 110, mass: 3.4, hp: 9 },
    patrol: { team: 'enemy', water: true, w: 25, h: 54, mass: 1.0, hp: 4, pts: 150 },
    gunboat: { team: 'enemy', water: true, w: 29, h: 64, mass: 1.4, hp: 6, pts: 250 },
    gunship: { team: 'enemy', air: true, w: 80, h: 96, mass: 5, hp: 22, pts: 800 },
    mine: { team: 'enemy', water: true, obst: true, w: 20, h: 20, mass: 1.2, hp: 1, pts: 25 },
    rock: { team: 'neutral', water: true, obst: true, w: 40, h: 38, mass: 99, hp: 999 },
  };
  V.DEF = DEF;
  const SPRITE_KIND = { sedan: 'sedan', limo: 'limo', gunner: 'gunner', slasher: 'slasher', bike: 'bike', civcar: 'civcar', civvan: 'civvan', civbus: 'civbus', patrol: 'patrol', gunboat: 'gunboat' };

  V.spawn = function (g, kind, x, y, o) {
    const d = DEF[kind];
    const e = Object.assign({
      id: ++uid, kind, team: d.team, x, y, vx: 0, wantVx: 0, ev: g.speed, evT: g.speed, w: d.w, h: d.h, mass: d.mass, hp: d.hp, maxHp: d.hp, ang: 0, spin: 0, loss: 0, stun: 0, blind: 0, flash: 0, t: 0,
      pal: d.team === 'civ' ? U.randInt(0, G.gfx.art.CIV_PALS - 1) : U.randInt(0, G.gfx.art.ENEMY_PALS - 1), dead: false, lastHit: null, cd: U.rand(0.6, 1.8), side: U.chance(0.5) ? 1 : -1, air: !!d.air, obst: !!d.obst,
      crash: 0, rate: U.rand(0.55, 0.8), life: 0, seed: Math.random() * 10,
    }, o || {});
    if (kind === 'rock') { e.size = e.size === undefined ? U.randInt(0, 2) : e.size; const s = [[28, 26], [42, 38], [60, 54]][e.size]; e.w = s[0]; e.h = s[1]; e.ang = U.rand(0, TAU); }
    g.en.push(e);
    return e;
  };

  /* ---------- damage and death ---------- */
  V.damage = function (g, e, dmg, src) {
    if (e.dead || e.crash) return;
    if (src === 'player') e.lastHit = 'player';
    if (e.obst && e.kind === 'rock') return;
    e.hp -= dmg; e.flash = 0.08;
    if (e.hp <= 0) V.kill(g, e, src);
    else A.sfx.hit();
  };
  V.kill = function (g, e, src) {
    if (e.dead) return;
    e.dead = true;
    const big = e.kind === 'limo' || e.kind === 'civbus' || e.air ? 2.2 : e.kind === 'bike' || e.kind === 'mine' ? 0.9 : 1.5;
    FX.explosion(e.x, e.y, big, e.team === 'civ' ? 40 : e.kind === 'mine' ? 20 : 8);
    if (e.air) { FX.debris(e.x, e.y, 8, 'hsla(200,80%,60%,1)', 220); A.sfx.boom(2); } else A.sfx.boom(big > 1.8 ? 1 : 0);
    if (e.kind === 'mine') FX.ring(e.x, e.y, 6, 52, 'hsla(20,100%,65%,1)', 0.45, 3);
    if (e.team === 'enemy') g.award(DEF[e.kind].pts, e.x, e.y);
    else if (e.team === 'civ' && e.lastHit === 'player') g.civPenalty(e.x, e.y);
    if (e.kind === 'mine' && e.near) g.hurtPlayer(30, e.x);
  };
  const skid = (e, t) => { e.loss = Math.max(e.loss, t); e.spin = U.rand(6, 9) * (U.chance(0.5) ? 1 : -1); e.vx += U.rand(-70, 70); };
  V.skid = skid;

  /* ---------- AI ---------- */
  const follow = (e, tx, gain, max) => { e.wantVx = U.clamp((U.clamp(tx, L + 16, R - 16) - e.x) * gain, -max, max); };   /* never aim for a spot off the road */
  function ahead(g, e) {                                                  /* the nearest slower vehicle in my lane just ahead (smaller y) */
    let best = null;
    for (const o of g.en) { if (o === e || o.dead || o.air || o.crash || Math.abs(o.x - e.x) > 26 || o.y >= e.y || e.y - o.y > e.h / 2 + o.h / 2 + 38) continue; if (!best || o.y > best.y) best = o; }
    return best;
  }
  const AI = {
    civ(g, e, dt) {
      e.evT = g.cruise * e.rate;
      const o = ahead(g, e); if (o) e.evT = Math.min(e.evT, o.ev - 4);
      e.wantVx = (e.laneT === undefined ? 0 : U.clamp((e.laneT - e.x) * 2, -70, 70));
      e.cd -= dt;
      if (e.cd <= 0) { e.cd = U.rand(4, 9); if (U.chance(0.25)) { const nl = e.x + U.pick([-C.LANE_W, C.LANE_W]); if (nl > L + 22 && nl < R - 22) e.laneT = nl; } }     /* only ever into another lane of the road */
      if (e.laneT !== undefined && Math.abs(e.laneT - e.x) < 3) e.laneT = undefined;
    },
    sedan(g, e, dt) {                                                      /* a bumper-car ram: get alongside, then swing in */
      const P = g.player, dy = e.y - P.y;
      e.evT = g.cruise + U.clamp(dy * 1.1, -90, 130);
      if (e.blind > 0) { e.wantVx = 0; return; }
      e.cd -= dt;
      if (e.cool > 0) { e.cool -= dt; follow(e, P.x + e.side * 120, 1.2, 130); return; }
      if (Math.abs(dy) < 80) follow(e, P.x, 2.0, 150);
      else follow(e, P.x + e.side * 52, 1.4, 120);
    },
    limo(g, e, dt) {
      const P = g.player, dy = e.y - P.y;
      e.evT = g.cruise + U.clamp(dy * 0.9, -60, 90);
      if (e.blind > 0) { e.wantVx = 0; return; }
      if (e.cool > 0) { e.cool -= dt; follow(e, P.x + e.side * 130, 1, 80); return; }
      if (Math.abs(dy) < 100) follow(e, P.x, 1.6, 120); else follow(e, P.x + e.side * 60, 1, 80);
    },
    gunner(g, e, dt) {
      const P = g.player, dy = e.y - P.y;
      e.evT = g.cruise + U.clamp((dy + 30) * 1.1, -90, 130);
      const tx = U.clamp(P.x + e.side * 78, L + 18, R - 18);
      follow(e, tx, 1.5, 130);
      if (e.blind > 0 || e.stun > 0) return;
      e.cd -= dt;
      if (e.cd <= 0 && Math.abs(dy) < 120 && Math.abs(P.x - e.x) < 150 && P.alive && !P.docked) {
        e.burst = 3; e.cd = U.rand(2.0, 3.2);
      }
      if (e.burst > 0) { e.bt = (e.bt || 0) - dt; if (e.bt <= 0) { e.bt = 0.12; e.burst--; const a = Math.atan2(P.y - e.y, P.x - e.x) + U.rand(-0.06, 0.06); g.ebullet(e.x, e.y, Math.cos(a) * 380, Math.sin(a) * 380 + (g.speed - e.ev), 4, 'eb'); A.sfx.enemyShot(); } }
    },
    slasher(g, e, dt) {
      const P = g.player, dy = e.y - P.y;
      e.evT = g.cruise + U.clamp(dy * 1.2, -90, 120);
      const dx = P.x - e.x;
      follow(e, P.x - e.side * 30 * (Math.abs(dy) < 40 ? 0.9 : 2), 1.6, 130);
      e.blades = Math.abs(dy) < 36 && Math.abs(dx) < 50 && e.stun <= 0 && e.blind <= 0;
      if (e.blades) {
        e.cd -= dt;
        if (e.cd <= 0) { e.cd = 0.6; g.hurtPlayer(3, e.x, 90); FX.sparks((e.x + P.x) / 2, P.y, 6, 150, 'hsla(50,100%,70%,1)', 0.3, 1.4); A.sfx.scrape(); }
      }
    },
    bike(g, e, dt) {
      const P = g.player, dy = e.y - P.y;
      e.evT = g.cruise * 1.5;
      e.wantVx = U.clamp((U.clamp(P.x, L + 20, R - 20) - e.x) * 1.2 + Math.sin(e.t * 3 + e.seed) * 50, -120, 120);
      if (dy < -80) e.wantVx *= 0.3;
    },
    heli(g, e, dt) { airAI(g, e, dt, false); },
    gunship(g, e, dt) { airAI(g, e, dt, true); },
    patrol(g, e, dt) { AI.sedan(g, e, dt); },
    gunboat(g, e, dt) { AI.gunner(g, e, dt); },
    mine(g, e, dt) { e.evT = 0; e.wantVx = 0; },
    rock(g, e, dt) { e.evT = 0; e.wantVx = 0; },
    limoBlind() {},
  };
  function airAI(g, e, dt, big) {
    const P = g.player;
    e.life += dt;
    if (e.stun > 0 || !P.alive) { e.vyA = (e.vyA || 0) * 0.98; e.y += (e.vyA || 0) * dt; return; }
    const out = e.life > (big ? 20 : 15);
    const ty = out ? -160 : (e.hoverY || 150);
    e.y += (ty - e.y) * Math.min(1, 1.4 * dt);
    if (e.blind > 0) e.wantVx = Math.sin(e.t) * 40; else follow(e, P.x, 1.3, 150 + g.lap * 8);
    if (out) { e.wantVx = 0; if (e.y < -120) e.dead = true; return; }
    if (e.life < 1.6) return;
    e.cd -= dt;
    if (e.cd <= 0 && e.blind <= 0 && !P.docked) {
      e.cd = (big ? 2.1 : 2.6) / Math.min(1.6, 1 + g.lap * 0.12);
      const n = big ? 2 : 1;
      for (let i = 0; i < n; i++) g.dropBomb(e.x + (i - (n - 1) / 2) * 34, P.y - 20 + U.rand(-50, 40) + P.vx * 0.1, P.x + P.vx * 0.55 + U.rand(-30, 30));
      if (big) { for (let i = -1; i <= 1; i++) g.ebullet(e.x + i * 16, e.y + 30, i * 40, 330, 5, 'ebm'); A.sfx.enemyShot(); }
    }
    e.cd2 = (e.cd2 === undefined ? 1.2 : e.cd2) - dt;
    if (e.cd2 <= 0 && e.blind <= 0 && !P.docked) {                       /* strafing bursts */
      e.cd2 = U.rand(3.4, 4.6); e.burst = 3; e.bt = 0;
    }
    if (e.burst > 0) { e.bt -= dt; if (e.bt <= 0) { e.bt = 0.1; e.burst--; const a = Math.atan2(P.y - e.y, P.x - e.x); g.ebullet(e.x, e.y + 24, Math.cos(a) * 400, Math.sin(a) * 400, 4, 'ebm'); A.sfx.enemyShot(); } }
  }

  /* ---------- collisions: bumper cars ---------- */
  function boxes(a, b) {
    const ox = (a.w + b.w) / 2 - Math.abs(b.x - a.x), oy = (a.h + b.h) / 2 - Math.abs(b.y - a.y);
    return ox > 0 && oy > 0 ? { ox, oy } : null;
  }
  /* returns the impact strength (0 = none) */
  function bump(g, a, b, aIsPlayer) {
    const hit = boxes(a, b);
    if (!hit) return 0;
    const ma = a.mass, mb = b.mass, tot = ma + mb;
    let imp;
    if (hit.ox < hit.oy * 0.85) {                                           /* side swipe */
      const n = b.x >= a.x ? 1 : -1, rel = (b.vx - a.vx) * n;
      a.x -= n * hit.ox * mb / tot; b.x += n * hit.ox * ma / tot;
      imp = Math.max(-rel, 0) * 1.05 + 62;
      a.vx -= n * imp * mb / tot; b.vx += n * imp * ma / tot;
    } else {                                                                /* rear-ending: the faster one gives way */
      const n = b.y >= a.y ? 1 : -1, ra = a.ev, rb = b.ev, rel = (ra - rb) * -n;
      a.y -= n * hit.oy * mb / tot; b.y += n * hit.oy * ma / tot;
      imp = Math.abs(ra - rb) * 0.9 + 30;
      const avg = (ra * ma + rb * mb) / tot; a.ev += (avg - a.ev) * 0.7; b.ev += (avg - b.ev) * 0.7;
      a.evT = a.ev; b.evT = b.ev;
    }
    return imp;
  }
  V.bump = bump;

  function crashOut(g, e) {
    if (e.crash || e.air) return;
    e.crash = 0.8; e.spin = U.chance(0.5) ? 5 : -5; e.vx = (e.x < W / 2 ? -1 : 1) * Math.max(70, Math.abs(e.vx));
    if (e.team === 'enemy') e.lastHit = 'player';
    A.sfx.skid();
  }

  /* the supply truck is solid: traffic swerves around it, and is never allowed to pass through it */
  function avoidTruck(e, tk, dt) {
    let hit = false;
    for (const b of G.truck.boxes(tk)) {
      const hw = (b.w + e.w) / 2 + 10;
      if (Math.abs(e.x - b.x) >= hw || Math.abs(e.y - b.y) >= (b.h + e.h) / 2 + 36) continue;
      hit = true;
      if (!e.dodge) { let s = e.x >= b.x ? 1 : -1; if (b.x + s * hw > R - 16 || b.x + s * hw < L + 16) s = -s; e.dodge = s; }
      e.wantVx = e.dodge * 150;
      if (Math.abs(e.x - b.x) < hw - 8 && Math.abs(e.y - b.y) < (b.h + e.h) / 2) e.x = U.clamp(e.x + e.dodge * 150 * dt, L + 14, R - 14);
    }
    if (hit) e.x = U.clamp(e.x, L + 14, R - 14); else e.dodge = 0;                                 /* swerving never takes it off the road */
  }

  V.update = function (g, dt) {
    const P = g.player, water = g.surface === 'water', tk = g.truck;
    const docking = P.docked || (tk && (tk.state === 'enter' || tk.state === 'pull' || tk.state === 'shop'));
    for (const e of g.en) {
      if (e.dead) continue;
      e.t += dt; if (e.flash > 0) e.flash -= dt; if (e.blind > 0) e.blind -= dt; if (e.stun > 0) e.stun -= dt;
      if (e.crash) {                                                          /* falling off the road */
        e.crash -= dt; e.ang += e.spin * dt; e.x += e.vx * dt; e.y += (g.speed - e.ev) * dt;
        if (e.crash <= 0) V.kill(g, e, 'crash');
        continue;
      }
      if (e.air) { if (AI[e.kind]) AI[e.kind](g, e, dt); e.vx += (e.wantVx - e.vx) * Math.min(1, 3 * dt); e.x += e.vx * dt; e.ang = e.vx * 0.0016; continue; }
      if (e.loss > 0) {
        e.loss -= dt; e.ang += e.spin * dt; e.vx *= Math.max(0, 1 - 0.7 * dt); e.evT = g.cruise * 0.75;
        e.ev += (e.evT - e.ev) * Math.min(1, 2 * dt);
        if (e.loss <= 0) { e.spin = 0; }
      } else {
        e.ang += (0 - e.ang) * Math.min(1, 7 * dt);
        if (e.stun > 0) { e.evT = e.ev * 0.97; e.wantVx = 0; }
        else if (docking && !e.obst) { e.evT = g.cruise * (e.team === 'civ' ? e.rate : 0.7); e.wantVx = 0; e.blades = false; e.x = U.clamp(e.x, L + 14, R - 14); }        /* while you are in the truck, traffic keeps to its lane and ignores you */
        else if (AI[e.kind]) AI[e.kind](g, e, dt); else AI.civ(g, e, dt);
        if (tk && !e.obst) avoidTruck(e, tk, dt);
        e.ev += (e.evT - e.ev) * Math.min(1, 2.2 * dt);
        e.vx += (e.wantVx - e.vx) * Math.min(1, 4 * dt);
      }
      if (water && g.flow && !e.obst) e.vx += g.flow(e.x, e.y) * dt * 0.7;
      e.x += e.vx * dt; e.y += (g.speed - e.ev) * dt;
      if (e.obst) e.y += 0;
      /* off the road (or into the bank) */
      if (!water) { if (e.x < L - 10 || e.x > R + 10) crashOut(g, e); }
      else if (!e.obst) {
        if (e.x < L + 12) { e.x = L + 12; e.vx = Math.abs(e.vx) * 0.5; } else if (e.x > R - 12) { e.x = R - 12; e.vx = -Math.abs(e.vx) * 0.5; }
      }
      if (e.y > H + 230 || e.y < -330) e.dead = true;
    }
    /* vehicle against vehicle */
    const en = g.en;
    for (let i = 0; i < en.length; i++) {
      const a = en[i]; if (a.dead || a.air || a.crash) continue;
      for (let j = i + 1; j < en.length; j++) {
        const b = en[j]; if (b.dead || b.air || b.crash) continue;
        if (a.obst && b.obst) continue;
        if (Math.abs(a.y - b.y) > (a.h + b.h) / 2 || Math.abs(a.x - b.x) > (a.w + b.w) / 2) continue;
        const imp = bump(g, a, b);
        if (imp > 150) { const dm = (imp - 120) / 220; if (a.team !== 'neutral' && !a.obst) V.damage(g, a, dm * (b.mass / a.mass) * 0.5, b.lastHit === 'player' ? 'player' : null); if (b.team !== 'neutral' && !b.obst) V.damage(g, b, dm * (a.mass / b.mass) * 0.5, a.lastHit === 'player' ? 'player' : null); }
        if (a.kind === 'mine' && b.team !== 'neutral') { a.near = false; V.kill(g, a, 'mine'); }
        if (b.kind === 'mine' && a.team !== 'neutral') { b.near = false; V.kill(g, b, 'mine'); }
        if (a.blades && b.team !== 'enemy') V.damage(g, b, 2, 'player');
        if (b.blades && a.team !== 'enemy') V.damage(g, a, 2, 'player');
      }
    }
    /* the player against the traffic */
    if (P.alive && !P.docked && !P.conv) for (const e of en) {
      if (e.dead || e.air || e.crash) continue;
      if (Math.abs(e.y - P.y) > (e.h + P.h) / 2 || Math.abs(e.x - P.x) > (e.w + P.w) / 2) continue;
      if (e.kind === 'mine') { e.near = true; V.kill(g, e, 'mine'); continue; }
      const pm = P.mass, em = e.mass, ev0 = P.vx;
      const mine = { x: P.x, y: P.y, w: P.w, h: P.h, vx: P.vx, ev: g.cruise, mass: pm, evT: 0 };
      const imp = bump(g, mine, e);
      if (!imp) continue;
      P.x = mine.x; P.vx = mine.vx; P.y += (mine.y - P.y) * 0.4;
      if (e.kind === 'rock') { g.hurtPlayer(Math.min(34, 10 + Math.abs(imp) * 0.06), e.x, imp); FX.sparks(P.x, P.y - 10, 8, 180, 'hsla(50,100%,70%,1)', 0.35, 1.6); A.sfx.crash(); }
      else {
        e.lastHit = 'player';
        if (imp > 90 && (e.kind === 'sedan' || e.kind === 'limo' || e.kind === 'patrol')) e.cool = 1.6;       /* a rammer backs off after it connects */
        const dm = Math.min(7, Math.max(0, (imp - 120) * 0.035) * (em / (em + pm)) * 2);
        if (dm > 0) g.hurtPlayer(dm, e.x, imp);
        if (imp > 120 && e.team !== 'neutral') V.damage(g, e, (imp - 100) / 130 * (pm / (pm + em)) * 2.2, 'player');
        if (imp > 100) { FX.sparks((e.x + P.x) / 2, (e.y + P.y) / 2, 7, 160, 'hsla(50,100%,70%,1)', 0.3, 1.4); A.sfx.crash(); FX.addShake(Math.min(5, imp / 90)); }
      }
    }
    g.en = en.filter((e) => !e.dead);
  };

  /* ---------- drawing ---------- */
  function wake(ctx, e, g) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const sp = Math.max(0, g.speed - e.ev * 0 + 0) / 300;
    ctx.fillStyle = 'rgba(200,240,255,0.22)';
    ctx.beginPath(); ctx.moveTo(e.x - e.w * 0.3, e.y + e.h * 0.4); ctx.lineTo(e.x + e.w * 0.3, e.y + e.h * 0.4); ctx.lineTo(e.x + e.w * 0.9 + 6, e.y + e.h * 0.4 + 70 * sp); ctx.lineTo(e.x - e.w * 0.9 - 6, e.y + e.h * 0.4 + 70 * sp); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  V.drawGround = function (ctx, g) {
    const t = g.time, art = GFX.art, water = g.surface === 'water' || Road.surfaceAt(g.dist + 300) === 'water';
    const list = g.en.filter((e) => !e.air).sort((a, b) => a.y - b.y);
    for (const e of list) {
      if (e.y < -150 || e.y > H + 150) continue;
      if (e.kind === 'rock') { GFX.draw(ctx, GFX.spr.rock[e.size], e.x, e.y, e.ang, 1, 1); continue; }
      if (e.kind === 'mine') {
        const bob = Math.sin(t * 2.2 + e.seed) * 1.4;
        GFX.draw(ctx, GFX.spr.mine, e.x, e.y + bob, 0, 1, 1);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 7 + e.seed); GFX.drawGlow(ctx, 'rgba(255,50,60,1)', e.x, e.y + bob, 9, 1); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        continue;
      }
      if (DEF[e.kind] && DEF[e.kind].water) wake(ctx, e, g);
      const spr = art.veh(SPRITE_KIND[e.kind], e.pal, e.flash > 0);
      if (e.stun > 0) { ctx.globalCompositeOperation = 'lighter'; GFX.drawGlow(ctx, 'rgba(120,200,255,1)', e.x, e.y, 34, 0.25 + 0.15 * Math.sin(t * 30)); ctx.globalCompositeOperation = 'source-over'; }
      GFX.draw(ctx, spr, e.x, e.y, e.ang, 1, 1);
      if (e.blades) { ctx.strokeStyle = '#e8ecff'; ctx.lineWidth = 2; ctx.beginPath(); for (const s of [-1, 1]) { ctx.moveTo(e.x + s * (e.w / 2 - 1), e.y - 10); ctx.lineTo(e.x + s * (e.w / 2 + 11), e.y - 2); ctx.lineTo(e.x + s * (e.w / 2 + 3), e.y + 4); ctx.moveTo(e.x + s * (e.w / 2 - 1), e.y + 14); ctx.lineTo(e.x + s * (e.w / 2 + 11), e.y + 22); } ctx.stroke(); }
      if (e.crash) { ctx.globalCompositeOperation = 'lighter'; GFX.drawGlow(ctx, 'rgba(255,140,40,1)', e.x, e.y, 26, 0.6); ctx.globalCompositeOperation = 'source-over'; }
      if (e.hp < e.maxHp && e.team === 'enemy' && e.kind !== 'bike' && e.hp / e.maxHp < 0.5) { if (Math.random() < 0.3) FX.smoke(e.x, e.y + 10, 1, 7); }
    }
  };
  V.drawAir = function (ctx, g) {
    const t = g.time, art = GFX.art;
    for (const e of g.en) {
      if (!e.air || e.dead) continue;
      const big = e.kind === 'gunship', spr = art.heli(e.pal, big, e.flash > 0);
      const sh = 1 - Math.min(0.6, Math.abs(e.y - g.player.y) / 900);
      ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(e.x + 14, e.y + 34, (big ? 38 : 28), (big ? 52 : 38), 0, 0, TAU); ctx.fill(); ctx.restore();
      GFX.draw(ctx, spr, e.x, e.y, e.ang, 1, 1);
      const rs = e.stun > 0 ? 0.25 : 1, z = big ? 1.4 : 1, a = t * 28 * rs;
      ctx.save(); ctx.translate(e.x, e.y);
      ctx.fillStyle = 'rgba(180,200,235,0.16)'; ctx.beginPath(); ctx.arc(0, 0, 44 * z, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(20,24,44,0.85)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) { const b = a + i * TAU / 3; ctx.beginPath(); ctx.moveTo(Math.cos(b) * 5, Math.sin(b) * 5); ctx.lineTo(Math.cos(b) * 44 * z, Math.sin(b) * 44 * z); ctx.stroke(); }
      ctx.fillStyle = '#9aa6c8'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
      ctx.translate(0, 38 * z); ctx.strokeStyle = 'rgba(20,24,44,0.8)'; ctx.lineWidth = 1.8; const c2 = a * 1.6; ctx.beginPath(); ctx.moveTo(Math.cos(c2) * 9, Math.sin(c2) * 9); ctx.lineTo(-Math.cos(c2) * 9, -Math.sin(c2) * 9); ctx.stroke();
      ctx.restore();
      if (e.hp < e.maxHp * 0.5 && Math.random() < 0.35) FX.smoke(e.x, e.y + 12, 1, 9);
      if (e.stun > 0) { ctx.globalCompositeOperation = 'lighter'; GFX.drawGlow(ctx, 'rgba(120,200,255,1)', e.x, e.y, 50, 0.3 + 0.15 * Math.sin(t * 30)); ctx.globalCompositeOperation = 'source-over'; }
      if (e.hp < e.maxHp) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(e.x - 18, e.y - 54 * z, 36, 4); ctx.fillStyle = '#ff4a6a'; ctx.fillRect(e.x - 18, e.y - 54 * z, 36 * Math.max(0, e.hp / e.maxHp), 4); }
    }
  };
})((window.SGS = window.SGS || {}));
