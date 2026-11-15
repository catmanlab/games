// 两台设备同 Wi-Fi 合作。主机算全部战斗，另一台只发送操作并画出主机传来的场面。
import { G, THREE } from './g.js';
import { down, hit, HELD_BITS, EDGE_BITS } from './binds.js';
import { ensurePartner, lookLocal, drawAvatars, clearPressed, mouse } from './player.js';
import { spawnEnemy, despawnEnemy, W } from './enemies.js';
import { spawnPickup } from './weapons.js';
import { PT, spawnProp } from './props.js';
import { buildFort, destroyFort, poseFlip, poseChest } from './world.js';
import { show, showOver, announce } from './ui.js';
import { burst } from './fx.js';

const PORT = 8787;
const ENEMY = ['roller', 'blaster', 'drone', 'bomber', 'boss'];
const KINDS = ['weapon', 'shield', 'health', 'nade', 'mats'];
const SHOTS = ['orb', 'rocket', 'nade'];
const PROP_TYPES = Object.keys(PT);
const q = (n) => Math.round((n || 0) * 50) / 50;

let sock = null, hooks = {}, linked = false, latest = null, snapAcc = 0, quiet = false;
const orbs = [];

const $ = (id) => document.getElementById(id);

function wsURL() {
  const host = location.protocol === 'file:' || !location.hostname ? '127.0.0.1' : location.hostname;
  return `ws://${host}:${PORT}/ws`;
}
function send(obj) { if (sock && sock.readyState === 1) sock.send(JSON.stringify(obj)); }
export function sendNet(obj) { send(obj); }
export function notePause(on) { if (!quiet && G.netRole) send({ t: 'pause', on: on ? 1 : 0 }); }

export function leaveNet() {
  linked = false; latest = null;
  const old = sock; sock = null;
  if (old) { old.onclose = null; try { old.close(); } catch (e) { } }
  G.netRole = null; G.coop = false;
  if (G.partner) { G.partner.left = true; if (G.partner.root) G.partner.root.visible = false; }
}
export function resetNetScene() {
  latest = null;
  for (const m of orbs) m.visible = false;
}

function connect(role) {
  leaveNet();
  G.netRole = role;
  let ws;
  try { ws = new WebSocket(wsURL()); } catch (e) { fail('Could not open a connection.'); return; }
  sock = ws;
  ws.onopen = () => { if (sock !== ws) return; send(role === 'host' ? { t: 'host' } : { t: 'join', code: ($('coopCode').value || '').trim().toUpperCase() }); };
  ws.onmessage = (ev) => { if (sock !== ws) return; let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
  ws.onerror = () => { if (sock === ws) fail('Can\'t reach the game server. On this computer run: node server.js inside the home-defense folder. Then both devices open the address it prints.'); };
  ws.onclose = () => {
    if (sock !== ws) return;
    sock = null; linked = false;
    const was = G.netRole;
    G.netRole = null; G.coop = false;
    if (G.partner) { G.partner.left = true; if (G.partner.root) G.partner.root.visible = false; }
    if (was === 'guest' && (G.state === 'play' || G.state === 'pause' || G.state === 'over')) {
      G.state = 'menu'; show('menu', true); show('pause', false); show('over', false);
      if (document.pointerLockElement) document.exitPointerLock();
      announce('Disconnected from the host', 'warn', 2.2);
    } else if (was === 'host' && G.state === 'play') announce('Player 2 disconnected. You can keep playing.', 'warn', 2.2);
  };
}
function fail(text) {
  const w = $('coopWait'); if (w) w.textContent = text;
  leaveNet();
}

function onMsg(m) {
  if (m.t === 'room') showRoom(m);
  else if (m.t === 'joined') { if ($('coopWait')) $('coopWait').textContent = 'Code accepted. Waiting for the host…'; }
  else if (m.t === 'peer') onPeer();
  else if (m.t === 'err') { if ($('coopWait')) $('coopWait').textContent = m.m || 'Could not join.'; }
  else if (m.t === 'in') takeInput(m);
  else if (m.t === 'snap') latest = m;
  else if (m.t === 'go') { latest = null; quiet = true; try { hooks.begin && hooks.begin(); } finally { quiet = false; } }
  else if (m.t === 'pause') { if (G.partner) G.partner.netEdge = 0; quiet = true; try { m.on ? hooks.pause && hooks.pause() : hooks.resume && hooks.resume(); } finally { quiet = false; } }
  else if (m.t === 'again' && G.netRole === 'host') { send({ t: 'go' }); quiet = true; try { hooks.begin && hooks.begin(); } finally { quiet = false; } }
  else if (m.t === 'over') showGuestOver(m);
  else if (m.t === 'left') {
    linked = false;
    if (G.partner) { G.partner.left = true; if (G.partner.root) G.partner.root.visible = false; }
    if (G.netRole === 'guest') {
      G.coop = false; G.netRole = null;
      if (G.state === 'play' || G.state === 'pause' || G.state === 'over') {
        G.state = 'menu'; show('menu', true); show('pause', false); show('over', false);
        if (document.pointerLockElement) document.exitPointerLock();
      }
      announce('The host left', 'warn', 2.2);
    } else {
      G.coop = false;
      if (G.state === 'play') announce('Player 2 left. You can keep playing.', 'warn', 2.2);
      else if ($('coopWait')) { $('coopWait').textContent = 'The other player left.'; if ($('coopStart')) $('coopStart').style.display = 'none'; }
    }
  }
}

function showRoom(m) {
  const ips = m.ips && m.ips.length ? m.ips : [];
  const links = ips.map((ip) => `http://${ip}:${m.port || PORT}`);
  const box = $('coopBox');
  if (box) {
    box.style.display = 'block';
    box.innerHTML = `Code <b>${m.code}</b><br>On the other device, open ${links.length ? links.map((u) => `<br>${u}`).join('') : 'this game from the server'}<br>and enter the code.`;
  }
  if ($('coopWait')) $('coopWait').textContent = 'Waiting for the other player…';
  if ($('coopPick')) $('coopPick').style.display = 'none';
}
function onPeer() {
  linked = true;
  ensurePartner();
  if (G.partner) G.partner.left = false;
  if (G.netRole === 'host') {
    if ($('coopWait')) $('coopWait').textContent = 'Player 2 joined.';
    if ($('coopStart')) $('coopStart').style.display = 'inline-block';
  } else if ($('coopWait')) $('coopWait').textContent = 'Connected. Waiting for the host to press start.';
}

function takeInput(m) {
  const p = G.partner; if (!p || p.left) return;
  p.netYaw = m.y; p.netPitch = m.p;
  p.netHeld = m.h | 0; p.netEdge |= m.e | 0;
  p.netFire = !!m.f; p.netAds = !!m.a;
  if (m.fp) p.netFireP = true;
  if (m.fr) p.netFireR = true;
  p.netWheel = (p.netWheel || 0) + (m.w || 0);
}

function sample() {
  const p = G.human;
  let h = 0, e = 0;
  for (const k in HELD_BITS) if (down(k)) h |= HELD_BITS[k];
  for (const k in EDGE_BITS) if (hit(k)) e |= EDGE_BITS[k];
  const w = G.wheelAcc || 0; G.wheelAcc = 0;
  const msg = { t: 'in', y: p.yaw, p: p.pitch, h, e, f: mouse.l ? 1 : 0, a: mouse.r ? 1 : 0, fp: mouse.lp ? 1 : 0, fr: mouse.lr ? 1 : 0, w };
  clearPressed();
  return msg;
}

function packP(p) {
  let f = 0;
  if (p.dead) f |= 1; if (p.crouch) f |= 2; if (p.ads) f |= 4; if (p.held) f |= 8; if (p.onGround) f |= 16;
  if (p.slideT > 0) f |= 32; if (p.emoteT > 0) f |= 64; if (p.blocking) f |= 128; if (p.fp) f |= 256; if (p.reloadT > 0) f |= 512;
  return {
    x: q(p.pos.x), y: q(p.pos.y), z: q(p.pos.z), yaw: q(p.yaw), pitch: q(p.pitch),
    vx: q(p.vel.x), vy: q(p.vel.y), vz: q(p.vel.z), hp: Math.ceil(p.hp), sh: Math.ceil(p.shield), f, cur: p.cur,
    slots: p.weapons.map((w) => (w ? [w.wi, w.rar, w.ammo] : 0)),
    score: p.score | 0, kills: p.kills | 0, fuel: q(p.fuel), nades: p.nades | 0, mats: p.mats | 0, back: Math.ceil(p.respawnT || 0),
  };
}
function topLine() {
  if (W.phase === 'count') return G.wave === 1 ? `Robots invade in ${Math.ceil(W.t)}s — go open the chests!` : `Wave ${G.wave} starts in ${Math.ceil(W.t)}s`;
  if (W.phase === 'fight') return `Wave ${G.wave} · ${G.enemies.length + W.queue.length + W.pending} left`;
  return '';
}
function pack() {
  const props = [];
  for (const p of G.props) {
    const home = p.home;
    const away = !home || p.dead || p.held || p.awake || Math.hypot(p.pos.x - home.x, p.pos.y - home.y, p.pos.z - home.z) > 0.15;
    if (away) p.wasSent = true;
    else if (!p.wasSent) continue;
    else p.wasSent = false;
    props.push([p.nid, Math.max(0, PROP_TYPES.indexOf(p.type)), q(p.pos.x), q(p.pos.y), q(p.pos.z), q(p.g.rotation.x), q(p.g.rotation.y), q(p.g.rotation.z), p.dead ? 1 : 0]);
  }
  return {
    t: 'snap', wave: G.wave, phase: W.phase, top: topLine(),
    p: [G.human ? packP(G.human) : null, G.partner ? packP(G.partner) : null],
    e: G.enemies.filter((e) => !e.dead).map((e) => [e.nid, Math.max(0, ENEMY.indexOf(e.type)), q(e.pos.x), q(e.pos.y), q(e.pos.z), q(e.g.rotation.y), Math.ceil(e.hp), Math.ceil(e.maxHp)]),
    s: G.shots.map((s) => [q(s.pos.x), q(s.pos.y), q(s.pos.z), Math.max(0, SHOTS.indexOf(s.kind)), s.col]),
    pr: props,
    extra: G.props.filter((p) => !p.home).map((p) => p.nid),
    k: G.pickups.map((k) => [k.nid, Math.max(0, KINDS.indexOf(k.kind)), q(k.pos.x), q(k.pos.y), q(k.pos.z), k.data.wi || 0, k.data.rar || 0]),
    fort: G.walls.map((w) => [w.nid, q(w.g.position.x), q(w.g.position.z), w.g.rotation.y === 0 ? 1 : 0, Math.ceil(w.hp)]),
    fl: G.flips.map((f) => (f.flipped ? f.s : 0)),
    ch: G.chests.map((c) => (c.opened ? 1 : 0)),
    cat: G.catPos ? [q(G.catPos.x), q(G.catPos.y), q(G.catPos.z), G.cat && G.cat.g ? q(G.cat.g.rotation.y) : 0] : null,
  };
}

function glide(obj, x, y, z, dt, key) {
  if (!obj[key]) { obj.pos.set(x, y, z); obj[key] = 1; return; }
  const dx = x - obj.pos.x, dy = y - obj.pos.y, dz = z - obj.pos.z;
  if (dx * dx + dy * dy + dz * dz > 25) obj.pos.set(x, y, z);
  else { const k = 1 - Math.exp(-16 * dt); obj.pos.x += dx * k; obj.pos.y += dy * k; obj.pos.z += dz * k; }
}
function applyBody(p, row, dt, self) {
  if (!p || !row) return;
  glide(p, row.x, row.y, row.z, dt, 'saw');
  p.vel.set(row.vx, row.vy, row.vz);
  if (!self) {
    let d = row.yaw - p.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    p.yaw += d * (1 - Math.exp(-14 * dt)); p.pitch = row.pitch;
  }
  p.hp = row.hp; p.shield = row.sh; p.dead = !!(row.f & 1); p.crouch = !!(row.f & 2); p.ads = !!(row.f & 4);
  p.onGround = !!(row.f & 16); p.slideT = row.f & 32 ? 0.3 : 0; p.blocking = !!(row.f & 128); p.fp = !!(row.f & 256);
  p.emoteT = row.f & 64 ? Math.max(0.3, p.emoteT || 0) : 0;
  p.reloadT = row.f & 512 ? 0.2 : 0; p.height = (p.crouch || p.slideT > 0) ? 0.9 : 1.8; p.respawnT = row.back || 0;
  p.score = row.score; p.kills = row.kills; p.fuel = row.fuel; p.nades = row.nades; p.mats = row.mats;
  const hold = !!(row.f & 8);
  if (!!p.held !== hold) { p.held = hold ? {} : null; p.gunDirty = true; }
  let dirty = p.cur !== row.cur; p.cur = row.cur;
  for (let i = 0; i < 5; i++) {
    const s = row.slots[i], w = p.weapons[i];
    if (!s) { if (w) { p.weapons[i] = null; dirty = true; } continue; }
    if (!w || w.wi !== s[0] || w.rar !== s[1]) { p.weapons[i] = { wi: s[0], rar: s[1], ammo: s[2] }; dirty = true; }
    else w.ammo = s[2];
  }
  if (dirty) p.gunDirty = true;
}
function applySnap(m, dt) {
  G.wave = m.wave || 0; W.phase = m.phase || 'fight'; G.netTop = m.top || '';
  if (m.p) { applyBody(G.partner, m.p[0], dt, false); applyBody(G.human, m.p[1], dt, true); }
  const have = new Map(G.enemies.map((e) => [e.nid, e]));
  const keep = new Set();
  for (const row of m.e || []) {
    keep.add(row[0]);
    let e = have.get(row[0]);
    if (!e) {
      spawnEnemy(ENEMY[row[1]] || 'roller', row[2], row[4], row[0]);
      e = G.enemies[G.enemies.length - 1]; e.spawnT = 0; e.g.scale.setScalar(1); have.set(row[0], e);
    }
    if (e.seenHp != null && row[6] < e.seenHp - 2) burst(e.pos, { n: 4, color: 0xff3355, speed: [1, 3], life: [0.12, 0.28], size: [0.06, 0.12] });
    e.seenHp = row[6]; e.hp = row[6]; e.maxHp = row[7] || e.maxHp;
    glide(e, row[2], row[3], row[4], dt, 'saw'); e.g.rotation.y = row[5];
    if (e.bar0) {
      const show = e.hp < e.maxHp; e.bar0.visible = e.bar1.visible = show;
      if (show) {
        const y = e.pos.y + (e.T.fly ? 0.7 : (e.T.hy || 1) + 0.45);
        e.bar0.position.set(e.pos.x, y, e.pos.z); e.bar1.position.copy(e.bar0.position);
        e.bar1.scale.x = 0.9 * Math.max(0, Math.min(1, e.hp / e.maxHp));
      }
    }
  }
  for (const e of [...G.enemies]) if (!keep.has(e.nid)) despawnEnemy(e);
  while (orbs.length < (m.s || []).length) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    mesh.visible = false; G.scene.add(mesh); orbs.push(mesh);
  }
  orbs.forEach((mesh, i) => {
    const s = (m.s || [])[i];
    if (!s) { mesh.visible = false; return; }
    mesh.visible = true; mesh.position.set(s[0], s[1], s[2]); mesh.scale.setScalar(s[3] === 1 ? 0.16 : 0.1);
    mesh.material.color.setHex(s[4] || 0xffffff);
  });
  const byProp = new Map(G.props.map((p) => [p.nid, p]));
  for (const row of m.pr || []) {
    let p = byProp.get(row[0]);
    if (!p) {
      p = spawnProp(PROP_TYPES[row[1]] || 'scrap', row[2], row[3], row[4], { nid: row[0], life: 60 });
      byProp.set(row[0], p);
    }
    p.dead = !!row[8]; p.g.visible = !p.dead;
    if (!p.dead) glide(p, row[2], row[3], row[4], dt, 'saw');
    p.g.rotation.set(row[5], row[6], row[7]);
  }
  const extra = new Set(m.extra || []);
  for (let i = G.props.length - 1; i >= 0; i--) {
    const p = G.props[i];
    if (!p.home && !extra.has(p.nid)) { G.scene.remove(p.g); G.props.splice(i, 1); }
  }
  const haveK = new Map(G.pickups.map((k) => [k.nid, k]));
  const keepK = new Set();
  for (const row of m.k || []) {
    keepK.add(row[0]);
    let k = haveK.get(row[0]);
    if (!k) {
      k = spawnPickup(KINDS[row[1]] || 'mats', new THREE.Vector3(row[2], row[3], row[4]), { wi: row[5], rar: row[6], nid: row[0] }, false);
      haveK.set(row[0], k);
    } else glide(k, row[2], row[3], row[4], dt, 'saw');
  }
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const k = G.pickups[i];
    if (!keepK.has(k.nid)) { G.scene.remove(k.g, k.beam); G.pickups.splice(i, 1); }
  }
  const haveF = new Map(G.walls.map((w) => [w.nid, w]));
  const keepF = new Set();
  for (const row of m.fort || []) {
    keepF.add(row[0]);
    if (!haveF.get(row[0])) buildFort(row[1], row[2], !!row[3], row[0]);
    const w = G.walls.find((x) => x.nid === row[0]); if (w) w.hp = row[4];
  }
  for (const w of [...G.walls]) if (!keepF.has(w.nid)) destroyFort(w);
  (m.fl || []).forEach((s, i) => { if (s) poseFlip(i, s); });
  (m.ch || []).forEach((on, i) => { if (on) poseChest(i); });
  if (m.cat && G.catPos) { G.catPos.set(m.cat[0], m.cat[1], m.cat[2]); if (G.cat && G.cat.g) G.cat.g.rotation.y = m.cat[3]; }
}

export function guestFrame(dt) {
  if (!G.human) return;
  lookLocal();
  if (linked) send(sample());
  if (latest) applySnap(latest, dt);
  drawAvatars(dt);
}
export function hostAfterSim(dt) {
  if (G.netRole !== 'host' || !linked) return;
  snapAcc += dt; if (snapAcc < 0.04) return; snapAcc = 0;
  send(pack());
}

function showGuestOver(m) {
  G.wave = m.wave || G.wave;
  if (G.human) { G.human.kills = m.k[1] || 0; G.human.score = m.s[1] || 0; }
  if (G.partner) { G.partner.kills = m.k[0] || 0; G.partner.score = m.s[0] || 0; }
  let best = 0; try { best = +localStorage.getItem('hb_best') || 0; } catch (e) { }
  const score = (m.s[0] || 0) + (m.s[1] || 0);
  if (score > best) { best = score; try { localStorage.setItem('hb_best', best); } catch (e) { } }
  G.state = 'over';
  if (document.pointerLockElement) document.exitPointerLock();
  showOver(best);
}

export function initNet(h) {
  hooks = h || {};
  const open = () => { show('menu', false); show('coop', true); if ($('coopPick')) $('coopPick').style.display = ''; if ($('coopStart')) $('coopStart').style.display = 'none'; if ($('coopBox')) $('coopBox').style.display = 'none'; if ($('coopWait')) $('coopWait').textContent = 'Same Wi-Fi. One person hosts, the other types the code.'; };
  $('coopBtn').onclick = open;
  $('coopBack').onclick = () => { leaveNet(); show('coop', false); if (G.state === 'menu') show('menu', true); };
  $('coopHostBtn').onclick = () => { if ($('coopWait')) $('coopWait').textContent = 'Starting a room…'; connect('host'); };
  $('coopJoinBtn').onclick = () => { if ($('coopWait')) $('coopWait').textContent = 'Joining…'; connect('guest'); };
  $('coopCode').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') $('coopJoinBtn').click(); });
  $('coopStart').onclick = () => { send({ t: 'go' }); quiet = true; try { hooks.begin && hooks.begin(); } finally { quiet = false; } };
}
