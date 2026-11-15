// 界面：HUD、提示、伤害数字、小地图、菜单
import { G, THREE, clamp } from './g.js';
import { WP, RAR, CAT_NAME, remapWeapons } from './weapons.js';
import { order, binds, BIND_LABEL, keyName, setBind, shiftOrder, fromEvent, code } from './binds.js';
import { ROOMS } from './world.js';
import { W } from './enemies.js';

const $ = (id) => document.getElementById(id);
let el = {}, nums = [], mm, hintText = '', slotKey = '';
const _v = new THREE.Vector3();

export function initUI() {
  for (const id of ['hud', 'hp', 'sh', 'hpT', 'slots', 'ammo', 'wname', 'top', 'score', 'combo', 'boss', 'bossF', 'bossN', 'ann', 'feed', 'hint', 'cross', 'hitm', 'vig', 'scope', 'chg', 'chgF', 'abQ', 'abX', 'abG', 'abF', 'fuel', 'menu', 'pause', 'over', 'overT', 'nums', 'mm', 'low', 'note', 'settings', 'setOrder', 'setBinds', 'coop']) el[id] = $(id);
  $('settingsBtn').onclick = () => openSettings('menu');
  $('pauseSettings').onclick = () => openSettings('pause');
  $('settingsBack').onclick = () => closeSettings();
  addEventListener('keydown', onSettingsKey, true);
  addEventListener('mousedown', onSettingsMouse, true);
  for (let i = 0; i < 30; i++) { const d = document.createElement('div'); d.className = 'num'; el.nums.appendChild(d); nums.push({ d, life: 0, pos: new THREE.Vector3() }); }
  mm = el.mm.getContext('2d');
}
export function announce(text, cls = 'info', dur = 1.6, color) {
  const d = document.createElement('div'); d.className = 'a ' + cls; d.textContent = text; if (color) d.style.color = color;
  el.ann.appendChild(d); while (el.ann.children.length > 3) el.ann.firstChild.remove();
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, dur * 1000);
}
export function feed(text) {
  const d = document.createElement('div'); d.textContent = text; el.feed.appendChild(d);
  while (el.feed.children.length > 5) el.feed.firstChild.remove();
  setTimeout(() => d.remove(), 4000);
}
export function setHint(t) { if (t !== hintText) { hintText = t; el.hint.textContent = t; el.hint.style.opacity = t ? 1 : 0; } }
export function note(t) { el.note.textContent = t; el.note.style.opacity = 1; setTimeout(() => (el.note.style.opacity = 0), 5000); }
let numI = 0;
export function dmgNum(pos, n, crit, frozen) {
  const o = nums[numI = (numI + 1) % nums.length];
  o.pos.copy(pos); o.pos.x += (Math.random() - 0.5) * 0.4; o.pos.y += 0.3; o.life = 0.75;
  o.d.textContent = n; o.d.className = 'num' + (crit ? ' crit' : frozen ? ' ice' : n >= 60 ? ' big' : '');
}
export function show(id, on) { el[id].style.display = on ? 'flex' : 'none'; }
export function showOver(best) {
  const p = G.human || G.player;
  const q = G.coop && G.partner && !G.partner.left ? G.partner : null;
  const kills = p.kills + (q ? q.kills : 0);
  const score = p.score + (q ? q.score : 0);
  const blocks = p.blocks + (q ? q.blocks : 0);
  el.overT.innerHTML = `You made it to <b>wave ${G.wave}</b><br>Robots destroyed <b>${kills}</b> · Shots reflected <b>${blocks}</b><br>Score <b>${score}</b>${score >= best && score > 0 ? ' 🏆 New record!' : ` (best ${best})`}` + (q ? `<br>You <b>${p.score}</b> · Partner <b>${q.score}</b>` : '');
  show('over', true);
}

export function updateUI(dt) {
  const p = G.player; if (!p) return;
  el.hud.style.display = G.state === 'play' || G.state === 'over' ? 'block' : 'none';
  if (G.state !== 'play' && G.state !== 'over') return;
  el.hp.style.width = p.hp + '%'; el.sh.style.width = p.shield + '%'; el.hpT.textContent = `${Math.ceil(p.hp)}  🛡${Math.ceil(p.shield)}`;
  el.low.style.opacity = p.hp < 30 ? 0.35 + Math.sin(G.time * 6) * 0.2 : 0;
  // 武器栏
  const key = p.weapons.map((w) => (w ? w.wi + ':' + w.rar : '-')).join('') + p.cur + (p.held ? 'h' : '') + order.join() + [1, 2, 3, 4, 5].map((i) => code('slot' + i)).join();
  if (key !== slotKey) {
    slotKey = key;
    el.slots.innerHTML = p.weapons.map((w, i) => `<div class="slot${i === p.cur && !p.held ? ' on' : ''}${w ? '' : ' empty'}" style="--c:${w ? RAR[w.rar].css : '#444'}"><i>${keyName(code('slot' + (i + 1)))}</i><b>${w ? WP[w.wi].name : CAT_NAME[order[i]]}</b></div>`).join('');
  }
  const w = p.weapons[p.cur];
  const scoped = !!(w && WP[w.wi].scope && p.ads && !p.held);
  if (el.scope) el.scope.style.display = scoped ? 'block' : 'none';
  el.cross.style.visibility = scoped ? 'hidden' : 'visible';
  if (p.held) { el.ammo.textContent = '✋'; el.wname.textContent = p.held.T.name; el.wname.style.color = '#ff7ae0'; }
  else if (w) { el.ammo.textContent = p.reloadT > 0 ? 'RELOAD' : `${w.ammo} / ${WP[w.wi].mag}`; el.wname.textContent = `${RAR[w.rar].name} · ${WP[w.wi].name}`; el.wname.style.color = RAR[w.rar].css; }
  // 技能
  el.abQ.dataset.k = keyName(code('grapple')); el.abX.dataset.k = keyName(code('dash'));
  el.abG.dataset.k = keyName(code('nade')); el.abF.dataset.k = keyName(code('fort'));
  el.abQ.style.setProperty('--k', clamp(1 - p.grappleCd / 2.2, 0, 1)); el.abX.style.setProperty('--k', clamp(1 - p.dashCd / 1.8, 0, 1));
  el.abG.dataset.n = p.nades; el.abG.style.setProperty('--k', p.nades > 0 ? 1 : 0); el.abF.dataset.n = p.mats; el.abF.style.setProperty('--k', p.mats >= 10 ? 1 : 0);
  el.fuel.style.width = p.fuel * 100 + '%';
  // 顶部
  let top = '';
  if (W.phase === 'count') top = G.wave === 1 ? `Robots invade in ${Math.ceil(W.t)}s — go open the chests!` : `Wave ${G.wave} starts in ${Math.ceil(W.t)}s`;
  else if (W.phase === 'fight') top = `Wave ${G.wave} · ${G.enemies.length + W.queue.length + W.pending} left`;
  if (G.netRole === 'guest' && G.netTop) top = G.netTop;
  if (p.dead && p.respawnT > 0) top = `You are down — back in ${Math.ceil(p.respawnT)}s`;
  else if (G.coop && G.partner && G.partner.dead && G.partner.respawnT > 0) top = `Partner is down — back in ${Math.ceil(G.partner.respawnT)}s`;
  el.top.textContent = top; el.score.textContent = G.coop && G.partner && !G.partner.left ? `YOU ${p.score}  ·  PAL ${G.partner.score}` : `SCORE ${p.score}`;
  el.combo.textContent = p.combo >= 2 ? `COMBO x${p.combo}` : ''; el.combo.style.transform = `scale(${1 + Math.max(0, p.comboT - 2.9) * 2})`;
  if (G.boss) { el.boss.style.display = 'block'; el.bossF.style.width = clamp(G.boss.hp / G.boss.maxHp, 0, 1) * 100 + '%'; } else el.boss.style.display = 'none';
  // 准星
  el.hitm.style.opacity = p.hitMark > 0 ? 1 : 0; el.hitm.style.color = p.hitCrit ? '#ffe14d' : '#fff';
  el.cross.className = p.held ? 'held' : (p.ads ? 'ads' : '');
  const chg = p.held ? p.throwCharge : p.charge;
  el.chg.style.opacity = chg > 0.02 ? 1 : 0; el.chgF.style.width = chg * 100 + '%'; el.chgF.style.background = chg >= 1 ? '#fff' : p.held ? '#ff4dd8' : '#ff2d75';
  el.vig.style.opacity = clamp(p.hurtT * 1.6, 0, 0.8); el.vig.style.setProperty('--vc', p.hurtShield ? '80,180,255' : '255,30,60');
  // 伤害数字
  const cam = G.camera, w2 = innerWidth / 2, h2 = innerHeight / 2;
  for (const o of nums) {
    if (o.life <= 0) { if (o.d.style.display !== 'none') o.d.style.display = 'none'; continue; }
    o.life -= dt; o.pos.y += dt * 1.3;
    _v.copy(o.pos).project(cam);
    if (_v.z > 1) { o.d.style.display = 'none'; continue; }
    o.d.style.display = 'block'; o.d.style.opacity = Math.min(1, o.life * 3);
    o.d.style.transform = `translate(${_v.x * w2 + w2}px,${-_v.y * h2 + h2}px) translate(-50%,-50%) scale(${1 + Math.max(0, o.life - 0.6) * 4})`;
  }
  // 小地图
  const S = 6; mm.clearRect(0, 0, 144, 132);
  mm.fillStyle = 'rgba(10,14,24,.55)'; mm.fillRect(0, 0, 144, 132);
  mm.strokeStyle = 'rgba(255,255,255,.55)'; mm.lineWidth = 1; mm.font = '9px sans-serif'; mm.textAlign = 'center';
  for (const r of ROOMS) { mm.strokeRect(r.x0 * S + 0.5, r.z0 * S + 0.5, (r.x1 - r.x0) * S - 1, (r.z1 - r.z0) * S - 1); mm.fillStyle = 'rgba(255,255,255,.35)'; mm.fillText(r.name, (r.x0 + r.x1) / 2 * S, (r.z0 + r.z1) / 2 * S + 3); }
  for (const c of G.chests) if (!c.opened) { mm.fillStyle = '#ffd60a'; mm.fillRect(c.x * S - 2, c.z * S - 2, 4, 4); }
  for (const k of G.pickups) { mm.fillStyle = k.kind === 'weapon' ? '#fff' : '#4cc9f0'; mm.fillRect(k.pos.x * S - 1.5, k.pos.z * S - 1.5, 3, 3); }
  for (const o of G.poops || []) { mm.fillStyle = '#9dff3c'; mm.fillRect(o.x * S - 1.5, o.z * S - 1.5, 3, 3); }
  if (G.catPos) { mm.fillStyle = '#ffa94d'; mm.beginPath(); mm.arc(G.catPos.x * S, G.catPos.z * S, 3, 0, 6.3); mm.fill(); }
  for (const e of G.enemies) { mm.fillStyle = e.type === 'boss' ? '#ff0054' : '#ff5a5a'; mm.beginPath(); mm.arc(e.pos.x * S, e.pos.z * S, e.type === 'boss' ? 5 : 2.5, 0, 6.3); mm.fill(); }
  const drawArrow = (who, color) => { mm.save(); mm.translate(who.pos.x * S, who.pos.z * S); mm.rotate(-who.yaw); mm.fillStyle = color; mm.beginPath(); mm.moveTo(0, 6); mm.lineTo(-4, -4); mm.lineTo(4, -4); mm.fill(); mm.restore(); };
  if (G.coop && G.partner && !G.partner.left) drawArrow(G.partner, '#ffd60a');
  drawArrow(p, '#00f5d4');
}

const BIND_GROUPS = [
  ['Move', ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'crouch', 'slide', 'dash', 'leanL', 'leanR']],
  ['Combat', ['grapple', 'interact', 'reload', 'nade', 'fort', 'emote', 'view', 'mute', 'pause']],
  ['Weapons', ['slot1', 'slot2', 'slot3', 'slot4', 'slot5']],
];
let capture = null, settingsFrom = 'menu';
function renderSettings() {
  el.setOrder.innerHTML = '';
  order.forEach((cat, i) => {
    const row = document.createElement('div'); row.className = 'setrow';
    const left = document.createElement('button'); left.className = 'mini'; left.textContent = '◀'; left.disabled = i === 0;
    const right = document.createElement('button'); right.className = 'mini'; right.textContent = '▶'; right.disabled = i === order.length - 1;
    left.onclick = () => moveOrder(i, -1); right.onclick = () => moveOrder(i, 1);
    const name = document.createElement('span'); name.textContent = (i + 1) + '  ' + CAT_NAME[cat];
    row.append(left, name, right); el.setOrder.append(row);
  });
  el.setBinds.innerHTML = '';
  for (const [title, actions] of BIND_GROUPS) {
    const h = document.createElement('div'); h.className = 'sethead'; h.textContent = title; el.setBinds.append(h);
    for (const a of actions) {
      const lab = document.createElement('div'); lab.textContent = BIND_LABEL[a];
      const b = document.createElement('button'); b.className = 'mini' + (capture === a ? ' on' : '');
      b.textContent = capture === a ? 'Press a key…' : keyName(binds[a]);
      b.onclick = (ev) => { ev.preventDefault(); capture = a; renderSettings(); };
      el.setBinds.append(lab, b);
    }
  }
}
function moveOrder(i, dir) {
  const prev = shiftOrder(i, dir);
  if (!prev) return;
  if (G.player) remapWeapons(G.player, prev, order);
  slotKey = '';
  renderSettings();
}
export function openSettings(from) {
  settingsFrom = from; capture = null; G.settingsOpen = true;
  renderSettings(); show('settings', true);
  if (from === 'menu') show('menu', false);
  if (from === 'pause') show('pause', false);
}
export function closeSettings() {
  G.settingsOpen = false; capture = null; show('settings', false);
  if (settingsFrom === 'menu' && G.state === 'menu') show('menu', true);
  if (settingsFrom === 'pause' && G.state === 'pause') show('pause', true);
}
function onSettingsKey(e) {
  if (!G.settingsOpen) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (capture) {
    if (e.code === 'Escape') { capture = null; renderSettings(); return; }
    const c = fromEvent(e);
    if (!c || c === 'Escape') return;
    setBind(capture, c); capture = null; slotKey = ''; renderSettings();
    return;
  }
  if (e.code === 'Escape') closeSettings();
}
function onSettingsMouse(e) {
  if (!G.settingsOpen || !capture) return;
  if (e.button === 0 && e.target && e.target.closest && e.target.closest('button')) return;
  if (e.button !== 0 && e.button !== 2) return;
  e.preventDefault(); e.stopImmediatePropagation();
  setBind(capture, e.button === 2 ? 'MouseRight' : 'MouseLeft');
  capture = null; slotKey = ''; renderSettings();
}
