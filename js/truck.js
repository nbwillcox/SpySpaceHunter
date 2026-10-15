/* The supply truck (a red semi on the road, a barge on the water). It drifts down the screen with no warning; line up with its rear ramp to drive in. Then the world slows, it pulls over, the shop opens,
   and when you leave it lets you out and drives off. */
(function (G) {
  'use strict';
  const U = G.U, C = G.C, FX = G.fx, GFX = G.gfx, A = G.audio, I = G.input, Road = G.road, W = C.W, H = C.H, L = C.ROAD_L, R = C.ROAD_R;
  const T = {};
  G.truck = T;
  /* geometry of the rig, from the cab's nose (y) downwards */
  const CAB = 66, GAP = 4, TRL = 188, RAMP = 34, BARGE = 214;

  T.spawn = function (g) {
    const water = g.surface === 'water' || Road.surfaceAt(g.dist + 300) === 'water';
    const lane = U.randInt(1, 6), x = C.laneX(lane);
    g.truck = { kind: water ? 'barge' : 'truck', x, y: -(water ? BARGE + 40 : CAB + TRL + RAMP + 30), ev: g.speed * 0.55, state: 'drift', t: 0, vx: 0, shopped: false };
    for (const e of g.en) { if (Math.abs(e.x - x) < 60 && e.y < 240 && !e.air) e.dead = true; }          /* clear the lane it arrives in */
  };
  /* the solid parts of the rig as boxes (cab, trailer / barge) and the ramp's landing patch */
  T.boxes = function (tk) {
    if (tk.kind === 'barge') return [{ x: tk.x, y: tk.y + 100, w: 54, h: 190 }];
    return [{ x: tk.x, y: tk.y + CAB / 2, w: 44, h: CAB - 4 }, { x: tk.x, y: tk.y + CAB + GAP + TRL / 2, w: 46, h: TRL - 4 }];
  };
  T.ramp = function (tk) {
    const end = tk.kind === 'barge' ? tk.y + BARGE - 4 : tk.y + CAB + GAP + TRL;
    return { x: tk.x, y: end + RAMP / 2 - 6, w: 36, h: RAMP, bottom: end + RAMP - 6 };
  };
  const parkX = (tk) => (tk.kind === 'barge' ? L + 40 : R - 34);

  T.update = function (g, dt) {
    const tk = g.truck, P = g.player;
    if (!tk) return;
    tk.t += dt;
    if (tk.state === 'drift') {
      tk.ev = g.speed * 0.55;
      tk.y += (g.speed - tk.ev) * dt; tk.x += tk.vx * dt;
      if (tk.y > H + 320) { g.truck = null; return; }
      /* solid body: the car can ram it */
      if (P.alive && !P.docked && !P.conv) {
        for (const b of T.boxes(tk)) {
          const ox = (b.w + P.w) / 2 - Math.abs(P.x - b.x), oy = (b.h + P.h) / 2 - Math.abs(P.y - b.y);
          if (ox > 0 && oy > 0) {
            if (ox < oy * 0.9) { const n = P.x >= b.x ? 1 : -1; P.x += n * ox; P.vx = n * Math.max(120, Math.abs(P.vx)); g.hurtPlayer(6, b.x, 140); }
            else { P.y = b.y + (b.h + P.h) / 2 + 0.5; tk.ev += 0; g.hurtPlayer(4, b.x, 60); }
            FX.sparks(P.x, P.y - 20, 6, 150, 'hsla(50,100%,70%,1)', 0.3, 1.4); A.sfx.crash();
          }
        }
        const rp = T.ramp(tk);
        if (Math.abs(P.x - rp.x) < 19 && P.y - P.h / 2 < rp.bottom - 4 && P.y - P.h / 2 > rp.y - 40 && Math.abs(P.vx) < 190) {
          tk.state = 'enter'; tk.t = 0; P.docked = true; g.dockPhase = 'enter';
          g.eb.length = 0; g.bombs.length = 0; P.invuln = Math.max(P.invuln, 6);
          A.sfx.dock();
        }
      }
    } else if (tk.state === 'enter') {                                    /* the car rolls up the ramp and in */
      const k = Math.min(1, tk.t / 1.3);
      tk.y += (g.speed - tk.ev) * dt * (1 - k);
      P.x += (tk.x - P.x) * Math.min(1, 6 * dt);
      const inside = tk.kind === 'barge' ? tk.y + 150 : tk.y + CAB + GAP + 110;
      P.y += (inside - P.y) * Math.min(1, 3.2 * dt);
      P.vx = 0;
      if (tk.t > 1.3) { tk.state = 'pull'; tk.t = 0; A.sfx.truckHorn(); }
    } else if (tk.state === 'pull') {                                     /* it pulls over to the shoulder / bank and stops */
      const k = Math.min(1, tk.t / 2.6);
      tk.x += (parkX(tk) - tk.x) * Math.min(1, 1.8 * dt);
      tk.y += (150 - tk.y) * Math.min(1, 1.3 * dt);
      const inside = tk.kind === 'barge' ? tk.y + 150 : tk.y + CAB + GAP + 110;
      P.x += (tk.x - P.x) * Math.min(1, 8 * dt); P.y += (inside - P.y) * Math.min(1, 8 * dt); P.vx = 0;
      g.dockMul = Math.max(0, 1 - k * 1.05);
      if (tk.t > 2.8) { tk.state = 'shop'; g.dockMul = 0; g.speed = 0; g.cruise = 0; g.openShop(); }
    } else if (tk.state === 'shop') {
      /* the game is paused by the main loop; nothing moves */
    } else if (tk.state === 'exit') {                                     /* the car rolls out of the ramp, the truck pulls away, and you have the wheel back almost at once */
      const k = Math.min(1, tk.t / 1.8);
      const rp = T.ramp(tk), outY = rp.bottom + 60;
      if (P.docked) { P.y += (outY - P.y) * Math.min(1, 8 * dt); P.x += (tk.x - P.x) * Math.min(1, 8 * dt); }
      g.dockMul = U.easeOutCubic(U.clamp((tk.t - 0.05) / 0.85, 0, 1));
      tk.ev = Math.max(tk.ev, 130 + g.speed * 1.3);                                  /* it always drives away from you, even while you are still getting up to speed */
      tk.y += (g.speed - tk.ev) * dt - 14 * dt * k;
      if (tk.t > 0.3 && P.docked) { P.docked = false; g.dockPhase = null; P.invuln = 2; I.resync(); }
      if (tk.t > 1.8) g.dockPhase = null;
      if (tk.y < -420) { g.truck = null; g.dockMul = 1; }
    }
  };

  T.leave = function (g) {
    const tk = g.truck; if (!tk) return;
    tk.state = 'exit'; tk.t = 0; tk.ev = 130; A.sfx.truckHorn();
  };

  T.draw = function (ctx, g) {
    const tk = g.truck, spr = GFX.spr, P = g.player;
    if (!tk) return;
    if (tk.kind === 'barge') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(200,240,255,0.14)'; ctx.fillRect(tk.x - 36, tk.y + 6, 72, BARGE); ctx.restore();
      GFX.draw(ctx, spr.barge, tk.x, tk.y + 110, 0, 1, 1);
      ctx.save(); ctx.translate(tk.x, tk.y + BARGE - 4); GFX.draw(ctx, spr.ramp, 0, 10, 0, 1, 1); ctx.restore();
    } else {
      GFX.draw(ctx, spr.cab, tk.x, tk.y + CAB / 2, 0, 1, 1);
      GFX.draw(ctx, spr.trailer, tk.x, tk.y + CAB + GAP + TRL / 2, 0, 1, 1);
      GFX.draw(ctx, spr.ramp, tk.x, tk.y + CAB + GAP + TRL + 10, 0, 1, 1);
    }
    if (tk.state === 'drift') { ctx.globalCompositeOperation = 'lighter'; const r = T.ramp(tk); ctx.globalAlpha = 0.25 + 0.2 * Math.sin(g.time * 5); GFX.drawGlow(ctx, 'rgba(255,214,90,1)', r.x, r.y + 8, 34, 1); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  };
  /* the car inside the trailer is drawn over the truck */
  T.drawInside = function (ctx, g) {
    const P = g.player, tk = g.truck;
    if (!tk || !P.docked || !P.alive) return;
    const img = P.mode === 'boat' ? GFX.spr.pboat : GFX.spr.sport;
    if (tk.kind === 'barge') { GFX.draw(ctx, img, P.x, P.y, 0, 0.95, 0.95); return; }          /* the barge deck is open: the boat just sits on it */
    const door = tk.y + CAB + GAP + TRL - 9;                                                    /* where the roof ends and the rear doorway begins */
    ctx.save(); ctx.beginPath(); ctx.rect(0, door, W, H + 400); ctx.clip();                      /* on the ramp and in the doorway the car is visible... */
    GFX.draw(ctx, img, P.x, P.y, 0, 0.95, 0.95); ctx.restore();
    if (P.y - 27 < door) {                                                                      /* ...then it drives under the roof, leaving a faint glowing silhouette */
      ctx.save(); ctx.beginPath(); ctx.rect(0, -60, W, door + 60); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
      GFX.drawGlow(ctx, 'rgba(90,230,255,1)', P.x, P.y, 46, 0.16 + 0.07 * Math.sin(g.time * 4));
      GFX.draw(ctx, img, P.x, P.y, 0, 0.95, 0.95, 0.24); ctx.restore();
    }
  };
})((window.SGS = window.SGS || {}));
