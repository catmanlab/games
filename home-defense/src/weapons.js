// 武器、弹道、手雷、掉落物
import { G, THREE, rand, pick, clamp, lerp, after, bx, cyl, sph, cone, mat, glow, GEO } from './g.js';
import { raycast, raySphere, pointSolid, sphereResolve, randomFarCell, cellPos } from './phys.js';
import { burst, tracer, ring, flash, light, shake, explode, fireworks } from './fx.js';
import { sfx } from './audio.js';
import { damageEnemy, damageArea, eCenter } from './enemies.js';
import { impulseProps, breakProp, wake } from './props.js';
import { hurtPlayer } from './player.js';
import { announce } from './ui.js';
import { damageFort } from './world.js';

export const RAR = [
  { name: 'Common', col: 0x9aa0a6, css: '#b8bec6', mul: 1 }, { name: 'Uncommon', col: 0x3ddc61, css: '#3ddc61', mul: 1.15 },
  { name: 'Rare', col: 0x3aa0ff, css: '#3aa0ff', mul: 1.3 }, { name: 'Epic', col: 0xb14aff, css: '#c77dff', mul: 1.5 },
  { name: 'Legendary', col: 0xffb300, css: '#ffb300', mul: 1.8 },
];
export const WP = [
  // rate = shots per second. Burst rifle: `burst` shots, `gap` seconds between them, then `rest` seconds before the next burst.
  { id: 'ar', name: 'Assault Rifle', dmg: 36, rate: 5.5, mag: 30, reload: 1.8, spread: 0.012, col: 0xffc857, len: 0.62 },
  { id: 'burst', name: 'Burst Assault Rifle', dmg: 37, burst: 2, gap: 0.10, rest: 0.44, mag: 24, reload: 1.8, spread: 0.007, col: 0x7ad7ff, len: 0.66 },
];

export function gunMesh(wi, rar) {
  const g = new THREE.Group(), W = WP[wi], rc = RAR[rar].col, dark = { m: 0.6, r: 0.4 }, body = wi === 0 ? 0x3a3f36 : 0x2b2f3a;
  bx(g, 0.07, 0.12, 0.46, body, 0, 0, 0.14, dark);                                   // receiver
  cyl(g, 0.022, 0.3, 0x555b63, 0, 0.02, 0.5, dark).rotation.x = Math.PI / 2;         // barrel
  bx(g, 0.06, 0.1, 0.2, 0x1f1f1f, 0, -0.01, -0.18, dark);                            // stock
  const mag = bx(g, 0.05, 0.2, 0.08, 0x1f1f1f, 0, -0.15, 0.16, dark); mag.rotation.x = 0.2;
  bx(g, 0.03, 0.05, 0.14, 0x1f1f1f, 0, 0.09, 0.1, dark);                             // sight
  bx(g, 0.075, 0.03, 0.16, W.col, 0, 0.03, 0.32, glow(W.col, 1.4));                  // handguard light
  if (wi === 1) { cyl(g, 0.034, 0.1, 0x8d99ae, 0, 0.02, 0.62, dark).rotation.x = Math.PI / 2; bx(g, 0.03, 0.03, 0.03, W.col, 0, 0.12, 0.1, glow(W.col, 2.5)); }
  bx(g, 0.05, 0.14, 0.07, 0x222222, 0, -0.11, 0.0);
  bx(g, 0.012, 0.05, 0.22, rc, 0.04, 0.0, 0.1, glow(rc, 2.2)); bx(g, 0.012, 0.05, 0.22, rc, -0.04, 0.0, 0.1, glow(rc, 2.2)); // rarity strips
  return g;
}

// ---------- 瞄准与射线命中 ----------
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Vector3(), _n = new THREE.Vector3();
export const AIM = { o: new THREE.Vector3(), d: new THREE.Vector3(), point: new THREE.Vector3() };
export function updateAim() {
  const p = G.player;
  G.camera.getWorldPosition(AIM.o); G.camera.getWorldDirection(AIM.d);
  AIM.o.addScaledVector(AIM.d, p.fp ? 0.1 : p.camDist + 0.25);
  const h = hitscan(AIM.o, AIM.d, 80);
  AIM.point.copy(AIM.o).addScaledVector(AIM.d, h.t); AIM.enemy = h.enemy;
}
export function hitscan(o, d, max) {
  const res = { t: max, enemy: null, crit: false, box: null, axis: 0, sign: 0 };
  const h = raycast(o, d, max);
  if (h) { res.t = h.t; res.box = h.box; res.axis = h.axis; res.sign = h.sign; }
  for (const e of G.enemies) {
    if (e.dead || e.spawnT > 0) continue;
    eCenter(e, _c);
    let t = raySphere(o, d, _c, e.r), crit = false;
    if (e.T.hr) { _c.y = e.pos.y + e.T.hy; const t2 = raySphere(o, d, _c, e.T.hr); if (t2 >= 0 && (t < 0 || t2 <= t + 0.05)) { t = t2; crit = true; } }
    if (t >= 0 && t < res.t) { res.t = t; res.enemy = e; res.crit = crit; res.box = null; }
  }
  return res;
}
function spreadDir(d, s, out) {
  out.set(d.x + rand(-s, s), d.y + rand(-s, s), d.z + rand(-s, s)).normalize(); return out;
}
function impactFx(p, col, h) {
  burst(p, { n: 6, color: [col, 0xffffff], speed: [1, 4], life: [0.12, 0.3], size: [0.05, 0.1] });
}

// ---------- 开火 ----------
export function tryReload(p) {
  const w = p.weapons[p.cur]; if (!w || p.reloadT > 0 || w.ammo >= WP[p.cur].mag) return;
  p.reloadT = WP[p.cur].reload; p.charge = 0; sfx.reload();
}
function shoot(p, w, W) {
  const mul = RAR[w.rar].mul, col = W.col, mz = p.muzzle;
  w.ammo--;
  spreadDir(AIM.d, W.spread * (p.ads ? 0.5 : 1) * (p.onGround ? 1 : 1.3), _d);
  const h = hitscan(AIM.o, _d, 70);
  _p.copy(AIM.o).addScaledVector(_d, h.t);
  tracer(mz, _p, col, 0.035, 0.09);
  if (h.enemy) { damageEnemy(h.enemy, W.dmg * mul, { dir: _d, knock: 1.6, point: _p.clone(), crit: h.crit }); impactFx(_p, h.crit ? 0xffe14d : col); }
  else if (h.box) impactFx(_p, col);
  flash(mz, col, 0.22, 0.05); light(mz, col, 12, 0.06);
  p.recoil += 0.014; shake(0.05); sfx.rifle();
}
export function updateWeapon(dt, fire, firePressed) {
  const p = G.player, w = p.weapons[p.cur], W = WP[p.cur];
  p.fireT -= dt;
  if (!w) return;
  if (p.reloadT > 0) { p.reloadT -= dt; p.burstLeft = 0; if (p.reloadT <= 0) { w.ammo = W.mag; sfx.swap(); } return; }
  if (w.ammo <= 0) { p.burstLeft = 0; if (firePressed) sfx.empty(); tryReload(p); return; }
  if (W.burst) {
    // 点射：扣一次扳机打完整组，组内间隔 gap，打完后等 rest 才能打下一组
    if (p.burstLeft > 0) {
      p.burstT -= dt;
      if (p.burstT <= 0) { shoot(p, w, W); p.burstLeft--; if (p.burstLeft > 0) p.burstT += W.gap; else p.fireT = W.rest + p.burstT; }
    } else if (fire && p.fireT <= 0) {
      const carry = Math.max(p.fireT, -dt); shoot(p, w, W); p.burstLeft = W.burst - 1; p.burstT = W.gap + carry; if (p.burstLeft <= 0) p.fireT = W.rest + carry;
    }
  } else if (fire && p.fireT <= 0) { p.fireT = Math.max(p.fireT, -dt) + 1 / W.rate; shoot(p, w, W); } // 保留余量，射速不受帧率影响
  if (w.ammo <= 0) tryReload(p);
}

// ---------- 飞行物 ----------
const orbGeo = new THREE.SphereGeometry(1, 12, 8);
function spawnShot(kind, pos, dir, speed, dmg, col, r, team) {
  const m = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2.4) }));
  m.scale.setScalar(r); m.position.copy(pos); G.scene.add(m);
  const s = { kind, m, pos: m.position, vel: new THREE.Vector3().copy(dir).multiplyScalar(speed), dmg, col, r, team, life: kind === 'nade' ? 9 : 5, t: 0 };
  G.shots.push(s); return s;
}
export function fireOrb(pos, dir, speed, dmg, col, r = 0.16) { return spawnShot('orb', pos, dir, speed, dmg, col, r, 'e'); }
export function throwNade(p) {
  if (p.nades <= 0) { sfx.empty(); return; }
  p.nades--; sfx.throw(0.5);
  _d.copy(AIM.d); _d.y += 0.22; _d.normalize();
  const s = spawnShot('nade', p.muzzle, _d, 17, 150, 0xb14aff, 0.14, 'p'); s.vel.addScaledVector(p.vel, 0.5);
}

function rocketBoom(s) {
  const c = s.pos.clone(); c.y = Math.max(0.3, c.y);
  explode(c, 4.2, [0xffffff, 0xffd60a, 0xff7b00, 0xff4d6d]); fireworks(c, 5);
  damageArea(c, 4.4, s.dmg, 10); impulseProps(c, 5, 10, true);
  const p = G.player; _q.set(p.pos.x, p.pos.y + 0.9, p.pos.z);
  const d = _q.distanceTo(c);
  if (d < 4.2) { _q.sub(c).normalize(); _q.y = Math.max(_q.y, 0.45); p.vel.addScaledVector(_q.normalize(), 13 * (1 - d / 6)); p.onGround = false; }
}
function blackHole(s) {
  const c = s.pos.clone(); c.y = Math.max(1.0, c.y); s.dead = true; G.scene.remove(s.m);
  sfx.blackhole();
  const hole = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: 0x050008 })); hole.position.copy(c); hole.scale.setScalar(0.1); G.scene.add(hole); (G.temp = G.temp || []).push(hole);
  const st = { t: 0 };
  G.anim.push((dt) => {
    st.t += dt; const k = st.t / 1.9;
    hole.scale.setScalar(0.25 + Math.min(1, k * 2) * 0.55 + Math.sin(st.t * 30) * 0.03);
    for (let i = 0; i < 5; i++) { _n.set(rand(-1, 1), rand(-0.6, 0.6), rand(-1, 1)).normalize(); _q.copy(c).addScaledVector(_n, rand(2.5, 4.5)); _n.multiplyScalar(-1); burst(_q, { n: 1, color: [0xb14aff, 0xff4dd8, 0x4cc9f0, 0xffffff], speed: [7, 11], life: [0.25, 0.4], size: [0.08, 0.18], dir: _n, spread: 0.1, grav: 0, drag: 0 }); }
    for (const e of G.enemies) {
      if (e.dead || e.spawnT > 0) continue; eCenter(e, _q); const d = _q.distanceTo(c);
      if (d < 7.5 && d > 0.3) { const f = (e.type === 'boss' ? 2 : 22) * dt * (1 - d / 9); e.pos.x += (c.x - e.pos.x) / d * f * 2.2; e.pos.z += (c.z - e.pos.z) / d * f * 2.2; e.vel.multiplyScalar(0.8); }
    }
    for (const pr of G.props) { if (pr.dead || pr.held) continue; const d = pr.pos.distanceTo(c); if (d < 7 && d > 0.4) { wake(pr); pr.vel.addScaledVector(_q.copy(c).sub(pr.pos).normalize(), 60 * dt); pr.vel.multiplyScalar(0.96); } }
    if (st.t >= 1.9) {
      G.scene.remove(hole);
      explode(c, 5.5, [0xffffff, 0xb14aff, 0xff4dd8, 0x4cc9f0]); ring(c, 0xb14aff, 8, 0.6); ring(c, 0xffffff, 5, 0.4);
      damageArea(c, 5.5, s.dmg, 14); impulseProps(c, 7, 14, true); shake(0.6);
      return false;
    }
    return true;
  });
}

export function updateShots(dt) {
  const p = G.player, S = G.shots;
  for (let i = S.length - 1; i >= 0; i--) {
    const s = S[i]; let dead = s.dead;
    if (!dead) {
      s.life -= dt; s.t += dt;
      if (s.kind === 'nade') {
        s.vel.y -= 20 * dt; s.pos.addScaledVector(s.vel, dt);
        const im = sphereResolve(s.pos, s.r, s.vel, 0.3, 0.6);
        burst(s.pos, { n: 1, color: 0xb14aff, speed: [0, 0.5], life: [0.2, 0.4], size: [0.08, 0.14], grav: 0 });
        let near = false; for (const e of G.enemies) if (!e.dead && eCenter(e, _c).distanceTo(s.pos) < e.r + 0.3) near = true;
        if (im > 2 || near || s.t > 1.5) { blackHole(s); dead = true; }
      } else {
        const steps = Math.max(1, Math.ceil(s.vel.length() * dt / 0.3));
        for (let k = 0; k < steps && !dead; k++) {
          s.pos.addScaledVector(s.vel, dt / steps);
          const b = pointSolid(s.pos);
          if (b) {
            if (s.kind === 'rocket') rocketBoom(s);
            else { burst(s.pos, { n: 8, color: s.col, speed: [1, 4], life: [0.15, 0.35] }); if (b.tag === 'fort' && s.team === 'e') damageFort(b.ref, s.dmg * 1.6); }
            dead = true; break;
          }
          if (s.team === 'e') {
            // 被手里的东西挡住/弹回
            const h = p.held;
            if (h && s.pos.distanceTo(h.pos) < (p.blocking ? 0.95 : 0.6) + s.r) {
              if (h.T.reflect || p.blocking) {
                s.team = 'p'; s.vel.copy(AIM.d).multiplyScalar(s.vel.length() * (h.T.reflect ? 2.2 : 1.5)); s.dmg *= h.T.reflect ? 5 : 3; s.col = 0x80ffdb;
                s.m.material.color.set(0x80ffdb).multiplyScalar(2.5); s.life = 3;
                h.T.reflect ? sfx.clang() : sfx.block(); flash(s.pos, 0x80ffdb, 0.6, 0.12); ring(s.pos, 0x80ffdb, 1, 0.2); p.blocks++;
              } else { sfx.block(); burst(s.pos, { n: 10, color: s.col, speed: [1, 4], life: [0.15, 0.35] }); dead = true; }
              if (h.T.fragile && !dead) { /* 反弹成功，易碎品也保住 */ } else if (h.T.fragile) breakProp(h);
              continue;
            }
            const py = clamp(s.pos.y, p.pos.y + 0.25, p.pos.y + p.height - 0.2);
            if (Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z, s.pos.y - py) < 0.4 + s.r) {
              if (hurtPlayer(s.dmg, s.pos, 2)) burst(s.pos, { n: 10, color: s.col, speed: [1, 4], life: [0.15, 0.35] });
              dead = true;
            }
          } else {
            for (const e of G.enemies) {
              if (e.dead || e.spawnT > 0) continue;
              if (eCenter(e, _c).distanceTo(s.pos) < e.r + s.r) {
                if (s.kind === 'rocket') rocketBoom(s);
                else { _d.copy(s.vel).normalize(); damageEnemy(e, s.dmg, { dir: _d, knock: 6, point: s.pos.clone() }); burst(s.pos, { n: 14, color: [s.col, 0xffffff], speed: [2, 6], life: [0.2, 0.5] }); }
                dead = true; break;
              }
            }
          }
        }
        if (!dead) {
          if (s.kind === 'rocket') burst(s.pos, { n: 4, color: [0xffd60a, 0xff7b00, 0xff4d6d, 0xffffff], speed: [0.3, 2], life: [0.25, 0.6], size: [0.1, 0.2], grav: 1 });
          else if (Math.random() < 0.6) burst(s.pos, { n: 1, color: s.col, speed: [0, 0.4], life: [0.15, 0.3], size: [0.1, 0.16], grav: 0 });
        }
      }
      if (s.life <= 0 && !dead) { if (s.kind === 'rocket') rocketBoom(s); dead = true; }
    }
    if (dead) { G.scene.remove(s.m); S.splice(i, 1); }
  }
}

// ---------- 掉落物 ----------
function rollRarity(bias = 0) {
  const w = [50, 30, 14, 5, 1].map((v, i) => v * (1 + (G.wave * 0.16 + bias) * i));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 5; i++) { r -= w[i]; if (r <= 0) return i; } // 5 = 稀有度档数
  return 0;
}
function rollWeapon(bias) {
  const p = G.player, missing = WP.map((_, i) => i).filter((i) => !p.weapons[i]);
  const wi = missing.length && Math.random() < 0.75 ? pick(missing) : (Math.random() * WP.length) | 0;
  return { wi, rar: Math.max(rollRarity(bias), p.weapons[wi] && Math.random() < 0.6 ? Math.min(4, p.weapons[wi].rar + 1) : 0) };
}
export function spawnPickup(kind, pos, data = {}, pop = true) {
  const g = new THREE.Group(); let col = 0xffffff;
  if (kind === 'weapon') { col = RAR[data.rar].col; const m = gunMesh(data.wi, data.rar); m.scale.setScalar(1.5); m.rotation.y = Math.PI / 2; g.add(m); }
  else if (kind === 'shield') { col = 0x4cc9f0; cyl(g, 0.11, 0.3, 0x4cc9f0, 0, 0, 0, glow(0x4cc9f0, 1.8)); cyl(g, 0.06, 0.06, 0xffffff, 0, 0.18, 0); }
  else if (kind === 'health') { col = 0x52ff8f; bx(g, 0.3, 0.1, 0.1, 0x52ff8f, 0, 0, 0, glow(0x52ff8f, 1.8)); bx(g, 0.1, 0.3, 0.1, 0x52ff8f, 0, 0, 0, glow(0x52ff8f, 1.8)); }
  else if (kind === 'nade') { col = 0xb14aff; sph(g, 0.13, 0x14001f); const t = new THREE.Mesh(GEO.torus, mat(0xb14aff, glow(0xb14aff, 2.5))); t.scale.setScalar(0.36); g.add(t); }
  else { col = 0xff7aa2; bx(g, 0.26, 0.12, 0.26, 0xff7aa2, 0, 0, 0, glow(0xff7aa2, 0.8)); }
  const beam = new THREE.Mesh(GEO.cyl, new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.6), transparent: true, opacity: kind === 'weapon' ? 0.22 : 0.1, blending: THREE.AdditiveBlending, depthWrite: false }));
  beam.scale.set(kind === 'weapon' ? 0.3 : 0.16, kind === 'weapon' ? 3.2 : 1.2, kind === 'weapon' ? 0.3 : 0.16);
  G.scene.add(g, beam); g.position.copy(pos);
  const k = { kind, data, g, beam, pos: g.position, vy: pop ? rand(4, 6) : 0, vx: pop ? rand(-2, 2) : 0, vz: pop ? rand(-2, 2) : 0, col, t: 0 };
  G.pickups.push(k); return k;
}
export function dropLoot(c, type) {
  const r = Math.random();
  if (type === 'boss') {
    const w = rollWeapon(3); w.rar = Math.max(3, w.rar); spawnPickup('weapon', c, w);
    spawnPickup('shield', c); spawnPickup('shield', c); spawnPickup('health', c); spawnPickup('nade', c); spawnPickup('nade', c);
  } else if (r < 0.15) spawnPickup('shield', c); else if (r < 0.23) spawnPickup('health', c); else if (r < 0.28) spawnPickup('nade', c);
  else if (r < 0.3 + Math.min(0.04, G.wave * 0.005)) spawnPickup('weapon', c, rollWeapon(0));
}
export function chestLoot(ch) {
  const c = new THREE.Vector3(ch.x, 0.9, ch.z);
  spawnPickup('weapon', c, rollWeapon(0.8)); spawnPickup(Math.random() < 0.5 ? 'nade' : 'shield', c); spawnPickup('mats', c);
  burst(c, { n: 40, color: [0xffd60a, 0xffffff, 0xffa200], speed: [2, 7], life: [0.4, 1], dir: { x: 0, y: 1, z: 0 }, spread: 0.5 });
  light(c, 0xffd60a, 40, 0.5);
}
export function supplyDrop() {
  const c = randomFarCell(3, 12), q = { x: 0, z: 0 }; cellPos(c, q);
  const pos = new THREE.Vector3(q.x, G.H - 0.5, q.z);
  spawnPickup('weapon', pos, rollWeapon(1.2), false); spawnPickup('shield', pos.clone().add({ x: 0.5, y: 0, z: 0.3 }), {}, false);
  if (Math.random() < 0.5) spawnPickup('nade', pos.clone().add({ x: -0.4, y: 0, z: -0.4 }), {}, false);
  ring(new THREE.Vector3(q.x, 0.08, q.z), 0x4cc9f0, 2.2, 1.0); announce('📦 Supply drop landed!', 'info', 1.8);
}

export function updatePickups(dt) {
  const p = G.player, K = G.pickups;
  for (let i = K.length - 1; i >= 0; i--) {
    const k = K[i]; k.t += dt;
    k.vy -= 14 * dt; k.pos.y += k.vy * dt; k.pos.x = clamp(k.pos.x + k.vx * dt, 0.5, G.W - 0.5); k.pos.z = clamp(k.pos.z + k.vz * dt, 0.5, G.D - 0.5);
    if (k.pos.y < 0.55) { k.pos.y = 0.55; k.vy = 0; k.vx = k.vz = 0; }
    k.g.rotation.y += dt * 2; k.g.position.y += Math.sin(k.t * 3) * 0.002;
    k.beam.position.set(k.pos.x, k.pos.y + k.beam.scale.y / 2 - 0.3, k.pos.z);
    if (k.t < 0.4) continue;
    const d = Math.hypot(k.pos.x - p.pos.x, k.pos.z - p.pos.z), dy = Math.abs(k.pos.y - (p.pos.y + 0.8));
    if (d < 5 && d > 0.2 && dy < 2.5 && k.kind !== 'weapon') { k.pos.x += (p.pos.x - k.pos.x) / d * dt * 7; k.pos.z += (p.pos.z - k.pos.z) / d * dt * 7; } // 磁吸
    if (d > 1.2 || dy > 2) continue;
    let take = true;
    if (k.kind === 'weapon') {
      const { wi, rar } = k.data, cur = p.weapons[wi];
      if (!cur || cur.rar < rar) {
        const had = !!cur; p.weapons[wi] = { rar, ammo: WP[wi].mag }; p.gunDirty = true;
        if (!had || p.cur === wi) { p.cur = wi; p.reloadT = 0; p.charge = 0; }
        announce(`${RAR[rar].name} · ${WP[wi].name}`, 'loot', 2, RAR[rar].css); rar >= 3 ? sfx.rare() : sfx.pickup();
        if (rar >= 3) { fireworks(k.pos, 2); }
      } else { p.mats += 10; sfx.pickup(); }
    } else if (k.kind === 'shield') { if (p.shield >= 100) take = false; else { p.shield = Math.min(100, p.shield + 35); sfx.pickup(); } }
    else if (k.kind === 'health') { if (p.hp >= 100) take = false; else { p.hp = Math.min(100, p.hp + 30); sfx.pickup(); } }
    else if (k.kind === 'nade') { p.nades = Math.min(6, p.nades + 1); sfx.pickup(); }
    else { p.mats += 20; sfx.pickup(); }
    if (take) {
      burst(k.pos, { n: 16, color: [k.col, 0xffffff], speed: [1, 5], life: [0.2, 0.6] });
      G.scene.remove(k.g, k.beam); K.splice(i, 1);
    }
  }
}
export function resetShots() {
  for (const s of G.shots) G.scene.remove(s.m); G.shots.length = 0;
  for (const k of G.pickups) G.scene.remove(k.g, k.beam); G.pickups.length = 0;
}
