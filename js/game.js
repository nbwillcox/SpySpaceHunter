/* Game state: the car and the boat, damage, lives, zones, traffic spawning, scoring, the shop and the attract-mode driver. */
(function (G) {
  'use strict';
  const U = G.U, C = G.C, FX = G.fx, GFX = G.gfx, A = G.audio, S = G.settings, I = G.input, Road = G.road, V = G.veh, TAU = U.TAU;
  const W = C.W, H = C.H, L = C.ROAD_L, R = C.ROAD_R;
  const Game = { state: 'title', demo: true, time: 0 };
  G.game = Game;

  function newPlayer() {
    return {
      x: W / 2, y: C.CAR_Y, vx: 0, w: 27, h: 54, mass: 1, dmg: 0, mode: 'car', ammo: { mg: 120, missile: 2, oil: 2, smoke: 1, emp: 0, shield: 0 }, armor: 0, armorInt: 1, shield: 0, shieldT: 0,
      invuln: 2.5, alive: true, fireCd: 0, mz: 0, alt: false, docked: false, conv: null, smokeT: 0, pull: 0, armorBroken: false, dry: 0, flash: 0, edgeT: 0, t: 0, ev: 0,
    };
  }

  Game.reset = function (demo) {
    this.demo = !!demo; this.state = 'play';
    const dbg = G.debug || {}, zs = !demo && dbg.zone > 0 && dbg.zone < C.ZONES.length ? C.ZONES[dbg.zone].start + 10 : 0;
    this.score = 0; this.credits = 0; this.lives = C.START_LIVES; this.lap = 0; this.dist = zs; this.time = 0; this.speed = C.SPEED; this.dockMul = 1; this.secT = 0;
    this.zone = -1; this.surface = 'road'; this.spawnT = 1.5; this.airCd = U.rand(16, 26); this.truckSeen = {}; this.convKey = '';
    this.en = []; this.pb = []; this.eb = []; this.hz = []; this.bombs = []; this.truck = null; this.dockPhase = null;
    this.player = newPlayer(); if (zs && Road.surfaceAt(zs) === 'water') this.player.mode = 'boat'; this.banner = null; this.over = false; this.overDone = false; this.respawnT = 0; this.hudFlash = {}; this.civHits = 0;
    this.hi = G.scores.best(); this.flow = (x, y) => 0;
    FX.reset();
    if (demo) { this.player.ammo.mg = 9999; this.player.ammo.missile = 99; }
  };

  /* ---------- scoring ---------- */
  Game.award = function (pts, x, y) {
    if (this.demo) return;
    this.score += pts; this.credits += pts;
    if (x !== undefined && pts >= 100) FX.text(x, y - 18, '+' + pts, pts >= 400 ? '#ffd24a' : '#ffffff', pts >= 400 ? 22 : 16);
  };
  Game.civPenalty = function (x, y) {
    if (this.demo) return;
    this.score = Math.max(0, this.score - 500); this.credits = Math.max(0, this.credits - 500); this.civHits++;
    FX.text(x, y - 20, 'CIVILIAN  -500', '#ff5a6a', 20); FX.doFlash(0.35, '255,40,60'); A.sfx.civ();
  };
  Game.flashHud = function (k) { this.hudFlash[k] = 0.5; };

  /* ---------- the car ---------- */
  Game.perf = function (P) { const d = P.dmg / 100; return { speed: 1 - 0.34 * Math.pow(d, 1.1), steer: 1 - 0.5 * d }; };

  Game.hurtPlayer = function (amount, srcX, imp) {
    const P = this.player;
    if (!P.alive || P.invuln > 0 || P.docked || P.conv || (G.debug && G.debug.god)) return;
    if (srcX !== undefined && imp) P.vx += (P.x >= srcX ? 1 : -1) * Math.min(260, imp * 0.5) / P.mass * 0.45;
    if (this.demo) { P.dmg = Math.min(70, P.dmg + amount * 0.25); return; }
    amount *= 1 - 0.14 * P.armor * P.armorInt;
    if (P.shield > 0) {
      const ab = Math.min(P.shield, amount); P.shield -= ab; amount -= ab;
      FX.ring(P.x, P.y, 14, 44, 'hsla(190,100%,70%,1)', 0.25, 3); A.sfx.shieldHit();
      if (amount <= 0.01) return;
    }
    P.dmg = Math.min(100, P.dmg + amount); P.flash = 0.14; FX.addShake(Math.min(6, 1 + amount * 0.3)); A.sfx.hurt();
    if (P.dmg >= 100) this.loseCar(this.surface === 'water' ? 'sunk' : 'destroyed');
  };

  Game.loseCar = function (why) {
    const P = this.player;
    if (!P.alive) return;
    P.alive = false; P.docked = false; P.conv = null; P.shield = 0;
    FX.explosion(P.x, P.y, 2.6, 18); FX.explosion(P.x, P.y, 1.6, 190); FX.debris(P.x, P.y, 12, 'hsla(190,80%,70%,1)', 260); FX.doFlash(0.5, '255,200,160'); FX.addShake(12);
    A.sfx.boom(1); A.sfx.playerDie();
    if (why === 'off') FX.text(P.x, P.y - 30, 'OFF THE ROAD!', '#ff6a6a', 24);
    this.eb.length = 0; this.bombs.length = 0;
    if (this.demo) { this.respawnT = 1.2; return; }
    this.lives--;
    if (this.lives <= 0) { this.over = true; this.overT = 2.4; G.audio.music('off'); setTimeout(() => A.sfx.gameOver(), 600); } else this.respawnT = 2.3;
  };
  Game.respawn = function () {
    const P = this.player, ammo = P.ammo, armor = P.armor;
    Object.assign(P, newPlayer(), { ammo, armor, mode: this.surface === 'water' ? 'boat' : 'car', invuln: 3.5 });
    for (const e of this.en) if (Math.abs(e.y - P.y) < 220 && Math.abs(e.x - P.x) < 120 && !e.air) e.dead = true;
    this.pb.length = 0; FX.ring(P.x, P.y, 6, 60, 'hsla(190,100%,70%,1)', 0.4, 3);
  };

  Game.startConvert = function (to) {
    const P = this.player;
    P.conv = { t: 0, to, swapped: false }; P.invuln = Math.max(P.invuln, 1.6);
    A.sfx.transform(); FX.ring(P.x, P.y, 8, 90, 'hsla(300,100%,70%,1)', 0.6, 4); FX.doFlash(0.3, '200,240,255');
    FX.text(W / 2, 330, to === 'boat' ? 'BOAT MODE' : 'CAR MODE', '#37e6ff', 26);
  };

  /* ---------- zones ---------- */
  Game.onZone = function (zi) {
    const z = C.ZONES[zi];
    this.zone = zi;
    this.banner = { text: z.name, sub: zi === 0 && this.lap > 0 ? 'LAP ' + (this.lap + 1) : '', t: 0, life: 2.6 };
    if (!this.demo) A.music(z.music);
    Road.warm(zi + 1);
  };
  const zoneKey = (g, zi, surf) => { const id = C.ZONES[zi].id; return id === 'dock1' || id === 'dock2' ? (surf === 'road' ? 'dockRoad' : 'dockWater') : id; };
  const MIX = {
    city: [['civcar', 30], ['civvan', 9], ['civbus', 6], ['sedan', 14], ['gunner', 9], ['slasher', 8], ['limo', 5], ['bikes', 6], ['heli', 3]],
    desert: [['civcar', 12], ['civvan', 4], ['sedan', 12], ['gunner', 14], ['slasher', 8], ['limo', 7], ['bikes', 10], ['heli', 4]],
    town: [['civcar', 34], ['civvan', 12], ['civbus', 8], ['sedan', 10], ['gunner', 6], ['slasher', 10], ['limo', 4], ['bikes', 4], ['heli', 2]],
    dockRoad: [['civcar', 20], ['sedan', 8], ['slasher', 6], ['bikes', 4]],
    dockWater: [['patrol', 10], ['mine', 8], ['rock', 6]],
    rapids: [['rock', 26], ['mine', 10], ['patrol', 10], ['gunboat', 6], ['heli', 2]],
    river: [['patrol', 14], ['gunboat', 10], ['mine', 14], ['rock', 8], ['heli', 3]],
  };

  function freeLane(g, y) {
    for (let t = 0; t < 6; t++) {
      const x = C.laneX(U.randInt(0, C.LANES - 1));
      if (!g.en.some((e) => !e.air && Math.abs(e.x - x) < 38 && Math.abs(e.y - y) < 130)) return x;
    }
    return null;
  }
  Game.spawnTick = function (dt) {
    this.spawnT -= dt; this.airCd -= dt;
    if (this.spawnT > 0) return;
    const d = 1 + 0.18 * this.lap + Math.min(0.4, this.time / 900);
    this.spawnT = U.rand(0.5, 1.0) / d;
    const aheadDist = this.dist + C.CAR_Y + 80, surf = Road.surfaceAt(aheadDist), zi = Road.zoneIndex(((aheadDist % C.LAP) + C.LAP) % C.LAP), key = zoneKey(this, zi, surf);
    if (surf !== this.surface && Road.surfaceAt(this.dist) !== surf && surf === 'water' && this.surface === 'road') { /* the ramp is ahead: still road for now */ }
    let n = 0; for (const e of this.en) if (!e.obst && !e.air) n++;
    if (n > 12 + this.lap * 2) return;
    const tbl = MIX[key]; let tot = 0;
    for (const t of tbl) tot += t[1];
    let r = Math.random() * tot, kind = tbl[0][0];
    for (const t of tbl) { r -= t[1]; if (r <= 0) { kind = t[0]; break; } }
    const sp = this.speed;
    if (kind === 'heli') {
      if (this.airCd > 0 || this.time < 14 || this.en.some((e) => e.air)) kind = 'civcar';
      else { this.airCd = U.rand(24, 38) / (1 + 0.1 * this.lap); const big = (key === 'rapids' || key === 'river' || key === 'dockWater') && this.lap >= 0; V.spawn(this, big ? 'gunship' : 'heli', U.rand(120, W - 120), -110, { hoverY: U.rand(110, 190), pal: U.randInt(0, 7) }); A.sfx.heli(); return; }
    }
    if (kind === 'bikes') {
      const x = freeLane(this, H + 90); if (x === null) return;
      for (let i = 0; i < 3; i++) V.spawn(this, 'bike', U.clamp(x + (i - 1) * 24, L + 12, R - 12), H + 90 + i * 34, { ev: sp * 1.5, pal: U.randInt(0, 7) });
      return;
    }
    if (kind === 'rock') {
      const x = U.rand(L + 34, R - 34); V.spawn(this, 'rock', x, -70, { ev: 0, size: U.pick([0, 0, 1, 1, 2]) }); return;
    }
    if (kind === 'mine') { V.spawn(this, 'mine', U.rand(L + 24, R - 24), -50, { ev: 0 }); return; }
    const behind = ['sedan', 'limo', 'gunner', 'slasher', 'patrol', 'gunboat'].includes(kind) && Math.random() < 0.72;
    const y = behind ? H + 100 : -90, x = freeLane(this, y); if (x === null) return;
    const e = V.spawn(this, kind, x, y, {});
    e.ev = behind ? sp * 1.3 : sp * (e.team === 'civ' ? e.rate : 0.65); e.evT = e.ev;
    if (kind === 'limo') e.pal = U.pick([1, 1, 1, 4, 2]);
    if (e.team === 'civ' && Math.random() < 0.0) e.laneT = x;
  };

  /* ---------- the loop ---------- */
  Game.update = function (dt) {
    this.time += dt;
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.life) this.banner = null; }
    for (const k in this.hudFlash) { this.hudFlash[k] -= dt; if (this.hudFlash[k] <= 0) delete this.hudFlash[k]; }
    if (this.state === 'shop') return;
    const P = this.player;
    if (this.over) { this.overT -= dt; FX.update(dt); FX.shift(this.speed * dt * 0.3); if (this.overT <= 0 && !this.overDone) { this.overDone = true; if (this.onOver) this.onOver(); } this.speed *= 0.98; return; }

    /* zone, lap, surface */
    const dl = ((this.dist % C.LAP) + C.LAP) % C.LAP, zi = Road.zoneIndex(dl), z = C.ZONES[zi];
    this.lap = Math.floor(this.dist / C.LAP);
    if (zi !== this.zone) this.onZone(zi);
    this.surface = Road.surfaceAt(this.dist);
    this.flow = z.id === 'rapids' ? (x, y) => 95 * Math.sin(y * 0.011 + this.time * 0.9) + 60 * Math.sin(x * 0.02 + this.time * 0.5) : z.id === 'river' ? (x, y) => 22 * Math.sin(y * 0.008 + this.time * 0.6) : () => 0;
    if (z.convert !== undefined && dl - z.start >= z.convert && P.alive && !P.conv && P.mode !== z.to && !P.docked) this.startConvert(z.to);

    /* speed: cruise, slower with damage, slower while docking */
    const pf = this.perf(P), lapMul = Math.min(1.5, 1 + 0.06 * this.lap);
    let target = C.SPEED * lapMul * (z.id === 'rapids' ? 1.18 : 1) * pf.speed * this.dockMul;
    if (P.dmg > 60 && Math.random() < 0.01) this.speed *= 0.8;                                   /* a sputter */
    if (this.respawnT > 0) target *= 0.5;
    this.speed += (target - this.speed) * Math.min(1, 1.8 * dt);
    this.dist += this.speed * dt;

    /* one point a second for travelling */
    if (!this.demo && P.alive && !P.docked) { this.secT += dt; if (this.secT >= 1) { this.secT -= 1; this.score += 1; this.credits += 1; } }

    /* the supply truck: once per zone, no warning */
    if (z.truck && !this.truck && !this.demo && P.alive && !P.docked && !this.truckSeen[this.lap * 10 + zi] && ((dl - z.start) / z.len >= z.truck || (G.debug && G.debug.truck && this.time > 4))) { this.truckSeen[this.lap * 10 + zi] = true; G.truck.spawn(this); }
    if (!P.docked && this.respawnT <= 0 && P.alive && !(this.truck && this.truck.state !== 'drift')) this.spawnTick(dt);

    this.updatePlayer(dt, pf);
    V.update(this, dt);
    G.weapons.update(this, dt);
    G.truck.update(this, dt);
    FX.update(dt); FX.shift(this.speed * dt);
    A.engine(this.speed / C.SPEED, P.dmg, P.alive && !this.demo);
    if (!P.alive && !this.over) { this.respawnT -= dt; if (this.respawnT <= 0) this.respawn(); }
  };

  Game.updatePlayer = function (dt, pf) {
    const P = this.player;
    P.t += dt;
    if (P.invuln > 0) P.invuln -= dt;
    if (P.shield > 0) { P.shieldT -= dt; if (P.shieldT <= 0) P.shield = 0; }
    if (P.flash > 0) P.flash -= dt; if (P.dry > 0) P.dry -= dt;
    P.fireCd = Math.max(0, P.fireCd - dt); if (P.mz > 0) P.mz -= dt;
    if (!P.alive) return;
    P.armorInt = U.clamp(1 - P.dmg / 70, 0, 1);
    if (P.armor > 0 && P.armorInt <= 0 && !P.armorBroken) { P.armorBroken = true; FX.text(P.x, P.y - 40, 'ARMOR BROKEN', '#ff8a4a', 18); A.sfx.armorBreak(); }
    P.mass = 1 + 0.35 * P.armor * P.armorInt + (P.mode === 'boat' ? 0.15 : 0);

    if (P.conv) {
      P.conv.t += dt;
      if (!P.conv.swapped && P.conv.t > 0.55) { P.conv.swapped = true; P.mode = P.conv.to; for (const e of this.en) { if (!e.air && !e.crash) { e.dead = true; FX.smoke(e.x, e.y, 2, 12); } } this.hz.length = 0; }
      if (P.conv.t > 1.2) P.conv = null;
    }
    if (P.docked) return;

    const car = P.mode === 'car', ap = this.demo ? this.autopilot() : null;
    const ax = ap ? ap.axis : I.axis(P.x);
    const accel = (car ? 1750 : 1250) * pf.steer;
    P.vx += ax * accel * dt;
    if (P.dmg > 55) P.pull = (P.pullDir || (P.pullDir = U.chance(0.5) ? 1 : -1)) * (P.dmg - 55) * 3.4; else { P.pull = 0; P.pullDir = 0; }
    P.vx += P.pull * dt;
    if (!car) P.vx += this.flow(P.x, P.y) * dt * 0.8;
    P.vx -= P.vx * Math.min(1, (car ? 5.6 : 2.7) * dt);
    P.vx = U.clamp(P.vx, -(car ? 360 : 300), car ? 360 : 300);
    P.x += P.vx * dt;
    P.y += (C.CAR_Y - P.y) * Math.min(1, 5 * dt);

    if (car) {
      if (P.x < L + 11 || P.x > R - 11) { P.edgeT = 0.2; if (Math.random() < 0.3) { FX.sparks(P.x < W / 2 ? L - 4 : R + 4, P.y + U.rand(-20, 20), 3, 120, 'hsla(30,100%,65%,1)', 0.25, 1.3); A.sfx.rumble(); } }
      if (P.x < L - 5 || P.x > R + 5) { if (this.demo || (G.debug && G.debug.god)) { P.x = U.clamp(P.x, L + 20, R - 20); P.vx = 0; } else this.loseCar('off'); }
    } else if (P.x < L + 14 || P.x > R - 14) {
      const sd = P.x < W / 2 ? 1 : -1; P.x = P.x < W / 2 ? L + 14 : R - 14; P.vx = sd * Math.abs(P.vx) * 0.45 + sd * 30;
      this.hurtPlayer(4, sd > 0 ? L : R, 60); FX.sparks(P.x, P.y, 5, 120, 'hsla(190,100%,75%,1)', 0.25, 1.3);
    }
    if (P.edgeT > 0) P.edgeT -= dt;

    /* weapons and gadgets */
    if (!P.conv || P.conv.t > 0.8) {
      const W2 = G.weapons;
      if (ap ? ap.fire : I.fire) W2.fireMG(this, P);
      if (ap ? ap.missile : I.takeMissile()) W2.fireMissile(this, P);
      if (!ap) { if (I.takeOil()) W2.dropOil(this, P); if (I.takeSmoke()) W2.smoke(this, P); if (I.takeEmp()) W2.emp(this, P); if (I.takeShield()) W2.shield(this, P); }
    }

    /* damage you can see: smoke, then fire, then sparks */
    const dm = P.dmg;
    if (dm > 25) { P.smokeT -= dt; if (P.smokeT <= 0) { P.smokeT = U.lerp(0.16, 0.04, Math.min(1, (dm - 25) / 75)); FX.smoke(P.x + U.rand(-5, 5), P.y + 22, 1, 6 + dm * 0.1); } }
    if (dm > 55) { FX.trail(P.x + U.rand(-6, 6), P.y + U.rand(-8, 18), 'hsla(' + Math.round(U.rand(8, 38)) + ',100%,60%,1)', U.rand(7, 12), 0.22); if (Math.random() < 0.12) A.sfx.sputter(); }
    if (dm > 78 && Math.random() < 0.25) FX.sparks(P.x + U.rand(-8, 8), P.y + U.rand(-10, 20), 2, 100, 'hsla(40,100%,65%,1)', 0.25, 1.2);
    if (car && dm > 40 && Math.abs(P.vx) > 140 && Math.random() < 0.2) FX.sparks(P.x, P.y + 24, 2, 80, 'hsla(30,100%,65%,1)', 0.2, 1.2);
  };

  /* ---------- the shop ---------- */
  Game.shopItems = function () {
    const P = this.player, boat = P.mode === 'boat', price = [600, 1200, 2000];
    return [
      { id: 'mg', name: 'MACHINE GUN AMMO', desc: '+100 rounds', price: 100, have: P.ammo.mg, max: 300 },
      { id: 'missile', name: 'MISSILES', desc: '+3 homing', price: 300, have: P.ammo.missile, max: 12 },
      { id: 'oil', name: boat ? 'MINES' : 'OIL SLICKS', desc: '+3', price: 150, have: P.ammo.oil, max: 9 },
      { id: 'smoke', name: 'SMOKE SCREENS', desc: '+3', price: 150, have: P.ammo.smoke, max: 9 },
      { id: 'emp', name: 'EMP BURST', desc: '+1 clears the screen', price: 500, have: P.ammo.emp, max: 3 },
      { id: 'shield', name: 'SHIELD', desc: '+1 bubble', price: 350, have: P.ammo.shield, max: 3 },
      { id: 'armor', name: 'ARMOR PLATING', desc: 'heavier: harder to knock off', price: price[Math.min(2, P.armor)], have: P.armor, max: 3, level: true },
      { id: 'repair', name: 'REPAIR', desc: 'fix all damage', price: Math.ceil(P.dmg * 5), have: Math.round(P.dmg), max: 0, repair: true },
    ];
  };
  Game.buy = function (id) {
    const P = this.player, it = this.shopItems().find((x) => x.id === id);
    if (!it) return false;
    if (it.repair) { if (P.dmg < 1 || this.credits < it.price) return false; this.credits -= it.price; P.dmg = 0; P.armorBroken = false; A.sfx.buy(); return true; }
    if (it.level ? it.have >= it.max : it.have >= it.max) return false;
    if (this.credits < it.price) return false;
    this.credits -= it.price;
    if (id === 'mg') P.ammo.mg = Math.min(300, P.ammo.mg + 100);
    else if (id === 'missile') P.ammo.missile = Math.min(12, P.ammo.missile + 3);
    else if (id === 'oil') P.ammo.oil = Math.min(9, P.ammo.oil + 3);
    else if (id === 'smoke') P.ammo.smoke = Math.min(9, P.ammo.smoke + 3);
    else if (id === 'emp') P.ammo.emp = Math.min(3, P.ammo.emp + 1);
    else if (id === 'shield') P.ammo.shield = Math.min(3, P.ammo.shield + 1);
    else if (id === 'armor') { P.armor++; P.armorBroken = false; }
    A.sfx.buy();
    return true;
  };
  Game.openShop = function () { this.state = 'shop'; if (G.main) G.main.openShop(); };
  Game.closeShop = function () { this.state = 'play'; this.dockMul = 0; G.truck.leave(this); };

  /* ---------- attract mode: the car drives itself ---------- */
  Game.autopilot = function () {
    const P = this.player; let bx = P.x, best = -1e9, foe = false;
    for (let l = 0; l < C.LANES; l++) {
      const x = C.laneX(l); let danger = 0, target = 0;
      for (const e of this.en) {
        if (e.dead || e.air || e.crash || Math.abs(e.x - x) > 32) continue;
        const dy = P.y - e.y;
        if (dy > -60 && dy < 260) danger += (e.obst || e.team !== 'enemy' ? 1.4 : 0.6) * (1 - dy / 330) * (e.kind === 'rock' || e.kind === 'mine' ? 2 : 1);
        if (e.team === 'enemy' && dy > 40 && dy < 360) target += 1;
      }
      const sc = -danger * 90 - Math.abs(x - P.x) * 0.12 + target * 14 - Math.abs(x - W / 2) * 0.03;
      if (sc > best) { best = sc; bx = x; }
    }
    for (const e of this.en) if (!e.dead && e.team === 'enemy' && e.y < P.y - 30 && e.y > 40 && Math.abs(e.x - P.x) < 24) foe = true;
    P.ammo.mg = 9999; if (P.dmg > 60) P.dmg = 0;
    return { axis: U.clamp((bx - P.x) / 34, -1, 1), fire: foe, missile: foe && Math.random() < 0.004 };
  };

  /* ---------- drawing ---------- */
  Game.render = function (ctx) {
    const P = this.player, Wp = G.weapons;
    Road.draw(ctx, this);
    Road.drawWaterFx(ctx, this);
    Wp.drawHazards(ctx, this);
    V.drawGround(ctx, this);
    G.truck.draw(ctx, this);
    this.drawPlayer(ctx);
    G.truck.drawInside(ctx, this);
    Wp.drawSmoke(ctx, this);
    FX.drawNorm(ctx);
    Wp.drawShots(ctx, this);
    V.drawAir(ctx, this);
    ctx.globalCompositeOperation = 'lighter';
    FX.drawAdd(ctx);
    ctx.globalCompositeOperation = 'source-over';
    FX.drawText(ctx);
  };
  Game.drawPlayer = function (ctx) {
    const P = this.player, spr = GFX.spr;
    if (!P.alive || P.docked) return;
    const blink = P.invuln > 0 && !P.conv ? (Math.floor(P.t * 14) % 2 ? 0.35 : 0.95) : 1;
    const boat = P.mode === 'boat';
    let sx = 1, sy = 1, img = boat ? spr.pboat : spr.sport;
    if (P.conv) {                                                          /* the transformation: squash, flash, swap */
      const k = P.conv.t / 1.2, sq = Math.sin(k * Math.PI);
      sx = 1 - 0.35 * sq; sy = 1 + 0.2 * sq;
      img = P.conv.swapped ? (P.conv.to === 'boat' ? spr.pboat : spr.sport) : (P.conv.to === 'boat' ? spr.sport : spr.pboat);
    }
    if (boat) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(200,240,255,0.22)'; ctx.beginPath(); ctx.moveTo(P.x - 9, P.y + 24); ctx.lineTo(P.x + 9, P.y + 24); ctx.lineTo(P.x + 28, P.y + 96); ctx.lineTo(P.x - 28, P.y + 96); ctx.closePath(); ctx.fill(); ctx.restore(); }
    else { ctx.globalCompositeOperation = 'lighter'; GFX.drawGlow(ctx, 'rgba(55,230,255,1)', P.x, P.y + 4, 44, 0.2); GFX.drawGlow(ctx, 'rgba(255,60,200,1)', P.x, P.y + 30, 22, 0.28 * Math.min(1, this.speed / 250)); ctx.globalCompositeOperation = 'source-over'; }
    GFX.draw(ctx, P.flash > 0 ? (boat ? spr.pboatF : spr.sportF) : img, P.x, P.y, P.vx * 0.0006, sx, sy, blink);
    if (P.mz > 0) { ctx.globalCompositeOperation = 'lighter'; GFX.drawGlow(ctx, 'rgba(120,240,255,1)', P.x + (P.alt ? 7 : -7), P.y - 34, 12, 0.9); ctx.globalCompositeOperation = 'source-over'; }
    if (P.shield > 0) {
      const a = Math.min(1, P.shieldT / 2) * (0.5 + 0.2 * Math.sin(P.t * 10));
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(90,230,255,' + a + ')'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.ellipse(P.x, P.y, 28, 44, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(70,200,255,' + a * 0.18 + ')'; ctx.fill(); ctx.restore();
    }
  };
})((window.SGS = window.SGS || {}));
