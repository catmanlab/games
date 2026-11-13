// 房屋：房间、墙、家具、可掀翻的桌子、宝箱、枕头堡垒
// 想换成自己家的户型，主要改 ROOMS / WALLS 和 buildFurniture()
import { G, THREE, rand, pick, bx, cyl, sph, cone, mat, glow, GEO } from './g.js';
import { addStatic, removeStatic, NAV, cellPos, raycast, circleResolve } from './phys.js';
import { spawnProp, wake } from './props.js';
import { burst, ring, shake, tracer } from './fx.js';
import { damageEnemy, W } from './enemies.js';
import { feed } from './ui.js';
import { sfx } from './audio.js';

export const ROOMS = [
  { id: 'piano', name: 'Piano Room', x0: 0, z0: 0, x1: 12, z1: 8, floor: 'wood', light: 0xfff1d6 },
  { id: 'dining', name: 'Dining', x0: 12, z0: 0, x1: 24, z1: 8, floor: 'wood', light: 0xffe9c4 },
  { id: 'hall', name: 'Front Hall', x0: 0, z0: 8, x1: 12, z1: 14, floor: 'wood', light: 0xfff4e0 },
  { id: 'kitchen', name: 'Kitchen', x0: 12, z0: 8, x1: 24, z1: 14, floor: 'tile', light: 0xffffff },
  { id: 'office', name: 'Office', x0: 0, z0: 14, x1: 12, z1: 22, floor: 'wood', light: 0xfff4e0 },
  { id: 'family', name: 'Family Room', x0: 12, z0: 14, x1: 24, z1: 22, floor: 'wood', light: 0xfff1d6 },
];
// [x0,z0,x1,z1,[[门中心,门宽]...]]
const WALLS = [
  [0, 0, 24, 0], [0, 22, 24, 22], [0, 0, 0, 22], [24, 0, 24, 22],
  [12, 0, 12, 5],
  [0, 8, 24, 8, [[1.6, 2.0], [12, 3]]],
  [12, 10.5, 12, 14],
  [0, 14, 12, 14, [[3, 2.6]]],
  [12, 14, 24, 14, [[18.5, 9]]],
  [12, 14, 12, 22, [[15.9, 2.0]]],
];
export const SPAWN = { x: 2.8, z: 11, yaw: Math.PI / 2 };

function tex(size, draw, rx, ry) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function woodTex(base, rx, ry) {
  return tex(256, (g, s) => {
    for (let i = 0; i < 8; i++) {
      const l = 0.82 + Math.random() * 0.3;
      g.fillStyle = `rgb(${base[0] * l | 0},${base[1] * l | 0},${base[2] * l | 0})`; g.fillRect(0, i * 32, s, 32);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, i * 32, s, 1.5);
      const off = (i * 97) % 256; g.fillRect(off, i * 32, 1.5, 32);
      for (let k = 0; k < 12; k++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; g.fillRect(0, i * 32 + Math.random() * 32, s, 1); }
    }
  }, rx, ry);
}
function tileTex(rx, ry) {
  return tex(128, (g, s) => { g.fillStyle = '#efe9dc'; g.fillRect(0, 0, s, s); g.fillStyle = '#e6dfd0'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64); g.strokeStyle = '#c9c0ae'; g.lineWidth = 2; g.strokeRect(0, 0, 64, 64); g.strokeRect(64, 64, 64, 64); g.strokeRect(64, 0, 64, 64); g.strokeRect(0, 64, 64, 64); }, rx, ry);
}
function carpetTex(base, rx, ry) {
  return tex(128, (g, s) => { g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, s, s); for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.08})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); } }, rx, ry);
}

// 家具组：b=画方块（y 为底面高度），c=碰撞盒，bc=两者
function F(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); G.scene.add(g);
  return {
    g, x, z,
    b(w, h, d, color, lx = 0, ly = 0, lz = 0, o) { return bx(g, w, h, d, color, lx, ly + h / 2, lz, o); },
    c(w, h, d, lx = 0, ly = 0, lz = 0, tag = 'furn') { return addStatic(x + lx - w / 2, ly, z + lz - d / 2, x + lx + w / 2, ly + h, z + lz + d / 2, tag); },
    bc(w, h, d, color, lx = 0, ly = 0, lz = 0, o) { this.c(w, h, d, lx, ly, lz); return this.b(w, h, d, color, lx, ly, lz, o); },
  };
}

const animMats = [];
function animMat(base, speed, sat = 0.9) {
  const m = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: base, emissiveIntensity: 1.2, roughness: 0.4 });
  animMats.push({ m, speed, sat, off: Math.random() }); return m;
}

function makeTable(cx, cz, W, L, h, axis, color, leg) {
  const outer = new THREE.Group(), inner = new THREE.Group(); outer.add(inner); outer.position.set(cx, 0, cz); G.scene.add(outer);
  const w = axis === 'x' ? L : W, d = axis === 'x' ? W : L;
  bx(inner, w, 0.08, d, color, 0, h - 0.04, 0, { r: 0.5 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bx(inner, 0.08, h - 0.08, 0.08, leg, sx * (w / 2 - 0.1), (h - 0.08) / 2, sz * (d / 2 - 0.1));
  const f = { cx, cz, W, L, h, w, d, axis, outer, inner, flipped: false, t: 1, s: 1, box: addStatic(cx - w / 2, 0, cz - d / 2, cx + w / 2, h, cz + d / 2, 'table') };
  G.flips.push(f); return f;
}
export function flipTable(f, px, pz) {
  if (f.flipped) return;
  const acrossZ = f.axis === 'x';
  const s = acrossZ ? (f.cz >= pz ? 1 : -1) : (f.cx >= px ? 1 : -1);
  f.flipped = true; f.s = s; f.t = 0;
  if (acrossZ) { f.outer.position.z = f.cz + s * f.W / 2; f.inner.position.z = -s * f.W / 2; }
  else { f.outer.position.x = f.cx + s * f.W / 2; f.inner.position.x = -s * f.W / 2; }
  removeStatic(f.box);
  const a0 = s * (f.W / 2 + f.h - 0.14), a1 = s * (f.W / 2 + f.h);
  f.box = acrossZ ? addStatic(f.cx - f.L / 2, 0, f.cz + a0, f.cx + f.L / 2, f.W, f.cz + a1, 'table')
    : addStatic(f.cx + a0, 0, f.cz - f.L / 2, f.cx + a1, f.W, f.cz + f.L / 2, 'table');
  // 桌上的东西飞出去
  for (const p of G.props) {
    if (p.dead || p.held) continue;
    if (Math.abs(p.pos.x - f.cx) < f.w / 2 + 0.1 && Math.abs(p.pos.z - f.cz) < f.d / 2 + 0.1 && p.pos.y > f.h - 0.1 && p.pos.y < f.h + 0.8) {
      p.vel.set(acrossZ ? rand(-2, 2) : s * rand(10, 15), rand(4, 7), acrossZ ? s * rand(10, 15) : rand(-2, 2));
      p.pos.y += 0.15; p.thrown = true; p.hits.clear(); wake(p);
    }
  }
  sfx.flip(); shake(0.25);
  burst({ x: f.cx, y: 0.2, z: f.cz }, { n: 30, color: [0xffe8c2, 0xffffff], speed: [1, 5], life: [0.3, 0.8], size: [0.1, 0.25], glow: 0.6 });
}
function unflip(f) {
  if (!f.flipped) return;
  f.flipped = false; f.t = 1; f.outer.position.set(f.cx, 0, f.cz); f.inner.position.set(0, 0, 0); f.outer.rotation.set(0, 0, 0);
  removeStatic(f.box); f.box = addStatic(f.cx - f.w / 2, 0, f.cz - f.d / 2, f.cx + f.w / 2, f.h, f.cz + f.d / 2, 'table');
}

function makeChest(x, z, rot = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; G.scene.add(g);
  bx(g, 0.9, 0.42, 0.6, 0x6d3b1a, 0, 0.21, 0); bx(g, 0.94, 0.08, 0.64, 0xffc300, 0, 0.42, 0, { m: 0.8, r: 0.3, e: 0xffc300, ei: 0.4 });
  const lid = new THREE.Group(); lid.position.set(0, 0.46, -0.3); g.add(lid);
  bx(lid, 0.9, 0.22, 0.6, 0x8a4b1f, 0, 0.11, 0.3); bx(lid, 0.16, 0.24, 0.62, 0xffc300, 0, 0.11, 0.3, { m: 0.8, r: 0.3, e: 0xffc300, ei: 0.5 });
  const lock = bx(g, 0.14, 0.16, 0.05, 0xffe066, 0, 0.42, 0.31, glow(0xffd60a, 2.5));
  const beam = new THREE.Mesh(GEO.cyl, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd60a).multiplyScalar(1.5), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  beam.scale.set(0.7, 3.4, 0.7); beam.position.y = 2.1; g.add(beam);
  const c = { g, lid, lock, beam, x, z, opened: false, t: 0, pos: new THREE.Vector3(x, 0.5, z), box: addStatic(x - 0.5, 0, z - 0.5, x + 0.5, 0.66, z + 0.5, 'chest') };
  G.chests.push(c); return c;
}
export function openChest(c) { c.opened = true; c.t = 0; c.beam.visible = false; c.lock.visible = false; sfx.chest(); }
export function resetChests() { for (const c of G.chests) { c.opened = false; c.lid.rotation.x = 0; c.beam.visible = true; c.lock.visible = true; } }

// ---------- 枕头堡垒（可建造的掩体） ----------
const FORT = [0xff7aa2, 0x7ad7ff, 0xffd97a, 0x9dffb0, 0xc9a2ff, 0xffa66b];
export function buildFort(x, z, alongX) {
  const g = new THREE.Group(); g.position.set(x, 0, z); if (!alongX) g.rotation.y = Math.PI / 2; G.scene.add(g);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
    const m = bx(g, 0.96, 1.16, 0.4, FORT[(r * 3 + c + ((x * 7 + z * 3) | 0)) % 6], (c - 1) * 1.0, 0.6 + r * 1.2, 0, { r: 0.9 });
    m.rotation.z = rand(-0.03, 0.03);
  }
  const hw = alongX ? 1.5 : 0.22, hd = alongX ? 0.22 : 1.5;
  const box = addStatic(x - hw, 0, z - hd, x + hw, 2.4, z + hd, 'fort');
  const w = { g, box, hp: 160, t: 0, flash: 0 }; box.ref = w; g.scale.set(1, 0.01, 1);
  G.walls.push(w);
  if (G.walls.length > 8) destroyFort(G.walls[0]);
  sfx.build(); ring({ x, y: 0.1, z }, 0x80ffdb, 2, 0.3);
  return w;
}
export function damageFort(w, dmg) {
  if (w.hp <= 0) return;
  w.hp -= dmg; w.flash = 0.12;
  if (w.hp <= 0) destroyFort(w);
}
export function destroyFort(w) {
  const i = G.walls.indexOf(w); if (i < 0) return;
  G.walls.splice(i, 1); removeStatic(w.box); G.scene.remove(w.g); w.hp = 0;
  burst({ x: w.g.position.x, y: 1.2, z: w.g.position.z }, { n: 60, color: [0xffffff, 0xffe5ec, 0xcaf0f8], speed: [1, 6], life: [0.6, 1.4], size: [0.1, 0.22], grav: 2.5, drag: 3, jitter: 0.8, glow: 0.8 });
  sfx.thud(w.g.position, 3);
}

// ---------- 家里的猫（无敌，到处溜达） ----------
const CAT = { t: 0, sit: 2, tx: 0, tz: 0, mode: 'sit', atkCd: 3, poopCd: 4, sp: 2.2, vy: 0 };
function buildCat() {
  const g = new THREE.Group(), c = 0x8d8d92, d = 0x5c5c62; g.position.set(16.5, 0, 12.8); G.scene.add(g); CAT.g = g; G.catPos = g.position; G.cat = CAT;
  bx(g, 0.2, 0.2, 0.5, c, 0, 0.3, 0); bx(g, 0.2, 0.18, 0.2, c, 0, 0.42, 0.32); bx(g, 0.06, 0.08, 0.04, d, -0.07, 0.55, 0.32); bx(g, 0.06, 0.08, 0.04, d, 0.07, 0.55, 0.32);
  bx(g, 0.04, 0.03, 0.02, 0x7CFC00, -0.05, 0.45, 0.425, glow(0x9dff3c, 1.5)); bx(g, 0.04, 0.03, 0.02, 0x7CFC00, 0.05, 0.45, 0.425, glow(0x9dff3c, 1.5)); bx(g, 0.2, 0.05, 0.1, 0xf5f5f5, 0, 0.36, 0.38);
  CAT.legs = [[-0.07, 0.18], [0.07, 0.18], [-0.07, -0.18], [0.07, -0.18]].map(([x, z]) => { const l = new THREE.Group(); l.position.set(x, 0.22, z); g.add(l); bx(l, 0.06, 0.22, 0.06, d, 0, -0.11, 0); return l; });
  CAT.tail = new THREE.Group(); CAT.tail.position.set(0, 0.36, -0.25); g.add(CAT.tail); bx(CAT.tail, 0.05, 0.36, 0.05, d, 0, 0.18, 0);
}
const _cd = new THREE.Vector3(), _co = new THREE.Vector3();
// 猫的戏份：平时溜达；战斗时会扑上去挠机器人（伤害+眩晕），还会拉屎——机器人踩到后攻击减半、移动变慢
G.poops = [];
function dropPoop(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); G.scene.add(g);
  sph(g, 0.13, 0x6b3f1d, 0, 0.07, 0).scale.y = 0.14; sph(g, 0.09, 0x7a4a24, 0, 0.16, 0).scale.y = 0.12; sph(g, 0.05, 0x8a5a2e, 0, 0.23, 0);
  G.poops.push({ g, x, z, life: 30, hit: new Set() });
  if (G.poops.length > 6) { const o = G.poops.shift(); G.scene.remove(o.g); }
  sfx.fart({ x, y: 0, z, distanceTo: (v) => Math.hypot(v.x - x, v.z - z) });
  burst({ x, y: 0.2, z }, { n: 14, color: [0x9dff3c, 0xc8ff7a], speed: [0.5, 2], life: [0.5, 1.1], size: [0.12, 0.25], grav: -1.5, glow: 0.7 });
}
function updatePoops(dt) {
  for (let i = G.poops.length - 1; i >= 0; i--) {
    const o = G.poops[i]; o.life -= dt;
    if (Math.random() < 0.12) burst({ x: o.x, y: 0.3, z: o.z }, { n: 1, color: [0x9dff3c, 0xc8ff7a], speed: [0.2, 0.7], life: [0.6, 1.2], size: [0.08, 0.16], grav: -1.2, jitter: 0.15, glow: 0.6 });
    for (const e of G.enemies) {
      if (e.dead || e.T.fly || e.spawnT > 0 || e.stinkT > 0) continue;
      if (Math.hypot(e.pos.x - o.x, e.pos.z - o.z) < e.r + 0.6) {
        e.stinkT = 9; e.dmgMul *= 0.5; e.spd *= 0.7;
        feed(`💩 ${e.T.name} stepped in cat poop! ATK -50%`); sfx.squeak();
        burst({ x: e.pos.x, y: 0.4, z: e.pos.z }, { n: 24, color: [0x9dff3c, 0x8a5a2e, 0xc8ff7a], speed: [1, 4], life: [0.4, 0.9], size: [0.1, 0.2], grav: 1 });
        o.life = Math.min(o.life, e.type === 'boss' ? 0 : 6);
      }
    }
    if (o.life < 0.5) o.g.scale.setScalar(Math.max(0.01, o.life * 2));
    if (o.life <= 0) { G.scene.remove(o.g); G.poops.splice(i, 1); }
  }
}
function catWalkTo(x, z, speed) { CAT.tx = x; CAT.tz = z; CAT.sp = speed; CAT.t = Math.hypot(x - CAT.g.position.x, z - CAT.g.position.z) / speed + 0.6; CAT.mode = 'walk'; }
function catPickSpot(fight) {
  const g = CAT.g;
  if (fight && CAT.poopCd <= 0) { // 想拉屎时，专挑机器人冲向玩家的路上
    const P = G.player.pos;
    for (const e of G.enemies) {
      if (e.dead || e.T.fly) continue;
      const ex = P.x - e.pos.x, ez = P.z - e.pos.z, el = Math.hypot(ex, ez); if (el < 3) continue;
      const k = Math.min(3, el * 0.5) / el, qx = e.pos.x + ex * k, qz = e.pos.z + ez * k, d = Math.hypot(qx - g.position.x, qz - g.position.z);
      if (d > 12 || d < 0.3) continue;
      _co.set(g.position.x, 0.3, g.position.z); _cd.set(qx - g.position.x, 0, qz - g.position.z).normalize();
      if (!raycast(_co, _cd, d)) { catWalkTo(qx, qz, 6); return true; }
    }
  }
  for (let k = 0; k < 16; k++) {
    const c = NAV.free[(Math.random() * NAV.free.length) | 0], q = cellPos(c, { x: 0, z: 0 }), d = Math.hypot(q.x - g.position.x, q.z - g.position.z);
    if (d < 1.5 || d > 9) continue;
    if (fight && k < 12 && (NAV.dist[c] < 4 || NAV.dist[c] > 16)) continue; // 战斗时往玩家附近的必经之路凑
    _co.set(g.position.x, 0.3, g.position.z); _cd.set(q.x - g.position.x, 0, q.z - g.position.z).normalize();
    if (!raycast(_co, _cd, d)) { catWalkTo(q.x, q.z, fight ? 3.6 : 2.2); return true; }
  }
  return false;
}
function updateCat(dt) {
  const g = CAT.g, t = G.time; if (!g) return;
  const fight = G.enemies.length > 0;
  CAT.tail.rotation.x = -0.5 + Math.sin(t * 2) * 0.2; CAT.tail.rotation.z = Math.sin(t * (fight ? 9 : 3)) * 0.3;
  CAT.atkCd -= dt; CAT.poopCd -= dt;
  g.position.y = Math.max(0, g.position.y + (CAT.vy = (CAT.vy || 0) - 20 * dt) * dt); if (g.position.y === 0) CAT.vy = 0;
  // 找目标去挠：视线内最近的地面机器人
  if (fight && CAT.atkCd <= 0 && CAT.mode !== 'hunt' && CAT.mode !== 'poop') {
    let best = null, bd = 11;
    for (const e of G.enemies) {
      if (e.dead || e.T.fly || e.spawnT > 0) continue;
      const d = Math.hypot(e.pos.x - g.position.x, e.pos.z - g.position.z); if (d > bd) continue;
      _co.set(g.position.x, 0.3, g.position.z); _cd.set(e.pos.x - g.position.x, 0, e.pos.z - g.position.z).normalize();
      if (!raycast(_co, _cd, d)) { bd = d; best = e; }
    }
    if (best) { CAT.mode = 'hunt'; CAT.target = best; CAT.t = 3; sfx.meow(g.position); } else CAT.atkCd = 0.5;
  }
  if (CAT.mode === 'hunt') {
    const e = CAT.target; CAT.t -= dt;
    if (!e || e.dead || CAT.t <= 0) { CAT.mode = 'sit'; CAT.sit = 0.3; CAT.atkCd = 2; return; }
    const dx = e.pos.x - g.position.x, dz = e.pos.z - g.position.z, d = Math.hypot(dx, dz);
    g.rotation.y = Math.atan2(dx, dz);
    if (d < e.r + 0.55) { // 挠！
      const c = new THREE.Vector3(e.pos.x, e.pos.y + e.cy, e.pos.z), boss = e.type === 'boss';
      for (let i = -1; i <= 1; i++) tracer(_co.set(c.x - 0.35 + i * 0.16, c.y + 0.45, c.z - 0.2).clone(), _cd.set(c.x + 0.35 + i * 0.16, c.y - 0.45, c.z + 0.2).clone(), 0xffffff, 0.05, 0.3);
      burst(c, { n: 16, color: [0xffffff, 0xffd166], speed: [2, 6], life: [0.2, 0.5] }); sfx.hiss(g.position);
      feed(`🐱 The cat scratched ${e.T.name}!`);
      e.stunT = boss ? 0.7 : 1.8;
      damageEnemy(e, boss ? 60 : 28, { dir: _cd.set(dx / d, 0, dz / d).clone(), knock: 5, point: c, src: 'cat' });
      CAT.vy = 5; CAT.atkCd = 5 + Math.random() * 3; CAT.mode = 'sit'; CAT.sit = 0.6;
      g.position.x -= dx / d * 0.5; g.position.z -= dz / d * 0.5;
      return;
    }
    g.position.x += dx / d * 7.5 * dt; g.position.z += dz / d * 7.5 * dt; circleResolve(g.position, 0.2, 0.1, 0.5);
    const w = Math.sin(t * 30) * 0.9; CAT.legs[0].rotation.x = w; CAT.legs[3].rotation.x = w; CAT.legs[1].rotation.x = -w; CAT.legs[2].rotation.x = -w;
    if (d < 2 && g.position.y === 0) CAT.vy = 4; // 起跳扑击
    return;
  }
  if (CAT.mode === 'poop') {
    CAT.t -= dt; g.rotation.x = -0.35; for (const l of CAT.legs) l.rotation.x *= 0.8;
    g.position.x += Math.sin(t * 60) * 0.002;
    if (CAT.t <= 0) { g.rotation.x = 0; dropPoop(g.position.x - Math.sin(g.rotation.y) * 0.3, g.position.z - Math.cos(g.rotation.y) * 0.3); CAT.poopCd = 8 + Math.random() * 5; CAT.mode = 'sit'; CAT.sit = 0.2; }
    return;
  }
  if (CAT.mode === 'walk') {
    const dx = CAT.tx - g.position.x, dz = CAT.tz - g.position.z, d = Math.hypot(dx, dz); CAT.t -= dt;
    if (d < 0.2 || CAT.t <= 0) {
      if ((fight || W.phase === 'fight') && CAT.poopCd <= 0) { CAT.mode = 'poop'; CAT.t = 1.1; } else { CAT.mode = 'sit'; CAT.sit = fight ? 0.4 : 1 + Math.random() * 4; }
      return;
    }
    const sp = CAT.sp; g.position.x += dx / d * sp * dt; g.position.z += dz / d * sp * dt; circleResolve(g.position, 0.2, 0.1, 0.5);
    g.rotation.y = Math.atan2(dx, dz); const w = Math.sin(t * sp * 5) * 0.6; CAT.legs[0].rotation.x = w; CAT.legs[3].rotation.x = w; CAT.legs[1].rotation.x = -w; CAT.legs[2].rotation.x = -w;
    return;
  }
  // sit
  CAT.sit -= dt; for (const l of CAT.legs) l.rotation.x *= 0.8;
  if (CAT.sit <= 0 && !catPickSpot(fight)) CAT.sit = 0.5;
}

export function resetWorld() {
  for (const o of G.poops) G.scene.remove(o.g); G.poops.length = 0; Object.assign(CAT, { mode: 'sit', sit: 2, atkCd: 3, poopCd: 4, target: null });
  for (const f of G.flips) unflip(f);
  while (G.walls.length) { const w = G.walls.pop(); removeStatic(w.box); G.scene.remove(w.g); }
  resetChests();
}

export function updateWorld(dt) {
  const t = G.time;
  for (const a of animMats) a.m.emissive.setHSL((a.off + t * a.speed) % 1, a.sat, 0.5);
  if (G.fan) G.fan.rotation.y += dt * 6;
  updateCat(dt); updatePoops(dt);
  if (G.fireMat) { G.fireMat.emissiveIntensity = 2.6 + Math.sin(t * 17) * 0.6 + Math.sin(t * 31) * 0.4; if (Math.random() < 0.35) burst(G.firePos, { n: 1, color: [0xff7b00, 0xffd166, 0xff3c00], speed: [0.4, 1.4], life: [0.3, 0.7], size: [0.1, 0.22], grav: -2.5, jitter: 0.25, dir: { x: 0, y: 1, z: 0 }, spread: 0.3 }); }
  for (const f of G.flips) if (f.flipped && f.t < 1) {
    f.t = Math.min(1, f.t + dt / 0.32);
    const e = 1 - Math.pow(1 - f.t, 3), a = f.s * Math.PI / 2 * e;
    if (f.axis === 'x') f.outer.rotation.x = a; else f.outer.rotation.z = -a;
    f.outer.position.y = Math.sin(f.t * Math.PI) * 0.25;
  }
  for (const c of G.chests) {
    if (c.opened) { if (c.t < 1) { c.t = Math.min(1, c.t + dt * 4); c.lid.rotation.x = -1.9 * (1 - Math.pow(1 - c.t, 3)); } }
    else { c.beam.material.opacity = 0.13 + Math.sin(t * 3 + c.x) * 0.05; c.lock.position.y = 0.42 + Math.sin(t * 4) * 0.01; }
  }
  for (const w of G.walls) {
    if (w.t < 1) { w.t = Math.min(1, w.t + dt * 7); const e = 1 - Math.pow(1 - w.t, 3); w.g.scale.set(1, e * (1 + 0.25 * Math.sin(w.t * Math.PI)), 1); }
    if (w.flash > 0) { w.flash -= dt; const k = w.flash > 0 ? 1.06 : 1; w.g.scale.x = k; }
  }
}

// ---------- 建造 ----------
export function buildWorld() {
  const H = G.H, scene = G.scene;
  // 地板
  const floors = {
    wood: () => woodTex([214, 164, 98], 1, 1), tile: () => tileTex(1, 1),
  };
  for (const r of ROOMS) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0, t = floors[r.floor]();
    t.repeat.set(w / 2.5, d / 2.5);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: r.floor === 'tile' ? 0.35 : 0.75 }));
    m.rotation.x = -Math.PI / 2; m.position.set((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2); m.receiveShadow = true; scene.add(m);
    // 吸顶灯
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    cyl(scene, 0.45, 0.08, 0xffffff, cx, H - 0.05, cz, { e: r.light, ei: 1.1, cast: false });
    const pl = new THREE.PointLight(r.light, 10, 16, 1.4); pl.position.set(cx, H - 1.3, cz); scene.add(pl);
  }
  addStatic(-2, -2, -2, G.W + 2, 0, G.D + 2, 'floor');
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(G.W, G.D), mat(0xf4f1ea, { r: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(G.W / 2, H, G.D / 2); scene.add(ceil);
  addStatic(-2, H, -2, G.W + 2, H + 2, G.D + 2, 'ceil');

  // 墙
  const wallMat = mat(0xfbf3dc, { r: 0.95 }), trim = mat(0xffffff, { r: 0.6 }), T = 0.1, DH = 2.9;
  const wallBox = (x0, y0, z0, x1, y1, z1) => {
    const m = new THREE.Mesh(GEO.box, wallMat); m.scale.set(x1 - x0, y1 - y0, z1 - z0); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.receiveShadow = true; scene.add(m); addStatic(x0, y0, z0, x1, y1, z1, 'wall');
  };
  for (const [x0, z0, x1, z1, doors = []] of WALLS) {
    const horiz = z0 === z1, a0 = horiz ? x0 : z0, a1 = horiz ? x1 : z1, c = horiz ? z0 : x0;
    const seg = (s, e, y0, y1) => { if (e - s < 0.01) return; if (horiz) wallBox(s - (y0 ? 0 : T), y0, c - T, e + (y0 ? 0 : T), y1, c + T); else wallBox(c - T, y0, s - (y0 ? 0 : T), c + T, y1, e + (y0 ? 0 : T)); };
    let cur = a0;
    for (const [dc, dw] of [...doors].sort((p, q) => p[0] - q[0])) {
      seg(cur, dc - dw / 2, 0, H); seg(dc - dw / 2, dc + dw / 2, DH, H); cur = dc + dw / 2;
      // 门框
      for (const sx of [-1, 1]) { const p = dc + sx * dw / 2; const m = new THREE.Mesh(GEO.box, trim); m.scale.set(horiz ? 0.1 : 0.26, DH, horiz ? 0.26 : 0.1); m.position.set(horiz ? p : c, DH / 2, horiz ? c : p); scene.add(m); }
      const m = new THREE.Mesh(GEO.box, trim); m.scale.set(horiz ? dw : 0.26, 0.1, horiz ? 0.26 : dw); m.position.set(horiz ? dc : c, DH, horiz ? c : dc); scene.add(m);
    }
    seg(cur, a1, 0, H);
  }
  // 窗（白天 + 百叶帘）
  const sky = tex(64, (g, s) => { const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#8fd3ff'); gr.addColorStop(1, '#e8f7ff'); g.fillStyle = gr; g.fillRect(0, 0, s, s); g.fillStyle = 'rgba(255,255,255,.75)'; for (let y = 0; y < s; y += 4) g.fillRect(0, y, s, 2); }, 1, 1);
  const skyMat = new THREE.MeshBasicMaterial({ map: sky, color: new THREE.Color(1.1, 1.1, 1.1), side: THREE.DoubleSide });
  const win = (x, z, w, axis, y = 1.75, h = 1.7) => {
    const g = new THREE.Group(); g.position.set(x, y, z); if (axis === 'z') g.rotation.y = Math.PI / 2; scene.add(g);
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), skyMat));
    bx(g, w + 0.2, 0.1, 0.07, 0xffffff, 0, h / 2 + 0.05, 0); bx(g, w + 0.3, 0.1, 0.12, 0xffffff, 0, -h / 2 - 0.05, 0);
    bx(g, 0.1, h + 0.1, 0.07, 0xffffff, -w / 2 - 0.05, 0, 0); bx(g, 0.1, h + 0.1, 0.07, 0xffffff, w / 2 + 0.05, 0, 0);
    for (let i = 1; i < Math.round(w / 1.1); i++) bx(g, 0.06, h, 0.05, 0xffffff, -w / 2 + i * w / Math.round(w / 1.1), 0, 0);
  };
  win(6.2, 0.12, 3.0); win(0.12, 2.2, 1.3, 'z'); win(0.12, 5.2, 1.3, 'z');            // 钢琴房
  win(18, 0.12, 2.4); win(23.88, 4, 3.4, 'z');                                         // 餐厅
  win(23.88, 11.4, 1.8, 'z', 2.0, 1.1);                                                // 厨房
  win(23.88, 16.3, 1.3, 'z'); win(23.88, 19, 1.3, 'z');                                // 家庭房
  win(0.12, 18, 2.2, 'z');                                                             // 书房
  win(0.12, 11, 1.8, 'z', 3.15, 1.3);                                                  // 门厅拱窗

  buildFurniture();
}

function rug(cx, cz, w, d, c1, c2, c3) {
  const f = F(cx, cz); f.b(w, 0.02, d, c1, 0, 0, 0, { cast: false }); f.b(w - 0.5, 0.022, d - 0.5, c2, 0, 0, 0, { cast: false }); f.b(w - 0.9, 0.024, d - 0.9, c3, 0, 0, 0, { cast: false });
  f.b(w * 0.3, 0.026, d * 0.3, c2, 0, 0, 0, { cast: false });
}
function books(f, x0, x1, y, z, axis = 'x') {
  let x = x0; const C = [0x9b2226, 0x005f73, 0xca6702, 0x3a5a40, 0x5a189a, 0xe9c46a, 0x1d3557, 0xf1faee, 0x2a9d8f];
  while (x < x1 - 0.12) { const w = rand(0.05, 0.11), h = rand(0.24, 0.36); if (axis === 'x') f.b(w, h, 0.05, pick(C), x + w / 2, y, z, { cast: false }); else f.b(0.05, h, w, pick(C), z, y, x + w / 2, { cast: false }); x += w + 0.008; }
}

function buildFurniture() {
  const P = spawnProp, scene = G.scene, H = G.H; let f;
  const WOOD = 0xc98a3c, DARK = 0x3b2314, GRAN = 0x23272b, CREAM = 0xeadfc4, CREAM2 = 0xd9cba8, WHITE = 0xfdfdfb, STEEL = { m: 0.75, r: 0.3 };

  // ===== 钢琴房 (x0..12, z0..8) =====
  rug(6.2, 3.8, 5.8, 3.6, 0x8c2f39, 0xe8d8b8, 0x7a2230);
  f = F(6.2, 0.78); f.bc(3.2, 0.45, 1.0, CREAM); f.bc(3.2, 1.0, 0.3, CREAM2, 0, 0, -0.38); f.bc(0.28, 0.72, 1.0, CREAM2, -1.74, 0, 0); f.bc(0.28, 0.72, 1.0, CREAM2, 1.74, 0, 0);
  for (const x of [-1.05, 0, 1.05]) f.b(1.0, 0.1, 0.85, 0xf3ead2, x, 0.45, 0.05);
  P('pillow', 5.3, 0.56, 0.85); P('pillow', 7.2, 0.56, 0.85);
  f = F(2.0, 1.3); f.bc(1.05, 0.45, 1.0, CREAM); f.bc(1.05, 1.0, 0.28, CREAM2, 0, 0, -0.6); f.bc(0.22, 0.68, 1.0, CREAM2, -0.62, 0, 0); f.bc(0.22, 0.68, 1.0, CREAM2, 0.62, 0, 0);
  f = F(10.7, 0.7); f.bc(0.42, 0.85, 0.42, DARK); P('plant', 10.7, 0.85, 0.7);
  makeTable(6.2, 3.7, 0.9, 1.6, 0.45, 'x', DARK, DARK);
  P('board', 6.2, 0.45, 3.7, { rot: 0 });
  for (let i = 0; i < 8; i++) P('chess', 5.95 + (i % 4) * 0.16, 0.5, 3.52 + ((i / 4) | 0) * 0.34, { white: i < 4 });
  P('book', 5.5, 0.45, 3.75); P('cup', 6.85, 0.45, 3.6);
  // 立式钢琴
  f = F(5.4, 7.56); f.bc(1.7, 1.3, 0.62, 0x101010, 0, 0, 0, { r: 0.2, m: 0.3 }); f.c(1.5, 0.76, 0.3, 0, 0, -0.42); f.b(1.5, 0.05, 0.28, 0x101010, 0, 0.68, -0.42, { r: 0.2 }); f.b(1.42, 0.03, 0.2, 0xffffff, 0, 0.73, -0.44, { r: 0.3 });
  for (let i = 0; i < 20; i++) if (i % 7 !== 2 && i % 7 !== 6) f.b(0.035, 0.035, 0.12, 0x111111, -0.68 + i * 0.07, 0.745, -0.4);
  f.b(0.08, 0.7, 0.08, 0x101010, -0.75, 0, -0.5); f.b(0.08, 0.7, 0.08, 0x101010, 0.75, 0, -0.5); f.b(0.7, 0.3, 0.02, 0xf5f0e0, 0, 0.95, -0.33);
  P('trophy', 4.9, 1.3, 7.56); P('vase', 5.9, 1.3, 7.56); P('bench', 5.4, 0, 6.5);
  f = F(7.9, 7.6); f.c(1.3, 0.9, 0.4); f.b(1.3, 0.09, 0.36, 0xd0d0d0, 0, 0.8, 0); f.b(1.2, 0.02, 0.2, 0xffffff, 0, 0.89, -0.05); f.b(0.05, 0.8, 0.05, 0x222222, -0.5, 0, 0); f.b(0.05, 0.8, 0.05, 0x222222, 0.5, 0, 0);
  f = F(0.55, 3.7); f.bc(0.6, 0.72, 1.3, 0xd9d2c5); P('block', 0.55, 0.72, 3.4); P('block', 0.55, 0.72, 3.8); P('block', 0.6, 0.72, 4.1); P('bear', 0.55, 0.72, 4.3);
  for (const x of [9.0, 9.8]) { bx(scene, 0.6, 0.45, 0.03, 0xd4af37, x, 2.3, 7.88, { m: 0.8, r: 0.3 }); bx(scene, 0.5, 0.35, 0.035, 0xfaf7ee, x, 2.3, 7.875); }
  P('soccer', 9.5, 0, 5.5); P('pillow', 3.2, 0, 5.2); P('duck', 1.0, 0, 6.8);
  for (const z of [5.12, 7.88]) cyl(scene, 0.14, H, WHITE, 12, H / 2, z); // 拱门立柱

  // ===== 餐厅 (x12..24, z0..8) =====
  rug(18, 4, 5.4, 3.8, 0x2f1a1a, 0xb08d57, 0x5c2a2a);
  makeTable(18, 4, 1.2, 2.8, 0.76, 'x', DARK, 0x2a180d);
  P('chair', 16.2, 0, 4, { rot: Math.PI / 2 }); P('chair', 19.8, 0, 4, { rot: -Math.PI / 2 });
  for (const x of [17.3, 18.7]) { P('chair', x, 0, 3.05, { rot: 0 }); P('chair', x, 0, 4.95, { rot: Math.PI }); }
  for (const x of [17.2, 18, 18.8]) { P('plate', x, 0.76, 3.68); P('plate', x, 0.76, 4.32); P('cup', x + 0.25, 0.76, 3.8); P('cup', x - 0.25, 0.76, 4.2); }
  P('soda', 17.6, 0.76, 4); P('soda', 18.4, 0.76, 4); P('vase', 18, 0.76, 4);
  // 铜吊灯
  { const g = new THREE.Group(); g.position.set(18, 2.75, 4); scene.add(g); const BR = { m: 0.9, r: 0.25 }; cyl(g, 0.012, 1.2, 0xc9a227, 0, 0.65, 0, BR); sph(g, 0.12, 0xc9a227, 0, 0, 0, BR);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; bx(g, 0.5, 0.02, 0.02, 0xc9a227, Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25, BR).rotation.y = -a; cyl(g, 0.02, 0.14, 0xfffbe6, Math.cos(a) * 0.5, 0.08, Math.sin(a) * 0.5); sph(g, 0.035, 0xffe9a8, Math.cos(a) * 0.5, 0.18, Math.sin(a) * 0.5, glow(0xffd27a, 3)); } }
  f = F(19.4, 7.55); f.bc(2.2, 0.95, 0.5, DARK); f.b(2.26, 0.04, 0.54, 0x2a180d, 0, 0.95, 0); for (const x of [-0.7, 0, 0.7]) f.b(0.6, 0.25, 0.02, 0x4a2d1a, x, 0.6, -0.26);
  P('vase', 18.7, 0.99, 7.55); P('lamp', 20.2, 0.99, 7.55); P('cup', 19.2, 0.99, 7.5); P('plate', 19.6, 0.99, 7.5);
  f = F(21.3, 7.52); f.bc(0.66, 1.5, 0.62, 0x1c1c1e, 0, 0, 0, STEEL); f.b(0.02, 0.5, 0.03, 0x888888, -0.25, 0.8, -0.32); P('plant', 21.3, 1.5, 7.52);
  f = F(23.0, 1.0); f.bc(0.4, 0.7, 0.4, 0x222222); P('plant', 23.0, 0.7, 1.0);
  for (const z of [1.7, 6.3]) for (let i = 0; i < 5; i++) { sph(scene, 0.1, 0xd00000, 23.82, 2.6 - i * 0.24, z, { e: 0xd00000, ei: 0.7, cast: false }); bx(scene, 0.03, 0.03, 0.22, 0xffd60a, 23.82, 2.6 - i * 0.24, z, glow(0xffd60a, 1)); } // 中国结挂饰
  { const g = new THREE.Group(); g.position.set(22.6, 2.4, 7.86); scene.add(g); for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283; bx(g, 0.02, 0.5, 0.02, 0xbfc5cc, Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0, STEEL).rotation.z = a - Math.PI / 2; sph(g, 0.035, 0xffffff, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0, STEEL); } }

  // ===== 门厅 (x0..12, z8..14) =====
  for (let i = 0; i < 7; i++) { const x = 3.4 + i * 0.6, h = 0.3 * (i + 1); const s = F(x + 0.3, 8.75); s.bc(0.6, h, 1.3, WHITE); s.b(0.66, 0.05, 1.34, 0xc98a3c, 0, h, 0, { r: 0.5 }); s.b(0.05, 0.9, 0.05, WHITE, 0, h, 0.6); }
  f = F(8.7, 8.75); f.bc(2.2, 2.1, 1.3, WHITE); f.b(2.2, 0.05, 1.34, 0xc98a3c, 0, 2.1, 0, { r: 0.5 }); for (let i = 0; i < 5; i++) f.b(0.05, 0.9, 0.05, WHITE, -1.0 + i * 0.5, 2.1, 0.6); f.b(2.2, 0.07, 0.09, 0xb5722a, 0, 3.0, 0.6);
  { const rail = bx(scene, 4.75, 0.07, 0.09, 0xb5722a, 5.5, 2.1, 9.35); rail.rotation.z = Math.atan2(2.1, 4.2); cyl(scene, 0.1, 1.25, WHITE, 3.3, 0.62, 9.35); sph(scene, 0.12, WHITE, 3.3, 1.3, 9.35); }
  f = F(0.13, 11); f.b(0.08, 2.4, 1.15, WHITE, 0, 0, 0); f.b(0.1, 2.6, 0.12, WHITE, 0, 0, -0.95); f.b(0.1, 2.6, 0.12, WHITE, 0, 0, 0.95); f.b(0.1, 0.14, 2.1, WHITE, 0, 2.5, 0);
  for (const z of [-0.76, 0.76]) f.b(0.03, 2.0, 0.22, 0xcfeaff, 0.02, 0.3, z, glow(0xcfeaff, 1.2)); f.b(0.05, 0.08, 0.08, 0xd4af37, 0.07, 1.05, 0.42, STEEL);
  for (const [x, y, z] of [[0, 0.5, 0], [0, 1.4, 0]]) f.b(0.1, 0.7, 0.8, 0xf1f1ee, x + 0.01, y, z);
  rug(1.5, 11, 1.4, 2.0, 0x6b705c, 0xddbea9, 0x6b705c); rug(7.5, 11.6, 6, 1.6, 0x7a2230, 0xe8d8b8, 0x8c2f39);
  { const g = new THREE.Group(); g.position.set(6, 3.0, 11.3); scene.add(g); cyl(g, 0.012, 1.0, 0xc9a227, 0, 0.5, 0); for (let r = 0; r < 4; r++) for (let i = 0; i < 10 - r * 2; i++) { const a = i / (10 - r * 2) * 6.283, R = 0.42 - r * 0.1; bx(g, 0.05, 0.22, 0.05, 0xffffff, Math.cos(a) * R, -r * 0.2, Math.sin(a) * R, { e: 0xfff3c4, ei: 2.2, r: 0.1, cast: false }); } }
  f = F(6.3, 13.62); f.bc(1.3, 0.95, 0.45, DARK); P('plant', 6.0, 0.95, 13.62); P('lamp', 6.7, 0.95, 13.62);
  P('soccer', 2.6, 0, 12.7); P('bball', 9.2, 0, 12.6); P('bball', 8.7, 2.1, 8.7); P('pillow', 9.3, 2.1, 8.8);

  // ===== 厨房 (x12..24, z8..14) =====
  f = F(14.4, 8.56); f.bc(1.05, 2.1, 0.88, 0xc4ccd4, 0, 0, 0, STEEL); f.b(0.02, 1.9, 0.02, 0x555555, 0, 0.1, 0.45); f.b(0.03, 0.8, 0.04, 0x888888, -0.08, 0.9, 0.46); f.b(0.03, 0.8, 0.04, 0x888888, 0.08, 0.9, 0.46);
  f.bc(1.05, 1.0, 0.5, WOOD, 0, 2.1, -0.15);
  f = F(19.5, 8.44); f.bc(9.0, 0.92, 0.72, WOOD); f.b(9.04, 0.05, 0.78, GRAN, 0, 0.92, 0.02, { r: 0.25 }); f.bc(9.0, 0.95, 0.42, WOOD, 0, 2.05, -0.14);
  for (let x = -4.2; x < 4.4; x += 0.9) { f.b(0.8, 0.7, 0.02, 0xd79a4a, x, 0.12, 0.365); f.b(0.8, 0.8, 0.02, 0xd79a4a, x, 2.12, 0.08); f.b(0.03, 0.12, 0.03, 0x888888, x + 0.3, 0.6, 0.39); }
  f.b(9.0, 0.6, 0.02, 0xcdd3d8, 0, 0.97, -0.34);
  f = F(23.62, 11.5); f.bc(0.72, 0.92, 4.6, WOOD); f.b(0.78, 0.05, 4.64, GRAN, -0.02, 0.92, 0, { r: 0.25 });
  for (const z of [-1.5, -0.95]) cyl(f.g, 0.13, 0.012, 0xff5522, -0.05, 0.975, z, glow(0xff4411, 2)); f.b(0.5, 0.02, 0.8, 0xaab2ba, -0.05, 0.965, 0.6, STEEL); cyl(f.g, 0.02, 0.3, 0xaab2ba, 0.2, 1.1, 0.6, STEEL);
  for (let z = -2; z < 2.2; z += 0.9) f.b(0.02, 0.7, 0.8, 0xd79a4a, -0.365, 0.12, z);
  f.bc(0.42, 0.5, 1.0, 0x9aa3ab, 0.14, 1.75, -1.2, STEEL); f.b(0.02, 0.3, 0.6, 0x111111, -0.08, 1.85, -1.3);
  f = F(18, 11.3); f.bc(2.6, 0.92, 1.1, WOOD); f.b(2.86, 0.05, 1.36, GRAN, 0, 0.92, 0, { r: 0.25 });
  for (const x of [17.4, 18.6]) { cyl(scene, 0.008, 1.1, 0x888888, x, H - 0.55, 11.3, { cast: false }); cone(scene, 0.16, 0.2, 0xfff4d6, x, H - 1.2, 11.3, { e: 0xffe2a8, ei: 2.2, cast: false }); }
  P('pan', 17.2, 0.97, 11.2); P('lid', 17.7, 0.97, 11.4); P('cup', 18.1, 0.97, 11.1); P('apple', 18.4, 0.97, 11.4); P('apple', 18.55, 0.97, 11.2); P('soda', 18.9, 0.97, 11.5); P('soda', 19.1, 0.97, 11.1);
  P('pan', 23.55, 0.97, 10.2); P('lid', 23.55, 0.97, 12.9); P('plate', 20.5, 0.97, 8.45); P('plate', 21.1, 0.97, 8.45); P('cup', 22, 0.97, 8.45); P('lid', 17, 0.97, 8.45); P('soda', 16.2, 0.97, 8.45); P('apple', 18.3, 0.97, 8.45);
  P('stool', 17.4, 0, 12.35); P('stool', 18.6, 0, 12.35); P('bin', 19.9, 0, 12.4); P('bin', 22.9, 0, 13.4);

  // ===== 家庭房 (x12..24, z14..22) =====
  rug(19.2, 18, 4.8, 3.4, 0xa4161a, 0xeadfc4, 0xa4161a);
  f = F(18, 21.68); f.bc(2.5, 1.35, 0.45, WHITE); f.b(1.5, 0.95, 0.04, 0x0d0d0d, 0, 0, -0.22); f.b(2.8, 0.09, 0.62, WHITE, 0, 1.35, -0.06); f.c(2.8, 0.09, 0.62, 0, 1.35, -0.06);
  G.fireMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff7b00, emissiveIntensity: 3 });
  bx(f.g, 0.9, 0.35, 0.03, 0, 0, 0.22, -0.25, { mat: G.fireMat, cast: false }); G.firePos = new THREE.Vector3(18, 0.3, 21.4);
  f.b(1.4, 1.4, 0.04, 0x2a2a2a, 0, 1.85, 0.18); f.b(1.26, 1.26, 0.045, 0xcfd8e3, 0, 1.92, 0.175); f.b(0.6, 0.5, 0.05, 0x27448c, -0.15, 2.2, 0.17); f.b(0.4, 0.35, 0.05, 0x8d99ae, 0.3, 2.6, 0.17);
  P('vase', 17.1, 1.44, 21.6); P('trophy', 18.9, 1.44, 21.6); P('duck', 18.3, 1.44, 21.55); P('lamp', 17.6, 1.44, 21.6);
  f = F(12.44, 18.7); f.bc(0.6, 0.85, 2.4, DARK); f.b(0.08, 1.2, 2.1, 0x0b0b0d, 0.05, 0.95, 0); bx(f.g, 0.02, 1.08, 1.98, 0, 0.1, 1.55, 0, { mat: animMat(0x2255ff, 0.05, 0.55), cast: false });
  f.b(0.5, 0.06, 0.4, 0xf1f1f1, 0.0, 0.85, 0.85); f.b(0.3, 0.02, 0.1, 0x00e5ff, 0.1, 0.91, 0.85, glow(0x00e5ff, 2));
  f = F(23.2, 17.7); f.bc(1.0, 0.45, 3.8, 0xbdb7a8); f.bc(0.3, 1.0, 3.8, 0xa8a293, 0.38, 0, 0); f.bc(1.0, 0.7, 0.26, 0xa8a293, 0, 0, -2.0); f.bc(1.0, 0.7, 0.26, 0xa8a293, 0, 0, 2.0);
  for (const z of [-1.25, 0, 1.25]) f.b(0.85, 0.1, 1.2, 0xcdc7b8, -0.05, 0.45, z);
  P('pillow', 23.1, 0.56, 16.5); P('pillow', 23.1, 0.56, 17.7); P('pillow', 23.1, 0.56, 18.9); P('bear', 23.1, 0.56, 19.3);
  f = F(15.6, 20.7); f.bc(0.9, 0.45, 0.9, 0x1a1a1a); f.bc(0.9, 1.05, 0.26, 0x111111, 0, 0, 0.52); f.bc(0.16, 0.62, 0.9, 0x111111, -0.5, 0, 0); f.bc(0.16, 0.62, 0.9, 0x111111, 0.5, 0, 0);
  makeTable(20.7, 17.7, 0.9, 1.6, 0.45, 'z', DARK, DARK);
  P('cup', 20.6, 0.45, 17.3); P('cup', 20.8, 0.45, 17.5); P('book', 20.6, 0.45, 17.9); P('soda', 20.8, 0.45, 18.2); P('apple', 20.6, 0.45, 18.25);
  // 架子鼓
  f = F(13.6, 20.9); f.c(1.6, 0.95, 1.3); const bd = cyl(f.g, 0.32, 0.4, 0x7a1220, 0, 0.34, 0, { r: 0.3 }); bd.rotation.x = Math.PI / 2; const bh = cyl(f.g, 0.3, 0.41, 0xf5f0e0, 0, 0.34, 0); bh.rotation.x = Math.PI / 2;
  cyl(f.g, 0.2, 0.16, 0x7a1220, -0.5, 0.75, -0.2, { r: 0.3 }); cyl(f.g, 0.19, 0.165, 0xf5f0e0, -0.5, 0.75, -0.2); cyl(f.g, 0.16, 0.16, 0x7a1220, 0.3, 0.85, 0.1, { r: 0.3 }); cyl(f.g, 0.15, 0.165, 0xf5f0e0, 0.3, 0.85, 0.1);
  cyl(f.g, 0.015, 0.75, 0xaaaaaa, -0.5, 0.37, -0.2, STEEL); cyl(f.g, 0.015, 1.0, 0xaaaaaa, -0.65, 0.5, 0.45, STEEL); cyl(f.g, 0.015, 1.0, 0xaaaaaa, 0.65, 0.5, 0.4, STEEL);
  P('cymbal', 12.95, 1.0, 21.35); P('cymbal', 14.25, 1.0, 21.3); P('stool', 13.6, 0, 19.9);
  P('plant', 23.3, 0, 14.8); P('soccer', 16.5, 0, 16.2);
  { const g = new THREE.Group(); g.position.set(18, H - 0.45, 18); scene.add(g); G.fan = g; cyl(scene, 0.03, 0.4, 0x222222, 18, H - 0.2, 18, { cast: false }); cyl(g, 0.14, 0.14, 0x222222, 0, 0, 0, { cast: false }); for (let i = 0; i < 5; i++) { const b = bx(g, 1.3, 0.02, 0.2, 0x3b2314, 0, 0, 0, { cast: false }); b.rotation.y = i / 5 * 6.283; b.translateX(0.75); } sph(scene, 0.16, 0xffffff, 18, H - 0.62, 18, { e: 0xfff1d6, ei: 2, cast: false }); }

  // ===== 书房 (x0..12, z14..22) =====
  { const zt = tex(128, (g, s) => { g.fillStyle = '#d8c6a0'; g.fillRect(0, 0, s, s); g.strokeStyle = '#3b2a1c'; g.lineCap = 'round'; for (let i = -2; i < 12; i++) { g.lineWidth = 6 + (i % 3) * 2; g.beginPath(); g.moveTo(-10, i * 14); g.bezierCurveTo(30, i * 14 + 16, 70, i * 14 - 14, 138, i * 14 + 8 + (i % 2) * 6); g.stroke(); } }, 1.5, 1.2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.6), new THREE.MeshStandardMaterial({ map: zt, roughness: 0.9 })); m.rotation.x = -Math.PI / 2; m.position.set(7.2, 0.012, 17.8); m.receiveShadow = true; scene.add(m); }
  f = F(6, 21.62); f.bc(9.6, 0.9, 0.72, WHITE); f.bc(9.6, 2.05, 0.42, WHITE, 0, 0.9, 0.15); f.b(9.8, 0.12, 0.5, WHITE, 0, 2.95, 0.13);
  for (let c = 0; c < 5; c++) { const x = -3.84 + c * 1.92; f.b(1.7, 0.72, 0.02, 0xf0efe9, x, 0.09, -0.365); f.b(0.03, 0.1, 0.03, 0xaaaaaa, x - 0.3, 0.55, -0.38); f.b(0.03, 0.1, 0.03, 0xaaaaaa, x + 0.3, 0.55, -0.38);
    for (let r = 0; r < 4; r++) { const y = 1.0 + r * 0.48; f.b(1.74, 0.44, 0.02, 0xe3e1d8, x, y, -0.05, { cast: false }); if ((c + r) % 4 !== 0) books(f, x - 0.8, x + rand(0.1, 0.8), y, -0.09); else { cyl(f.g, 0.07, 0.22, pick([0x2a9d8f, 0x48cae4, 0x6d4c41]), x - 0.3, y + 0.11, -0.12); cyl(f.g, 0.06, 0.18, pick([0x9b2226, 0x3b2314]), x + 0.2, y + 0.09, -0.12); } } }
  P('book', 3.2, 0.9, 21.35); P('vase', 4.6, 0.9, 21.38); P('bear', 6.0, 0.9, 21.36); P('lamp', 7.6, 0.9, 21.38); P('trophy', 9.2, 0.9, 21.38); P('book', 8.4, 0.9, 21.35);
  makeTable(7.4, 17.6, 1.15, 2.6, 0.76, 'x', DARK, 0x2a180d);
  P('monitor', 6.6, 0.76, 17.9, { rot: Math.PI }); P('monitor', 7.4, 0.76, 17.95, { rot: Math.PI }); P('monitor', 8.2, 0.76, 17.9, { rot: Math.PI });
  P('laptop', 8.3, 0.76, 17.35, { rot: Math.PI }); P('cup', 6.5, 0.76, 17.35); P('soda', 7.0, 0.76, 17.3); P('soda', 7.7, 0.76, 17.3); P('book', 7.35, 0.76, 17.4);
  P('ochair', 7.2, 0, 16.5, { rot: 0 }); P('ochair', 9.9, 0, 17.6, { rot: -Math.PI / 2 }); P('ochair', 4.6, 0, 18.4, { rot: 0.6 });
  f = F(0.6, 15.2); f.bc(0.7, 0.9, 1.4, DARK); P('plant', 0.6, 0.9, 14.9); P('book', 0.6, 0.9, 15.5);
  P('bin', 11.3, 0, 21); P('pillow', 2.4, 0, 19.6); P('bball', 10.6, 0, 15);

  buildCat();
  // ===== 宝箱 =====
  makeChest(11.25, 1.1, -Math.PI / 2); makeChest(10.9, 13.35, Math.PI); makeChest(12.7, 13.3, Math.PI / 2); makeChest(23.2, 21.2, Math.PI); makeChest(0.75, 20.4, Math.PI / 2);
}
