// 特效：粒子、弹道、冲击环、闪光、动态光
import { G, THREE, rand, after } from './g.js';
import { sfx } from './audio.js';

const N = 6000;
let pos, col, size, geo, pts, cursor = 0;
const vx = new Float32Array(N), vy = new Float32Array(N), vz = new Float32Array(N);
const life = new Float32Array(N), maxLife = new Float32Array(N), grav = new Float32Array(N), drag = new Float32Array(N);
const s0 = new Float32Array(N), cr = new Float32Array(N), cg = new Float32Array(N), cb = new Float32Array(N);
const tracers = [], rings = [], flashes = [], lights = [];
const _c = new THREE.Color(), _v = new THREE.Vector3();

export function initFX() {
  pos = new Float32Array(N * 3); col = new Float32Array(N * 4); size = new Float32Array(N);
  geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color4', new THREE.BufferAttribute(col, 4));
  geo.setAttribute('psize', new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 } },
    vertexShader: `attribute vec4 color4; attribute float psize; uniform float uScale; varying vec4 vc;
      void main(){ vc=color4; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=psize*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec4 vc; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.08,d); gl_FragColor=vec4(vc.rgb,vc.a*a); }`,
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });
  pts = new THREE.Points(geo, m); pts.frustumCulled = false; pts.renderOrder = 10;
  G.scene.add(pts); G.fxMat = m;

  const tg = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 48; i++) {
    const t = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    t.visible = false; t.frustumCulled = false; G.scene.add(t); tracers.push({ m: t, life: 0, max: 1 });
  }
  const rg = new THREE.RingGeometry(0.82, 1, 48); rg.rotateX(-Math.PI / 2);
  for (let i = 0; i < 20; i++) {
    const r = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    r.visible = false; G.scene.add(r); rings.push({ m: r, life: 0, max: 1, r0: 0, r1: 1 });
  }
  const sg = new THREE.SphereGeometry(1, 16, 12);
  for (let i = 0; i < 14; i++) {
    const f = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    f.visible = false; G.scene.add(f); flashes.push({ m: f, life: 0, max: 1, r: 1 });
  }
  for (let i = 0; i < 4; i++) {
    const l = new THREE.PointLight(0xffffff, 0, 14, 1.6); G.scene.add(l); lights.push({ l, life: 0, max: 1, i0: 0 });
  }
}

// o: n,color,speed:[a,b],life:[a,b],size:[a,b],grav,drag,dir,spread,glow,jitter
export function burst(p, o) {
  const n = o.n || 10, colors = Array.isArray(o.color) ? o.color : [o.color ?? 0xffffff];
  const sp = o.speed || [1, 4], lf = o.life || [0.3, 0.7], sz = o.size || [0.08, 0.16], gl = o.glow ?? 1.6, jit = o.jitter || 0;
  for (let k = 0; k < n; k++) {
    const i = cursor; cursor = (cursor + 1) % N;
    let dx = rand(-1, 1), dy = rand(-1, 1), dz = rand(-1, 1);
    let l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    if (o.dir) {
      const s = o.spread ?? 0.3;
      dx = o.dir.x + dx * s; dy = o.dir.y + dy * s; dz = o.dir.z + dz * s;
      l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    }
    const v = rand(sp[0], sp[1]);
    vx[i] = dx * v; vy[i] = dy * v; vz[i] = dz * v;
    pos[i * 3] = p.x + rand(-jit, jit); pos[i * 3 + 1] = p.y + rand(-jit, jit); pos[i * 3 + 2] = p.z + rand(-jit, jit);
    life[i] = maxLife[i] = rand(lf[0], lf[1]); grav[i] = o.grav ?? 6; drag[i] = o.drag ?? 1.5;
    s0[i] = rand(sz[0], sz[1]);
    _c.set(colors[(Math.random() * colors.length) | 0]);
    cr[i] = _c.r * gl; cg[i] = _c.g * gl; cb[i] = _c.b * gl;
  }
}

export function tracer(a, b, color = 0xffffaa, width = 0.035, lifeT = 0.09) {
  let t = tracers[0]; for (const x of tracers) { if (x.life <= 0) { t = x; break; } if (x.life < t.life) t = x; }
  const len = a.distanceTo(b); if (len < 0.01) return;
  t.m.position.copy(a).add(b).multiplyScalar(0.5); t.m.lookAt(b); t.m.scale.set(width, width, len);
  t.m.material.color.set(color).multiplyScalar(2.2); t.m.material.opacity = 1; t.m.visible = true; t.life = t.max = lifeT; t.w = width;
}
export function ring(p, color, r1 = 3, lifeT = 0.4, r0 = 0.2) {
  let t = rings[0]; for (const x of rings) { if (x.life <= 0) { t = x; break; } if (x.life < t.life) t = x; }
  t.m.position.copy(p); t.m.material.color.set(color).multiplyScalar(2); t.m.visible = true; t.life = t.max = lifeT; t.r0 = r0; t.r1 = r1;
  t.m.scale.setScalar(r0);
}
export function flash(p, color, r = 1.5, lifeT = 0.18) {
  let t = flashes[0]; for (const x of flashes) { if (x.life <= 0) { t = x; break; } if (x.life < t.life) t = x; }
  t.m.position.copy(p); t.m.material.color.set(color).multiplyScalar(1.6); t.m.visible = true; t.life = t.max = lifeT; t.r = r;
}
export function light(p, color, intensity = 30, lifeT = 0.25) {
  let t = lights[0]; for (const x of lights) { if (x.life <= 0) { t = x; break; } if (x.life < t.life) t = x; }
  t.l.position.copy(p); t.l.color.set(color); t.l.intensity = intensity; t.i0 = intensity; t.life = t.max = lifeT;
}
export function shake(amt, p) {
  if (p && G.player) amt *= Math.max(0, 1 - G.player.pos.distanceTo(p) / 22);
  G.shake = Math.min(1.4, G.shake + amt);
}

const FIRE = [0xffe27a, 0xff9a3c, 0xff5a2a, 0xffffff];
export function explode(p, r = 3, colors = FIRE, quiet) {
  burst(p, { n: 60, color: colors, speed: [3, 5 + r * 3], life: [0.3, 0.9], size: [0.12, 0.3], grav: 5, drag: 2.2 });
  burst(p, { n: 24, color: colors, speed: [0.5, 2], life: [0.5, 1.1], size: [0.4, 0.8], grav: -1.5, drag: 2, glow: 0.7 });
  flash(p, colors[0], r * 0.8, 0.22); ring(p, colors[1] ?? colors[0], r * 1.3, 0.45);
  light(p, colors[0], 60, 0.35); shake(0.5, p);
  if (!quiet) sfx.explode(p);
}
const FW = [[0xff4d6d, 0xffd166], [0x4cc9f0, 0xf72585], [0x80ffdb, 0x7400b8], [0xfee440, 0x00f5d4], [0xff9f1c, 0xffffff]];
export function fireworks(p, n = 4) {
  for (let i = 0; i < n; i++) {
    after(i * 0.09, () => {
      _v.set(p.x + rand(-1.6, 1.6), Math.min(G.H - 0.4, p.y + rand(0, 1.6)), p.z + rand(-1.6, 1.6));
      const c = FW[(Math.random() * FW.length) | 0];
      burst(_v, { n: 70, color: c, speed: [5, 7], life: [0.6, 1.2], size: [0.1, 0.2], grav: 4, drag: 2.4, glow: 2 });
      flash(_v, c[0], 1.2, 0.15); light(_v, c[0], 30, 0.3); sfx.pop(_v);
    });
  }
}
export function confetti(p) {
  burst(p, { n: 80, color: [0xff4d6d, 0xffd166, 0x4cc9f0, 0x80ffdb, 0xc77dff], speed: [3, 8], life: [0.8, 1.6], size: [0.08, 0.16], grav: 7, drag: 2.5, dir: { x: 0, y: 1, z: 0 }, spread: 0.7 });
}

export function updateFX(dt) {
  G.fxMat.uniforms.uScale.value = G.renderer.domElement.height * 0.55;
  for (let i = 0; i < N; i++) {
    if (life[i] <= 0) continue;
    life[i] -= dt;
    if (life[i] <= 0) { size[i] = 0; col[i * 4 + 3] = 0; continue; }
    const d = Math.max(0, 1 - drag[i] * dt);
    vx[i] *= d; vy[i] = vy[i] * d - grav[i] * dt; vz[i] *= d;
    pos[i * 3] += vx[i] * dt; pos[i * 3 + 1] += vy[i] * dt; pos[i * 3 + 2] += vz[i] * dt;
    if (pos[i * 3 + 1] < 0.03) { pos[i * 3 + 1] = 0.03; vy[i] *= -0.35; }
    const k = life[i] / maxLife[i];
    size[i] = s0[i] * (0.4 + 0.6 * k);
    col[i * 4] = cr[i]; col[i * 4 + 1] = cg[i]; col[i * 4 + 2] = cb[i]; col[i * 4 + 3] = Math.min(1, k * 2);
  }
  geo.attributes.position.needsUpdate = true; geo.attributes.color4.needsUpdate = true; geo.attributes.psize.needsUpdate = true;
  for (const t of tracers) if (t.life > 0) {
    t.life -= dt; const k = Math.max(0, t.life / t.max);
    t.m.material.opacity = k; t.m.scale.x = t.m.scale.y = t.w * (0.3 + 0.7 * k);
    if (t.life <= 0) t.m.visible = false;
  }
  for (const t of rings) if (t.life > 0) {
    t.life -= dt; const k = Math.max(0, t.life / t.max), e = 1 - k * k;
    t.m.scale.setScalar(t.r0 + (t.r1 - t.r0) * e); t.m.material.opacity = k;
    if (t.life <= 0) t.m.visible = false;
  }
  for (const t of flashes) if (t.life > 0) {
    t.life -= dt; const k = Math.max(0, t.life / t.max);
    t.m.scale.setScalar(t.r * (1.2 - k * 0.7)); t.m.material.opacity = k * 0.8;
    if (t.life <= 0) t.m.visible = false;
  }
  for (const t of lights) if (t.life > 0) {
    t.life -= dt; t.l.intensity = t.i0 * Math.max(0, t.life / t.max);
  }
}
