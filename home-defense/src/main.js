// 入口：渲染器、主循环、游戏状态
import { G, THREE, runTimers, damp } from './g.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildWorld, updateWorld, resetWorld } from './world.js';
import { buildNav } from './phys.js';
import { initFX, updateFX } from './fx.js';
import { initAudio, sfx } from './audio.js';
import { createPlayer, resetPlayer, updatePlayer, initInput, keys, pressed } from './player.js';
import { updateEnemies, updateWaves, startCountdown, resetEnemies, W, spawnEnemy } from './enemies.js';
import { updateProps, resetProps } from './props.js';
import { updateShots, updatePickups, resetShots } from './weapons.js';
import { updateDemo, endDemo } from './demo.js';
import { initUI, updateUI, show, showOver, announce, note } from './ui.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let pr = Math.min(devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
G.renderer = renderer;
const scene = G.scene = new THREE.Scene(); scene.background = new THREE.Color(0xbfe3ff);
const camera = G.camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.08, 120);
scene.add(new THREE.HemisphereLight(0xffffff, 0xe6d8bc, 1.0));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
sun.position.set(8, 30, 6); sun.target.position.set(12, 0, 11); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 14, bottom: -14, near: 1, far: 50 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.45, 0.5, 1.6);
composer.addPass(bloom); composer.addPass(new OutputPass());
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

buildWorld(); buildNav(); initFX(); createPlayer(); initInput(canvas); initUI();

// ---------- 状态 ----------
let best = 0; try { best = +localStorage.getItem('hb_best') || 0; } catch (e) { }
function lock() {
  if (G.fakeLock) return;
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(noLock); } catch (e) { noLock(); }
  setTimeout(() => { if (G.state === 'play' && document.pointerLockElement !== canvas) noLock(); }, 700);
}
function noLock() {
  if (G.fakeLock || document.pointerLockElement === canvas) return;
  G.fakeLock = true; document.body.classList.add('nolock');
  note('Heads up: this page cannot lock the mouse, so move the mouse to look around (the view keeps turning near the screen edges). For the best feel, open the downloaded file in your browser.');
}
function start(fresh) {
  initAudio(); sfx.ui();
  if (fresh) {
    if (G.demo) { endDemo(); G.demo = false; }
    for (const m of G.temp || []) scene.remove(m); G.temp = [];
    document.getElementById('ann').innerHTML = ''; document.getElementById('feed').innerHTML = '';
    resetEnemies(); resetShots(); resetProps(true); resetWorld(); resetPlayer(); G.timers.length = 0; G.anim.length = 0; G.slowT = 0; G.time = 0;
    startCountdown(true); announce('DEFEND YOUR HOME!', 'wave', 2.5);
  }
  G.state = 'play'; show('menu', false); show('pause', false); show('over', false); lock();
}
function pause() { if (G.state !== 'play') return; G.state = 'pause'; show('pause', true); if (document.pointerLockElement) document.exitPointerLock(); }
document.getElementById('startBtn').onclick = () => start(true);
document.getElementById('resumeBtn').onclick = () => start(false);
document.getElementById('againBtn').onclick = () => start(true);
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas && G.state === 'play' && !G.fakeLock) pause(); });
document.addEventListener('pointerlockerror', noLock);
addEventListener('keydown', (e) => { if (e.code === 'KeyP' || (e.code === 'Escape' && G.fakeLock)) { G.state === 'play' ? pause() : G.state === 'pause' && start(false); } });
let mx = 0.5;
addEventListener('mousemove', (e) => { mx = e.clientX / innerWidth; });
G.onDeath = () => {
  sfx.dead(); G.slowT = 1.5;
  if (G.player.score > best) { best = G.player.score; try { localStorage.setItem('hb_best', best); } catch (e) { } }
  setTimeout(() => { G.state = 'over'; if (document.pointerLockElement) document.exitPointerLock(); showOver(best); }, 1800);
};

// ---------- 主循环 ----------
const TOUR = [[2.5, 11], [10, 6.5], [6, 3.5], [11.5, 6.5], [18, 4.5], [13, 9.3], [17, 12.6], [19, 17.5], [13.5, 15.9], [7, 16], [3, 15], [3, 12]];
let last = performance.now(), slowFrames = 0, qLevel = 0, fpsT = 0, fpsN = 0, tourT = 0;
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function sim(raw) {
  let scale = 1;
  if (G.slowT > 0) { G.slowT -= raw; scale = 0.3; }
  G.timeScale = damp(G.timeScale, scale, 14, raw);
  const dt = G.dt = raw * G.timeScale;
  if (G.state === 'play') {
    G.time += dt;
    if (G.fakeLock) { const k = mx < 0.12 ? (0.12 - mx) / 0.12 : mx > 0.88 ? -(mx - 0.88) / 0.12 : 0; G.player.yaw += k * 2.6 * raw; }
    runTimers();
    updatePlayer(dt); updateEnemies(dt); updateWaves(dt); updateProps(dt); updateShots(dt); updatePickups(dt); updateWorld(dt);
    for (let i = G.anim.length - 1; i >= 0; i--) if (G.anim[i](dt) === false) G.anim.splice(i, 1);
    updateFX(dt);
    G.shake = Math.max(0, G.shake - raw * 2.2);
  } else if (G.state === 'menu') {
    // 开始界面背景：AI 自动试玩
    G.demo = true; G.time += dt;
    runTimers(); updateDemo(dt);
    updatePlayer(dt); updateEnemies(dt); updateProps(dt); updateShots(dt); updatePickups(dt); updateWorld(dt);
    for (let i = G.anim.length - 1; i >= 0; i--) if (G.anim[i](dt) === false) G.anim.splice(i, 1);
    updateFX(dt);
    G.shake = Math.max(0, G.shake - raw * 2.2);
  } else if (G.state === 'over') {
    updateProps(dt); updateFX(dt); updateWorld(dt);
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  for (let n = G.fast || 1; n > 0; n--) sim(raw); // G.fast 仅供自动测试加速
  for (const k in pressed) if (G.state !== 'play' && G.state !== 'menu') delete pressed[k];
  if (qLevel >= 2) renderer.render(scene, camera); else composer.render();
  updateUI(G.dt);
  // 自动降画质，保证流畅
  fpsT += raw; fpsN++;
  if (fpsT >= 1) {
    const fps = fpsN / fpsT; fpsT = 0; fpsN = 0; G.fps = fps;
    if (fps < 30 && !document.hidden && G.state === 'play') slowFrames++; else slowFrames = 0;
    if (slowFrames >= 3 && qLevel < 3) {
      qLevel++; slowFrames = 0;
      if (qLevel === 1) { renderer.setPixelRatio(1); composer.setPixelRatio(1); }
      else if (qLevel === 2) { /* 关闭泛光 */ }
      else { renderer.shadowMap.enabled = false; sun.castShadow = false; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
    }
  }
}
requestAnimationFrame(frame);
window.__G = G; window.__W = W; window.__spawn = spawnEnemy; window.__start = start; window.__keys = keys; window.__pressed = pressed;
