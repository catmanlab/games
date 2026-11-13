// 音效与音乐：全部用 WebAudio 实时合成，无外部素材
import { G } from './g.js';

let ctx = null, master = null, musicGain = null, noiseBuf = null, muted = false;
export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setInterval(schedule, 60);
  } catch (e) { ctx = null; }
}
export function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.55; return muted; }

function vol(p) { // 按距离衰减
  if (!p || !G.player) return 1;
  const d = G.player.pos.distanceTo(p);
  return Math.max(0.12, 1 - d / 28);
}
function tone(o) {
  if (!ctx) return;
  const t = ctx.currentTime + (o.delay || 0), osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f0, t);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.vol ?? 0.2, t + (o.att ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g); g.connect(o.out || master); osc.start(t); osc.stop(t + o.dur + 0.05);
}
function noise(o) {
  if (!ctx) return;
  const t = ctx.currentTime + (o.delay || 0), src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  src.buffer = noiseBuf; src.loop = true; f.type = o.type || 'lowpass';
  f.frequency.setValueAtTime(o.f0 || 2000, t); if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
  f.Q.value = o.q || 1;
  g.gain.setValueAtTime(o.vol ?? 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f); f.connect(g); g.connect(o.out || master); src.start(t, Math.random()); src.stop(t + o.dur + 0.05);
}

export const sfx = {
  rifle() { tone({ type: 'square', f0: 520, f1: 110, dur: 0.09, vol: 0.12 }); noise({ f0: 4200, f1: 500, dur: 0.11, vol: 0.26 }); tone({ f0: 150, f1: 55, dur: 0.1, vol: 0.2 }); },
  smg() { tone({ type: 'square', f0: 900, f1: 220, dur: 0.07, vol: 0.09 }); noise({ f0: 5000, f1: 800, dur: 0.06, vol: 0.12 }); },
  shotgun() { noise({ f0: 3000, f1: 200, dur: 0.28, vol: 0.4 }); tone({ type: 'sawtooth', f0: 220, f1: 50, dur: 0.2, vol: 0.2 }); },
  charge(k) { tone({ type: 'sawtooth', f0: 200 + k * 900, f1: 260 + k * 1000, dur: 0.08, vol: 0.05 }); },
  laser() { tone({ type: 'sawtooth', f0: 1800, f1: 120, dur: 0.45, vol: 0.22 }); tone({ type: 'square', f0: 90, f1: 40, dur: 0.5, vol: 0.25 }); noise({ f0: 8000, f1: 500, dur: 0.4, vol: 0.2 }); },
  freeze() { noise({ type: 'bandpass', f0: 6000, f1: 3500, dur: 0.1, vol: 0.07, q: 2 }); },
  frozen(p) { tone({ type: 'triangle', f0: 2400, f1: 3200, dur: 0.25, vol: 0.15 * vol(p) }); },
  rocket() { noise({ f0: 600, f1: 3000, dur: 0.4, vol: 0.3 }); tone({ type: 'sawtooth', f0: 160, f1: 420, dur: 0.35, vol: 0.14 }); },
  explode(p) { const v = vol(p); noise({ f0: 1400, f1: 60, dur: 0.7, vol: 0.6 * v }); tone({ f0: 130, f1: 30, dur: 0.6, vol: 0.5 * v }); },
  pop(p) { const v = vol(p); noise({ type: 'bandpass', f0: 2600, f1: 900, dur: 0.25, vol: 0.25 * v }); tone({ f0: 700, f1: 200, dur: 0.15, vol: 0.12 * v }); },
  hit() { tone({ type: 'square', f0: 1300, f1: 900, dur: 0.045, vol: 0.07 }); },
  crit() { tone({ type: 'square', f0: 1900, f1: 2600, dur: 0.08, vol: 0.1 }); },
  kill() { tone({ type: 'triangle', f0: 660, f1: 1320, dur: 0.14, vol: 0.2 }); tone({ type: 'triangle', f0: 990, f1: 1980, dur: 0.18, vol: 0.14, delay: 0.07 }); },
  jump() { tone({ f0: 300, f1: 620, dur: 0.12, vol: 0.1 }); },
  jump2() { tone({ type: 'triangle', f0: 500, f1: 1100, dur: 0.14, vol: 0.13 }); noise({ type: 'highpass', f0: 3000, dur: 0.12, vol: 0.06 }); },
  dash() { noise({ type: 'bandpass', f0: 600, f1: 4000, dur: 0.22, vol: 0.25, q: 0.8 }); },
  slide() { noise({ type: 'bandpass', f0: 1800, f1: 500, dur: 0.5, vol: 0.12 }); },
  jet() { noise({ type: 'bandpass', f0: 900, f1: 1300, dur: 0.09, vol: 0.06, q: 0.6 }); },
  slam() { noise({ f0: 900, f1: 50, dur: 0.6, vol: 0.6 }); tone({ f0: 100, f1: 28, dur: 0.6, vol: 0.6 }); },
  grapple() { tone({ type: 'sawtooth', f0: 300, f1: 1600, dur: 0.16, vol: 0.12 }); noise({ type: 'highpass', f0: 4000, dur: 0.1, vol: 0.1 }); },
  grab() { tone({ f0: 240, f1: 900, dur: 0.2, vol: 0.14 }); tone({ type: 'triangle', f0: 480, f1: 1800, dur: 0.2, vol: 0.06 }); },
  throw(k) { noise({ type: 'bandpass', f0: 500, f1: 2600, dur: 0.18, vol: 0.2 + k * 0.15, q: 0.7 }); },
  thud(p, k = 1) { tone({ f0: 160, f1: 60, dur: 0.12, vol: Math.min(0.3, 0.1 * k) * vol(p) }); },
  bonk(p) { const v = vol(p); tone({ type: 'square', f0: 420, f1: 140, dur: 0.14, vol: 0.2 * v }); noise({ f0: 2000, f1: 300, dur: 0.1, vol: 0.2 * v }); },
  shatter(p) { const v = vol(p); noise({ type: 'highpass', f0: 3500, dur: 0.3, vol: 0.3 * v }); tone({ type: 'triangle', f0: 3200, f1: 1200, dur: 0.2, vol: 0.1 * v }); },
  clang() { tone({ type: 'square', f0: 1500, f1: 1450, dur: 0.3, vol: 0.14 }); tone({ type: 'triangle', f0: 2250, f1: 2200, dur: 0.4, vol: 0.12 }); },
  block() { tone({ f0: 300, f1: 150, dur: 0.12, vol: 0.2 }); noise({ f0: 1500, f1: 300, dur: 0.1, vol: 0.15 }); },
  hurt() { tone({ type: 'sawtooth', f0: 220, f1: 90, dur: 0.25, vol: 0.25 }); },
  pickup() { tone({ type: 'triangle', f0: 700, f1: 1400, dur: 0.1, vol: 0.14 }); tone({ type: 'triangle', f0: 1050, f1: 2100, dur: 0.14, vol: 0.12, delay: 0.08 }); },
  rare() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.3, vol: 0.14, delay: i * 0.07 })); },
  chest() { noise({ f0: 400, f1: 3000, dur: 0.3, vol: 0.15 }); [392, 523, 659, 784].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.22, vol: 0.07, delay: 0.1 + i * 0.08 })); },
  reload() { tone({ type: 'square', f0: 500, dur: 0.04, vol: 0.08 }); tone({ type: 'square', f0: 800, dur: 0.05, vol: 0.08, delay: 0.18 }); },
  empty() { tone({ type: 'square', f0: 180, dur: 0.05, vol: 0.08 }); },
  swap() { tone({ type: 'triangle', f0: 600, f1: 900, dur: 0.06, vol: 0.08 }); },
  build() { tone({ f0: 180, f1: 420, dur: 0.14, vol: 0.2 }); noise({ f0: 800, f1: 2500, dur: 0.12, vol: 0.1 }); },
  flip() { noise({ f0: 500, f1: 150, dur: 0.4, vol: 0.4 }); tone({ type: 'sawtooth', f0: 140, f1: 70, dur: 0.3, vol: 0.2 }); },
  portal(p) { const v = vol(p); tone({ type: 'sawtooth', f0: 80, f1: 600, dur: 0.6, vol: 0.1 * v }); noise({ type: 'bandpass', f0: 300, f1: 3000, dur: 0.6, vol: 0.08 * v, q: 3 }); },
  eshoot(p) { tone({ type: 'square', f0: 520, f1: 180, dur: 0.16, vol: 0.09 * vol(p) }); },
  beep(p) { tone({ type: 'square', f0: 1700, dur: 0.05, vol: 0.08 * vol(p) }); },
  wave() { [220, 277, 330, 440].forEach((f, i) => tone({ type: 'sawtooth', f0: f, dur: 0.35, vol: 0.1, delay: i * 0.1 })); },
  clear() { [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.4, vol: 0.16, delay: i * 0.11 })); },
  boss() { tone({ type: 'sawtooth', f0: 70, f1: 45, dur: 1.4, vol: 0.4 }); tone({ type: 'sawtooth', f0: 105, f1: 60, dur: 1.4, vol: 0.25 }); noise({ f0: 300, f1: 80, dur: 1.2, vol: 0.3 }); },
  multi(n) { for (let i = 0; i < Math.min(n, 5); i++) tone({ type: 'square', f0: 440 * Math.pow(1.26, i), dur: 0.16, vol: 0.1, delay: i * 0.06 }); },
  blackhole() { tone({ type: 'sawtooth', f0: 400, f1: 40, dur: 1.4, vol: 0.2 }); noise({ type: 'bandpass', f0: 2000, f1: 100, dur: 1.4, vol: 0.2, q: 4 }); },
  dead() { [440, 370, 311, 220].forEach((f, i) => tone({ type: 'sawtooth', f0: f, dur: 0.5, vol: 0.14, delay: i * 0.18 })); },
  ui() { tone({ type: 'triangle', f0: 880, dur: 0.06, vol: 0.1 }); },
  meow(p) { const v = vol(p); tone({ type: 'sawtooth', f0: 650, f1: 1050, dur: 0.16, vol: 0.12 * v }); tone({ type: 'sawtooth', f0: 1050, f1: 520, dur: 0.3, vol: 0.12 * v, delay: 0.15 }); },
  hiss(p) { const v = vol(p); noise({ type: 'highpass', f0: 4500, dur: 0.35, vol: 0.3 * v }); tone({ type: 'sawtooth', f0: 900, f1: 1400, dur: 0.12, vol: 0.1 * v }); },
  fart(p) { const v = vol(p); tone({ type: 'sawtooth', f0: 110, f1: 60, dur: 0.28, vol: 0.3 * v }); tone({ type: 'square', f0: 85, f1: 70, dur: 0.2, vol: 0.12 * v, delay: 0.05 }); },
  squeak() { tone({ type: 'sine', f0: 1500, f1: 2400, dur: 0.12, vol: 0.14 }); },
};

// ---------- 音乐：16 步循环 ----------
let step = 0, nextT = 0;
const BASS = [0, 0, 12, 0, 0, 7, 0, 12, 3, 3, 15, 3, 5, 5, 10, 7];
const ARP = [12, 15, 19, 24, 19, 15, 12, 15, 15, 19, 22, 27, 17, 20, 24, 22];
const hz = (n) => 55 * Math.pow(2, n / 12);
function schedule() {
  if (!ctx || ctx.state !== 'running') return;
  const intense = G.state === 'play' && G.enemies.length > 0;
  const spb = 60 / (intense ? 132 : 108) / 4;
  if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
  while (nextT < ctx.currentTime + 0.15) {
    const d = nextT - ctx.currentTime, s = step % 16;
    if (G.state === 'play' || G.state === 'menu') {
      if (s % 4 === 0) tone({ f0: 140, f1: 40, dur: 0.22, vol: intense ? 0.7 : 0.4, delay: d, out: musicGain });
      if (intense && s % 2 === 1) noise({ type: 'highpass', f0: 7000, dur: 0.04, vol: 0.18, delay: d, out: musicGain });
      if (intense && s % 8 === 4) noise({ type: 'bandpass', f0: 1800, dur: 0.12, vol: 0.4, delay: d, out: musicGain });
      tone({ type: 'sawtooth', f0: hz(BASS[s] + (step % 64 >= 32 ? -2 : 0)), dur: spb * 0.9, vol: 0.2, delay: d, out: musicGain });
      if (intense || s % 2 === 0) tone({ type: 'square', f0: hz(ARP[s] + 24 + (step % 64 >= 32 ? -2 : 0)), dur: spb * 0.8, vol: intense ? 0.06 : 0.035, delay: d, out: musicGain });
    }
    step++; nextT += spb;
  }
}
