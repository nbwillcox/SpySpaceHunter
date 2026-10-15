/* All sound is synthesized live with the Web Audio API - no audio files. The music is an original 8-bit-console-style score: two pulse channels (lead + arpeggio / echo), a triangle bass and a noise
   drum channel, low and driving, with a different tune for every zone. */
(function (G) {
  'use strict';
  const S = G.settings;
  const A = { ctx: null, ready: false, sfx: {} };
  let master, sfxBus, musicBus, noiseBuf, voices = 0, engOsc, engGain, engFilt;
  const last = {}, waves = {};

  function gate(name, ms) {
    const now = performance.now();
    if (now - (last[name] || 0) < ms) return false;
    last[name] = now;
    return true;
  }

  A.init = function () {
    if (A.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { A.ctx = new AC(); } catch (e) { return; }
    const ctx = A.ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.18;
    master = ctx.createGain(); sfxBus = ctx.createGain(); musicBus = ctx.createGain();
    sfxBus.connect(master); musicBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    /* the engine: a soft low hum whose pitch follows your speed */
    engOsc = ctx.createOscillator(); engOsc.type = 'sawtooth'; engOsc.frequency.value = 70;
    engFilt = ctx.createBiquadFilter(); engFilt.type = 'lowpass'; engFilt.frequency.value = 260;
    engGain = ctx.createGain(); engGain.gain.value = 0;
    engOsc.connect(engFilt); engFilt.connect(engGain); engGain.connect(sfxBus); engOsc.start();
    A.applyVolumes();
    A.ready = true;
    initMusic();
  };
  A.resume = function () {
    A.init();
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
  };
  A.applyVolumes = function () {
    if (!A.ctx) return;
    master.gain.value = S.master;
    sfxBus.gain.value = S.sfx;
    musicBus.gain.value = S.music * 0.55;
  };
  A.engine = function (norm, dmg, on) {
    if (!A.ready) return;
    const t = A.ctx.currentTime, wob = dmg > 55 ? (Math.random() - 0.5) * (dmg - 55) * 0.8 : 0;
    engOsc.frequency.setTargetAtTime(52 + 46 * norm + wob, t, 0.08);
    engGain.gain.setTargetAtTime(on ? 0.022 + 0.012 * norm : 0, t, 0.12);
  };

  /* ---------- primitives ---------- */
  function pulseWave(d) {                                             /* a pulse wave of duty d, like the console's square channels */
    if (waves[d]) return waves[d];
    const N = 40, re = new Float32Array(N), im = new Float32Array(N);
    for (let n = 1; n < N; n++) re[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * d);
    return (waves[d] = A.ctx.createPeriodicWave(re, im));
  }
  const DUTY = { pulse12: 0.125, pulse25: 0.25, pulse50: 0.5 };
  function tone(o) {
    if (!A.ready || voices > 56) return;
    const ctx = A.ctx, t = o.at !== undefined ? o.at : ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain(), ty = o.type || 'pulse50';
    if (DUTY[ty]) osc.setPeriodicWave(pulseWave(DUTY[ty])); else osc.type = ty;
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    const v = o.vol === undefined ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + (o.attack || 0.002));
    if (o.sustain) { g.gain.setValueAtTime(v * o.sustain, t + o.dur * 0.5); }
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t); osc.stop(t + o.dur + 0.03);
    voices++;
    osc.onended = () => { voices--; g.disconnect(); };
  }
  function noise(o) {
    if (!A.ready || voices > 56) return;
    const ctx = A.ctx, t = o.at !== undefined ? o.at : ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f0, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    if (o.q) f.Q.value = o.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol === undefined ? 0.3 : o.vol, t + (o.attack || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    src.start(t, Math.random() * 1.5, o.dur + 0.05);
    voices++;
    src.onended = () => { voices--; g.disconnect(); };
  }

  /* ---------- sound effects ---------- */
  const X = A.sfx;
  X.mg = () => { if (gate('mg', 50)) tone({ type: 'pulse12', f0: 1900, f1: 760, dur: 0.045, vol: 0.06 }); };
  X.missile = () => { noise({ type: 'bandpass', f0: 700, f1: 2400, dur: 0.3, vol: 0.16, q: 0.8 }); tone({ type: 'pulse25', f0: 320, f1: 1000, dur: 0.26, vol: 0.09 }); };
  X.oil = () => { if (gate('oil', 80)) { noise({ type: 'lowpass', f0: 900, f1: 200, dur: 0.18, vol: 0.14 }); tone({ type: 'pulse25', f0: 260, f1: 120, dur: 0.16, vol: 0.08 }); } };
  X.smoke = () => { noise({ type: 'bandpass', f0: 1400, f1: 500, dur: 0.5, vol: 0.14, q: 0.6 }); };
  X.emp = () => { tone({ type: 'pulse50', f0: 200, f1: 1800, dur: 0.35, vol: 0.12 }); tone({ type: 'pulse12', f0: 400, f1: 3200, dur: 0.3, vol: 0.07, delay: 0.04 }); noise({ type: 'highpass', f0: 2500, dur: 0.4, vol: 0.12 }); };
  X.shield = () => { [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'pulse25', f0: f, dur: 0.1, vol: 0.09, delay: i * 0.05 })); };
  X.shieldHit = () => { if (gate('shh', 60)) tone({ type: 'pulse50', f0: 1400, f1: 700, dur: 0.07, vol: 0.09 }); };
  X.hit = () => { if (gate('hit', 35)) tone({ type: 'pulse25', f0: 700, f1: 380, dur: 0.05, vol: 0.07 }); };
  X.ping = () => { if (gate('ping', 60)) tone({ type: 'pulse12', f0: 2600, f1: 2200, dur: 0.05, vol: 0.06 }); };
  X.hurt = () => { if (gate('hurt', 70)) { noise({ type: 'lowpass', f0: 1400, f1: 200, dur: 0.16, vol: 0.2 }); tone({ type: 'pulse25', f0: 180, f1: 70, dur: 0.14, vol: 0.12 }); } };
  X.crash = () => { if (gate('crash', 80)) { noise({ type: 'lowpass', f0: 1800, f1: 160, dur: 0.22, vol: 0.24 }); tone({ type: 'pulse50', f0: 150, f1: 55, dur: 0.18, vol: 0.12 }); } };
  X.scrape = () => { if (gate('scr', 90)) noise({ type: 'highpass', f0: 2800, f1: 1800, dur: 0.1, vol: 0.1 }); };
  X.rumble = () => { if (gate('rum', 110)) noise({ type: 'lowpass', f0: 380, dur: 0.12, vol: 0.14 }); };
  X.skid = () => { if (gate('skid', 140)) { noise({ type: 'bandpass', f0: 2400, f1: 1500, dur: 0.35, vol: 0.09, q: 3 }); } };
  X.boom = (n) => {
    if (!gate('boom' + (n || 0), 55)) return;
    noise({ type: 'lowpass', f0: 2200, f1: 90, dur: 0.38 + (n || 0) * 0.25, vol: 0.34 });
    tone({ type: 'pulse25', f0: 140, f1: 38, dur: 0.3 + (n || 0) * 0.2, vol: 0.2 });
  };
  X.enemyShot = () => { if (gate('es', 70)) tone({ type: 'pulse25', f0: 900, f1: 300, dur: 0.07, vol: 0.06 }); };
  X.dry = () => { if (gate('dry', 150)) tone({ type: 'pulse50', f0: 180, dur: 0.05, vol: 0.07 }); };
  X.bombDrop = () => { tone({ type: 'pulse12', f0: 1600, f1: 400, dur: 0.5, vol: 0.07 }); };
  X.heli = () => { for (let i = 0; i < 8; i++) noise({ type: 'lowpass', f0: 500, dur: 0.07, vol: 0.12, delay: i * 0.1 }); };
  X.civ = () => { [196, 147, 110].forEach((f, i) => tone({ type: 'pulse50', f0: f, dur: 0.14, vol: 0.14, delay: i * 0.11 })); };
  X.armorBreak = () => { noise({ type: 'highpass', f0: 3000, f1: 800, dur: 0.3, vol: 0.2 }); tone({ type: 'pulse12', f0: 900, f1: 120, dur: 0.3, vol: 0.12 }); };
  X.sputter = () => { if (gate('spu', 200)) { noise({ type: 'lowpass', f0: 600, dur: 0.06, vol: 0.12 }); tone({ type: 'pulse25', f0: 90, f1: 60, dur: 0.08, vol: 0.08 }); } };
  X.transform = () => { [262, 330, 392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'pulse25', f0: f, dur: 0.09, vol: 0.1, delay: i * 0.055 })); noise({ type: 'bandpass', f0: 800, f1: 3000, dur: 0.5, vol: 0.1, q: 1 }); };
  X.dock = () => { [392, 523, 659].forEach((f, i) => tone({ type: 'pulse25', f0: f, dur: 0.1, vol: 0.1, delay: i * 0.07 })); tone({ type: 'triangle', f0: 130, dur: 0.5, vol: 0.2 }); };
  X.truckHorn = () => { tone({ type: 'pulse50', f0: 233, dur: 0.55, vol: 0.12, attack: 0.02 }); tone({ type: 'pulse50', f0: 294, dur: 0.55, vol: 0.1, attack: 0.02 }); };
  X.buy = () => { tone({ type: 'pulse25', f0: 988, dur: 0.06, vol: 0.1 }); tone({ type: 'pulse25', f0: 1319, dur: 0.12, vol: 0.1, delay: 0.06 }); };
  X.playerDie = () => { [440, 392, 330, 262, 196, 131].forEach((f, i) => tone({ type: 'pulse25', f0: f, f1: f * 0.9, dur: 0.12, vol: 0.12, delay: i * 0.08 })); };
  X.gameOver = () => { [392, 349, 311, 262, 233, 196, 147, 98].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.24, vol: 0.2, delay: i * 0.17 })); [392, 349, 311, 262].forEach((f, i) => tone({ type: 'pulse25', f0: f * 2, dur: 0.2, vol: 0.07, delay: i * 0.17 })); };
  X.blip = () => tone({ type: 'pulse50', f0: 700, f1: 800, dur: 0.04, vol: 0.07 });
  X.select = () => { tone({ type: 'pulse50', f0: 500, dur: 0.06, vol: 0.08 }); tone({ type: 'pulse50', f0: 900, dur: 0.1, vol: 0.08, delay: 0.06 }); };
  X.start = () => { [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => tone({ type: 'pulse25', f0: f, dur: 0.1, vol: 0.09, delay: i * 0.055 })); };

  /* ---------- music ---------- */
  /* Everything is written in scale degrees. A song has a key (semitones above A), a scale, a chord (a scale degree) for each of 16 bars, a lead phrase and a bass pattern for each bar, a drum pattern
     and an arpeggio style. Lead phrases count scale steps up from the bar's chord root (0 root, 2 third, 4 fifth, 7 octave), so they always fit the chord; -1 rests, -2 holds. */
  const SC = { min: [0, 2, 3, 5, 7, 8, 10], phr: [0, 1, 4, 5, 7, 8, 10], maj: [0, 2, 4, 5, 7, 9, 11], dor: [0, 2, 3, 5, 7, 9, 10] };
  const LEAD = [
    [4, -2, -1, 4, 7, -2, 4, -1, 2, -2, 4, -2, 0, -2, -1, -1],        // 0 the hook
    [7, -2, -1, 7, 9, -2, 7, -1, 4, -2, 7, -2, 4, -2, -1, -1],        // 1 the hook, higher
    [2, -2, 4, -2, 7, -2, 4, -2, 5, -2, 4, -2, 2, -2, -1, -1],        // 2 answer
    [0, -1, 2, -1, 4, -1, 7, -1, 9, -2, 7, -1, 4, -2, 2, -1],         // 3 rising arpeggio
    [4, -1, 4, 5, 7, -2, -1, 7, 9, 8, 7, 5, 4, -2, -1, -1],           // 4 with a quick run
    [7, -2, -2, -2, 4, -2, -2, -2, 2, -2, -2, -2, 4, -2, -1, -1],     // 5 long notes
    [-1, 4, -1, 4, 7, -1, 4, -2, -1, 2, -1, 2, 4, -1, 0, -1],         // 6 syncopated
    [4, -2, 2, -2, 0, -2, -1, -1, 2, -2, 4, -2, 0, -2, -2, -2],       // 7 turnaround
    [-1, -1, -1, -1, 7, -2, -2, 4, -2, -2, 2, -2, -2, -2, -1, -1],    // 8 sparse
    [0, 2, 4, 2, 7, 4, 2, 4, 5, 4, 2, 0, 2, 4, 2, -1],                // 9 running eighths
  ];
  const BASS = [
    [0, -1, 0, -1, 12, -1, 0, -1, 0, -1, 0, -1, 12, -1, 7, -1],       // 0 driving, octave pops
    [0, 0, -1, 0, -1, 0, 12, -1, 0, 0, -1, 0, -1, 7, -1, 12],         // 1 pumping
    [0, -2, -2, -2, -1, -1, -1, -1, 7, -2, -2, -2, -1, -1, -1, -1],   // 2 sustained
    [0, -1, 7, -1, 12, -1, 7, -1, 0, -1, 7, -1, 5, -1, 7, -1],        // 3 walking
    [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 7, 7, 12, 7],             // 4 rapid
    [0, -1, -1, 0, -1, -1, 7, -1, 0, -1, -1, 0, -1, 12, -1, -1],      // 5 laid back
  ];
  const DRUMS = {
    rock: { k: [0, 8], s: [4, 12], h: 2 },
    drive: { k: [0, 6, 8, 14], s: [4, 12], h: 2 },
    half: { k: [0, 10], s: [8], h: 4 },
    fast: { k: [0, 4, 8, 12], s: [4, 12], h: 1 },
    soft: { k: [0, 8], s: [], h: 4 },
  };
  const ARP = { up: [0, 2, 4, 7], down: [7, 4, 2, 0], mid: [0, 4, 2, 4] };
  const SONGS = {
    city: { key: 0, tempo: 138, scale: SC.min, chords: [0, 5, 2, 6, 0, 5, 2, 6, 5, 6, 0, 0, 5, 6, 4, 0], lead: [0, 1, 0, 2, 0, 1, 0, 3, 4, 4, 6, 5, 4, 4, 6, 7], bass: [0, 0, 1, 0, 0, 0, 1, 3, 1, 1, 0, 2, 1, 1, 4, 0], drums: 'drive', arp: 'up', ld: 'pulse25', ad: 'pulse12' },
    desert: { key: 5, tempo: 126, scale: SC.phr, chords: [0, 1, 0, 6, 0, 1, 0, 6, 3, 1, 0, 0, 3, 1, 6, 0], lead: [6, 0, 6, 2, 6, 0, 6, 3, 4, 1, 4, 5, 4, 1, 6, 7], bass: [5, 5, 3, 5, 5, 5, 3, 5, 3, 3, 5, 2, 3, 3, 4, 0], drums: 'half', arp: 'mid', ld: 'pulse12', ad: 'pulse25' },
    town: { key: 3, tempo: 120, scale: SC.maj, chords: [0, 4, 5, 3, 0, 4, 5, 3, 3, 4, 0, 5, 3, 4, 0, 0], lead: [0, 2, 0, 1, 0, 2, 0, 3, 4, 1, 2, 4, 4, 1, 3, 7], bass: [3, 3, 3, 3, 3, 3, 3, 5, 3, 3, 3, 5, 3, 3, 4, 0], drums: 'rock', arp: 'up', ld: 'pulse50', ad: 'pulse25' },
    dock: { key: 7, tempo: 104, scale: SC.min, chords: [0, 5, 3, 6, 0, 5, 3, 4, 0, 5, 3, 6, 5, 4, 0, 0], lead: [8, 5, 8, 5, 8, 5, 2, 5, 8, 5, 8, 5, 2, 5, 3, 7], bass: [2, 2, 5, 2, 2, 2, 5, 2, 2, 2, 5, 2, 2, 2, 5, 0], drums: 'soft', arp: 'echo', ld: 'pulse25', ad: 'pulse12' },
    rapids: { key: 7, tempo: 156, scale: SC.min, chords: [0, 5, 2, 6, 0, 5, 2, 6, 3, 5, 6, 4, 3, 5, 6, 0], lead: [9, 9, 4, 9, 9, 9, 4, 9, 4, 4, 6, 4, 4, 4, 6, 7], bass: [4, 4, 4, 4, 4, 4, 4, 4, 1, 1, 4, 4, 1, 1, 4, 0], drums: 'fast', arp: 'up', ld: 'pulse25', ad: 'pulse12' },
    river: { key: 10, tempo: 116, scale: SC.dor, chords: [0, 3, 5, 4, 0, 3, 5, 4, 3, 4, 0, 0, 3, 4, 6, 0], lead: [5, 3, 5, 2, 5, 3, 8, 2, 4, 4, 5, 3, 4, 4, 6, 7], bass: [3, 3, 5, 3, 3, 3, 5, 3, 3, 3, 5, 2, 3, 3, 5, 0], drums: 'rock', arp: 'down', ld: 'pulse50', ad: 'pulse25' },
    shop: { key: 3, tempo: 92, scale: SC.maj, chords: [0, 5, 3, 4, 0, 5, 3, 4, 0, 5, 3, 4, 3, 4, 0, 0], lead: [8, 3, 8, 3, 8, 3, 8, 7, 8, 3, 8, 3, 8, 3, 2, 7], bass: [2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2, 0], drums: 'soft', arp: 'mid', ld: 'pulse12', ad: 'pulse25' },
    title: { key: 0, tempo: 110, scale: SC.min, chords: [0, 0, 5, 5, 3, 3, 6, 6, 0, 0, 5, 5, 3, 6, 0, 0], lead: [5, 8, 5, 8, 5, 3, 5, 8, 5, 8, 5, 3, 4, 9, 2, 7], bass: [5, 5, 3, 3, 5, 5, 3, 3, 5, 5, 3, 3, 5, 5, 3, 0], drums: 'half', arp: 'up', ld: 'pulse25', ad: 'pulse12' },
  };
  A.SONGS = SONGS;
  const M = { on: false, song: null, id: '', step: 0, next: 0, timer: 0 };
  const L = {};
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function initMusic() {
    for (const k of ['lead', 'arp', 'bass', 'drums']) { L[k] = A.ctx.createGain(); L[k].gain.value = k === 'bass' ? 1 : k === 'drums' ? 0.9 : 0.8; L[k].connect(musicBus); }
  }
  function schedStep(t, s) {
    const song = M.song, bar = (s >> 4) & 15, st = s & 15, sixteenth = 60 / song.tempo / 4;
    const cd = song.chords[bar], semi = (deg) => song.scale[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7), base = 33 + song.key;
    /* lead: a pulse voice */
    const ph = LEAD[song.lead[bar]], v = ph[st];
    if (v >= 0) {
      let len = 1; while (st + len < 16 && ph[st + len] === -2) len++;
      tone({ type: song.ld, f0: midi(base + 24 + semi(cd + v)), dur: sixteenth * len * 0.92, vol: 0.085, sustain: 0.6, bus: L.lead, at: t });
    }
    /* second pulse: chord arpeggios, or a quiet echo of the lead three steps late */
    if (song.arp === 'echo') {
      const e = ph[(st + 13) & 15], pe = (st + 13) & 15;
      if (e >= 0 && (st >= 3 || bar > 0)) tone({ type: song.ad, f0: midi(base + 24 + semi(cd + e)), dur: sixteenth * 1.4, vol: 0.04, bus: L.arp, at: t });
      void pe;
    } else if (song.arp !== 'none') {
      const pat = ARP[song.arp], deg = pat[st & 3];
      if (st % 2 === 0 || song.tempo > 140) tone({ type: song.ad, f0: midi(base + 36 + semi(cd + deg)), dur: sixteenth * 0.8, vol: 0.036, bus: L.arp, at: t });
    }
    /* triangle bass */
    const bp = BASS[song.bass[bar]], b = bp[st];
    if (b >= 0) {
      let len = 1; while (st + len < 16 && bp[st + len] === -2) len++;
      tone({ type: 'triangle', f0: midi(base + 12 + semi(cd) + b), dur: sixteenth * (len > 1 ? len * 0.95 : 1.15), vol: 0.34, bus: L.bass, attack: 0.002, at: t });
    }
    /* noise drums */
    const D = DRUMS[song.drums], fill = bar === 7 || bar === 15;
    if (D.k.indexOf(st) >= 0) { noise({ type: 'lowpass', f0: 420, f1: 55, dur: 0.1, vol: 0.4, bus: L.drums, at: t }); tone({ type: 'sine', f0: 150, f1: 45, dur: 0.1, vol: 0.3, bus: L.drums, at: t }); }
    if (D.s.indexOf(st) >= 0 || (fill && st >= 12 && st % 1 === 0 && st > 11 && (st & 1) === 0)) noise({ type: 'highpass', f0: 1700, dur: 0.12, vol: 0.2, bus: L.drums, at: t });
    if (st % D.h === 0) noise({ type: 'highpass', f0: 7500, dur: st % 4 === 2 ? 0.07 : 0.03, vol: st % 4 === 2 ? 0.09 : 0.055, bus: L.drums, at: t });
  }
  function scheduler() {
    if (!M.on || !A.ready || !M.song) return;
    const ctx = A.ctx;
    if (ctx.state !== 'running') return;
    if (M.next < ctx.currentTime - 0.25) M.next = ctx.currentTime + 0.05;
    while (M.next < ctx.currentTime + 0.14) {
      schedStep(M.next, M.step);
      M.next += 60 / M.song.tempo / 4;
      M.step = (M.step + 1) & 255;
    }
  }
  /** id: a song name ('city', 'desert', 'town', 'dock', 'rapids', 'river', 'shop', 'title') or 'off' */
  A.music = function (id) {
    if (!A.ready) return;
    if (id === 'off') { M.on = false; M.id = ''; return; }
    if (id === M.id && M.on) return;
    M.id = id; M.song = SONGS[id] || SONGS.city; M.step = 0;
    if (!M.on) { M.on = true; M.next = A.ctx.currentTime + 0.08; if (!M.timer) M.timer = setInterval(scheduler, 30); }
    else M.next = Math.max(M.next, A.ctx.currentTime + 0.1);
  };

  G.audio = A;
})((window.SGS = window.SGS || {}));
