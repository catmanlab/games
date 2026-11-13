// 玩具机器人：外形、AI、受伤/死亡、波次
import { G, THREE, rand, pick, clamp, damp, after, bx, cyl, sph, cone, mat, glow, GEO } from './g.js';
import { raycast, circleResolve, updateFlow, flowDir, randomFarCell, cellPos, NAV } from './phys.js';
import { burst, explode, ring, flash, shake, light } from './fx.js';
import { sfx } from './audio.js';
import { spawnProp, resetProps } from './props.js';
import { fireOrb, dropLoot, supplyDrop } from './weapons.js';
import { hurtPlayer, onKill } from './player.js';
import { dmgNum, announce } from './ui.js';
import { damageFort } from './world.js';

export const ET = {
  roller: { hp: 150, spd: 4.2, r: 0.55, cy: 0.75, hy: 1.22, hr: 0.27, score: 10, name: 'Roller', col: 0xff7b00, acc: 0xff2d2d },
  blaster: { hp: 200, spd: 2.8, r: 0.6, cy: 0.95, hy: 1.55, hr: 0.27, score: 15, name: 'Blaster', col: 0x2ec4b6, acc: 0xffe14d },
  drone: { hp: 113, spd: 3.8, r: 0.5, cy: 0, hy: 0, hr: 0, score: 15, fly: 1, name: 'Drone', col: 0x9d4edd, acc: 0xff4dd8 },
  bomber: { hp: 100, spd: 6.0, r: 0.45, cy: 0.38, hy: 0, hr: 0, score: 12, name: 'Bomber', col: 0xd00000, acc: 0xffea00 },
  boss: { hp: 6000, spd: 2.7, r: 1.35, cy: 0.55, hy: 1.05, hr: 0.42, score: 300, name: 'Vacuum King', col: 0x343a40, acc: 0xff0054 },
};

const eyeMat = (c) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: 2.5, roughness: 0.3 });
const BUILD = {
  roller(g, e, T) {
    e.wheel = sph(g, 0.32, 0x2b2d31, 0, 0.32, 0, { m: 0.5, r: 0.5 }); const t = new THREE.Mesh(GEO.torus, mat(T.acc, glow(T.acc, 1.5))); t.scale.setScalar(0.66); t.rotation.y = Math.PI / 2; e.wheel.add(t); t.scale.setScalar(1.05);
    bx(g, 0.5, 0.42, 0.4, T.col, 0, 0.82, 0, { m: 0.4, r: 0.5 }); bx(g, 0.38, 0.3, 0.34, 0xdee2e6, 0, 1.22, 0, { m: 0.5, r: 0.4 });
    e.eye = eyeMat(T.acc); bx(g, 0.26, 0.09, 0.04, 0, 0, 1.24, 0.17, { mat: e.eye });
    cyl(g, 0.012, 0.22, 0x888888, 0.1, 1.48, 0); sph(g, 0.035, T.acc, 0.1, 1.6, 0, glow(T.acc, 2));
    e.armL = bx(g, 0.1, 0.1, 0.5, 0x495057, -0.34, 0.85, 0.2); e.armR = bx(g, 0.1, 0.1, 0.5, 0x495057, 0.34, 0.85, 0.2);
    bx(g, 0.14, 0.14, 0.12, T.acc, -0.34, 0.85, 0.48, glow(T.acc, 1)); bx(g, 0.14, 0.14, 0.12, T.acc, 0.34, 0.85, 0.48, glow(T.acc, 1));
  },
  blaster(g, e, T) {
    e.legL = bx(g, 0.16, 0.6, 0.2, 0x495057, -0.17, 0.3, 0); e.legR = bx(g, 0.16, 0.6, 0.2, 0x495057, 0.17, 0.3, 0);
    bx(g, 0.62, 0.62, 0.46, T.col, 0, 0.95, 0, { m: 0.4, r: 0.45 }); bx(g, 0.3, 0.2, 0.02, T.acc, 0, 1.0, 0.24, glow(T.acc, 1.2));
    sph(g, 0.24, 0xdee2e6, 0, 1.5, 0, { m: 0.5, r: 0.35 }); e.eye = eyeMat(T.acc); bx(g, 0.34, 0.1, 0.1, 0, 0, 1.52, 0.19, { mat: e.eye });
    const c = cyl(g, 0.11, 0.7, 0x343a40, 0.42, 1.0, 0.22, { m: 0.6, r: 0.4 }); c.rotation.x = Math.PI / 2;
    e.tip = cyl(g, 0.09, 0.06, 0, 0.42, 1.0, 0.58, { mat: e.eye }); e.tip.rotation.x = Math.PI / 2;
    bx(g, 0.14, 0.4, 0.16, 0x495057, -0.4, 0.95, 0);
  },
  drone(g, e, T) {
    sph(g, 0.26, T.col, 0, 0, 0, { m: 0.5, r: 0.4 }); e.eye = eyeMat(T.acc); sph(g, 0.1, 0, 0, -0.02, 0.21, { mat: e.eye });
    e.rotors = [];
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const a = bx(g, 0.05, 0.04, 0.5, 0x343a40, x * 0.22, 0.08, z * 0.22); a.rotation.y = x * z > 0 ? Math.PI / 4 : -Math.PI / 4;
      const r = bx(g, 0.5, 0.012, 0.06, 0xe9ecef, x * 0.4, 0.16, z * 0.4, glow(T.acc, 0.6)); e.rotors.push(r);
    }
    const c = cyl(g, 0.05, 0.3, 0x343a40, 0, -0.22, 0.12); c.rotation.x = Math.PI / 2.6;
  },
  bomber(g, e, T) {
    e.core = new THREE.Group(); e.core.position.y = 0.38; g.add(e.core);
    sph(e.core, 0.3, T.col, 0, 0, 0, { m: 0.3, r: 0.4 }); e.eye = eyeMat(T.acc);
    for (let i = 0; i < 10; i++) { const s = cone(e.core, 0.07, 0.22, 0, 0, 0, 0, { mat: e.eye }); const d = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(); s.position.copy(d).multiplyScalar(0.36); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); }
  },
  boss(g, e, T) {
    cyl(g, 1.25, 0.45, T.col, 0, 0.3, 0, { m: 0.6, r: 0.35 }); cyl(g, 1.28, 0.1, 0x111111, 0, 0.12, 0);
    e.eye = eyeMat(T.acc); const band = cyl(g, 1.27, 0.07, 0, 0, 0.42, 0, { mat: e.eye });
    cyl(g, 0.7, 0.3, 0x495057, 0, 0.68, 0, { m: 0.7, r: 0.3 }); e.coreM = sph(g, 0.4, 0, 0, 1.0, 0, { mat: e.eye });
    bx(g, 0.9, 0.16, 0.1, 0, 0, 0.36, 1.2, { mat: e.eye });
    e.rotors = [];
    for (const x of [-0.8, 0.8]) { const b = new THREE.Group(); b.position.set(x, 0.1, 1.0); g.add(b); for (let i = 0; i < 3; i++) { const br = bx(b, 0.7, 0.05, 0.08, 0xffd60a, 0, 0, 0, glow(0xffd60a, 0.8)); br.rotation.y = i * Math.PI / 3; } e.rotors.push(b); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; cone(g, 0.12, 0.4, 0xadb5bd, Math.cos(a) * 0.9, 0.72, Math.sin(a) * 0.9, { m: 0.8, r: 0.3 }); }
  },
};

const barGeoMat = (c) => new THREE.SpriteMaterial({ color: c, depthTest: false, transparent: true });
export function spawnEnemy(type, x, z) {
  const T = ET[type], g = new THREE.Group();
  const sc = 1 + 0.1 * (G.wave - 1);
  const e = {
    type, T, g, pos: g.position, vel: new THREE.Vector3(), knock: new THREE.Vector3(), r: T.r, cy: T.cy,
    hp: T.hp * (type === 'boss' ? 1 + 0.5 * (G.wave / 5 - 1) : sc), spd: T.spd * rand(0.9, 1.1) * Math.min(1.5, 1 + 0.02 * G.wave),
    dead: false, spawnT: 0.35, flash: 0, chill: 0, frozenT: 0, atkT: rand(0.6, 1.6), losT: rand(0.25), los: false, phase: rand(6.28),
    stuckT: 0, lastX: x, lastZ: z, state: 'chase', stT: 4, fuse: -1, dmgMul: type === 'boss' ? 1 : 1 + 0.05 * (G.wave - 1), stunT: 0, stinkT: 0,
  };
  e.maxHp = e.hp;
  BUILD[type](g, e, T);
  g.position.set(x, T.fly ? 2.2 : 0, z); g.scale.setScalar(0.01);
  G.scene.add(g);
  if (type !== 'boss') {
    e.bar0 = new THREE.Sprite(barGeoMat(0x000000)); e.bar0.scale.set(0.9, 0.1, 1); e.bar0.center.set(0, 0.5); e.bar0.renderOrder = 20; e.bar0.material.opacity = 0.6;
    e.bar1 = new THREE.Sprite(barGeoMat(0xff3355)); e.bar1.scale.set(0.9, 0.07, 1); e.bar1.center.set(0, 0.5); e.bar1.renderOrder = 21;
    e.bar0.visible = e.bar1.visible = false; G.scene.add(e.bar0, e.bar1);
  } else G.boss = e;
  G.enemies.push(e);
  return e;
}

const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Vector3(), _f = { x: 0, z: 0 }, _r = new THREE.Vector3();
export const eCenter = (e, out) => out.set(e.pos.x, e.pos.y + e.cy, e.pos.z);

let hitSndT = 0;
export function damageEnemy(e, dmg, info = {}) {
  if (e.dead || e.spawnT > 0) return false;
  if (e.frozenT > 0) dmg *= 2;
  if (info.crit) dmg *= 1.8;
  dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg; e.flash = 0.1;
  dmgNum(info.point || eCenter(e, _c), dmg, info.crit, e.frozenT > 0);
  if (info.dir && info.knock) { const k = e.type === 'boss' ? 0.08 : 1; e.knock.x += info.dir.x * info.knock * k; e.knock.z += info.dir.z * info.knock * k; }
  if (info.chill && e.frozenT <= 0) {
    e.chill += info.chill * (e.type === 'boss' ? 0.35 : 1);
    if (e.chill >= 1) freeze(e);
  }
  const p = G.player; p.hitMark = 0.14; p.hitCrit = !!info.crit;
  if (G.time - hitSndT > 0.04) { hitSndT = G.time; info.crit ? sfx.crit() : sfx.hit(); }
  if (e.hp <= 0) killEnemy(e, info);
  return true;
}
function freeze(e) {
  e.chill = 0; e.frozenT = e.type === 'boss' ? 1.4 : 3.5;
  if (!e.ice) { e.ice = new THREE.Mesh(GEO.sph, new THREE.MeshStandardMaterial({ color: 0xbfefff, transparent: true, opacity: 0.5, roughness: 0.1, emissive: 0x4cc9f0, emissiveIntensity: 0.6 })); e.g.add(e.ice); }
  e.ice.visible = true; e.ice.scale.setScalar(e.r * 2.6); e.ice.position.y = e.cy;
  sfx.frozen(e.pos); eCenter(e, _c);
  burst(_c, { n: 24, color: [0xffffff, 0x90e0ef, 0x4cc9f0], speed: [1, 4], life: [0.3, 0.8], size: [0.08, 0.16], grav: 2 });
}

export function damageArea(c, radius, dmg, knock = 6, o = {}) {
  for (const e of G.enemies) {
    if (e.dead || e === o.skip) continue;
    eCenter(e, _v); const d = _v.distanceTo(c) - e.r * 0.6;
    if (d > radius) continue;
    _d.copy(_v).sub(c).setY(0).normalize();
    damageEnemy(e, dmg * (1 - 0.6 * clamp(d / radius, 0, 1)), { dir: _d.clone(), knock, src: 'area', chill: o.chill });
  }
  if (o.hurtPlayer) {
    const p = G.player, d = _v.set(p.pos.x, p.pos.y + 0.9, p.pos.z).distanceTo(c);
    if (d < radius) hurtPlayer(o.hurtPlayer * (1 - 0.5 * d / radius), c, 7);
  }
  for (const w of [...G.walls]) {
    if (Math.hypot(w.g.position.x - c.x, w.g.position.z - c.z) < radius + 0.8 && o.hurtPlayer) damageFort(w, dmg * 0.6);
  }
}

function killEnemy(e, info) {
  if (e.dead) return;
  e.dead = true; eCenter(e, _c); const c = _c.clone(), T = e.T;
  const big = e.type === 'boss';
  explode(c, big ? 5 : 1.6, [T.acc, 0xffffff, T.col, 0xffd166]);
  if (e.frozenT > 0) burst(c, { n: 50, color: [0xffffff, 0x90e0ef, 0xbfefff], speed: [3, 9], life: [0.4, 1], size: [0.08, 0.2] });
  const n = big ? 14 : (3 + (Math.random() * 3 | 0));
  for (let i = 0; i < n; i++) {
    _v.set(rand(-1, 1), rand(0.6, 1.6), rand(-1, 1)).multiplyScalar(rand(3, 6) * (big ? 1.6 : 1));
    if (info.dir) _v.addScaledVector(info.dir, 3);
    spawnProp('scrap', c.x + rand(-0.2, 0.2), Math.max(0.1, c.y - 0.14 + rand(0.3)), c.z + rand(-0.2, 0.2), { life: rand(7, 11), vel: _v, color: pick([T.col, 0x495057, 0xdee2e6]), accent: T.acc, size: rand(0.16, 0.3) * (big ? 1.8 : 1) });
  }
  if (e.type === 'bomber') after(0.08, () => { damageArea(c, 3.2, 60, 8, { skip: e }); });
  if (big) {
    G.boss = null; shake(1);
    for (let i = 1; i < 6; i++) after(i * 0.18, () => explode(_v.set(c.x + rand(-1.5, 1.5), c.y + rand(1.5), c.z + rand(-1.5, 1.5)).clone(), 3, [T.acc, 0xffffff, 0xffd166]));
  }
  dropLoot(c, e.type);
  onKill(e, info);
}
function removeEnemy(e) {
  G.scene.remove(e.g); if (e.bar0) G.scene.remove(e.bar0, e.bar1);
}

function losTo(e, tgt) {
  eCenter(e, _v); if (e.T.hy) _v.y = e.pos.y + e.T.hy;
  _d.copy(tgt).sub(_v); const dist = _d.length(); _d.divideScalar(dist || 1);
  const h = raycast(_v, _d, dist);
  return !h;
}

let flowT = 0;
export function updateEnemies(dt) {
  const p = G.player, E = G.enemies;
  flowT -= dt; if (flowT <= 0) { flowT = 0.25; updateFlow(p.pos.x, p.pos.z); }
  const tgt = _r.set(p.pos.x, p.pos.y + (p.slideT > 0 ? 0.5 : 1.0), p.pos.z);
  G.camera.getWorldDirection(_c); const rx = -_c.z, rz = _c.x, rl = Math.hypot(rx, rz) || 1; // 相机右方向
  for (let i = E.length - 1; i >= 0; i--) {
    const e = E[i];
    if (e.dead) { removeEnemy(e); E.splice(i, 1); continue; }
    const T = e.T;
    // 出场
    if (e.spawnT > 0) { e.spawnT -= dt; e.g.scale.setScalar(clamp(1 - e.spawnT / 0.35, 0.01, 1)); continue; }
    const base = e.type === 'boss' ? 1 : 1;
    if (e.flash > 0) { e.flash -= dt; e.g.scale.setScalar(base * (e.flash > 0 ? 1.13 : 1)); }
    // 血条
    if (e.bar0) {
      const show = e.hp < e.maxHp;
      e.bar0.visible = e.bar1.visible = show;
      if (show) {
        const y = e.pos.y + (T.fly ? 0.55 : T.hy + 0.45 || 1);
        e.bar0.position.set(e.pos.x - rx / rl * 0.45, y, e.pos.z - rz / rl * 0.45); e.bar1.position.copy(e.bar0.position);
        e.bar1.scale.x = 0.9 * clamp(e.hp / e.maxHp, 0, 1); e.bar1.material.color.set(e.frozenT > 0 ? 0x4cc9f0 : 0xff3355);
      }
    }
    // 击退
    if (e.knock.lengthSq() > 0.01) {
      e.pos.x += e.knock.x * dt; e.pos.z += e.knock.z * dt; e.knock.multiplyScalar(Math.max(0, 1 - 6 * dt));
    }
    // 踩到猫屎：攻击减半、减速，冒绿烟
    if (e.stinkT > 0) {
      e.stinkT -= dt;
      if (Math.random() < 0.2) burst(_c.set(e.pos.x, e.pos.y + (T.hy || e.cy) + 0.3, e.pos.z), { n: 1, color: [0x9dff3c, 0xc8ff7a], speed: [0.2, 0.8], life: [0.5, 1], size: [0.1, 0.2], grav: -1.5, jitter: 0.25, glow: 0.7 });
      if (e.stinkT <= 0) { e.dmgMul *= 2; e.spd /= 0.7; }
    }
    // 被猫挠晕
    if (e.stunT > 0) {
      e.stunT -= dt; e.g.rotation.z = e.stunT > 0 ? Math.sin(G.time * 45) * 0.1 : 0;
      if (Math.random() < 0.3) burst(_c.set(e.pos.x, e.pos.y + (T.hy || e.cy) + 0.4, e.pos.z), { n: 1, color: 0xffd60a, speed: [0.5, 1.5], life: [0.3, 0.5], size: [0.08, 0.14], grav: 0 });
      circleResolve(e.pos, Math.min(e.r, 0.9) * 0.75, e.pos.y + 0.2, e.pos.y + 1.2);
      continue;
    }
    // 冰冻
    if (e.frozenT > 0) {
      e.frozenT -= dt;
      if (e.frozenT <= 0 && e.ice) { e.ice.visible = false; burst(eCenter(e, _c), { n: 16, color: [0xffffff, 0x90e0ef], speed: [1, 4], life: [0.3, 0.6] }); }
      circleResolve(e.pos, Math.min(e.r, 0.9) * 0.75, e.pos.y + 0.2, e.pos.y + 1.2);
      continue;
    }
    if (e.chill > 0) e.chill = Math.max(0, e.chill - 0.25 * dt);
    const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, dist = Math.hypot(dx, dz), dy = p.pos.y - e.pos.y;
    e.losT -= dt; if (e.losT <= 0) { e.losT = 0.25; e.los = dist < 18 && losTo(e, tgt); }
    const slow = 1 - 0.6 * e.chill;
    let mvx = 0, mvz = 0, spd = e.spd * slow, face = Math.atan2(dx, dz);
    const fd = flowDir(e.pos.x, e.pos.z, _f);
    if (e.los && dist < 5) { mvx = dx / (dist || 1); mvz = dz / (dist || 1); } else { mvx = _f.x; mvz = _f.z; }

    if (e.type === 'roller') {
      e.wheel.rotation.x += spd * dt * 3;
      e.atkT -= dt;
      const reach = dist < 1.45 && Math.abs(dy) < 1.7;
      if (reach) { mvx = mvz = 0; if (e.atkT <= 0) { e.atkT = 0.9; e.lunge = 0.25; hurtPlayer(9 * e.dmgMul, e.pos, 4); } }
      if (e.lunge > 0) { e.lunge -= dt; }
      const sw = e.lunge > 0 ? -1.2 : Math.sin(G.time * 8 + e.phase) * 0.25;
      e.armL.rotation.x = sw; e.armR.rotation.x = e.lunge > 0 ? -1.2 : -sw;
    } else if (e.type === 'blaster') {
      e.atkT -= dt;
      if (e.los && dist < 15) {
        if (dist < 8) { // 保持距离并横移
          const s = Math.sin(G.time * 0.7 + e.phase) > 0 ? 1 : -1; mvx = -dz / dist * s * 0.6 - (dist < 5 ? dx / dist : 0); mvz = dx / dist * s * 0.6 - (dist < 5 ? dz / dist : 0); spd *= 0.6;
        }
        if (e.atkT < 0.5) { e.eye.emissiveIntensity = 2.5 + (0.5 - e.atkT) * 16; mvx *= 0.2; mvz *= 0.2; }
        if (e.atkT <= 0) {
          e.atkT = rand(1.7, 2.5) / Math.min(1.6, 1 + G.wave * 0.03); e.eye.emissiveIntensity = 2.5;
          _v.set(e.pos.x + Math.sin(face) * 0.6 + Math.cos(face) * 0.42, e.pos.y + 1.0, e.pos.z + Math.cos(face) * 0.6 - Math.sin(face) * 0.42);
          _d.copy(tgt).addScaledVector(p.vel, dist / 16 * 0.5).sub(_v).normalize();
          fireOrb(_v, _d, 13, 12 * e.dmgMul, T.acc); sfx.eshoot(e.pos);
        }
      } else if (e.atkT < 0.5) e.atkT = 0.5;
      const w = Math.sin(G.time * 9 + e.phase) * 0.5 * (Math.abs(mvx) + Math.abs(mvz) > 0.1 ? 1 : 0);
      e.legL.rotation.x = w; e.legR.rotation.x = -w;
    } else if (e.type === 'drone') {
      for (const r of e.rotors) r.rotation.y += dt * 40;
      e.pos.y = damp(e.pos.y, clamp(p.pos.y + 1.9, 1.6, 2.5) + Math.sin(G.time * 2 + e.phase) * 0.25, 3, dt);
      e.atkT -= dt;
      if (e.los && dist < 12) {
        const s = Math.sin(e.phase) > 0 ? 1 : -1, k = dist < 5 ? -1 : dist > 8 ? 0.6 : 0;
        mvx = -dz / dist * s + dx / dist * k; mvz = dx / dist * s + dz / dist * k;
        if (e.atkT <= 0) {
          e.atkT = rand(1.1, 1.7); eCenter(e, _v); _v.y -= 0.25;
          _d.copy(tgt).sub(_v).normalize(); fireOrb(_v, _d, 15, 6 * e.dmgMul, T.acc, 0.12); sfx.eshoot(e.pos);
        }
      }
      e.g.rotation.z = Math.sin(G.time * 3 + e.phase) * 0.12;
    } else if (e.type === 'bomber') {
      e.core.rotation.x += dt * spd * 2.2; e.core.rotation.z += dt * 1.3;
      if (e.fuse < 0 && dist < 1.9 && Math.abs(dy) < 2.6) { e.fuse = 0.5; }
      if (e.fuse >= 0) {
        e.fuse -= dt; mvx *= 0.3; mvz *= 0.3;
        e.eye.emissiveIntensity = (Math.sin(G.time * 50) > 0) ? 9 : 1; if (Math.random() < 0.3) sfx.beep(e.pos);
        if (e.fuse <= 0) { eCenter(e, _c); const c = _c.clone(); e.hp = 0; e.dead = true; explode(c, 3.2, [0xffea00, 0xff7b00, 0xd00000, 0xffffff]); damageArea(c, 3.2, 50, 8, { hurtPlayer: 26 * e.dmgMul, skip: e }); continue; }
      } else e.eye.emissiveIntensity = 2 + Math.sin(G.time * 10 + e.phase) * 1.5;
    } else if (e.type === 'boss') {
      for (const r of e.rotors) r.rotation.y += dt * 14;
      e.coreM.scale.setScalar(0.8 + Math.sin(G.time * 5) * 0.06);
      const rage = e.hp < e.maxHp * 0.5 ? 1.35 : 1;
      e.stT -= dt * rage; e.atkT -= dt;
      const touch = dist < e.r + 0.55 && dy < 1.5 && dy > -1;
      if (e.state === 'chase') {
        spd *= rage; e.eye.emissiveIntensity = 2.5;
        if (touch && e.atkT <= 0) { e.atkT = 0.8; hurtPlayer(16 * e.dmgMul, e.pos, 9); }
        if (e.stT <= 0) {
          const r = Math.random();
          if (r < 0.4) { e.state = 'spin'; e.stT = 2.6; e.shT = 0; }
          else if (r < 0.8 && e.los) { e.state = 'windup'; e.stT = 0.8; announce('⚠ CHARGE! Dodge!', 'warn', 0.9); }
          else { e.state = 'chase'; e.stT = 3.5; for (let k = 0; k < 3; k++) portalSpawn(pick(['roller', 'bomber']), 4, 14); sfx.portal(e.pos); }
        }
      } else if (e.state === 'spin') {
        mvx *= 0.3; mvz *= 0.3; e.spin = (e.spin || 0) + dt * 5; face = e.spin; e.shT -= dt;
        e.eye.emissiveIntensity = 6;
        if (e.shT <= 0) {
          e.shT = 0.11 / rage;
          for (let k = 0; k < 2; k++) { const a = e.spin * 1.3 + k * Math.PI; _d.set(Math.sin(a), 0.02, Math.cos(a)); _v.set(e.pos.x + _d.x * 1.3, 0.75, e.pos.z + _d.z * 1.3); fireOrb(_v, _d, 9, 10 * e.dmgMul, T.acc, 0.18); }
          if (Math.random() < 0.3) sfx.eshoot(e.pos);
        }
        if (e.stT <= 0) { e.state = 'chase'; e.stT = rand(3, 5); }
      } else if (e.state === 'windup') {
        mvx = mvz = 0; e.eye.emissiveIntensity = 3 + Math.sin(G.time * 40) * 3;
        e.cdx = dx / (dist || 1); e.cdz = dz / (dist || 1);
        if (Math.random() < 0.5) burst({ x: e.pos.x, y: 0.2, z: e.pos.z }, { n: 3, color: 0xff0054, speed: [2, 5], life: [0.2, 0.5], dir: { x: -e.cdx, y: 0.3, z: -e.cdz }, spread: 0.6 });
        if (e.stT <= 0) { e.state = 'charge'; e.stT = 1.3; sfx.dash(); }
      } else if (e.state === 'charge') {
        mvx = mvz = 0; face = Math.atan2(e.cdx, e.cdz);
        e.pos.x += e.cdx * 15 * dt; e.pos.z += e.cdz * 15 * dt;
        burst({ x: e.pos.x, y: 0.2, z: e.pos.z }, { n: 2, color: [0xff0054, 0xffd60a], speed: [1, 3], life: [0.2, 0.5], size: [0.15, 0.3] });
        if (touch && e.atkT <= 0) { e.atkT = 0.6; hurtPlayer(30 * e.dmgMul, e.pos, 14); }
        const hb = circleResolve(e.pos, 1.0, 0.2, 1.2);
        if (hb || e.stT <= 0) {
          if (hb) { shake(0.6, e.pos); sfx.slam(); ring({ x: e.pos.x, y: 0.1, z: e.pos.z }, 0xff0054, 4, 0.4); if (hb.tag === 'fort') damageFort(hb.ref, 999); }
          e.state = 'chase'; e.stT = rand(2.5, 4); e.frozenT = hb ? 0.01 : 0;
        }
      }
    }

    // 互相分离
    for (let j = 0; j < E.length; j++) {
      const o = E[j]; if (o === e || o.dead || !!o.T.fly !== !!T.fly) continue;
      const sx = e.pos.x - o.pos.x, sz = e.pos.z - o.pos.z, sd = sx * sx + sz * sz, mr = (e.r + o.r) * 0.8;
      if (sd < mr * mr && sd > 1e-6) { const l = Math.sqrt(sd), k = (mr - l) / l * 0.5; mvx += sx * k * 2; mvz += sz * k * 2; }
    }
    e.vel.x = damp(e.vel.x, mvx * spd, 8, dt); e.vel.z = damp(e.vel.z, mvz * spd, 8, dt);
    e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt;
    const cr = e.type === 'boss' ? 0.9 : e.r * 0.7;
    const hb = circleResolve(e.pos, cr, e.pos.y + (T.fly ? -0.3 : 0.2), e.pos.y + (T.fly ? 0.3 : 1.2));
    if (hb && hb.tag === 'fort' && hb.ref) damageFort(hb.ref, 30 * dt);
    e.pos.x = clamp(e.pos.x, 0.4, G.W - 0.4); e.pos.z = clamp(e.pos.z, 0.4, G.D - 0.4);
    e.g.rotation.y = e.state === 'spin' ? face : dampAngle(e.g.rotation.y, face, 8, dt);
    // 防卡死：长时间没前进就传送到玩家附近
    e.stuckT += dt;
    if (e.stuckT > 2.5) {
      const moved = Math.hypot(e.pos.x - e.lastX, e.pos.z - e.lastZ);
      e.stuckT = 0; e.lastX = e.pos.x; e.lastZ = e.pos.z;
      if (moved < 0.5 && dist > 4 && !e.los && e.state === 'chase') {
        e.warp = (e.warp || 0) + 1;
        if (e.warp >= 2) {
          e.warp = 0; const c = randomFarCell(6, 18); cellPos(c, _f);
          burst(eCenter(e, _c), { n: 20, color: 0xb14aff, speed: [1, 4], life: [0.3, 0.6] });
          e.pos.x = _f.x; e.pos.z = _f.z; e.spawnT = 0.35; ring({ x: _f.x, y: 0.08, z: _f.z }, 0xb14aff, 1.4, 0.5);
        }
      } else e.warp = 0;
    }
  }
}
function dampAngle(a, b, k, dt) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * (1 - Math.exp(-k * dt)); }

// ---------- 传送门出场与波次 ----------
function portalSpawn(type, minCells = 14, maxCells = 9999) {
  const c = randomFarCell(minCells, maxCells), q = { x: 0, z: 0 }; cellPos(c, q);
  const pp = new THREE.Vector3(q.x, 0.08, q.z);
  ring(pp, 0xb14aff, 1.3, 0.9, 0.1); sfx.portal(pp); W.pending++;
  for (let i = 0; i < 6; i++) after(i * 0.12, () => burst(pp, { n: 8, color: [0xb14aff, 0xff4dd8, 0x7b2cff], speed: [2, 5], life: [0.4, 0.8], dir: { x: 0, y: 1, z: 0 }, spread: 0.35, grav: -2, jitter: 0.4 }));
  after(0.75, () => {
    W.pending--; if (G.state !== 'play' || G.demo) return;
    spawnEnemy(type, q.x, q.z); flash(pp.clone().setY(1), 0xb14aff, 1.4, 0.25); light(pp.clone().setY(1.2), 0xb14aff, 30, 0.4);
  });
}

export const W = { phase: 'idle', t: 0, queue: [], pending: 0, spawnT: 0 };
export function startCountdown(first) {
  G.wave++; W.phase = 'count'; W.t = first ? 14 : 9; W.queue = [];
  const n = G.wave, bossWave = n % 5 === 0;
  let total = Math.min(4 + n * 2, 30); if (bossWave) total = Math.floor(total / 2);
  const pool = ['roller', 'roller', 'roller', 'roller'];
  if (n >= 2) pool.push('blaster', 'blaster', 'blaster');
  if (n >= 3) pool.push('bomber', 'bomber');
  if (n >= 4) pool.push('drone', 'drone', 'drone');
  for (let i = 0; i < total; i++) W.queue.push(pick(pool));
  if (bossWave) W.queue.unshift('boss');
  if (!first) resetProps(false);
}
export function updateWaves(dt) {
  if (W.phase === 'count') {
    W.t -= dt;
    if (W.t <= 0) {
      W.phase = 'fight'; W.spawnT = 0; updateFlow(G.player.pos.x, G.player.pos.z);
      const boss = G.wave % 5 === 0;
      announce(boss ? `WAVE ${G.wave} · BOSS INCOMING!` : `WAVE ${G.wave}`, boss ? 'boss' : 'wave', 2.2);
      boss ? sfx.boss() : sfx.wave();
    }
  } else if (W.phase === 'fight') {
    W.spawnT -= dt;
    const cap = Math.min(7 + Math.floor(G.wave / 2), 14);
    if (W.queue.length && W.spawnT <= 0 && G.enemies.length + W.pending < cap) {
      W.spawnT = 0.45; portalSpawn(W.queue.shift(), 14);
    }
    if (!W.queue.length && !W.pending && G.enemies.length === 0) {
      W.phase = 'clear'; W.t = 1.2;
      announce('WAVE CLEARED!', 'clear', 2); sfx.clear();
      G.slowT = 0.9;
    }
  } else if (W.phase === 'clear') {
    W.t -= dt;
    if (W.t <= 0) { supplyDrop(); const p = G.player; p.hp = Math.min(100, p.hp + 25); startCountdown(false); }
  }
}
export function resetEnemies() {
  for (const e of G.enemies) removeEnemy(e);
  G.enemies.length = 0; G.boss = null; G.wave = 0; W.phase = 'idle'; W.queue = []; W.pending = 0;
}
