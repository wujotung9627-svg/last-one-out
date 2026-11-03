// All sound is synthesised in the browser: no recordings, no files, no rights to clear.

const MASTER_LEVEL = 0.9;

function noiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// A long, dark tail that sounds like an empty concrete corridor.
function corridorImpulse(ctx, seconds, decay) {
  const length = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
  }
  return buffer;
}

export function createAudio() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  const ctx = new Context();

  const master = ctx.createGain();
  master.gain.value = MASTER_LEVEL;
  master.connect(ctx.destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = corridorImpulse(ctx, 2.6, 2.4);
  const wet = ctx.createGain();
  wet.gain.value = 0.3;
  reverb.connect(wet);
  wet.connect(master);

  // Fluorescent hum. Taiwan's mains run at 60 Hz, so the hum sits on 60 / 120 / 180 Hz.
  const hum = ctx.createGain();
  hum.gain.value = 0.035;
  const humFilter = ctx.createBiquadFilter();
  humFilter.type = 'lowpass';
  humFilter.frequency.value = 900;
  hum.connect(humFilter);
  humFilter.connect(master);
  for (const [frequency, type, level] of [
    [60, 'sawtooth', 0.6],
    [120, 'sine', 0.35],
    [180, 'sine', 0.15],
  ]) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.value = level;
    osc.connect(gain);
    gain.connect(hum);
    osc.start();
  }

  const noise = noiseBuffer(ctx, 1);

  function step(at, soft) {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = soft ? 480 : 1700 + Math.random() * 500; // terrazzo clicks, slippers shuffle
    band.Q.value = soft ? 0.7 : 1.3;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(soft ? 0.25 : 0.6, at + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, at + (soft ? 0.25 : 0.09));
    source.connect(band);
    band.connect(env);
    env.connect(master);
    env.connect(reverb);
    source.start(at, Math.random() * 0.6, 0.3);
  }

  function chime(at, frequency) {
    for (const [ratio, level, decay] of [
      [1, 0.5, 2.8],
      [2, 0.25, 1.8],
      [2.4, 0.12, 1.2],
      [3, 0.1, 1],
      [4.2, 0.05, 0.6],
    ]) {
      const osc = ctx.createOscillator();
      osc.frequency.value = frequency * ratio;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(level * 0.3, at + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      osc.connect(env);
      env.connect(master);
      env.connect(reverb);
      osc.start(at);
      osc.stop(at + decay + 0.1);
    }
  }

  const resume = () => (ctx.state === 'suspended' ? ctx.resume() : undefined);
  const G3 = 196;
  const C4 = 261.63;
  const D4 = 293.66;
  const E4 = 329.63;

  return {
    footsteps(count = 3, soft = false) {
      resume();
      const start = ctx.currentTime + 0.05;
      for (let i = 0; i < count; i++) step(start + i * 0.42 + Math.random() * 0.04, soft);
    },
    // The school bell: two phrases of the Westminster quarters.
    bell() {
      resume();
      const start = ctx.currentTime + 0.1;
      [E4, C4, D4, G3, G3, D4, E4, C4].forEach((f, i) => chime(start + i * 0.75 + (i >= 4 ? 0.6 : 0), f));
    },
    silence(on) {
      master.gain.setTargetAtTime(on ? 0.0001 : MASTER_LEVEL, ctx.currentTime, 0.4);
    },
    echo(level) {
      wet.gain.setTargetAtTime(level, ctx.currentTime, 0.5);
    },
  };
}
