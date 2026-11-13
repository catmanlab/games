// 碰撞：静态 AABB、射线、球体、角色盒；以及寻路流场
import { G, THREE, clamp } from './g.js';

export function addStatic(x0, y0, z0, x1, y1, z1, tag = 'solid') {
  const b = { min: new THREE.Vector3(Math.min(x0, x1), y0, Math.min(z0, z1)), max: new THREE.Vector3(Math.max(x0, x1), y1, Math.max(z0, z1)), tag, off: false };
  G.statics.push(b);
  return b;
}
export function removeStatic(b) { const i = G.statics.indexOf(b); if (i >= 0) G.statics.splice(i, 1); }

const _o = [0, 0, 0], _d = [0, 0, 0];
// 射线与静态盒相交。返回 {t, box, axis, sign}
export function raycast(o, d, max = 100, skipTag) {
  _o[0] = o.x; _o[1] = o.y; _o[2] = o.z; _d[0] = d.x; _d[1] = d.y; _d[2] = d.z;
  let best = max, hit = null, bax = 0, bsg = 0;
  const S = G.statics;
  for (let k = 0; k < S.length; k++) {
    const b = S[k];
    if (b.off || (skipTag && b.tag === skipTag)) continue;
    let tmin = 0, tmax = best, ax = -1, sg = 0, miss = false;
    for (let i = 0; i < 3; i++) {
      const mn = b.min.getComponent(i), mx = b.max.getComponent(i);
      if (Math.abs(_d[i]) < 1e-9) { if (_o[i] < mn || _o[i] > mx) { miss = true; break; } continue; }
      let t1 = (mn - _o[i]) / _d[i], t2 = (mx - _o[i]) / _d[i], s = -1;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; }
      if (t1 > tmin) { tmin = t1; ax = i; sg = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) { miss = true; break; }
    }
    if (!miss && ax >= 0 && tmin < best) { best = tmin; hit = b; bax = ax; bsg = sg; }
  }
  return hit ? { t: best, box: hit, axis: bax, sign: bsg } : null;
}

// 射线与球
export function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc);
  const t = -b - s;
  return t >= 0 ? t : (-b + s >= 0 ? 0 : -1);
}

// 球体与静态盒碰撞并反弹。返回最大撞击速度（0 表示无碰撞）
export function sphereResolve(p, r, vel, bounce = 0.4, fric = 0.85) {
  let impact = 0, hitBox = null;
  const S = G.statics;
  for (let k = 0; k < S.length; k++) {
    const b = S[k];
    if (b.off) continue;
    const cx = clamp(p.x, b.min.x, b.max.x), cy = clamp(p.y, b.min.y, b.max.y), cz = clamp(p.z, b.min.z, b.max.z);
    let dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= r * r) continue;
    let nx, ny, nz;
    if (d2 > 1e-10) {
      const d = Math.sqrt(d2); nx = dx / d; ny = dy / d; nz = dz / d;
      p.x = cx + nx * r; p.y = cy + ny * r; p.z = cz + nz * r;
    } else {
      // 球心在盒内：沿最浅轴推出
      const pen = [p.x - b.min.x, b.max.x - p.x, p.y - b.min.y, b.max.y - p.y, p.z - b.min.z, b.max.z - p.z];
      let m = 0; for (let i = 1; i < 6; i++) if (pen[i] < pen[m]) m = i;
      nx = m === 0 ? -1 : m === 1 ? 1 : 0; ny = m === 2 ? -1 : m === 3 ? 1 : 0; nz = m === 4 ? -1 : m === 5 ? 1 : 0;
      p.x += nx * (pen[m] + r); p.y += ny * (pen[m] + r); p.z += nz * (pen[m] + r);
    }
    const vn = vel.x * nx + vel.y * ny + vel.z * nz;
    if (vn < 0) {
      vel.x -= (1 + bounce) * vn * nx; vel.y -= (1 + bounce) * vn * ny; vel.z -= (1 + bounce) * vn * nz;
      // 切向摩擦
      const vn2 = vel.x * nx + vel.y * ny + vel.z * nz;
      vel.x = (vel.x - vn2 * nx) * fric + vn2 * nx; vel.y = (vel.y - vn2 * ny) * fric + vn2 * ny; vel.z = (vel.z - vn2 * nz) * fric + vn2 * nz;
      if (-vn > impact) { impact = -vn; hitBox = b; }
    }
    if (ny > 0.7) p.onFloor = true;
  }
  sphereResolve.box = hitBox;
  return impact;
}

// 点是否在某个静态盒内
export function pointSolid(p) {
  const S = G.statics;
  for (let k = 0; k < S.length; k++) {
    const b = S[k];
    if (!b.off && p.x > b.min.x && p.x < b.max.x && p.y > b.min.y && p.y < b.max.y && p.z > b.min.z && p.z < b.max.z) return b;
  }
  return null;
}

// 角色盒（脚底中心 pos，半宽 hw，高 h）逐轴移动
const EPS = 1e-4;
export function moveBox(pos, hw, h, vel, dt, out) {
  out.ground = false; out.wallX = 0; out.wallZ = 0; out.ceil = false;
  const S = G.statics;
  const overlap = (b) => pos.x + hw > b.min.x + EPS && pos.x - hw < b.max.x - EPS && pos.z + hw > b.min.z + EPS && pos.z - hw < b.max.z - EPS && pos.y + h > b.min.y + EPS && pos.y < b.max.y - EPS;
  // X
  pos.x += vel.x * dt;
  for (let k = 0; k < S.length; k++) {
    const b = S[k]; if (b.off || !overlap(b)) continue;
    const step = b.max.y - pos.y;
    if (step > 0 && step <= 0.4 && vel.y <= 0.1) { pos.y = b.max.y; continue; }
    if (vel.x > 0) { pos.x = b.min.x - hw; out.wallX = -1; } else if (vel.x < 0) { pos.x = b.max.x + hw; out.wallX = 1; }
    else { pos.x = (pos.x < (b.min.x + b.max.x) / 2) ? b.min.x - hw : b.max.x + hw; }
    vel.x = 0;
  }
  // Z
  pos.z += vel.z * dt;
  for (let k = 0; k < S.length; k++) {
    const b = S[k]; if (b.off || !overlap(b)) continue;
    const step = b.max.y - pos.y;
    if (step > 0 && step <= 0.4 && vel.y <= 0.1) { pos.y = b.max.y; continue; }
    if (vel.z > 0) { pos.z = b.min.z - hw; out.wallZ = -1; } else if (vel.z < 0) { pos.z = b.max.z + hw; out.wallZ = 1; }
    else { pos.z = (pos.z < (b.min.z + b.max.z) / 2) ? b.min.z - hw : b.max.z + hw; }
    vel.z = 0;
  }
  // Y
  pos.y += vel.y * dt;
  for (let k = 0; k < S.length; k++) {
    const b = S[k]; if (b.off || !overlap(b)) continue;
    if (vel.y <= 0) { pos.y = b.max.y; out.ground = true; out.groundBox = b; } else { pos.y = b.min.y - h; out.ceil = true; }
    vel.y = 0;
  }
  return out;
}

// 圆（xz 平面）与静态盒，用于机器人
export function circleResolve(pos, r, y0, y1) {
  const S = G.statics; let hit = null;
  for (let k = 0; k < S.length; k++) {
    const b = S[k];
    if (b.off || b.max.y <= y0 || b.min.y >= y1) continue;
    const cx = clamp(pos.x, b.min.x, b.max.x), cz = clamp(pos.z, b.min.z, b.max.z);
    const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-10) { const d = Math.sqrt(d2); pos.x = cx + dx / d * r; pos.z = cz + dz / d * r; }
    else {
      const px = Math.min(pos.x - b.min.x, b.max.x - pos.x), pz = Math.min(pos.z - b.min.z, b.max.z - pos.z);
      if (px < pz) pos.x = (pos.x - b.min.x < b.max.x - pos.x) ? b.min.x - r : b.max.x + r;
      else pos.z = (pos.z - b.min.z < b.max.z - pos.z) ? b.min.z - r : b.max.z + r;
    }
    hit = b;
  }
  return hit;
}

// ---------- 寻路流场 ----------
export const NAV = { cs: 0.5, w: 0, h: 0, blocked: null, dist: null, free: [] };
export function buildNav() {
  const cs = NAV.cs; NAV.w = Math.ceil(G.W / cs); NAV.h = Math.ceil(G.D / cs);
  NAV.blocked = new Uint8Array(NAV.w * NAV.h); NAV.dist = new Int16Array(NAV.w * NAV.h); NAV.free = [];
  const pad = 0.28;
  for (let j = 0; j < NAV.h; j++) for (let i = 0; i < NAV.w; i++) {
    const x0 = i * cs - pad, x1 = (i + 1) * cs + pad, z0 = j * cs - pad, z1 = (j + 1) * cs + pad;
    let blk = 0;
    for (const b of G.statics) {
      if (b.tag === 'floor' || b.tag === 'ceil' || b.min.y > 1.3 || b.max.y < 0.2) continue;
      if (b.max.x > x0 && b.min.x < x1 && b.max.z > z0 && b.min.z < z1) { blk = 1; break; }
    }
    NAV.blocked[j * NAV.w + i] = blk;
    if (!blk) NAV.free.push(j * NAV.w + i);
  }
}
const queue = new Int32Array(8192);
export function cellOf(x, z) {
  return clamp(Math.floor(z / NAV.cs), 0, NAV.h - 1) * NAV.w + clamp(Math.floor(x / NAV.cs), 0, NAV.w - 1);
}
export function cellPos(c, out) { out.x = (c % NAV.w + 0.5) * NAV.cs; out.z = (Math.floor(c / NAV.w) + 0.5) * NAV.cs; return out; }
function nearestFree(c) {
  if (!NAV.blocked[c]) return c;
  const ci = c % NAV.w, cj = Math.floor(c / NAV.w);
  for (let r = 1; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    const i = ci + di, j = cj + dj;
    if (i < 0 || j < 0 || i >= NAV.w || j >= NAV.h) continue;
    if (!NAV.blocked[j * NAV.w + i]) return j * NAV.w + i;
  }
  return c;
}
export function updateFlow(x, z) {
  const { w, h, blocked, dist } = NAV;
  dist.fill(32000);
  const s = nearestFree(cellOf(x, z));
  let qh = 0, qt = 0; queue[qt++] = s; dist[s] = 0;
  while (qh < qt) {
    const c = queue[qh++], d = dist[c] + 1, i = c % w, j = (c / w) | 0;
    if (i > 0 && !blocked[c - 1] && dist[c - 1] > d) { dist[c - 1] = d; queue[qt++] = c - 1; }
    if (i < w - 1 && !blocked[c + 1] && dist[c + 1] > d) { dist[c + 1] = d; queue[qt++] = c + 1; }
    if (j > 0 && !blocked[c - w] && dist[c - w] > d) { dist[c - w] = d; queue[qt++] = c - w; }
    if (j < h - 1 && !blocked[c + w] && dist[c + w] > d) { dist[c + w] = d; queue[qt++] = c + w; }
  }
}
// 返回从 (x,z) 朝目标的移动方向（写入 out.x/out.z），以及格距
export function flowDir(x, z, out) {
  const { w, h, blocked, dist } = NAV;
  let c = cellOf(x, z);
  if (blocked[c]) c = nearestFree(c);
  const i = c % w, j = (c / w) | 0;
  let best = dist[c], bi = 0, bj = 0;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    if (!di && !dj) continue;
    const ni = i + di, nj = j + dj;
    if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
    const n = nj * w + ni;
    if (blocked[n]) continue;
    if (di && dj && (blocked[j * w + ni] || blocked[nj * w + i])) continue;
    const dd = dist[n] + (di && dj ? 0.4 : 0);
    if (dd < best) { best = dd; bi = di; bj = dj; }
  }
  // 朝目标格中心走，避免贴边
  const tx = (i + bi + 0.5) * NAV.cs - x, tz = (j + bj + 0.5) * NAV.cs - z;
  const l = Math.hypot(tx, tz) || 1;
  out.x = tx / l; out.z = tz / l;
  return dist[c];
}
export function randomFarCell(minDist, maxDist = 9999) {
  for (let k = 0; k < 60; k++) {
    const c = NAV.free[(Math.random() * NAV.free.length) | 0];
    if (NAV.dist[c] >= minDist && NAV.dist[c] <= maxDist) return c;
  }
  return NAV.free[(Math.random() * NAV.free.length) | 0];
}
