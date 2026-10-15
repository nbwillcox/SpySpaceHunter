/* Touch controls for SpySpaceHunter: a floating thumb-stick steers (analog, left / right), FIRE (hold) for the machine gun, TURBO (hold) to zip away, and small buttons for the gadgets. Read by js/mobile.js. */
window.TOUCH_CFG = {
  id: 'spyspacehunter', title: 'SpySpaceHunter', orient: 'portrait', accent: '#ff3dd0',
  hint: '<b>Left thumb</b>: floating stick to steer &nbsp; <b>Right thumb</b>: hold <b>FIRE</b> for the machine gun, hold <b>TURBO</b> to zip away, small buttons for missile, oil / mines, smoke, EMP and shield',
  unlock: () => window.SGS && window.SGS.audio && window.SGS.audio.resume(),
  pause: { pos: { l: 16, b: 70 }, mirror: true },
  controls: [
    { t: 'stick', id: 'steer', zone: [0, 0.4, 0.45, 1], mode: 'h', keys: {}, r: 60, dead: 0.1, onMove: (x) => { const I = window.SGS && window.SGS.input; if (I) I.stick = Math.abs(x) < 0.08 ? 0 : x; } },
    { t: 'btn', id: 'fire', label: 'FIRE', key: 'Space', hold: true, size: 96, pos: { r: 14, b: 22 } },
    { t: 'btn', id: 'turbo', label: 'TURBO', key: 'ShiftLeft', hold: true, size: 72, pos: { r: 120, b: 26 } },
    { t: 'btn', id: 'missile', label: 'MSL', key: 'KeyC', hold: false, size: 54, pos: { r: 14, b: 128 } },
    { t: 'btn', id: 'oil', label: 'OIL', key: 'KeyZ', hold: false, size: 54, pos: { r: 74, b: 128 } },
    { t: 'btn', id: 'smoke', label: 'SMK', key: 'KeyX', hold: false, size: 52, pos: { r: 134, b: 112 } },
    { t: 'btn', id: 'emp', label: 'EMP', key: 'KeyV', hold: false, size: 52, pos: { r: 14, b: 188 } },
    { t: 'btn', id: 'shield', label: 'SHD', key: 'KeyB', hold: false, size: 52, pos: { r: 74, b: 188 } },
  ],
};
