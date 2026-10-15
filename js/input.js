/* Keyboard + mouse + touch input. The car cruises by itself: you steer left / right, fire, boost and use the gadgets.
   Keyboard keys are rebindable (two keys per action, saved in this browser). Touch buttons and scripted events always use the default keys, so changing a binding never breaks the on-screen controls. */
(function (G) {
  'use strict';
  const S = G.settings;
  const I = { left: false, right: false, fire: false, turbo: false, stick: 0, mouseX: 0, mouseActive: false, capturing: false, version: 0, _oil: false, _smoke: false, _missile: false, _emp: false, _shield: false, _pause: false, _any: false };

  /* every action the keyboard can do, in the order the settings screen lists them */
  I.ACTIONS = [
    { id: 'left', name: 'Steer left' },
    { id: 'right', name: 'Steer right' },
    { id: 'fire', name: 'Machine gun' },
    { id: 'turbo', name: 'Turbo' },
    { id: 'missile', name: 'Missile' },
    { id: 'oil', name: 'Oil slick / mines' },
    { id: 'smoke', name: 'Smoke screen' },
    { id: 'emp', name: 'EMP burst' },
    { id: 'shield', name: 'Shield' },
    { id: 'pause', name: 'Pause' },
  ];
  I.DEFAULTS = {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], fire: ['Space', ''], turbo: ['ShiftLeft', 'KeyW'], missile: ['KeyC', ''],
    oil: ['KeyZ', ''], smoke: ['KeyX', ''], emp: ['KeyV', ''], shield: ['KeyB', ''], pause: ['KeyP', 'Escape'],
  };
  const STORE = 'spyspacehunter.keys.v1';
  const norm = (c) => (c === 'ShiftRight' ? 'ShiftLeft' : c === 'ControlRight' ? 'ControlLeft' : c === 'AltRight' ? 'AltLeft' : c);   /* either Shift / Ctrl / Alt counts */
  let binds = {}, map = {};
  const DEF_MAP = {};
  for (const id in I.DEFAULTS) I.DEFAULTS[id].forEach((c) => { if (c) DEF_MAP[c] = id; });

  function rebuild() {
    map = {};
    for (const a of I.ACTIONS) binds[a.id].forEach((c) => { if (c && !map[c]) map[c] = a.id; });
    I.version++;
  }
  function load() {
    for (const id in I.DEFAULTS) binds[id] = I.DEFAULTS[id].slice();
    try {
      const raw = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (raw) for (const id in I.DEFAULTS) {
        const r = raw[id];
        if (Array.isArray(r)) binds[id] = [0, 1].map((i) => (typeof r[i] === 'string' && r[i].length < 32 ? r[i] : ''));
        if (!binds[id][0] && !binds[id][1]) binds[id] = I.DEFAULTS[id].slice();
      }
    } catch (e) { /* storage unavailable or damaged: use the defaults */ }
    rebuild();
  }
  I.save = function () { try { localStorage.setItem(STORE, JSON.stringify(binds)); } catch (e) { /* ignore */ } };
  I.getBinds = (id) => binds[id].slice();
  I.isDefault = () => I.ACTIONS.every((a) => binds[a.id][0] === I.DEFAULTS[a.id][0] && binds[a.id][1] === I.DEFAULTS[a.id][1]);
  I.resetBinds = function () { for (const id in I.DEFAULTS) binds[id] = I.DEFAULTS[id].slice(); rebuild(); I.save(); I.clear(); };

  /* what a key is called on screen */
  const NAMES = { Space: 'SPACE', ShiftLeft: 'SHIFT', ControlLeft: 'CTRL', AltLeft: 'ALT', Enter: 'ENTER', NumpadEnter: 'ENTER', Escape: 'ESC', Tab: 'TAB', Backspace: 'BKSP', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
    Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', CapsLock: 'CAPS', Insert: 'INS', Delete: 'DEL', Home: 'HOME', End: 'END', PageUp: 'PGUP', PageDown: 'PGDN' };
  I.keyName = function (code) {
    if (!code) return '';
    if (NAMES[code]) return NAMES[code];
    if (/^Key[A-Z]$/.test(code)) return code[3];
    if (/^Digit\d$/.test(code)) return code[5];
    if (/^Numpad\d$/.test(code)) return 'NUM ' + code[6];
    return code.replace(/^Numpad/, 'NUM ').toUpperCase();
  };
  I.label = (id) => binds[id].filter(Boolean).map(I.keyName).join(' / ') || '-';          /* "A / ←" */
  I.hint = (id) => I.keyName(binds[id].find(Boolean) || '');                                 /* the first key only, for tight spaces */
  I.steerText = function () {                                                                  /* "← →  /  A D  /  MOUSE" */
    const parts = [0, 1].map((s) => [binds.left[s], binds.right[s]].filter(Boolean).map(I.keyName).join(' ')).filter(Boolean);
    if (S.mouseSteer !== false) parts.push('MOUSE');
    return parts.join('  /  ') || '-';
  };

  /* a key may only be bound once: giving a taken key to another action swaps the two. Returns { ok, msg }. */
  const BLOCKED = (c) => c === 'Escape' || c === 'Tab' || c === 'MetaLeft' || c === 'MetaRight' || c === 'ContextMenu' || /^F\d+$/.test(c);
  I.setBind = function (id, slot, code) {
    code = norm(code || '');
    const mine = binds[id];
    if (!code) {                                                                                 /* clear this box, but never leave an action with no key at all */
      if (!mine[1 - slot]) return { ok: false, msg: 'Each action needs at least one key.' };
      mine[slot] = ''; rebuild(); I.save(); I.clear(); return { ok: true, msg: '' };
    }
    if (BLOCKED(code)) return { ok: false, msg: I.keyName(code) + ' can\'t be used here.' };
    if (mine[slot] === code) return { ok: true, msg: '' };
    const other = I.ACTIONS.find((a) => a.id !== id && binds[a.id].indexOf(code) >= 0);
    let msg = '';
    if (other) {
      const os = binds[other.id].indexOf(code), give = mine[slot];
      if (!give && !binds[other.id][1 - os]) return { ok: false, msg: I.keyName(code) + ' is the only key for ' + other.name + '.' };
      binds[other.id][os] = give;                                                                /* the other action gets the key this box used to hold (maybe none) */
      msg = give ? I.keyName(code) + ' and ' + I.keyName(give) + ' swapped with ' + other.name + '.' : I.keyName(code) + ' moved here from ' + other.name + '.';
    }
    if (mine[1 - slot] === code) mine[1 - slot] = '';
    mine[slot] = code; rebuild(); I.save(); I.clear();
    return { ok: true, msg };
  };

  const take = (k) => () => { const b = I[k]; I[k] = false; return b; };
  I.takeOil = take('_oil'); I.takeSmoke = take('_smoke'); I.takeMissile = take('_missile'); I.takeEmp = take('_emp'); I.takeShield = take('_shield');
  I.takePause = take('_pause'); I.takeAny = take('_any');
  I.clear = () => { I.left = I.right = I.fire = I.turbo = false; I.stick = 0; I._oil = I._smoke = I._missile = I._emp = I._shield = I._pause = I._any = false; };

  function typing(t) { const n = t && t.tagName; return n === 'INPUT' || n === 'TEXTAREA' || n === 'SELECT'; }

  function act(id, down, repeat) {
    switch (id) {
      case 'left': I.left = down; if (down) I.mouseActive = false; break;
      case 'right': I.right = down; if (down) I.mouseActive = false; break;
      case 'fire': I.fire = down; break;
      case 'turbo': if (S.turboToggle) { if (down && !repeat) I.turbo = !I.turbo; } else I.turbo = down; break;
      case 'oil': if (down && !repeat) I._oil = true; break;
      case 'smoke': if (down && !repeat) I._smoke = true; break;
      case 'missile': if (down && !repeat) I._missile = true; break;
      case 'emp': if (down && !repeat) I._emp = true; break;
      case 'shield': if (down && !repeat) I._shield = true; break;
      case 'pause': if (down && !repeat) I._pause = true; break;
    }
  }
  /* real keyboard events use your bindings; scripted ones (the touch buttons) use the defaults */
  const lookup = (e) => (e.isTrusted ? map : DEF_MAP)[norm(e.code)];

  /* which keys are physically down right now, so closing the shop or un-pausing can pick up a key you are still holding instead of waiting for the keyboard's repeat delay */
  const held = new Map();
  I.resync = function () {
    I.clear();
    for (const [c, trusted] of held) { const id = (trusted ? map : DEF_MAP)[c]; if (id) act(id, true, true); }
  };

  window.addEventListener('keydown', (e) => {
    if (typing(e.target)) return;
    held.set(norm(e.code), e.isTrusted);
    if (I.capturing) return;
    const id = lookup(e);
    if (id) act(id, true, e.repeat);
    if (!e.repeat) I._any = true;
    if (id && e.target.tagName !== 'BUTTON') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    held.delete(norm(e.code));
    if (I.capturing) return;
    const id = lookup(e);
    if (id) act(id, false, false);
  });
  window.addEventListener('blur', () => { held.clear(); I.clear(); });

  I.bind = function (canvas) {
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) I.fire = true;
      else if (e.button === 2) I._missile = true;
      I._any = true;
      e.preventDefault();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  window.addEventListener('mouseup', (e) => { if (e.button === 0) I.fire = false; });
  window.addEventListener('mousemove', (e) => {
    const v = G.view;
    if (!v) return;
    I.mouseX = (e.clientX - v.ox) / v.s;
    if ((e.movementX !== 0 || e.movementY !== 0) && S.mouseSteer !== false) I.mouseActive = true;
  });

  /* steering input in -1..1: keys, else the touch stick, else the mouse (the car chases the cursor). The sensitivity setting scales the stick and the mouse. */
  I.axis = function (px) {
    const k = (I.right ? 1 : 0) - (I.left ? 1 : 0);
    if (k) return k;
    const sens = S.steerSens || 1;
    if (Math.abs(I.stick) > 0.05) return Math.max(-1, Math.min(1, I.stick * sens));
    if (I.mouseActive && S.mouseSteer !== false) return Math.max(-1, Math.min(1, (I.mouseX - px) * sens / 70));
    return 0;
  };

  load();
  G.input = I;
})((window.SGS = window.SGS || {}));
