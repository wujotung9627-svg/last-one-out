// Renders the "how it is made" cards (1920x1080 PNG) from one finished game run's own
// files: the photos, depth maps and SAM boxes Meta's models made during that run.
//   node cards.mjs <runs/<id> dir> <out dir> [contact-book.png]
import { createRequire } from 'node:module';
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

const [runDir, outDir, bookPng] = process.argv.slice(2).map((p) => p && resolve(p));
mkdirSync(outDir, { recursive: true });
const run = JSON.parse(readFileSync(join(runDir, 'run.json'), 'utf8'));
const src = (p) => `file://${join(runDir, p)}`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const short = (s, n) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, '')} …` : s);

const scene = (w, id) => run.walks[w].scenes.find((s) => s.id === id);
const room = scene(0, 'classroom') ?? scene(0, 'office') ?? run.walks[0].scenes.at(-1);
const corridors = run.walks.map((w) => w.scenes.find((s) => s.id === 'corridor')?.photo).filter(Boolean);
const draw = run.draws[0];
const kept = draw.cards[draw.picked];
const turn = run.walks.map((w) => w.scare).find((s) => s?.kind === 'turn') ?? run.walks.at(-1).scare;
const teacher = run.walks.map((w) => w.scare).find((s) => s?.kind === 'teacher');

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Courier+Prime:wght@400;700&family=Caveat:wght@500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1920px;height:1080px;background:#0a0a0a;color:#e9e4d8;font-family:'Courier Prime',monospace;overflow:hidden}
body{padding:84px 110px;display:flex;flex-direction:column;gap:34px}
.top{display:flex;align-items:center;gap:22px}
.pill{font-family:'Courier Prime';font-weight:700;font-size:26px;letter-spacing:.08em;border:2px solid #c9a227;color:#c9a227;padding:8px 18px;border-radius:6px}
.pill.alt{border-color:#7fb3c8;color:#7fb3c8}.pill.red{border-color:#c0473f;color:#d5675f}
h1{font-family:'Bebas Neue';font-weight:400;font-size:92px;letter-spacing:.02em;line-height:.95;color:#f3efe6}
p.say{font-size:34px;line-height:1.45;color:#cfc9bb;max-width:1600px}
.row{display:flex;gap:36px;align-items:flex-start;flex:1;min-height:0}
.shot{position:relative;flex:1;min-width:0}
.shot img{width:100%;display:block;border-radius:6px}
.cap{font-size:24px;color:#9d978a;margin-top:12px;letter-spacing:.04em}
.box{position:absolute;border:4px solid;border-radius:4px}
.box span{position:absolute;left:-4px;top:-38px;font:700 22px 'Courier Prime';padding:2px 10px;color:#0a0a0a;white-space:nowrap}
.chalk{font-family:'Caveat';font-size:52px;color:#e8e6df;line-height:1.25}
.chalk s{color:#6d6a63;text-decoration-thickness:4px}
.quote{border-left:5px solid #c9a227;padding:10px 0 10px 28px;font-size:30px;line-height:1.45;color:#ddd6c6}
.arrow{font-family:'Bebas Neue';font-size:70px;color:#c9a227;align-self:center}
.list{font-size:34px;line-height:1.6}
`;

const page = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`;
const pills = (...names) => `<div class="top">${names.map(([n, c]) => `<span class="pill ${c ?? ''}">${n}</span>`).join('')}</div>`;
const boxes = (s) => {
  const out = [];
  const add = (b, label, color) => b && out.push(`<div class="box" style="left:${b.x * 100}%;top:${b.y * 100}%;width:${b.w * 100}%;height:${b.h * 100}%;border-color:${color}"><span style="background:${color}">${label}</span></div>`);
  (s.doors ?? []).slice(0, 2).forEach((d) => add(d, d.open ? 'open door' : 'door', '#7fd18b'));
  add(s.board, 'chalkboard', '#f0d264');
  add(s.tv, 'TV', '#7fb3c8');
  (s.papers ?? []).slice(0, 1).forEach((p) => add(p, 'exam papers', '#e58b7f'));
  add(s.notice, 'ranking', '#e58b7f');
  return out.join('');
};

const memories = run.memories_en?.length ? run.memories_en : run.memories;
const scores = (run.bible.scores ?? []).map((s) => `${esc(s.subject_en ?? s.subject)} ${s.score}`).join(' · ');

const cards = {
  '1-bible': page(`
    ${pills(['MUSE SPARK 1.3'])}
    <h1>Three memories and a year<br>become a school</h1>
    <div class="row" style="align-items:center">
      <div class="list" style="flex:1">${memories.map((m) => `<div>— ${esc(m)}</div>`).join('')}<div style="margin-top:18px;color:#c9a227">${run.bible.year}</div></div>
      <div class="arrow">→</div>
      <div style="flex:1.25;display:flex;flex-direction:column;gap:22px">
        <div class="quote">the speaker: “${esc(run.bible.pa?.en)}”</div>
        <div class="quote">your exam scores: ${scores}</div>
        <div class="quote">memory threads that come back changed, walk after walk</div>
      </div>
    </div>`),
  '2-depth': page(`
    ${pills(['MUSE IMAGE 1.0'])}
    <h1>A photograph, then its depth</h1>
    <div class="row">
      <div class="shot"><img src="${src(room.photo)}"><div class="cap">the photo</div></div>
      <div class="shot"><img src="${src(room.depth)}"><div class="cap">the same photo, redrawn as a depth map</div></div>
    </div>
    <p class="say">WebGL2 turns the pair into a space you walk into. No 3D models, no hand-made art.</p>`),
  '3-sam': page(`
    ${pills(['SAM 3.1', 'alt'])}
    <div class="row" style="gap:56px">
      <div style="flex:0 0 560px;display:flex;flex-direction:column;gap:34px;justify-content:center;height:100%">
        <h1>Making a generated photo playable</h1>
        <p class="say" style="font-size:31px">SAM 3.1 finds the doors you can open, the chalkboard where you choose, the papers that carry your name and the TV that wakes at roll call.</p>
      </div>
      <div class="shot" style="flex:1"><img src="${src(room.photo)}">${boxes(room)}</div>
    </div>`),
  '4-edit': page(`
    ${pills(['MUSE SPARK 1.3'], ['MUSE IMAGE 1.0'])}
    <h1>Keep one line. The same photo changes.</h1>
    <div style="display:flex;gap:56px">
      <div class="chalk" style="flex:0 0 700px;font-size:44px">${draw.cards.map((c, i) => (i === draw.picked ? esc(c.title_en ?? c.title) : `<s>${esc(c.title_en ?? c.title)}</s>`)).join('<br>')}</div>
      <div class="quote" style="font-size:24px;flex:1">Muse Spark looks at the photo and writes the edit:<br>“${esc(short(kept.edits?.corridor ?? Object.values(kept.edits ?? {})[0] ?? '', 230))}”</div>
    </div>
    <div style="display:flex;gap:30px">
      ${corridors.slice(0, 3).map((p, i) => `<div style="flex:1"><img src="${src(p)}" style="width:100%;border-radius:5px;display:block"><div class="cap">walk ${i + 1}${i ? ` · edited from walk ${i}` : ' · the first photo'}</div></div>`).join('')}
    </div>`),
  '5-voice': page(`
    ${pills(['MUSE VOICE TRANSCRIBE', 'red'])}
    <div class="row" style="gap:56px">
      <div style="flex:0 0 600px;display:flex;flex-direction:column;gap:34px;justify-content:center;height:100%">
        <h1>The speaker calls your name. Answer out loud.</h1>
        <p class="say" style="font-size:31px">The microphone hears you; Muse Voice Transcribe checks you said “here” (there is a Here button too). Then every head turns.</p>
        <p class="say" style="font-size:24px;color:#8e887b">Your name never leaves the browser.</p>
      </div>
      <div class="shot" style="flex:1"><img src="${src(turn?.photo ?? room.photo)}"></div>
    </div>`),
  '6-book': page(`
    <div class="row" style="gap:56px">
      <div style="flex:0 0 560px;display:flex;flex-direction:column;gap:30px;justify-content:center;height:100%">
        ${pills(['MUSE SPARK 1.3'])}
        <h1>Tonight's page of your contact book</h1>
        <p class="say" style="font-size:29px">Every Taiwanese student brings one home to be signed. Muse Spark writes the diary and the teacher's note from what you did tonight: the lines you kept and wiped away, how long you took to answer.</p>
      </div>
      <div class="shot" style="flex:1;display:flex;align-items:center;height:100%">${bookPng && existsSync(bookPng) ? `<img src="file://${bookPng}" style="width:100%;border-radius:4px">` : `<img src="${src(run.ending.daylight)}">`}</div>
    </div>`),
};

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
for (const [name, html] of Object.entries(cards)) {
  const file = join(outDir, `${name}.html`);
  writeFileSync(file, html);
  await tab.goto(`file://${file}`);
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(300);
  await tab.screenshot({ path: join(outDir, `${name}.png`) });
  console.log('card', name);
}
await browser.close();
writeFileSync(join(outDir, 'facts.json'), JSON.stringify({ teacher: teacher?.photo ?? null, turn: turn?.photo ?? null, kept: kept.title_en, memories }, null, 2));
