import { createAudio } from './audio.js';
import { drawContactBook } from './ending.js';
import { createWalker } from './walk3d.js';
import { createVoice } from './voice.js';

const $ = (selector) => document.querySelector(selector);
const STEP_MS = 1100; // flat fallback transition
const WALK_MS = 1500; // 3D walk into the next photo
const ARRIVE_MS = 1600;
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
const THIS_YEAR = new Date().getFullYear();
const CLASS_SIZE = 40;
const CREDIT_NAME = 'JO TUNG WU'; // the one person who made this

const LINES = {
  en: {
    remembering: 'Remembering your school…',
    paHome: 'School is over. All students, please leave the campus.',
    firstLine: "The others have gone home. The floor isn't finished.",
    pick: 'Draw one card. Something will change.',
    card: 'Card',
    changing: 'Something is changing…',
    walkOn: 'Walk back',
    bellWait: 'The bell rings.',
    ending: "You came back. It isn't the same anymore.",
    hide: 'Hide my name',
    download: 'Save the contact book',
    again: 'Go back again',
    home: 'Back to the start',
    forward: 'Walk through this door',
    locked: 'Locked.',
    lockedDoor: 'A locked door',
    throughDoor: 'Walk out through the door',
    alt_corridor: 'The school corridor at night',
    alt_door: 'A classroom door',
    alt_classroom: 'The empty classroom',
    alt_office: "The teachers' office",
    alt_daylight: 'The classroom in afternoon light',
    eraseHint: 'Three lines on the board. Erase two. Keep one.',
    eraseOneMore: 'One more.',
    wontErase: 'It will not come off.',
    officeLine: 'Your paper is on the desk.',
    tag: 'In Taiwan, the student on duty is the last one out.',
    nameLabel: 'Your name',
    nameHint: 'Stays on this device. It is never sent anywhere.',
    sayName: 'Say it',
    nameSaid: 'Heard ✓',
    nameTooQuiet: 'Nothing came through. Allow the microphone, come closer and say it again.',
    nameVoiceHint: 'Say your name once. At roll call the school speaker will call it in your own voice. The recording stays on this device.',
    paOffice: 'Student on duty, please come to the teachers’ office now.',
    yearLabel: 'The year you were on duty there',
    memoriesLabel: 'Three things you remember about your school',
    memory1: 'e.g. a banyan tree at the end of the corridor',
    memory2: 'e.g. the teacher who never said my name',
    memory3: 'e.g. the exam ranking pinned on the wall',
    speak: 'Speak',
    stop: 'Stop',
    speakLabel: 'Say this memory out loud',
    micFailed: 'The microphone did not work. Type it instead.',
    start: 'Start your duty',
    headphones: 'Wear headphones. Allow the microphone: you will be asked to answer.',
    dutyToday: 'ON DUTY TODAY  ',
    onDuty: 'On duty',
    otherPhoto: '(click it for the other one)',
    wayBack: 'Back to the corridor',
    wayOn: 'Walk on',
    rollCall: 'Answer when your name is called.',
    here: 'Here',
    wrongAnswer: 'That is not how you answer.',
    noName: 'student on duty',
    rank: 'Class ranking',
    skip: 'Click to skip',
    chips: [
      ['the banyan tree at the end of the corridor', 'the locked water tower on the roof', 'curtains drawn for the noon nap', 'the drinking fountain by the school shop'],
      ['the teacher who never said my name', 'the classmate who kicked my chair from behind', 'the dean waiting at the gate every morning'],
      ['the exam ranking pinned on the board', 'the contact book I never got signed', 'the corridor where I was made to stand', 'the red bucket at cleaning time'],
    ],
  },
  zh: {
    remembering: '正在想起你的學校…',
    paHome: '放學時間到了，請同學盡速離開校園。',
    firstLine: '其他人都回家了。地，還沒拖完。',
    pick: '抽一張卡。有東西會變。',
    card: '卡',
    changing: '有東西正在改變…',
    walkOn: '走回去',
    bellWait: '鐘響了。',
    ending: '你回來了。但它已經不是原來的樣子。',
    hide: '遮住我的名字',
    download: '存下聯絡簿',
    again: '再回去一次',
    home: '回到主畫面',
    forward: '走進這扇門',
    locked: '鎖住了。',
    lockedDoor: '鎖住的門',
    throughDoor: '從門走出去',
    alt_corridor: '夜裡的學校走廊',
    alt_door: '教室的門',
    alt_classroom: '空無一人的教室',
    alt_office: '教師辦公室',
    alt_daylight: '午後陽光裡的教室',
    eraseHint: '黑板上有三行字。擦掉兩行，留下一行。',
    eraseOneMore: '再擦一行。',
    wontErase: '擦不掉。',
    officeLine: '你的考卷在桌上。',
    tag: '在台灣，值日生是最後一個離開教室的人。',
    nameLabel: '你的名字',
    nameHint: '只留在這台裝置上，不會傳出去。',
    sayName: '唸一次',
    nameSaid: '錄好了 ✓',
    nameTooQuiet: '沒有錄到聲音。請允許麥克風、靠近一點再唸一次。',
    nameVoiceHint: '唸一次你的名字。點名時，學校廣播會用你自己的聲音叫你。錄音只留在這台裝置上。',
    paOffice: '值日生，請馬上到辦公室來。',
    yearLabel: '你在那裡當值日生的那一年',
    memoriesLabel: '寫下三件你記得的學校的事',
    memory1: '例：走廊盡頭有一棵大榕樹',
    memory2: '例：從來不叫我名字的導師',
    memory3: '例：貼在布告欄上的月考排名',
    speak: '用說的',
    stop: '說完了',
    speakLabel: '把這件事說出來',
    micFailed: '麥克風沒有反應，請用打字。',
    start: '開始值日',
    headphones: '請戴上耳機，並允許使用麥克風：等一下會有人點你的名。',
    dutyToday: '本日值日生　',
    onDuty: '值日生',
    otherPhoto: '（點照片看另一張）',
    wayBack: '回到走廊',
    wayOn: '往前走',
    rollCall: '點到名要答「有」。',
    here: '有',
    wrongAnswer: '不是這樣答的。',
    noName: '值日生',
    rank: '月考排名',
    skip: '點一下略過',
    chips: [
      ['走廊盡頭的大榕樹', '頂樓上鎖的水塔', '午休時拉上的窗簾', '福利社旁邊的飲水機'],
      ['從來不叫我名字的導師', '坐我後面一直踢椅子的同學', '每天早上站在校門口的主任'],
      ['貼在布告欄上的月考排名', '抽屜裡沒給家長簽的聯絡簿', '被罰站的那段走廊', '打掃時間的紅水桶'],
    ],
  },
};

const CREDITS = {
  en: [
    ['title', 'LAST ONE OUT'],
    ['role', 'Made by', CREDIT_NAME],
    ['role', 'The school, photographed', 'Muse Image 1.0'],
    ['role', 'What it remembers', 'Muse Spark 1.3'],
    ['role', 'Doors, boards and papers', 'SAM 3.1'],
    ['role', 'Your voice', 'Muse Voice Transcribe 1.0'],
    ['role', 'Footsteps, doors, children', 'The Red Library, Internet Archive (CC0)'],
    ['role', 'The basketball', 'Free SFX'],
    ['role', 'Water drops', 'TheMSsoundeffects'],
    ['role', 'Lettering', 'Bebas Neue, Caveat, Courier Prime, Iansui, LXGW WenKai TC, Ma Shan Zheng, Noto Serif TC (SIL Open Font License)'],
    ['role', 'Made for', 'Meta Global AI Developer Hackathon, 2026'],
    ['gap'],
    ['line', 'No school in this game existed.'],
    ['line', 'Thank you for staying after class.'],
    ['duty'],
  ],
  zh: [
    ['title', '值日生'],
    ['role', '製作', CREDIT_NAME],
    ['role', '拍下這所學校', 'Muse Image 1.0'],
    ['role', '記得這些事', 'Muse Spark 1.3'],
    ['role', '門、黑板與考卷', 'SAM 3.1'],
    ['role', '你的聲音', 'Muse Voice Transcribe 1.0'],
    ['role', '腳步、門與孩子的聲音', 'The Red Library，Internet Archive（CC0）'],
    ['role', '籃球', 'Free SFX'],
    ['role', '水滴', 'TheMSsoundeffects'],
    ['role', '字型', 'Bebas Neue、Caveat、Courier Prime、芫荽、霞鶩文楷、馬善政、思源宋體（SIL Open Font License）'],
    ['role', '為了', 'Meta Global AI Developer Hackathon，2026'],
    ['gap'],
    ['line', '遊戲裡的學校，都不曾存在。'],
    ['line', '謝謝你留到最後。'],
    ['duty'],
  ],
};

const state = {
  name: '',
  schoolId: null,
  lang: 'en',
  draws: 2,
  bible: null,
  walk: null,
  sceneIndex: 0,
  last: false,
  ending: null,
  audio: null,
  busy: false,
  live: false, // a real server with a key: voice can be transcribed
  answered: false,
  shownYear: null,
  pick: null, // the line kept on the chalkboard this walk: { index, promise, done, title }
  lines: null, // the three lines on this walk's board: { texts, fixed } (fixed = the replay's kept line)
  erased: new Set(), // lines already wiped off this walk
};

const t = (key) => LINES[state.lang][key];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const voice = createVoice();

// Real parallax when WebGL2 is there; otherwise (or with reduced motion) a flat zoom.
const walker = REDUCED_MOTION ? null : createWalker($('#gl'));

async function walk3d(task) {
  const gl = $('#gl');
  gl.hidden = false;
  try {
    await task();
    return true;
  } catch (err) {
    console.warn('3D walk failed, using the flat one:', err.message);
    return false;
  } finally {
    gl.hidden = true;
  }
}

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function show(id) {
  for (const screen of document.querySelectorAll('.screen')) screen.hidden = screen.id !== id;
}

function loading(text) {
  $('#loading-text').textContent = text ?? '';
  $('#loading').hidden = !text;
}

function showError(message) {
  $('#error').textContent = message ?? '';
  $('#error').hidden = !message;
}

const box = (target, b) =>
  Object.assign(target.style, { left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` });

const stageSize = () => ({ w: $('#stage').clientWidth, h: $('#stage').clientHeight });

// ---------- lines on screen ----------

function say(text) {
  typeLine($('#whisper'), text);
}

function cardText(card) {
  return state.lang === 'en'
    ? { title: card.title_en || card.title, whisper: card.whisper_en || card.whisper }
    : { title: card.title, whisper: card.whisper };
}

let typing = null;

function typeLine(target, text) {
  clearInterval(typing);
  target.setAttribute('aria-label', text); // screen readers get the whole line at once
  if (REDUCED_MOTION || !text) {
    target.textContent = text;
    return;
  }
  const chars = [...text];
  let shown = 0;
  target.textContent = '';
  typing = setInterval(() => {
    shown += 1;
    target.textContent = chars.slice(0, shown).join('');
    if (shown >= chars.length) clearInterval(typing);
  }, 70);
}

// ---------- language ----------

function storedLang() {
  try {
    return localStorage.getItem('last-one-out-lang');
  } catch {
    return null;
  }
}

function applyLanguage(lang) {
  state.lang = lang === 'zh' ? 'zh' : 'en';
  document.documentElement.lang = state.lang === 'zh' ? 'zh-Hant' : 'en';
  document.title = state.lang === 'zh' ? '值日生' : 'Last One Out';
  $('h1').setAttribute('aria-label', document.title);
  for (const node of document.querySelectorAll('[data-text]')) node.textContent = t(node.dataset.text);
  for (const node of document.querySelectorAll('[data-placeholder]')) node.placeholder = t(node.dataset.placeholder);
  for (const node of document.querySelectorAll('[data-aria]')) node.setAttribute('aria-label', t(node.dataset.aria));
  ['#m1', '#m2', '#m3'].forEach((id, i) => $(id).setAttribute('aria-label', `${t('memoriesLabel')} ${i + 1}`));
  for (const button of document.querySelectorAll('.lang-switch button')) {
    button.setAttribute('aria-pressed', String(button.dataset.lang === state.lang));
  }
  placeChips();
  if (replayRun) fillReplayMemories(replayRun);
  try {
    localStorage.setItem('last-one-out-lang', state.lang);
  } catch {
    // private mode: the choice just is not remembered
  }
}

// A few memories to pick from, for anyone who would rather not write their own.
function placeChips() {
  for (const row of document.querySelectorAll('.chips')) {
    const slot = Number(row.dataset.slot);
    row.hidden = Boolean(REPLAY_SRC);
    row.replaceChildren(
      ...t('chips')[slot - 1].map((text) => {
        const chip = el('button', text, 'chip');
        chip.type = 'button';
        chip.addEventListener('click', () => {
          $(`#m${slot}`).value = text;
        });
        return chip;
      }),
    );
  }
}

// ---------- texture ----------

function startGrain() {
  const canvas = $('#grain');
  const g = canvas.getContext('2d');
  let image = null;
  const draw = () => {
    const w = Math.max(1, Math.round(innerWidth / 3));
    const h = Math.max(1, Math.round(innerHeight / 3));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      image = g.createImageData(w, h);
    }
    const px = image.data;
    for (let i = 0; i < px.length; i += 4) {
      const v = Math.random() * 255;
      px[i] = px[i + 1] = px[i + 2] = v;
      px[i + 3] = 255;
    }
    g.putImageData(image, 0, 0);
  };
  draw();
  if (!REDUCED_MOTION) setInterval(draw, 90);
}

function startTitleGlitch() {
  if (REDUCED_MOTION) return;
  const title = $('h1');
  const slip = () => {
    if (!$('#title-screen').hidden) {
      const steps = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < steps; i++) {
        setTimeout(() => {
          title.style.setProperty('--gx', `${(Math.random() * 8 - 4).toFixed(1)}px`);
          title.style.setProperty('--gy', `${(Math.random() * 2 - 1).toFixed(1)}px`);
        }, i * 60);
      }
      setTimeout(() => {
        title.style.setProperty('--gx', '0px');
        title.style.setProperty('--gy', '0px');
      }, steps * 60 + 40);
    }
    setTimeout(slip, 2500 + Math.random() * 5000);
  };
  setTimeout(slip, 1800);
}

// ---------- replay: a recorded walk that needs no server and no model calls ----------

const REPLAY_SRC = document.querySelector('meta[name="last-one-out-replay"]')?.content;
let replayRun = null;
let replayCursor = 0;

async function loadReplay() {
  replayRun ??= await fetch(REPLAY_SRC).then((res) => {
    if (!res.ok) throw new Error('The recorded walk could not be loaded.');
    return res.json();
  });
  return replayRun;
}

// Puts the recorded line where the player clicked and the other two around it.
function arrange(cards, picked, clicked) {
  const others = cards.filter((_, i) => i !== picked);
  return [0, 1, 2].map((i) => (i === clicked ? cards[picked] : others.shift()));
}

async function replayApi(path, body) {
  const run = await loadReplay();
  switch (path) {
    case '/api/school':
      replayCursor = 0;
      return { schoolId: 'replay', lang: run.lang, draws: run.draws.length, bible: run.bible, walk: run.walks[0] };
    case '/api/draw': {
      const draw = run.draws[replayCursor];
      replayCursor += 1;
      return {
        cards: arrange(draw.cards, draw.picked, body.index),
        picked: body.index,
        walk: run.walks[replayCursor],
        last: replayCursor >= run.draws.length,
      };
    }
    case '/api/lines': {
      const draw = run.draws[replayCursor];
      return { lines: draw ? draw.cards.map((c) => ({ title: c.title, title_en: c.title_en })) : null, fixed: draw?.picked ?? null };
    }
    case '/api/erase':
      return { ok: true };
    case '/api/ending':
      return run.ending;
    default:
      throw new Error('Not available in the replay.');
  }
}

async function api(path, body) {
  if (REPLAY_SRC) return replayApi(path, body);
  const res = await fetch(
    path,
    body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Audio goes to Muse Voice Transcribe through the server; only on a real server.
async function transcribe(wav, purpose) {
  const res = await fetch(`/api/transcribe?lang=${state.lang}&for=${purpose}`, {
    method: 'POST',
    headers: { 'Content-Type': 'audio/wav' },
    body: wav,
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'transcription failed');
  return data.transcript ?? '';
}

async function guarded(waitingText, task) {
  if (state.busy) return;
  state.busy = true;
  showError('');
  loading(waitingText);
  try {
    await task();
  } catch (err) {
    showError(err.message);
  } finally {
    loading(null);
    state.busy = false;
  }
}

// ---------- the school speaker ----------

// The chime, then a voice from the speaker. The browser speaks it with a voice on
// this device, so the player's name never leaves it.
// A real recorded voice when there is one (sounds/pa-<key>-<lang>.mp3); otherwise the
// device's own voice.
async function announce(text, key) {
  if (!$('#walk-screen').hidden && $('#intro').hidden) say(text);
  state.audio?.speaker();
  await pause(2300);
  if (key && (await state.audio?.loudspeaker(`pa-${key}-${state.lang}.mp3`))) return;
  await voice.speak(text, state.lang);
}

// Your name on the school speaker: in your own voice if you said it at the start, else
// a recorded voice calling the student on duty, else the device's voice.
async function callName(name, { second = false, louder = false } = {}) {
  const speaker = state.audio?.loudspeaker;
  if (state.nameVoice && speaker && (await state.audio.loudspeaker(state.nameVoice, { rate: second ? 0.86 : 1, gain: louder ? 1.3 : 1 }))) return;
  if (speaker && (await state.audio.loudspeaker(`pa-${second || louder ? 'duty-again' : 'duty'}-${state.lang}.mp3`, { gain: louder ? 1.3 : 1 }))) return;
  if (second) await voice.speak(state.lang === 'zh' ? `${[...name].join('，')}？` : `${name}?`, state.lang, { slow: !louder, louder });
  else await voice.speak(state.lang === 'zh' ? `${name}。` : `${name}.`, state.lang);
}

// ---------- sound ----------

function applySound(sound) {
  if (!state.audio) return;
  state.audio.silence(sound === 'silence');
  state.audio.echo(sound === 'echo' ? 0.75 : 0.3);
  if (sound === 'bell') state.audio.bell();
  if (sound === 'ball') setTimeout(() => rollBall(), 2500);
  if (sound === 'laughter') setTimeout(() => state.audio.murmur(5), 3000);
  if (sound === 'chalk') setTimeout(() => state.audio.chalk(1.6), 2000);
  if (sound === 'chair') setTimeout(() => state.audio.chair(), 2200);
  if (sound === 'papers') setTimeout(() => state.audio.papers(), 2400);
  if (sound === 'speaker') setTimeout(() => state.audio.speaker(), 3000);
  // Water: the corridor's taps drip faster and louder, while you are there (only the
  // corridor has taps).
  if (sound === 'water')
    for (let ms = 1500; ms < 26000; ms += 650 + Math.random() * 750)
      setTimeout(() => currentScene()?.id === 'corridor' && state.audio.drip(0.3), ms);
  if (sound === 'giggle') setTimeout(() => state.audio.giggle(), 2800);
  if (sound === 'running') setTimeout(() => state.audio.runPast(), 2500);
}

let eventTimers = [];

function scheduleEvents() {
  eventTimers.forEach(clearTimeout);
  eventTimers = [];
  const index = state.walk?.index ?? 0;
  const later = (ms, play) => eventTimers.push(setTimeout(() => !$('#walk-screen').hidden && play(), ms));
  if (index >= 1) later(4000 + Math.random() * 6000, () => state.audio?.murmur(4));
  if (index >= 1) later(9000 + Math.random() * 8000, () => state.audio?.giggle());
  if (index >= 1) later(15000 + Math.random() * 8000, () => state.audio?.whisper());
  if (index >= 2) later(12000 + Math.random() * 8000, () => state.audio?.runPast());
  for (let ms = 2500; ms < 90000; ms += 5000 + Math.random() * 7000) later(ms, () => state.audio?.drip());
}

// ---------- the walk ----------

const currentScene = () => state.walk.scenes[state.sceneIndex];
const BOARD_SCENES = new Set(['classroom', 'office']);

// The choice happens on a chalkboard: the student on duty erases two lines and keeps one.
const isChoiceScene = (scene) =>
  BOARD_SCENES.has(scene.id) && Boolean(scene.board) && !state.last && state.walk.index < state.draws;

// The last walk ends in the classroom: roll call, the lights, your name on the board.
const isEndingScene = (scene) => scene.id === 'classroom' && state.last;

// Only one door opens. In the second walk it is a different one, further down.
// Only boxes shaped like a door: SAM sometimes calls the whole corridor a door.
// (The door scene is a close-up, so its door may be wide.)
const doorLike = (b, wide) => b.w <= (wide ? 0.62 : 0.32) && b.h >= b.w * (wide ? 0.9 : 1.3);
const boxOverlap = (a, b) => {
  const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return (w * h) / Math.min(a.w * a.h, b.w * b.h);
};

// The doors of a place, largest (nearest) first, each door once: SAM can box the same
// door twice, and one half must not be locked while the other opens. In the close-up
// of the classroom door, that door is the only one: windows there are not doors.
// Not a way through: a sliver at the very edge of the picture (a door frame cut off by
// the frame), or a door too small or too high up to walk through (a cupboard door).
const walkable = (b, sceneId) =>
  !((b.x < 0.01 || b.x + b.w > 0.99) && b.w < 0.06) && (sceneId === 'door' || (b.h >= (sceneId === 'corridor' ? 0.25 : 0.18) && b.y + b.h >= 0.45));

function doorsOf(scene) {
  if (scene.doorList) return scene.doorList;
  const kept = [];
  for (const b of [...(scene.doors ?? [])].filter((d) => doorLike(d, scene.id === 'door') && walkable(d, scene.id)).sort((a, z) => z.w * z.h - a.w * a.h)) {
    if (kept.every((k) => boxOverlap(b, k) < 0.3)) kept.push(b);
  }
  const list = scene.id === 'door' ? kept.slice(0, 1) : kept;
  Object.defineProperty(scene, 'doorList', { value: list, enumerable: false });
  return list;
}

// The way on: the nearest door; on the second walk, a different one.
function forwardDoor(scene) {
  if (scene.id === 'corridor' && state.walk.index === 1 && doorsOf(scene).length > 1) return 1;
  return 0;
}

// A door that stands open is never "locked": in the corridor every open door leads on.
const leadsOn = (scene, spot, i) => i === forwardDoor(scene) || (scene.id === 'corridor' && Boolean(spot.open) && spot.h >= 0.2);

function placeHotspots(scene) {
  const layer = $('#hotspots');
  if (isEndingScene(scene) || (isChoiceScene(scene) && !state.pick)) {
    layer.replaceChildren(); // the way out only opens once a line is kept
    return;
  }
  if (scene.pending) {
    layer.replaceChildren(); // its doors are still being found
    return;
  }
  const exit = BOARD_SCENES.has(scene.id);
  // In the close-up, the door to click is the one Muse Image opened, once that is known.
  const opening = scene.id === 'door' ? openingNow.get(scene.photo) : null;
  const doors = opening ? [opening.door] : doorsOf(scene);
  // No door found: straight on down the corridor, or back the way you came in a room.
  const spots = doors.length ? doors : [exit ? { x: 0.3, y: 0.8, w: 0.4, h: 0.2 } : { x: 0.4, y: 0.3, w: 0.2, h: 0.5 }];
  const open = forwardDoor(scene);
  layer.replaceChildren(
    ...spots.map((spot, i) => {
      const button = el('button', null, 'hotspot');
      button.type = 'button';
      box(button, spot);
      // No door found here (only cupboards, say): the way on is written where you can see
      // it, so nobody has to guess what to click.
      if (!doors.length) {
        button.classList.add('way');
        button.append(el('span', exit ? t('wayBack') : t('wayOn'), 'way-hint'));
      }
      if (exit || leadsOn(scene, spot, i)) {
        button.classList.add('forward');
        button.setAttribute('aria-label', exit ? t('throughDoor') : t('forward'));
        button.addEventListener('click', () => advance());
      } else {
        button.classList.add('locked');
        button.setAttribute('aria-label', t('lockedDoor'));
        button.addEventListener('click', rattle);
      }
      return button;
    }),
  );
}

// A locked door: the handle rattles and the whole picture jolts with it. Nothing is cut
// out of the photo, so nothing can come loose from where it belongs.
function rattle() {
  if (state.stats) state.stats.locked += 1;
  state.audio?.rattle();
  say(t('locked'));
  if (REDUCED_MOTION || state.busy) return;
  $('#stage').animate(
    [{ transform: 'translate(0, 0)' }, { transform: 'translate(-2px, 0)' }, { transform: 'translate(2px, 0)' }, { transform: 'translate(-1px, 0)' }, { transform: 'translate(0, 0)' }],
    { duration: 300 },
  );
}

// Writing, papers and the name are laid on the photo in pixels. When the picture changes
// size (the window resized, full screen), they are laid again, so they stay where they
// belong instead of drifting and then jumping back.
let refitTimer = null;

function refitOverlays() {
  clearTimeout(refitTimer);
  refitTimer = setTimeout(async () => {
    const scene = state.walk && currentScene();
    if (!scene || scene.pending || $('#walk-screen').hidden) return;
    if (!$('#board-name').hidden) placeName(scene, state.answered);
    if ($('#marks').children.length) placeMarks(scene);
    const layer = $('#board-choices');
    if (!layer.hidden && scene.board) {
      const plane = await boardPlane(scene);
      if (sameScene(currentScene(), scene)) {
        layer.style.transform = plane.transform;
        layer.plane = plane;
      }
    }
  }, 150);
}
if (typeof ResizeObserver === 'function') new ResizeObserver(refitOverlays).observe($('#stage'));

// The page writes the name itself; it is never sent to a model.
const BLUR_BY_WALK = [2.4, 1.8, 1.4];

async function placeName(scene, sharp = false) {
  const label = $('#board-name');
  await sortBoards(scene);
  if (scene.id !== 'classroom' || !scene.board || !state.name) {
    label.hidden = true;
    return;
  }
  const { BW, BH, transform } = await boardPlane(scene);
  if (!sameScene(currentScene(), scene)) return;
  // Laid on the board's surface: a spot on it (x, y, w, h in board pixels).
  const at = (x, y, width, height) =>
    Object.assign(label.style, { left: '0', top: '0', width: `${width}px`, height: `${height}px`, transformOrigin: '0 0', transform: `${transform} translate(${x}px, ${y}px)` });
  // The narrow column at the board's right edge, where the student on duty is written,
  // top to bottom, in either language (English lies on its side, as it would there):
  // between its own two ruled lines, found in the photo, below its heading cell.
  label.className = 'vertical';
  const zh = state.lang === 'zh';
  const chars = [...`${t('onDuty')}  ${state.name}`].length * (zh ? 1 : 0.66);
  const column = await nameColumn(scene);
  if (!sameScene(currentScene(), scene)) return;
  const [u0, u1] = column ?? [0.9, 0.98];
  const width = (u1 - u0) * BW;
  // Only the top of the column: below it, the heads of a seated class would cover it.
  at(u0 * BW + width * 0.1, BH * 0.1, width * 0.8, BH * 0.5);
  label.style.fontSize = `${Math.max(8, Math.min(width * 0.7, (BH * 0.5) / (chars + 1)))}px`;
  label.replaceChildren(el('span', zh ? t('onDuty') : `${t('onDuty')}:`), el('span', state.name, 'who'));
  const blur = sharp ? 0 : BLUR_BY_WALK[Math.min(state.walk.index, BLUR_BY_WALK.length - 1)];
  label.style.filter = blur ? `blur(${blur}px)` : 'none';
  label.hidden = false;
}

// The ruled column at the right of the chalkboard: two bright vertical lines close
// together near its right edge, as [left, right] across the board (0 to 1). Null when
// the photo does not show them clearly.
const columnCache = new Map();

function nameColumn(scene) {
  const key = `${scene.photo}|${scene.board.x.toFixed(4)}|${scene.board.y.toFixed(4)}`;
  if (!columnCache.has(key)) columnCache.set(key, findColumn(scene).catch(() => null));
  return columnCache.get(key);
}

async function findColumn(scene) {
  const corners = (await sheetCorners(scene.photo, scene.board, 'board')) ?? boxCorners(scene.board);
  const img = await loadPicture(scene.photo);
  const W = 640, H = Math.round((640 * img.naturalHeight) / img.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data;
  const [tl, tr, br, bl] = corners;
  const light = (u, v) => {
    const x = (tl[0] * (1 - u) + tr[0] * u) * (1 - v) + (bl[0] * (1 - u) + br[0] * u) * v;
    const y = (tl[1] * (1 - u) + tr[1] * u) * (1 - v) + (bl[1] * (1 - u) + br[1] * u) * v;
    const i = (Math.min(H - 1, Math.max(0, Math.round(y * (H - 1)))) * W + Math.min(W - 1, Math.max(0, Math.round(x * (W - 1))))) * 4;
    return (px[i] + px[i + 1] + px[i + 2]) / 3;
  };
  // Brightness down each line across the right part of the board.
  const N = 90, from = 0.72, to = 0.995;
  const profile = [];
  for (let k = 0; k <= N; k++) {
    const u = from + ((to - from) * k) / N;
    let sum = 0, n = 0;
    for (let v = 0.2; v <= 0.8; v += 0.02) {
      sum += light(u, v);
      n += 1;
    }
    profile.push({ u, b: sum / n });
  }
  const base = [...profile].map((p) => p.b).sort((a, z) => a - z)[profile.length >> 1];
  const peaks = profile.filter((p, k) => k > 0 && k < N && p.b >= profile[k - 1].b && p.b >= profile[k + 1].b && p.b > base + 14);
  let best = null;
  for (const a of peaks)
    for (const b of peaks) {
      const gap = b.u - a.u;
      if (gap < 0.03 || gap > 0.14) continue;
      // Between them the board itself: darker than the lines.
      const inside = profile.filter((p) => p.u > a.u + 0.008 && p.u < b.u - 0.008);
      if (!inside.length || Math.max(...inside.map((p) => p.b)) > Math.min(a.b, b.b) - 6) continue;
      const score = a.b + b.b + b.u * 40; // the rightmost clear pair
      if (!best || score > best.score) best = { score, u0: a.u, u1: b.u };
    }
  return best ? [best.u0, best.u1] : null;
}

// Your exam papers carry your name and a red score; the ranking sheet has you last.
// Made-up classmates for the ranking: common Taiwanese surnames and given names.
const SURNAMES = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪', '曾', '邱', '廖'];
const GIVEN = ['怡君', '家豪', '雅婷', '冠宇', '佳穎', '宗翰', '詩涵', '俊傑', '欣怡', '承恩', '柏翰', '思妤', '志明', '育誠', '佩珊', '彥廷', '筱涵', '建宏'];
const SURNAMES_EN = ['Chen', 'Lin', 'Huang', 'Chang', 'Li', 'Wang', 'Wu', 'Liu', 'Tsai', 'Yang', 'Hsu', 'Cheng', 'Hsieh', 'Kuo', 'Hung', 'Tseng', 'Chiu', 'Liao'];
const GIVEN_EN = ['Yi-chun', 'Chia-hao', 'Ya-ting', 'Kuan-yu', 'Chia-ying', 'Tsung-han', 'Shih-han', 'Chun-chieh', 'Hsin-yi', 'Cheng-en', 'Po-han', 'Ssu-yu', 'Chih-ming', 'Yu-cheng', 'Pei-shan', 'Yen-ting', 'Hsiao-han', 'Chien-hung'];

// What a teacher would have left on the board, if the real lines are not ready yet.
const NOTICES = {
  zh: [
    ['明天考第三課到第五課', '值日生：擦黑板、倒垃圾、鎖門', '放學前請關好門窗'],
    ['數學考卷明天發回', '午休時間請保持安靜', '值日生放學後到辦公室'],
  ],
  en: [
    ['Test tomorrow: chapters 3 to 5', 'On duty: erase the board, empty the bin, lock up', 'Close the windows before you leave'],
    ['Maths papers back tomorrow', 'Quiet during the nap', 'Student on duty: see me after school'],
  ],
};

function fillerName(i) {
  const s = (i * 7) % SURNAMES.length;
  const g = (i * 11 + 3) % GIVEN.length;
  return state.lang === 'en' ? `${SURNAMES_EN[s]} ${GIVEN_EN[g]}` : `${SURNAMES[s]}${GIVEN[g]}`;
}

// ---------- papers in perspective ----------

// Where the white sheet inside a box really is: the bright, unsaturated region around
// the middle of the box, and its four corners. Null when it does not look like a sheet.
const sheetCache = new Map();

function loadPicture(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function sheetCorners(url, b, kind = 'sheet') {
  const key = `${kind}|${url}|${b.x.toFixed(4)}|${b.y.toFixed(4)}|${b.w.toFixed(4)}`;
  if (!sheetCache.has(key)) sheetCache.set(key, findSheet(url, b, kind).catch(() => null));
  return sheetCache.get(key);
}

// kind: 'sheet' (white paper), 'pinned' (a sheet on a board), 'board' (a dark
// chalkboard). The region is found by Otsu's threshold, filled from the middle.
async function findSheet(url, b, kind = 'sheet') {
  const img = await loadPicture(url);
  const pad = 0.02; // look only inside the box SAM found
  const x0 = Math.max(0, b.x - b.w * pad);
  const y0 = Math.max(0, b.y - b.h * pad);
  const x1 = Math.min(1, b.x + b.w * (1 + pad));
  const y1 = Math.min(1, b.y + b.h * (1 + pad));
  const W = 180;
  const H = Math.max(12, Math.round((W * (y1 - y0) * img.naturalHeight) / ((x1 - x0) * img.naturalWidth)));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, x0 * img.naturalWidth, y0 * img.naturalHeight, (x1 - x0) * img.naturalWidth, (y1 - y0) * img.naturalHeight, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data;
  const white = new Uint8Array(W * H);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < W * H; i++) {
    const r = px[i * 4], gr = px[i * 4 + 1], bl = px[i * 4 + 2];
    let v;
    if (kind === 'board') v = 255 - (r + gr + bl) / 3; // dark
    else v = (r + gr + bl) / 3 - (Math.max(r, gr, bl) - Math.min(r, gr, bl)) * 1.6; // sheet / pinned: bright and grey, not tinted glass
    v = Math.max(0, Math.min(255, Math.round(v)));
    white[i] = v;
    hist[v] += 1;
  }
  let sum = 0;
  for (let v = 0; v < 256; v++) sum += v * hist[v];
  let below = 0, belowSum = 0, best = -1, threshold = 160;
  for (let v = 0; v < 256; v++) {
    below += hist[v];
    if (!below || below === W * H) continue;
    belowSum += v * hist[v];
    const m0 = belowSum / below;
    const m1 = (sum - belowSum) / (W * H - below);
    const spread = below * (W * H - below) * (m0 - m1) ** 2;
    if (spread > best) {
      best = spread;
      threshold = v;
    }
  }
  // Paper must also be close to the whitest part of the box (glass and desk are not).
  let top = 0;
  if (kind === 'sheet' || kind === 'pinned') {
    const sorted = [...white].sort((a, z) => z - a);
    top = sorted[Math.floor(sorted.length * 0.05)] * 0.72;
  }
  const bright = (i) => white[i] > Math.max(threshold, top);
  // Start from the bright pixel nearest the middle of the box, and fill.
  const cx = Math.round(W / 2), cy = Math.round(H / 2);
  let seed = -1;
  for (let r = 0; r < Math.min(W, H) / 2 && seed < 0; r++) {
    for (let dy = -r; dy <= r && seed < 0; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && y >= 0 && x < W && y < H && bright(y * W + x)) {
          seed = y * W + x;
          break;
        }
      }
    }
  }
  if (seed < 0) return null;
  const seen = new Uint8Array(W * H);
  const stack = [seed];
  seen[seed] = 1;
  let count = 0;
  const left = new Array(H).fill(Infinity), right = new Array(H).fill(-Infinity);
  while (stack.length) {
    const i = stack.pop();
    const x = i % W, y = (i - x) / W;
    count += 1;
    if (x < left[y]) left[y] = x;
    if (x > right[y]) right[y] = x;
    for (const n of [i - 1, i + 1, i - W, i + W]) {
      if (n < 0 || n >= W * H || seen[n]) continue;
      if ((n === i - 1 && x === 0) || (n === i + 1 && x === W - 1)) continue;
      seen[n] = 1;
      if (bright(n)) stack.push(n);
    }
  }
  // The sheet's outline (convex hull), then the four outline points enclosing the most area.
  const points = [];
  for (let y = 0; y < H; y++) if (left[y] <= right[y]) points.push([left[y], y], [right[y], y]);
  const hull = convexHull(points);
  if (hull.length < 4) return null;
  const step = Math.max(1, Math.ceil(hull.length / 40));
  const ring = hull.filter((_, i) => i % step === 0);
  const area = (q) => {
    let a = 0;
    for (let k = 0; k < q.length; k++) a += q[k][0] * q[(k + 1) % q.length][1] - q[(k + 1) % q.length][0] * q[k][1];
    return Math.abs(a) / 2;
  };
  let quad = null, most = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++)
        for (let l = k + 1; l < n; l++) {
          const q = [ring[i], ring[j], ring[k], ring[l]];
          const a = area(q);
          if (a > most) {
            most = a;
            quad = q;
          }
        }
  if (!quad) return null;
  // Order: top-left, top-right, bottom-right, bottom-left.
  const byY = [...quad].sort((p, q) => p[1] - q[1]);
  const [tl, tr] = byY.slice(0, 2).sort((p, q) => p[0] - q[0]);
  const [bl, br] = byY.slice(2).sort((p, q) => p[0] - q[0]);
  const corners = [tl, tr, br, bl];
  // A sheet: it fills a good part of its box, matches the box SAM found, and has sane angles.
  const bw = W / (1 + 2 * pad), bh = H / (1 + 2 * pad), bx = (W - bw) / 2, by = (H - bh) / 2;
  const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
  const qx0 = Math.min(...xs), qx1 = Math.max(...xs), qy0 = Math.min(...ys), qy1 = Math.max(...ys);
  const ix = Math.max(0, Math.min(qx1, bx + bw) - Math.max(qx0, bx));
  const iy = Math.max(0, Math.min(qy1, by + bh) - Math.max(qy0, by));
  const iou = (ix * iy) / ((qx1 - qx0) * (qy1 - qy0) + bw * bh - ix * iy);
  const angleOk = corners.every((p, k) => {
    const a = corners[(k + 3) % 4], c = corners[(k + 1) % 4];
    const v1 = [a[0] - p[0], a[1] - p[1]], v2 = [c[0] - p[0], c[1] - p[1]];
    const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2) || 1);
    return cos > -0.87 && cos < 0.87; // between 30 and 150 degrees
  });
  // Unsure means nothing is drawn: every check must pass. A pinned sheet is only a part
  // of its board, so it is checked for size and shape instead of filling the box.
  if (kind === 'pinned') {
    const tall = qy1 - qy0 > (qx1 - qx0) * 1.1;
    if (most < bw * bh * 0.06 || !tall || !angleOk) return null;
  } else {
    const fill = kind === 'board' ? 0.55 : 0.42;
    if (count < bw * bh * fill * 0.8 || most < bw * bh * fill || iou < 0.6 || !angleOk) return null;
  }
  return corners.map(([x, y]) => [x0 + (x / W) * (x1 - x0), y0 + (y / H) * (y1 - y0)]);
}

function convexHull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

// Without a clear outline: a sheet lying flat on the desk, seen from above and in front.
function flatSheet(b) {
  const inset = b.w * 0.07;
  return [
    [b.x + inset, b.y + b.h * 0.06],
    [b.x + b.w - inset * 0.4, b.y],
    [b.x + b.w, b.y + b.h * 0.94],
    [b.x, b.y + b.h],
  ];
}

// The CSS transform that lays a w x h element onto four corners (tl, tr, br, bl), in pixels.
function onCorners(w, h, [p0, p1, p2, p3]) {
  const dx1 = p1[0] - p2[0], dx2 = p3[0] - p2[0], dx3 = p0[0] - p1[0] + p2[0] - p3[0];
  const dy1 = p1[1] - p2[1], dy2 = p3[1] - p2[1], dy3 = p0[1] - p1[1] + p2[1] - p3[1];
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const k = (dx1 * dy3 - dx3 * dy1) / den;
  const a = p1[0] - p0[0] + g * p1[0], b = p3[0] - p0[0] + k * p3[0], c = p0[0];
  const d = p1[1] - p0[1] + g * p1[1], e = p3[1] - p0[1] + k * p3[1], f = p0[1];
  return `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${k / h},0,0,1,0,${c},${f},0,1)`;
}

// How much of a box the four corners cover (1 = all of it).
function quadFill(corners, b) {
  let a = 0;
  for (let k = 0; k < 4; k++) a += corners[k][0] * corners[(k + 1) % 4][1] - corners[(k + 1) % 4][0] * corners[k][1];
  return Math.abs(a) / 2 / (b.w * b.h);
}

// Four corners in stage pixels, for a box when nothing better was found.
const boxCorners = (b) => [
  [b.x, b.y],
  [b.x + b.w, b.y],
  [b.x + b.w, b.y + b.h],
  [b.x, b.y + b.h],
];
const toStage = (corners) => {
  const { w, h } = stageSize();
  return corners.map(([x, y]) => [x * w, y * h]);
};

// The chalkboard as a flat surface: an element BW x BH laid onto its four corners.
async function boardPlane(scene) {
  const found = await sheetCorners(scene.photo, scene.board, 'board');
  const corners = toStage(found ?? boxCorners(scene.board));
  const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const across = (len(corners[0], corners[1]) + len(corners[3], corners[2])) / 2;
  const down = (len(corners[0], corners[3]) + len(corners[1], corners[2])) / 2;
  const BH = 300;
  const BW = Math.round(BH * Math.min(4.5, Math.max(1, across / Math.max(1, down))));
  return { BW, BH, transform: onCorners(BW, BH, corners) };
}

function sheetOverlap(a, b) {
  const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return (w * h) / Math.min(a.w * a.h, b.w * b.h);
}

const SHEET_W = 424; // an exam sheet, landscape
const SHEET_H = 300;

async function placeMarks(scene) {
  const layer = $('#marks');
  layer.replaceChildren();
  await sortBoards(scene);
  const scores = state.bible?.scores ?? [];
  const name = state.name || t('noName');
  const onDesk = (b) => b.y + b.h / 2 > 0.45 && b.w > b.h * 0.8; // not the blinds, not a poster
  const candidates = (scene.id === 'office' || isEndingScene(scene) ? (scene.papers ?? []).filter(onDesk) : [])
    .filter((b) => b.w * b.h > 0.006) // too small to write on legibly
    .sort((a, b) => b.w * b.h - a.w * a.h)
    .filter((paper, i, all) => all.slice(0, i).every((other) => sheetOverlap(paper, other) < 0.3)); // one mark per stack
  const found = await Promise.all(candidates.map((paper) => sheetCorners(scene.photo, paper)));
  if (!sameScene(currentScene(), scene)) return;
  // Only sheets whose outline was found; if none was, the largest one gets a small label
  // in its middle, where the paper surely is.
  let sheets = candidates.map((paper, i) => ({ paper, corners: found[i] })).filter((s) => s.corners);
  if (!sheets.length && candidates[0]) {
    const b = candidates[0];
    sheets = [{ paper: b, corners: boxCorners({ x: b.x + b.w * 0.22, y: b.y + b.h * 0.25, w: b.w * 0.56, h: b.h * 0.5 }) }];
  }
  sheets.slice(0, scores.length).forEach(({ corners }, i) => {
    const score = scores[i];
    const subject = state.lang === 'zh' ? score.subject : score.subject_en;
    const mark = el('div', null, 'paper-mark on-sheet');
    mark.append(el('span', `${subject}${state.lang === 'zh' ? '　' : '  '}${name}`, 'paper-name'), el('span', String(score.score), 'paper-score'));
    Object.assign(mark.style, { width: `${SHEET_W}px`, height: `${SHEET_H}px`, fontSize: `${Math.min(30, (SHEET_W * 0.5) / Math.max(4, [...name].length + 3))}px` });
    mark.style.transform = onCorners(SHEET_W, SHEET_H, toStage(corners));
    layer.append(mark);
  });
  if (scene.id === 'office' && scene.notice) {
    // The long sheet pinned in the middle of the cork board; without it, no ranking.
    const n = scene.notice;
    const found = await sheetCorners(scene.photo, n, 'pinned');
    if (!sameScene(currentScene(), scene)) return;
    const corners = found ?? boxCorners({ x: n.x + n.w * 0.36, y: n.y + n.h * 0.08, w: n.w * 0.28, h: n.h * 0.84 });
    const sheet = el('div', null, found ? 'ranking' : 'ranking pinned');
    const RW = 300, RH = 600;
    Object.assign(sheet.style, { left: '0', top: '0', width: `${RW}px`, height: `${RH}px`, transformOrigin: '0 0', transform: onCorners(RW, RH, toStage(corners)) });
    const rows = 12;
    sheet.style.fontSize = `${(RH * 0.9) / ((rows + 1) * 1.25)}px`;
    sheet.append(el('div', t('rank'), 'rank-title'));
    for (let i = 1; i < rows - 1; i++) sheet.append(el('div', `${i}. ${fillerName(i)}`, 'rank-row'));
    sheet.append(el('div', '⋮', 'rank-row'));
    sheet.append(el('div', `${CLASS_SIZE}. ${name}`, 'rank-row last'));
    layer.append(sheet);
  }
}

// ---------- the chalkboard ----------

function boardLine(i) {
  const real = state.lines?.texts?.[i];
  if (real) return state.lang === 'en' ? real.title_en || real.title : real.title;
  const walk = Math.min(state.walk?.index ?? 0, NOTICES.zh.length - 1);
  return NOTICES[state.lang === 'en' ? 'en' : 'zh'][walk][i];
}

// The lines are dealt while you walk; they are on the board by the time you reach it.
function fetchLines(tries = 6) {
  if (tries === 6) state.lines = null;
  const walk = state.walk;
  api('/api/lines', { schoolId: state.schoolId })
    .then((res) => {
      if (state.walk !== walk || state.pick) return;
      if (!res?.lines) {
        if (tries > 1) setTimeout(() => fetchLines(tries - 1), 3000);
        return;
      }
      state.lines = { texts: res.lines, fixed: res.fixed ?? null };
      const scene = currentScene();
      if (scene && isChoiceScene(scene) && !state.pick && !state.erased.size) placeChoices(scene);
    })
    .catch(() => {});
}

// A line that fits the board on one row (sizes are on the board's own surface).
function lineSize({ BW, BH }, text) {
  const cjk = /[㐀-鿿]/.test(text);
  const ems = [...text].length * (cjk ? 1.08 : 0.5);
  return Math.max(8, Math.min(BH * 0.14, (BW * 0.8) / Math.max(ems, 1)));
}

function chalkWrite(target, text) {
  clearInterval(target.chalkTimer);
  if (REDUCED_MOTION) {
    target.textContent = text;
    return;
  }
  const chars = [...text];
  let shown = 0;
  target.textContent = '';
  target.chalkTimer = setInterval(() => {
    shown += 1;
    target.textContent = chars.slice(0, shown).join('');
    if (shown >= chars.length) clearInterval(target.chalkTimer);
  }, 110);
}

// Mean brightness of a box in the photo (0 dark, 1 white).
async function boxLight(url, b) {
  const img = await loadPicture(url);
  const canvas = document.createElement('canvas');
  canvas.width = 24;
  canvas.height = 24;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, b.x * img.naturalWidth, b.y * img.naturalHeight, b.w * img.naturalWidth, b.h * img.naturalHeight, 0, 0, 24, 24);
  const px = g.getImageData(0, 0, 24, 24).data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) sum += (px[i] + px[i + 1] + px[i + 2]) / 765;
  return sum / (px.length / 4);
}

// Once per place: if SAM swapped the chalkboard and the cork board, swap them back.
// Checked once per place, and everyone waits for the same check: the lines, the name
// and the ranking were placed before it finished, on the wrong board, and then jumped.
function sortBoards(scene) {
  if (!scene.board || !scene.notice) return Promise.resolve();
  if (!scene.boardsSorted) {
    const { board, notice } = scene;
    const sorted = Promise.all([boxLight(scene.photo, board), boxLight(scene.photo, notice)])
      .catch(() => [0, 1])
      .then(([dark, light]) => {
        if (dark > light + 0.08) [scene.board, scene.notice] = [notice, board];
      });
    Object.defineProperty(scene, 'boardsSorted', { value: sorted, enumerable: false });
  }
  return scene.boardsSorted;
}

async function placeChoices(scene) {
  const layer = $('#board-choices');
  await sortBoards(scene);
  if (!isChoiceScene(scene)) {
    layer.replaceChildren();
    layer.hidden = true;
    return;
  }
  const plane = await boardPlane(scene);
  if (!sameScene(currentScene(), scene)) return;
  const { BW, BH } = plane;
  Object.assign(layer.style, { inset: 'auto', left: '0', top: '0', width: `${BW}px`, height: `${BH}px`, transformOrigin: '0 0', transform: plane.transform });
  layer.plane = plane;
  const pick = state.pick;
  layer.hidden = false;
  layer.replaceChildren(
    ...[0, 1, 2].map((i) => {
      const line = el('button', null, 'chalk-line');
      line.type = 'button';
      const text = pick?.index === i && pick.title ? pick.title : boardLine(i);
      Object.assign(line.style, {
        left: '5%',
        top: `${20 + i * 25}%`,
        maxWidth: '80%',
        fontSize: `${lineSize(plane, text)}px`,
      });
      line.textContent = text;
      if (pick) line.classList.add(pick.index === i ? 'kept' : 'gone');
      else if (state.erased.has(i)) line.classList.add('gone');
      line.disabled = Boolean(pick) || state.erased.has(i);
      line.setAttribute('aria-label', state.lang === 'zh' ? `擦掉第 ${i + 1} 行` : `Erase line ${i + 1}`);
      line.addEventListener('click', () => eraseLine(i));
      return line;
    }),
  );
}

function fitKeptLine(line, board, text) {
  const { BW, BH } = $('#board-choices').plane ?? { BW: 900, BH: 300 };
  const width = BW * 0.78; // clear of the column at the right edge, where the name goes
  const cjk = /[㐀-鿿]/.test(text);
  const ems = [...text].length * (cjk ? 1.05 : 0.5);
  const size = Math.max(8, Math.min(BH * 0.2, (width * 2) / Math.max(ems, 1), (width / Math.max(ems, 1)) * 1.6));
  // It stays on its own row (only kept clear of the board's edges), so it never jumps.
  const row = parseFloat(line.style.top) || 45;
  Object.assign(line.style, {
    top: `${Math.min(65, Math.max(30, row))}%`,
    maxWidth: '80%',
    fontSize: `${size}px`,
    whiteSpace: 'normal',
    lineHeight: '1.25',
  });
}

// Erase two lines; the one left is kept. In the replay, the line that was kept when it
// was recorded will not come off the board.
function eraseLine(index) {
  if (state.pick || state.busy || state.erased.has(index)) return;
  const line = $('#board-choices').children[index];
  state.audio?.erase();
  if (state.lines?.fixed === index) {
    line?.animate([{ transform: 'translateY(-50%)' }, { transform: 'translate(-3px, -50%)' }, { transform: 'translate(3px, -50%)' }, { transform: 'translateY(-50%)' }], { duration: 380 });
    say(t('wontErase'));
    return;
  }
  state.erased.add(index);
  state.stats?.erased.push(line?.textContent ?? '');
  if (line) {
    line.disabled = true;
    line.classList.add('erased');
  }
  api('/api/erase', { schoolId: state.schoolId, index }).catch(() => {});
  if (state.erased.size >= 2) {
    const kept = [0, 1, 2].find((i) => !state.erased.has(i));
    setTimeout(() => choose(kept), 650);
  } else say(t('eraseOneMore'));
}

// Keeping a line is the choice. Its version of the school was rendered while you walked.
function choose(index) {
  if (state.pick || state.busy) return;
  state.stats?.kept.push($('#board-choices').children[index]?.textContent ?? '');
  const scene = currentScene();
  const pick = { index, done: false, title: null };
  state.pick = pick;
  [...$('#board-choices').children].forEach((line, i) => {
    line.disabled = true;
    if (i === index) line.classList.add('kept');
    else if (!state.erased.has(i)) line.classList.add('erased');
  });
  say(t('changing'));
  placeHotspots(scene);
  pick.promise = api('/api/draw', { schoolId: state.schoolId, index });
  pick.promise.then(
    (res) => {
      if (state.pick !== pick) return;
      const card = res.cards[res.picked];
      pick.done = true;
      pick.title = card.title;
      const kept = $('#board-choices').children[index];
      const words = cardText(card);
      if (kept) {
        fitKeptLine(kept, scene.board, words.title);
        chalkWrite(kept, words.title);
      }
      state.audio?.chalk(1.2);
      say(words.whisper);
    },
    (err) => {
      if (state.pick !== pick) return;
      state.pick = null;
      state.erased.clear();
      showError(err.message);
      if (sameScene(currentScene(), scene)) {
        placeChoices(scene);
        placeHotspots(scene);
        say(t('eraseHint'));
      }
    },
  );
}

// When the next place is not ready yet: no message. The lights go down and you keep
// walking in the dark until it is there (render() brings the light back).
// Only one walk in the dark at a time, and it always ends when a place is shown:
// a second one left running kept the stage zoomed in over the line under the photo.
let stopDarkWalk = null;

function waitInTheDark(ready) {
  stopDarkWalk?.();
  const stage = $('#stage');
  // The picture moves inside its frame, never the frame itself: the line under the
  // photo stays where it is and is never covered.
  const view = $('#photo');
  const moves = [];
  let done = false;
  let steps = null;
  let scale = 1;
  const stop = () => {
    if (done) return;
    done = true;
    clearInterval(steps);
    stage.classList.remove('dark-walk');
    moves.forEach((a) => a.cancel());
    if (stopDarkWalk === stop) stopDarkWalk = null;
  };
  stopDarkWalk = stop;
  ready.then?.(stop, stop);
  setTimeout(() => {
    if (done) return;
    // Almost dark, and still walking: every footstep is a dip of the head and a little
    // further in, so what you hear is what you see.
    stage.classList.add('dark-walk');
    const step = () => {
      if (done) return;
      state.audio?.footsteps(1);
      const from = scale;
      scale = Math.min(1.12, scale + 0.006);
      moves.push(
        view.animate(
          [
            { transform: `translateY(0) scale(${from})` },
            { transform: `translateY(0.8%) scale(${from + 0.002})`, offset: 0.25 },
            { transform: `translateY(0) scale(${scale})` },
          ],
          { duration: 520, easing: 'ease-out', fill: 'forwards' },
        ),
      );
      if (moves.length > 2) moves.splice(0, moves.length - 2).forEach((a) => a.cancel()); // the last one holds the pose
    };
    step();
    steps = setInterval(step, 560);
  }, 400);
}

function walkBack() {
  const pick = state.pick;
  if (!pick) {
    say(t('eraseHint'));
    return;
  }
  state.audio?.creak();
  return guarded('', async () => {
    if (!pick.done) waitInTheDark(pick.promise);
    const res = await pick.promise;
    const card = res.cards[res.picked];
    state.last = res.last;
    fillWalk(res.walk);
    await beginWalk(res.walk, cardText(card).whisper, card.sound);
  });
}

// ---------- the date stamp: a timeline back to the year you were there ----------

const two = (n) => String(n).padStart(2, '0');
const schoolYear = () => state.bible?.year ?? THIS_YEAR - 15;

// Today on the first walk, halfway back on the second, your year on the last.
function stampYear(index) {
  if (index <= 0) return THIS_YEAR;
  if (index >= 2) return schoolYear();
  return Math.round((THIS_YEAR + schoolYear()) / 2);
}

let stampTimer = null;

function placeDateStamp() {
  const stamp = $('#date-stamp');
  const today = new Date();
  const target = stampYear(state.walk?.index ?? 0);
  const write = (year) => {
    stamp.textContent = `’${two(year % 100)} ${two(today.getMonth() + 1)} ${two(today.getDate())}`;
  };
  clearInterval(stampTimer);
  const from = state.shownYear ?? target;
  state.shownYear = target;
  if (from === target || REDUCED_MOTION) return write(target);
  let year = from;
  write(year);
  stampTimer = setInterval(() => {
    year += year > target ? -1 : 1;
    write(year);
    if (year === target) clearInterval(stampTimer);
  }, 1400 / Math.max(1, Math.abs(from - target)));
}

// ---------- dynamics ----------

// A ball bounces out of the dark end of the corridor and rolls towards you. It moves on
// the floor in the photo's perspective and stops short of anything in its way.
const BALL_TAN_Y = 0.45; // the walk's camera (walk3d.js)
const BALL_TAN_X = BALL_TAN_Y * 1.5;

async function floorPath(scene) {
  // Without a depth map: the corridor's vanishing point is a little above the middle.
  let vx = 0.5, vy = 0.47, y0 = 0.53, depthAt = null;
  if (scene.depth) {
    try {
      const img = await loadPicture(scene.depth);
      const W = 96, H = 64;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const g = canvas.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, W, H);
      const px = g.getImageData(0, 0, W, H).data;
      depthAt = (x, y) => px[(Math.min(H - 1, Math.max(0, Math.round(y * (H - 1)))) * W + Math.min(W - 1, Math.max(0, Math.round(x * (W - 1))))) * 4] / 255;
      // The far end: the darkest (farthest) patch in the middle of the picture.
      let far = Infinity;
      for (let y = 0.3; y <= 0.62; y += 0.02) {
        for (let x = 0.3; x <= 0.7; x += 0.02) {
          let d = 0;
          for (const [dx, dy] of [[0, 0], [0.015, 0], [-0.015, 0], [0, 0.015], [0, -0.015]]) d += depthAt(x + dx, y + dy);
          if (d < far) {
            far = d;
            vx = x;
            vy = y;
          }
        }
      }
      // The floor starts where the depth begins to come nearer below the far end.
      const floor0 = depthAt(vx, vy);
      y0 = vy + 0.03;
      while (y0 < vy + 0.2 && depthAt(vx, y0) < floor0 + 0.06) y0 += 0.01;
    } catch {
      depthAt = null;
    }
  }
  return { vx, vy, y0: Math.min(y0, 0.75), depthAt };
}

// Where the ball goes, frame by frame: bouncing out of the far end, then rolling towards
// the camera. toFeet: it rolls all the way to your feet. Null when something is in the way.
// The bounces: when the ball lands, in seconds. A recorded ball sets them; otherwise
// each bounce is shorter than the last.
function ballContacts() {
  const recorded = state.audio?.ballHits?.();
  if (recorded?.length) return recorded.filter((t) => t < 3.5);
  const list = [];
  for (let at = 0.1, gap = 0.55, k = 0; k < 7; k++, at += gap, gap *= 0.68) list.push(at);
  return list;
}

function ballFrames({ vx, vy, y0, depthAt }, side, toFeet) {
  const contactsAt = ballContacts();
  const camH = 1.3;
  const fy = 0.5 / BALL_TAN_Y, fx = 0.5 / BALL_TAN_X;
  const z0 = (camH * fy) / Math.max(0.02, y0 - vy);
  const zEnd = toFeet ? (camH * fy) / Math.max(0.05, 0.93 - vy) : Math.max(2, z0 * 0.45);
  const distance = Math.max(1, z0 - zEnd);
  const seconds = toFeet ? 5.2 : 4.2;
  const v0 = (2 * distance) / seconds; // slows evenly and stops where it should
  const decel = v0 / seconds;
  const steps = 64;
  const frames = [];
  let lastDepth = null;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * seconds;
    const travelled = v0 * t - 0.5 * decel * t * t;
    const z = Math.max(zEnd, z0 - travelled);
    const X = side * Math.min(1, travelled / distance);
    // Bounces that match the sound: up and down between one landing and the next.
    let lift = 0;
    for (let k = 0; k + 1 < contactsAt.length; k++) {
      const contact = contactsAt[k], gap = contactsAt[k + 1] - contact;
      if (t >= contact && t < contact + gap) {
        const u = t - contact;
        lift = 0.5 * 9.8 * u * (gap - u);
        break;
      }
    }
    if (t < contactsAt[0]) lift = 0.5 * 9.8 * (contactsAt[0] - t) * (contactsAt[0] + t) * 0.6;
    const floor = vy + (camH * fy) / z;
    const x = vx + (X * fx) / z;
    const size = (0.24 * fy) / z; // a basketball, 0.24 m across, as a share of the picture's height
    // Something standing on the floor ahead: the depth jumps nearer. Not checked while
    // it comes out of the far end, where the floor meets the dark and the depth always jumps.
    if (depthAt) {
      const d = depthAt(x, floor - size * 0.5);
      if (i >= 10 && lastDepth !== null && d - lastDepth > 0.12) return { frames, blocked: true, seconds: frames.length ? frames[frames.length - 1].t : 0 };
      lastDepth = d;
    }
    frames.push({ t, x, y: floor - (lift * fy) / z, floor, size, spin: travelled / 0.12, X, z, speed: Math.max(0, v0 - decel * t) });
  }
  return { frames, blocked: false, seconds };
}

async function rollBall({ toFeet = false } = {}) {
  const scene = currentScene();
  if ($('#walk-screen').hidden || scene?.id !== 'corridor' || REDUCED_MOTION) {
    state.audio?.ball();
    return false;
  }
  const path = await floorPath(scene);
  if (!sameScene(currentScene(), scene)) return false;
  // The first lane with nothing in the way; otherwise the one that gets furthest.
  const side = Math.random() < 0.5 ? -1 : 1;
  let best = null;
  for (const lane of [0.2 * side, 0, -0.2 * side, 0.5 * side, -0.5 * side]) {
    const run = ballFrames(path, lane, toFeet);
    if (!best || (!run.blocked && best.blocked) || (run.blocked === best.blocked && run.frames.length > best.frames.length)) best = run;
    if (!run.blocked) break;
  }
  // Every lane stopped short: the depth map is wrong more often than the corridor is
  // blocked, and a ball that never comes is worse. It rolls down the middle to you.
  const run = best.frames.length > 24 ? best : ballFrames({ ...path, depthAt: null }, 0, toFeet);
  const used = run.frames;
  const contacts = ballContacts().filter((at) => at < run.seconds);
  state.audio?.basketball({ path: used.map((f) => ({ t: f.t, x: f.X, z: f.z, speed: f.speed })), contacts });
  await animateBall(used, run.seconds, scene);
  const last = used[used.length - 1];
  return sameScene(currentScene(), scene) && !best.blocked && toFeet ? last : false;
}

// A basketball drawn as a lit sphere each frame. Its leather is a photo of a worn ball
// (made by Muse Image, its flash lighting taken out): the seams and scuffs turn as it
// rolls, while the light stays put. The corridor's tubes light it from above; the
// camera's flash lights it more the closer it comes, as in every photo of the school.
const BALL_PX = 128;
let ballSkin = null; // { data, size } of ball-texture.png
loadPicture('ball-texture.png')
  .then((img) => {
    const c = document.createElement('canvas');
    c.width = c.height = img.naturalWidth;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    ballSkin = { data: g.getImageData(0, 0, c.width, c.height).data, size: c.width };
  })
  .catch(() => {});

function drawBall(g, angle, flash = 0.5) {
  const image = g.createImageData(BALL_PX, BALL_PX);
  const r = BALL_PX / 2 - 1;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const top = [0.15, -0.82, 0.55]; // the tubes, above and a little in front
  const tn = Math.hypot(...top);
  const L = top.map((v) => v / tn);
  const hl = Math.hypot(L[0], L[1], L[2] + 1);
  const H = [L[0] / hl, L[1] / hl, (L[2] + 1) / hl]; // halfway between the light and the eye
  const skin = ballSkin;
  for (let py = 0; py < BALL_PX; py++) {
    for (let px = 0; px < BALL_PX; px++) {
      const nx = (px + 0.5 - BALL_PX / 2) / r, ny = (py + 0.5 - BALL_PX / 2) / r;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      // Into the ball's own coordinates: it turns about the horizontal axis as it rolls.
      const u = nx, v = ny * ca - nz * sa, w = ny * sa + nz * ca;
      let base = [150, 70, 36];
      if (skin) {
        // The back of a ball looks like its front: the same leather, mirrored through it.
        // Near the photo's rim the leather is squeezed, so it fades into plain leather.
        const tx = Math.min(skin.size - 1, Math.max(0, Math.floor(((u + 1) / 2) * skin.size)));
        const ty = Math.min(skin.size - 1, Math.max(0, Math.floor(((v + 1) / 2) * skin.size)));
        const k = (ty * skin.size + tx) * 4;
        const keep = Math.min(1, Math.max(0, (Math.abs(w) - 0.18) / 0.25));
        if (skin.data[k + 3]) base = [0, 1, 2].map((c) => skin.data[k + c] * keep + base[c] * (1 - keep));
      }
      const tubes = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      const shade = 0.15 + 0.4 * tubes + flash * (0.25 + 0.55 * nz); // the flash is front-on
      const spec = Math.pow(nz, 36) * 0.07 * flash + Math.pow(Math.max(0, nx * H[0] + ny * H[1] + nz * H[2]), 40) * 0.05; // the flash's and the tubes' sheen
      const rim = Math.pow(nz, 0.3);
      const grain = (Math.random() - 0.5) * 14; // the photos' sensor noise
      const i = (py * BALL_PX + px) * 4;
      const lum = (base[0] + base[1] + base[2]) / 3;
      const col = base.map((c) => c * 0.85 + lum * 0.15); // a little less saturated, like the photos
      image.data[i] = Math.min(255, Math.max(0, col[0] * shade * rim * 0.95 + spec * 255 + grain));
      image.data[i + 1] = Math.min(255, Math.max(0, col[1] * shade * rim * 1.02 + spec * 255 + grain));
      image.data[i + 2] = Math.min(255, Math.max(0, col[2] * shade * rim * 0.92 + spec * 255 + grain));
      image.data[i + 3] = d2 > 0.95 ? 255 * (1 - (d2 - 0.95) / 0.05) : 255;
    }
  }
  g.putImageData(image, 0, 0);
}

function animateBall(frames, seconds, scene) {
  const ball = $('#ball');
  const shadow = $('#ball-shadow');
  const reflection = $('#ball-reflection');
  const g = ball.getContext('2d');
  const rg = reflection.getContext('2d');
  const { w, h } = stageSize();
  const ratio = h / w;
  ball.hidden = false;
  shadow.hidden = false;
  reflection.hidden = false;
  const started = performance.now();
  return new Promise((resolve) => {
    const tick = (now) => {
      if (!sameScene(currentScene(), scene) || ball.hidden) return resolve();
      const t = Math.min(seconds, (now - started) / 1000);
      let k = frames.findIndex((f) => f.t >= t);
      if (k === -1) k = frames.length - 1;
      k = Math.max(1, k);
      const a = frames[k - 1], b = frames[k];
      const m = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 1;
      const mix = (key) => a[key] + (b[key] - a[key]) * m;
      const size = mix('size'), floor = mix('floor'), y = mix('y'), x = mix('x');
      const z = mix('z');
      const speed = Math.abs(mix('speed'));
      const flash = Math.min(1, 6 / (z * z)); // flash falloff: dark far away, lit close by
      Object.assign(ball.style, {
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: `${size * ratio * 100}%`,
        opacity: t < 0.15 ? String(t / 0.15) : '1',
        filter: `blur(${(0.35 + Math.min(2.2, speed * 0.22)).toFixed(2)}px)`, // soft like the photo, smeared when fast
      });
      const height = (floor - y) / Math.max(size, 1e-3);
      Object.assign(shadow.style, { left: `${x * 100}%`, top: `${floor * 100}%`, width: `${size * ratio * 115}%`, opacity: String(Math.max(0, 0.8 - height * 0.45)) });
      drawBall(g, mix('spin'), flash);
      // The wet floor mirrors it, faintly, as far below the floor as the ball is above it.
      rg.clearRect(0, 0, BALL_PX, BALL_PX);
      rg.drawImage(ball, 0, 0);
      Object.assign(reflection.style, {
        left: `${x * 100}%`,
        top: `${(floor + (floor - y)) * 100}%`,
        width: `${size * ratio * 100}%`,
        opacity: String(0.2 * (t < 0.15 ? t / 0.15 : 1)),
      });
      if (t < seconds) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

// The last corridor: a basketball bounces out of the dark and rolls to your feet. While
// you watch it, someone is suddenly standing in the corridor. Then the lights stutter
// and they are gone. No camera move: the ball is what pulls your eyes away.
async function ballThenFigure() {
  const scene = currentScene();
  state.busy = true;
  try {
    await extraOf(state.walk, 'flicker', 3000);
    const figure = state.walk?.flicker;
    const flash = $('#flash');
    if (figure?.photo) {
      flash.src = figure.photo;
      flash.dataset.src = figure.photo;
      await flash.decode().catch(() => {});
    }
    // Frames of the same corridor with the figure further and nearer, decoded now so the
    // cuts between them are instant.
    const rush = await Promise.all((figure?.rush ?? []).map(async (url) => {
      const img = new Image();
      img.src = url;
      await img.decode().catch(() => {});
      return url;
    }));
    // The ball takes your eyes all the way down to your feet. Then, without warning,
    // someone comes out of the far end of the corridor straight at you, and it is dark.
    await rollBall({ toFeet: true });
    await pause(700);
    if (!sameScene(currentScene(), scene) || !figure?.photo) return;
    for (const id of ['#ball', '#ball-shadow', '#ball-reflection']) $(id).hidden = true;
    if (!(rush.length >= 3) || REDUCED_MOTION) state.audio?.stinger();
    flash.getAnimations().forEach((a) => a.cancel());
    const stage = $('#stage');
    if (REDUCED_MOTION) {
      flash.style.opacity = '1';
      await pause(600);
    } else if (rush.length >= 3) {
      // The lights stutter, and between each stutter it is nearer: at the far end, halfway,
      // then lunging at you.
      const beats = [
        [rush[0], 220, 120],
        [rush[1], 200, 90],
        [rush[2], 520, 0],
      ];
      for (const [i, [url, show, gap]] of beats.entries()) {
        flash.src = url;
        flash.style.opacity = '1';
        if (i === beats.length - 1) {
          state.audio?.stinger();
          stage.animate(
            [0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({ transform: `translate(${(Math.random() - 0.5) * 18 * (1 - k / 8)}px, ${(Math.random() - 0.5) * 12 * (1 - k / 8)}px)` })),
            { duration: 500 },
          );
          flash.animate([{ transform: 'scale(1)', filter: 'brightness(1.6)' }, { transform: 'scale(1.06)', filter: 'brightness(1)' }], { duration: show, easing: 'ease-out', fill: 'forwards' });
        } else state.audio?.flicker();
        await pause(show);
        if (gap) {
          flash.style.opacity = '';
          stage.classList.add('blackout');
          await pause(gap);
          stage.classList.remove('blackout');
        }
      }
    } else {
      const { vx, vy } = await floorPath(scene); // it comes from where the corridor ends
      flash.style.transformOrigin = `${vx * 100}% ${vy * 100}%`;
      $('#stage').animate(
        [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ transform: `translate(${(Math.random() - 0.5) * 16 * (i / 7)}px, ${(Math.random() - 0.5) * 10 * (i / 7)}px)` })),
        { duration: 520 },
      );
      await flash.animate(
        [
          { opacity: 1, transform: 'scale(1)', filter: 'brightness(1.7) contrast(1.2)' },
          { opacity: 1, transform: 'scale(1.15)', filter: 'brightness(1.1)', offset: 0.5 },
          { opacity: 1, transform: 'scale(1.7)', filter: 'brightness(0.9) blur(2px)' },
        ],
        { duration: 520, easing: 'cubic-bezier(0.55, 0, 0.9, 0.5)', fill: 'forwards' },
      ).finished;
    }
    flash.getAnimations().forEach((a) => a.cancel());
    flash.style.opacity = '';
    flash.style.transformOrigin = '';
    $('#stage').classList.add('blackout');
    await pause(450);
    $('#stage').classList.remove('blackout');
  } finally {
    state.busy = false;
  }
}

// The old television in the corner wakes up with static.
let staticTimer = null;

async function tvStatic(scene, on) {
  const canvas = $('#tv');
  clearInterval(staticTimer);
  canvas.want = on;
  if (!on || !scene?.tv) {
    canvas.hidden = true;
    return;
  }
  // Only on the screen itself: SAM's "television screen", a little inside its edge;
  // without it, the middle of the set, never its casing.
  const tv = scene.tv;
  const screen = scene.screen && boxOverlap(scene.screen, tv) > 0.6 ? scene.screen : { x: tv.x + tv.w * 0.14, y: tv.y + tv.h * 0.16, w: tv.w * 0.62, h: tv.h * 0.6 };
  const inner = { x: screen.x + screen.w * 0.04, y: screen.y + screen.h * 0.05, w: screen.w * 0.92, h: screen.h * 0.9 };
  if (!sameScene(currentScene(), scene) || !canvas.want) return;
  canvas.width = 96;
  canvas.height = 72;
  // In shares of the picture, so it stays on the screen when the window changes size.
  Object.assign(canvas.style, { left: `${inner.x * 100}%`, top: `${inner.y * 100}%`, width: `${inner.w * 100}%`, height: `${inner.h * 100}%`, transform: 'none' });
  canvas.hidden = false;
  const g = canvas.getContext('2d');
  const image = g.createImageData(96, 72);
  const draw = () => {
    for (let i = 0; i < image.data.length; i += 4) {
      const v = Math.random() * 230;
      image.data[i] = v;
      image.data[i + 1] = v;
      image.data[i + 2] = v * 1.05;
      image.data[i + 3] = 255;
    }
    g.putImageData(image, 0, 0);
  };
  draw();
  staticTimer = setInterval(draw, 70);
}

// ---------- the classroom door opens ----------

// Muse Image draws the same close-up with the door standing open. The page shows that
// picture only around the door that changed, sweeping across it the way the door moves:
// the door is the only thing that moves, and whatever stands in front of it stays put.
// No open photo yet, or no clear door in it: nothing moves, and you simply walk in.
const openings = new Map(); // close-up photo -> promise of the opening, or null
const openingNow = new Map(); // the same, once measured

function doorOpening(scene) {
  if (scene?.id !== 'door' || scene.pending || !scene.photo) return Promise.resolve(null);
  if (!openings.has(scene.photo)) {
    const opened = scene.opened
      ? Promise.resolve(scene.opened)
      : REPLAY_SRC
        ? Promise.resolve(null)
        : api('/api/opened', { schoolId: state.schoolId, photo: scene.photo }).then((res) => res.opened ?? null);
    const made = opened
      .then((url) => url && measureOpening(scene, url))
      .catch(() => null)
      .then((opening) => {
        if (opening) openingNow.set(scene.photo, opening);
        const here = currentScene();
        if (opening && sameScene(here, scene) && !state.busy) placeHotspots(here); // the door that opens is the one to click
        return opening;
      });
    openings.set(scene.photo, made);
  }
  return openings.get(scene.photo);
}

// Where the open photo differs from the closed one, around one of the doors SAM found.
async function measureOpening(scene, url) {
  const [closed, open] = await Promise.all([loadPicture(scene.photo), loadPicture(url)]);
  const W = 160;
  const H = Math.round((W * closed.naturalHeight) / closed.naturalWidth);
  const pixels = (img) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, W, H);
    return g.getImageData(0, 0, W, H).data;
  };
  const a = pixels(closed), b = pixels(open);
  let diff = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) diff[i] = (Math.abs(a[i * 4] - b[i * 4]) + Math.abs(a[i * 4 + 1] - b[i * 4 + 1]) + Math.abs(a[i * 4 + 2] - b[i * 4 + 2])) / 3;
  // Soften it (5 x 5), so a door is one patch rather than its edges.
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let sum = 0, n = 0;
        for (let k = -2; k <= 2; k++) {
          const xx = x + k * dx, yy = y + k * dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          sum += diff[yy * W + xx];
          n += 1;
        }
        out[y * W + x] = sum / n;
      }
    diff = out;
  }
  // The whole picture always shifts a little in an edit; a door opening is far more.
  const median = Float32Array.from(diff).sort()[diff.length >> 1];
  const changed = (i) => diff[i] > Math.max(24, median * 3);
  const seen = new Uint8Array(W * H);
  // Only a door about as big as the main one: a cupboard beside it never opens.
  const all = (scene.doors ?? []).filter((d) => doorLike(d, true));
  const main = Math.max(0, ...all.map((d) => d.w * d.h));
  const doors = all.filter((d) => d.w * d.h >= main * 0.5);
  let best = null;
  for (let start = 0; start < W * H; start++) {
    if (seen[start] || !changed(start)) continue;
    const stack = [start];
    seen[start] = 1;
    let count = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
    while (stack.length) {
      const i = stack.pop();
      const x = i % W, y = (i - x) / W;
      count += 1;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (n < 0 || n >= W * H || seen[n] || !changed(n)) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (count < W * H * 0.01) continue;
    const patch = { x: x0 / W, y: y0 / H, w: (x1 + 1 - x0) / W, h: (y1 + 1 - y0) / H };
    // The door it belongs to: the SAM door the change lies on or right beside (a door
    // sliding aside opens the doorway next to where its box was; a box hidden at its foot
    // by something in front still stands on the floor below).
    const cover = (d) => {
      const dx = d.x - d.w * 0.6, dw = d.w * 2.2, dh = d.h * 1.5;
      const w = Math.max(0, Math.min(dx + dw, patch.x + patch.w) - Math.max(dx, patch.x));
      const h = Math.max(0, Math.min(d.y + dh, patch.y + patch.h) - Math.max(d.y, patch.y));
      return (w * h) / (patch.w * patch.h);
    };
    const door = [...doors].sort((p, q) => cover(q) - cover(p))[0];
    if (!door || cover(door) < 0.5) continue;
    if (!best || count > best.count) best = { count, patch, door };
  }
  if (!best) return null;
  const { patch, door } = best;
  const pad = 0.015;
  const x = Math.max(0, Math.min(patch.x, door.x) - pad);
  const y = Math.max(0, Math.min(patch.y, door.y) - pad);
  const region = { x, y, w: Math.min(1, Math.max(patch.x + patch.w, door.x + door.w) + pad) - x, h: Math.min(1, Math.max(patch.y + patch.h, door.y + door.h) + pad) - y };
  if (region.w * region.h > 0.45) return null; // the edit changed far more than a door
  // An open door is a doorway gone dark. Where it went dark is the side the door opens
  // from; too little of it, and the door did not really open: nothing moves.
  let dark = 0, total = 0, sumX = 0;
  for (let yy = Math.floor(region.y * H); yy < Math.min(H, Math.ceil((region.y + region.h) * H)); yy++)
    for (let xx = Math.floor(region.x * W); xx < Math.min(W, Math.ceil((region.x + region.w) * W)); xx++) {
      const i = (yy * W + xx) * 4;
      const after = (b[i] + b[i + 1] + b[i + 2]) / 3;
      const drop = (a[i] + a[i + 1] + a[i + 2]) / 3 - after;
      total += 1;
      if (after < 55 && drop > 35) {
        dark += 1;
        sumX += xx / W;
      }
    }
  if (dark < total * 0.05) return null;
  const fromRight = sumX / dark > region.x + region.w / 2;
  // The open door alone, with soft edges (a small mask, smoothly enlarged), and the
  // picture as it is once the door is open.
  const NW = closed.naturalWidth, NH = closed.naturalHeight;
  const mask = document.createElement('canvas');
  mask.width = 96;
  mask.height = Math.round((96 * NH) / NW);
  const m = mask.getContext('2d');
  m.fillStyle = '#000';
  m.fillRect(region.x * mask.width, region.y * mask.height, region.w * mask.width, region.h * mask.height);
  const layer = document.createElement('canvas');
  layer.width = NW;
  layer.height = NH;
  const g = layer.getContext('2d');
  g.drawImage(open, 0, 0, NW, NH);
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = true;
  g.drawImage(mask, 0, 0, NW, NH);
  const still = document.createElement('canvas');
  still.width = NW;
  still.height = NH;
  const sg = still.getContext('2d');
  sg.drawImage(closed, 0, 0, NW, NH);
  sg.drawImage(layer, 0, 0);
  const blob = await new Promise((resolve) => still.toBlob(resolve, 'image/jpeg', 0.93));
  if (!blob) return null;
  return { door, region, fromRight, layer, still: URL.createObjectURL(blob) };
}

// Opening: the open door sweeps in across its own patch, from the side it opens away
// from. Returns the place as it now looks (the door open), to walk on from.
async function openDoor() {
  const scene = currentScene();
  const opening = await Promise.race([doorOpening(scene), pause(1200).then(() => null)]);
  state.audio?.slideDoor();
  if (!opening) return pause(500).then(() => null);
  const photo = $('#photo');
  if (!REDUCED_MOTION) {
    const canvas = $('#door-open');
    const { layer, region, fromRight } = opening;
    canvas.width = layer.width;
    canvas.height = layer.height;
    const g = canvas.getContext('2d');
    const x0 = region.x * layer.width, x1 = (region.x + region.w) * layer.width;
    const soft = (x1 - x0) * 0.3;
    const draw = (p) => {
      const edge = fromRight ? x1 - p * (x1 - x0 + soft) : x0 + p * (x1 - x0 + soft);
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.drawImage(layer, 0, 0);
      g.globalCompositeOperation = 'destination-in';
      const sweep = g.createLinearGradient(edge, 0, fromRight ? edge + soft : edge - soft, 0);
      sweep.addColorStop(0, 'rgba(0,0,0,0)');
      sweep.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = sweep;
      g.fillRect(0, 0, canvas.width, canvas.height);
    };
    draw(0);
    canvas.hidden = false;
    const ms = 850;
    const start = performance.now();
    await new Promise((resolve) => {
      const tick = (now) => {
        const k = Math.min(1, (now - start) / ms);
        draw(k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
        if (k < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }
  photo.src = opening.still; // the same picture, now as the photo under everything
  await photo.decode().catch(() => {});
  $('#door-open').hidden = true;
  await pause(250);
  return { ...scene, photo: opening.still };
}

// A frame that is there for a moment and gone: a stinger, the room shakes, then black.
async function jumpScare(photo) {
  const frame = $('#scare');
  frame.src = photo;
  await frame.decode().catch(() => {});
  frame.hidden = false;
  state.audio?.stinger();
  if (!REDUCED_MOTION) {
    frame.animate([{ transform: 'scale(1)', filter: 'brightness(1.8) contrast(1.2)' }, { transform: 'scale(1.03)', filter: 'brightness(1)', offset: 0.2 }, { transform: 'scale(1.09)', filter: 'brightness(0.9)' }], { duration: 1100, easing: 'ease-out' });
    $('#stage').animate(
      [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ transform: `translate(${(Math.random() - 0.5) * 18 * (1 - i / 8)}px, ${(Math.random() - 0.5) * 12 * (1 - i / 8)}px)` })),
      { duration: 600 },
    );
  }
  await pause(1100);
  frame.hidden = true;
  $('#stage').classList.add('blackout');
  await pause(1300);
}

// After you answer, every head in the room turns to you. Nobody moves. Then the whole
// class slaps its desks at once, twice, and the lights go out.
async function theyTurn(photo) {
  const frame = $('#scare');
  frame.src = photo;
  await frame.decode().catch(() => {});
  $('#board-name').hidden = true;
  $('#marks').replaceChildren();
  // The last scare: a hard cut to every masked face at once, a stinger, and the room
  // lurches towards you.
  frame.hidden = false;
  state.audio?.stinger();
  if (!REDUCED_MOTION) {
    frame.animate(
      [{ transform: 'scale(1)', filter: 'brightness(1.9) contrast(1.25)' }, { transform: 'scale(1.04)', filter: 'brightness(1)', offset: 0.18 }, { transform: 'scale(1.08)', filter: 'brightness(0.95)' }],
      { duration: 2200, easing: 'ease-out', fill: 'forwards' },
    );
    $('#stage').animate(
      [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ transform: `translate(${(Math.random() - 0.5) * 18 * (1 - i / 8)}px, ${(Math.random() - 0.5) * 12 * (1 - i / 8)}px)` })),
      { duration: 600 },
    );
  }
  await pause(2200);
  for (const gap of [0, 650]) {
    await pause(gap);
    state.audio?.slap();
    if (!REDUCED_MOTION) {
      $('#stage').animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(6px) scale(1.012)', offset: 0.15 }, { transform: 'translateY(0) scale(1)' }], { duration: 260 });
      frame.animate([{ filter: 'brightness(1.5)' }, { filter: 'brightness(1)' }], { duration: 200 });
    }
  }
  await pause(900);
  state.audio?.flicker();
  frame.hidden = true;
  frame.getAnimations().forEach((a) => a.cancel());
  $('#stage').classList.add('blackout');
  await pause(2200);
}

// The flicker frame: while a tube flickers, someone is standing down the corridor.
let flickerTimer = null;

function scheduleFlicker(first = false) {
  clearTimeout(flickerTimer);
  const index = state.walk?.index ?? 0;
  const hasFigure = Boolean(state.walk?.flicker) && index !== 2;
  const waitMs = first && hasFigure ? 3500 + Math.random() * 1500 : (6000 + Math.random() * 9000) / (1 + index * 0.5);
  flickerTimer = setTimeout(() => {
    if (!$('#walk-screen').hidden && !state.busy) flicker();
    if (!$('#walk-screen').hidden) scheduleFlicker();
  }, waitMs);
}

function flicker() {
  state.audio?.flicker();
  if (REDUCED_MOTION) return;
  $('#stage').animate(
    [
      { filter: 'brightness(1)' },
      { filter: 'brightness(0.35)', offset: 0.2 },
      { filter: 'brightness(1)', offset: 0.45 },
      { filter: 'brightness(0.6)', offset: 0.6 },
      { filter: 'brightness(1)' },
    ],
    { duration: 420 },
  );
  const figure = state.walk?.flicker;
  const saved = state.walk?.index === 2; // the last corridor keeps its figure for when you look up
  if (figure && !saved && currentScene()?.id === figure.scene) {
    const flash = $('#flash');
    if (flash.dataset.src !== figure.photo) {
      flash.src = figure.photo;
      flash.dataset.src = figure.photo;
    }
    flash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 1, offset: 0.42 }, { opacity: 0, offset: 0.46 }, { opacity: 0.8, offset: 0.6 }, { opacity: 0 }], { duration: 420 });
  }
}

// ---------- moving between photos ----------

function render(scene) {
  stopDarkWalk?.();
  trackPlace(scene.id);
  placeDateStamp();
  $('#stage').classList.remove('blackout');
  state.audio?.night(scene.id === 'corridor' ? 'open' : 'inside'); // the corridor is open to the night
  $('#photo').alt = t(`alt_${scene.id}`);
  placeHotspots(scene);
  placeName(scene);
  placeChoices(scene);
  placeMarks(scene);
  if (isChoiceScene(scene) && !state.pick) say(scene.id === 'office' ? `${t('officeLine')} ${t('eraseHint')}` : t('eraseHint'));
}

const WARP_BY_WALK = [0, 0.45, 0.9];
const warpNow = () => WARP_BY_WALK[Math.min(state.walk?.index ?? 0, WARP_BY_WALK.length - 1)];
const followed = () => state.walk.index >= 1 && Math.random() < 0.5;

function clearOverlays() {
  for (const id of ['#ball', '#ball-shadow', '#ball-reflection']) {
    $(id).getAnimations().forEach((a) => a.cancel());
    $(id).hidden = true;
  }
  $('#hotspots').replaceChildren();
  $('#door-open').hidden = true;
  $('#board-name').hidden = true;
  $('#board-choices').hidden = true;
  $('#marks').replaceChildren();
  tvStatic(null, false);
}

async function stepInto(scene, from = currentScene()) {
  const photo = $('#photo');
  const next = $('#photo-next');
  clearOverlays();
  const follow = followed();
  if (walker) {
    const walked = await walk3d(async () => {
      await walker.walk(from, scene, WALK_MS, { warp: warpNow(), onStart: () => state.audio?.footsteps(3, follow) });
      photo.src = scene.photo; // swap under the canvas so nothing flashes
      await photo.decode().catch(() => {});
    });
    if (walked) return;
  }
  next.src = scene.photo;
  await next.decode().catch(() => {});
  if (!walker) state.audio?.footsteps(3, follow);
  const leave = REDUCED_MOTION
    ? [{ opacity: 1 }, { opacity: 0 }]
    : [
        { transform: 'scale(1) translateY(0)', filter: 'blur(0px)', opacity: 1 },
        { transform: 'scale(1.14) translateY(0.4%)', offset: 0.5 },
        { transform: 'scale(1.3) translateY(0)', filter: 'blur(6px)', opacity: 0 },
      ];
  const out = photo.animate(leave, { duration: STEP_MS, easing: 'ease-in', fill: 'forwards' });
  const into = next.animate(
    REDUCED_MOTION ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'scale(0.94)' }, { opacity: 1, transform: 'scale(1)' }],
    { duration: STEP_MS * 0.7, delay: STEP_MS * 0.3, easing: 'ease-out', fill: 'forwards' },
  );
  await Promise.all([out.finished, into.finished]);
  photo.src = scene.photo;
  await photo.decode().catch(() => {});
  out.cancel();
  into.cancel();
}

// Out of the dark into a photo: the start of a walk, or after a scare.
async function arriveAt(scene) {
  const photo = $('#photo');
  clearOverlays();
  photo.src = scene.photo;
  await photo.decode().catch(() => {});
  $('#stage').classList.remove('blackout');
  const stepsIn = state.stepsOnArrive ?? 0;
  state.stepsOnArrive = 0;
  if (!(walker && (await walk3d(() => walker.arrive(scene, ARRIVE_MS, { warp: warpNow(), onStart: () => stepsIn && state.audio?.footsteps(stepsIn) }))))) {
    if (stepsIn) state.audio?.footsteps(stepsIn);
    photo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1400, easing: 'ease-out' });
  }
}

// The same place even when its view was refreshed (a depth map arriving later).
const sameScene = (a, b) => Boolean(a && b && a.id === b.id && a.photo === b.photo);

const preload = (url) => {
  if (url) new Image().src = url;
};

// A walk arrives a place at a time: the corridor first (its depth map a little later),
// then the other places, and the scares while you walk.
function fillWalk(walk) {
  const take = (i, res) => {
    if (res.bible) state.bible = { ...state.bible, ...res.bible };
    const view = res.view;
    walk.scenes[i] = view;
    preload(view.photo);
    doorOpening(view); // the open door is measured before you get there
    if (state.walk === walk && state.sceneIndex === i) {
      walker?.forget(view.photo); // its depth map may have just arrived
      if (!state.busy) {
        placeHotspots(view);
        placeName(view, state.answered);
      }
    }
    return view;
  };
  walk.filling = walk.scenes.map((scene, i) => {
    if (!scene.pending && !scene.refine) return Promise.resolve(scene);
    const ask = (full) => api('/api/scene', { schoolId: state.schoolId, id: scene.id, full }).then((res) => take(i, res));
    // First the photo and its doors (enough to walk in), then the same with its depth map.
    const quick = scene.pending ? ask(false) : Promise.resolve(scene);
    quick.then(() => ask(true)).catch(() => {});
    quick.catch((err) => {
      if (state.walk === walk) showError(err.message);
    });
    return quick;
  });
  walk.ready = {};
  for (const want of ['scare', 'flicker']) {
    walk.ready[want] = walk.pending
      ? api('/api/extras', { schoolId: state.schoolId, want })
          .then((res) => {
            walk[want] = res[want];
            preload(res[want]?.photo);
          })
          .catch(() => {})
      : Promise.resolve();
  }
}

// Waits for one of the walk's scares, but never forever.
function extraOf(walk, want, ms) {
  return Promise.race([walk?.ready?.[want] ?? Promise.resolve(), pause(ms)]);
}

async function beginWalk(walk, line, sound) {
  state.walk = walk;
  state.sceneIndex = 0;
  state.pick = null;
  state.erased = new Set();
  if (!state.last) fetchLines();
  preload(walk.flicker?.photo);
  preload(walk.scare?.photo);
  walk.scenes.forEach((scene) => {
    preload(scene.photo);
    doorOpening(scene);
  });
  applySound(sound);
  show('walk-screen');
  say(line ?? '');
  state.stepsOnArrive = 4; // heard as the walk-in starts
  await arriveAt(walk.scenes[0]);
  render(walk.scenes[0]);
  scheduleFlicker(true);
  scheduleEvents();
  onArrive(walk.scenes[0]);
}

// What happens when you reach a place.
function onArrive(scene) {
  const index = state.walk.index;
  if (scene.id === 'corridor' && index === 1) {
    setTimeout(() => announce(t('paOffice'), 'office'), 2200);
  }
  if (scene.id === 'corridor' && index === 2) setTimeout(() => ballThenFigure(), 2500);
  if (isEndingScene(scene)) rollCall(scene);
}

async function advance() {
  if (state.busy) return;
  const from = currentScene();
  const next = state.sceneIndex + 1;
  if (next >= state.walk.scenes.length) {
    if (state.last) return;
    return from.board ? walkBack() : openCards(); // cards only if no chalkboard was found
  }
  state.busy = true;
  try {
    let scene = state.walk.scenes[next];
    if (scene.pending) {
      waitInTheDark(state.walk.filling[next]);
      scene = await state.walk.filling[next];
    }
    // Only the second walk has someone behind the door; wait for that frame, never longer.
    if (from.id === 'door' && state.walk.pending && state.walk.index === 1) await extraOf(state.walk, 'scare', 8000);
    const scare = state.walk.scare?.after === from.id ? state.walk.scare : null;
    const leaving = (from.id === 'door' && (await openDoor())) || from;
    if (scare) {
      // The door opens onto the corridor where you started, and someone is in it.
      await jumpScare(scare.photo);
      state.sceneIndex = next;
      await arriveAt(scene);
    } else {
      await stepInto(scene, leaving);
      state.sceneIndex = next;
    }
    render(scene);
    onArrive(scene);
  } finally {
    state.busy = false;
  }
}

// ---------- roll call ----------

const ANSWER = /有|到|here|present|yes|yeah/i;

// The speaker calls your name. You answer out loud; the room hears you.
async function rollCall(scene) {
  state.busy = true;
  const name = state.name || t('noName');
  const roll = $('#roll');
  try {
    await pause(2500);
    tvStatic(scene, true);
    say(state.lang === 'zh' ? `${name}。` : `${name}.`);
    state.audio?.speaker();
    await pause(2300);
    await callName(name);
    await pause(900);
    await callName(name, { second: true }); // the second time, slower
    roll.hidden = false;
    say(t('rollCall'));
    let answer = await waitForAnswer(9000);
    let calls = 1;
    if (!answer.heard) {
      await callName(name, { louder: true });
      answer = await waitForAnswer(9000);
      calls = 2;
    } else if (answer.recording && state.live) {
      const words = await transcribe(answer.recording, 'answer').catch(() => '');
      if (words && !ANSWER.test(words)) {
        say(t('wrongAnswer'));
        await pause(1200);
        await callName(name, { louder: true });
        await waitForAnswer(7000);
      }
    }
    roll.hidden = true;
    say('');
    Object.assign(state.stats, { answered: Boolean(answer.heard), delay: Math.round(answer.after ?? 0), calls, spoken: Boolean(answer.spoken) });
    state.report = requestReport(); // written while the class turns around
    tvStatic(scene, false);
    state.audio?.silence(true);
    await pause(1400);
    state.audio?.silence(false);
    await extraOf(state.walk, 'scare', 25000);
    const scare = state.walk.scare;
    if (scare?.kind === 'turn') await theyTurn(scare.photo);
    else if (scare) await jumpScare(scare.photo);
    if (scene.after) {
      // The lights come back. Everyone is gone; their shirts are folded on the chairs.
      const photo = $('#photo');
      photo.src = scene.after;
      await photo.decode().catch(() => {});
    }
    $('#stage').classList.remove('blackout');
    state.answered = true;
    placeName(scene, true); // now it is clear whose name is on the board
    placeMarks(scene);
    state.audio?.chalk(1.4);
    await pause(1300);
    state.audio?.bell();
    await pause(4200);
  } finally {
    roll.hidden = true;
    state.busy = false;
  }
  finish();
}

// Resolves when the player answers: out loud (heard by the microphone) or with the button.
function waitForAnswer(ms) {
  const asked = performance.now();
  return new Promise((resolve) => {
    const button = $('#roll-here');
    let done = false;
    const finishWith = (result) => {
      if (done) return;
      done = true;
      button.onclick = null;
      listening.cancel();
      resolve(result);
    };
    button.onclick = () => finishWith({ heard: true, recording: null, spoken: false, after: (performance.now() - asked) / 1000 });
    const listening = voice.listen({ ms, record: state.live });
    listening.result.then((result) => finishWith({ ...result, spoken: Boolean(result.heard), after: (performance.now() - asked) / 1000 }));
  });
}

// ---------- cards (only if no chalkboard was found) ----------

function photoCard(i) {
  const button = el('button', null, 'card');
  button.type = 'button';
  button.setAttribute('aria-label', `${t('card')} ${i + 1}`);
  const inner = el('div', null, 'card-inner');
  const back = el('div', null, 'card-face card-back');
  back.append(el('span', state.lang === 'zh' ? '值日生' : 'ON DUTY', 'pencil'));
  const front = el('div', null, 'card-face card-front');
  inner.append(back, front);
  button.append(inner);
  button.addEventListener('click', () => draw(i));
  return button;
}

function openCards() {
  show('card-screen');
  showError('');
  $('#card-prompt').textContent = t('pick');
  $('#walk-on').hidden = true;
  $('#cards').replaceChildren(...[0, 1, 2].map(photoCard));
}

function draw(index) {
  const buttons = [...$('#cards').children];
  return guarded(t('changing'), async () => {
    buttons.forEach((b, i) => {
      b.disabled = true;
      b.classList.toggle('chosen', i === index);
    });
    const res = await api('/api/draw', { schoolId: state.schoolId, index });
    const card = res.cards[index];
    const words = cardText(card);
    const front = buttons[index].querySelector('.card-front');
    const picture = document.createElement('img');
    picture.src = res.walk.scenes[0].photo;
    picture.alt = '';
    const text = el('div', null, 'words');
    text.append(el('strong', words.title), el('span', words.whisper));
    front.replaceChildren(picture, text);
    buttons[index].classList.add('flipped');
    buttons.forEach((b, i) => b.classList.toggle('other', i !== index));
    state.last = res.last;
    const walkOn = $('#walk-on');
    walkOn.textContent = t('walkOn');
    walkOn.hidden = false;
    walkOn.onclick = () => beginWalk(res.walk, words.whisper, card.sound);
  });
}

// ---------- ending ----------

function bookDate() {
  const today = new Date();
  const year = schoolYear();
  if (state.lang === 'zh') return `民國 ${year - 1911} 年 ${today.getMonth() + 1} 月 ${today.getDate()} 日`;
  return new Date(year, today.getMonth(), today.getDate()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderBook() {
  const report = state.reportText ?? {};
  return drawContactBook(
    $('#book'),
    { ...state.ending, ...report, comment_en: state.lang === 'en' ? report.comment : state.ending.comment_en, scores: state.bible?.scores, name: state.name, date: bookDate(), lang: state.lang },
    $('#hide-name').checked,
  ).then((drawn) => {
    bookPhotos = drawn?.photos ?? [];
    return drawn;
  });
}

// The two photos taped into the book, then and now: click one to see it large, click
// the large one to turn to the other, click beside it (or Esc) to put it back.
let bookPhotos = [];

function photoAt(event) {
  const canvas = $('#book');
  const r = canvas.getBoundingClientRect();
  const x = ((event.clientX - r.left) / r.width) * canvas.width;
  const y = ((event.clientY - r.top) / r.height) * canvas.height;
  return [...bookPhotos].reverse().find((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) ?? null; // the one on top first
}

function showBookPhoto(index) {
  const photo = bookPhotos[index];
  if (!photo?.src) return;
  const view = $('#photo-view');
  view.dataset.index = String(index);
  $('#photo-view-img').src = photo.src;
  $('#photo-view-caption').textContent = `${photo.caption}　${t('otherPhoto')}`;
  view.hidden = false;
}

$('#book').addEventListener('mousemove', (event) => {
  $('#book').style.cursor = photoAt(event) ? 'zoom-in' : '';
});
$('#book').addEventListener('click', (event) => {
  const photo = photoAt(event);
  if (photo) showBookPhoto(bookPhotos.indexOf(photo));
});
$('#photo-view').addEventListener('click', (event) => {
  if (event.target.id === 'photo-view-img' && bookPhotos.length > 1) showBookPhoto((Number($('#photo-view').dataset.index) + 1) % bookPhotos.length);
  else $('#photo-view').hidden = true;
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') $('#photo-view').hidden = true;
});

// The afternoon after. The teacher watches from the door while the credits roll; when
// they end, nobody is there. Then the title, and below it tonight's contact book.
async function finish() {
  state.audio?.night('off');
  // Only the wait for the afternoon photo shows "the bell"; the ending itself does not.
  await guarded(t('bellWait'), async () => {
    const [ending, report] = await Promise.all([api('/api/ending', { schoolId: state.schoolId }), state.report ?? requestReport()]);
    state.ending = ending;
    state.reportText = report;
  });
  if (!state.ending) return;
  {
    const ending = state.ending;
    show('ending-screen');
    const daylight = $('#daylight');
    const empty = $('#daylight-empty');
    daylight.src = ending.daylight;
    daylight.alt = t('alt_daylight');
    empty.src = ending.daylightEmpty || ending.daylight;
    empty.alt = t('alt_daylight');
    empty.style.opacity = '0';
    $('#end-title').hidden = true;
    $('#report').hidden = true;
    $('#ending-line').textContent = t('ending');
    $('#hide-label').textContent = t('hide');
    $('#download').textContent = t('download');
    $('#again').textContent = t('again');
    $('#home').textContent = t('home');
    applySound('none');
    await renderBook();
    await pause(5000);
    await rollCredits();
    // Gone. Then the room goes dark, and the title comes back as it was at the start.
    await empty.animate([{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_MOTION ? 1 : 2200, easing: 'ease-in-out', fill: 'forwards' }).finished;
    await pause(1600);
    const frame = $('#daylight-frame');
    await frame.animate([{ opacity: 1 }, { opacity: 0 }], { duration: REDUCED_MOTION ? 1 : 1800, easing: 'ease-in', fill: 'forwards' }).finished;
    frame.hidden = true;
    $('#ending-line').hidden = true;
    const title = $('#end-title');
    title.hidden = false;
    title.animate([{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_MOTION ? 1 : 2000, fill: 'forwards' });
    await pause(2400);
    const page = $('#report');
    page.hidden = false;
    page.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: REDUCED_MOTION ? 1 : 1200, fill: 'forwards' }); // below the title; you scroll to it
  }
}

// The credits roll over the contact book, then leave it to you.
let creditsRolled = false;

function rollCredits() {
  if (creditsRolled || $('#ending-screen').hidden) return Promise.resolve();
  creditsRolled = true;
  const layer = $('#credits');
  const list = $('#credits-list');
  list.replaceChildren(
    ...CREDITS[state.lang].map(([kind, a, b]) => {
      if (kind === 'title') return el('h2', a, 'credit-title');
      if (kind === 'gap') return el('div', null, 'credit-gap');
      if (kind === 'line') return el('p', a, 'credit-line');
      if (kind === 'duty') return el('p', `${t('onDuty')}${state.lang === 'zh' ? '：' : ': '}${state.name || t('noName')}`, 'credit-duty');
      const row = el('div', null, 'credit-role');
      row.append(el('span', a, 'credit-what'), el('span', b, 'credit-who'));
      return row;
    }),
  );
  $('#credits-skip').textContent = t('skip');
  layer.hidden = false;
  const roll = REDUCED_MOTION
    ? null
    : list.animate([{ transform: 'translateY(100vh)' }, { transform: 'translateY(-100%)' }], { duration: 30000, easing: 'linear', fill: 'forwards' });
  return new Promise((resolve) => {
    const close = () => {
      roll?.cancel();
      layer.hidden = true;
      resolve();
    };
    layer.onclick = close;
    if (roll) roll.finished.then(close, () => {});
    else setTimeout(close, 8000);
  });
}

$('#hide-name').addEventListener('change', renderBook);

$('#download').addEventListener('click', () => {
  $('#book').toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'last-one-out-contact-book.png';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
});

$('#again').addEventListener('click', () => location.reload());
$('#home').addEventListener('click', () => location.assign(location.pathname));

$('#name').addEventListener('input', () => {
  $('#duty-name').textContent = $('#name').value.trim() || '＿＿＿';
});

// ---------- speaking your memories ----------

// Say your name once at the start; it never leaves the browser. Click to start, click
// again (or wait four seconds) to stop; you hear it back on the school speaker.
function setupNameVoice() {
  const button = $('#name-voice');
  if (!button) return;
  button.hidden = !voice.canRecord;
  button.textContent = t('sayName');
  let recording = false;
  button.addEventListener('click', async () => {
    if (recording) return voice.stopDictation();
    state.audio ??= createAudio(); // from a click
    recording = true;
    button.classList.add('recording');
    button.textContent = t('stop');
    showError('');
    try {
      const wav = await voice.dictate({ maxMs: 4000 });
      recording = false;
      button.classList.remove('recording');
      button.textContent = '…';
      const played = await state.audio?.loudspeaker(wav); // false: nothing loud enough in it
      if (!played) throw new Error('too quiet');
      state.nameVoice = wav;
      button.textContent = t('nameSaid');
    } catch {
      showError(t('nameTooQuiet'));
      button.textContent = t('sayName');
    } finally {
      recording = false;
      button.classList.remove('recording');
    }
  });
}

function setupDictation() {
  for (const button of document.querySelectorAll('.mic[data-for]')) {
    const input = $(`#${button.dataset.for}`);
    button.hidden = !state.live || !voice.canRecord;
    button.addEventListener('click', async () => {
      if (button.classList.contains('recording')) return voice.stopDictation();
      button.classList.add('recording');
      button.textContent = t('stop');
      showError('');
      try {
        const wav = await voice.dictate({ maxMs: 15000 });
        button.classList.remove('recording');
        button.textContent = '…';
        button.disabled = true;
        const words = await transcribe(wav, 'memory');
        if (words) input.value = words.slice(0, 200);
      } catch {
        showError(t('micFailed'));
      } finally {
        button.classList.remove('recording');
        button.disabled = false;
        button.textContent = t('speak');
      }
    });
  }
}

// ---------- start ----------

// While the school is remembered: the speaker sends everyone home, then the first line.
// While the school is remembered: the speaker sends everyone home, your memories come
// back one at a time, and the year rolls back to yours. Then the first line.
const INTRO_MS = 22000; // about how long this takes; the server waits this long for the best corridor

async function intro(memories, year) {
  const layer = $('#intro');
  const line = $('#intro-line');
  layer.hidden = false;
  line.textContent = '';
  await pause(600);
  typeLine(line, t('paHome'));
  await announce(t('paHome'), 'home');
  await pause(700);
  for (const memory of memories) {
    typeLine(line, memory);
    state.audio?.chalk?.(0.5);
    await pause(Math.min(4200, 1400 + [...memory].length * 140));
  }
  if (year) {
    // The years roll back to yours.
    const from = new Date().getFullYear();
    const steps = Math.max(1, from - year);
    for (let y = from; y > year; y--) {
      line.textContent = String(y);
      await pause(Math.min(260, 3200 / steps));
    }
    typeLine(line, state.lang === 'zh' ? `${year} 年。` : `${year}.`);
    await pause(1800);
  }
  typeLine(line, t('firstLine'));
  await pause(3200);
}

// What the player did tonight, for the contact book: no name, only actions and times.
const newStats = () => ({ start: Date.now(), locked: 0, kept: [], erased: [], place: {}, here: null, since: 0, answered: false, delay: 0, calls: 1, spoken: false });

function trackPlace(id) {
  const stats = state.stats;
  if (!stats) return;
  const now = Date.now();
  if (stats.here) stats.place[stats.here] = (stats.place[stats.here] ?? 0) + (now - stats.since);
  stats.here = id;
  stats.since = now;
}

function playedFacts() {
  trackPlace(state.stats.here);
  const st = state.stats;
  const longest = Object.entries(st.place).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'corridor';
  return { answered: st.answered, delay: st.delay, calls: st.calls, spoken: st.spoken, locked: st.locked, longest, minutes: Math.max(1, Math.round((Date.now() - st.start) / 60000)), kept: st.kept, erased: st.erased };
}

const PLACE = { zh: { corridor: '走廊', door: '教室門口', classroom: '教室', office: '辦公室' }, en: { corridor: 'the corridor', door: 'the classroom door', classroom: 'the classroom', office: "the teachers' office" } };

// The contact book from the facts alone (the replay, or when Muse Spark is not there).
function factsReport(f) {
  const zh = state.lang === 'zh';
  const quote = (list) => list.filter(Boolean).map((x) => (zh ? `「${x}」` : `“${x}”`)).join(zh ? '' : ', ');
  const roll = f.answered
    ? zh
      ? `點名：${f.delay} 秒後答「有」${f.calls > 1 ? '（叫了兩次）' : ''}`
      : `Roll call: answered after ${f.delay}s${f.calls > 1 ? ' (called twice)' : ''}`
    : zh
      ? '點名：沒有回答'
      : 'Roll call: no answer';
  const record = [
    `${zh ? '擦掉：' : 'Erased: '}${quote(f.erased)}`,
    `${zh ? '留下：' : 'Kept: '}${quote(f.kept)}`,
    roll,
    f.locked ? (zh ? `試開鎖住的門：${f.locked} 扇` : `Locked doors tried: ${f.locked}`) : '',
    zh ? `待最久：${PLACE.zh[f.longest]}` : `Stayed longest: ${PLACE.en[f.longest]}`,
  ].filter(Boolean);
  const kept = f.kept[f.kept.length - 1] ?? '';
  const erased = f.erased[0] ?? '';
  const answer = !f.answered
    ? zh ? '點名的時候你沒有回答。老師還是把你的名字寫上去了。' : 'You did not answer the roll call. I wrote your name down anyway.'
    : f.delay > 4 || f.calls > 1
      ? zh ? '你過了很久才回答。沒關係，老師一直都知道你在。' : 'You took a long time to answer. It is all right. I always knew you were there.'
      : zh ? '你回答得很快，好像一直在等人叫你的名字。' : 'You answered at once, as if you had been waiting for someone to say your name.';
  return {
    record: record.join(zh ? '。' : '. ') + (zh ? '。' : '.'),
    diary: zh
      ? `今天我是值日生。我擦掉了${quote(f.erased)}，留下了${quote(f.kept)}。${f.answered ? `點名的時候，我過了${f.delay}秒才說有。` : '點名的時候，我沒有說話。'}`
      : `Today I was on duty. I erased ${quote(f.erased)} and kept ${quote(f.kept)}. ${f.answered ? `At roll call I took ${f.delay} seconds to say here.` : 'At roll call I said nothing.'}`,
    comment: `${erased && kept ? (zh ? `你擦掉了「${erased}」，卻留下了「${kept}」。` : `You wiped away “${erased}” and kept “${kept}”. `) : ''}${answer}`,
    comment_en: '',
    bring: zh ? '紅色水桶' : 'The red bucket.',
  };
}

function requestReport() {
  const facts = playedFacts();
  const local = factsReport(facts);
  if (REPLAY_SRC || !state.live) return Promise.resolve(local);
  const { kept, erased, ...stats } = facts;
  return api('/api/report', { schoolId: state.schoolId, stats })
    .then((written) => {
      const en = state.lang === 'en';
      const pick = (zh, english) => (en ? written[english] || written[zh] : written[zh]);
      return {
        ...local,
        diary: pick('diary', 'diary_en') || local.diary,
        comment: pick('comment', 'comment_en') || local.comment,
        bring: pick('bring', 'bring_en') || local.bring,
      };
    })
    .catch(() => local);
}

$('#start-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (state.busy) return;
  state.stats = newStats();
  state.name = $('#name').value.trim();
  const memories = ['#m1', '#m2', '#m3'].map((id) => $(id).value.trim()).filter(Boolean);
  const year = Number($('#year').value) || undefined;
  state.audio ??= createAudio(); // must start from a click
  voice.warmUp(); // asks for the microphone now, not in the middle of the dark
  state.busy = true;
  showError('');
  show('walk-screen');
  $('#stage').classList.add('blackout');
  const school = api('/api/school', { memories, lang: state.lang, year, patience: INTRO_MS }); // the name is not sent
  school.catch(() => {});
  intro(memories, year)
    .then(async () => {
      loading(t('remembering'));
      const res = await school;
      state.schoolId = res.schoolId;
      state.draws = res.draws;
      state.bible = res.bible;
      fillWalk(res.walk);
      state.shownYear = null;
      $('#intro').hidden = true;
      loading(null);
      state.busy = false;
      await beginWalk(res.walk, t('firstLine'), 'none');
    })
    .catch((err) => {
      loading(null);
      $('#intro').hidden = true;
      state.busy = false;
      show('title-screen');
      showError(err.message);
    });
});

window.addEventListener('resize', () => {
  if (!state.walk || $('#walk-screen').hidden) return;
  const scene = currentScene();
  placeName(scene, state.answered);
  placeMarks(scene);
});

function fillReplayMemories(run) {
  const memories = state.lang === 'en' && run.memories_en?.length ? run.memories_en : run.memories;
  ['#m1', '#m2', '#m3'].forEach((id, i) => {
    $(id).value = memories[i] ?? '';
    $(id).readOnly = true;
  });
  if (run.bible?.year) {
    $('#year').value = run.bible.year;
    $('#year').readOnly = true;
  }
}

async function prepare() {
  if (REPLAY_SRC) {
    try {
      fillReplayMemories(await loadReplay());
    } catch (err) {
      showError(err.message);
    }
  } else {
    try {
      const status = await api('/api/status');
      state.live = !status.mock;
    } catch {
      state.live = false;
    }
  }
  setupDictation();
  setupNameVoice();
}

for (const button of document.querySelectorAll('.lang-switch button')) {
  button.addEventListener('click', () => applyLanguage(button.dataset.lang));
}

$('#year').max = String(THIS_YEAR);
$('#year').placeholder = String(THIS_YEAR - 15);
startGrain();
startTitleGlitch();
applyLanguage(storedLang() ?? (navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'));
prepare();
