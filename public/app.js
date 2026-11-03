import { createAudio } from './audio.js';
import { drawContactBook } from './ending.js';
import { createWalker } from './walk3d.js';

const $ = (selector) => document.querySelector(selector);
const STEP_MS = 1100; // flat fallback transition
const WALK_MS = 1500; // 3D walk into the next photo
const ARRIVE_MS = 1600;
const BLUR_BY_WALK = [10, 7, 4, 2, 0]; // the name on the board sharpens walk by walk
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

const LINES = {
  en: {
    remembering: 'Remembering your school…',
    firstLine: "The others have gone home. The floor isn't finished.",
    pick: 'Draw one card. Something will change.',
    card: 'Card',
    changing: 'Something is changing…',
    walkOn: 'Walk back',
    once: 'One more time.',
    bellWait: 'The bell rings.',
    ending: "You came back. It isn't the same anymore.",
    hide: 'Hide my name',
    download: 'Save the contact book',
    again: 'Go back again',
    forward: 'Walk forward',
    throughDoor: 'Walk through the door',
    alt_corridor: 'The school corridor at night',
    alt_door: 'A classroom door',
    alt_classroom: 'The empty classroom',
    alt_daylight: 'The classroom in afternoon light',
    eraseHint: 'Three lines on the board. Erase two. Keep one.',
    tag: 'In Taiwan, the student on duty is the last one out.',
    nameLabel: 'Your name',
    nameHint: 'Stays on this device. It is never sent anywhere.',
    memoriesLabel: 'Three things you remember about your school',
    memory1: 'e.g. a banyan tree at the end of the corridor',
    memory2: 'e.g. the teacher who never said my name',
    memory3: 'e.g. the exam ranking pinned on the wall',
    start: 'Start your duty',
    headphones: 'Please wear headphones.',
    dutyToday: 'ON DUTY TODAY  ',
  },
  zh: {
    remembering: '正在想起你的學校…',
    firstLine: '其他人都回家了。地，還沒拖完。',
    pick: '抽一張卡。有東西會變。',
    card: '卡',
    changing: '有東西正在改變…',
    walkOn: '走回去',
    once: '再走一次。',
    bellWait: '鐘響了。',
    ending: '你回來了。但它已經不是原來的樣子。',
    hide: '遮住我的名字',
    download: '存下聯絡簿',
    again: '再回去一次',
    forward: '往前走',
    throughDoor: '走進門',
    alt_corridor: '夜裡的學校走廊',
    alt_door: '教室的門',
    alt_classroom: '空無一人的教室',
    alt_daylight: '午後陽光裡的教室',
    eraseHint: '黑板上有三行字。擦掉兩行，留下一行。',
    tag: '在台灣，值日生是最後一個離開教室的人。',
    nameLabel: '你的名字',
    nameHint: '只留在這台裝置上，不會傳出去。',
    memoriesLabel: '寫下三件你記得的學校的事',
    memory1: '例：走廊盡頭有一棵大榕樹',
    memory2: '例：從來不叫我名字的導師',
    memory3: '例：貼在布告欄上的月考排名',
    start: '開始值日',
    headphones: '請戴上耳機體驗。',
    dutyToday: '本日值日生　',
  },
};

const state = {
  name: '',
  schoolId: null,
  lang: 'en',
  draws: 3,
  walk: null,
  sceneIndex: 0,
  last: false,
  ending: null,
  audio: null,
  busy: false,
  pick: null, // the line kept on the chalkboard this walk: { index, promise, done, title }
};

const t = (key) => LINES[state.lang][key];

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

function el(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
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

// ---------- atmosphere ----------

// A line under the photo.
function say(text) {
  typeLine($('#whisper'), text);
}

// Every dealt line comes in the player's language and in English; show the chosen one.
function cardText(card) {
  return state.lang === 'en'
    ? { title: card.title_en || card.title, whisper: card.whisper_en || card.whisper }
    : { title: card.title, whisper: card.whisper };
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
  ['#m1', '#m2', '#m3'].forEach((id, i) => $(id).setAttribute('aria-label', `${t('memoriesLabel')} ${i + 1}`));
  for (const button of document.querySelectorAll('.lang-switch button')) {
    button.setAttribute('aria-pressed', String(button.dataset.lang === state.lang));
  }
  if (replayRun) fillReplayMemories(replayRun);
  try {
    localStorage.setItem('last-one-out-lang', state.lang);
  } catch {
    // private mode: the choice just is not remembered
  }
}

// Lines arrive one character at a time, like someone thinking of them.
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

// Film grain over the whole page, at a third of the screen's resolution.
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

// Every so often the title slips: its red and cyan ghosts pull apart for a moment.
function startTitleGlitch() {
  if (REDUCED_MOTION) return;
  const title = $('h1'); // the red/cyan split is inherited by whichever title is showing
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

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadReplay() {
  replayRun ??= await fetch(REPLAY_SRC).then((res) => {
    if (!res.ok) throw new Error('The recorded walk could not be loaded.');
    return res.json();
  });
  return replayRun;
}

// Puts the recorded card where the player clicked and the other two around it.
function arrange(cards, picked, clicked) {
  const others = cards.filter((_, i) => i !== picked);
  return [0, 1, 2].map((i) => (i === clicked ? cards[picked] : others.shift()));
}

async function replayApi(path, body) {
  const run = await loadReplay();
  switch (path) {
    case '/api/status':
      return { replay: true };
    case '/api/school':
      replayCursor = 0;
      await pause(1200);
      return { schoolId: 'replay', lang: run.lang, draws: run.draws.length, walk: run.walks[0] };
    case '/api/deal':
      return { ready: true };
    case '/api/draw': {
      const draw = run.draws[replayCursor];
      replayCursor += 1;
      await pause(1500);
      return { cards: arrange(draw.cards, draw.picked, body.index), picked: body.index, walk: run.walks[replayCursor] };
    }
    case '/api/final':
      await pause(1200);
      return { card: run.final.card, walk: run.walks[run.walks.length - 1] };
    case '/api/ending':
      await pause(1200);
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

// Runs one step of the game, keeping double clicks out and errors visible.
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

// ---------- sound ----------

function applySound(sound) {
  if (!state.audio) return;
  state.audio.silence(sound === 'silence');
  state.audio.echo(sound === 'echo' ? 0.75 : 0.3);
  if (sound === 'bell') state.audio.bell();
  if (sound === 'ball') setTimeout(() => state.audio.ball(), 2500);
  if (sound === 'laughter') setTimeout(() => state.audio.murmur(5), 3000);
  if (sound === 'chalk') setTimeout(() => state.audio.chalk(1.6), 2000);
  if (sound === 'chair') setTimeout(() => state.audio.chair(), 2200);
  if (sound === 'papers') setTimeout(() => state.audio.papers(), 2400);
  if (sound === 'speaker') setTimeout(() => state.audio.speaker(), 3000);
  if (sound === 'water') [1800, 3100, 3900, 6200].forEach((ms) => setTimeout(() => state.audio.drip(), ms));
  if (sound === 'giggle') setTimeout(() => state.audio.giggle(), 2800);
  if (sound === 'running') setTimeout(() => state.audio.runPast(), 2500);
}

// Later walks are not quiet: a ball rolls out of nowhere, children play somewhere.
let eventTimers = [];

function scheduleEvents() {
  eventTimers.forEach(clearTimeout);
  eventTimers = [];
  const index = state.walk?.index ?? 0;
  const later = (ms, play) => eventTimers.push(setTimeout(() => !$('#walk-screen').hidden && play(), ms));
  if (index >= 1 && Math.random() < 0.5) later(4000 + Math.random() * 6000, () => state.audio?.murmur(4));
  if (index >= 2 && Math.random() < 0.6) later(3000 + Math.random() * 5000, () => state.audio?.ball());
  if (index >= 1 && Math.random() < 0.5) later(6000 + Math.random() * 8000, () => state.audio?.giggle());
  if (index >= 2 && Math.random() < 0.5) later(9000 + Math.random() * 8000, () => state.audio?.runPast());
  // The bucket drips on every walk.
  for (let ms = 2500; ms < 60000; ms += 5000 + Math.random() * 7000) later(ms, () => state.audio?.drip());
}

// ---------- the walk ----------

const currentScene = () => state.walk.scenes[state.sceneIndex];

// The choice happens on the chalkboard: the student on duty erases two lines and keeps one.
const isChoiceScene = (scene) =>
  scene.id === 'classroom' && Boolean(scene.board) && !state.last && state.walk.index < state.draws;

// The last walk ends in the classroom, the moment your name on the board is clear.
const isEndingScene = (scene) => scene.id === 'classroom' && state.last;
let endingStarted = false;

function placeHotspots(scene) {
  const layer = $('#hotspots');
  if (isEndingScene(scene)) {
    layer.replaceChildren();
    if (!endingStarted) {
      endingStarted = true;
      state.audio?.chalk(1.4);
      setTimeout(() => state.audio?.bell(), 1200);
      setTimeout(() => finish(), 5200);
    }
    return;
  }
  if (isChoiceScene(scene) && !state.pick) {
    layer.replaceChildren(); // the back door only opens once a line is kept
    return;
  }
  const spots = scene.doors.length ? scene.doors : [{ x: 0.3, y: 0.25, w: 0.4, h: 0.6, forward: true }];
  layer.replaceChildren(
    ...spots.map((spot) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hotspot';
      Object.assign(button.style, {
        left: `${spot.x * 100}%`,
        top: `${spot.y * 100}%`,
        width: `${spot.w * 100}%`,
        height: `${spot.h * 100}%`,
      });
      button.setAttribute('aria-label', spot.forward ? t('forward') : t('throughDoor'));
      button.addEventListener('click', advance);
      return button;
    }),
  );
}

// The page writes the name onto the chalkboard itself; it is never sent to a model.
function placeName(scene) {
  const label = $('#board-name');
  if (!scene.board || !state.name) {
    label.hidden = true;
    return;
  }
  const board = scene.board;
  label.textContent = `${state.lang === 'en' ? 'On duty: ' : '值日生：'}${state.name}`;
  label.style.left = `${(board.x + board.w * 0.56) * 100}%`;
  label.style.top = `${(board.y + board.h * 0.62) * 100}%`;
  label.style.maxWidth = `${board.w * 0.42 * 100}%`;
  label.style.fontSize = `${Math.max(10, board.h * $('#stage').clientHeight * 0.16)}px`;
  label.style.filter = `url(#chalk) blur(${BLUR_BY_WALK[Math.min(state.walk.index, BLUR_BY_WALK.length - 1)]}px)`;
  label.hidden = false;
}

// Half-wiped writing on the board before you choose. The characters are random filler,
// so nothing here gives away what a line will become.
const FILLER_ZH = '今天的作業明早交回教室窗戶記得關好值日生擦黑板倒垃圾鎖門走廊不要奔跑考試成績下週公布請家長簽名';
const FILLER_EN = 'remember to close the windows tomorrow homework due erase the board lock the door before you leave';

function scribble(i) {
  if (state.lang === 'en') {
    const words = FILLER_EN.split(' ');
    return Array.from({ length: 3 + i }, (_, k) => words[(k * 5 + i * 3) % words.length]).join(' ');
  }
  const chars = [...FILLER_ZH];
  return Array.from({ length: 6 + i }, (_, k) => chars[(k * 7 + i * 11) % chars.length]).join('');
}

// Chalk appears one stroke at a time.
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

function placeChoices(scene) {
  const layer = $('#board-choices');
  if (!isChoiceScene(scene)) {
    layer.replaceChildren();
    layer.hidden = true;
    return;
  }
  const board = scene.board;
  const stageHeight = $('#stage').clientHeight;
  const pick = state.pick;
  layer.hidden = false;
  layer.replaceChildren(
    ...[0, 1, 2].map((i) => {
      const line = document.createElement('button');
      line.type = 'button';
      line.className = 'chalk-line';
      Object.assign(line.style, {
        left: `${(board.x + board.w * 0.05) * 100}%`,
        top: `${(board.y + board.h * (0.2 + i * 0.25)) * 100}%`,
        maxWidth: `${board.w * 0.5 * 100}%`,
        fontSize: `${Math.max(10, board.h * stageHeight * 0.13)}px`,
      });
      line.textContent = pick?.index === i && pick.title ? pick.title : scribble(i);
      if (pick) line.classList.add(pick.index === i ? 'kept' : 'gone');
      line.disabled = Boolean(pick);
      line.setAttribute('aria-label', state.lang === 'zh' ? `留下第 ${i + 1} 行` : `Keep line ${i + 1}`);
      line.addEventListener('click', () => choose(i));
      return line;
    }),
  );
}

// The kept line gets the whole board: wider, wrapped if needed, and small enough to fit.
function fitKeptLine(line, board, text) {
  const stage = $('#stage');
  const width = board.w * stage.clientWidth * 0.9;
  const height = board.h * stage.clientHeight;
  const cjk = /[\u3400-\u9fff]/.test(text);
  const ems = [...text].length * (cjk ? 1.05 : 0.5); // rough width of the text in ems
  const size = Math.max(10, Math.min(height * 0.2, (width * 2) / Math.max(ems, 1), (width / Math.max(ems, 1)) * 1.6));
  Object.assign(line.style, {
    top: `${(board.y + board.h * 0.42) * 100}%`,
    maxWidth: `${board.w * 0.9 * 100}%`,
    fontSize: `${size}px`,
    whiteSpace: 'normal',
    lineHeight: '1.25',
  });
}

// Keeping a line is the draw. The school starts changing while you walk to the back door.
function choose(index) {
  if (state.pick || state.busy) return;
  const scene = currentScene();
  const pick = { index, done: false, title: null };
  state.pick = pick;
  [...$('#board-choices').children].forEach((line, i) => {
    line.disabled = true;
    line.classList.add(i === index ? 'kept' : 'erased');
  });
  state.audio?.erase();
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
      showError(err.message);
      if (currentScene() === scene) {
        placeChoices(scene);
        placeHotspots(scene);
        say(t('eraseHint'));
      }
    },
  );
}

function walkBack() {
  const pick = state.pick;
  if (!pick) {
    say(t('eraseHint'));
    return;
  }
  state.audio?.creak(); // out through the back door
  return guarded(pick.done ? '' : t('changing'), async () => {
    const res = await pick.promise;
    const card = res.cards[res.picked];
    await beginWalk(res.walk, cardText(card).whisper, card.sound);
  });
}

// The camera's date stamp slips back towards the years you were at school, then breaks.
const YEARS_BACK = [0, 7, 13, 19];
let stampTimer = null;

function placeDateStamp() {
  const stamp = $('#date-stamp');
  clearInterval(stampTimer);
  const two = (n) => String(n).padStart(2, '0');
  const today = new Date();
  const index = state.walk?.index ?? 0;
  if (index < YEARS_BACK.length) {
    const year = (today.getFullYear() - YEARS_BACK[index]) % 100;
    stamp.textContent = `’${two(year)} ${two(today.getMonth() + 1)} ${two(today.getDate())}`;
    return;
  }
  const scramble = () => {
    const r = () => two(Math.floor(Math.random() * 100));
    stamp.textContent = `’${r()} ${r()} ${r()}`;
  };
  scramble();
  if (!REDUCED_MOTION) stampTimer = setInterval(scramble, 140);
}

function render(scene) {
  placeDateStamp();
  state.audio?.night(scene.id === 'classroom' ? 'inside' : 'open'); // the corridor is open to the night
  const photo = $('#photo');
  photo.alt = t(`alt_${scene.id}`);
  placeHotspots(scene);
  placeName(scene);
  placeChoices(scene);
  if (isChoiceScene(scene) && !state.pick) say(t('eraseHint'));
}

// How far the space has started to bend: nothing on the first walk, strong by the last.
const WARP_BY_WALK = [0, 0.35, 0.7, 1, 1.2];
const warpNow = () => WARP_BY_WALK[Math.min(state.walk?.index ?? 0, WARP_BY_WALK.length - 1)];

// From the third walk on, sometimes one more footstep follows yours.
const followed = () => state.walk.index >= 2 && Math.random() < 0.5;

// Now and then a tube flickers: the picture dips and the hum crackles. More often later.
let flickerTimer = null;

function scheduleFlicker() {
  clearTimeout(flickerTimer);
  const waitMs = (6000 + Math.random() * 9000) / (1 + (state.walk?.index ?? 0) * 0.5);
  flickerTimer = setTimeout(() => {
    if (!$('#walk-screen').hidden && !state.busy) {
      state.audio?.flicker();
      if (!REDUCED_MOTION) {
        $('#stage').animate(
          [
            { filter: 'brightness(1)' },
            { filter: 'brightness(0.5)', offset: 0.2 },
            { filter: 'brightness(1)', offset: 0.45 },
            { filter: 'brightness(0.7)', offset: 0.6 },
            { filter: 'brightness(1)' },
          ],
          { duration: 320 },
        );
      }
    }
    if (!$('#walk-screen').hidden) scheduleFlicker();
  }, waitMs);
}

async function stepInto(scene) {
  const photo = $('#photo');
  const next = $('#photo-next');
  $('#hotspots').replaceChildren();
  $('#board-name').hidden = true;
  $('#board-choices').hidden = true;
  const follow = followed();
  if (scene.id === 'classroom') state.audio?.slideDoor(); // through the classroom's sliding door
  if (walker) {
    const from = currentScene();
    state.audio?.footsteps(3, follow);
    const walked = await walk3d(async () => {
      await walker.walk(from, scene, WALK_MS, { warp: warpNow() });
      photo.src = scene.photo; // swap under the canvas so nothing flashes
      await photo.decode().catch(() => {});
    });
    if (walked) {
      render(scene);
      return;
    }
  }
  next.src = scene.photo;
  await next.decode().catch(() => {});
  if (!walker) state.audio?.footsteps(3, follow);
  const leave = REDUCED_MOTION
    ? [{ opacity: 1 }, { opacity: 0 }]
    : [
        { transform: 'scale(1) translateY(0)', filter: 'blur(0px)', opacity: 1 },
        { transform: 'scale(1.07) translateY(-0.6%)', offset: 0.25 },
        { transform: 'scale(1.14) translateY(0.4%)', offset: 0.5 },
        { transform: 'scale(1.22) translateY(-0.4%)', offset: 0.75 },
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
  render(scene);
}

async function beginWalk(walk, line, sound) {
  state.walk = walk;
  state.sceneIndex = 0;
  state.pick = null;
  $('#board-choices').hidden = true;
  applySound(sound);
  show('walk-screen');
  say(line ?? '');
  const photo = $('#photo');
  photo.src = walk.scenes[0].photo;
  await photo.decode().catch(() => {});
  state.audio?.footsteps(4);
  if (!(walker && (await walk3d(() => walker.arrive(walk.scenes[0], ARRIVE_MS, { warp: warpNow() }))))) {
    photo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1400, easing: 'ease-out' });
  }
  render(walk.scenes[0]);
  scheduleFlicker();
  scheduleEvents();
}

async function advance() {
  if (state.busy) return;
  const next = state.sceneIndex + 1;
  if (next < state.walk.scenes.length) {
    state.busy = true;
    try {
      await stepInto(state.walk.scenes[next]);
      state.sceneIndex = next;
      const lastScene = next === state.walk.scenes.length - 1;
      if (lastScene && !state.last && state.walk.index < state.draws) {
        api('/api/deal', { schoolId: state.schoolId }).catch(() => {}); // cards get ready while you look around
      }
    } finally {
      state.busy = false;
    }
    return;
  }
  if (state.last) return finish();
  if (state.walk.index < state.draws) return currentScene().board ? walkBack() : openCards(); // cards only if no chalkboard was found
  return lastWalk();
}

// ---------- cards ----------

// An old camera's orange date stamp: ’26 11 04
function dateStamp() {
  const d = new Date();
  const two = (n) => String(n).padStart(2, '0');
  return `’${two(d.getFullYear() % 100)} ${two(d.getMonth() + 1)} ${two(d.getDate())}`;
}

// Each card is a photo print lying face down.
function photoCard(i) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'card';
  button.setAttribute('aria-label', `${t('card')} ${i + 1}`);
  const inner = document.createElement('div');
  inner.className = 'card-inner';
  const back = document.createElement('div');
  back.className = 'card-face card-back';
  back.append(el('span', '值日生'), el('span', dateStamp()));
  back.children[0].className = 'pencil';
  back.children[1].className = 'stamp';
  const front = document.createElement('div');
  front.className = 'card-face card-front';
  inner.append(back, front);
  button.append(inner);
  button.addEventListener('click', () => draw(i));
  return button;
}

// The drawn card develops into the new photo; the others stay undeveloped.
function revealCard(button, card, photo) {
  const front = button.querySelector('.card-front');
  const picture = photo ? document.createElement('img') : document.createElement('div');
  if (photo) {
    picture.src = photo;
    picture.alt = '';
  } else {
    picture.className = 'undeveloped';
  }
  const words = document.createElement('div');
  words.className = 'words';
  words.append(el('strong', card.title), el('span', card.whisper));
  front.replaceChildren(picture, words);
  button.classList.add('flipped');
  button.setAttribute('aria-label', `${card.title}. ${card.whisper}`);
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
    buttons[index].classList.add('waiting');
    try {
      const res = await api('/api/draw', { schoolId: state.schoolId, index });
      buttons[index].classList.remove('waiting');
      buttons.forEach((b, i) => {
        b.classList.toggle('other', i !== index);
        if (i === index) revealCard(b, { ...res.cards[i], ...cardText(res.cards[i]) }, res.walk.scenes[0].photo); // the other two are never shown
      });
      const picked = res.cards[index];
      const walkOn = $('#walk-on');
      walkOn.textContent = t('walkOn');
      walkOn.hidden = false;
      walkOn.onclick = () => beginWalk(res.walk, cardText(picked).whisper, picked.sound);
    } catch (err) {
      buttons[index].classList.remove('waiting');
      buttons.forEach((b) => {
        b.disabled = false;
      });
      throw err;
    }
  });
}

function lastWalk() {
  return guarded(t('once'), async () => {
    const res = await api('/api/final', { schoolId: state.schoolId });
    state.last = true;
    await beginWalk(res.walk, cardText(res.card).whisper, res.card.sound);
  });
}

// ---------- ending ----------

function renderBook() {
  const date = new Date().toLocaleDateString(state.lang === 'zh' ? 'zh-TW' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return drawContactBook($('#book'), { ...state.ending, name: state.name, date, lang: state.lang }, $('#hide-name').checked);
}

function finish() {
  state.audio?.night('off');
  return guarded(t('bellWait'), async () => {
    state.ending = await api('/api/ending', { schoolId: state.schoolId });
    show('ending-screen');
    const daylight = $('#daylight');
    daylight.src = state.ending.daylight;
    daylight.alt = t('alt_daylight');
    $('#ending-line').textContent = t('ending');
    $('#hide-label').textContent = t('hide');
    $('#download').textContent = t('download');
    $('#again').textContent = t('again');
    applySound('none');
    await renderBook();
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

$('#name').addEventListener('input', () => {
  $('#duty-name').textContent = $('#name').value.trim() || '＿＿＿';
});

// ---------- start ----------

$('#start-form').addEventListener('submit', (event) => {
  event.preventDefault();
  state.name = $('#name').value.trim();
  const memories = ['#m1', '#m2', '#m3'].map((id) => $(id).value.trim()).filter(Boolean);
  state.audio ??= createAudio(); // must start from a click
  guarded(t('remembering'), async () => {
    const res = await api('/api/school', { memories, lang: state.lang }); // the name is not sent
    state.schoolId = res.schoolId;
    state.draws = res.draws;
    await beginWalk(res.walk, t('firstLine'), 'none');
  });
});

window.addEventListener('resize', () => {
  if (state.walk && !$('#walk-screen').hidden) placeName(currentScene());
});

// In the replay the memories are the recorded ones; only the name is the player's own.
function fillReplayMemories(run) {
  const memories = state.lang === 'en' && run.memories_en?.length ? run.memories_en : run.memories;
  ['#m1', '#m2', '#m3'].forEach((id, i) => {
    $(id).value = memories[i] ?? '';
    $(id).readOnly = true;
  });
}

async function prepareReplay() {
  try {
    fillReplayMemories(await loadReplay());
  } catch (err) {
    showError(err.message);
  }
}

for (const button of document.querySelectorAll('.lang-switch button')) {
  button.addEventListener('click', () => applyLanguage(button.dataset.lang));
}

startGrain();
startTitleGlitch();
applyLanguage(storedLang() ?? (navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'));
if (REPLAY_SRC) prepareReplay();
