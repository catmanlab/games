// 按键与武器栏顺序。存 localStorage，菜单和暂停里都能改。
let mouse = { l: false, r: false, lp: false, rp: false }, pressed = {}, keys = {};
export function bindInput(m, p, k) { mouse = m; pressed = p; keys = k; }

export const DEFAULT_ORDER = ['ar', 'shotgun', 'smg', 'heavy', 'sidearm'];
export const order = DEFAULT_ORDER.slice();

export const DEFAULT_BINDS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  jump: 'Space', sprint: 'Shift', crouch: 'Ctrl', slide: 'KeyC', dash: 'KeyX',
  grapple: 'KeyQ', interact: 'KeyE', reload: 'KeyR', nade: 'KeyG',
  fort: 'KeyF',
  leanL: 'KeyZ', leanR: 'Period',
  emote: 'KeyB', view: 'KeyT', mute: 'KeyM', pause: 'KeyP',
  slot1: 'Digit1', slot2: 'Digit2', slot3: 'Digit3', slot4: 'Digit4', slot5: 'Digit5',
};
export const BIND_LABEL = {
  forward: 'Move forward', back: 'Move back', left: 'Move left', right: 'Move right',
  jump: 'Jump / jetpack', sprint: 'Sprint', crouch: 'Crouch', slide: 'Slide', dash: 'Dash',
  grapple: 'Grapple', interact: 'Interact', reload: 'Reload', nade: 'Grenade',
  fort: 'Pillow fort',
  leanL: 'Shift left', leanR: 'Shift right',
  emote: 'Dance', view: 'Camera', mute: 'Mute', pause: 'Pause',
  slot1: 'Weapon 1', slot2: 'Weapon 2', slot3: 'Weapon 3', slot4: 'Weapon 4', slot5: 'Weapon 5',
};
export const binds = { ...DEFAULT_BINDS };

export function code(action) { return binds[action]; }
export function keyName(c) {
  if (!c) return '—';
  if (c === 'MouseLeft') return 'Left click';
  if (c === 'MouseRight') return 'Right click';
  if (c === 'Shift') return 'Shift';
  if (c === 'Ctrl') return 'Ctrl';
  if (c === 'Alt') return 'Alt';
  if (c === 'Space') return 'Space';
  if (c === 'Period') return '.';
  if (c === 'Comma') return ',';
  if (c === 'Slash') return '/';
  if (c.startsWith('Key')) return c.slice(3);
  if (c.startsWith('Digit')) return c.slice(5);
  if (c.startsWith('Arrow')) return c.slice(5);
  return c;
}
function codeDown(c) {
  if (c === 'MouseLeft') return mouse.l;
  if (c === 'MouseRight') return mouse.r;
  if (c === 'Shift') return !!(keys.ShiftLeft || keys.ShiftRight);
  if (c === 'Ctrl') return !!(keys.ControlLeft || keys.ControlRight);
  if (c === 'Alt') return !!(keys.AltLeft || keys.AltRight);
  return !!keys[c];
}
function codeHit(c) {
  if (c === 'MouseLeft') return mouse.lp;
  if (c === 'MouseRight') return mouse.rp;
  if (c === 'Shift') return !!(pressed.ShiftLeft || pressed.ShiftRight);
  if (c === 'Ctrl') return !!(pressed.ControlLeft || pressed.ControlRight);
  if (c === 'Alt') return !!(pressed.AltLeft || pressed.AltRight);
  return !!pressed[c];
}
let override = null;
export function setInputOverride(fn) { override = fn; }
export function down(action) { return override ? override.down(action) : codeDown(binds[action]); }
export function hit(action) { return override ? override.hit(action) : codeHit(binds[action]); }

// Held keys and one-shot presses sent to the other device.
export const HELD_BITS = { forward: 1, back: 2, left: 4, right: 8, sprint: 16, crouch: 32, leanL: 64, leanR: 128, jump: 256 };
export const EDGE_BITS = {
  jump: 1, dash: 2, slide: 4, crouch: 8, grapple: 16, interact: 32, reload: 64, nade: 128,
  fort: 256, emote: 512, view: 1024, slot1: 2048, slot2: 4096, slot3: 8192, slot4: 16384, slot5: 32768,
};
export function eventIs(e, action) {
  const c = binds[action];
  if (c === 'Shift') return e.code === 'ShiftLeft' || e.code === 'ShiftRight';
  if (c === 'Ctrl') return e.code === 'ControlLeft' || e.code === 'ControlRight';
  if (c === 'Alt') return e.code === 'AltLeft' || e.code === 'AltRight';
  return e.code === c;
}
export function fromEvent(e) {
  if (e.type === 'mousedown') return e.button === 0 ? 'MouseLeft' : e.button === 2 ? 'MouseRight' : null;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') return 'Shift';
  if (e.code === 'ControlLeft' || e.code === 'ControlRight') return 'Ctrl';
  if (e.code === 'AltLeft' || e.code === 'AltRight') return 'Alt';
  return e.code || null;
}

function save() {
  try { localStorage.setItem('hb_cfg', JSON.stringify({ order, binds })); } catch (e) { }
}
export function loadCfg() {
  try {
    const s = JSON.parse(localStorage.getItem('hb_cfg') || 'null');
    if (s && Array.isArray(s.order) && s.order.length === 5 && DEFAULT_ORDER.every((c) => s.order.includes(c))) order.splice(0, 5, ...s.order);
    if (s && s.binds) for (const k in DEFAULT_BINDS) if (typeof s.binds[k] === 'string' && s.binds[k]) binds[k] = s.binds[k];
  } catch (e) { }
}
export function setBind(action, c) { binds[action] = c; save(); }
export function shiftOrder(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= order.length) return null;
  const prev = order.slice();
  const t = order[i]; order[i] = order[j]; order[j] = t;
  save();
  return prev;
}
loadCfg();
