// Cuts the demo video from one recorded live game (see record.mjs).
//   node edit.mjs <rec dir> pick    Muse Spark watches the run (frames + timeline) and picks the trailer:
//                                   which beats, where to trim them, and the title cards between them
//   node edit.mjs <rec dir> build   renders title cards, "how it is made" cards and the end card, then
//                                   assembles <rec dir>/demo.mp4 with ffmpeg
// A beat runs from one step forward to just after the next, so every shot starts and ends on
// a movement; cut points never fall inside a line that is still being written or spoken.
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(process.env.PLAYWRIGHT_FROM ?? import.meta.url);
const { chromium } = (() => {
  try {
    return require('playwright');
  } catch {
    return require('@playwright/test');
  }
})();

const HERE = import.meta.dirname;
const GAME_DIR = process.env.LAST_ONE_OUT_DIR ?? join(HERE, '..');
const PLAY_URL = 'https://wujotung9627-svg.github.io/last-one-out/';
const REPO_URL = 'github.com/wujotung9627-svg/last-one-out';
const REC = resolve(process.argv[2]);
const STAGE = process.argv[3] ?? 'pick';
const WORK = join(REC, 'edit');
mkdirSync(WORK, { recursive: true });
const meta = JSON.parse(readFileSync(join(REC, 'meta.json'), 'utf8'));
const events = JSON.parse(readFileSync(join(REC, 'events.json'), 'utf8')).filter((e) => e.t >= 0);
const RUN = meta.schoolId ? join(GAME_DIR, 'runs', meta.schoolId) : join(GAME_DIR, 'docs'); // the replay has no school id
const VIDEO = join(REC, 'game.mp4');
const ff = (...args) => execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
const probe = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());
const ENC = ['-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2'];

if (!existsSync(VIDEO)) {
  // MediaRecorder webm has no index and a variable frame rate: make a clean 30 fps copy once.
  ff('-i', join(REC, 'game.webm'), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', VIDEO);
}
const LENGTH = probe(VIDEO);

// ---------- what happened, and when ----------
const changes = (key, pred = (v) => Boolean(v)) => events.filter((e) => e.type === 'change' && e.key === key && pred(e.value)).map((e) => e.t);
const spans = (key) => {
  const out = [];
  let on = null;
  for (const e of events.filter((x) => x.type === 'change' && x.key === key)) {
    if (e.value && on === null) on = e.t;
    else if (!e.value && on !== null) out.push([on, e.t]), (on = null);
  }
  if (on !== null) out.push([on, LENGTH]);
  return out;
};
const lines = events.filter((e) => e.type === 'line').map((e) => ({ text: e.text, start: e.start, done: e.done, pa: /^Student on duty|^School is over|go home|please come/i.test(e.text) }));
const forward = events.filter((e) => e.type === 'click' && /forward/.test(e.cls)).map((e) => e.t);
const erases = events.filter((e) => e.type === 'click' && /chalk/.test(e.cls)).map((e) => e.t);
const walkStart = changes('screen', (v) => v === 'walk-screen')[0] ?? 0;
const endingAt = changes('screen', (v) => v === 'ending-screen')[0] ?? LENGTH;
const reportAt = changes('report')[0] ?? LENGTH;
const scares = spans('scare');
const balls = spans('ball');
const rolls = spans('roll');
const firstPhotoAt = events.find((e) => e.type === 'change' && e.key === 'photo' && e.value && e.t > walkStart + 1)?.t ?? walkStart + 20;

// No cut inside a line being written (or a speaker announcement still playing).
const busy = [...lines.map((l) => [l.start - 0.2, l.done + (l.pa ? 2.2 : 0.9)]), ...scares.map(([a, b]) => [a - 1.2, b + 0.5])];
// A cut inside a line moves to whichever edge of it is nearer: a shot that has only just
// reached a long announcement ends before it rather than running through it.
function snapIn(t) {
  for (const [a, b] of busy) if (t > a && t < b) return t - a < b - t ? Math.max(0, a - 0.1) : b;
  return t;
}
function snapOut(t) {
  for (const [a, b] of busy) if (t > a && t < b) return t - a < b - t ? Math.max(0, a - 0.15) : Math.min(LENGTH, b);
  return t;
}

function beats() {
  const list = [];
  const describe = (a, b) => {
    const said = lines.filter((l) => l.start >= a && l.start < b).map((l) => `"${l.text}"`);
    const what = [];
    if (scares.some(([s]) => s >= a && s < b)) what.push(rolls.some(([r]) => r >= a && r < b) ? 'roll call, then every head turns' : 'the teacher scare behind the door');
    if (balls.some(([s]) => s >= a && s < b)) what.push('a basketball rolls out of the dark to your feet');
    if (rolls.some(([s]) => s >= a && s < b)) what.push('the speaker calls your name; the player answers with the Here button');
    if (erases.filter((t) => t >= a && t < b).length >= 2) what.push('three chalk lines: the player erases two, the kept one is rewritten');
    return [...what, ...(said.length ? [`lines under the photo: ${said.join(' / ')}`] : [])].join('; ') || 'walking';
  };
  // (no title-screen beat: the trailer never shows typing into the form)
  list.push({ id: 'intro', start: walkStart, end: Math.max(walkStart + 3, firstPhotoAt - 0.3), about: describe(walkStart, firstPhotoAt) + '; text on black before the first photo' });
  // (starts just after the photo appears: not a frame of the intro text on black)
  list.push({ id: 'arrive', start: firstPhotoAt + 0.05, end: (forward[0] ?? firstPhotoAt + 8) + 1.2, about: describe(firstPhotoAt - 0.5, forward[0] ?? firstPhotoAt + 8) + ' (the first photo of the school)' });
  for (let i = 0; i < forward.length; i++) {
    const a = forward[i] - 0.3;
    const b = (i + 1 < forward.length ? forward[i + 1] : endingAt) + (i + 1 < forward.length ? 1.2 : 0);
    list.push({ id: `b${i + 1}`, start: a, end: Math.min(b, endingAt), about: describe(a, b) });
  }
  list.push({ id: 'ending', start: endingAt, end: Math.min(LENGTH, reportAt + 6), about: 'the afternoon after: daylight classroom, credits roll, the title, and the contact book page' });
  return list.map((x) => ({ ...x, start: +x.start.toFixed(1), end: +x.end.toFixed(1), seconds: +(x.end - x.start).toFixed(1) })).filter((x) => x.seconds > 1);
}

async function contactSheets(list) {
  const frames = join(WORK, 'frames');
  mkdirSync(frames, { recursive: true });
  const cells = [];
  for (const b of list) {
    const n = Math.max(3, Math.min(6, Math.round(b.seconds / 4)));
    for (let k = 0; k < n; k++) {
      const t = b.start + ((k + 0.5) / n) * b.seconds;
      const file = join(frames, `${b.id}-${k}.jpg`);
      if (!existsSync(file)) ff('-ss', t.toFixed(2), '-i', VIDEO, '-frames:v', '1', '-vf', 'scale=384:-1', '-q:v', '4', file);
      cells.push({ file, label: `${b.id} ${t.toFixed(1)}s` });
    }
  }
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: 1960, height: 1180 } });
  const sheets = [];
  for (let s = 0; s * 20 < cells.length; s++) {
    const html = cells.slice(s * 20, s * 20 + 20).map((c) => `<div class="c"><img src="file://${c.file}"><b>${c.label}</b></div>`).join('');
    await tab.setContent(`<style>body{margin:0;background:#222;display:grid;grid-template-columns:repeat(5,384px);gap:8px;padding:8px;font:bold 20px monospace}.c{position:relative}.c img{display:block;width:384px}.c b{position:absolute;left:4px;top:4px;background:#ff0;color:#000;padding:1px 6px}</style>${html}`);
    await tab.waitForTimeout(400);
    const file = join(WORK, `sheet-${s}.jpg`);
    await tab.screenshot({ path: file, type: 'jpeg', quality: 70, fullPage: true });
    sheets.push(file);
  }
  await browser.close();
  return sheets;
}

async function pick() {
  const list = beats();
  writeFileSync(join(WORK, 'beats.json'), JSON.stringify(list, null, 2));
  const sheets = await contactSheets(list);
  const key = readFileSync(join(GAME_DIR, '.env'), 'utf8').match(/^MODEL_API_KEY=(.+)$/m)?.[1]?.trim();
  if (!key) throw new Error('no MODEL_API_KEY in .env');
  const prompt = `You are cutting the first minute of the demo video for "Last One Out", a quiet horror game.
In Taiwan, the student on duty is the last one out. The player types three memories and a year; Meta's models photograph a night school from them; the player walks into the photos in 3D, three times; each time they erase two of three chalk lines and the school changes around the one they kept; a teacher in a cracked porcelain mask waits behind a door; on the last walk a basketball rolls to their feet; the classroom is full of figures with their backs turned; the speaker calls their name, they answer, every head turns; then the afternoon after, the credits and a page of a Taiwanese contact book.
This is one playthrough of the judges' replay, ${LENGTH.toFixed(0)} seconds: a night that was played live, with every photo made by Meta's models during that game. In the judges' version the year and the three memories are fixed; the player types or records a name.

The recording is split into beats. Each beat starts when the player steps forward and ends just after the next step, so every beat starts and ends on a movement:
${list.map((b) => `${b.id}: ${b.start}-${b.end}s (${b.seconds}s) — ${b.about}`).join('\n')}

The contact sheets show frames of each beat, labelled with the beat id and time.

Make a trailer of 70 to 85 seconds of footage, in story order, that a stranger can follow: they should understand what the player does and what happens.
- Choose 6 to 8 beats and let each one play long enough to see what happens and to read the line under the photo, at least 7 seconds each. You may trim a beat to a sub-range with "from" and "to" (seconds). Cut points that fall inside a line under the photo, a speaker announcement or a scare are moved to its edge afterwards. Keep these whole: the chalkboard choice (both erasures and the kept line being rewritten), the teacher scare, the basketball rolling to the player's feet, and the roll call through every head turning.
- Write 4 title cards. Each is shown full screen for about 5 seconds BEFORE a beat ("before": beat id), words in dry-brush handwriting on black, fading in and out. Each card plainly tells the viewer what they are about to see the player do or face (for example what the chalkboard choice is), so the trailer can be understood without playing. Grammatical, natural English a native speaker would write for a film trailer (with articles and apostrophes, e.g. "the teachers' office"), at most 8 words, no exclamation marks, never repeating a line the game shows, never giving a scare away. Never suggest that the player types the memories or the year: in the judges' version they are fixed.
Answer with JSON only: {"shots":[{"beat":"b3","from":12.0,"to":19.5}],"titles":[{"before":"b3","text":"..."}]}`;
  const content = [{ type: 'text', text: prompt }, ...sheets.map((f) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${readFileSync(f).toString('base64')}` } }))];
  // Muse Spark reasons first and the reasoning counts towards the limit: allow plenty, and
  // ask once more if it still ran out before answering.
  let data = null, text = '';
  for (let attempt = 0; attempt < 2 && !text.includes('{'); attempt++) {
    const res = await fetch('https://api.meta.ai/v1/chat/completions', {
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'muse-spark-1.3', messages: [{ role: 'user', content }], reasoning_effort: 'medium', max_completion_tokens: 16000 }),
    });
    if (!res.ok) throw new Error(`Muse Spark answered HTTP ${res.status}`);
    data = await res.json();
    text = data.choices?.[0]?.message?.content ?? '';
  }
  writeFileSync(join(WORK, 'spark-answer.txt'), text);
  writeFileSync(join(WORK, 'spark-usage.json'), JSON.stringify({ model: 'muse-spark-1.3', usage: data.usage, at: new Date().toISOString() }, null, 2));
  finalize(JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)), list);
}

// The moments that must stay whole whatever was picked: the roll call through every head
// turning, the teacher behind the door, the basketball rolling to your feet, and each
// chalkboard choice.
function mustKeep() {
  const keep = [];
  const roll = rolls[0];
  const turn = roll ? scares.find(([s]) => s > roll[0]) : null;
  if (roll) keep.push([roll[0] - 3.5, (turn ?? roll)[1] + 1.0]);
  for (const sc of scares) if (!roll || sc[0] < roll[0]) keep.push([sc[0] - 2.5, sc[1] + 0.6]);
  for (const [b0, b1] of balls) keep.push([b0 - 1.0, b0 + 9.5]); // the ball rolling to your feet, then the figure rushing at you
  // each chalkboard choice: both erasures and the kept line being rewritten
  // (kept whole only when the shot already reaches into it: a second board can be left out)
  for (let i = 0; i + 1 < erases.length; i++) if (erases[i + 1] - erases[i] < 8) keep.push([erases[i] - 2.5, erases[i + 1] + 4.5, 'board']), i++;
  return keep;
}

function finalize(plan, list) {
  const byId = Object.fromEntries(list.map((b) => [b.id, b]));
  plan.shots = plan.shots.filter((s) => byId[s.beat]).map((s) => {
    const b = byId[s.beat];
    const from = Math.max(b.start, Math.min(b.end - 3, s.from ?? b.start));
    const to = Math.min(b.end, Math.max(from + 3, s.to ?? b.end));
    let start = Math.max(b.start, snapIn(from)), end = snapOut(to); // a shot never starts before its beat
    for (const [k0, k1, kind] of mustKeep()) {
      const [lo, hi] = kind === 'board' ? [start, end] : [b.start, b.end];
      if (k0 < hi && k1 > lo) (start = Math.min(start, Math.max(b.start, k0))), (end = Math.max(end, Math.min(LENGTH, k1)));
    }
    start = +start.toFixed(2);
    end = +end.toFixed(2);
    return { ...s, start, end, snapped: start !== +from.toFixed(2) || end !== +to.toFixed(2) };
  });
  // No footage twice: a shot starts where the one before it ended.
  plan.shots.sort((a, b) => a.start - b.start);
  for (let i = 1; i < plan.shots.length; i++) if (plan.shots[i].start < plan.shots[i - 1].end) plan.shots[i].start = plan.shots[i - 1].end;
  plan.shots = plan.shots.filter((x) => x.end - x.start >= 3);
  // The whole video must stay under three minutes: the afternoon after goes first (the
  // contact book card shows it).
  const footage = () => plan.shots.reduce((n, x) => n + x.end - x.start, 0);
  if (footage() > Number(process.env.FOOTAGE_MAX || 84)) plan.shots = plan.shots.filter((x) => x.beat !== 'ending');
  writeFileSync(join(WORK, 'plan.json'), JSON.stringify(plan, null, 2));
  const total = plan.shots.reduce((n, s) => n + s.end - s.start, 0);
  console.log(`Muse Spark: ${plan.shots.length} shots, ${total.toFixed(1)} s of footage, ${plan.titles.length} title cards`);
  for (const s of plan.shots) {
    const title = plan.titles.find((x) => x.before === s.beat);
    if (title) console.log(`   [card] ${title.text}`);
    console.log(`${s.beat.padEnd(7)} ${s.start.toFixed(1)}-${s.end.toFixed(1)}${s.snapped ? ' (snapped)' : ''}  ${byId[s.beat].about.slice(0, 110)}`);
  }
}

async function build() {
  const plan = JSON.parse(readFileSync(join(WORK, 'plan.json'), 'utf8'));
  const parts = [];
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Courier+Prime:wght@400;700&family=IM+Fell+English:ital@0;1&display=swap');`;
  async function png(html, file) {
    await tab.setContent(`<style>${FONTS}*{margin:0;padding:0;box-sizing:border-box}html,body{width:1920px;height:1080px;background:#0a0a0a}</style>${html}`);
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(300);
    await tab.screenshot({ path: file });
  }

  // A low synthesised drone under the cards (the game's own sound is synthesised too).
  const bed = join(WORK, 'bed.wav');
  const raw = join(WORK, 'bed-raw.wav');
  ff('-f', 'lavfi', '-i', 'anoisesrc=color=brown:amplitude=0.08:d=200', '-f', 'lavfi', '-i', 'sine=frequency=55:d=200', '-f', 'lavfi', '-i', 'sine=frequency=110:d=200', '-f', 'lavfi', '-i', 'sine=frequency=164.81:d=200', '-f', 'lavfi', '-i', 'sine=frequency=60:d=200',
    '-filter_complex', '[0]lowpass=f=380,volume=0.6[n];[1]volume=0.05[a];[2]volume=0.03,tremolo=f=0.15:d=0.6[b];[3]volume=0.016,tremolo=f=0.11:d=0.7[c];[4]volume=0.008[h];[n][a][b][c][h]amix=inputs=5:normalize=0', '-ar', '48000', '-ac', '2', raw);
  ff('-i', raw, '-af', 'loudnorm=I=-27:TP=-8:LRA=7', '-ar', '48000', '-ac', '2', bed);
  // A card: the picture pushes in slowly while the drone plays.
  let bedAt = 0;
  const card = (pngFile, secs, name, push = 0.035) => {
    const out = join(WORK, `${name}.mp4`);
    const frames = Math.round(secs * 30);
    ff('-loop', '1', '-t', String(secs), '-i', pngFile, '-ss', String(bedAt), '-t', String(secs), '-i', bed,
      '-vf', `scale=3840:2160,zoompan=z='1+${push}*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,fade=t=in:st=0:d=0.5,fade=t=out:st=${secs - 0.5}:d=0.5,format=yuv420p`,
      '-af', `afade=t=in:d=0.5,afade=t=out:st=${secs - 0.6}:d=0.6`, ...ENC, '-t', String(secs), out);
    bedAt = (bedAt + secs) % 150;
    return out;
  };

  // 1. the title cards (animated, with their own sound)
  const titlesJson = join(WORK, 'titles.json');
  // The opening words come first, the way the game itself begins; then Muse Spark's four cards.
  const OPENING = 'In Taiwan, the student on duty is the last one out.';
  writeFileSync(titlesJson, JSON.stringify([{ text: OPENING, effect: 'brush' }, ...plan.titles.map((x) => ({ text: x.text, effect: 'brush' }))]));
  execFileSync('node', [join(HERE, 'titles.mjs'), join(WORK, 'titles'), titlesJson], { stdio: 'inherit', env: { ...process.env, TITLE_SECONDS: '5' } });

  // 2. the trailer: Muse Spark's shots, each preceded by its title card
  parts.push(join(WORK, 'titles', 'title-0.mp4'));
  for (const [i, s] of plan.shots.entries()) {
    const ti = plan.titles.findIndex((x) => x.before === s.beat);
    if (ti >= 0) parts.push(join(WORK, 'titles', `title-${ti + 1}.mp4`));
    const dur = s.end - s.start;
    const out = join(WORK, `shot-${i}.mp4`);
    ff('-ss', String(s.start), '-t', String(dur), '-i', VIDEO,
      '-vf', `fade=t=in:st=0:d=0.3,fade=t=out:st=${(dur - 0.35).toFixed(2)}:d=0.35`, '-af', `afade=t=in:st=0:d=0.25,afade=t=out:st=${(dur - 0.4).toFixed(2)}:d=0.4`, ...ENC, out);
    parts.push(out);
  }

  // 3. how it is made: cards from this run's own photos, depth maps and SAM boxes
  const book = join(WORK, 'book.png');
  if (existsSync(join(REC, 'book.png'))) execFileSync('cp', [join(REC, 'book.png'), book]); // a picture of the page itself
  else {
  // The contact book once the page has scrolled to it, cropped to the page itself.
  const bookAt = String(Math.min(LENGTH - 0.6, reportAt + 11));
  const found = spawnSync('ffmpeg', ['-hide_banner', '-ss', bookAt, '-i', VIDEO, '-frames:v', '3', '-vf', 'cropdetect=limit=0.22:round=2:reset=0', '-f', 'null', '-']).stderr.toString();
  const crop = found.match(/crop=(\d+:\d+:\d+:\d+)/g)?.pop()?.slice(5);
  ff('-ss', bookAt, '-i', VIDEO, '-frames:v', '1', ...(crop ? ['-vf', `crop=${crop}`] : []), book);
  }
  execFileSync('node', [join(HERE, 'cards.mjs'), RUN, join(WORK, 'cards'), book], { stdio: 'inherit' });
  const C = join(WORK, 'cards');
  const how = join(WORK, 'how.png');
  await png(`<div style="height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;color:#f1ece0"><div style="font:400 120px 'Bebas Neue';letter-spacing:.03em">How it is made</div><div style="font:400 34px 'Courier Prime';color:#b9b3a6;max-width:1400px;text-align:center;line-height:1.5">Every photo you just saw was made by Meta's models in one live game, recorded for the judges' version.</div></div>`, how);
  parts.push(card(how, 2.5, 'how', 0.02));
  // How the school is made: a live game (not the replay) typing three memories, the wait sped
  // up, and the first photo arriving. GEN_REC = a record.mjs folder of a live run.
  const GEN = process.env.GEN_REC && resolve(process.env.GEN_REC);
  if (GEN && existsSync(join(GEN, 'events.json'))) {
    const ge = JSON.parse(readFileSync(join(GEN, 'events.json'), 'utf8'));
    const gv = join(GEN, 'game.mp4');
    if (!existsSync(gv)) ff('-i', join(GEN, 'game.webm'), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', gv);
    const walkAt = ge.find((e) => e.type === 'change' && e.key === 'screen' && e.value === 'walk-screen')?.t ?? 13;
    const photoAt = ge.find((e) => e.type === 'change' && e.key === 'photo' && e.value && e.t > walkAt + 1)?.t ?? walkAt + 28;
    const cap = async (text, name) => {
      const file = join(WORK, `${name}.png`);
      await tab.setContent(`<style>${FONTS}*{margin:0}html,body{width:1920px;height:1080px;background:transparent}</style><div style="position:absolute;left:0;right:0;top:0;height:150px;background:linear-gradient(#000e,#0000);display:flex;justify-content:center;align-items:flex-start;padding-top:26px;font:400 44px 'Courier Prime';color:#f1ece0;letter-spacing:.03em">${text}</div>`);
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(250);
      await tab.screenshot({ path: file, omitBackground: true });
      return file;
    };
    const capA = await cap('Three memories and a year', 'gen-cap-a');
    const capB = await cap('Muse Image photographs a school from them', 'gen-cap-b');
    const seg = (name, from, to, speed, capPng, mute) => {
      const out = join(WORK, `${name}.mp4`);
      const dur = (to - from) / speed;
      const v = `[0:v]setpts=PTS/${speed},fps=30[s];[s][1:v]overlay=0:0,fade=t=in:st=0:d=0.3,fade=t=out:st=${(dur - 0.3).toFixed(2)}:d=0.3[v]`;
      const tempo = speed === 1 ? 'anull' : speed <= 2 ? `atempo=${speed}` : 'atempo=2,atempo=2,atempo=2';
      ff('-ss', String(from), '-t', String(to - from), '-i', gv, '-loop', '1', '-t', String(dur), '-i', capPng, '-f', 'lavfi', '-t', String(dur), '-i', 'anullsrc=r=48000:cl=stereo',
        '-filter_complex', `${v};${mute ? '[2:a]anull' : `[0:a]${tempo}`},afade=t=in:d=0.2,afade=t=out:st=${(dur - 0.3).toFixed(2)}:d=0.3[a]`, '-map', '[v]', '-map', '[a]', ...ENC, '-t', String(dur), out);
      return out;
    };
    parts.push(seg('gen-a', Math.max(0, walkAt - 7.2), walkAt, 2, capA, false));
    parts.push(seg('gen-b', walkAt, photoAt - 0.6, 8, capB, true));
    parts.push(seg('gen-c', photoAt - 0.6, photoAt + 3.6, 1, capB, false));
  }
  parts.push(card(join(C, '1-bible.png'), 8, 'c1'));
  parts.push(card(join(C, '2-depth.png'), 7, 'c2'));
  parts.push(card(join(C, '3-sam.png'), 8, 'c3'));
  parts.push(card(join(C, '4-edit.png'), 9, 'c4'));
  parts.push(card(join(C, '5-voice.png'), 6.5, 'c5'));
  parts.push(card(join(C, '6-book.png'), 8, 'c6'));

  // 4. the end card
  const end = join(WORK, 'end.png');
  await png(`<div style="height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;color:#f1ece0;text-align:center">
    <div style="font:400 150px 'Bebas Neue';letter-spacing:.06em">LAST ONE OUT</div>
    <div style="font:italic 400 44px 'IM Fell English';color:#e6dfcf">Play it: ${PLAY_URL.replace('https://', '')}</div>
    <div style="font:400 30px 'Courier Prime';color:#c9a227">${REPO_URL}</div>
    <div style="font:400 30px 'Courier Prime';color:#c9c3b5;margin-top:14px">Muse Spark · Muse Image · SAM 3.1 · Muse Voice Transcribe</div>
    <div style="font:italic 400 34px 'IM Fell English';color:#e6dfcf">Next: walk into it on Meta Quest (planned)</div>
    <div style="font:400 25px 'Courier Prime';color:#9d978a;max-width:1450px;line-height:1.5">Recorded from the replay at the link above: one night played live, every photo made by Meta's models.<br>Muse Spark watched the recording and chose the trailer's shots and title cards.</div>
    <div style="font:400 25px 'Courier Prime';color:#9d978a">Built during the Meta Global AI Developer Hackathon, Oct 27 – Nov 4, 2026 · JO TUNG WU</div></div>`, end);
  parts.push(card(end, 7, 'end', 0.015));
  await browser.close();

  // Decode every part on its own and join with the concat filter (stream copy breaks on
  // parts whose encoder settings differ: stills vs. game footage).
  const total = parts.reduce((n, p) => n + probe(p), 0);
  console.log(`total ${total.toFixed(1)} s${total > 178 ? '  (OVER 3 MINUTES: trim)' : ''}`);
  const joined = join(WORK, 'joined.mp4');
  const graph = parts.map((_, i) => `[${i}:v][${i}:a]`).join('') + `concat=n=${parts.length}:v=1:a=1[v][a]`;
  ff(...parts.flatMap((p) => ['-i', p]), '-filter_complex', graph, '-map', '[v]', '-map', '[a]', ...ENC, joined);
  // Quiet horror sound with loud stings: lift it and let a limiter catch the stings.
  const final = join(REC, 'demo.mp4');
  ff('-i', joined, '-c:v', 'copy', '-af', 'volume=5dB,alimiter=limit=0.56:attack=1:release=60:level=false', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', final);
  console.log('demo', final, probe(final).toFixed(1), 's');
}

if (STAGE === 'finalize') {
  const list = beats();
  const text = readFileSync(join(WORK, 'spark-answer.txt'), 'utf8');
  finalize(JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)), list);
} else if (STAGE === 'beats') console.log(beats().map((b) => `${b.id.padEnd(7)} ${b.start}-${b.end} (${b.seconds}s) ${b.about.slice(0, 120)}`).join('\n'));
else if (STAGE === 'pick') await pick();
else if (STAGE === 'build') await build();
