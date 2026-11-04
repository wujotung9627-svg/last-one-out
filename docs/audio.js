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

// Seconds into sounds/basketball.mp3 where the first bounce lands.
const BALL_FIRST_HIT = 0.1;

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
    if (stepSample(at, from, level)) return; // the recorded footsteps, when loaded
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

  // A basketball: each bounce is a deep thump, the ring of the air inside and the slap of
  // leather; then it rolls, a low rumble that beats with each turn of its seams.
  // path: [{ t, x, z, speed }] in seconds and metres from you; contacts: bounce times.
  function basketball({ path, contacts }) {
    const start = ctx.currentTime + 0.05;
    const out = placed(path[0].x, -1.2, -path[0].z);
    // A real recording, when there is one: it travels with the ball, and the corridor
    // answers it (its long reverb plus a slap off the far wall).
    if (samples.basketball) {
      const end = path[path.length - 1].t;
      const curve = (pick) => new Float32Array(path.map(pick));
      out.positionX.setValueCurveAtTime(curve((p) => p.x), start, end);
      out.positionZ.setValueCurveAtTime(curve((p) => -p.z), start, end);
      const echo = ctx.createDelay(1);
      echo.delayTime.value = 0.11;
      const echoLevel = ctx.createGain();
      echoLevel.gain.value = 0.35;
      const extraWet = ctx.createGain();
      extraWet.gain.value = 0.9;
      const source = ctx.createBufferSource();
      source.buffer = samples.basketball;
      // Line the recording's first bounce up with the first one on screen.
      const first = BALL_FIRST_HIT;
      const level = ctx.createGain();
      level.gain.value = 1.4;
      source.connect(level);
      level.connect(out);
      level.connect(echo);
      echo.connect(echoLevel);
      echoLevel.connect(placed(0, -1, -16));
      level.connect(extraWet);
      extraWet.connect(reverb);
      source.start(start + Math.max(0, (contacts[0] ?? 0.1) - first), Math.max(0, first - (contacts[0] ?? 0.1)));
      return;
    }
    const times = path.map((p) => p.t);
    const end = times[times.length - 1];
    const curve = (pick) => new Float32Array(path.map(pick));
    out.positionX.setValueCurveAtTime(curve((p) => p.x), start, end);
    out.positionZ.setValueCurveAtTime(curve((p) => -p.z), start, end);
    contacts.forEach((at, i) => {
      const t = start + at;
      const level = 0.55 * Math.pow(0.7, i);
      const thump = ctx.createOscillator();
      thump.frequency.setValueAtTime(140, t);
      thump.frequency.exponentialRampToValueAtTime(68, t + 0.07);
      const thumpEnv = ctx.createGain();
      thumpEnv.gain.setValueAtTime(0, t);
      thumpEnv.gain.linearRampToValueAtTime(level, t + 0.002);
      thumpEnv.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
      thump.connect(thumpEnv);
      thumpEnv.connect(out);
      thump.start(t);
      thump.stop(t + 0.2);
      const ring = ctx.createOscillator();
      ring.frequency.setValueAtTime(560, t);
      ring.frequency.exponentialRampToValueAtTime(500, t + 0.2);
      const ringEnv = ctx.createGain();
      ringEnv.gain.setValueAtTime(0, t);
      ringEnv.gain.linearRampToValueAtTime(level * 0.16, t + 0.004);
      ringEnv.gain.exponentialRampToValueAtTime(0.0005, t + 0.22);
      ring.connect(ringEnv);
      ringEnv.connect(out);
      ring.start(t);
      ring.stop(t + 0.25);
      burst(t, { type: 'highpass', freq: 2600, q: 0.7, peak: level * 0.35, decay: 0.03, out });
    });
    // Rolling: the rumble beats once per turn (0.24 m across: one turn per 0.75 m).
    const rollFrom = start + (contacts[contacts.length - 1] ?? 0) + 0.08;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 260;
    band.Q.value = 0.9;
    const beat = ctx.createGain();
    beat.gain.value = 0.55;
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    depth.gain.value = 0.45;
    lfo.connect(depth);
    depth.connect(beat.gain);
    lfo.frequency.setValueCurveAtTime(curve((p) => Math.max(0.05, p.speed / 0.754)), start, end);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.setValueAtTime(0, rollFrom);
    env.gain.linearRampToValueAtTime(0.22, rollFrom + 0.3);
    env.gain.setValueAtTime(0.22, start + end * 0.7);
    env.gain.linearRampToValueAtTime(0.0005, start + end);
    source.connect(band);
    band.connect(beat);
    beat.connect(env);
    env.connect(out);
    source.start(start);
    lfo.start(start);
    source.stop(start + end + 0.1);
    lfo.stop(start + end + 0.1);
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

  // A drop of water: a tiny click as it lands, then the ring of the little bubble it
  // makes, its pitch rising fast (that rise is what makes it sound wet), in the echo.
  // With the recording: one real drop from it, cut at its onset, in place.
  function drip(gain = 0.22, pos = null) {
    const where = pos ?? { x: (Math.random() - 0.5) * 4, y: -1.5, z: -2.5 - Math.random() * 3 };
    if (dripSlices.length) {
      const [offset, length] = dripSlices[Math.floor(Math.random() * dripSlices.length)];
      if (playSample('drip', { offset, duration: length, gain: gain * 2.4, rate: 0.94 + Math.random() * 0.12, pos: where })) return;
    }
    const at = ctx.currentTime + 0.02;
    const out = placed(where.x, where.y, where.z);
    burst(at, { type: 'highpass', freq: 2500, q: 0.7, peak: gain * 0.25, decay: 0.006, out });
    const f0 = 650 + Math.random() * 500;
    const ring = ctx.createOscillator();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(f0, at + 0.004);
    ring.frequency.exponentialRampToValueAtTime(f0 * (2 + Math.random() * 0.6), at + 0.06);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at + 0.004);
    env.gain.linearRampToValueAtTime(gain, at + 0.008);
    env.gain.exponentialRampToValueAtTime(gain * 0.25, at + 0.035);
    env.gain.exponentialRampToValueAtTime(0.0003, at + 0.11);
    ring.connect(env);
    env.connect(out);
    ring.start(at);
    ring.stop(at + 0.13);
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

  // A child's voice: glottal pulses (a sawtooth at a child's pitch) through two mouth
  // formants. Used for giggles; kept far away and muffled, never clear.
  function childVoice(at, length, pitch, out, level) {
    const glottis = ctx.createOscillator();
    glottis.type = 'sawtooth';
    glottis.frequency.setValueAtTime(pitch * 1.08, at);
    glottis.frequency.exponentialRampToValueAtTime(pitch * 0.92, at + length);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level, at + length * 0.25);
    env.gain.exponentialRampToValueAtTime(0.0005, at + length);
    for (const [frequency, q, gain] of [
      [850, 6, 1],
      [1900, 8, 0.6],
    ]) {
      const formant = ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.value = frequency * (0.95 + Math.random() * 0.1);
      formant.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      glottis.connect(formant);
      formant.connect(g);
      g.connect(env);
    }
    env.connect(out);
    glottis.start(at);
    glottis.stop(at + length + 0.05);
    burst(at, { freq: 3000, q: 1, peak: level * 0.15, decay: length, out, attack: length * 0.3 }); // breath
  }

  // A giggle somewhere out of sight: a few quick "hee-hee" pulses, sometimes two children.
  function giggle() {
    const start = ctx.currentTime + 0.05;
    const side = Math.random() < 0.5 ? -1 : 1;
    const wall = ctx.createBiquadFilter();
    wall.type = 'lowpass';
    wall.frequency.value = 2200;
    const out = placed(side * (2 + Math.random() * 3), 0.2, -3 - Math.random() * 5);
    wall.connect(out);
    const voices = Math.random() < 0.5 ? 2 : 1;
    for (let v = 0; v < voices; v++) {
      let t = start + v * (0.25 + Math.random() * 0.3);
      const pitch = 330 + Math.random() * 120;
      const pulses = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < pulses; i++) {
        childVoice(t, 0.07 + Math.random() * 0.04, pitch * (1 - i * 0.03), wall, 0.22);
        t += 0.11 + Math.random() * 0.04;
      }
    }
  }

  // Small feet running past in indoor shoes: quick, soft steps that come from one side
  // and pass behind you to the other, with a giggle at the end.
  function runPast() {
    const start = ctx.currentTime + 0.05;
    const side = Math.random() < 0.5 ? -1 : 1;
    const out = placed(side * -5, -1.4, 1.5);
    out.positionX.setValueAtTime(side * -5, start);
    out.positionX.linearRampToValueAtTime(side * 5, start + 2.4);
    out.positionZ.setValueAtTime(1.5, start);
    out.positionZ.linearRampToValueAtTime(-2.5, start + 2.4);
    let t = start;
    for (let i = 0; i < 10; i++) {
      const v = 0.5 + Math.random() * 0.3;
      burst(t, { type: 'lowpass', freq: 500, peak: 0.35 * v, decay: 0.06, out });
      burst(t + 0.01, { freq: 2600, q: 2, peak: 0.12 * v, decay: 0.03, out });
      if (Math.random() < 0.25) {
        const squeak = ctx.createOscillator(); // rubber soles on a wet floor
        squeak.frequency.setValueAtTime(2400 + Math.random() * 600, t + 0.02);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, t + 0.02);
        env.gain.linearRampToValueAtTime(0.03, t + 0.03);
        env.gain.exponentialRampToValueAtTime(0.0005, t + 0.09);
        squeak.connect(env);
        env.connect(out);
        squeak.start(t + 0.02);
        squeak.stop(t + 0.1);
      }
      t += 0.2 + Math.random() * 0.06;
    }
    setTimeout(giggle, 2600);
  }

  // A Taiwanese night outside the open corridor: crickets, the odd frog, and now and
  // then a scooter going past far away. Quieter once you are inside the classroom.
  const night = ctx.createGain();
  night.gain.value = 0;
  night.connect(master);
  let nightTimer = null;
  let tap = null; // where the leaking tap is, and how loud
  let dripSlices = []; // the single drops in the recording: [start, length] in seconds

  function cricket(at, x, z) {
    const out = placed(x, -1, z);
    out.disconnect();
    out.connect(night);
    for (let p = 0; p < 3; p++) {
      const t = at + p * 0.035;
      const chirp = ctx.createOscillator();
      chirp.frequency.value = 4300 + Math.random() * 300;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.05, t + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0005, t + 0.022);
      chirp.connect(env);
      env.connect(out);
      chirp.start(t);
      chirp.stop(t + 0.03);
    }
  }

  function frog(at) {
    const out = placed(-4 + Math.random() * 8, -2, -8);
    out.disconnect();
    out.connect(night);
    for (let k = 0; k < 3; k++) {
      const t = at + k * 0.28;
      const croak = ctx.createOscillator();
      croak.type = 'sawtooth';
      croak.frequency.setValueAtTime(140, t);
      croak.frequency.linearRampToValueAtTime(110, t + 0.16);
      const throat = ctx.createBiquadFilter();
      throat.type = 'lowpass';
      throat.frequency.value = 600;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.06, t + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0005, t + 0.18);
      croak.connect(throat);
      throat.connect(env);
      env.connect(out);
      croak.start(t);
      croak.stop(t + 0.2);
    }
  }

  function scooter(at) {
    const out = placed(-30, 0, -40);
    out.disconnect();
    out.connect(night);
    out.positionX.setValueAtTime(-30, at);
    out.positionX.linearRampToValueAtTime(30, at + 6);
    const engine = ctx.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.setValueAtTime(70, at);
    engine.frequency.linearRampToValueAtTime(95, at + 2.5);
    engine.frequency.linearRampToValueAtTime(75, at + 6);
    const muffle = ctx.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = 400;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.08, at + 2.5);
    env.gain.linearRampToValueAtTime(0.0005, at + 6);
    engine.connect(muffle);
    muffle.connect(env);
    env.connect(out);
    engine.start(at);
    engine.stop(at + 6.1);
  }

  function nightTick() {
    const now = ctx.currentTime;
    const insects = [
      [-4, -3],
      [3, -6],
      [-6, -9],
    ];
    for (const [x, z] of insects) {
      if (Math.random() < 0.7) cricket(now + Math.random() * 0.9, x, z);
    }
    if (Math.random() < 0.06) frog(now + Math.random());
    if (tap && Math.random() < 0.55) setTimeout(() => drip(tap.gain * (0.8 + Math.random() * 0.4), tap.pos), Math.random() * 900);
    if (Math.random() < 0.012) scooter(now + 0.2);
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

  // ---------- recorded sounds (CC0, listed in sounds/SOURCES.md) ----------
  // Every recorded sound has a synthesised fallback above, used until (or unless)
  // the file loads.

  const samples = {};
  let stepSlices = [];
  let quickSlices = [];

  async function loadSample(name, file) {
    try {
      const res = await fetch(`sounds/${file}`);
      if (res.ok) samples[name] = await ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      // keep the synthesised version
    }
  }

  // Finds each footstep in a recording: the moments the loudness jumps.
  function onsets(buffer, { minGap = 0.28, threshold = 2.2 } = {}) {
    const data = buffer.getChannelData(0);
    const hop = Math.floor(buffer.sampleRate * 0.01);
    const energy = [];
    for (let i = 0; i + hop < data.length; i += hop) {
      let sum = 0;
      for (let j = i; j < i + hop; j++) sum += data[j] * data[j];
      energy.push(Math.sqrt(sum / hop));
    }
    const mean = energy.reduce((a, b) => a + b, 0) / Math.max(1, energy.length);
    const found = [];
    let last = -Infinity;
    for (let k = 1; k < energy.length; k++) {
      const t = k * 0.01;
      if (energy[k] > mean * threshold && energy[k] > energy[k - 1] * 1.5 && t - last > minGap) {
        found.push(Math.max(0, t - 0.015));
        last = t;
      }
    }
    return found;
  }

  const ready = Promise.all([
    loadSample('steps', 'footsteps-tile.mp3'),
    loadSample('quick', 'steps-quick.mp3'),
    loadSample('laugh', 'children-laughing.mp3'),
    loadSample('recess', 'recess.mp3'),
    loadSample('hushed', 'hushed.mp3'),
    loadSample('slide', 'sliding-door.mp3'),
    loadSample('slam', 'sliding-door-slam.mp3'),
    loadSample('rattle', 'door-rattle.mp3'),
    loadSample('squeak', 'door-squeak.mp3'),
    loadSample('chair', 'wooden-chair.mp3'),
    loadSample('chimes', 'chimes.mp3'),
    loadSample('basketball', 'basketball.mp3'), // optional; synthesised if missing
    loadSample('drip', 'water-drip.mp3'),
  ]).then(() => {
    if (samples.drip) {
      // Each drop runs until just before the next one, at most a second (its echo).
      const starts = onsets(samples.drip, { minGap: 0.2, threshold: 3 });
      dripSlices = starts.map((t, i) => [t, Math.min(1, (starts[i + 1] ?? samples.drip.duration) - t - 0.02)]).filter(([, d]) => d > 0.15);
    }
    if (samples.steps) stepSlices = onsets(samples.steps);
    if (samples.quick) quickSlices = onsets(samples.quick, { minGap: 0.14 });
  });

  // ---------- the school loudspeaker ----------
  // A real voice through an old horn speaker high up in the corridor: telephone band,
  // a little breakup, mains hum and hiss under it, and the corridor answering back.
  function loudspeaker(buffer, { rate = 1, gain = 1 } = {}) {
    const at = ctx.currentTime + 0.05;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const low = ctx.createBiquadFilter();
    low.type = 'highpass';
    low.frequency.value = 420;
    const high = ctx.createBiquadFilter();
    high.type = 'lowpass';
    high.frequency.value = 3000;
    const horn = ctx.createBiquadFilter(); // the horn's nasal peak
    horn.type = 'peaking';
    horn.frequency.value = 1500;
    horn.Q.value = 1.4;
    horn.gain.value = 7;
    const drive = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 3.2) / Math.tanh(3.2);
    }
    drive.curve = curve;
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -26;
    squash.ratio.value = 8;
    const level = ctx.createGain();
    level.gain.value = 0.9 * gain;
    source.connect(low);
    low.connect(high);
    high.connect(horn);
    horn.connect(drive);
    drive.connect(squash);
    squash.connect(level);
    const out = placed(0, 2.4, -3); // up on the wall, ahead of you
    level.connect(out);
    // The far speakers down the corridor say it a moment later.
    const far = ctx.createDelay(1);
    far.delayTime.value = 0.19;
    const farLevel = ctx.createGain();
    farLevel.gain.value = 0.32 * gain;
    level.connect(far);
    far.connect(farLevel);
    farLevel.connect(placed(0, 2.4, -14));
    const length = buffer.duration / rate;
    // Hiss and hum from the amplifier, there before the voice and after it.
    const hiss = ctx.createBufferSource();
    hiss.buffer = noise;
    hiss.loop = true;
    const hissBand = ctx.createBiquadFilter();
    hissBand.type = 'bandpass';
    hissBand.frequency.value = 2400;
    hissBand.Q.value = 0.6;
    const hissLevel = ctx.createGain();
    hissLevel.gain.setValueAtTime(0, at - 0.04);
    hissLevel.gain.linearRampToValueAtTime(0.035 * gain, at + 0.1);
    hissLevel.gain.setValueAtTime(0.035 * gain, at + length + 0.5);
    hissLevel.gain.linearRampToValueAtTime(0.0001, at + length + 0.9);
    hiss.connect(hissBand);
    hissBand.connect(hissLevel);
    hissLevel.connect(out);
    const mains = ctx.createOscillator();
    mains.type = 'sawtooth';
    mains.frequency.value = 60;
    const mainsLevel = ctx.createGain();
    mainsLevel.gain.setValueAtTime(0, at - 0.04);
    mainsLevel.gain.linearRampToValueAtTime(0.012 * gain, at + 0.1);
    mainsLevel.gain.setValueAtTime(0.012 * gain, at + length + 0.5);
    mainsLevel.gain.linearRampToValueAtTime(0.0001, at + length + 0.9);
    mains.connect(mainsLevel);
    mainsLevel.connect(high);
    source.start(at + 0.15);
    hiss.start(at - 0.04);
    mains.start(at - 0.04);
    hiss.stop(at + length + 1);
    mains.stop(at + length + 1);
    for (let k = 0; k < 4; k++) burst(at + 0.15 + Math.random() * length, { type: 'highpass', freq: 3000, peak: 0.05 * gain, decay: 0.03, out });
    return new Promise((resolve) => setTimeout(resolve, (length + 0.4) * 1000));
  }

  // Cuts the silence before and after a voice; null when there is no voice in it.
  function trimSilence(buffer) {
    const data = buffer.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
    if (peak < 0.02) return null;
    const threshold = peak * 0.1;
    let first = 0, last = data.length - 1;
    while (first < data.length && Math.abs(data[first]) < threshold) first++;
    while (last > first && Math.abs(data[last]) < threshold) last--;
    const pad = Math.floor(buffer.sampleRate * 0.08);
    first = Math.max(0, first - pad);
    last = Math.min(data.length - 1, last + pad * 2);
    const out = ctx.createBuffer(1, last - first + 1, buffer.sampleRate);
    const target = out.getChannelData(0);
    const gain = 0.8 / peak; // every name equally loud
    for (let i = first; i <= last; i++) target[i - first] = data[i] * gain;
    return out;
  }

  // A recorded voice in a file (sounds/), decoded once.
  const voices = {};
  async function voiceFile(file) {
    if (!(file in voices)) {
      voices[file] = fetch(`sounds/${file}`)
        .then((res) => (res.ok ? res.arrayBuffer() : null))
        .then((bytes) => (bytes ? ctx.decodeAudioData(bytes) : null))
        .catch(() => null);
    }
    return voices[file];
  }

  // Plays (part of) a recording. `into` sends it through a node the caller made
  // (a moving panner, a wall filter); `pos` places it in space; otherwise it plays
  // straight, with some of the corridor's reverb.
  function playSample(name, { at = ctx.currentTime + 0.02, offset = 0, duration, gain = 1, rate = 1, pos = null, into = null, filter = null } = {}) {
    const buffer = samples[name];
    if (!buffer) return false;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const level = ctx.createGain();
    level.gain.value = gain;
    source.connect(level);
    let out = level;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type;
      f.frequency.value = filter.freq;
      f.Q.value = filter.q ?? 0.8;
      level.connect(f);
      out = f;
    }
    if (into) out.connect(into);
    else if (pos) out.connect(placed(pos.x, pos.y, pos.z));
    else {
      out.connect(master);
      out.connect(reverb);
    }
    const safeOffset = Math.min(Math.max(0, offset), Math.max(0, buffer.duration - 0.05));
    source.start(at, safeOffset, duration);
    return true;
  }

  const randomOffset = (name, length) => Math.random() * Math.max(0, (samples[name]?.duration ?? 0) - length);

  function stepSample(at, from, level) {
    if (!stepSlices.length) return false;
    const offset = stepSlices[Math.floor(Math.random() * stepSlices.length)];
    return playSample('steps', {
      at,
      offset,
      duration: 0.42,
      gain: 1.1 * level,
      rate: 0.94 + Math.random() * 0.1,
      pos: from ? { x: from.x, y: -1.4, z: from.z } : null,
    });
  }

  // A heavy hit for a jump scare: a door slamming, a low boom, and a dissonant shriek.
  // A whole class slaps its desks at once: thirty-odd palms on wood within a few
  // milliseconds of each other, spread across the room in front of you.
  function deskSlap() {
    const at = ctx.currentTime + 0.02;
    for (let i = 0; i < 34; i++) {
      const t0 = at + Math.random() * 0.03;
      const out = placed((Math.random() - 0.5) * 7, -0.6, -1 - Math.random() * 5);
      burst(t0, { type: 'bandpass', freq: 1400 + Math.random() * 1600, q: 0.9, peak: 0.16, decay: 0.07, out });
      const body = ctx.createOscillator();
      body.frequency.setValueAtTime(150 + Math.random() * 90, t0);
      body.frequency.exponentialRampToValueAtTime(70, t0 + 0.12);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(0.11, t0 + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.18);
      body.connect(env);
      env.connect(out);
      body.start(t0);
      body.stop(t0 + 0.2);
    }
    const thump = ctx.createOscillator(); // the floor answers
    thump.frequency.setValueAtTime(58, at);
    thump.frequency.exponentialRampToValueAtTime(34, at + 0.35);
    const thumpEnv = ctx.createGain();
    thumpEnv.gain.setValueAtTime(0.7, at);
    thumpEnv.gain.exponentialRampToValueAtTime(0.0005, at + 0.5);
    thump.connect(thumpEnv);
    thumpEnv.connect(master);
    thump.start(at);
    thump.stop(at + 0.55);
  }

  function stinger() {
    const at = ctx.currentTime + 0.01;
    playSample('slam', { at, gain: 1.4 });
    const boom = ctx.createOscillator();
    boom.frequency.setValueAtTime(70, at);
    boom.frequency.exponentialRampToValueAtTime(32, at + 0.9);
    const boomEnv = ctx.createGain();
    boomEnv.gain.setValueAtTime(0.9, at);
    boomEnv.gain.exponentialRampToValueAtTime(0.0005, at + 1.4);
    boom.connect(boomEnv);
    boomEnv.connect(master);
    boom.start(at);
    boom.stop(at + 1.5);
    for (const frequency of [466, 494, 523, 1046]) {
      const shriek = ctx.createOscillator();
      shriek.type = 'sawtooth';
      shriek.frequency.setValueAtTime(frequency, at);
      shriek.frequency.linearRampToValueAtTime(frequency * 0.94, at + 1.2);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(0.05, at + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0005, at + 1.3);
      shriek.connect(env);
      env.connect(master);
      env.connect(reverb);
      shriek.start(at);
      shriek.stop(at + 1.35);
    }
    burst(at, { type: 'highpass', freq: 1200, peak: 0.5, decay: 0.4, out: master });
  }

  const resume = () => (ctx.state === 'suspended' ? ctx.resume() : undefined);
  const far = () => ({ x: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3), y: 0.2, z: -3 - Math.random() * 5 });
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
    ready,
    ball() {
      resume();
      ball();
    },
    basketball(run) {
      resume();
      basketball(run);
    },
    // When the recorded ball lands, so the ball on screen bounces with the sound.
    ballHits() {
      if (!samples.basketball) return null;
      const hits = onsets(samples.basketball, { minGap: 0.1, threshold: 2 });
      return hits.length ? hits.map((t) => t - hits[0] + BALL_FIRST_HIT) : null;
    },
    // A real voice on the school speaker. `voice` is an AudioBuffer, a WAV/WebM Blob, or a
    // file in sounds/. Resolves false when there is no such recording.
    async loudspeaker(voice, options) {
      resume();
      let buffer = null;
      if (voice instanceof AudioBuffer) buffer = voice;
      else if (voice instanceof Blob) buffer = await ctx.decodeAudioData(await voice.arrayBuffer()).catch(() => null);
      else if (typeof voice === 'string') buffer = await voiceFile(voice);
      if (!buffer) return false;
      if (typeof voice !== 'string') buffer = trimSilence(buffer); // your own recording
      if (!buffer) return false;
      await loudspeaker(buffer, options);
      return true;
    },
    chalk(seconds) {
      resume();
      chalk(seconds);
    },
    murmur(seconds = 4) {
      resume();
      const played = playSample('recess', { offset: randomOffset('recess', seconds), duration: seconds, gain: 0.55, filter: { type: 'lowpass', freq: 1300 }, pos: far() });
      if (!played) murmur(seconds);
    },
    // Children whispering right behind you.
    whisper() {
      resume();
      playSample('hushed', { offset: randomOffset('hushed', 3), duration: 3, gain: 0.85, pos: { x: Math.random() < 0.5 ? -0.7 : 0.7, y: 0, z: 1.1 } });
    },
    slam() {
      resume();
      playSample('slam', { gain: 1.2 });
    },
    // A locked door: the handle rattles and it will not open.
    rattle() {
      resume();
      if (!playSample('rattle', { duration: 1.6, gain: 0.9, pos: { x: 0.8, y: 0, z: -1.2 } })) burst(ctx.currentTime, { freq: 900, q: 2, peak: 0.3, decay: 0.3, out: master });
    },
    stinger() {
      resume();
      stinger();
    },
    slap() {
      resume();
      deskSlap();
    },
    slideDoor() {
      resume();
      if (!playSample('slide', { gain: 1, pos: { x: 0.6, y: 0, z: -1.4 } })) slideDoor();
    },
    giggle() {
      resume();
      const played = playSample('laugh', { offset: randomOffset('laugh', 3.5), duration: 2.4 + Math.random(), gain: 0.6, filter: { type: 'lowpass', freq: 2800 }, pos: far() });
      if (!played) giggle();
    },
    runPast() {
      resume();
      if (!quickSlices.length) return runPast();
      const start = ctx.currentTime + 0.05;
      const side = Math.random() < 0.5 ? -1 : 1;
      const out = placed(side * -5, -1.4, 1.5);
      out.positionX.setValueAtTime(side * -5, start);
      out.positionX.linearRampToValueAtTime(side * 5, start + 2.2);
      out.positionZ.setValueAtTime(1.5, start);
      out.positionZ.linearRampToValueAtTime(-2.5, start + 2.2);
      for (let i = 0; i < 9; i++) {
        const offset = quickSlices[Math.floor(Math.random() * quickSlices.length)];
        playSample('quick', { at: start + i * 0.22, offset, duration: 0.2, gain: 0.9, rate: 1.1 + Math.random() * 0.1, into: out });
      }
      setTimeout(() => playSample('laugh', { offset: randomOffset('laugh', 2), duration: 1.6, gain: 0.5, filter: { type: 'lowpass', freq: 2600 }, pos: far() }), 2400);
    },
    // outdoors: 'open' in the open-air corridor, 'inside' in the classroom, 'off' elsewhere.
    night(where) {
      resume();
      const level = where === 'open' ? 1 : where === 'inside' ? 0.3 : 0;
      // Only where there is a tap: the corridor's stone sink on the left drips.
      tap = where === 'open' ? { gain: 0.14, pos: { x: -2.2, y: -1, z: -2.5 } } : null;
      night.gain.setTargetAtTime(level, ctx.currentTime, 0.8);
      if (level > 0 && !nightTimer) nightTimer = setInterval(nightTick, 1000);
      if (level === 0 && nightTimer) {
        clearInterval(nightTimer);
        nightTimer = null;
      }
    },
    creak() {
      resume();
      if (!playSample('squeak', { duration: 2.2, gain: 0.9, pos: { x: 1.2, y: 0, z: -1 } })) creak();
    },
    drip(gain) {
      resume();
      drip(gain);
    },
    chair() {
      resume();
      const played = playSample('chair', { offset: randomOffset('chair', 1.6), duration: 1.6, gain: 0.9, pos: { x: (Math.random() - 0.5) * 6, y: -1, z: -3 } });
      if (!played) chair();
    },
    papers() {
      resume();
      papers();
    },
    // The school speaker's chime before an announcement.
    speaker() {
      resume();
      const played = playSample('chimes', { duration: 3.2, gain: 0.8, filter: { type: 'bandpass', freq: 1800, q: 0.6 }, pos: { x: 0, y: 2.5, z: -2 } });
      if (!played) speaker();
      else burst(ctx.currentTime, { freq: 2000, q: 0.7, peak: 0.04, decay: 3.5, out: master, attack: 0.2 }); // speaker hiss
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
