// 可拿起/投掷的物品：类型定义与简易物理
import { G, THREE, rand, pick, clamp, bx, cyl, sph, cone, glow, GEO, mat } from './g.js';
import { sphereResolve } from './phys.js';
import { burst, explode, shake } from './fx.js';
import { sfx } from './audio.js';
import { damageEnemy, damageArea } from './enemies.js';

const PILLOW = [0xf4a261, 0xe76f51, 0x2a9d8f, 0xe9c46a, 0xa8dadc, 0xc77dff];
const TOY = [0xff4d6d, 0xffd166, 0x4cc9f0, 0x80ed99, 0xc77dff, 0xff9f1c];
const BOOK = [0x9b2226, 0x005f73, 0xca6702, 0x3a5a40, 0x5a189a, 0x1d3557];

// build(g, o) 以中心为原点绘制，返回半高 hy
export const PT = {
  pillow: { name: 'Pillow', r: 0.16, m: 0.5, b: 0.2, build(g) { const c = pick(PILLOW); bx(g, 0.5, 0.16, 0.5, c); bx(g, 0.4, 0.2, 0.4, c); return 0.1; } },
  book: { name: 'Book', r: 0.1, m: 0.8, b: 0.15, build(g) { bx(g, 0.2, 0.05, 0.28, pick(BOOK)); bx(g, 0.18, 0.04, 0.27, 0xf1f1e6, 0.012, 0, 0); return 0.03; } },
  cup: { name: 'Cup', r: 0.09, m: 0.3, fragile: 1, build(g) { cyl(g, 0.045, 0.1, pick([0xffffff, 0x8ecae6, 0xffb703, 0xfb8500])); return 0.05; } },
  plate: { name: 'Plate', r: 0.09, m: 0.4, fragile: 1, hr: 0.16, build(g) { cyl(g, 0.14, 0.02, 0xfafafa, 0, 0, 0, { r: 0.3 }); cyl(g, 0.09, 0.022, 0xdfe7ee); return 0.012; } },
  bball: { name: 'Basketball', r: 0.17, m: 0.7, b: 0.78, ball: 1, build(g) { sph(g, 0.17, 0xe36414); const t = new THREE.Mesh(GEO.torus, mat(0x1b1b1b)); t.scale.setScalar(0.345); g.add(t); const t2 = t.clone(); t2.rotation.y = Math.PI / 2; g.add(t2); return 0.17; } },
  soccer: { name: 'Soccer ball', r: 0.15, m: 0.6, b: 0.7, ball: 1, build(g) { sph(g, 0.15, 0xf8f9fa); for (let i = 0; i < 6; i++) { const s = sph(g, 0.05, 0x111111); s.position.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(0.115); } return 0.15; } },
  pan: { name: 'Frying pan', r: 0.12, m: 1.6, reflect: 1, hr: 0.3, build(g) { cyl(g, 0.17, 0.05, 0x2b2d31, 0, 0, 0, { m: 0.6, r: 0.4 }); cyl(g, 0.15, 0.052, 0x111111); bx(g, 0.26, 0.03, 0.04, 0x8d5524, 0.29, 0, 0); return 0.03; } },
  lid: { name: 'Pot lid', r: 0.1, m: 0.9, reflect: 1, hr: 0.3, build(g) { cyl(g, 0.19, 0.02, 0xcfd8dc, 0, 0, 0, { m: 0.9, r: 0.25 }); sph(g, 0.035, 0x222222, 0, 0.03, 0); return 0.012; } },
  block: { name: 'Toy block', r: 0.1, m: 0.4, build(g) { bx(g, 0.17, 0.17, 0.17, pick(TOY), 0, 0, 0, { r: 0.4 }); return 0.085; } },
  vase: { name: 'Vase', r: 0.18, m: 1.2, fragile: 1, build(g) { cyl(g, 0.09, 0.3, 0x48cae4, 0, -0.03, 0, { r: 0.2 }); cyl(g, 0.05, 0.08, 0x48cae4, 0, 0.14, 0, { r: 0.2 }); sph(g, 0.07, 0xff5d8f, 0.04, 0.26, 0); sph(g, 0.06, 0xffd166, -0.05, 0.24, 0.03); sph(g, 0.06, 0xff8fab, 0, 0.3, -0.04); return 0.18; } },
  bear: { name: 'Teddy bear', r: 0.2, m: 0.5, b: 0.3, build(g) { const c = 0xa47148; sph(g, 0.17, c, 0, -0.04, 0); sph(g, 0.12, c, 0, 0.19, 0); sph(g, 0.045, c, -0.09, 0.29, 0); sph(g, 0.045, c, 0.09, 0.29, 0); sph(g, 0.05, 0xe6ccb2, 0, 0.17, 0.09); sph(g, 0.07, c, -0.17, 0, 0.03); sph(g, 0.07, c, 0.17, 0, 0.03); sph(g, 0.07, c, -0.09, -0.17, 0.08); sph(g, 0.07, c, 0.09, -0.17, 0.08); return 0.2; } },
  chair: { name: 'Chair', r: 0.4, m: 4, b: 0.2, build(g) { const c = 0xb08968; bx(g, 0.45, 0.05, 0.45, c, 0, 0, 0); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bx(g, 0.05, 0.45, 0.05, 0x7f5539, x * 0.2, -0.225, z * 0.2); bx(g, 0.45, 0.5, 0.05, c, 0, 0.27, -0.2); return 0.45; } },
  stool: { name: 'Bar stool', r: 0.32, m: 2.5, b: 0.25, build(g) { cyl(g, 0.19, 0.06, 0xe63946, 0, 0.3, 0); cyl(g, 0.03, 0.6, 0xadb5bd, 0, 0, 0, { m: 0.8, r: 0.3 }); cyl(g, 0.17, 0.03, 0xadb5bd, 0, -0.32, 0, { m: 0.8, r: 0.3 }); return 0.34; } },
  gchair: { name: 'Gaming chair', r: 0.45, m: 5, b: 0.2, build(g) { bx(g, 0.5, 0.1, 0.5, 0x111111, 0, -0.1, 0); bx(g, 0.5, 0.8, 0.1, 0x111111, 0, 0.32, -0.22); bx(g, 0.1, 0.8, 0.105, 0xff2d55, 0, 0.32, -0.22, glow(0xff2d55, 1.2)); cyl(g, 0.04, 0.35, 0x444444, 0, -0.33, 0); cyl(g, 0.28, 0.04, 0x222222, 0, -0.5, 0); return 0.55; } },
  bin: { name: 'Trash can', r: 0.22, m: 1.2, b: 0.3, build(g) { cyl(g, 0.17, 0.4, 0x6c757d, 0, 0, 0, { m: 0.5, r: 0.4 }); cyl(g, 0.18, 0.03, 0x495057, 0, 0.2, 0); return 0.21; } },
  soda: { name: 'Soda bottle (explodes)', r: 0.1, m: 0.5, explosive: 1, build(g) { cyl(g, 0.05, 0.2, 0xd00000, 0, 0, 0, { r: 0.25 }); cyl(g, 0.052, 0.07, 0xffffff); cyl(g, 0.025, 0.06, 0xd00000, 0, 0.13, 0); cyl(g, 0.028, 0.02, 0xffd60a, 0, 0.165, 0, glow(0xffd60a, 1.5)); return 0.1; } },
  duck: { name: 'Rubber duck', r: 0.1, m: 0.2, b: 0.6, squeak: 1, build(g) { sph(g, 0.09, 0xffd60a, 0, -0.01, 0); sph(g, 0.06, 0xffd60a, 0, 0.09, 0.04); cone(g, 0.025, 0.05, 0xfb8500, 0, 0.08, 0.11).rotation.x = Math.PI / 2; return 0.1; } },
  laptop: { name: 'Laptop', r: 0.1, m: 1.3, hr: 0.2, build(g) { bx(g, 0.34, 0.02, 0.24, 0x8d99ae, 0, 0, 0, { m: 0.6, r: 0.3 }); const s = bx(g, 0.34, 0.22, 0.015, 0x8d99ae, 0, 0.11, -0.13, { m: 0.6, r: 0.3 }); s.rotation.x = -0.25; const e = bx(g, 0.31, 0.19, 0.005, 0x4cc9f0, 0, 0.11, -0.12, glow(0x4cc9f0, 1.6)); e.rotation.x = -0.25; return 0.012; } },
  plant: { name: 'Potted plant', r: 0.22, m: 2, fragile: 1, build(g) { cyl(g, 0.15, 0.24, 0xbc6c25, 0, -0.1, 0); sph(g, 0.2, 0x2d6a4f, 0, 0.2, 0); sph(g, 0.15, 0x40916c, 0.12, 0.33, 0.05); sph(g, 0.14, 0x52b788, -0.1, 0.36, -0.06); return 0.22; } },
  apple: { name: 'Apple', r: 0.08, m: 0.25, b: 0.4, build(g) { sph(g, 0.055, pick([0xd62828, 0x80b918])); return 0.055; } },
  lamp: { name: 'Lamp', r: 0.16, m: 0.9, fragile: 1, build(g) { cyl(g, 0.08, 0.03, 0x333333, 0, -0.17, 0); cyl(g, 0.015, 0.25, 0x333333, 0, -0.04, 0); cyl(g, 0.11, 0.16, 0xffe8a3, 0, 0.12, 0, glow(0xffc857, 1.6)); return 0.19; } },
  bench: { name: 'Piano bench', r: 0.3, m: 3, b: 0.2, build(g) { bx(g, 0.9, 0.1, 0.36, 0x1a1a1a, 0, 0.2, 0); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bx(g, 0.05, 0.45, 0.05, 0x111111, x * 0.38, -0.05, z * 0.13); return 0.27; } },
  chess: { name: 'Chess piece', r: 0.08, m: 0.2, b: 0.3, build(g, o) { const c = o.white ? 0xf5f0e0 : 0x1a1a1a; cyl(g, 0.035, 0.03, c, 0, -0.045, 0); cyl(g, 0.02, 0.08, c, 0, 0, 0); sph(g, 0.03, c, 0, 0.055, 0); return 0.06; } },
  board: { name: 'Chessboard', r: 0.08, m: 0.9, hr: 0.25, build(g) { bx(g, 0.5, 0.03, 0.5, 0x6b4a2f); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) bx(g, 0.11, 0.032, 0.11, (i + j) % 2 ? 0xf5f0e0 : 0x2b2118, -0.165 + i * 0.11, 0.001, -0.165 + j * 0.11, { cast: false }); return 0.016; } },
  trophy: { name: 'Trophy', r: 0.14, m: 1.3, build(g) { const G1 = { m: 0.9, r: 0.2, e: 0xd4af37, ei: 0.25 }; bx(g, 0.14, 0.05, 0.14, 0x3b2314, 0, -0.15, 0); cyl(g, 0.02, 0.12, 0xd4af37, 0, -0.07, 0, G1); cyl(g, 0.08, 0.16, 0xd4af37, 0, 0.07, 0, G1); return 0.175; } },
  monitor: { name: 'Monitor', r: 0.18, m: 2.2, hr: 0.32, build(g) { bx(g, 0.7, 0.42, 0.04, 0x0b0b0d, 0, 0.04, 0); bx(g, 0.64, 0.36, 0.01, 0x4cc9f0, 0, 0.04, 0.022, { e: 0x3a86ff, ei: 1.3, r: 0.2 }); bx(g, 0.05, 0.14, 0.04, 0x8d99ae, 0, -0.2, -0.02); bx(g, 0.26, 0.015, 0.18, 0x8d99ae, 0, -0.262, 0); return 0.27; } },
  ochair: { name: 'Office chair', r: 0.45, m: 5, b: 0.2, build(g) { bx(g, 0.5, 0.08, 0.5, 0x1a1a1a, 0, -0.1, 0); bx(g, 0.48, 0.7, 0.06, 0x2b2b2b, 0, 0.3, -0.24); bx(g, 0.3, 0.16, 0.06, 0x1a1a1a, 0, 0.72, -0.24); bx(g, 0.05, 0.05, 0.4, 0x1a1a1a, -0.28, 0.1, 0); bx(g, 0.05, 0.05, 0.4, 0x1a1a1a, 0.28, 0.1, 0); cyl(g, 0.035, 0.35, 0xb0b5ba, 0, -0.33, 0, { m: 0.8, r: 0.3 }); for (let i = 0; i < 5; i++) { const b = bx(g, 0.34, 0.035, 0.05, 0xb0b5ba, 0, -0.5, 0, { m: 0.8, r: 0.3 }); b.rotation.y = i / 5 * 6.283; b.translateX(0.17); } return 0.55; } },
  cymbal: { name: 'Cymbal', r: 0.1, m: 0.8, reflect: 1, hr: 0.32, build(g) { cyl(g, 0.24, 0.012, 0xd4af37, 0, 0, 0, { m: 0.95, r: 0.2, e: 0xd4af37, ei: 0.2 }); sph(g, 0.05, 0xd4af37, 0, 0.005, 0, { m: 0.95, r: 0.2 }); return 0.01; } },
  scrap: { name: 'Robot scrap', r: 0.14, m: 1, b: 0.35, build(g, o) { const s = o.size || 0.22; bx(g, s, s * 0.7, s * 0.8, o.color ?? 0x888888, 0, 0, 0, { m: 0.6, r: 0.4 }); bx(g, s * 0.5, s * 0.2, s * 0.82, o.accent ?? 0xff3355, 0, 0, 0, glow(o.accent ?? 0xff3355, 1.5)); return s * 0.35; } },
};

export function spawnProp(type, x, y, z, o = {}) {
  const T = PT[type];
  const g = new THREE.Group(), inner = new THREE.Group();
  g.add(inner);
  const hy = T.build(inner, o);
  inner.position.y = hy - T.r;
  g.position.set(x, y + T.r, z); g.rotation.y = o.rot ?? rand(Math.PI * 2);
  G.scene.add(g);
  const p = {
    type, T, g, pos: g.position, vel: new THREE.Vector3(), av: new THREE.Vector3(), r: T.r, m: T.m,
    awake: !!o.awake, thrown: false, hits: new Set(), held: false, dead: false, rest: 0,
    life: o.life ?? -1, home: o.life ? null : { x, y: y + T.r, z, rot: g.rotation.y },
  };
  if (o.vel) { p.vel.copy(o.vel); p.awake = true; }
  G.props.push(p);
  return p;
}

export function wake(p) { p.awake = true; p.rest = 0; }

// 范围冲击：推开物品
export function impulseProps(c, radius, force, markThrown) {
  for (const p of G.props) {
    if (p.dead || p.held) continue;
    const d = p.pos.distanceTo(c);
    if (d > radius) continue;
    const k = (1 - d / radius) * force / Math.sqrt(p.m);
    _v.copy(p.pos).sub(c); _v.y += 0.6; _v.normalize();
    p.vel.addScaledVector(_v, k); wake(p);
    if (markThrown) { p.thrown = true; p.hits.clear(); }
  }
}

export function breakProp(p, quiet) {
  if (p.dead) return;
  p.dead = true; p.g.visible = false; p.awake = false; p.thrown = false;
  if (p.held && G.player) { G.player.held = null; p.held = false; }
  if (quiet) return;
  if (p.T.explosive) {
    explode(p.pos, 3.2, [0xffffff, 0xffd60a, 0xff7b00, 0xd00000]);
    damageArea(p.pos, 3.6, 75, 9);
    impulseProps(p.pos, 4, 9, true);
  } else {
    burst(p.pos, { n: 26, color: [0xffffff, 0xcaf0f8, 0x90e0ef], speed: [2, 7], life: [0.3, 0.7], size: [0.06, 0.13] });
    sfx.shatter(p.pos); damageArea(p.pos, 1.8, 16, 3);
  }
}

const _v = new THREE.Vector3(), _ax = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Quaternion(), _e = new THREE.Euler();
export function updateProps(dt) {
  const P = G.props;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    if (p.life > 0) {
      p.life -= dt;
      if (p.life < 0.5) p.g.scale.setScalar(Math.max(0.01, p.life * 2));
      if (p.life <= 0 && !p.held) { G.scene.remove(p.g); P.splice(i, 1); continue; }
      if (p.life <= 0) p.life = 0.01;
    }
    if (p.dead || p.held || !p.awake) continue;
    const sp = p.vel.length();
    const steps = clamp(Math.ceil(sp * dt / (p.r * 0.8)), 1, 8), h = dt / steps;
    let impact = 0, floor = false;
    for (let s = 0; s < steps; s++) {
      p.vel.y -= 22 * h;
      p.pos.addScaledVector(p.vel, h);
      p.pos.onFloor = false;
      const im = sphereResolve(p.pos, p.r, p.vel, p.T.b ?? 0.35, 0.82);
      if (im > impact) impact = im;
      if (p.pos.onFloor) floor = true;
    }
    if (impact > 3.5) {
      if (p.thrown && impact > 9 && (p.T.fragile || p.T.explosive)) { breakProp(p); continue; }
      if (p.T.squeak) sfx.squeak(); else sfx.thud(p.pos, impact / 8);
      p.av.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(impact * 0.8);
    }
    // 命中机器人
    if (p.thrown) {
      const hr = (p.T.hr ?? p.r) + 0.12;
      for (const e of G.enemies) {
        if (e.dead || p.hits.has(e)) continue;
        _v.set(e.pos.x, e.pos.y + e.cy, e.pos.z);
        if (_v.distanceTo(p.pos) < hr + e.r) {
          p.hits.add(e);
          const dmg = (8 + 22 * p.m) * clamp(sp / 20, 0.4, 1.8);
          _ax.copy(p.vel).normalize();
          damageEnemy(e, dmg, { dir: _ax, knock: 3 + p.m * 2.5, point: p.pos, src: 'prop' });
          sfx.bonk(p.pos); shake(0.12 + p.m * 0.03);
          burst(p.pos, { n: 14, color: [0xffffff, 0xffd166], speed: [2, 6], life: [0.2, 0.5], size: [0.08, 0.16] });
          if (p.T.fragile || p.T.explosive) { breakProp(p); break; }
          if (p.m < 2.5) { p.vel.multiplyScalar(-0.3); p.vel.y = 3; } else p.vel.multiplyScalar(0.75);
        }
      }
      if (p.dead) continue;
      if (sp < 4) { p.thrown = false; }
    }
    // 旋转
    if (p.T.ball) {
      const hs = Math.hypot(p.vel.x, p.vel.z);
      if (hs > 0.05) { _ax.set(p.vel.z, 0, -p.vel.x).normalize(); p.g.rotateOnWorldAxis(_ax, hs / p.r * dt); }
    } else {
      const a = p.av.length();
      if (a > 0.05) { _ax.copy(p.av).divideScalar(a); p.g.rotateOnWorldAxis(_ax, a * dt); }
    }
    if (floor) {
      const f = Math.max(0, 1 - (p.T.ball ? 0.7 : 3.5) * dt);
      p.vel.x *= f; p.vel.z *= f; p.av.multiplyScalar(Math.max(0, 1 - 4 * dt));
      if (sp < 0.5) {
        p.rest += dt;
        if (!p.T.ball) { // 回正
          _e.setFromQuaternion(p.g.quaternion, 'YXZ'); _e.x = 0; _e.z = 0; _up.setFromEuler(_e);
          p.g.quaternion.slerp(_up, Math.min(1, dt * 10));
        }
        if (p.rest > 0.6) { p.awake = false; p.vel.set(0, 0, 0); p.av.set(0, 0, 0); p.thrown = false; if (!p.T.ball) p.g.quaternion.copy(_up); }
      } else p.rest = 0;
    }
  }
}

// 每波开始：碎掉的物品复原；full=true 时全部归位
export function resetProps(full) {
  for (let i = G.props.length - 1; i >= 0; i--) {
    const p = G.props[i];
    if (!p.home) { if (full) { G.scene.remove(p.g); G.props.splice(i, 1); } continue; }
    if (p.dead || full) {
      p.dead = false; p.g.visible = true; p.held = false; p.thrown = false; p.awake = false;
      p.pos.set(p.home.x, p.home.y, p.home.z); p.vel.set(0, 0, 0); p.av.set(0, 0, 0);
      p.g.rotation.set(0, p.home.rot, 0); p.g.scale.setScalar(1);
    }
  }
}
