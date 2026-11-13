// 开始界面背景：自动试玩“预告片”。AI 操控角色在各个房间轮流展示招数，用的是真实的游戏逻辑。
import { G, THREE, clamp } from './g.js';
import { keys, pressed, mouse, grabProp } from './player.js';
import { spawnEnemy, damageEnemy } from './enemies.js';
import { WP, resetShots } from './weapons.js';
import { resetProps } from './props.js';
import { resetWorld, flipTable } from './world.js';
import { ring, flash } from './fx.js';

const D = { i: -1, t: 0, step: 0, fire: false, still: false, aim: null, strafeT: 0 };
const _v = new THREE.Vector3();
const press = (k) => { pressed[k] = true; };
const sp = (type, x, z, hp) => {
  const e = spawnEnemy(type, x, z); if (hp) e.hp = e.maxHp = hp;
  ring(_v.set(x, 0.08, z), 0xb14aff, 1.3, 0.6, 0.1); flash(_v.set(x, 1, z), 0xb14aff, 1.2, 0.25); return e;
};
const group = (type, pts, hp) => pts.forEach(([x, z]) => sp(type, x, z, hp));
function nearProp(types, maxD = 9) {
  const p = G.player; let best = null, bd = maxD;
  for (const pr of G.props) { if (pr.dead || pr.held || !types.includes(pr.type)) continue; const d = pr.pos.distanceTo(p.pos); if (d < bd) { bd = d; best = pr; } }
  return best;
}
const grab = (...types) => { const pr = nearProp(types); if (pr && !G.player.held) grabProp(pr); };
const charge = () => { if (G.player.held) mouse.l = true; };
const release = () => { if (mouse.l) { mouse.l = false; mouse.lr = true; } };
const weapon = (n) => { press('Digit' + n); };
const killAll = () => { for (const e of [...G.enemies]) damageEnemy(e, 99999, { src: 'area' }); };
const nearTable = () => { const p = G.player; let b = null, bd = 6; for (const f of G.flips) { const d = Math.hypot(f.cx - p.pos.x, f.cz - p.pos.z); if (!f.flipped && d < bd) { bd = d; b = f; } } if (b) flipTable(b, p.pos.x, p.pos.z); };

// 每个场景：出生点、朝向、时长，以及按时间触发的动作
const SCENES = [
  { // 餐厅：掀桌 + 扔椅子 + 霰弹枪
    x: 14.2, z: 5.6, yaw: 2.2, dur: 10.5, steps: [
      [0.3, () => group('roller', [[16.2, 1.4], [18, 1.2], [19.8, 1.4], [17, 2.2], [19, 2.2]], 90)],
      [1.3, nearTable],
      [2.0, () => grab('chair')], [2.2, charge], [2.9, release],
      [3.3, () => { weapon(2); D.fire = true; }],
      [5.6, () => { D.fire = false; grab('chair'); }], [5.8, charge], [6.5, release],
      [6.8, () => group('bomber', [[15.5, 1.5], [20.5, 1.5]])],
      [7.0, () => { weapon(1); D.fire = true; }],
    ],
  },
  { // 厨房：锅盖反弹子弹 + 汽水瓶爆炸
    x: 16.3, z: 12.9, yaw: Math.PI / 2, dur: 11.5, still: true, steps: [
      [0.2, () => group('blaster', [[22, 12.9], [21.4, 13.5], [22.4, 12.2]], 260)],
      [0.4, () => { grab('lid', 'pan'); }], [0.8, () => { mouse.r = true; }],
      [6.2, () => { mouse.r = false; }], [6.3, charge], [6.9, release],
      [7.2, () => grab('soda')], [7.4, charge], [8.0, release],
      [8.4, () => grab('soda')], [8.6, charge], [9.2, release],
      [9.5, () => { weapon(1); D.fire = true; }],
    ],
  },
  { // 家庭房：黑洞手雷 + 冰冻枪 + 烟花火箭筒 + 胜利舞蹈
    x: 17.2, z: 15.3, yaw: 0, dur: 13, steps: [
      [0.3, () => { group('roller', [[16.5, 19.6], [18, 20.2], [19.5, 19.6], [17.3, 20.6], [18.8, 20.8]]); group('bomber', [[15.6, 19], [20.6, 19]]); }],
      [1.1, () => press('KeyG')],
      [4.2, () => group('roller', [[16.2, 20], [17.4, 20.6], [18.6, 20.6], [19.8, 20]], 220)],
      [4.6, () => { weapon(1); D.fire = true; }],
      [7.2, () => { weapon(2); }],
      [9.6, () => { D.fire = false; killAll(); }],
      [10.1, () => { D.still = true; press('KeyB'); }],
    ],
  },
  { // 门厅：二段跳 + 喷气背包 + 下砸 + 激光炮 + 闪避 + 钩爪
    x: 8.2, z: 12.2, yaw: -Math.PI / 2, dur: 11.5, steps: [
      [0.3, () => group('roller', [[2.2, 10.6], [3, 11.6], [2.4, 12.6], [4, 10.9], [4.2, 12.3], [5, 11.6]], 70)],
      [0.9, () => { D.still = true; keys.KeyW = true; press('Space'); }], [1.15, () => press('Space')], [1.3, () => { keys.Space = true; }],
      [1.9, () => { keys.KeyW = false; }], [2.2, () => { keys.Space = false; press('KeyC'); }],
      [3.0, () => { D.still = false; group('blaster', [[2, 10.8], [2.4, 12.4], [2.8, 11.6], [3.6, 12.6]], 120); weapon(2); }],
      [3.3, () => { D.fire = true; }], [4.4, () => { D.fire = false; }], [4.9, () => { D.fire = true; }], [6.0, () => { D.fire = false; }],
      [6.3, () => press('KeyX')], [6.8, () => { weapon(1); D.fire = true; }],
      [8.2, () => { D.fire = false; D.aim = new THREE.Vector3(8.7, 3.4, 8.15); }], [8.6, () => press('KeyQ')],
      [9.5, () => { D.aim = null; press('Space'); D.fire = true; }],
    ],
  },
  { // 书房：枕头堡垒 + 扔显示器 + Boss
    x: 4.4, z: 17.2, yaw: Math.PI / 2, dur: 12.5, steps: [
      [0.3, () => { sp('boss', 10.3, 19.4, 1500); group('roller', [[9.5, 15.6], [10.4, 16.4]], 80); }],
      [0.9, () => press('KeyF')],
      [1.4, () => grab('monitor', 'ochair')], [1.6, charge], [2.3, release],
      [2.7, () => grab('monitor', 'ochair')], [2.9, charge], [3.6, release],
      [4.0, () => { weapon(2); D.fire = true; }],
      [7.0, () => { weapon(2); }], [8.1, () => { D.fire = false; }], [8.5, () => { D.fire = true; }], [9.6, () => { D.fire = false; }],
      [9.9, () => { weapon(1); D.fire = true; }],
      [11.0, () => { D.fire = false; killAll(); }],
    ],
  },
  { // 钢琴房：猫出场——挠机器人、拉屎
    x: 10.2, z: 6.4, yaw: -Math.PI / 2, dur: 10, steps: [
      [0.2, () => { G.catPos.set(6.2, 0, 5.6); Object.assign(G.cat, { mode: 'sit', sit: 0.2, atkCd: 0.3, poopCd: 2.2, target: null }); group('roller', [[2.4, 4.6], [2.8, 6.2], [2.2, 5.4], [3.4, 5.2]], 160); }],
      [4.6, () => { weapon(1); D.fire = true; }],
      [6.4, () => { D.fire = false; grab('bench', 'pillow', 'soccer'); }], [6.6, charge], [7.3, release],
      [7.6, () => { weapon(2); D.fire = true; }],
    ],
  },
];

function cut(n) {
  const p = G.player, s = SCENES[n];
  for (const e of G.enemies) e.dead = true; G.boss = null; resetShots();
  if (p.held) { p.held.held = false; p.held = null; p.aura.visible = false; p.gunDirty = true; }
  if (n === 0) { resetProps(true); resetWorld(); }
  for (const k in keys) keys[k] = false; mouse.l = mouse.r = mouse.lr = false;
  Object.assign(p, { yaw: s.yaw, pitch: -0.08, grapple: null, slamming: false, emoteT: 0, dashT: 0, slideT: 0, throwCharge: 0, charge: 0, camDist: 3.4, fp: false });
  p.pos.set(s.x, 0, s.z); p.vel.set(0, 0, 0);
  if (p.cur !== 0) press('Digit1');
  Object.assign(D, { i: n, t: 0, step: 0, fire: false, still: !!s.still, aim: null });
  G.timers.length = 0; G.slowT = 0; G.wave = 1;
  const c = document.getElementById('cut'); if (c) { c.style.transition = 'none'; c.style.opacity = 0.55; requestAnimationFrame(() => { c.style.transition = 'opacity .35s'; c.style.opacity = 0; }); }
}

export function updateDemo(dt) {
  const p = G.player;
  if (D.i < 0 || D.t >= SCENES[D.i].dur) cut((D.i + 1) % SCENES.length);
  const s = SCENES[D.i]; D.t += dt;
  while (D.step < s.steps.length && s.steps[D.step][0] <= D.t) s.steps[D.step++][1]();
  // 无限弹药、无敌
  for (let i = 0; i < WP.length; i++) { if (!p.weapons[i]) { p.weapons[i] = { rar: 4, ammo: WP[i].mag }; p.gunDirty = true; } p.weapons[i].ammo = WP[i].mag; }
  p.reloadT = 0; p.nades = 6; p.mats = 200; p.hp = 100; p.shield = 100;
  // 自动瞄准最近的机器人（从相机位置算，保证准星对得上）
  let tgt = D.aim, bd = 1e9;
  if (!tgt) for (const e of G.enemies) {
    if (e.dead || e.spawnT > 0) continue;
    const d = e.pos.distanceTo(p.pos) + (e.type === 'boss' ? -4 : 0);
    if (d < bd) { bd = d; tgt = _v.set(e.pos.x, e.pos.y + e.cy, e.pos.z); }
  }
  if (tgt && !(p.emoteT > 0)) {
    const c = G.camera.position, dx = tgt.x - c.x, dy = tgt.y - c.y, dz = tgt.z - c.z, l = Math.hypot(dx, dz) || 1;
    let dyaw = Math.atan2(dx, dz) - p.yaw; while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const k = 1 - Math.exp(-9 * dt); p.yaw += dyaw * k; p.pitch += (clamp(Math.atan2(dy, l), -0.38, 0.7) - p.pitch) * k;
  }
  // 开火（拿着东西时不动左键，交给 charge/release）
  if (!p.held) { const want = D.fire && !!tgt; if (mouse.l && !want) mouse.lr = true; if (want && !mouse.l) mouse.lp = true; mouse.l = want; }
  // 左右横移，让画面更有动感
  if (!D.still) { D.strafeT += dt; const ph = D.strafeT % 2.4; keys.KeyA = ph < 0.55; keys.KeyD = ph > 1.2 && ph < 1.75; }
  else { keys.KeyA = keys.KeyD = false; }
}
export function endDemo() {
  for (const e of G.enemies) e.dead = true;
  for (const k in keys) keys[k] = false; for (const k in pressed) delete pressed[k];
  mouse.l = mouse.r = mouse.lp = mouse.lr = false; D.i = -1;
}
