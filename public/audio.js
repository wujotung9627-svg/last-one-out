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

  // A hard corridor gives a short slap-back echo off the opposite wall.
  const slap = ctx.createDelay(0.5);
  slap.delayTime.value = 0.045;
  const slapTone = ctx.createBiquadFilter();
  slapTone.type = 'lowpass';
  slapTone.frequency.value = 2400;
  const slapBack = ctx.createGain();
  slapBack.gain.value = 0.3;
  slap.connect(slapTone);
  slapTone.connect(slapBack);
  slapBack.connect(slap);
  slapTone.connect(master);

  // Somewhere in space: with headphones the position is clear.
  function placed(x, y, z) {
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.positionX.value = x;
    panner.positionY.value = y;
    panner.positionZ.value = z;
    panner.connect(master);
    panner.connect(reverb);
    return panner;
  }

  function burst(at, { type = 'bandpass', freq, q = 1, peak, decay, out, attack = 0.003 }) {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + attack);
    env.gain.exponentialRampToValueAtTime(0.0005, at + decay);
    source.connect(filter);
    filter.connect(env);
    env.connect(out);
    source.start(at, Math.random() * 0.6, decay + 0.05);
  }

  // One footstep on terrazzo in hard school shoes: the heel lands (a low thud and a
  // sharp click), the sole rolls (a soft scuff), the toe lifts (a small tick).
  function step(at, from = null, level = 1) {
    const out = from ? placed(from.x, -1.4, from.z) : ctx.createGain();
    if (!from) {
      out.connect(master);
      out.connect(reverb);
      out.connect(slap);
    }
    const v = level * (0.8 + Math.random() * 0.4);
    const thud = ctx.createOscillator();
    thud.frequency.setValueAtTime(140 + Math.random() * 30, at);
    thud.frequency.exponentialRampToValueAtTime(55, at + 0.07);
    const thudEnv = ctx.createGain();
    thudEnv.gain.setValueAtTime(0, at);
    thudEnv.gain.linearRampToValueAtTime(0.55 * v, at + 0.004);
    thudEnv.gain.exponentialRampToValueAtTime(0.0005, at + 0.11);
    thud.connect(thudEnv);
    thudEnv.connect(out);
    thud.start(at);
    thud.stop(at + 0.15);
    burst(at, { type: 'highpass', freq: 1800, peak: 0.45 * v, decay: 0.035, out });
    burst(at + 0.02, { type: 'lowpass', freq: 700, peak: 0.12 * v, decay: 0.16, out, attack: 0.03 });
    burst(at + 0.07 + Math.random() * 0.03, { freq: 3200, q: 1.4, peak: 0.2 * v, decay: 0.03, out });
  }

  // A rubber ball dropped somewhere down the corridor: it bounces, lower and quicker,
  // then rolls towards you and stops.
  function ball() {
    const start = ctx.currentTime + 0.1;
    const side = Math.random() < 0.5 ? -1 : 1;
    const out = placed(side * 2.5, -1.2, -9);
    out.positionX.setValueAtTime(side * 2.5, start);
    out.positionZ.setValueAtTime(-9, start);
    out.positionX.linearRampToValueAtTime(side * 0.6, start + 4);
    out.positionZ.linearRampToValueAtTime(-1.2, start + 4);
    let t = start;
    let gap = 0.55;
    let level = 0.5;
    for (let i = 0; i < 7; i++) {
      const thud = ctx.createOscillator();
      thud.frequency.setValueAtTime(210, t);
      thud.frequency.exponentialRampToValueAtTime(110, t + 0.05);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(level, t + 0.003);
      env.gain.exponentialRampToValueAtTime(0.0005, t + 0.09);
      thud.connect(env);
      env.connect(out);
      thud.start(t);
      thud.stop(t + 0.12);
      burst(t, { freq: 900, q: 0.8, peak: level * 0.3, decay: 0.05, out });
      t += gap;
      gap *= 0.68;
      level *= 0.72;
    }
    // Rolling: a low rumble that wavers and fades.
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 380;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.16, t + 0.2);
    env.gain.linearRampToValueAtTime(0.0005, t + 2.6);
    source.connect(low);
    low.connect(env);
    env.connect(out);
    source.start(t);
    source.stop(t + 2.8);
  }

  // Chalk on a board: scratchy strokes with the odd squeak.
  function chalk(seconds = 1.2) {
    const start = ctx.currentTime + 0.02;
    const out = placed(0.4, 0.3, -2.5);
    let t = start;
    while (t < start + seconds) {
      const length = 0.06 + Math.random() * 0.14;
      burst(t, { freq: 3500 + Math.random() * 1500, q: 2, peak: 0.12, decay: length, out, attack: 0.01 });
      if (Math.random() < 0.18) {
        const squeak = ctx.createOscillator();
        squeak.frequency.setValueAtTime(1900 + Math.random() * 800, t);
        squeak.frequency.linearRampToValueAtTime(2300 + Math.random() * 600, t + length);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.025, t + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0005, t + length);
        squeak.connect(env);
        env.connect(out);
        squeak.start(t);
        squeak.stop(t + length + 0.02);
      }
      t += length + 0.03 + Math.random() * 0.08;
    }
  }

  // A wooden classroom door sliding on its metal track: rollers rumbling, the panel
  // rattling, then the thump when it reaches the end.
  function slideDoor() {
    const start = ctx.currentTime + 0.05;
    const out = placed(0.6, 0, -1.4);
    const rumble = ctx.createBufferSource();
    rumble.buffer = noise;
    rumble.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 260;
    const rumbleEnv = ctx.createGain();
    rumbleEnv.gain.setValueAtTime(0, start);
    rumbleEnv.gain.linearRampToValueAtTime(0.45, start + 0.12);
    for (let t = start + 0.12; t < start + 0.85; t += 0.06) rumbleEnv.gain.setValueAtTime(0.3 + Math.random() * 0.25, t);
    rumbleEnv.gain.linearRampToValueAtTime(0.0005, start + 0.9);
    rumble.connect(low);
    low.connect(rumbleEnv);
    rumbleEnv.connect(out);
    rumble.start(start);
    rumble.stop(start + 1);
    for (let t = start + 0.1; t < start + 0.85; t += 0.05 + Math.random() * 0.09) {
      burst(t, { freq: 1100 + Math.random() * 500, q: 3, peak: 0.08, decay: 0.03, out });
    }
    const thump = ctx.createOscillator();
    thump.frequency.setValueAtTime(110, start + 0.9);
    thump.frequency.exponentialRampToValueAtTime(50, start + 1.0);
    const thumpEnv = ctx.createGain();
    thumpEnv.gain.setValueAtTime(0, start + 0.9);
    thumpEnv.gain.linearRampToValueAtTime(0.6, start + 0.905);
    thumpEnv.gain.exponentialRampToValueAtTime(0.0005, start + 1.15);
    thump.connect(thumpEnv);
    thumpEnv.connect(out);
    thump.start(start + 0.9);
    thump.stop(start + 1.2);
    burst(start + 0.9, { type: 'highpass', freq: 1500, peak: 0.3, decay: 0.05, out });
  }

  // A hinged door: the latch clicks, then a slow, uneven creak.
  function creak() {
    const start = ctx.currentTime + 0.05;
    const out = placed(1.2, 0, -1);
    burst(start, { type: 'highpass', freq: 2500, peak: 0.35, decay: 0.03, out });
    const voice = ctx.createOscillator();
    voice.type = 'sawtooth';
    voice.frequency.setValueAtTime(170, start + 0.1);
    for (let t = start + 0.1; t < start + 1.4; t += 0.07) voice.frequency.setValueAtTime(150 + Math.random() * 170, t);
    const body = ctx.createBiquadFilter();
    body.type = 'bandpass';
    body.frequency.value = 950;
    body.Q.value = 4;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, start + 0.1);
    env.gain.linearRampToValueAtTime(0.05, start + 0.35);
    env.gain.linearRampToValueAtTime(0.03, start + 1.1);
    env.gain.exponentialRampToValueAtTime(0.0005, start + 1.5);
    voice.connect(body);
    body.connect(env);
    env.connect(out);
    voice.start(start + 0.1);
    voice.stop(start + 1.55);
  }

  // A drop of water falling into the bucket or a puddle.
  function drip() {
    const at = ctx.currentTime + 0.02;
    const out = placed((Math.random() - 0.5) * 4, -1.5, -3 - Math.random() * 4);
    const plink = ctx.createOscillator();
    plink.frequency.setValueAtTime(1400 + Math.random() * 400, at);
    plink.frequency.exponentialRampToValueAtTime(500, at + 0.05);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.12, at + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0005, at + 0.12);
    plink.connect(env);
    env.connect(out);
    plink.start(at);
    plink.stop(at + 0.15);
  }

  // A chair dragged across the floor somewhere in the room.
  function chair() {
    const start = ctx.currentTime + 0.05;
    const out = placed((Math.random() - 0.5) * 6, -1, -3);
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 9;
    band.frequency.setValueAtTime(420, start);
    band.frequency.linearRampToValueAtTime(820, start + 0.55);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, start);
    for (let t = start; t < start + 0.6; t += 0.03) env.gain.setValueAtTime(0.25 + Math.random() * 0.35, t);
    env.gain.linearRampToValueAtTime(0.0005, start + 0.65);
    source.connect(band);
    band.connect(env);
    env.connect(out);
    source.start(start);
    source.stop(start + 0.7);
  }

  // Sheets of paper being turned and shuffled.
  function papers() {
    const start = ctx.currentTime + 0.05;
    const out = placed(-0.8, 0, -2);
    for (let t = start; t < start + 1.3; t += 0.08 + Math.random() * 0.2) {
      burst(t, { type: 'highpass', freq: 2500 + Math.random() * 2000, peak: 0.1 + Math.random() * 0.08, decay: 0.06 + Math.random() * 0.1, out, attack: 0.02 });
    }
  }

  // The school speaker: a crackle, the two-tone chime before an announcement, and
  // then nobody speaks.
  function speaker() {
    const start = ctx.currentTime + 0.1;
    const out = placed(0, 2.5, -2);
    const hiss = ctx.createBufferSource();
    hiss.buffer = noise;
    hiss.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2000;
    band.Q.value = 0.7;
    const hissEnv = ctx.createGain();
    hissEnv.gain.setValueAtTime(0, start);
    hissEnv.gain.linearRampToValueAtTime(0.03, start + 0.2);
    hissEnv.gain.setValueAtTime(0.03, start + 4.5);
    hissEnv.gain.linearRampToValueAtTime(0.0005, start + 5);
    hiss.connect(band);
    band.connect(hissEnv);
    hissEnv.connect(out);
    hiss.start(start);
    hiss.stop(start + 5.1);
    [659.25, 523.25].forEach((frequency, i) => {
      const at = start + 0.4 + i * 0.6;
      const tone = ctx.createOscillator();
      tone.frequency.value = frequency;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(0.12, at + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0005, at + 1.6);
      tone.connect(env);
      env.connect(out);
      tone.start(at);
      tone.stop(at + 1.7);
    });
  }

  // Children playing somewhere outside, muffled by walls and distance: voice-like
  // formants rising and falling in syllables, never clear enough to be words.
  function murmur(seconds = 4) {
    const start = ctx.currentTime + 0.05;
    const side = Math.random() < 0.5 ? -1 : 1;
    const wall = ctx.createBiquadFilter();
    wall.type = 'lowpass';
    wall.frequency.value = 1400;
    const out = placed(side * 6, 0, -6);
    wall.connect(out);
    for (let v = 0; v < 6; v++) {
      const source = ctx.createBufferSource();
      source.buffer = noise;
      source.loop = true;
      const formant = ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.value = 600 + Math.random() * 1600;
      formant.Q.value = 7;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, start);
      let t = start + Math.random() * 0.6;
      while (t < start + seconds) {
        const syllable = 0.08 + Math.random() * 0.14;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.5 + Math.random() * 0.6, t + syllable * 0.4);
        env.gain.linearRampToValueAtTime(0, t + syllable);
        formant.frequency.setValueAtTime(600 + Math.random() * 1800, t);
        t += syllable + (Math.random() < 0.15 ? 0.4 : 0.03);
      }
      source.connect(formant);
      formant.connect(env);
      env.connect(wall);
      source.start(start);
      source.stop(start + seconds + 0.2);
    }
  }

  // A short electrical crackle and dip in the hum, for a flickering tube.
  function crackle() {
    const at = ctx.currentTime + 0.01;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 2500;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.06, at);
    env.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
    source.connect(high);
    high.connect(env);
    env.connect(master);
    source.start(at, Math.random() * 0.6, 0.2);
    hum.gain.setValueAtTime(0.01, at);
    hum.gain.linearRampToValueAtTime(0.035, at + 0.3);
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
    // follow: after you stop, one more step sounds somewhere behind you.
    footsteps(count = 3, follow = false) {
      resume();
      const start = ctx.currentTime + 0.05;
      for (let i = 0; i < count; i++) step(start + i * 0.5 + Math.random() * 0.05);
      if (follow) step(start + count * 0.5 + 0.6, { x: (Math.random() - 0.5) * 1.2, z: 2.4 }, 0.7);
    },
    flicker() {
      resume();
      crackle();
    },
    ball() {
      resume();
      ball();
    },
    chalk(seconds) {
      resume();
      chalk(seconds);
    },
    murmur(seconds) {
      resume();
      murmur(seconds);
    },
    slideDoor() {
      resume();
      slideDoor();
    },
    creak() {
      resume();
      creak();
    },
    drip() {
      resume();
      drip();
    },
    chair() {
      resume();
      chair();
    },
    papers() {
      resume();
      papers();
    },
    speaker() {
      resume();
      speaker();
    },
    // Two strokes of a felt eraser on a chalkboard.
    erase() {
      resume();
      const at = ctx.currentTime + 0.02;
      for (let k = 0; k < 2; k++) {
        const t0 = at + k * 0.32;
        const source = ctx.createBufferSource();
        source.buffer = noise;
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 900 + k * 300;
        band.Q.value = 0.8;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, t0);
        env.gain.linearRampToValueAtTime(0.18, t0 + 0.08);
        env.gain.linearRampToValueAtTime(0.12, t0 + 0.18);
        env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
        source.connect(band);
        band.connect(env);
        env.connect(master);
        env.connect(reverb);
        source.start(t0, Math.random() * 0.5, 0.35);
      }
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
