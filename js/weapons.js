/* Weapons and hazards: machine gun, missiles, oil slicks / mines, smoke, EMP, the shield, enemy fire and helicopter bombs. All of it is ammo-limited. */
(function (G) {
  'use strict';
  const U = G.U, C = G.C, FX = G.fx, GFX = G.gfx, A = G.audio, V = G.veh, TAU = U.TAU, W = C.W, H = C.H;
  const Wp = {};
  G.weapons = Wp;

  Wp.MG_RATE = 11;

  /* ---------- the machine gun ---------- */
  Wp.fireMG = function (g, P) {
    if (P.fireCd > 0) return;
    if (P.ammo.mg <= 0) { if (!P.dry) { P.dry = 0.5; A.sfx.dry(); g.flashHud('mg'); } return; }
    P.fireCd = 1 / Wp.MG_RATE; P.ammo.mg--; P.alt = !P.alt; P.mz = 0.06;
    g.pb.push({ kind: 'mg', x: P.x + (P.alt ? 7 : -7), y: P.y - 32, vx: 0, vy: -980, dmg: 1, life: 1.2, w: 5, h: 14 });
    A.sfx.mg();
  };

  /* ---------- the gadgets ---------- */
  Wp.fireMissile = function (g, P) {
    if (P.ammo.missile <= 0) { A.sfx.dry(); g.flashHud('missile'); return; }
    P.ammo.missile--;
    g.pb.push({ kind: 'missile', x: P.x, y: P.y - 34, vx: P.vx * 0.3, vy: -360, dmg: 6, life: 3.4, w: 8, h: 22, target: null, t: 0 });
    A.sfx.missile();
  };
  Wp.dropOil = function (g, P) {
    if (P.ammo.oil <= 0) { A.sfx.dry(); g.flashHud('oil'); return; }
    P.ammo.oil--;
    if (P.mode === 'boat') g.hz.push({ type: 'mine', x: P.x, y: P.y + 44, r: 20, life: 30, arm: 0.7, t: 0 });
    else g.hz.push({ type: 'oil', x: P.x, y: P.y + 46, r: 27, life: 16, t: 0 });
    A.sfx.oil();
  };
  Wp.smoke = function (g, P) {
    if (P.ammo.smoke <= 0) { A.sfx.dry(); g.flashHud('smoke'); return; }
    P.ammo.smoke--;
    const puffs = []; for (let i = 0; i < 14; i++) puffs.push({ x: U.rand(-34, 34), y: U.rand(-46, 46), r: U.rand(20, 34), a: U.rand(0, TAU), ph: U.rand(0, 6) });
    g.hz.push({ type: 'smoke', x: P.x, y: P.y + 70, r: 62, life: 7, t: 0, puffs });
    A.sfx.smoke();
  };
  Wp.emp = function (g, P) {
    if (P.ammo.emp <= 0) { A.sfx.dry(); g.flashHud('emp'); return; }
    P.ammo.emp--;
    A.sfx.emp(); FX.doFlash(0.55, '120,220,255'); FX.addShake(8);
    FX.ring(P.x, P.y, 10, 520, 'hsla(190,100%,70%,1)', 0.7, 6); FX.ring(P.x, P.y, 6, 380, 'hsla(300,100%,70%,1)', 0.55, 3);
    for (const e of g.en) {
      if (e.dead || e.crash) continue;
      if (e.y < -60 && !e.air) continue;
      if (e.kind === 'rock') continue;
      e.lastHit = e.team === 'civ' ? null : 'player';
      if (e.air) { V.damage(g, e, 5, 'player'); e.stun = 3.5; }
      else if (e.kind === 'bike' || e.kind === 'mine') V.kill(g, e, 'emp');
      else { e.stun = Math.max(e.stun, 2.6); e.burst = 0; V.damage(g, e, 1.5, 'player'); }
    }
    g.eb.length = 0; g.bombs.length = 0;
  };
  Wp.shield = function (g, P) {
    if (P.ammo.shield <= 0) { A.sfx.dry(); g.flashHud('shield'); return; }
    if (P.shield > 20) return;
    P.ammo.shield--; P.shield = 60; P.shieldT = 12;
    A.sfx.shield(); FX.ring(P.x, P.y, 8, 54, 'hsla(190,100%,70%,1)', 0.5, 3);
  };

  /* ---------- enemy fire ---------- */
  G.game.ebullet = function (x, y, vx, vy, dmg, kind) { if (this.eb.length > 60) return; this.eb.push({ x, y, vx, vy, dmg, kind: kind || 'eb', life: 4 }); };
  G.game.dropBomb = function (fromX, targetY, targetX) {
    this.bombs.push({ x: targetX, y: targetY, fx: fromX, t: 0, fuse: 1.0, r: 46 });
    A.sfx.bombDrop();
  };

  function explode(g, x, y, r, dmg, size) {
    FX.explosion(x, y, size || 1.4, 18); FX.ring(x, y, 6, r, 'hsla(30,100%,65%,1)', 0.4, 3); A.sfx.boom(0);
    for (const e of g.en) { if (e.dead || e.air || e.crash || e.kind === 'rock') continue; const d = Math.hypot(e.x - x, e.y - y); if (d < r + e.w * 0.4) { e.lastHit = 'player'; V.damage(g, e, dmg * (1 - d / (r + 30) * 0.5), 'player'); } }
  }

  /* ---------- per-frame ---------- */
  Wp.update = function (g, dt) {
    const P = g.player, sp = g.speed;
    /* player bullets and missiles */
    for (const b of g.pb) {
      b.t = (b.t || 0) + dt; b.life -= dt;
      if (b.kind === 'missile') {
        if (!b.target || b.target.dead) {
          let best = null, bd = 1e9;
          for (const e of g.en) { if (e.dead || e.crash || e.team !== 'enemy' || e.y > b.y + 10 || e.y < -40 || Math.abs(e.x - b.x) > 190) continue; const d = Math.abs(e.x - b.x) * 1.4 + (b.y - e.y) * 0.6 - (e.air ? 80 : 0); if (d < bd) { bd = d; best = e; } }
          b.target = best;
        }
        const spd = Math.min(640, 360 + b.t * 420);
        let ang = Math.atan2(b.vy, b.vx);
        if (b.target) { const want = Math.atan2(b.target.y - b.y, b.target.x - b.x); let d = want - ang; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; ang += U.clamp(d, -4.2 * dt, 4.2 * dt); }
        else { let d = -Math.PI / 2 - ang; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; ang += U.clamp(d, -2 * dt, 2 * dt); }
        b.vx = Math.cos(ang) * spd; b.vy = Math.sin(ang) * spd; b.ang = ang;
        if (Math.random() < 0.9) FX.trail(b.x - b.vx * 0.02, b.y - b.vy * 0.02, 'rgba(255,170,60,1)', 6, 0.28);
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.life <= 0 || b.y < -60 || b.x < 20 || b.x > W - 20) { b.dead = true; continue; }
      for (const e of g.en) {
        if (e.dead || e.crash) continue;
        const hw = (e.w + b.w) / 2, hh = (e.h + b.h) / 2;
        if (Math.abs(e.x - b.x) > hw || Math.abs(e.y - b.y) > hh) continue;
        if (e.air && e.y < 0) continue;
        if (e.kind === 'rock') { b.dead = true; FX.sparks(b.x, b.y, 3, 120, 'hsla(50,100%,70%,1)', 0.2, 1.2); break; }
        if (b.kind === 'missile') { b.dead = true; explode(g, b.x, b.y, 40, 6, 1.5); if (e.air) { e.lastHit = 'player'; V.damage(g, e, 5, 'player'); } break; }
        const mul = e.air ? 0.25 : e.kind === 'limo' ? 0.12 : 1;
        FX.sparks(b.x, b.y, 3, 140, 'hsla(190,100%,75%,1)', 0.22, 1.3);
        if (e.kind === 'limo' || e.air) A.sfx.ping();
        V.damage(g, e, b.dmg * mul, 'player');
        b.dead = true; break;
      }
    }
    g.pb = g.pb.filter((b) => !b.dead);

    /* enemy bullets */
    if (P.alive && !P.docked) for (const b of g.eb) {
      b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.life <= 0 || b.y > H + 40 || b.y < -60 || b.x < 0 || b.x > W) { b.dead = true; continue; }
      if (Math.abs(b.x - P.x) < P.w / 2 + 4 && Math.abs(b.y - P.y) < P.h / 2 + 4) { b.dead = true; g.hurtPlayer(b.dmg, b.x - b.vx * 0.1, 60); FX.sparks(b.x, b.y, 4, 120, 'hsla(20,100%,65%,1)', 0.25, 1.3); }
    } else for (const b of g.eb) { b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.life <= 0) b.dead = true; }
    g.eb = g.eb.filter((b) => !b.dead);

    /* helicopter bombs: a marker on the road, then a blast */
    for (const bm of g.bombs) {
      bm.t += dt; bm.y += sp * dt;
      if (bm.t >= bm.fuse) {
        bm.dead = true; explode(g, bm.x, bm.y, bm.r, 2, 1.8); FX.addShake(5);
        if (P.alive && !P.docked && !P.conv && Math.hypot(P.x - bm.x, P.y - bm.y) < bm.r + 12) g.hurtPlayer(28, bm.x, 160);
      }
    }
    g.bombs = g.bombs.filter((b) => !b.dead);

    /* ground hazards scroll with the road */
    for (const h of g.hz) {
      h.t += dt; h.y += sp * dt; h.life -= dt;
      if (h.life <= 0 || h.y > H + 90) { h.dead = true; continue; }
      if (h.type === 'oil') {
        for (const e of g.en) { if (e.dead || e.air || e.crash || e.obst || e.loss > 0) continue; if (Math.abs(e.x - h.x) < h.r + e.w / 2 - 6 && Math.abs(e.y - h.y) < h.r + e.h / 2 - 10) { e.lastHit = 'player'; V.skid(e, 1.7); A.sfx.skid(); } }
      } else if (h.type === 'smoke') {
        if (Math.random() < 0.5) FX.smoke(h.x + U.rand(-30, 30), h.y + U.rand(-40, 40), 1, 18);
        for (const e of g.en) { if (e.dead || e.kind === 'rock') continue; if (Math.hypot(e.x - h.x, e.y - h.y) < h.r + e.w * 0.3) e.blind = 2.6; }
        if (h.life < 0.3) h.dead = true;
      } else if (h.type === 'mine') {
        if (h.t > h.arm) for (const e of g.en) { if (e.dead || e.air || e.team !== 'enemy' || e.obst) continue; if (Math.abs(e.x - h.x) < h.r + e.w / 2 && Math.abs(e.y - h.y) < h.r + e.h / 2) { h.dead = true; explode(g, h.x, h.y, 46, 8, 1.6); break; } }
      }
    }
    g.hz = g.hz.filter((h) => !h.dead);
  };

  /* ---------- drawing ---------- */
  Wp.drawHazards = function (ctx, g) {
    const t = g.time;
    for (const h of g.hz) {
      if (h.type === 'oil') { ctx.globalAlpha = Math.min(1, h.life / 2); GFX.draw(ctx, GFX.spr.oil, h.x, h.y, 0, 1.1, 1.1); ctx.globalAlpha = 1; }
      else if (h.type === 'mine') { GFX.draw(ctx, GFX.spr.mine, h.x, h.y + Math.sin(t * 2 + h.x) * 1.2, 0, 0.9, 0.9); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = h.t > h.arm ? 0.5 + 0.5 * Math.sin(t * 9) : 0.2; GFX.drawGlow(ctx, 'rgba(60,255,160,1)', h.x, h.y, 9, 1); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    for (const bm of g.bombs) {                                           /* the blast marker */
      const k = bm.t / bm.fuse;
      ctx.save(); ctx.strokeStyle = 'rgba(255,60,70,' + (0.35 + 0.4 * Math.abs(Math.sin(bm.t * 14))) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bm.x, bm.y, bm.r, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(255,60,70,' + (0.06 + 0.16 * k) + ')'; ctx.fill();
      ctx.beginPath(); ctx.arc(bm.x, bm.y, bm.r * (1 - k), 0, TAU); ctx.stroke(); ctx.restore();
      const bx = U.lerp(bm.fx, bm.x, k), by = U.lerp(bm.y - 260, bm.y, k * k);
      GFX.draw(ctx, GFX.spr.bomb, bx, by, 0, 0.7 + 0.5 * (1 - k), 0.7 + 0.5 * (1 - k));
    }
  };
  Wp.drawSmoke = function (ctx, g) {
    for (const h of g.hz) {
      if (h.type !== 'smoke') continue;
      const a = Math.min(1, h.life / 1.2) * Math.min(1, h.t / 0.4);
      for (const p of h.puffs) {
        const r = p.r * (1 + Math.min(0.6, h.t * 0.2)), px = h.x + p.x + Math.sin(g.time * 0.8 + p.ph) * 4, py = h.y + p.y;
        ctx.globalAlpha = 0.5 * a; ctx.fillStyle = GFX.rg(ctx, px, py, 0, r, [[0, 'rgba(150,160,185,0.85)'], [0.6, 'rgba(90,100,130,0.6)'], [1, 'rgba(60,70,100,0)']]);
        ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };
  Wp.drawShots = function (ctx, g) {
    const spr = GFX.spr;
    for (const b of g.pb) {
      if (b.kind === 'missile') GFX.draw(ctx, spr.missile, b.x, b.y, (b.ang || -Math.PI / 2) + Math.PI / 2, 1, 1);
      else GFX.draw(ctx, spr.mg, b.x, b.y, 0, 1, 1);
    }
    for (const b of g.eb) GFX.draw(ctx, b.kind === 'ebm' ? spr.ebm : spr.eb, b.x, b.y, b.kind === 'ebm' ? Math.atan2(b.vy, b.vx) - Math.PI / 2 : 0, 1, 1);
    ctx.globalCompositeOperation = 'lighter';
    for (const b of g.pb) GFX.drawGlow(ctx, b.kind === 'missile' ? 'rgba(255,170,60,1)' : 'rgba(55,230,255,1)', b.x, b.y, b.kind === 'missile' ? 14 : 9, 0.5);
    for (const b of g.eb) GFX.drawGlow(ctx, 'rgba(255,90,60,1)', b.x, b.y, 9, 0.5);
    ctx.globalCompositeOperation = 'source-over';
  };
})((window.SGS = window.SGS || {}));
