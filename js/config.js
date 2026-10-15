/* Constants, the zone loop and the saved settings. */
(function (G) {
  'use strict';

  const STRIP = 360;                                          /* the road is built from strips this tall */
  /* One lap: a monster city, the desert, a small town, a dock (the car becomes a boat), rapids, a calm river, a dock (back to a car), and round again. len is in road pixels. */
  const Z = (id, name, strips, surface, hue, music, o) => Object.assign({ id, name, strips, len: strips * STRIP, surface, hue, music }, o || {});
  const ZONES = [
    Z('city', 'NEON CITY', 33, 'road', 300, 'city', { truck: 0.3 }),
    Z('desert', 'DUST BELT', 25, 'road', 28, 'desert', { truck: 0.35 }),
    Z('town', 'LITTLE HAVEN', 22, 'road', 140, 'town', { truck: 0.35 }),
    Z('dock1', 'HARBOR RAMP', 7, 'dock', 200, 'dock', { convert: 1620, to: 'boat' }),
    Z('rapids', 'ROARING RAPIDS', 22, 'water', 195, 'rapids', { truck: 0.35 }),
    Z('river', 'QUIET RIVER', 22, 'water', 170, 'river', { truck: 0.3 }),
    Z('dock2', 'HARBOR EXIT', 7, 'dock', 200, 'dock', { convert: 900, to: 'car' }),
  ];
  let t = 0; ZONES.forEach((z) => { z.start = t; t += z.len; });

  const C = {
    W: 540,
    H: 720,
    REPO: 'https://github.com/nbwillcox/SpySpaceHunter',
    STRIP,
    ROAD_L: 70, ROAD_R: 470, LANES: 8, LANE_W: 50,
    CAR_Y: 596,                                               /* where your car sits on the screen */
    SPEED: 300,                                               /* cruising speed in road pixels per second */
    START_LIVES: 3,
    TURBO_MUL: 0.85,                                          /* extra road speed at full turbo (1 + this) */
    TURBO_DRAIN: 36,                                          /* meter per second while boosting (the meter is 100) */
    TURBO_REGEN: 15,                                          /* meter per second while resting */
    SHOULDER: 34,                                             /* how far past the road edge the car can slide before it falls off */
    ZONES,
    LAP: t,
  };
  C.laneX = (i) => C.ROAD_L + C.LANE_W * (i + 0.5);

  const KEY = 'spyspacehunter.settings.v1';
  const defaults = { master: 0.8, music: 0.6, sfx: 0.9, bloom: true, shake: true, reduced: false, mouseSteer: true, steerSens: 1, turboToggle: false };

  const S = Object.assign({}, defaults);
  let hadSaved = false;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { Object.assign(S, JSON.parse(raw)); hadSaved = true; }
  } catch (e) { /* storage unavailable */ }
  S.save = function () {
    try {
      const o = {};
      for (const k in defaults) o[k] = S[k];
      localStorage.setItem(KEY, JSON.stringify(o));
    } catch (e) { /* ignore */ }
  };
  if (!hadSaved && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) S.reduced = true;
  G.C = C;
  G.settings = S;
})((window.SGS = window.SGS || {}));
