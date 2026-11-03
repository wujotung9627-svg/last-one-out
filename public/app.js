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
const CREDIT_NAME = 'Jojo'; // the one person who made this

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
    officeLine: 'Your paper is on the desk.',
    tag: 'In Taiwan, the student on duty is the last one out.',
    nameLabel: 'Your name',
    nameHint: 'Stays on this device. It is never sent anywhere.',
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
    officeLine: '你的考卷在桌上。',
    tag: '在台灣，值日生是最後一個離開教室的人。',
    nameLabel: '你的名字',
    nameHint: '只留在這台裝置上，不會傳出去。',
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
      await pause(1200);
      return { schoolId: 'replay', lang: run.lang, draws: run.draws.length, bible: run.bible, walk: run.walks[0] };
    case '/api/draw': {
      const draw = run.draws[replayCursor];
      replayCursor += 1;
      await pause(1500);
      return {
        cards: arrange(draw.cards, draw.picked, body.index),
        picked: body.index,
        walk: run.walks[replayCursor],
        last: replayCursor >= run.draws.length,
      };
    }
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
async function announce(text) {
  if (!$('#walk-screen').hidden && $('#intro').hidden) say(text);
  state.audio?.speaker();
  await pause(2300);
  await voice.speak(text, state.lang);
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
  if (sound === 'water') [1800, 3100, 3900, 6200].forEach((ms) => setTimeout(() => state.audio.drip(), ms));
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
function forwardDoor(scene) {
  if (scene.id === 'corridor' && state.walk.index === 1 && scene.doors.length > 1) return 1;
  return 0;
}

function placeHotspots(scene) {
  const layer = $('#hotspots');
  if (isEndingScene(scene) || (isChoiceScene(scene) && !state.pick)) {
    layer.replaceChildren(); // the way out only opens once a line is kept
    return;
  }
  const exit = BOARD_SCENES.has(scene.id);
  const spots = scene.doors.length ? scene.doors : [{ x: 0.3, y: 0.25, w: 0.4, h: 0.6 }];
  const open = forwardDoor(scene);
  layer.replaceChildren(
    ...spots.map((spot, i) => {
      const button = el('button', null, 'hotspot');
      button.type = 'button';
      box(button, spot);
      if (exit || i === open) {
        button.classList.add('forward');
        button.setAttribute('aria-label', exit ? t('throughDoor') : t('forward'));
        button.addEventListener('click', () => advance(spot));
      } else {
        button.classList.add('locked');
        button.setAttribute('aria-label', t('lockedDoor'));
        button.addEventListener('click', () => rattle(button));
      }
      return button;
    }),
  );
}

function rattle(button) {
  state.audio?.rattle();
  say(t('locked'));
  if (!REDUCED_MOTION) {
    button.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }],
      { duration: 360 },
    );
  }
}

// The page writes the name itself; it is never sent to a model.
const BLUR_BY_WALK = [2.4, 1.8, 1.4];

function placeName(scene, sharp = false) {
  const label = $('#board-name');
  if (scene.id !== 'classroom' || !scene.board || !state.name) {
    label.hidden = true;
    return;
  }
  const b = scene.board;
  const { w, h } = stageSize();
  label.className = state.lang === 'zh' ? 'vertical' : '';
  if (state.lang === 'zh') {
    // The narrow column at the board's right edge, written top to bottom.
    const chars = [...`${t('onDuty')}　${state.name}`].length;
    Object.assign(label.style, {
      left: `${(b.x + b.w * 0.9) * 100}%`,
      top: `${(b.y + b.h * 0.06) * 100}%`,
      width: `${b.w * 0.08 * 100}%`,
      height: `${b.h * 0.88 * 100}%`,
      fontSize: `${Math.max(9, Math.min(b.w * w * 0.055, (b.h * h * 0.88) / (chars + 1)))}px`,
    });
    label.replaceChildren(el('span', t('onDuty')), el('span', state.name, 'who'));
  } else {
    Object.assign(label.style, {
      left: `${(b.x + b.w * 0.68) * 100}%`,
      top: `${(b.y + b.h * 0.76) * 100}%`,
      width: `${b.w * 0.3 * 100}%`,
      height: 'auto',
      fontSize: `${Math.max(9, b.h * h * 0.11)}px`,
    });
    label.replaceChildren(el('span', `${t('onDuty')}: `), el('span', state.name, 'who'));
  }
  const blur = sharp ? 0 : BLUR_BY_WALK[Math.min(state.walk.index, BLUR_BY_WALK.length - 1)];
  label.style.filter = `url(#chalk) blur(${blur}px)`;
  label.hidden = false;
}

// Your exam papers carry your name and a red score; the ranking sheet has you last.
const FILLER_ZH = '今天的作業明早交回教室窗戶記得關好值日生擦黑板倒垃圾鎖門走廊不要奔跑考試成績下週公布請家長簽名';
const FILLER_EN = 'remember to close the windows tomorrow homework due erase the board lock the door before you leave';

function fillerName(i) {
  if (state.lang === 'en') {
    const letters = 'abcdefghiklmnoprstuvwy';
    return Array.from({ length: 2 }, (_, k) => {
      const n = 4 + ((i * 3 + k * 5) % 4);
      const word = Array.from({ length: n }, (_, j) => letters[(i * 7 + k * 11 + j * 13) % letters.length]).join('');
      return word[0].toUpperCase() + word.slice(1);
    }).join(' ');
  }
  const chars = [...FILLER_ZH];
  return Array.from({ length: 3 }, (_, k) => chars[(i * 13 + k * 7) % chars.length]).join('');
}

function placeMarks(scene) {
  const layer = $('#marks');
  layer.replaceChildren();
  const scores = state.bible?.scores ?? [];
  const name = state.name || t('noName');
  const { h } = stageSize();
  const onDesk = (b) => b.y + b.h / 2 > 0.45 && b.w > b.h * 0.8; // not the blinds, not a poster
  const papers = scene.id === 'office' || isEndingScene(scene) ? (scene.papers ?? []).filter(onDesk) : [];
  papers.slice(0, scores.length).forEach((paper, i) => {
    const mark = el('div', null, 'paper-mark');
    box(mark, paper);
    const size = Math.max(8, Math.min(paper.h * h * 0.16, (paper.w * stageSize().w * 0.6) / Math.max(4, [...name].length + 3)));
    const score = scores[i];
    const subject = state.lang === 'zh' ? score.subject : score.subject_en;
    mark.append(el('span', `${subject}${state.lang === 'zh' ? '　' : '  '}${name}`, 'paper-name'), el('span', String(score.score), 'paper-score'));
    mark.style.fontSize = `${size}px`;
    layer.append(mark);
  });
  if (scene.id === 'office' && scene.notice) {
    const n = scene.notice;
    const sheet = el('div', null, 'ranking');
    box(sheet, { x: n.x + n.w * 0.3, y: n.y + n.h * 0.06, w: n.w * 0.4, h: n.h * 0.88 });
    const rows = 12;
    sheet.style.fontSize = `${Math.max(4, (n.h * h * 0.88 * 0.94) / ((rows + 1) * 1.2))}px`;
    sheet.append(el('div', t('rank'), 'rank-title'));
    for (let i = 1; i < rows - 1; i++) sheet.append(el('div', `${i}. ${fillerName(i)}`, 'rank-row'));
    sheet.append(el('div', '⋮', 'rank-row'));
    sheet.append(el('div', `${CLASS_SIZE}. ${name}`, 'rank-row last'));
    layer.append(sheet);
  }
}

// ---------- the chalkboard ----------

function scribble(i) {
  if (state.lang === 'en') {
    const words = FILLER_EN.split(' ');
    return Array.from({ length: 3 + i }, (_, k) => words[(k * 5 + i * 3) % words.length]).join(' ');
  }
  const chars = [...FILLER_ZH];
  return Array.from({ length: 6 + i }, (_, k) => chars[(k * 7 + i * 11) % chars.length]).join('');
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

function placeChoices(scene) {
  const layer = $('#board-choices');
  if (!isChoiceScene(scene)) {
    layer.replaceChildren();
    layer.hidden = true;
    return;
  }
  const board = scene.board;
  const { h } = stageSize();
  const pick = state.pick;
  layer.hidden = false;
  layer.replaceChildren(
    ...[0, 1, 2].map((i) => {
      const line = el('button', null, 'chalk-line');
      line.type = 'button';
      Object.assign(line.style, {
        left: `${(board.x + board.w * 0.05) * 100}%`,
        top: `${(board.y + board.h * (0.2 + i * 0.25)) * 100}%`,
        maxWidth: `${board.w * 0.8 * 100}%`,
        fontSize: `${Math.max(10, board.h * h * 0.13)}px`,
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

function fitKeptLine(line, board, text) {
  const { w, h } = stageSize();
  const width = board.w * w * 0.9;
  const height = board.h * h;
  const cjk = /[㐀-鿿]/.test(text);
  const ems = [...text].length * (cjk ? 1.05 : 0.5);
  const size = Math.max(10, Math.min(height * 0.2, (width * 2) / Math.max(ems, 1), (width / Math.max(ems, 1)) * 1.6));
  Object.assign(line.style, {
    top: `${(board.y + board.h * 0.42) * 100}%`,
    maxWidth: `${board.w * 0.9 * 100}%`,
    fontSize: `${size}px`,
    whiteSpace: 'normal',
    lineHeight: '1.25',
  });
}

// Keeping a line is the choice. Its version of the school was rendered while you walked.
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
  state.audio?.creak();
  return guarded(pick.done ? '' : t('changing'), async () => {
    const res = await pick.promise;
    const card = res.cards[res.picked];
    state.last = res.last;
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

// A ball bounces out of the dark end of the corridor and rolls to your feet.
function rollBall() {
  if ($('#walk-screen').hidden || currentScene()?.id !== 'corridor' || REDUCED_MOTION) {
    state.audio?.ball();
    return;
  }
  const ball = $('#ball');
  ball.hidden = false;
  state.audio?.ball();
  const at = (k, x, y, size) => ({ offset: k, left: `${x * 100}%`, top: `${y * 100}%`, width: `${size * 100}%` });
  ball
    .animate(
      [
        at(0, 0.52, 0.5, 0.006),
        at(0.18, 0.53, 0.56, 0.012),
        at(0.3, 0.535, 0.53, 0.016),
        at(0.45, 0.545, 0.64, 0.026),
        at(0.58, 0.55, 0.6, 0.032),
        at(0.74, 0.565, 0.78, 0.05),
        at(1, 0.6, 0.93, 0.075),
      ],
      { duration: 3200, easing: 'linear', fill: 'forwards' },
    )
    .finished.then(() => pause(2500))
    .then(() => {
      ball.hidden = true;
    });
}

// The old television in the corner wakes up with static.
let staticTimer = null;

function tvStatic(scene, on) {
  const canvas = $('#tv');
  clearInterval(staticTimer);
  if (!on || !scene?.tv) {
    canvas.hidden = true;
    return;
  }
  box(canvas, scene.tv);
  canvas.width = 96;
  canvas.height = 72;
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

// The sliding door opens onto darkness before you step through.
async function openDoor(spot) {
  state.audio?.slideDoor();
  if (REDUCED_MOTION || !spot) return pause(400);
  const gap = $('#door-gap');
  box(gap, spot);
  gap.hidden = false;
  await gap.animate([{ clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 8%)' }], { duration: 900, easing: 'ease-in-out', fill: 'forwards' }).finished;
}

function closeDoorGap() {
  const gap = $('#door-gap');
  gap.getAnimations().forEach((a) => a.cancel());
  gap.hidden = true;
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
  frame.hidden = false; // a hard cut: no sound at all
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
  $('#stage').classList.add('blackout');
  await pause(2200);
}

// The flicker frame: while a tube flickers, someone is standing down the corridor.
let flickerTimer = null;

function scheduleFlicker(first = false) {
  clearTimeout(flickerTimer);
  const index = state.walk?.index ?? 0;
  const hasFigure = Boolean(state.walk?.flicker);
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
  if (figure && currentScene()?.id === figure.scene) {
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
  $('#hotspots').replaceChildren();
  $('#board-name').hidden = true;
  $('#board-choices').hidden = true;
  $('#marks').replaceChildren();
  tvStatic(null, false);
}

async function stepInto(scene) {
  const photo = $('#photo');
  const next = $('#photo-next');
  clearOverlays();
  const follow = followed();
  if (walker) {
    const from = currentScene();
    state.audio?.footsteps(3, follow);
    const walked = await walk3d(async () => {
      await walker.walk(from, scene, WALK_MS, { warp: warpNow() });
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
  if (!(walker && (await walk3d(() => walker.arrive(scene, ARRIVE_MS, { warp: warpNow() }))))) {
    photo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1400, easing: 'ease-out' });
  }
}

const preload = (url) => {
  if (url) new Image().src = url;
};

async function beginWalk(walk, line, sound) {
  state.walk = walk;
  state.sceneIndex = 0;
  state.pick = null;
  preload(walk.flicker?.photo);
  preload(walk.scare?.photo);
  walk.scenes.forEach((scene) => preload(scene.photo));
  applySound(sound);
  show('walk-screen');
  say(line ?? '');
  state.audio?.footsteps(4);
  await arriveAt(walk.scenes[0]);
  render(walk.scenes[0]);
  scheduleFlicker(true);
  scheduleEvents();
  onArrive(walk.scenes[0]);
}

// What happens when you reach a place.
function onArrive(scene) {
  const index = state.walk.index;
  if (scene.id === 'corridor' && index === 1 && state.bible?.pa) {
    setTimeout(() => announce(state.bible.pa[state.lang] ?? state.bible.pa.en), 2200);
  }
  if (scene.id === 'corridor' && index === 2) setTimeout(() => rollBall(), 3500);
  if (isEndingScene(scene)) rollCall(scene);
}

async function advance(spot) {
  if (state.busy) return;
  const from = currentScene();
  const next = state.sceneIndex + 1;
  if (next >= state.walk.scenes.length) {
    if (state.last) return;
    return from.board ? walkBack() : openCards(); // cards only if no chalkboard was found
  }
  state.busy = true;
  try {
    const scene = state.walk.scenes[next];
    const scare = state.walk.scare?.after === from.id ? state.walk.scare : null;
    if (from.id === 'door') await openDoor(spot);
    if (scare) {
      // The door opens onto the corridor where you started, and someone is in it.
      await jumpScare(scare.photo);
      closeDoorGap();
      state.sceneIndex = next;
      await arriveAt(scene);
    } else {
      await stepInto(scene);
      closeDoorGap();
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
    await announce(state.lang === 'zh' ? `${name}。` : `${name}.`);
    await pause(700);
    await voice.speak(`${name}？`, state.lang);
    roll.hidden = false;
    say(t('rollCall'));
    let answer = await waitForAnswer(9000);
    if (!answer.heard) {
      await voice.speak(`${name}？`, state.lang, { louder: true });
      answer = await waitForAnswer(9000);
    } else if (answer.recording && state.live) {
      const words = await transcribe(answer.recording, 'answer').catch(() => '');
      if (words && !ANSWER.test(words)) {
        say(t('wrongAnswer'));
        await pause(1200);
        await voice.speak(`${name}？`, state.lang, { louder: true });
        await waitForAnswer(7000);
      }
    }
    roll.hidden = true;
    say('');
    tvStatic(scene, false);
    state.audio?.silence(true);
    await pause(1400);
    state.audio?.silence(false);
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
    button.onclick = () => finishWith({ heard: true, recording: null });
    const listening = voice.listen({ ms, record: state.live });
    listening.result.then((result) => finishWith(result));
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
  return drawContactBook($('#book'), { ...state.ending, scores: state.bible?.scores, name: state.name, date: bookDate(), lang: state.lang }, $('#hide-name').checked);
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
    setTimeout(rollCredits, 14000);
  });
}

// The credits roll over the contact book, then leave it to you.
let creditsRolled = false;

function rollCredits() {
  if (creditsRolled || $('#ending-screen').hidden) return;
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
  const close = () => {
    roll?.cancel();
    layer.hidden = true;
  };
  layer.onclick = close;
  if (roll) roll.finished.then(close, () => {});
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

// ---------- speaking your memories ----------

function setupDictation() {
  for (const button of document.querySelectorAll('.mic')) {
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
async function intro() {
  const layer = $('#intro');
  layer.hidden = false;
  $('#intro-line').textContent = '';
  await pause(600);
  typeLine($('#intro-line'), t('paHome'));
  await announce(t('paHome'));
  await pause(800);
  typeLine($('#intro-line'), t('firstLine'));
  await pause(3600);
}

$('#start-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (state.busy) return;
  state.name = $('#name').value.trim();
  const memories = ['#m1', '#m2', '#m3'].map((id) => $(id).value.trim()).filter(Boolean);
  const year = Number($('#year').value) || undefined;
  state.audio ??= createAudio(); // must start from a click
  voice.warmUp(); // asks for the microphone now, not in the middle of the dark
  state.busy = true;
  showError('');
  show('walk-screen');
  $('#stage').classList.add('blackout');
  const school = api('/api/school', { memories, lang: state.lang, year }); // the name is not sent
  school.catch(() => {});
  intro()
    .then(async () => {
      loading(t('remembering'));
      const res = await school;
      state.schoolId = res.schoolId;
      state.draws = res.draws;
      state.bible = res.bible;
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
