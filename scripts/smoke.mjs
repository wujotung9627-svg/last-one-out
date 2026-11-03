// Walks the whole game through the API in mock mode (no key, no model calls, no cost).
// Used by CI and before every commit:  node scripts/smoke.mjs
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 4399;
const BASE = `http://127.0.0.1:${PORT}`;
const env = { ...process.env, PORT: String(PORT) };
delete env.MODEL_API_KEY;

const server = spawn(process.execPath, [join(ROOT, 'server.mjs')], { env, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (chunk) => String(chunk).includes('Last One Out on') && resolve());
  server.on('exit', (code) => reject(new Error(`server exited (${code})`)));
});

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path}: ${res.status} ${data.error}`);
  return data;
}

let schoolId;
try {
  const status = await fetch(`${BASE}/api/status`).then((r) => r.json());
  check(status.mock === true, 'runs in mock mode without a key');

  const school = await post('/api/school', { memories: ['a banyan tree', 'the teacher', 'the ranking'], lang: 'en', year: 2008 });
  schoolId = school.schoolId;
  check(school.draws === 2, 'two chalkboard choices');
  check(school.bible.year === 2008 && school.bible.scores.length === 3, 'bible carries the year and three scores');
  check(!JSON.stringify(school).includes('"name"'), 'no player name anywhere in the reply');
  check(school.walk.scenes.map((s) => s.id).join() === 'corridor,door,classroom', 'first walk: corridor, door, classroom');
  check(school.walk.scenes.every((s) => s.doors.length > 0), 'every scene has a door to click');
  check(Boolean(school.walk.scenes[2].board), 'the classroom chalkboard is found');

  const first = await post('/api/draw', { schoolId, index: 1 });
  check(first.cards.length === 3 && first.picked === 1 && first.last === false, 'first line kept');
  check(first.walk.scenes.map((s) => s.id).join() === 'corridor,door,office', 'second walk ends in the office');
  const office = first.walk.scenes[2];
  check(Boolean(office.board && office.notice && office.papers?.length), 'office board, bulletin board and papers are found');
  check(first.walk.scare?.after === 'door' && Boolean(first.walk.flicker), 'second walk has the teacher scare and a flicker frame');

  const second = await post('/api/draw', { schoolId, index: 2 });
  check(second.last === true, 'second line is the last');
  check(second.walk.scenes.map((s) => s.id).join() === 'corridor,door,classroom', 'last walk ends in the classroom');
  check(second.walk.scare?.after === 'classroom', 'last walk has the lights-out scare');

  const ending = await post('/api/ending', { schoolId });
  check(Boolean(ending.daylight && ending.comment && ending.changes.length === 2), 'ending has daylight, a note and both changes');

  const voice = await fetch(`${BASE}/api/transcribe?lang=en`, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: 'x' });
  check(voice.ok, 'transcribe answers in mock mode');
} catch (err) {
  check(false, err.message);
} finally {
  server.kill();
  if (schoolId) await rm(join(ROOT, 'runs', schoolId), { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');
