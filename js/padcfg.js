/* Controller map for Spy Space Hunter: analog steering on the left stick, the D-pad fires gadgets. Read by js/pad.js. */
window.PAD_CFG = {
  id: 'spyspacehunter', title: 'SpySpaceHunter',
  hint: '<b>Left stick</b> steer &nbsp; <b>A / RT</b> machine gun &nbsp; <b>B / LT</b> turbo &nbsp; <b>X</b> missile &nbsp; <b>Y</b> oil &nbsp; <b>D-pad</b> smoke, EMP, shield &nbsp; <b>LB / RB</b> bump &nbsp; <b>Start</b> pause',
  move: { stick: 'left', mode: 'h', noDpad: true, fn: (x) => { const I = window.SGS && window.SGS.input; if (I) I.stick = Math.abs(x) < 0.08 ? 0 : x; } },
  actions: [
    { id: 'fire', label: 'Machine gun', btn: ['A', 'RT'], key: 'Space' },
    { id: 'turbo', label: 'Turbo', btn: ['B', 'LT'], key: 'ShiftLeft' },
    { id: 'missile', label: 'Missile', btn: ['X'], key: 'KeyC' },
    { id: 'oil', label: 'Oil / mines', btn: ['Y'], key: 'KeyZ' },
    { id: 'smoke', label: 'Smoke', btn: ['LEFT'], key: 'KeyX' },
    { id: 'emp', label: 'EMP', btn: ['UP'], key: 'KeyV' },
    { id: 'shield', label: 'Shield', btn: ['RIGHT'], key: 'KeyB' },
    { id: 'bumpL', label: 'Bump left', btn: ['LB'], key: 'KeyQ' },
    { id: 'bumpR', label: 'Bump right', btn: ['RB'], key: 'KeyE' },
  ],
};
