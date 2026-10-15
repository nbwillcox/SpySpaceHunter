/* Keyboard + mouse + touch input. The car cruises by itself: you steer left / right, fire, and use the gadgets. */
(function (G) {
  'use strict';
  const I = { left: false, right: false, fire: false, stick: 0, mouseX: 0, mouseActive: false, _oil: false, _smoke: false, _missile: false, _emp: false, _shield: false, _pause: false, _any: false };
  const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB']);
  const take = (k) => () => { const b = I[k]; I[k] = false; return b; };
  I.takeOil = take('_oil'); I.takeSmoke = take('_smoke'); I.takeMissile = take('_missile'); I.takeEmp = take('_emp'); I.takeShield = take('_shield');
  I.takePause = take('_pause'); I.takeAny = take('_any');
  I.clear = () => { I.left = I.right = I.fire = false; I.stick = 0; I._oil = I._smoke = I._missile = I._emp = I._shield = I._pause = I._any = false; };

  function typing(t) { const n = t && t.tagName; return n === 'INPUT' || n === 'TEXTAREA' || n === 'SELECT'; }

  window.addEventListener('keydown', (e) => {
    if (typing(e.target)) return;
    const c = e.code;
    if (c === 'ArrowLeft' || c === 'KeyA') { I.left = true; I.mouseActive = false; }
    else if (c === 'ArrowRight' || c === 'KeyD') { I.right = true; I.mouseActive = false; }
    else if (c === 'Space') I.fire = true;
    else if (c === 'KeyZ' && !e.repeat) I._oil = true;
    else if (c === 'KeyX' && !e.repeat) I._smoke = true;
    else if (c === 'KeyC' && !e.repeat) I._missile = true;
    else if (c === 'KeyV' && !e.repeat) I._emp = true;
    else if (c === 'KeyB' && !e.repeat) I._shield = true;
    else if ((c === 'KeyP' || c === 'Escape') && !e.repeat) I._pause = true;
    if (!e.repeat) I._any = true;
    if (GAME_KEYS.has(c) && e.target.tagName !== 'BUTTON') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    const c = e.code;
    if (c === 'ArrowLeft' || c === 'KeyA') I.left = false;
    else if (c === 'ArrowRight' || c === 'KeyD') I.right = false;
    else if (c === 'Space') I.fire = false;
  });
  window.addEventListener('blur', () => I.clear());

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
    if (e.movementX !== 0 || e.movementY !== 0) I.mouseActive = true;
  });

  /* steering input in -1..1: keys, else the touch stick, else the mouse (the car chases the cursor) */
  I.axis = function (px) {
    const k = (I.right ? 1 : 0) - (I.left ? 1 : 0);
    if (k) return k;
    if (Math.abs(I.stick) > 0.05) return I.stick;
    if (I.mouseActive) return Math.max(-1, Math.min(1, (I.mouseX - px) / 70));
    return 0;
  };

  G.input = I;
})((window.SGS = window.SGS || {}));
