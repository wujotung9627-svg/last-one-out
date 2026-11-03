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
    firstLine: 'The others have gone home.',
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
  },
  zh: {
    remembering: '正在想起你的學校…',
    firstLine: '其他人都回家了。',
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

async function refreshStatus() {
  if (REPLAY_SRC) return;
  try {
    const s = await api('/api/status');
    $('#mode').hidden = !s.mock;
    $('#budget').textContent = `About $${s.spentUsd.toFixed(2)} of $${s.capUsd} used`;
  } catch {
    $('#budget').textContent = '';
  }
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
    refreshStatus();
  }
}

// ---------- sound ----------

function applySound(sound) {
  if (!state.audio) return;
  state.audio.silence(sound === 'silence');
  state.audio.echo(sound === 'echo' ? 0.75 : 0.3);
  if (sound === 'bell') state.audio.bell();
}

// ---------- the walk ----------

const currentScene = () => state.walk.scenes[state.sceneIndex];

function placeHotspots(scene) {
  const layer = $('#hotspots');
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
  label.textContent = `值日生：${state.name}`;
  label.style.left = `${(board.x + board.w * 0.56) * 100}%`;
  label.style.top = `${(board.y + board.h * 0.62) * 100}%`;
  label.style.maxWidth = `${board.w * 0.42 * 100}%`;
  label.style.fontSize = `${Math.max(10, board.h * $('#stage').clientHeight * 0.16)}px`;
  label.style.filter = `blur(${BLUR_BY_WALK[Math.min(state.walk.index, BLUR_BY_WALK.length - 1)]}px)`;
  label.hidden = false;
}

function render(scene) {
  const photo = $('#photo');
  photo.alt = t(`alt_${scene.id}`);
  placeHotspots(scene);
  placeName(scene);
}

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
  const follow = followed();
  if (walker) {
    const from = currentScene();
    state.audio?.footsteps(3, follow);
    const walked = await walk3d(async () => {
      await walker.walk(from, scene, WALK_MS);
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
  applySound(sound);
  show('walk-screen');
  $('#whisper').textContent = line ?? '';
  const photo = $('#photo');
  photo.src = walk.scenes[0].photo;
  await photo.decode().catch(() => {});
  state.audio?.footsteps(4);
  if (!(walker && (await walk3d(() => walker.arrive(walk.scenes[0], ARRIVE_MS))))) {
    photo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1400, easing: 'ease-out' });
  }
  render(walk.scenes[0]);
  scheduleFlicker();
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
  if (state.walk.index < state.draws) return openCards();
  return lastWalk();
}

// ---------- cards ----------

function openCards() {
  show('card-screen');
  showError('');
  $('#card-prompt').textContent = t('pick');
  $('#walk-on').hidden = true;
  $('#cards').replaceChildren(
    ...[0, 1, 2].map((i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'card back';
      button.setAttribute('aria-label', `${t('card')} ${i + 1}`);
      button.addEventListener('click', () => draw(i));
      return button;
    }),
  );
}

function draw(index) {
  const buttons = [...$('#cards').children];
  return guarded(t('changing'), async () => {
    buttons.forEach((b, i) => {
      b.disabled = true;
      b.classList.toggle('chosen', i === index);
    });
    try {
      const res = await api('/api/draw', { schoolId: state.schoolId, index });
      buttons.forEach((b, i) => {
        b.classList.remove('back');
        b.classList.toggle('other', i !== index);
        b.replaceChildren(el('strong', res.cards[i].title), el('span', res.cards[i].whisper));
      });
      const picked = res.cards[index];
      const walkOn = $('#walk-on');
      walkOn.textContent = t('walkOn');
      walkOn.hidden = false;
      walkOn.onclick = () => beginWalk(res.walk, picked.whisper, picked.sound);
    } catch (err) {
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
    await beginWalk(res.walk, res.card.whisper, res.card.sound);
  });
}

// ---------- ending ----------

function renderBook() {
  const date = new Date().toLocaleDateString(state.lang === 'zh' ? 'zh-TW' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return drawContactBook($('#book'), { ...state.ending, name: state.name, date }, $('#hide-name').checked);
}

function finish() {
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

// ---------- start ----------

$('#start-form').addEventListener('submit', (event) => {
  event.preventDefault();
  state.name = $('#name').value.trim();
  const memories = ['#m1', '#m2', '#m3'].map((id) => $(id).value.trim()).filter(Boolean);
  state.lang = /[㐀-鿿]/.test(memories.join('')) ? 'zh' : 'en';
  state.audio ??= createAudio(); // must start from a click
  guarded(t('remembering'), async () => {
    const res = await api('/api/school', { memories }); // the name is not sent
    state.schoolId = res.schoolId;
    state.lang = res.lang;
    state.draws = res.draws;
    await beginWalk(res.walk, t('firstLine'), 'none');
  });
});

window.addEventListener('resize', () => {
  if (state.walk && !$('#walk-screen').hidden) placeName(currentScene());
});

// In the replay the memories are the recorded ones; only the name is the player's own.
async function prepareReplay() {
  try {
    const run = await loadReplay();
    ['#m1', '#m2', '#m3'].forEach((id, i) => {
      $(id).value = run.memories[i] ?? '';
      $(id).readOnly = true;
    });
    $('#budget').textContent = 'This page replays one recorded walk, so it makes no AI calls. Your name still stays in your browser.';
  } catch (err) {
    showError(err.message);
  }
}

if (REPLAY_SRC) prepareReplay();
else refreshStatus();
