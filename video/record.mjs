// Plays the judges' version of Last One Out (English) in a Chromium window and records the
// tab (picture + game sound) with the page's own tab capture. Every photo in it was made
// by Meta's models in the night that version plays back. GAME_URL can point elsewhere.
// The roll call is answered with the game's own "Here" button. The microphone the page
// sees is silence (no real microphone is ever opened).
//
//   node record.mjs            -> run-<time>/{game.webm, events.json, meta.json}
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(process.env.PLAYWRIGHT_FROM ?? import.meta.url);
const { chromium } = (() => {
  try {
    return require('playwright');
  } catch {
    return require('@playwright/test');
  }
})();

const GAME = process.env.GAME_URL || 'https://wujotung9627-svg.github.io/last-one-out/'; // the judges' version
const NAME = process.env.DEMO_NAME || 'unknown';
const YEAR = '2008';
const MEMORIES = ['the banyan tree at the end of the corridor', 'the teacher who never said my name', 'the exam ranking pinned on the wall'];
let KEEP = [1, 0, 2]; // which chalk line stays on each walk's board
// The judges' replay keeps the lines that were kept when it was recorded.
const replayRun = await fetch(new URL('run.json', GAME)).then((r) => (r.ok ? r.json() : null)).catch(() => null);
if (replayRun?.draws) KEEP = replayRun.draws.map((d) => d.picked);
const DIR = join(import.meta.dirname, 'out', `run-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`);
mkdirSync(DIR, { recursive: true });

const video = createWriteStream(join(DIR, 'game.webm'));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const browser = await chromium.launch({
  headless: false,
  args: [
    '--auto-accept-this-tab-capture',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
  ],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, locale: 'en-US' });
const page = await context.newPage();
const meta = { name: NAME, year: YEAR, memories: MEMORIES, schoolId: null, started: new Date().toISOString() };
page.on('response', async (res) => {
  if (res.url().endsWith('/api/school') && res.ok()) meta.schoolId = (await res.json().catch(() => ({}))).schoolId ?? null;
});
page.on('console', (m) => { if (m.type() === 'error') log('console error:', m.text().slice(0, 200)); });
await page.exposeFunction('__chunk', (b64) => new Promise((r) => video.write(Buffer.from(b64, 'base64'), r)));
// events are sent out every second, so a page that resets cannot lose them
const events = [];
await page.exposeFunction('__evlog', (batch) => void events.push(...batch));
page.on('framenavigated', (f) => f === page.mainFrame() && log('navigated:', f.url()));

await page.addInitScript(() => {
  // ---- event log (relative to the recording start) ----
  window.__events = [];
  window.__t0 = null;
  const now = () => (window.__t0 === null ? -1 : (performance.now() - window.__t0) / 1000);
  window.__ev = (type, data) => window.__events.push({ t: now(), type, ...data });

  // ---- the "microphone": always silence ----
  navigator.mediaDevices.getUserMedia = async () => {
    const ac = new AudioContext();
    return ac.createMediaStreamDestination().stream;
  };

  // ---- watch what is on screen ----
  const vis = (sel) => {
    const e = document.querySelector(sel);
    if (!e || e.hidden) return false;
    for (let n = e; n && n !== document.body; n = n.parentElement) if (n.hidden || getComputedStyle(n).display === 'none') return false;
    return true;
  };
  // a line under the photo is "done" once it has stopped changing for 0.6 s
  let lineText = '', lineSince = 0, lineStart = 0, lineDone = true;
  let last = {};
  setInterval(() => {
    if (window.__t0 === null) return;
    const s = {
      screen: [...document.querySelectorAll('.screen')].find((e) => !e.hidden)?.id ?? '',
      photo: (document.querySelector('#photo')?.src ?? '').split('/').pop().slice(0, 80),
      scare: vis('#scare'),
      roll: vis('#roll'),
      intro: vis('#intro'),
      loading: vis('#loading') ? document.querySelector('#loading-text')?.textContent : '',
      whisper: document.querySelector('#whisper')?.textContent ?? '',
      choices: document.querySelectorAll('#board-choices .chalk-line:not([disabled])').length,
      ball: vis('#ball'),
      tv: vis('#tv'),
      credits: vis('#credits'),
      title: vis('#end-title'),
      report: vis('#report'),
      error: vis('#error') ? document.querySelector('#error').textContent : '',
      gl: vis('#gl'),
    };
    for (const [k, v] of Object.entries(s)) if (k !== 'whisper' && last[k] !== v) window.__ev('change', { key: k, value: v });
    if (s.whisper !== lineText) {
      if (lineDone && s.whisper) lineStart = now();
      lineText = s.whisper; lineSince = performance.now(); lineDone = !s.whisper;
    } else if (!lineDone && performance.now() - lineSince > 600) {
      lineDone = true;
      window.__ev('line', { text: lineText, start: lineStart, done: now() - 0.6 });
    }
    window.__lineDone = lineDone;
    last = s;
  }, 200);
  let sent = 0;
  setInterval(() => {
    if (sent < window.__events.length && window.__evlog) window.__evlog(window.__events.slice(sent, (sent = window.__events.length)));
  }, 1000);
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (t) window.__ev('click', { id: t.id, cls: t.className, text: (t.textContent || '').slice(0, 80) });
  }, true);
});

await page.goto(GAME);
await page.click('.lang-switch button[data-lang="en"]');
await page.waitForTimeout(1500);

// Start the tab recording from a real click (getDisplayMedia needs one).
await page.evaluate(() => {
  const b = document.createElement('button');
  b.id = '__rec';
  b.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;z-index:99999';
  b.onclick = async () => {
    const s = await navigator.mediaDevices.getDisplayMedia({
      video: { width: 1920, height: 1080, frameRate: 30, cursor: 'never' },
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2, suppressLocalAudioPlayback: true },
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
    });
    const type = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus'].find((m) => MediaRecorder.isTypeSupported(m));
    const r = new MediaRecorder(s, { mimeType: type, videoBitsPerSecond: 14e6, audioBitsPerSecond: 256e3 });
    let queue = Promise.resolve();
    r.ondataavailable = (e) => {
      queue = queue.then(async () => {
        const buf = new Uint8Array(await e.data.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        await window.__chunk(btoa(bin));
      });
    };
    window.__stopRec = () => new Promise((res) => { r.onstop = () => queue.then(res); r.stop(); });
    r.start(1000);
    window.__t0 = performance.now();
    window.__ev('rec', { mime: type });
  };
  document.body.append(b);
});
await page.click('#__rec');
await page.waitForFunction(() => window.__t0 !== null);
log('recording');
await page.waitForTimeout(2500);

// ---- title screen ----
await page.click('#name');
await page.keyboard.type(NAME, { delay: 140 });
await page.waitForTimeout(500);
const locked = await page.evaluate(() => document.querySelector('#m1')?.readOnly);
if (locked) {
  // the replay: the year and the memories are the recorded night's, and cannot be changed
  meta.replay = true;
  await page.waitForTimeout(2500);
} else {
  await page.click('#year');
  await page.keyboard.type(YEAR, { delay: 160 });
  for (const [i, m] of MEMORIES.entries()) {
    await page.waitForTimeout(500);
    await page.click(`#m${i + 1}`);
    await page.keyboard.type(m, { delay: 45 });
  }
}
await page.waitForTimeout(1200);
await page.click('#start-form button[type="submit"]');
log('started');

// ---- play ----
const snap = () => page.evaluate(() => {
  const vis = (e) => {
    if (!e || e.hidden) return false;
    for (let n = e; n && n !== document.body; n = n.parentElement) if (n.hidden || getComputedStyle(n).display === 'none') return false;
    return true;
  };
  const hot = [...document.querySelectorAll('#hotspots .hotspot')].map((b, i) => ({ i, forward: b.classList.contains('forward') }));
  return {
    screen: [...document.querySelectorAll('.screen')].find((e) => !e.hidden)?.id ?? '',
    photo: document.querySelector('#photo')?.src ?? '',
    hot,
    lines: [...document.querySelectorAll('#board-choices .chalk-line')].map((b) => ({ enabled: !b.disabled })),
    boardShown: vis(document.querySelector('#board-choices')),
    roll: vis(document.querySelector('#roll')),
    report: vis(document.querySelector('#report')),
    cards: document.querySelectorAll('#cards .card:not([disabled])').length,
    walkOn: vis(document.querySelector('#walk-on')),
    error: vis(document.querySelector('#error')) ? document.querySelector('#error').textContent : '',
    credits: vis(document.querySelector('#credits')),
    lineDone: window.__lineDone !== false,
  };
});

let photo = '';
let since = Date.now();
let lastClick = 0;
let rattled = false;
let board = 0;
let rollSince = 0;
let walksSeen = 0;
const deadline = Date.now() + 18 * 60 * 1000;
while (Date.now() < deadline) {
  await page.waitForTimeout(400);
  const s = await snap().catch(() => null);
  if (!s) continue;
  if (s.error) log('error on screen:', s.error);
  if (s.screen === 'title-screen' && s.error) break;
  if (s.report) {
    log('contact book is up');
    break;
  }
  if (s.photo !== photo) {
    photo = s.photo;
    since = Date.now();
  }
  const dwell = Date.now() - since;
  if (s.screen === 'card-screen') {
    if (s.walkOn && Date.now() - lastClick > 4000) {
      await page.click('#walk-on');
      lastClick = Date.now();
    } else if (s.cards === 3 && Date.now() - lastClick > 4000) {
      await page.waitForTimeout(2500);
      await page.click('#cards .card');
      lastClick = Date.now();
    }
    continue;
  }
  if (s.roll) {
    rollSince ||= Date.now();
    if (Date.now() - rollSince > 2600 && Date.now() - lastClick > 8000) {
      log('answering with the Here button');
      await page.click('#roll-here').catch(() => {});
      lastClick = Date.now();
    }
    continue;
  }
  rollSince = 0;
  const enabled = s.lines.filter((l) => l.enabled).length;
  if (s.boardShown && enabled === 3 && s.lineDone && dwell > 5000 && Date.now() - lastClick > 3000) {
    const keep = KEEP[Math.min(board, KEEP.length - 1)];
    const erase = [0, 1, 2].filter((i) => i !== keep);
    log(`board ${board + 1}: keeping line ${keep + 1}`);
    // In the replay one line will not come off (it was kept when the run was recorded):
    // if a line stays, try the next one.
    let gone = 0;
    for (const i of [...erase, keep]) {
      if (gone >= 2) break;
      await page.click(`#board-choices .chalk-line >> nth=${i}`).catch(() => {});
      await page.waitForTimeout(900);
      const erased = await page.evaluate((k) => document.querySelectorAll('#board-choices .chalk-line')[k]?.classList.contains('erased'), i);
      if (erased) {
        gone += 1;
        if (gone < 2) await page.waitForTimeout(1400);
      } else await page.waitForTimeout(1600);
    }
    board += 1;
    lastClick = Date.now();
    continue;
  }
  const forward = s.hot.find((h) => h.forward);
  const locked = s.hot.find((h) => !h.forward);
  if (forward && s.lineDone && dwell > 6500 && Date.now() - lastClick > 12000) {
    if (locked && !rattled) {
      rattled = true;
      log('trying a locked door');
      await page.click(`#hotspots .hotspot >> nth=${locked.i}`, { force: true }).catch(() => {});
      await page.waitForTimeout(3200);
    }
    await page.click(`#hotspots .hotspot >> nth=${forward.i}`, { force: true }).catch(() => {});
    walksSeen += 1;
    lastClick = Date.now();
  }
}

// The contact book: a clean picture of the page itself, then scroll down to it.
await page.waitForTimeout(2500);
await page.locator('#book').screenshot({ path: join(DIR, 'book.png') }).catch((e) => log('no book picture:', e.message));
await page.evaluate(() => document.querySelector('#report')?.scrollIntoView({ behavior: 'smooth', block: 'center' })).catch(() => {});
await page.waitForTimeout(9000);
await page.waitForTimeout(1200); // the last events and chunks
const stopped = await page.evaluate(() => (typeof window.__stopRec === 'function' ? window.__stopRec().then(() => true) : false)).catch(() => false);
if (!stopped) log('the recorder had already stopped; keeping what was written');
await new Promise((r) => video.end(r));
writeFileSync(join(DIR, 'events.json'), JSON.stringify(events, null, 1));
meta.finished = new Date().toISOString();
writeFileSync(join(DIR, 'meta.json'), JSON.stringify(meta, null, 2));
log('saved', DIR, 'school', meta.schoolId);
await browser.close();
