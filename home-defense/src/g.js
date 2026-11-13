// 全局共享状态与小工具
import * as THREE from 'three';
export { THREE };

export const G = {
  scene: null, camera: null, renderer: null,
  statics: [], props: [], enemies: [], shots: [], pickups: [], chests: [], flips: [], walls: [],
  player: null, time: 0, dt: 0, timeScale: 1, slowT: 0, shake: 0,
  state: 'menu', wave: 0, H: 4, W: 24, D: 22, timers: [], anim: [],
};

export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const pick = (a) => a[(Math.random() * a.length) | 0];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// 延时调用（按游戏时间）
export function after(t, fn) { G.timers.push({ t: G.time + t, fn }); }
export function runTimers() {
  for (let i = G.timers.length - 1; i >= 0; i--) {
    if (G.timers[i].t <= G.time) { const f = G.timers[i].fn; G.timers.splice(i, 1); f(); }
  }
}

// 材质与几何缓存
const mats = new Map();
export function mat(color, o = {}) {
  const key = color + '|' + (o.r ?? 0.8) + '|' + (o.m ?? 0) + '|' + (o.e ?? 0) + '|' + (o.ei ?? 1) + '|' + (o.op ?? 1);
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, roughness: o.r ?? 0.8, metalness: o.m ?? 0,
      emissive: o.e ?? 0, emissiveIntensity: o.ei ?? 1,
      transparent: (o.op ?? 1) < 1, opacity: o.op ?? 1,
    });
    mats.set(key, m);
  }
  return m;
}
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
  sph: new THREE.SphereGeometry(0.5, 16, 12),
  cone: new THREE.ConeGeometry(0.5, 1, 14),
  torus: new THREE.TorusGeometry(0.5, 0.06, 8, 28),
};
function add(geo, parent, sx, sy, sz, color, x, y, z, o = {}) {
  const m = new THREE.Mesh(geo, o.mat || mat(color, o));
  m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  m.castShadow = o.cast ?? true; m.receiveShadow = o.recv ?? true;
  if (parent) parent.add(m);
  return m;
}
// 以中心为基准
export const bx = (p, w, h, d, c, x = 0, y = 0, z = 0, o) => add(GEO.box, p, w, h, d, c, x, y, z, o);
export const cyl = (p, r, h, c, x = 0, y = 0, z = 0, o) => add(GEO.cyl, p, r * 2, h, r * 2, c, x, y, z, o);
export const sph = (p, r, c, x = 0, y = 0, z = 0, o) => add(GEO.sph, p, r * 2, r * 2, r * 2, c, x, y, z, o);
export const cone = (p, r, h, c, x = 0, y = 0, z = 0, o) => add(GEO.cone, p, r * 2, h, r * 2, c, x, y, z, o);
export const glow = (c, ei = 2.5) => ({ e: c, ei, r: 0.4 });
