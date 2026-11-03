// Last One Out — local server.
// Keeps the Meta Model API key on the server, runs every model call, stores the
// photographs and serves the page. The player's name never reaches this server.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOCK_BOXES, MOCK_COMMENT, MOCK_DEALS, mockPhoto } from './mock.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const PHOTOS_DIR = join(ROOT, 'photos');
const RUNS_DIR = join(ROOT, 'runs');
const SPEND_FILE = join(ROOT, '.spend.json');

const PORT = Number(process.env.PORT || 4310);
const API_KEY = process.env.MODEL_API_KEY || '';
const API_BASE = 'https://api.meta.ai/v1';
const TEXT_MODEL = process.env.TEXT_MODEL || 'muse-spark-1.3';
const IMAGE_MODEL = 'muse-image-1.0';
const SAM_MODEL = 'sam-3.1';
const SPEND_CAP_USD = Number(process.env.SPEND_CAP_USD || 100);
const MOCK = !API_KEY;

const IMAGE_SIZE = '1536x1024'; // sets a 3:2 landscape ratio
const DRAWS = 3; // cards drawn before the last walk

// Prices from dev.meta.ai/docs/pricing-rate-limits (2026-11-03). Unknown text
// models are priced like the most expensive one so the cap stays on the safe side.
const PRICES = {
  'muse-spark-1.3': { in: 1.25, out: 4.25 },
  'muse-spark-1.3-contributor': { in: 0.1, out: 0.2 },
  'muse-wonder-1.0': { in: 4, out: 20 },
};
const FALLBACK_PRICE = PRICES['muse-wonder-1.0'];
const IMAGE_PRICE = 0.01;
const SAM_PRICE = 0.0025;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

class UpstreamError extends HttpError {
  constructor(upstream) {
    super(502, upstream === 429 ? 'The model is busy. Try again in a moment.' : `A model call failed (HTTP ${upstream}).`);
    this.upstream = upstream;
  }
}

// ---------- spending cap (an estimate; the Billing page is the real number) ----------

let spentUsd = 0;
try {
  spentUsd = JSON.parse(await readFile(SPEND_FILE, 'utf8')).usd || 0;
} catch {
  // first run
}

async function addSpend(usd) {
  spentUsd += usd;
  await writeFile(SPEND_FILE, JSON.stringify({ usd: spentUsd }));
}

function assertBudget() {
  if (spentUsd >= SPEND_CAP_USD) {
    throw new HttpError(402, `Spending cap of $${SPEND_CAP_USD} reached. Raise SPEND_CAP_USD in .env only if you mean to.`);
  }
}

// ---------- Meta Model API ----------

const authHeader = () => ({ Authorization: `Bearer ${API_KEY}` });

async function callModel(path, body) {
  assertBudget();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(240_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const kind = String(data?.error?.type ?? data?.error?.code ?? 'unknown').slice(0, 60);
    const reason = String(data?.error?.message ?? '').replace(/\s+/g, ' ').slice(0, 200); // Meta's own wording, no request data
    console.error(`[model] ${path} ${body.model} -> HTTP ${res.status} (${kind}) ${reason}`);
    throw new UpstreamError(res.status);
  }
  return data;
}

async function chat(messages, { effort = 'low', maxTokens = 3000 } = {}) {
  const data = await callModel('/chat/completions', {
    model: TEXT_MODEL,
    messages,
    reasoning_effort: effort,
    max_completion_tokens: maxTokens,
  });
  const price = PRICES[TEXT_MODEL] ?? FALLBACK_PRICE;
  const usage = data.usage ?? {};
  await addSpend(((usage.prompt_tokens ?? 0) * price.in + (usage.completion_tokens ?? 0) * price.out) / 1e6);
  const choice = data.choices?.[0];
  const content = choice?.message?.content ?? '';
  // Muse Spark always reasons first; reasoning counts towards the limit and can use it all up.
  if (!content.trim()) console.error(`[model] empty answer (finish: ${choice?.finish_reason ?? 'unknown'})`);
  return content;
}

function imageBytes(data) {
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new HttpError(502, 'No photograph came back. Try again.');
  return Buffer.from(b64, 'base64');
}

async function generateImage(prompt) {
  const data = await callModel('/images/generations', {
    model: IMAGE_MODEL,
    prompt,
    n: 1,
    size: IMAGE_SIZE,
    output_format: 'jpeg',
  });
  await addSpend(IMAGE_PRICE);
  return imageBytes(data);
}

async function editImage(bytes, prompt) {
  const data = await callModel('/images/edits', {
    model: IMAGE_MODEL,
    prompt,
    n: 1,
    images: [{ image_url: dataUrl(bytes) }],
  });
  await addSpend(IMAGE_PRICE);
  return imageBytes(data);
}

async function uploadFile(bytes) {
  assertBudget();
  const mime = mimeOf(bytes);
  const form = new FormData();
  form.append('purpose', 'user_data');
  form.append('file', new Blob([bytes], { type: mime }), `photo.${EXT[mime]}`);
  const res = await fetch(`${API_BASE}/files`, {
    method: 'POST',
    headers: authHeader(),
    body: form,
    redirect: 'error',
    signal: AbortSignal.timeout(60_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.id) {
    console.error(`[model] /files -> HTTP ${res.status}`);
    throw new UpstreamError(res.status);
  }
  return data.id;
}

async function deleteFile(id) {
  try {
    await fetch(`${API_BASE}/files/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeader(),
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    // best effort; uploaded files can also be removed from the console
  }
}

// SAM 3.1 answers in special-token text: one <|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..|> per match.
function parseBoxes(text) {
  const boxes = [];
  for (const match of text.matchAll(/<\|box;([^|]*)\|>/g)) {
    const field = Object.fromEntries(match[1].split(';').map((pair) => pair.split('=')));
    const [x1, y1, x2, y2, w, h] = ['x1', 'y1', 'x2', 'y2', 'w', 'h'].map((key) => Number(field[key]));
    if ([x1, y1, x2, y2, w, h].every(Number.isFinite) && w > 0 && h > 0 && x2 > x1 && y2 > y1) {
      boxes.push({ x: x1 / w, y: y1 / h, w: (x2 - x1) / w, h: (y2 - y1) / h });
    }
  }
  return boxes.sort((a, b) => b.w * b.h - a.w * a.h);
}

function responseText(data) {
  return (data?.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text)
    .join('\n');
}

async function findObjects(photoId, concept, sceneId) {
  if (MOCK) return MOCK_BOXES[sceneId]?.[concept] ?? [];
  const { bytes } = await readPhoto(photoId);
  const ask = (image) =>
    callModel('/responses', {
      model: SAM_MODEL,
      input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: concept }, image] }],
    });
  let data;
  try {
    data = await ask({ type: 'input_image', image_url: dataUrl(bytes) });
  } catch (err) {
    // Inline images are not documented for SAM; fall back to an uploaded file.
    if (!(err instanceof UpstreamError) || err.upstream !== 400) throw err;
    const fileId = await uploadFile(bytes);
    try {
      data = await ask({ type: 'input_image', file_id: fileId });
    } finally {
      deleteFile(fileId);
    }
  }
  await addSpend(SAM_PRICE);
  return parseBoxes(responseText(data));
}

async function findObjectsSafely(photoId, concept, sceneId) {
  try {
    return await findObjects(photoId, concept, sceneId);
  } catch (err) {
    if (err.status === 402) throw err;
    console.error(`[sam] ${concept}: ${err.message}`);
    return []; // the page falls back to a plain "walk forward" spot
  }
}

async function photoShows(photoId, change) {
  if (MOCK) return true;
  try {
    const { bytes } = await readPhoto(photoId);
    const text = await chat(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: `Does this photo clearly show this change: "${change}"? Reply with JSON only: {"shows": true or false}` },
            { type: 'image_url', image_url: { url: dataUrl(bytes) } },
          ],
        },
      ],
      { effort: 'low', maxTokens: 4000 },
    );
    const verdict = parseJson(text);
    if (!verdict) console.error('[check] no verdict; treating the change as shown');
    return verdict?.shows !== false;
  } catch (err) {
    if (err.status === 402) throw err;
    console.error(`[check] ${err.message}`);
    return true; // a failed check never blocks the walk
  }
}

// ---------- prompts ----------

const HOUSE_STYLE = [
  'Photograph taken with an early-2000s compact digital camera and its on-camera flash: flash falloff, slightly overexposed near the lens, sensor noise, mild JPEG compression, faint green cast from fluorescent tubes.',
  'Not cinematic, not HDR, no dramatic color grading: an ordinary snapshot.',
  'An old but well-kept Taiwanese school at night, clean and in daily use, as if the students left ten minutes ago. Not abandoned, not ruined, no dust or decay.',
  'Nobody in the frame. No ghosts, no blood, no readable text, no logos, no flags, no statues, no portraits, no slogans, no religious objects.',
  'Part of the floor is freshly mopped and still wet, as if the cleaning was left half done.',
].join(' ');

const SCENES = [
  {
    id: 'corridor',
    base: 'Camera about 40 cm above the floor, looking down a long open-air school corridor: terrazzo floor, pale green lower walls, iron window grilles on one side with a long terrazzo hand-wash sink and a row of metal taps beneath them, a row of wooden classroom doors on the other. One-point perspective, symmetrical. Every fluorescent tube is on; outside is pitch black. A faded, slightly worn red plastic bucket with a string mop stands against the wall to one side, half in shadow and not in the centre of the frame; a wet mop trail on the terrazzo runs down the corridor.',
    find: 'door',
  },
  {
    id: 'door',
    base: "Standing close to one classroom's front door: a wooden sliding door with a small glass window, a blank wooden class sign sticking out above the doorway, a low wooden shoe cabinet beside the door with pairs of students' white sneakers and canvas shoes in its cubbies, terrazzo floor, fluorescent light from the corridor ceiling. The floor in front of the door is still wet from mopping; no bucket here.",
    find: 'door',
  },
  {
    id: 'classroom',
    base: "Inside the empty classroom of an old Taiwanese school: rows of old-style school desks made entirely of dark reddish-brown varnished wood, each with a closed wooden box front under the desktop where books are kept, and matching all-wood chairs with slatted backrests (no metal frames, no folding chairs, no plastic chairs); ceiling fans hanging still, an old CRT television on a wall bracket in a top corner, a small wall speaker, a dark green chalkboard with faint half-erased chalk marks and a narrow ruled column at its right edge for the date and the student on duty (left blank), chalk stubs and two felt erasers on the chalk ledge, a raised wooden platform with the teacher's wooden desk, a row of wooden cubby lockers along the back wall, one chair pulled out, and on a low cabinet at the back a classic cream-white round electric rice cooker with an aluminium dome lid, a black knob, two metal side handles and a black front switch with its small orange light on (no logo, no text), a single fluorescent tube lit above the teacher's desk, the back door half open. At the back, a metal cleaning cabinet stands open with brooms and a string mop leaning beside it, and part of the floor is still wet.",
    find: 'door',
    board: 'chalkboard',
  },
];

const FINAL_EDIT =
  'Lower the camera to just above the floor, about 10 cm high, so the desks, doors and walls tower overhead.';
const FINAL_EN = { title_en: 'Small again', whisper_en: 'The desks were always this tall.' };
const FINAL_CARD = {
  en: { title: FINAL_EN.title_en, whisper: FINAL_EN.whisper_en, ...FINAL_EN, edit: FINAL_EDIT, sound: 'bell' },
  zh: { title: '又變小了', whisper: '課桌本來就這麼高。', ...FINAL_EN, edit: FINAL_EDIT, sound: 'bell' },
};

// Muse Image redraws each photo as a depth map, which the page uses for the 3D walk.
// The page checks it really looks like one and otherwise guesses depth itself.
const DEPTH_EDIT =
  'Redraw this photo as a grayscale depth map: pure white for the nearest surfaces, fading smoothly to pure black for the farthest. Same framing and composition, no texture, no lines, no color.';
const AI_DEPTH = process.env.AI_DEPTH !== 'off';

const DAYLIGHT_EDIT =
  'Same classroom, same camera position and angle, now in warm late-afternoon daylight: windows bright, sunlight falling across the desks, fluorescent tubes off. Keep every object exactly where it is.';

const DETAILS_SYSTEM = `The player shares up to three memories of their old school in Taiwan. Turn them into extra visual details for three night-time photos of that school: the corridor, a classroom door, and the classroom.
Only use what the player said plus what naturally goes with it. Keep it ordinary and physical. Never add people, faces, readable text, flags, statues, portraits, slogans or religious objects. A memory that cannot be shown in a photo can be left out.
Also translate the player's memories into natural English, one per memory, in the same order.
Reply with JSON only, details in English: {"corridor":"...","door":"...","classroom":"...","memories_en":["..."]}`;

const CARDS_SYSTEM = `You deal the choices in "Last One Out", a quiet horror game set in a remembered Taiwanese school at night. The player, the student on duty, walks the same three places again and again: a corridor, a classroom door, a classroom. At the end of each walk three half-erased lines are on the chalkboard; the player keeps one, and that line changes something in all three photos.
Escalate quickly, loop by loop:
- Loop 1: small but clearly visible and wrong (one tube light is dark, the duty student's faded red bucket now stands somewhere it could not be, every classroom door is ajar, the wet mop trail runs up the wall).
- Loop 2: the space itself distorts (the corridor is impossibly long, the same door repeats into the distance, the ceiling hangs far too low, the floor tilts, the room is mirrored, the windows are on the wrong side).
- Loop 3: the people from the memory are back, but only as what they leave, and with them what hurt (a school uniform draped over every chair as if the class were sitting there, the shadows of a whole class on the floor at noon nap time with nobody casting them, a dark adult silhouette at the far end of the corridor with back turned, every chair turned to face the camera).
Underneath, this school holds what hurt the student: a teacher's cold attention (being singled out, made to stand outside the classroom: one chair alone outside the door), being left out by classmates (every desk pushed away from one desk left alone in the middle, every chair turned away from it), and the weight of exams (stacks of test papers up to the ceiling, red pen marks everywhere, a wall covered in ranking sheets with no readable names). From loop 2 on, bring these in through objects and space, never through violence, insults, readable words or anything suggesting self-harm.
The image editor refuses any picture of children or students, so classmates never appear in person: show them only through what they left behind (school uniforms draped over every chair, a school bag hanging on every desk, the shadows of a full class on the floor with nobody casting them, sneakers lined up under every desk).
When uniforms or shoes appear, make them Taiwanese and mixed boys' and girls': short-sleeved white school shirts with navy trim, navy trousers for boys and pleated navy-plaid skirts for girls, a few bow ties, a few navy or dark-red jackets; no crests, no badges, no embroidered names or numbers. Shoes are white sneakers and canvas shoes. A teacher may appear only as a dark, out-of-focus adult silhouette far away with back turned; otherwise show the teacher through traces (red pen marks, a coat on the lectern). Never show a face. Never add ghosts, blood, injury, death, religion, politics, flags, statues or readable text. Use the player's memories when you can. Never repeat a previous change. The three lines must be very different from each other.
Each line gives one edit instruction per photo. A change may touch one, two or all three photos; leave an instruction empty ("") for a photo that should stay exactly as it is, but make at least one photo change. Each instruction must be doable as an edit of that existing photo and visible in it.
Reply with JSON only:
{"cards":[{"title":"at most 6 words in the player's language","whisper":"one short eerie line in the player's language","title_en":"the title in natural English","whisper_en":"the line in natural English","edits":{"corridor":"precise English instruction for the corridor photo, or empty","door":"... for the classroom door photo, or empty","classroom":"... for the classroom photo, or empty"},"sound":"none|silence|echo|bell|ball|laughter|giggle|running|chalk|chair|papers|speaker|water"}]}
Sounds (pick the one that fits the change): ball = a ball bounces and rolls down the corridor; laughter = children playing somewhere out of sight; giggle = a child giggles nearby, unseen; running = small feet run past behind you; chalk = chalk scratching on a board; chair = a chair dragged across the floor; papers = sheets of paper turned and shuffled; speaker = the school speaker crackles and chimes, then nobody speaks; water = water dripping; bell = the school bell; echo = every step echoes far too long; silence = all sound stops.`;

const COMMENT_SYSTEM = `Write one short teacher's note for a student's contact book. The student went back to their old school, alone, and saw the changes listed below.
Write as a teacher who finally noticed this student: warm, a little uncanny, and kind about whatever was hard back then. At most 30 words. No names, no death, no ghosts, no danger.
Reply with JSON only: {"note":"the note in the requested language","note_en":"the same note in natural English"}`;

const SOFTEN_SYSTEM = `This photo-edit instruction for a quiet horror game set in an empty Taiwanese school at night was refused by the image model's content policy.
Rewrite it so it keeps the same unsettling idea but cannot be refused: no people of any age, no children, no students, no bodies, no faces; show absence through objects, shadows, light and space instead. Keep it one precise instruction describing only what changes. Reply with the new instruction only.`;

const editPrompt = (change) =>
  `${change} Keep everything else exactly the same: same camera position and angle, same lighting, same objects, same photographic style. If people appear, show them only from behind, far away or blurred by motion; never show a face.`;

// ---------- helpers ----------

const cleanText = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const newId = () => randomUUID().replaceAll('-', '').slice(0, 12);
const ID = /^[a-f0-9]{12}$/;
const hasCjk = (text) => /[㐀-鿿]/.test(text);

function parseJson(text) {
  try {
    return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  } catch {
    return null;
  }
}

const SOUNDS = new Set(['none', 'silence', 'echo', 'bell', 'ball', 'laughter', 'chalk', 'chair', 'papers', 'speaker', 'water', 'giggle', 'running']);

function parseDeal(text) {
  const cards = parseJson(text)?.cards;
  const editsOf = (c) =>
    c?.edits && typeof c.edits === 'object'
      ? Object.fromEntries(SCENES.map((scene) => [scene.id, cleanText(c.edits[scene.id], 500)]))
      : null;
  const usable = (c) => c?.title && (cleanText(c.edit, 500) || Object.values(editsOf(c) ?? {}).some(Boolean));
  if (!Array.isArray(cards) || cards.length < 3 || !cards.slice(0, 3).every(usable)) {
    throw new HttpError(502, 'The cards came back garbled. Try again.');
  }
  return cards.slice(0, 3).map((c) => ({
    title: cleanText(c.title, 60),
    whisper: cleanText(c.whisper, 160),
    title_en: cleanText(c.title_en, 80) || cleanText(c.title, 60),
    whisper_en: cleanText(c.whisper_en, 200) || cleanText(c.whisper, 160),
    edits: editsOf(c),
    edit: cleanText(c.edit, 500) || Object.values(editsOf(c) ?? {}).find(Boolean) || '',
    sound: SOUNDS.has(c.sound) ? c.sound : 'none',
  }));
}

// ---------- photographs ----------

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
const photos = new Map(); // id -> { path, mime }

function mimeOf(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (bytes.subarray(0, 4).toString() === '<svg') return 'image/svg+xml';
  throw new HttpError(502, 'The photograph came back in an unknown format.');
}

const dataUrl = (bytes) => `data:${mimeOf(bytes)};base64,${bytes.toString('base64')}`;

async function savePhoto(bytesOrSvg) {
  const bytes = Buffer.isBuffer(bytesOrSvg) ? bytesOrSvg : Buffer.from(bytesOrSvg);
  const mime = mimeOf(bytes);
  const id = newId();
  const path = join(PHOTOS_DIR, `${id}.${EXT[mime]}`);
  await mkdir(PHOTOS_DIR, { recursive: true });
  await writeFile(path, bytes);
  photos.set(id, { path, mime });
  return id;
}

async function readPhoto(id) {
  if (!ID.test(id)) throw new HttpError(404, 'Photo not found.');
  const known = photos.get(id);
  if (known) return { ...known, bytes: await readFile(known.path) };
  for (const [mime, ext] of Object.entries(EXT)) {
    const path = join(PHOTOS_DIR, `${id}.${ext}`);
    try {
      const bytes = await readFile(path);
      photos.set(id, { path, mime });
      return { path, mime, bytes };
    } catch {
      // try the next extension
    }
  }
  throw new HttpError(404, 'Photo not found.');
}

// ---------- a remembered school ----------

const schools = new Map(); // id -> school

function getSchool(id) {
  const school = schools.get(String(id));
  if (!school) throw new HttpError(404, 'This memory has faded. Start again.');
  return school;
}

async function exclusive(school, task) {
  if (school.busy) throw new HttpError(409, 'Still working on the last step.');
  school.busy = true;
  try {
    return await task();
  } finally {
    school.busy = false;
  }
}

function photoPrompt(scene, school) {
  return [HOUSE_STYLE, scene.base, school.details[scene.id]].filter(Boolean).join(' ');
}

async function depthMap(photoId) {
  if (MOCK || !AI_DEPTH) return null;
  try {
    const { bytes } = await readPhoto(photoId);
    return `/photos/${await savePhoto(await editImage(bytes, DEPTH_EDIT))}`;
  } catch (err) {
    if (err.status === 402) throw err;
    console.error(`[depth] ${err.message}`);
    return null;
  }
}

async function sceneView(scene, photoId) {
  const [doors, boards, depth] = await Promise.all([
    findObjectsSafely(photoId, scene.find, scene.id),
    scene.board ? findObjectsSafely(photoId, scene.board, scene.id) : [],
    depthMap(photoId),
  ]);
  return { id: scene.id, photo: `/photos/${photoId}`, depth, doors: doors.slice(0, 3), board: boards[0] ?? null };
}

async function firstWalk(school) {
  const results = await Promise.all(
    SCENES.map(async (scene) => {
      const photoId = MOCK
        ? await savePhoto(mockPhoto(scene.id, { walk: 0, changes: [] }))
        : await savePhoto(await generateImage(photoPrompt(scene, school)));
      return { scene, photoId };
    }),
  );
  for (const { scene, photoId } of results) school.photos[scene.id] = photoId;
  school.first = { ...school.photos };
  const scenes = await Promise.all(results.map(({ scene, photoId }) => sceneView(scene, photoId)));
  school.views = Object.fromEntries(scenes.map((view) => [view.id, view]));
  return { index: 0, scenes };
}

// When the image model refuses an edit, Muse Spark rewrites it without people and
// without anything else likely to be refused, keeping the same eerie idea.
async function softenEdit(edit) {
  const text = await chat(
    [
      { role: 'system', content: SOFTEN_SYSTEM },
      { role: 'user', content: edit },
    ],
    { effort: 'low', maxTokens: 3000 },
  );
  return cleanText(text, 500);
}

// Edits one scene's photo for a card: refused -> rewritten and retried; not visible ->
// pushed once more; still refused -> the photo stays as it was.
async function editScene(scene, previous, instruction) {
  const { bytes } = await readPhoto(previous);
  let used = instruction;
  let photoId;
  try {
    photoId = await savePhoto(await editImage(bytes, editPrompt(used)));
  } catch (err) {
    if (!(err instanceof UpstreamError) || err.upstream !== 400) throw err;
    try {
      used = (await softenEdit(instruction)) || instruction.split(/(?<=\.)\s/)[0];
      console.error(`[edit] ${scene.id}: refused, retrying a rewritten edit`);
      photoId = await savePhoto(await editImage(bytes, editPrompt(used)));
    } catch (again) {
      if (again.status === 402) throw again;
      console.error(`[edit] ${scene.id}: refused twice, keeping the previous photo`);
      return null;
    }
  }
  if (!(await photoShows(photoId, used))) {
    try {
      photoId = await savePhoto(await editImage(bytes, editPrompt(`Make this change clearly visible: ${used}`)));
    } catch (err) {
      if (err.status === 402) throw err;
      console.error(`[edit] ${scene.id}: retry failed, keeping the first edit`);
    }
  }
  return photoId;
}

// Applies one card. Each scene has its own instruction; an empty one leaves that
// photo (and its doors, chalkboard and depth) exactly as it was.
async function changedWalk(school, card) {
  const changes = [...school.changes, card];
  const results = await Promise.all(
    SCENES.map(async (scene) => {
      const previous = school.photos[scene.id];
      if (MOCK) return { scene, photoId: await savePhoto(mockPhoto(scene.id, { walk: changes.length, changes })) };
      const instruction = card.edits ? card.edits[scene.id] : card.edit;
      if (!instruction) return { scene, photoId: previous, kept: true };
      const photoId = await editScene(scene, previous, instruction);
      return photoId ? { scene, photoId } : { scene, photoId: previous, kept: true };
    }),
  );
  const scenes = await Promise.all(
    results.map(({ scene, photoId, kept }) => (kept && school.views?.[scene.id] ? school.views[scene.id] : sceneView(scene, photoId))),
  );
  return { photos: Object.fromEntries(results.map(({ scene, photoId }) => [scene.id, photoId])), scenes };
}

function commit(school, card, walk) {
  school.changes.push(card);
  school.photos = walk.photos;
  school.views = Object.fromEntries(walk.scenes.map((view) => [view.id, view]));
  return { index: school.changes.length, scenes: walk.scenes };
}

async function dealCards(school) {
  if (MOCK) return MOCK_DEALS[school.changes.length % MOCK_DEALS.length];
  const text = await chat(
    [
      { role: 'system', content: CARDS_SYSTEM },
      {
        role: 'user',
        content: JSON.stringify({
          loop: school.changes.length + 1,
          of: DRAWS,
          language: school.lang === 'zh' ? 'Traditional Chinese (Taiwan)' : 'English',
          memories: school.memories,
          previous: school.changes.map((c) => c.edit),
        }),
      },
    ],
    { effort: 'low', maxTokens: 6000 },
  );
  return parseDeal(text);
}

function dealFor(school) {
  school.dealing ??= dealCards(school).catch((err) => {
    school.dealing = null;
    throw err;
  });
  return school.dealing;
}

// The teacher's note, in the player's language and in English. Never left blank.
async function teacherComment(school) {
  const fallback = { comment: MOCK_COMMENT[school.lang], comment_en: MOCK_COMMENT.en };
  if (MOCK) return fallback;
  const text = await chat(
    [
      { role: 'system', content: COMMENT_SYSTEM },
      {
        role: 'user',
        content: `Language: ${school.lang === 'zh' ? 'Traditional Chinese (Taiwan)' : 'English'}\nChanges: ${school.changes.map((c) => c.title_en || c.title).join('; ')}`,
      },
    ],
    { effort: 'low', maxTokens: 4000 },
  );
  const note = parseJson(text);
  const comment = cleanText(note?.note, 200);
  if (!comment) return fallback;
  return { comment, comment_en: cleanText(note?.note_en, 300) || comment };
}

// ---------- routes ----------

const routes = {
  'GET /api/status': async () => ({
    mock: MOCK,
    spentUsd: Math.round(spentUsd * 100) / 100,
    capUsd: SPEND_CAP_USD,
  }),

  // Memories in, first walk out. The player's name is never part of this request.
  'POST /api/school': async (body) => {
    const memories = (Array.isArray(body.memories) ? body.memories : [])
      .map((m) => cleanText(m, 200))
      .filter(Boolean)
      .slice(0, 3);
    const school = {
      id: newId(),
      memories,
      lang: ['zh', 'en'].includes(body.lang) ? body.lang : hasCjk(memories.join('')) ? 'zh' : 'en',
      details: {},
      photos: {},
      first: {},
      changes: [],
      final: false,
      ending: null,
      dealing: null,
      busy: false,
      record: { walks: [], draws: [], final: null }, // replayed later without any model calls
    };
    schools.set(school.id, school);
    if (schools.size > 200) schools.delete(schools.keys().next().value);
    return exclusive(school, async () => {
      if (!MOCK && memories.length) {
        const details = parseJson(
          await chat(
            [
              { role: 'system', content: DETAILS_SYSTEM },
              { role: 'user', content: memories.join('\n') },
            ],
            { effort: 'low', maxTokens: 4000 },
          ),
        );
        for (const scene of SCENES) school.details[scene.id] = cleanText(details?.[scene.id], 400);
        school.memoriesEn = (Array.isArray(details?.memories_en) ? details.memories_en : []).map((m) => cleanText(m, 300)).slice(0, 3);
      }
      const walk = await firstWalk(school);
      school.record.walks.push(walk);
      return { schoolId: school.id, lang: school.lang, draws: DRAWS, walk };
    });
  },

  // Deals ahead of time so the cards are ready when the player reaches them.
  'POST /api/deal': async (body) => {
    const school = getSchool(body.schoolId);
    if (school.changes.length >= DRAWS) return { ready: false };
    await dealFor(school);
    return { ready: true };
  },

  'POST /api/draw': async (body) => {
    const school = getSchool(body.schoolId);
    const index = Number(body.index);
    if (![0, 1, 2].includes(index)) throw new HttpError(400, 'Pick one of the three cards.');
    if (school.changes.length >= DRAWS) throw new HttpError(409, 'No cards left. Walk on.');
    return exclusive(school, async () => {
      const cards = await dealFor(school);
      const changed = await changedWalk(school, cards[index]);
      school.dealing = null;
      const walk = commit(school, cards[index], changed);
      school.record.draws.push({ cards, picked: index });
      school.record.walks.push(walk);
      return { cards, picked: index, walk, lastDraw: school.changes.length >= DRAWS };
    });
  },

  'POST /api/final': async (body) => {
    const school = getSchool(body.schoolId);
    if (school.changes.length < DRAWS) throw new HttpError(409, 'There are still cards to draw.');
    if (school.final) throw new HttpError(409, 'This was already the last walk.');
    return exclusive(school, async () => {
      const card = FINAL_CARD[school.lang];
      const walk = commit(school, card, await changedWalk(school, card));
      school.final = true;
      school.record.final = { card };
      school.record.walks.push(walk);
      return { card, walk };
    });
  },

  'POST /api/ending': async (body) => {
    const school = getSchool(body.schoolId);
    if (!school.final) throw new HttpError(409, 'Not yet.');
    return exclusive(school, async () => {
      if (!school.ending) {
        const [daylightId, comment] = await Promise.all([
          MOCK
            ? savePhoto(mockPhoto('classroom', { walk: school.changes.length, changes: school.changes, daylight: true }))
            : readPhoto(school.photos.classroom).then(({ bytes }) => editImage(bytes, DAYLIGHT_EDIT)).then(savePhoto),
          teacherComment(school),
        ]);
        school.ending = {
          daylight: `/photos/${daylightId}`,
          first: `/photos/${school.first.corridor}`,
          last: `/photos/${school.photos.corridor}`,
          memories: school.memories,
          memories_en: school.memoriesEn ?? [],
          changes: school.changes.map((c) => c.title),
          changes_en: school.changes.map((c) => c.title_en || c.title),
          ...comment,
        };
        await saveRun(school).catch((err) => console.error(`[run] not saved: ${err.message}`));
      }
      return school.ending;
    });
  },
};

// Saves a finished walk with its photos to runs/<id>/, so scripts/build-demo.mjs can
// publish a replay that needs no model calls. The player's name is never part of it.
async function saveRun(school) {
  const dir = join(RUNS_DIR, school.id);
  const photoDir = join(dir, 'photos');
  await mkdir(photoDir, { recursive: true });
  const local = async (url) => {
    if (!url) return url;
    const { bytes, mime } = await readPhoto(url.slice('/photos/'.length));
    const name = `${url.slice('/photos/'.length)}.${EXT[mime]}`;
    await writeFile(join(photoDir, name), bytes);
    return `photos/${name}`;
  };
  const walks = await Promise.all(
    school.record.walks.map(async (walk) => ({
      index: walk.index,
      scenes: await Promise.all(
        walk.scenes.map(async (scene) => ({ ...scene, photo: await local(scene.photo), depth: await local(scene.depth) })),
      ),
    })),
  );
  const e = school.ending;
  const run = {
    lang: school.lang,
    memories: school.memories,
    memories_en: school.memoriesEn ?? [],
    walks,
    draws: school.record.draws,
    final: school.record.final,
    ending: { ...e, daylight: await local(e.daylight), first: await local(e.first), last: await local(e.last) },
  };
  await writeFile(join(dir, 'run.json'), JSON.stringify(run, null, 2));
  console.log(`[run] saved runs/${school.id}`);
}

// ---------- http ----------

const APP_CSP =
  "default-src 'self'; img-src 'self' blob: data:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
  "base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const PHOTO_CSP = "default-src 'none'; style-src 'unsafe-inline'";
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

function send(res, status, body, headers) {
  res.writeHead(status, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json' });
}

async function readJson(req) {
  if (!String(req.headers['content-type']).startsWith('application/json')) {
    throw new HttpError(415, 'Send JSON.');
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 100_000) throw new HttpError(413, 'Too large.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'Bad JSON.');
  }
}

async function serveStatic(pathname, res) {
  const file = resolve(PUBLIC, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(PUBLIC + sep)) return sendJson(res, 404, { error: 'Not found' });
  try {
    const body = await readFile(file);
    send(res, 200, body, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Content-Security-Policy': APP_CSP,
    });
  } catch {
    sendJson(res, 404, { error: 'Not found' });
  }
}

async function servePhoto(id, res) {
  const { bytes, mime } = await readPhoto(id);
  send(res, 200, bytes, { 'Content-Type': mime, 'Content-Security-Policy': PHOTO_CSP });
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname.startsWith('/photos/')) return await servePhoto(url.pathname.slice(8), res);
    const route = routes[`${req.method} ${url.pathname}`];
    if (route) return sendJson(res, 200, await route(req.method === 'POST' ? await readJson(req) : {}));
    if (req.method === 'GET') return await serveStatic(url.pathname, res);
    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
    if (err?.name === 'TimeoutError') return sendJson(res, 504, { error: 'The model took too long. Try again.' });
    console.error('[server]', err?.name, err?.message);
    sendJson(res, 500, { error: 'Something went wrong. Try again.' });
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Last One Out on http://127.0.0.1:${PORT}  (${MOCK ? 'mock mode — no MODEL_API_KEY' : TEXT_MODEL})`);
});
