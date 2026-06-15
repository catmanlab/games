/**
 * Web Audio API 音效合成器 — 无需外部音频文件
 */
const AudioFX = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function playTone(freq, duration, type = 'square', volume = 0.15, ramp = true) {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    if (ramp) {
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    }
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration);
  }

  function playNoise(duration, volume = 0.1) {
    const c = getCtx();
    const bufferSize = c.sampleRate * duration;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    const gain = c.createGain();
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    source.start();
  }

  return {
    init() { getCtx().resume(); },

    punch() {
      playTone(120, 0.1, 'sawtooth', 0.2);
      playNoise(0.08, 0.08);
    },

    special() {
      const c = getCtx();
      [300, 450, 600, 800].forEach((f, i) => {
        setTimeout(() => playTone(f, 0.12, 'sine', 0.12), i * 60);
      });
    },

    heal() {
      [400, 500, 600, 700].forEach((f, i) => {
        setTimeout(() => playTone(f, 0.15, 'sine', 0.1), i * 80);
      });
    },

    hurt() {
      playTone(80, 0.3, 'sawtooth', 0.2);
      playTone(60, 0.4, 'square', 0.1);
    },

    itemPickup() {
      playTone(600, 0.08, 'sine', 0.12);
      setTimeout(() => playTone(900, 0.1, 'sine', 0.12), 80);
    },

    itemBad() {
      playTone(200, 0.2, 'sawtooth', 0.15);
      playNoise(0.15, 0.12);
    },

    bark() {
      playTone(180, 0.08, 'square', 0.2);
      setTimeout(() => playTone(140, 0.15, 'square', 0.15), 60);
      playNoise(0.1, 0.1);
    },

    meow() {
      [500, 700, 550].forEach((f, i) => {
        setTimeout(() => playTone(f, 0.1, 'sine', 0.1), i * 70);
      });
    },

    shield() {
      playTone(300, 0.3, 'sine', 0.1);
      playTone(450, 0.4, 'triangle', 0.08);
    },

    crowdCheer() {
      playNoise(0.4, 0.06);
      setTimeout(() => playNoise(0.3, 0.05), 200);
    },

    win() {
      [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => playTone(f, 0.25, 'sine', 0.15), i * 150);
      });
    },

    throw() {
      playTone(400, 0.06, 'triangle', 0.08);
      setTimeout(() => playTone(250, 0.08, 'triangle', 0.06), 100);
    },

    stun() {
      [800, 600, 400, 200].forEach((f, i) => {
        setTimeout(() => playTone(f, 0.1, 'square', 0.08), i * 50);
      });
    }
  };
})();
