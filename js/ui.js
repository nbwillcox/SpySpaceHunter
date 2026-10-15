/* DOM menus: title, pause, settings, high scores, game over / initials entry. */
(function (G) {
  'use strict';
  const S = G.settings, A = G.audio, U = G.U;
  const $ = (id) => document.getElementById(id);
  const UI = { cur: 'title', back: 'title', lastIdx: -1 };
  const NAMES = ['title', 'pause', 'settings', 'scores', 'gameover', 'shop'];

  UI.show = function (name) {
    if (typeof stopListen === 'function') stopListen();
    NAMES.forEach((n) => $(n).classList.toggle('hidden', n !== name));
    UI.cur = name;
    document.body.classList.toggle('menu-open', !!name);
    if (name === 'scores') UI.renderScores();
    setTimeout(() => {
      const sec = $(name);
      if (!sec || sec.classList.contains('hidden')) return;
      const el = name === 'gameover' && !$('goEntry').classList.contains('hidden') ? $('goName') : sec.querySelector('button.primary') || sec.querySelector('button');
      if (el) { el.focus(); if (el.select) el.select(); }
    }, 0);
  };
  UI.hideAll = function () {
    NAMES.forEach((n) => $(n).classList.add('hidden'));
    UI.cur = null;
    document.body.classList.remove('menu-open');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  };
  UI.isOpen = () => UI.cur !== null;

  UI.renderScores = function () {
    const ol = $('scoreList');
    ol.innerHTML = '';
    G.scores.list.forEach((r, i) => {
      const li = document.createElement('li');
      if (i === UI.lastIdx) li.className = 'me';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = r.name;
      const sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = U.fmt(r.score);
      const st = document.createElement('span'); st.className = 'st'; st.textContent = 'LAP ' + (r.stage || 1);
      li.append(nm, sc, st);
      ol.appendChild(li);
    });
  };

  UI.showGameOver = function (score, stage) {
    $('goScore').textContent = U.fmt(score);
    $('goStage').textContent = stage;
    const q = G.scores.qualifies(score);
    $('goEntry').classList.toggle('hidden', !q);
    $('goButtons').classList.toggle('hidden', q);
    $('goName').value = G.scores.lastName || '';
    UI.pending = { score, stage };
    UI.show('gameover');
  };


  /* the supply truck's shop: spend credits on ammo, gadgets, armor and repairs */
  UI.renderShop = function () {
    const g = G.game, ul = $('shopList');
    $('shopCredits').textContent = U.fmt(g.credits);
    ul.innerHTML = '';
    g.shopItems().forEach((it) => {
      const li = document.createElement('li');
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = it.name;
      const sm = document.createElement('small'); sm.textContent = it.desc; nm.appendChild(sm);
      const have = document.createElement('div'); have.className = 'have'; have.textContent = it.repair ? (it.have > 0 ? it.have + '% DAMAGE' : 'NO DAMAGE') : it.have + ' / ' + it.max;
      const b = document.createElement('button'); b.className = 'buy';
      const full = !it.repair && it.have >= it.max, none = it.repair && it.have < 1;
      b.textContent = full ? 'MAX' : none ? 'OK' : 'BUY ' + U.fmt(it.price);
      b.disabled = full || none || g.credits < it.price;
      b.addEventListener('click', () => { if (g.buy(it.id)) { UI.renderShop(); const nb = $('shopList').querySelector('[data-id="' + it.id + '"]'); if (nb && !nb.disabled) nb.focus(); } else A.sfx.dry(); });
      b.dataset.id = it.id;
      li.append(nm, have, b);
      ul.appendChild(li);
    });
  };
  UI.showShop = function () { UI.renderShop(); UI.show('shop'); setTimeout(() => { const b = $('shopList').querySelector('button:not([disabled])'); if (b) b.focus(); }, 0); };

  /* ---------- controls: sensitivity, mouse, turbo mode and the rebindable keys ---------- */
  const I = G.input, esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let listen = null, coolT = 0, msgT = 0;
  UI.refreshHint = function () {
    const h = $('titleHint');
    if (!h) return;
    const L = (id) => '<b>' + esc(I.label(id)) + '</b>';
    h.innerHTML = '<b>' + esc(I.steerText()) + '</b>: steer &nbsp; ' + L('fire') + ' / click: machine gun &nbsp; ' + L('turbo') + (S.turboToggle ? ' toggle' : ' hold') + ': turbo &nbsp; ' + L('oil') + ' oil / mines &nbsp; ' + L('smoke') + ' smoke &nbsp; ' +
      L('missile') + ' missile &nbsp; ' + L('emp') + ' EMP &nbsp; ' + L('shield') + ' shield &nbsp; ' + L('pause') + ': pause &nbsp; <span class="hintlink">(rebind in SETTINGS)</span>';
  };
  function keyMsg(text, bad) {
    const m = $('keyMsg');
    if (!m) return;
    m.textContent = text; m.className = bad ? 'bad' : '';
    clearTimeout(msgT); if (text) msgT = setTimeout(() => { m.textContent = ''; }, 4200);
  }
  function stopListen() {
    if (!listen) return;
    listen = null; I.capturing = false;
    renderKeys();
  }
  function renderKeys() {
    const box = $('keyRows');
    if (!box) return;
    box.innerHTML = '';
    for (const a of I.ACTIONS) {
      const row = document.createElement('div'); row.className = 'keyrow';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = a.name; row.appendChild(nm);
      const b = I.getBinds(a.id);
      for (let s = 0; s < 2; s++) {
        const btn = document.createElement('button'); btn.className = 'keybtn'; btn.dataset.a = a.id; btn.dataset.s = s;
        const on = listen && listen.a === a.id && listen.s === s;
        btn.textContent = on ? 'PRESS A KEY' : b[s] ? I.keyName(b[s]) : '—';
        if (on) btn.classList.add('listening'); else if (!b[s]) btn.classList.add('empty');
        btn.setAttribute('aria-label', a.name + ', key ' + (s + 1) + ': ' + (b[s] ? I.keyName(b[s]) : 'none') + '. Press to change.');
        btn.addEventListener('click', () => {
          if (performance.now() - coolT < 300) return;
          A.sfx.select(); keyMsg('');
          if (listen && listen.a === a.id && listen.s === s) { stopListen(); return; }
          listen = { a: a.id, s }; I.capturing = true; renderKeys();
          const nb = box.querySelector('.listening'); if (nb) nb.focus();
        });
        row.appendChild(btn);
      }
      box.appendChild(row);
    }
    const rs = $('btnKeysReset'); if (rs) rs.disabled = I.isDefault();
  }
  /* while a box is waiting for a key, take the next key press before anything else can see it */
  window.addEventListener('keydown', (e) => {
    if (!listen) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat) return;
    const { a, s } = listen;
    let res = null;
    if (e.code === 'Escape') { keyMsg(''); }
    else if (e.code === 'Backspace' || e.code === 'Delete') res = I.setBind(a, s, '');
    else res = I.setBind(a, s, e.code);
    if (res) { keyMsg(res.msg, !res.ok); if (res.ok) A.sfx.buy(); else A.sfx.dry(); }
    const keep = res && !res.ok && e.code !== 'Backspace' && e.code !== 'Delete';
    if (!keep) { coolT = performance.now(); stopListen(); UI.refreshHint(); const nb = document.querySelector('#keyRows .keybtn[data-a="' + a + '"][data-s="' + s + '"]'); if (nb) nb.focus(); }
  }, true);
  window.addEventListener('keyup', (e) => { if (performance.now() - coolT < 300 && document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('keybtn')) e.preventDefault(); }, true);

  function buildControls() {
    const panel = document.querySelector('#settings .panel');
    if (!panel) return;
    const g = document.createElement('div'); g.className = 'ctl-set';
    g.innerHTML = '<h3>CONTROLS</h3>' +
      '<label>Steering sensitivity <input id="setSens" type="range" min="0.6" max="1.8" step="0.1"></label>' +
      '<label class="check kbonly"><input id="setMouse" type="checkbox"> Steer with the mouse</label>' +
      '<label class="check"><input id="setTurboTog" type="checkbox"> Toggle turbo (press once to turn it on, again to turn it off)</label>' +
      '<div class="kbonly"><div class="keyhead"><span>KEYBOARD</span><span>KEY 1</span><span>KEY 2</span></div><div id="keyRows"></div>' +
      '<div class="keyfoot"><button id="btnKeysReset">RESET KEYS</button><span id="keyMsg" role="status"></span></div>' +
      '<p class="ctl-note">Click a key box, then press the key you want. <b>Esc</b> cancels, <b>Backspace</b> clears the box. Pick a key that is already used and the two actions swap. Mouse: left click fires the machine gun, right click launches a missile.</p></div>' +
      '<p class="ctl-note touchonly">On a phone: the left thumb steers, <b>FIRE</b> shoots, <b>TURBO</b> boosts and the small buttons use your gadgets.</p>';
    panel.appendChild(g);
    const q = (id) => g.querySelector('#' + id);
    q('setSens').value = S.steerSens;
    q('setSens').addEventListener('input', (e) => { S.steerSens = parseFloat(e.target.value); S.save(); });
    q('setSens').addEventListener('change', () => A.sfx.blip());
    q('setMouse').checked = S.mouseSteer !== false;
    q('setMouse').addEventListener('change', (e) => { S.mouseSteer = e.target.checked; if (!S.mouseSteer) I.mouseActive = false; S.save(); A.sfx.blip(); UI.refreshHint(); I.version++; });
    q('setTurboTog').checked = !!S.turboToggle;
    q('setTurboTog').addEventListener('change', (e) => { S.turboToggle = e.target.checked; I.turbo = false; S.save(); A.sfx.blip(); UI.refreshHint(); I.version++; });
    q('btnKeysReset').addEventListener('click', () => { I.resetBinds(); stopListen(); keyMsg('Keys reset to the defaults.'); A.sfx.select(); UI.refreshHint(); });
    renderKeys();
    UI.refreshHint();
  }

  function saveScore() {
    if (!UI.pending) return;
    const name = ($('goName').value || 'AAA').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'AAA';
    UI.lastIdx = G.scores.add(name, UI.pending.score, UI.pending.stage);
    UI.pending = null;
    A.sfx.select();
    UI.back = 'title';
    UI.show('scores');
  }

  function bind() {
    const on = (id, fn) => $(id).addEventListener('click', () => { A.resume(); A.sfx.select(); fn(); });
    on('btnStart', () => G.main.startGame());
    on('btnScores', () => { UI.back = 'title'; UI.lastIdx = -1; UI.show('scores'); });
    on('btnSettings', () => { UI.back = 'title'; UI.show('settings'); });
    on('btnResume', () => G.main.resume());
    on('btnPauseSettings', () => { UI.back = 'pause'; UI.show('settings'); });
    on('btnQuit', () => G.main.toTitle());
    on('btnSettingsBack', () => UI.show(UI.back));
    on('btnScoresPlay', () => G.main.startGame());
    on('btnScoresBack', () => G.main.toTitle());
    on('btnRetry', () => G.main.startGame());
    on('btnGoTitle', () => G.main.toTitle());
    on('btnShopLeave', () => G.main.closeShop());
    on('btnSaveScore', saveScore);
    $('goName').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3); });
    $('goName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveScore(); } });

    const sliders = { setMaster: 'master', setMusic: 'music', setSfx: 'sfx' };
    for (const id in sliders) {
      $(id).value = S[sliders[id]];
      $(id).addEventListener('input', (e) => { S[sliders[id]] = parseFloat(e.target.value); S.save(); A.applyVolumes(); });
      $(id).addEventListener('change', () => A.sfx.blip());
    }
    const checks = { setLite: 'liteAudio', setBloom: 'bloom', setShake: 'shake', setReduced: 'reduced' };
    for (const id in checks) {
      $(id).checked = !!S[checks[id]];
      $(id).addEventListener('change', (e) => { S[checks[id]] = e.target.checked; S.save(); A.sfx.blip(); });
    }
    buildControls();
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || listen) return;
      if (UI.cur === 'settings') UI.show(UI.back);
      else if (UI.cur === 'scores') G.main.toTitle();
    });
    document.addEventListener('pointerdown', (e) => { A.resume(); if (listen && !(e.target.closest && e.target.closest('.keybtn'))) stopListen(); }, { passive: true });
    document.addEventListener('keydown', () => A.resume());
  }

  G.ui = UI;
  bind();
})((window.SGS = window.SGS || {}));
