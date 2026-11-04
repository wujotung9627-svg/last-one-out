// Voices: the school speaker talks with a voice that lives on this device (so the
// player's name never leaves it), and the microphone hears the player answer.

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Muse Voice Transcribe takes WAV, mono, 16-bit PCM at 16 kHz.
export async function toWav(blob) {
  const decoder = new AudioContext();
  let decoded;
  try {
    decoded = await decoder.decodeAudioData(await blob.arrayBuffer());
  } finally {
    decoder.close();
  }
  const rate = 16000;
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const pcm = (await offline.startRendering()).getChannelData(0);
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const text = (at, s) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  return new Blob([buffer], { type: 'audio/wav' });
}

export function createVoice() {
  const synth = window.speechSynthesis;
  let voices = [];
  const load = () => {
    voices = synth?.getVoices() ?? [];
  };
  load();
  synth?.addEventListener?.('voiceschanged', load);

  const canRecord = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  let micAllowed = canRecord;
  let dictation = null;

  // Only voices that run on this device: an online voice would send the name away.
  function pick(lang) {
    const want = lang === 'zh' ? /^zh[-_](TW|Hant)/i : /^en[-_](US|GB|AU|IE)/i;
    const local = voices.filter((v) => v.localService && want.test(v.lang));
    const fallback = lang === 'zh' ? voices.filter((v) => v.localService && /^zh/i.test(v.lang)) : [];
    const pool = local.length ? local : fallback;
    // Only used when a line has no recording in sounds/ (the speaker plays those).
    const preferred = lang === 'zh' ? [/Meijia|美佳/, /^Grandpa/] : [/Daniel|Samantha|Karen|Moira|Serena/];
    for (const like of preferred) {
      const found = pool.find((v) => like.test(v.name));
      if (found) return found;
    }
    return pool[0] ?? null;
  }

  async function open() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    micAllowed = true;
    return stream;
  }

  return {
    canRecord,

    // Asked once at the start, so the permission prompt never appears mid-scare.
    async warmUp() {
      if (!canRecord) return;
      try {
        (await open()).getTracks().forEach((track) => track.stop());
      } catch {
        micAllowed = false;
      }
    },

    // Resolves when the line has been spoken (or would have been). false = no local voice.
    async speak(text, lang, { louder = false, slow = false } = {}) {
      const voice = synth && pick(lang);
      if (!voice) {
        await pause(900 + [...text].length * 90);
        return false;
      }
      synth.cancel();
      const line = new SpeechSynthesisUtterance(text);
      line.voice = voice;
      line.lang = voice.lang;
      const old = /^Grandpa/.test(voice.name); // already low; lowering it more sounds broken
      line.rate = (lang === 'zh' ? 0.8 : 0.82) * (slow ? 0.8 : 1);
      line.pitch = (old ? 0.95 : 0.75) * (slow ? 0.85 : 1);
      line.volume = louder ? 1 : 0.8;
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 2500 + [...text].length * 350);
        line.onend = line.onerror = () => {
          clearTimeout(timer);
          resolve();
        };
        synth.speak(line);
      });
      return true;
    },

    // Listens for up to ms. Speech = a few loud frames above the room's own noise.
    // { heard, recording } where recording is a WAV of the answer when asked for.
    listen({ ms = 9000, record = false } = {}) {
      let cancelled = false;
      const result = (async () => {
        let stream;
        try {
          if (!micAllowed) throw new Error('no microphone');
          stream = await open();
        } catch {
          const until = performance.now() + ms;
          while (!cancelled && performance.now() < until) await pause(100);
          return { heard: false, recording: null };
        }
        const ctx = new AudioContext();
        await ctx.resume().catch(() => {});
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        const chunks = [];
        const recorder = record ? new MediaRecorder(stream) : null;
        if (recorder) {
          recorder.ondataavailable = (event) => chunks.push(event.data);
          recorder.start();
        }
        const started = performance.now();
        let floor = 0;
        let loud = 0;
        let heardAt = null;
        while (true) {
          await pause(50);
          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (const v of samples) sum += v * v;
          const rms = Math.sqrt(sum / samples.length);
          const now = performance.now() - started;
          if (now < 450) {
            floor = Math.max(floor, rms);
            continue;
          }
          if (heardAt === null) {
            loud = rms > Math.max(0.02, floor * 3) ? loud + 1 : 0;
            if (loud >= 3) heardAt = now;
          }
          if (cancelled || now > ms || (heardAt !== null && now - heardAt > 1100)) break;
        }
        let recording = null;
        if (recorder && recorder.state === 'recording') {
          await new Promise((resolve) => {
            recorder.onstop = resolve;
            recorder.stop();
          });
          if (heardAt !== null && !cancelled) recording = await toWav(new Blob(chunks, { type: recorder.mimeType })).catch(() => null);
        }
        stream.getTracks().forEach((track) => track.stop());
        ctx.close();
        return { heard: heardAt !== null, recording };
      })();
      return {
        result,
        cancel() {
          cancelled = true;
        },
      };
    },

    // Records until stopDictation() or maxMs, then returns a WAV.
    async dictate({ maxMs = 15000 } = {}) {
      const stream = await open();
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      const stopped = new Promise((resolve) => {
        recorder.onstop = resolve;
      });
      dictation = recorder;
      recorder.start();
      const timer = setTimeout(() => recorder.state === 'recording' && recorder.stop(), maxMs);
      await stopped;
      clearTimeout(timer);
      dictation = null;
      stream.getTracks().forEach((track) => track.stop());
      return toWav(new Blob(chunks, { type: recorder.mimeType }));
    },

    stopDictation() {
      if (dictation?.state === 'recording') dictation.stop();
    },
  };
}
