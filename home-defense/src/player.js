// 玩家：输入、移动与特技、相机、角色模型动画、拿/扔/挡、交互
import { G, THREE, rand, clamp, lerp, damp, bx, cyl, sph, mat, glow } from './g.js';
import { moveBox, raycast } from './phys.js';
import { burst, ring, flash, shake, tracer, confetti, light } from './fx.js';
import { sfx, toggleMute } from './audio.js';
import { WP, RAR, gunMesh, updateWeapon, tryReload, throwNade, AIM, updateAim, chestLoot } from './weapons.js';
import { damageArea } from './enemies.js';
import { impulseProps, wake } from './props.js';
import { flipTable, openChest, buildFort } from './world.js';
import { announce, feed, setHint } from './ui.js';
import { SPAWN } from './world.js';

export const keys = {}, pressed = {};
export const mouse = { l: false, r: false, lp: false, lr: false, dx: 0, dy: 0 };
export function initInput(dom) {
  addEventListener('keydown', (e) => {
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow') || e.altKey) e.preventDefault();
    if (!keys[e.code]) pressed[e.code] = true; keys[e.code] = true;
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.l = mouse.r = false; });
  addEventListener('mousemove', (e) => { if (document.pointerLockElement === dom || G.fakeLock) { mouse.dx += e.movementX; mouse.dy += e.movementY; } });
  addEventListener('mousedown', (e) => { if (G.state !== 'play') return; if (e.button === 0) { mouse.l = true; mouse.lp = true; } if (e.button === 2) mouse.r = true; });
  addEventListener('mouseup', (e) => { if (e.button === 0) { if (mouse.l) mouse.lr = true; mouse.l = false; } if (e.button === 2) mouse.r = false; });
  addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('wheel', (e) => { if (G.state === 'play') cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: true });
}

const P = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, height: 1.8, hw: 0.32,
  muzzle: new THREE.Vector3(), camDist: 3.4,
};
export function createPlayer() {
  G.player = P;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); G.scene.add(root);
  P.root = root; P.body = body;
  const suit = 0x1b263b, arm = 0x415a77, neon = 0x00f5d4, neon2 = 0xff4dd8, o = { m: 0.4, r: 0.45 };
  // 躯干
  const torso = new THREE.Group(); torso.position.y = 0.95; body.add(torso); P.torso = torso;
  bx(torso, 0.5, 0.56, 0.28, suit, 0, 0.3, 0, o); bx(torso, 0.42, 0.2, 0.26, arm, 0, 0.02, 0, o);
  bx(torso, 0.3, 0.08, 0.02, neon, 0, 0.42, 0.15, glow(neon, 2.2)); bx(torso, 0.04, 0.3, 0.02, neon, 0, 0.25, 0.15, glow(neon, 2.2));
  // 喷气背包
  for (const x of [-0.13, 0.13]) { cyl(torso, 0.09, 0.42, 0x6c757d, x, 0.3, -0.22, { m: 0.8, r: 0.3 }); cyl(torso, 0.07, 0.06, neon2, x, 0.07, -0.22, glow(neon2, 2)); }
  // 头
  const head = new THREE.Group(); head.position.y = 0.72; torso.add(head); P.head = head;
  bx(head, 0.34, 0.34, 0.34, 0xe9ecef, 0, 0.12, 0, { m: 0.3, r: 0.4 }); bx(head, 0.36, 0.12, 0.2, 0x0b0b0d, 0, 0.14, 0.09);
  bx(head, 0.3, 0.07, 0.02, neon, 0, 0.14, 0.2, glow(neon, 3)); bx(head, 0.06, 0.16, 0.26, neon2, 0, 0.33, -0.02, glow(neon2, 1.6));
  // 披风
  const cape = new THREE.Group(); cape.position.set(0, 0.55, -0.16); torso.add(cape); P.cape = cape;
  bx(cape, 0.46, 0.75, 0.02, 0xd90429, 0, -0.38, 0, { r: 0.9 }); bx(cape, 0.46, 0.06, 0.025, 0xffd60a, 0, -0.73, 0, glow(0xffd60a, 0.8));
  // 手臂（肩-肘两段）
  const mkArm = (sx) => {
    const sh = new THREE.Group(); sh.position.set(sx * 0.32, 0.5, 0); torso.add(sh);
    bx(sh, 0.14, 0.32, 0.14, arm, 0, -0.14, 0, o); sph(sh, 0.1, suit, 0, 0, 0, o);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    bx(el, 0.12, 0.3, 0.12, suit, 0, -0.14, 0, o); bx(el, 0.14, 0.1, 0.14, sx < 0 ? neon2 : 0x0b0b0d, 0, -0.3, 0, sx < 0 ? glow(neon2, 1.5) : o);
    const hand = new THREE.Group(); hand.position.y = -0.34; el.add(hand);
    return { sh, el, hand };
  };
  P.aR = mkArm(1); P.aL = mkArm(-1);
  // 腿（髋-膝两段）
  const mkLeg = (sx) => {
    const hip = new THREE.Group(); hip.position.set(sx * 0.13, 0.95, 0); body.add(hip);
    bx(hip, 0.17, 0.46, 0.18, arm, 0, -0.23, 0, o);
    const knee = new THREE.Group(); knee.position.y = -0.46; hip.add(knee);
    bx(knee, 0.15, 0.42, 0.16, suit, 0, -0.21, 0, o); bx(knee, 0.17, 0.1, 0.28, 0xf8f9fa, 0, -0.44, 0.05, o); bx(knee, 0.175, 0.03, 0.29, neon, 0, -0.485, 0.05, glow(neon, 1.6));
    return { hip, knee };
  };
  P.lR = mkLeg(1); P.lL = mkLeg(-1);
  P.gunHolder = new THREE.Group(); P.gunHolder.rotation.x = Math.PI / 2; P.aR.hand.add(P.gunHolder);
  // 抓取光球 / 目标高亮 / 钩索
  P.aura = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff4dd8).multiplyScalar(1.2), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  P.aura.visible = false; G.scene.add(P.aura);
  P.mark = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff4dd8).multiplyScalar(2), transparent: true, opacity: 0.9, depthTest: false }));
  P.mark.visible = false; P.mark.renderOrder = 15; G.scene.add(P.mark);
  P.rope = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x00f5d4).multiplyScalar(2.2) }));
  P.rope.visible = false; P.rope.frustumCulled = false; G.scene.add(P.rope);
  P.ghost = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 0.4), new THREE.MeshBasicMaterial({ color: 0x80ffdb, transparent: true, opacity: 0.18, depthWrite: false }));
  P.ghost.visible = false; G.scene.add(P.ghost);
  resetPlayer();
}
export function resetPlayer() {
  Object.assign(P, {
    hp: 100, shield: 50, onGround: false, jumps: 0, fuel: 1, dashCd: 0, dashT: 0, grappleCd: 0, grapple: null, slideT: 0, slamming: false,
    held: null, throwCharge: 0, blocking: false, weapons: WP.map((W, i) => (i === 0 ? { rar: 0, ammo: W.mag } : null)), cur: 0, burstLeft: 0, burstT: 0, fireT: 0, reloadT: 0, charge: 0,
    mats: 30, nades: 1, score: 0, kills: 0, combo: 0, comboT: 0, hitMark: 0, hitCrit: false, hurtT: 0, recoil: 0, ads: false, fp: false, emoteT: 0,
    runPh: 0, gunDirty: true, wallT: 0, wallN: null, coyote: 0, jetting: false, invT: 0, blocks: 0, dead: false, buildMode: false, lean: 0, airT: 0, landT: 0,
    spin: 0, camDist: 3.4, fov: 75, yaw: SPAWN.yaw, pitch: 0, height: 1.8,
  });
  P.pos.set(SPAWN.x, 0, SPAWN.z); P.vel.set(0, 0, 0);
}
function cycleWeapon(d) {
  if (P.held) return;
  for (let i = 1; i <= WP.length; i++) { const n = (P.cur + d * i + WP.length * 2) % WP.length; if (P.weapons[n]) { setWeapon(n); return; } }
}
function setWeapon(n) {
  if (!P.weapons[n] || n === P.cur) return;
  P.cur = n; P.reloadT = 0; P.charge = 0; P.burstLeft = 0; P.fireT = Math.max(P.fireT, 0.2); P.gunDirty = true; sfx.swap();
}

const MULTI = ['', '', 'DOUBLE KILL!', 'TRIPLE KILL!!', 'QUAD KILL!!!', 'PENTA KILL!!!!', 'UNSTOPPABLE!!!!!'];
export function onKill(e, info) {
  P.kills++; P.combo = P.comboT > 0 ? P.combo + 1 : 1; P.comboT = 3.2;
  const pts = Math.round(e.T.score * (1 + (P.combo - 1) * 0.25) * (info.crit ? 1.5 : 1));
  P.score += pts; P.mats += e.type === 'boss' ? 60 : 5;
  const how = info.src === 'cat' ? '🐱 Cat clawed' : info.src === 'prop' ? '🪑 Smashed' : info.src === 'area' ? '💥 Blew up' : info.crit ? '🎯 Headshot' : 'Destroyed';
  feed(`${how} ${e.T.name}  +${pts}`);
  if (P.combo >= 2) { announce(MULTI[Math.min(P.combo, 6)], 'multi', 1.4); sfx.multi(P.combo); if (P.combo >= 3) G.slowT = Math.max(G.slowT, 0.45); }
  else sfx.kill();
  if (e.type === 'boss') { announce('BOSS DEFEATED!', 'clear', 3); G.slowT = 1.6; confetti(e.pos.clone().setY(2)); }
}
export function hurtPlayer(dmg, from, knock = 0) {
  if (P.dead || P.dashT > 0 || P.invT > 0 || G.state !== 'play') return false;
  dmg = Math.round(dmg);
  const s = Math.min(P.shield, dmg); P.shield -= s; P.hp -= dmg - s;
  P.hurtT = 0.5; P.hurtShield = s >= dmg; shake(0.25); sfx.hurt(); P.emoteT = 0;
  if (from) {
    const dx = P.pos.x - from.x, dz = P.pos.z - from.z, l = Math.hypot(dx, dz) || 1;
    if (knock) { P.vel.x += dx / l * knock; P.vel.z += dz / l * knock; P.vel.y = Math.max(P.vel.y, knock * 0.35); }
    P.hurtDir = Math.atan2(dx, dz);
  }
  if (P.hp <= 0) { P.hp = 0; P.dead = true; if (P.held) dropHeld(); G.onDeath(); }
  return true;
}

function dropHeld(throwSpeed) {
  const h = P.held; if (!h) return;
  h.held = false; P.held = null; P.aura.visible = false; wake(h);
  if (throwSpeed) {
    _v.copy(AIM.point).sub(h.pos); const dist = _v.length(); _v.normalize();
    _v.y += Math.min(0.12, dist * 0.004); _v.normalize();
    h.vel.copy(_v).multiplyScalar(throwSpeed); h.thrown = true; h.hits.clear();
    h.av.set(rand(-8, 8), rand(-8, 8), rand(-8, 8));
  } else h.vel.copy(P.vel).multiplyScalar(0.5);
  P.gunDirty = true;
}

const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _t = new THREE.Vector3(), _o = new THREE.Vector3(), _mv = {};
const UP = new THREE.Vector3(0, 1, 0);

// 找准星附近可抓取的物品
function findGrab() {
  let best = null, bd = 0.9;
  for (const p of G.props) {
    if (p.dead || p.held) continue;
    _v.copy(p.pos).sub(AIM.o); const t = _v.dot(AIM.d);
    if (t < 0.3 || t > 13) continue;
    const perp = Math.sqrt(Math.max(0, _v.lengthSq() - t * t)) - p.r;
    const sc = perp + t * 0.02;
    if (sc < bd) { const h = raycast(AIM.o, _f.copy(p.pos).sub(AIM.o).normalize(), t); if (h && h.t < t - p.r - 0.35) continue; bd = sc; best = p; }
  }
  return best;
}
function findNear(list, maxD, test) {
  let best = null, bd = maxD;
  for (const c of list) {
    if (test && !test(c)) continue;
    const cx = c.x ?? c.cx, cz = c.z ?? c.cz, d = Math.hypot(cx - P.pos.x, cz - P.pos.z);
    if (d > bd) continue;
    const dot = ((cx - P.pos.x) * Math.sin(P.yaw) + (cz - P.pos.z) * Math.cos(P.yaw)) / (d || 1);
    if (dot < 0.2 && d > 1) continue;
    bd = d; best = c;
  }
  return best;
}

export function grabProp(target) {
  const p = P;
  target.held = true; p.held = target; target.thrown = false; target.vel.set(0, 0, 0); p.throwCharge = 0; p.charge = 0; sfx.grab(); tracer(_v.set(p.pos.x, p.pos.y + 1.2, p.pos.z), target.pos, 0xff4dd8, 0.05, 0.25); p.aura.visible = true; p.gunDirty = true;
}

export function updatePlayer(dt) {
  const p = P;
  // 视角
  const sens = 0.0022 * (p.ads ? 0.6 : 1);
  p.yaw -= mouse.dx * sens; p.pitch = clamp(p.pitch - mouse.dy * sens, -1.35, 1.35);
  mouse.dx = mouse.dy = 0;
  if (p.dead) { p.vel.x *= 0.9; p.vel.z *= 0.9; p.vel.y -= 24 * dt; moveBox(p.pos, p.hw, 0.6, p.vel, dt, _mv); updateCamera(dt); animate(dt, 0); clearPressed(); return; }

  const fwdX = Math.sin(p.yaw), fwdZ = Math.cos(p.yaw), rgtX = -fwdZ, rgtZ = fwdX; // 屏幕右 = -cos, sin
  let ix = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), iz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const il = Math.hypot(ix, iz) || 1; ix /= il; iz /= il;
  let wx = fwdX * iz + rgtX * ix, wz = fwdZ * iz + rgtZ * ix;
  const moving = ix !== 0 || iz !== 0;
  if (moving || mouse.l || pressed.Space) p.emoteT = 0;
  const sprint = keys.ShiftLeft && iz > 0 && !p.ads && !p.blocking;
  p.dashCd -= dt; p.grappleCd -= dt; p.invT -= dt; p.comboT -= dt; if (p.comboT <= 0) p.combo = 0;

  // ---- 冲刺闪避 (X) ----
  if (pressed.KeyX && p.dashCd <= 0) {
    p.dashT = 0.2; p.dashCd = 1.8; p.grapple = null; p.slideT = 0;
    if (!moving) { wx = fwdX; wz = fwdZ; }
    p.dashX = wx; p.dashZ = wz; p.vel.y = Math.max(p.vel.y, 1.5); sfx.dash(); p.spin = Math.PI * 2;
    ring(_v.set(p.pos.x, p.pos.y + 0.9, p.pos.z), 0x00f5d4, 1.4, 0.25);
  }
  // ---- 钩爪 (Q) ----
  if (pressed.KeyQ) {
    if (p.grapple) p.grapple = null;
    else if (p.grappleCd <= 0) {
      const h = raycast(AIM.o, AIM.d, 32);
      if (h && h.t > 2.5) { p.grapple = { pt: new THREE.Vector3().copy(AIM.o).addScaledVector(AIM.d, h.t), t: 0 }; p.grappleCd = 2.2; sfx.grapple(); p.slideT = 0; flash(p.grapple.pt, 0x00f5d4, 0.5, 0.2); }
      else sfx.empty();
    }
  }
  // ---- 滑铲 / 下砸 (C) ----
  if (pressed.KeyC || pressed.ControlLeft) {
    if (p.onGround && moving && p.slideT <= 0) { p.slideT = 0.75; const s = Math.max(11.5, Math.hypot(p.vel.x, p.vel.z) + 3); p.vel.x = wx * s; p.vel.z = wz * s; sfx.slide(); }
    else if (!p.onGround && !p.slamming && p.pos.y > 0.9) { p.slamming = true; p.vel.set(0, -30, 0); p.grapple = null; sfx.dash(); }
  }

  // ---- 水平移动 ----
  const maxSp = p.blocking || p.ads ? 3.6 : sprint ? 8.6 : 5.6;
  if (p.dashT > 0) {
    p.dashT -= dt; p.vel.x = p.dashX * 19; p.vel.z = p.dashZ * 19; if (p.vel.y < 0) p.vel.y = 0;
    burst(_v.set(p.pos.x, p.pos.y + rand(0.3, 1.5), p.pos.z), { n: 4, color: [0x00f5d4, 0xff4dd8, 0xffffff], speed: [0, 1.5], life: [0.2, 0.45], size: [0.12, 0.26], grav: 0 });
    if (p.dashT <= 0) { p.vel.x *= 0.45; p.vel.z *= 0.45; }
  } else if (p.grapple) {
    const g = p.grapple; g.t += dt;
    _v.copy(g.pt).sub(_t.set(p.pos.x, p.pos.y + 1.1, p.pos.z)); const d = _v.length(); _v.normalize();
    p.vel.addScaledVector(_v, 75 * dt); p.vel.x += wx * 12 * dt; p.vel.z += wz * 12 * dt;
    const sp = p.vel.length(); if (sp > 24) p.vel.multiplyScalar(24 / sp);
    p.vel.y += 24 * dt * 0.85; // 抵消大部分重力
    if (d < 1.6 || g.t > 2.2) { p.grapple = null; p.jumps = 1; }
  } else if (p.slideT > 0) {
    p.slideT -= dt; const f = Math.max(0, 1 - 1.1 * dt); p.vel.x *= f; p.vel.z *= f;
    if (Math.random() < 0.6) burst(_v.set(p.pos.x, p.pos.y + 0.1, p.pos.z), { n: 2, color: [0xffffff, 0xffd166], speed: [0.5, 2.5], life: [0.15, 0.35], size: [0.06, 0.12] });
    if (!p.onGround && p.slideT < 0.6) p.slideT = 0;
  } else {
    const acc = p.onGround ? 70 : 22, hs = Math.hypot(p.vel.x, p.vel.z);
    if (p.onGround || moving) {
      const tx = wx * maxSp, tz = wz * maxSp;
      if (!p.onGround && hs > maxSp) { p.vel.x += wx * 10 * dt; p.vel.z += wz * 10 * dt; const f = Math.max(0, 1 - 0.4 * dt); p.vel.x *= f; p.vel.z *= f; }
      else {
        const ddx = tx - p.vel.x, ddz = tz - p.vel.z, dl = Math.hypot(ddx, ddz), st = Math.min(dl, acc * dt * (hs > maxSp + 1 ? 0.35 : 1));
        if (dl > 1e-5) { p.vel.x += ddx / dl * st; p.vel.z += ddz / dl * st; }
      }
    }
  }
  // ---- 跳跃 / 二段跳 / 蹬墙 / 喷气背包 ----
  p.coyote -= dt; p.wallT -= dt;
  if (pressed.Space) {
    if (p.grapple) { p.grapple = null; p.vel.y = Math.max(p.vel.y, 0) + 6.5; p.jumps = 1; sfx.jump2(); }
    else if (p.onGround || p.coyote > 0) { p.vel.y = 8.8; p.jumps = 1; p.coyote = 0; p.onGround = false; if (p.slideT > 0) { p.slideT = 0; p.vel.x *= 1.12; p.vel.z *= 1.12; } sfx.jump(); }
    else if (p.wallT > 0 && p.wallN) { p.vel.x = p.wallN.x * 8.5 + wx * 3; p.vel.z = p.wallN.z * 8.5 + wz * 3; p.vel.y = 9; p.jumps = 1; p.wallT = 0; sfx.jump2(); ring(_v.set(p.pos.x - p.wallN.x * 0.3, p.pos.y + 0.6, p.pos.z - p.wallN.z * 0.3), 0xffffff, 1, 0.25); p.spin = Math.PI * 2; }
    else if (p.jumps < 2) { p.vel.y = 8.6; p.jumps = 2; p.slamming = false; sfx.jump2(); p.spin = Math.PI * 2; ring(_v.set(p.pos.x, p.pos.y, p.pos.z), 0x00f5d4, 1.2, 0.3); burst(_v, { n: 14, color: [0x00f5d4, 0xffffff], speed: [1, 4], life: [0.2, 0.5], dir: { x: 0, y: -1, z: 0 }, spread: 0.6 }); }
  }
  p.jetting = false;
  if (keys.Space && !p.onGround && p.jumps >= 2 && p.fuel > 0 && p.vel.y < 6.5 && !p.slamming && p.spin <= 0.5 && !p.grapple) {
    p.jetting = true; p.fuel -= dt / 1.7; p.vel.y += 44 * dt; if (p.vel.y > 6.5) p.vel.y = 6.5;
    for (const sx of [-0.13, 0.13]) burst(_v.set(p.pos.x - fwdX * 0.25 + rgtX * sx, p.pos.y + 0.95, p.pos.z - fwdZ * 0.25 + rgtZ * sx), { n: 2, color: [0xff4dd8, 0xffd166, 0xffffff], speed: [3, 6], life: [0.15, 0.35], size: [0.1, 0.2], dir: { x: 0, y: -1, z: 0 }, spread: 0.2, grav: 0 });
    if (Math.random() < 0.4) sfx.jet();
  }
  if (p.onGround) p.fuel = Math.min(1, p.fuel + dt * 0.9);
  if (!p.slamming) p.vel.y -= 24 * dt;
  if (p.vel.y < -34) p.vel.y = -34;

  // ---- 碰撞移动 ----
  const wasGround = p.onGround, vyBefore = p.vel.y;
  const th = p.slideT > 0 ? 0.9 : 1.8; p.height = th;
  moveBox(p.pos, p.hw, th, p.vel, dt, _mv);
  p.onGround = _mv.ground;
  if (_mv.wallX || _mv.wallZ) { p.wallT = 0.22; p.wallN = { x: _mv.wallX, z: _mv.wallZ }; }
  p.pos.x = clamp(p.pos.x, 0.45, G.W - 0.45); p.pos.z = clamp(p.pos.z, 0.45, G.D - 0.45);
  if (p.onGround) {
    if (!wasGround) {
      p.landT = 0.18;
      if (p.slamming) {
        p.slamming = false; const c = _v.set(p.pos.x, p.pos.y + 0.15, p.pos.z).clone();
        ring(c, 0x00f5d4, 6, 0.5); ring(c, 0xffffff, 4, 0.35); flash(c, 0x00f5d4, 2, 0.2); light(c, 0x00f5d4, 50, 0.3);
        burst(c, { n: 60, color: [0x00f5d4, 0xffffff, 0xffd166], speed: [3, 10], life: [0.3, 0.8], dir: { x: 0, y: 0.5, z: 0 }, spread: 1 });
        damageArea(c, 4.8, 70, 12); impulseProps(c, 5.5, 11, true); shake(0.7); sfx.slam(); p.invT = 0.3;
      } else if (vyBefore < -9) { sfx.thud(null, 2); burst(_v.set(p.pos.x, p.pos.y + 0.05, p.pos.z), { n: 10, color: 0xffffff, speed: [1, 3], life: [0.15, 0.35], dir: { x: 0, y: 0.3, z: 0 }, spread: 1, glow: 0.6 }); }
    }
    p.jumps = 0; p.coyote = 0.12; p.slamming = false;
  } else if (wasGround && p.jumps === 0) p.jumps = 1;

  updateCamera(dt);
  updateAim();

  // ---- 交互 ----
  if (pressed.KeyT) { p.fp = !p.fp; }
  if (pressed.KeyM) announce(toggleMute() ? '🔇 Muted' : '🔊 Sound on', 'info', 0.8);
  if (pressed.KeyB && p.onGround && !p.held) { p.emoteT = 4.5; confetti(_v.set(p.pos.x, p.pos.y + 1.5, p.pos.z)); sfx.rare(); }
  for (let i = 0; i < WP.length; i++) if (pressed['Digit' + (i + 1)] && !p.held) setWeapon(i);
  if (pressed.KeyR && !p.held) tryReload(p);
  if (pressed.KeyG) { if (p.held) dropHeld(); throwNade(p); }

  // 建造枕头堡垒 (F)
  if (pressed.KeyF) {
    const ax = Math.abs(fwdX) > Math.abs(fwdZ); // 面朝 x 方向 → 墙沿 z
    const bx0 = Math.round((p.pos.x + fwdX * 2.3) * 2) / 2, bz0 = Math.round((p.pos.z + fwdZ * 2.3) * 2) / 2;
    if (p.mats < 10) { announce('Not enough materials (destroy robots to get more)', 'warn', 1); sfx.empty(); }
    else if (bx0 < 1.6 || bz0 < 1.6 || bx0 > G.W - 1.6 || bz0 > G.D - 1.6) sfx.empty();
    else { p.mats -= 10; buildFort(bx0, bz0, !ax); }
  }

  // 抓取 / 交互 (E)
  let hint = '';
  const target = p.held ? null : findGrab();
  const chest = !p.held && !target ? findNear(G.chests, 2.4, (c) => !c.opened) : null;
  const table = !p.held && !target && !chest ? findNear(G.flips, 2.6, (f) => !f.flipped) : null;
  if (target) { p.mark.visible = true; p.mark.position.copy(target.pos); p.mark.scale.setScalar(target.r + 0.18 + Math.sin(G.time * 8) * 0.03); p.mark.quaternion.copy(G.camera.quaternion); hint = `[E] Grab: ${target.T.name}`; }
  else p.mark.visible = false;
  if (chest) hint = '[E] Open chest'; if (table) hint = '[E] Flip table!';
  if (p.held) hint = `[LMB] Hold to throw  [RMB] Block  [E] Drop · ${p.held.T.name}${p.held.T.reflect ? ' (reflects shots)' : ''}`;
  setHint(hint);
  if (pressed.KeyE) {
    if (p.held) dropHeld();
    else if (target) grabProp(target);
    else if (chest) { openChest(chest); chestLoot(chest); }
    else if (table) { flipTable(table, p.pos.x, p.pos.z); }
  }

  // ---- 手持物品：投掷 / 格挡；否则开枪 ----
  p.ads = false; p.blocking = false;
  if (p.held) {
    const h = p.held; p.blocking = mouse.r;
    if (mouse.l) p.throwCharge = Math.min(1, p.throwCharge + dt / 0.7);
    if (mouse.lr && !mouse.l) {
      const k = p.throwCharge; p.throwCharge = 0;
      const sp = lerp(15, 36, k) / (1 + h.m * 0.07);
      sfx.throw(k); shake(0.1 + k * 0.15); flash(h.pos, 0xff4dd8, 0.5, 0.12); p.throwAnim = 0.25;
      dropHeld(sp);
    } else {
      // 悬浮在身前
      const side = p.blocking ? 0 : 0.5, fd = p.blocking ? 1.05 : 0.95, up = p.blocking ? 1.15 : 1.25;
      const cp = Math.cos(p.pitch), sp2 = Math.sin(p.pitch);
      _t.set(p.pos.x + fwdX * cp * fd + rgtX * side, p.pos.y + up + sp2 * fd * 0.9 - p.throwCharge * 0.1, p.pos.z + fwdZ * cp * fd + rgtZ * side);
      if (p.throwCharge > 0) _t.addScaledVector(_v.set(-fwdX, 0, -fwdZ), p.throwCharge * 0.35);
      h.pos.lerp(_t, 1 - Math.exp(-22 * dt)); h.vel.set(0, 0, 0);
      h.g.rotation.y += dt * (2 + p.throwCharge * 14); h.g.rotation.x = damp(h.g.rotation.x, 0, 6, dt); h.g.rotation.z = damp(h.g.rotation.z, 0, 6, dt);
      p.aura.position.copy(h.pos); p.aura.scale.setScalar((p.blocking ? 0.95 : h.r + 0.28) * (1 + p.throwCharge * 0.3) + Math.sin(G.time * 10) * 0.02);
      p.aura.material.opacity = p.blocking ? 0.3 : 0.16 + p.throwCharge * 0.25;
      p.aura.material.color.set(p.blocking ? 0x80ffdb : 0xff4dd8).multiplyScalar(1.3);
      if (p.throwCharge > 0.1) burst(h.pos, { n: 1, color: [0xff4dd8, 0xffffff], speed: [1, 3], life: [0.15, 0.3], size: [0.06, 0.12], grav: 0 });
    }
  } else {
    p.ads = mouse.r;
    updateWeapon(dt, mouse.l, mouse.lp);
  }
  p.hitMark -= dt; p.hurtT -= dt;
  p.recoil = damp(p.recoil, 0, 12, dt);

  // 钩索可视化
  if (p.grapple) {
    const a = _o.set(p.pos.x + rgtX * -0.3, p.pos.y + 1.3, p.pos.z + rgtZ * -0.3), b = p.grapple.pt, len = a.distanceTo(b);
    p.rope.visible = true; p.rope.position.copy(a).add(b).multiplyScalar(0.5); p.rope.lookAt(b); p.rope.scale.set(0.035, 0.035, len);
  } else p.rope.visible = false;

  animate(dt, Math.hypot(p.vel.x, p.vel.z), ix, iz);
  clearPressed();
}
function clearPressed() { for (const k in pressed) delete pressed[k]; mouse.lp = false; mouse.lr = false; }

// ---------- 相机 ----------
function updateCamera(dt) {
  const p = P, cam = G.camera;
  const emote = p.emoteT > 0;
  const tDist = p.fp ? 0 : emote ? 3.8 : G.demo ? 3.1 : p.ads ? 1.9 : p.blocking ? 2.9 : 3.5;
  const yaw = emote ? p.yaw + Math.PI + Math.sin(G.time * 0.8) * 0.5 : p.yaw, pitch = emote ? -0.15 : p.pitch + p.recoil;
  const cp = Math.cos(pitch), fx = Math.sin(yaw) * cp, fy = Math.sin(pitch), fz = Math.cos(yaw) * cp;
  const rx = -Math.cos(yaw), rz = Math.sin(yaw);
  const eye = p.height > 1 ? 1.62 : 0.85;
  p.eyeY = damp(p.eyeY ?? eye, eye, 14, dt);
  // 肩部偏移（先检测是否会穿墙）
  _o.set(p.pos.x, p.pos.y + p.eyeY, p.pos.z);
  let side = p.fp || emote ? 0 : 0.62;
  if (side) { _v.set(rx, 0, rz); const h = raycast(_o, _v, side + 0.25); if (h) side = Math.max(0, h.t - 0.25); }
  _o.x += rx * side; _o.z += rz * side;
  _v.set(-fx, -fy, -fz);
  let dist = tDist;
  if (dist > 0) { const h = raycast(_o, _v, dist + 0.3); if (h) dist = Math.max(0.3, h.t - 0.3); }
  p.camDist = dist < p.camDist ? dist : damp(p.camDist, dist, 10, dt);
  cam.position.set(_o.x - fx * p.camDist, _o.y - fy * p.camDist, _o.z - fz * p.camDist);
  if (G.shake > 0.001) { cam.position.x += rand(-1, 1) * G.shake * 0.12; cam.position.y += rand(-1, 1) * G.shake * 0.12; cam.position.z += rand(-1, 1) * G.shake * 0.12; }
  _t.set(cam.position.x + fx, cam.position.y + fy, cam.position.z + fz); cam.lookAt(_t);
  const sp = Math.hypot(p.vel.x, p.vel.z);
  const tf = (p.ads ? 48 : 74) + clamp((sp - 6) * 1.6, 0, 16) + (p.dashT > 0 ? 8 : 0);
  p.fov = damp(p.fov, tf, 9, dt);
  if (Math.abs(cam.fov - p.fov) > 0.05) { cam.fov = p.fov; cam.updateProjectionMatrix(); }
  cam.updateMatrixWorld();
}

// ---------- 模型动画 ----------
function animate(dt, hs, ix = 0, iz = 0) {
  const p = P, root = p.root, t = G.time;
  root.visible = (!p.fp && p.camDist > 0.85) || p.emoteT > 0;
  root.position.copy(p.pos);
  root.rotation.y = p.yaw;
  if (p.gunDirty) {
    p.gunDirty = false; p.gunHolder.clear();
    if (!p.held && p.weapons[p.cur]) { p.gun = gunMesh(p.cur, p.weapons[p.cur].rar); p.gunHolder.add(p.gun); } else p.gun = null;
  }
  const B = p.body, L = p.lL, R = p.lR, aL = p.aL, aR = p.aR;
  let bodyRx = 0, bodyY = 0, bodyRz = 0, torsoRx = 0;
  let lh = 0, lk = 0, rh = 0, rk = 0;
  if (p.spin > 0) p.spin = Math.max(0, p.spin - dt * 16);
  p.landT -= dt;
  if (p.dead) { bodyRx = -1.5; bodyY = -0.75; }
  else if (p.emoteT > 0) {
    p.emoteT -= dt; const b = t * 9;
    bodyY = Math.abs(Math.sin(b)) * 0.14; root.rotation.y = p.yaw + Math.sin(t * 4.5) * 0.9; bodyRz = Math.sin(b) * 0.12;
    lh = Math.sin(b) * 0.5; rh = -Math.sin(b) * 0.5; lk = rk = 0.4 + Math.sin(b * 2) * 0.3;
    aL.sh.rotation.set(-2.6 + Math.sin(b) * 0.5, 0, -0.5); aR.sh.rotation.set(-2.6 - Math.sin(b) * 0.5, 0, 0.5); aL.el.rotation.x = aR.el.rotation.x = -0.6 + Math.sin(b * 2) * 0.4;
    if (Math.random() < 0.15) burst(_v.set(p.pos.x + rand(-0.6, 0.6), p.pos.y + rand(0.5, 2), p.pos.z + rand(-0.6, 0.6)), { n: 2, color: [0xff4dd8, 0x00f5d4, 0xffd166], speed: [0.5, 2], life: [0.3, 0.7], grav: -1 });
  } else if (p.slideT > 0) { bodyRx = -1.05; bodyY = -0.55; lh = -1.3; rh = -0.9; lk = 0.2; rk = 0.9; }
  else if (!p.onGround) {
    if (p.slamming) { bodyRx = 0.5; lh = 0.4; rh = 0.4; lk = 1.6; rk = 1.6; }
    else { const up = clamp(p.vel.y / 9, -1, 1); lh = -0.7 - up * 0.3; rh = 0.25 + up * 0.2; lk = 1.1; rk = 0.5 - up * 0.3; torsoRx = up * -0.12; if (p.grapple) { bodyRx = 0.5; lh = 0.5; rh = 0.2; } }
  } else if (hs > 0.6) {
    p.runPh += dt * (4 + hs * 1.25); const ph = p.runPh, amp = clamp(hs / 6, 0.3, 1.15), back = iz < 0 ? -1 : 1;
    lh = Math.sin(ph) * 0.95 * amp * back; rh = -Math.sin(ph) * 0.95 * amp * back;
    lk = Math.max(0, Math.cos(ph)) * 1.3 * amp + 0.15; rk = Math.max(0, -Math.cos(ph)) * 1.3 * amp + 0.15;
    bodyY = Math.abs(Math.cos(ph)) * 0.06 * amp - 0.03; bodyRx = hs > 7 ? 0.22 : 0.08 * amp; bodyRz = -ix * 0.12;
    if (hs > 7.5 && Math.random() < 0.25) burst(_v.set(p.pos.x, p.pos.y + 0.05, p.pos.z), { n: 1, color: 0xffffff, speed: [0.3, 1.2], life: [0.15, 0.3], size: [0.05, 0.1], glow: 0.5 });
  } else { bodyY = Math.sin(t * 2.2) * 0.012; lk = rk = 0.06; }
  if (p.landT > 0 && p.onGround) { bodyY -= p.landT * 1.2; lk += p.landT * 3; rk += p.landT * 3; lh -= p.landT * 1.5; rh -= p.landT * 1.5; }
  B.position.y = damp(B.position.y, bodyY, 18, dt);
  B.rotation.x = damp(B.rotation.x, bodyRx, 14, dt) ; B.rotation.z = damp(B.rotation.z, bodyRz, 10, dt);
  B.rotation.y = p.dashT > 0 ? 0 : 0;
  // 空翻（二段跳/蹬墙/冲刺）
  if (p.spin > 0 && !p.emoteT) B.rotation.x = -(Math.PI * 2 - p.spin) * (p.dashT > 0 || p.onGround ? 0 : 1) + bodyRx;
  const k = 1 - Math.exp(-20 * dt);
  L.hip.rotation.x += (-lh - L.hip.rotation.x) * k; R.hip.rotation.x += (-rh - R.hip.rotation.x) * k;
  L.knee.rotation.x += (lk - L.knee.rotation.x) * k; R.knee.rotation.x += (rk - R.knee.rotation.x) * k;
  p.torso.rotation.x = torsoRx; p.torso.rotation.y = 0;
  p.head.rotation.x = clamp(-p.pitch * 0.6, -0.6, 0.6);
  // 披风
  p.cape.rotation.x = damp(p.cape.rotation.x, 0.15 + clamp(hs * 0.11, 0, 1.2) + (p.onGround ? 0 : clamp(-p.vel.y * 0.06, -0.1, 0.6)) + Math.sin(t * 9) * 0.05 * clamp(hs, 0.3, 3), 8, dt);
  // 手臂
  if (!(p.emoteT > 0) && !p.dead) {
    const aim = -Math.PI / 2 - p.pitch - B.rotation.x * 0.8;
    p.throwAnim = Math.max(0, (p.throwAnim || 0) - dt);
    if (p.held) {
      // 左手（引力手套）前伸，右手后摆
      aL.sh.rotation.set(aim + (p.throwAnim > 0 ? 0.5 : -p.throwCharge * 0.5), 0, 0.25); aL.el.rotation.x = -0.2 - p.throwCharge * 0.9;
      aR.sh.rotation.set(p.blocking ? aim : 0.3, 0, p.blocking ? -0.25 : 0.15); aR.el.rotation.x = p.blocking ? -0.2 : -0.5;
    } else {
      const rc = p.recoil * 3 + (p.reloadT > 0 ? Math.sin(p.reloadT * 10) * 0.25 + 0.5 : 0);
      aR.sh.rotation.set(aim + rc, 0, -0.06); aR.el.rotation.x = -0.05;
      aL.sh.rotation.set(aim + rc + 0.12, 0, 0.62); aL.el.rotation.x = -0.35;
    }
  }
  root.updateMatrixWorld(true);
  // 枪口位置
  if (p.fp && !(p.emoteT > 0)) {
    G.camera.getWorldDirection(_f); _r.crossVectors(_f, UP).normalize();
    p.muzzle.copy(G.camera.position).addScaledVector(_f, 0.7).addScaledVector(_r, 0.25); p.muzzle.y -= 0.2;
  } else if (p.gun) { p.muzzle.set(0, 0, WP[p.cur].len); p.gun.localToWorld(p.muzzle); }
  else { p.muzzle.set(0, -0.1, 0); p.aL.hand.localToWorld(p.muzzle); }
  // 建造预览关闭
  p.ghost.visible = false;
}
