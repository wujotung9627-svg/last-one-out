// Last One Out — local server.
// Keeps the Meta Model API key on the server, runs every model call, stores the
// photographs and serves the page. The player's name never reaches this server.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
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
const VOICE_MODEL = 'muse-voice-transcribe-1.0';
const SPEND_CAP_USD = Number(process.env.SPEND_CAP_USD || 100);
const MOCK = !API_KEY;

const IMAGE_SIZE = '1536x1024'; // sets a 3:2 landscape ratio

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
const VOICE_PRICE_PER_HOUR = 0.18;

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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs at most `max` tasks at once; the rest queue. The next walk renders three
// versions in the background, so image calls are kept from all starting together.
function limiter(max) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= max || !queue.length) return;
    active += 1;
    const { task, resolve, reject } = queue.shift();
    task()
      .then(resolve, reject)
      .finally(() => {
        active -= 1;
        next();
      });
  };
  return (task) =>
    new Promise((resolve, reject) => {
      queue.push({ task: AsyncLocalStorage.bind(task), resolve, reject }); // runs in its caller's context
      next();
    });
}
const imageSlot = limiter(Number(process.env.IMAGE_CONCURRENCY || 8));

// Each background version of the next walk runs in its own context. Once the player
// keeps a line, the other two are cancelled: their queued model calls never start.
const job = new AsyncLocalStorage();
class Cancelled extends Error {}
const stopIfCancelled = () => {
  if (job.getStore()?.cancelled) throw new Cancelled('cancelled');
};

// A call that hangs is abandoned and tried once more rather than holding up the walk.
const CALL_TIMEOUT_MS = Number(process.env.CALL_TIMEOUT_MS || 100_000);

async function callModel(path, body, attempt = 0) {
  stopIfCancelled();
  assertBudget();
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
  } catch (err) {
    if (err?.name === 'TimeoutError' && attempt < 1) {
      console.error(`[model] ${path} ${body.model} -> no answer in ${CALL_TIMEOUT_MS / 1000} s, trying again`);
      return callModel(path, body, attempt + 1);
    }
    throw err;
  }
  const data = await res.json().catch(() => null);
  if ((res.status === 429 || res.status >= 500) && attempt < 2) {
    console.error(`[model] ${path} ${body.model} -> HTTP ${res.status}, retrying`);
    await wait(4000 * (attempt + 1));
    return callModel(path, body, attempt + 1);
  }
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
  const data = await imageSlot(() => callModel('/images/generations', {
    model: IMAGE_MODEL,
    prompt,
    n: 1,
    size: IMAGE_SIZE,
    output_format: 'jpeg',
  }));
  await addSpend(IMAGE_PRICE);
  return imageBytes(data);
}

async function editImage(bytes, prompt) {
  const data = await imageSlot(() =>
    callModel('/images/edits', {
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      images: [{ image_url: dataUrl(bytes) }],
    }),
  );
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
  'An old but well-kept Taiwanese school at night, clean and in daily use, as if everyone left ten minutes ago. Not abandoned, not ruined, no dust or decay.',
  'Nobody in the frame. No ghosts, no blood, no readable text, no logos, no flags, no statues, no portraits, no slogans, no religious objects.',
  'Part of the floor is freshly mopped and still wet, as if the cleaning was left half done.',
].join(' ');

// What SAM 3.1 looks for in each photo. doors are what you click; board is where the
// choice is made and your name appears; papers and notice carry your scores and rank.
const SCENES = {
  corridor: {
    base: 'Camera about 40 cm above the floor, looking down a long open-air school corridor: terrazzo floor, pale green lower walls, iron window grilles on one side with a long terrazzo hand-wash sink and a row of metal taps beneath them, a row of wooden classroom doors on the other. One-point perspective, symmetrical. Every fluorescent tube is on; outside is pitch black. A faded, slightly worn red plastic bucket with a string mop stands against the wall to one side, half in shadow and not in the centre of the frame; a wet mop trail on the terrazzo runs down the corridor.',
    concepts: { doors: 'door' },
  },
  door: {
    base: "Standing close to one classroom's front door: a wooden sliding door with a small glass window, a blank wooden class sign sticking out above the doorway, a low wooden shoe cabinet beside the door with pairs of students' white sneakers and canvas shoes in its cubbies, terrazzo floor, fluorescent light from the corridor ceiling. The floor in front of the door is still wet from mopping; no bucket here.",
    concepts: { doors: 'door' },
  },
  classroom: {
    base: "Inside the empty classroom of an old Taiwanese school: rows of old-style school desks made entirely of dark reddish-brown varnished wood, each with a closed wooden box front under the desktop where books are kept, and matching all-wood chairs with slatted backrests (no metal frames, no folding chairs, no plastic chairs); ceiling fans hanging still, an old CRT television on a wall bracket in a top corner, a small wall speaker, a dark green chalkboard with faint half-erased chalk marks and a narrow ruled column at its right edge for the date and the student on duty (left blank), chalk stubs and two felt erasers on the chalk ledge, a raised wooden platform with the teacher's wooden desk, a row of wooden cubby lockers along the back wall, one chair pulled out, and on a low cabinet at the back a classic cream-white round electric rice cooker with an aluminium dome lid, a black knob, two metal side handles and a black front switch with its small orange light on (no logo, no text), a single fluorescent tube lit above the teacher's desk, the back door half open. At the back, a metal cleaning cabinet stands open with brooms and a string mop leaning beside it, and part of the floor is still wet.",
    concepts: { doors: 'door', board: 'chalkboard', tv: 'television', papers: 'paper' },
  },
  office: {
    base: "Inside the teachers' office of an old Taiwanese school at night: grey metal teachers' desks pushed together in facing pairs, each with a sheet of glass over a green desk mat, stacks of graded exam papers with red pen marks, red pens in a mug, a thermos flask and a tea cup with a lid, wooden filing cabinets, venetian blinds, an old round wall clock, a small dark green chalkboard on the wall with faint half-erased chalk marks, a cork bulletin board with one long sheet of paper pinned in its centre (a class ranking list in tiny unreadable handwriting). Most fluorescent tubes are off; one desk lamp is on, and on the desk nearest the camera a single exam paper lies alone in its light, a red score circled at the top. The wooden door behind the camera is ajar.",
    concepts: { doors: 'door', board: 'chalkboard', papers: 'paper', notice: 'bulletin board' },
  },
};

// The three walks. Each chalkboard choice decides how the next walk has changed.
const LOOPS = [
  ['corridor', 'door', 'classroom'],
  ['corridor', 'door', 'office'],
  ['corridor', 'door', 'classroom'],
];
const DRAWS = LOOPS.length - 1;

const KEEP =
  'Keep everything else exactly the same: same camera position and angle, same lighting, same objects, same photographic style.';

const FINAL_CLASSROOM =
  'Also lower the camera to the eye height of a small child, about 70 cm, looking slightly up, so the desks and the chalkboard feel too big. On every chair lies a neatly folded white school shirt, as if the whole class took off their uniforms and left. On the desk nearest the camera lies one exam paper covered in red pen marks. The narrow column at the right edge of the chalkboard stays clearly visible.';

// Uniforms nobody is wearing, placed walk by walk so no room is ever the same twice.
const TRACES = {
  1: {
    corridor: 'A white short-sleeved school shirt hangs from one window grille, swaying slightly, as if someone just hung it there.',
    door: 'A pair of white sneakers stands side by side on the wet floor right in front of the door, toes pointing at it, as if someone is waiting to go in.',
    office: "A white school shirt and navy trousers are draped over the chair in front of the teacher's desk, as if a student was called in and is still sitting there.",
  },
  2: {
    corridor: 'A white school shirt now hangs from every window grille along the whole corridor, all of them perfectly still.',
    door: "Through the door's small glass window, rows of white school shirts can be seen inside the classroom, all perfectly still.",
  },
};

// The last classroom fills up: a class with its back to you, and then it turns around.
const CROWD_SEATED = `Every seat is now taken: at each desk sits a tall, adult-sized humanoid figure in a white short-sleeved Taiwanese school shirt with navy trim, with navy trousers or a pleated navy-plaid skirt, sitting perfectly still and upright, facing the chalkboard with its back to the camera. Their hair is black and their posture is a little too stiff. ${'Keep everything else exactly the same: same camera position and angle, same lighting, same room, same photographic style.'}`;
const CROWD_TURNED = [
  'Every seated figure has twisted its head around to stare straight at the camera over its shoulder, necks bent at impossible angles. Where each face should be there is only a smooth, blank, pale oval like unpainted plaster, each one slightly lopsided and warped, a few cracked, no eyes, no nose, no mouth. Keep everything else exactly the same: same camera position and angle, same lighting, same room, same photographic style.',
  'Every seated figure has twisted its head around to stare straight at the camera over its shoulder, necks bent at impossible angles. Where each face should be there is only a smooth, blank, pale oval like unpainted plaster, no eyes, no nose, no mouth. Keep everything else exactly the same: same camera position and angle, same lighting, same room, same photographic style.',
  'Every seated figure has turned around in its chair to face the camera. Each head is entirely wrapped in crumpled exam papers covered in red pen marks, like a tight paper mask; no face is visible. Keep everything else exactly the same: same camera position and angle, same lighting, same room, same photographic style.',
];

// The creatures are near-human and dressed as people from the school, and never have a face.
const TEACHER_CLOTHES = 'a beige knitted cardigan over a pale shirt, dark slacks, black leather shoes';
const teacherCreature = (clothes) =>
  `a tall, too-thin humanoid figure dressed like a homeroom teacher (${clothes || TEACHER_CLOTHES}), its neck a little too long and its head tilted at a wrong angle; where the face should be there is only a smooth, blank, pale oval like unpainted plaster, with no eyes, no nose and no mouth`;
const PAPER_HEAD =
  'one stiff humanoid figure in a white short-sleeved Taiwanese school shirt and navy trousers, its head entirely wrapped in crumpled exam papers covered in red pen marks like a tight paper mask, no face visible, shoulders uneven';

const SCARE_TEACHER = (clothes) =>
  `Add ${teacherCreature(clothes)}. It stands very close to the camera, about one and a half metres away in the middle of the corridor, facing the camera and filling much of the frame, lit harshly by the camera flash. ${KEEP}`;
const FLICKER_FIGURE = [
  null,
  `Add ${PAPER_HEAD}, standing far away at the very end of the corridor, small in the frame and easy to miss. ${KEEP}`,
  `Add ${PAPER_HEAD}, standing halfway down the corridor, facing the camera. ${KEEP}`,
];
const LIGHTS_OUT = [
  `All the lights are off; only the camera flash lights the room, which falls into darkness a few metres away. Every chair has been turned to face the camera, a white school shirt hanging over the backrest of each. In the dark between the desks stands ${PAPER_HEAD}, facing the camera. ${KEEP}`,
  `All the lights are off; only the camera flash lights the room, which falls into darkness a few metres away. Every chair has been turned to face the camera. At the front of the room stands ${teacherCreature()}, facing the camera. ${KEEP}`,
  `All the lights are off; only the camera flash lights the room. Every chair has been turned to face the camera. ${KEEP}`,
];

// Muse Image redraws each photo as a depth map, which the page uses for the 3D walk.
// The page checks it really looks like one and otherwise guesses depth itself.
const DEPTH_EDIT =
  'Redraw this photo as a grayscale depth map: pure white for the nearest surfaces, fading smoothly to pure black for the farthest. Same framing and composition, no texture, no lines, no color.';
const AI_DEPTH = process.env.AI_DEPTH !== 'off';
// Asking Muse Spark whether each edit is visible costs ~15 s per photo; every photo now
// changes on purpose, so the check is off unless asked for.
const CHECK_EDITS = process.env.CHECK_EDITS === 'on';

const DAYLIGHT_EDIT =
  'Same classroom, same camera position and angle, now in warm late-afternoon daylight: windows bright, sunlight falling across the desks, fluorescent tubes off, every chair back in its place. Keep every object exactly where it is.';

const BIBLE_SYSTEM = `You keep the memory of "Last One Out", a quiet horror walk through a remembered Taiwanese school at night. The player, the student on duty, gives up to three memories of their school and the year they were there. Write the memory bible that every later step follows: the same memories come back, changed, walk after walk.
Rules: ordinary and physical; objects, light and space only. Never add people, faces, readable text, flags, statues, portraits, slogans or religious objects to the photo details. Nothing about death, injury, self-harm, politics or religion.
Reply with JSON only:
{"memories_en":["each memory in natural English, same order"],
"era":"one English sentence of physical details right for a Taiwanese school in that year (furniture, appliances, lights, posters with no readable text)",
"details":{"corridor":"extra English visual details for the night-time corridor photo, from the memories and the era","door":"... for the classroom door photo","classroom":"... for the classroom photo","office":"... for the teachers' office photo"},
"threads":[{"memory":1,"motif":"a short English noun phrase","walk2":"how it returns, slightly wrong, in the second walk","walk3":"how it returns at its worst in the last walk"}],
"teacher":"the homeroom teacher's clothes and one object they always carried, in English, as remembered or as fits the era (never a face)",
"pa":"one short school PA announcement asking the student on duty to come to the teachers' office now, in the player's language, without any name",
"pa_en":"the same announcement in natural English",
"scores":[{"subject":"an exam subject in the player's language","subject_en":"the subject in English","score":a low score between 38 and 59}]}
Give three scores and one thread per memory. Every memory must become at least one concrete, clearly visible physical detail in the photo details (put it in the photo where it belongs), so the player recognises their own school at once.`;

const CARDS_SYSTEM = `You deal the choices in "Last One Out", a quiet horror game set in a remembered Taiwanese school at night. The player, the student on duty, walks the school three times. At the end of a walk three half-erased lines are on a chalkboard; the player keeps one, and that line decides how the next walk has changed.
You get the memory bible (memories, era, threads that must come back changed), the walk being prepared, the changes already made, and the photos the next walk reuses.
Walk 2 goes corridor -> classroom door -> teachers' office. Things are clearly wrong and space begins to bend: a tube light is dark and the corridor beyond it is far too long, the same door repeats into the distance, the duty student's red bucket stands where it could not be, the mop trail runs up the wall, every classroom door stands ajar. Bring back one memory thread, already wrong.
Walk 3 goes corridor -> classroom door -> classroom, and it is the last. What hurt comes back through traces and space, never in person: a school uniform hanging on every chair, every desk pushed away from one desk left alone, every chair turned to face the camera, exam papers stacked to the ceiling, the shadows of a whole class on the floor with nobody casting them, a dark adult silhouette far away with its back turned. Bring back a memory thread at its worst.
Look at the photos. Every instruction must name things that are really in that photo and be doable as an edit of it, clearly visible. The teachers' office has not been photographed yet: its instruction is a detail to add to its first photo.
The image editor refuses any picture of children or students, so classmates never appear in person. Uniforms are Taiwanese, mixed boys' and girls': white short-sleeved shirts with navy trim, navy trousers or pleated navy-plaid skirts; no crests, badges, names or numbers. Shoes are white sneakers and canvas shoes. Never show a face. Never add ghosts, blood, injury, death, religion, politics, flags, statues or readable text. Never repeat a previous change. The three lines must be very different from each other.
Each line gives one instruction for every photo of the next walk: every place must look different from the last time the player saw it.
Reply with JSON only:
{"cards":[{"title":"at most 6 words in the player's language","whisper":"one short eerie line in the player's language","title_en":"the title in natural English","whisper_en":"the line in natural English","edits":{"<photo id>":"precise English instruction, or empty"},"sound":"none|silence|echo|bell|ball|laughter|giggle|running|chalk|chair|papers|speaker|water"}]}
Sounds: ball = a ball bounces and rolls down the corridor; laughter = children playing somewhere out of sight; giggle = a child giggles nearby, unseen; running = small feet run past behind you; chalk = chalk scratching on a board; chair = a chair dragged across the floor; papers = sheets of paper shuffled; speaker = the school speaker crackles; water = dripping; bell = the school bell; echo = every step echoes far too long; silence = all sound stops.`;

const COMMENT_SYSTEM = `Write one short teacher's note for a student's contact book. The student went back to their old school, alone, at night, and saw the changes listed below. The memories are theirs.
Write as the teacher who never said their name and finally noticed them: warm, a little uncanny, kind about whatever was hard back then. At most 30 words. No names, no death, no ghosts, no danger.
Reply with JSON only: {"note":"the note in the requested language","note_en":"the same note in natural English"}`;

const SOFTEN_SYSTEM = `This photo-edit instruction for a quiet horror game set in an empty Taiwanese school at night was refused by the image model's content policy.
Rewrite it so it keeps the same unsettling idea but cannot be refused: no people of any age, no children, no students, no bodies, no faces; show absence through objects, shadows, light and space instead. Keep it one precise instruction describing only what changes. Reply with the new instruction only.`;

const TRADITIONAL_SYSTEM =
  'Rewrite this transcribed sentence in Traditional Chinese characters as written in Taiwan, with natural punctuation. Change nothing else. Reply with the sentence only.';

const editPrompt = (change) =>
  `${change} ${KEEP} If people appear, show them only from behind, far away or blurred by motion; never show a face.`;

// ---------- helpers ----------

const cleanText = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const newId = () => randomUUID().replaceAll('-', '').slice(0, 12);
const ID = /^[a-f0-9]{12}$/;
const hasCjk = (text) => /[㐀-鿿]/.test(text);
const THIS_YEAR = new Date().getFullYear();
const quiet = (promise) => (promise.catch(() => {}), promise); // handled later; never unhandled

function parseJson(text) {
  try {
    return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  } catch {
    return null;
  }
}

const SOUNDS = new Set(['none', 'silence', 'echo', 'bell', 'ball', 'laughter', 'chalk', 'chair', 'papers', 'speaker', 'water', 'giggle', 'running']);

function parseDeal(text, ids) {
  const cards = parseJson(text)?.cards;
  const editsOf = (c) => Object.fromEntries(ids.map((id) => [id, cleanText(c?.edits?.[id], 500)]));
  const usable = (c) => c?.title && Object.values(editsOf(c)).some(Boolean);
  if (!Array.isArray(cards) || cards.length < 3 || !cards.slice(0, 3).every(usable)) {
    throw new HttpError(502, 'The chalk lines came back garbled. Try again.');
  }
  return cards.slice(0, 3).map((c) => ({
    title: cleanText(c.title, 60),
    whisper: cleanText(c.whisper, 160),
    title_en: cleanText(c.title_en, 80) || cleanText(c.title, 60),
    whisper_en: cleanText(c.whisper_en, 200) || cleanText(c.whisper, 160),
    edits: editsOf(c),
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

const refused = (err) => err instanceof UpstreamError && err.upstream === 400;

// Tries each edit in turn and keeps the first one the image model accepts.
async function firstAcceptedEdit(photoId, prompts) {
  const { bytes } = await readPhoto(photoId);
  for (const prompt of prompts) {
    try {
      return await savePhoto(await editImage(bytes, prompt));
    } catch (err) {
      if (!refused(err)) throw err;
    }
  }
  return null;
}

// Tries the edits at the same time and keeps the most preferred one that was accepted:
// a refusal takes as long as a success, so trying them one by one doubles the wait.
async function preferredEdit(photoId, prompts) {
  const { bytes } = await readPhoto(photoId);
  const results = await Promise.all(
    prompts.map((prompt) =>
      editImage(bytes, prompt).then(
        (out) => ({ out }),
        (err) => {
          if (!refused(err)) throw err;
          return null;
        },
      ),
    ),
  );
  const first = results.find(Boolean);
  return first ? savePhoto(first.out) : null;
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

function photoPrompt(id, school, extra) {
  const era = school.bible?.era ? `The school as it was around ${school.year}: ${school.bible.era}` : '';
  return [HOUSE_STYLE, era, SCENES[id].base, school.bible?.details?.[id], extra].filter(Boolean).join(' ');
}

// A first photograph. If the extra detail gets it refused, it is taken without it.
async function takePhoto(id, school, extra) {
  if (MOCK) return savePhoto(mockPhoto(id, { walk: school.changes.length, changes: school.changes, note: extra }));
  try {
    return await savePhoto(await generateImage(photoPrompt(id, school, extra)));
  } catch (err) {
    if (!refused(err)) throw err;
    console.error(`[photo] ${id}: refused, taking it without the extra details`);
    return savePhoto(await generateImage([HOUSE_STYLE, SCENES[id].base].join(' ')));
  }
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

// How much of the smaller box lies inside the other (0 = apart, 1 = one inside the other).
function overlap(a, b) {
  const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return (w * h) / Math.min(a.w * a.h, b.w * b.h);
}

// Large enough to click, and not a sliver at the edge of the frame.
const clickable = (box) => box.w * box.h > 0.004 && box.w > 0.02;

async function sceneView(id, photoId) {
  const concepts = SCENES[id].concepts;
  const keys = Object.keys(concepts);
  const [depth, ...found] = await Promise.all([
    depthMap(photoId),
    ...keys.map((key) => findObjectsSafely(photoId, concepts[key], id)),
  ]);
  const view = { id, photo: `/photos/${photoId}`, depth };
  keys.forEach((key, i) => {
    if (key === 'doors') view.doors = found[i].filter(clickable).slice(0, 5);
    // Papers lie on desks: in the lower part of the photo and wider than tall.
    else if (key === 'papers') view.papers = found[i].filter((b) => b.y + b.h / 2 > 0.45 && b.w > b.h * 0.8).slice(0, 3);
    else view[key] = found[i][0] ?? null;
  });
  // SAM can call the cork board a chalkboard too; the chalkboard is the one that is not it.
  const boards = found[keys.indexOf('board')] ?? [];
  if (view.notice && boards.length) view.board = boards.find((b) => overlap(b, view.notice) < 0.3) ?? null;
  return view;
}

async function firstWalk(school) {
  const ids = LOOPS[0];
  const photoIds = await Promise.all(ids.map((id) => takePhoto(id, school)));
  ids.forEach((id, i) => (school.photos[id] = photoIds[i]));
  school.first = { ...school.photos };
  const scenes = await Promise.all(ids.map((id, i) => sceneView(id, photoIds[i])));
  for (const view of scenes) school.views[view.id] = view;
  return { index: 0, scenes, flicker: null, scare: null };
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

// Edits one scene's photo: refused -> rewritten and retried; not visible -> pushed once
// more; still refused -> null, and the photo stays as it was.
async function editScene(id, previous, instruction, fallback) {
  const { bytes } = await readPhoto(previous);
  let used = instruction;
  let photoId;
  try {
    photoId = await savePhoto(await editImage(bytes, editPrompt(used)));
  } catch (err) {
    if (!refused(err)) throw err;
    try {
      used = (await softenEdit(instruction)) || instruction.split(/(?<=\.)\s/)[0];
      console.error(`[edit] ${id}: refused, retrying a rewritten edit`);
      photoId = await savePhoto(await editImage(bytes, editPrompt(used)));
    } catch (again) {
      if (again.status === 402) throw again;
      if (fallback && fallback !== instruction) {
        console.error(`[edit] ${id}: refused twice, trying only the shirts`);
        return firstAcceptedEdit(previous, [editPrompt(fallback)]);
      }
      console.error(`[edit] ${id}: refused twice, keeping the previous photo`);
      return null;
    }
  }
  if (CHECK_EDITS && !(await photoShows(photoId, used))) {
    try {
      photoId = await savePhoto(await editImage(bytes, editPrompt(`Make this change clearly visible: ${used}`)));
    } catch (err) {
      if (err.status === 402) throw err;
      console.error(`[edit] ${id}: retry failed, keeping the first edit`);
    }
  }
  return photoId;
}

// ---------- the memory bible ----------

const MOCK_BIBLE = {
  memories_en: [],
  era: '',
  details: {},
  threads: [],
  teacher: '',
  pa: { zh: '值日生，請馬上到辦公室來。', en: 'Student on duty, please come to the teachers’ office now.' },
  scores: [
    { subject: '數學', subject_en: 'Maths', score: 42 },
    { subject: '英文', subject_en: 'English', score: 57 },
    { subject: '理化', subject_en: 'Science', score: 38 },
  ],
};

async function memoryBible(school) {
  if (MOCK) return { ...MOCK_BIBLE, memories_en: school.memories };
  const text = await chat(
    [
      { role: 'system', content: BIBLE_SYSTEM },
      {
        role: 'user',
        content: JSON.stringify({
          language: school.lang === 'zh' ? 'Traditional Chinese (Taiwan)' : 'English',
          year: school.year,
          memories: school.memories,
        }),
      },
    ],
    { effort: 'low', maxTokens: 6000 },
  );
  const b = parseJson(text) ?? {};
  const fallback = MOCK_BIBLE;
  const scores = (Array.isArray(b.scores) ? b.scores : [])
    .map((s) => ({
      subject: cleanText(s?.subject, 12),
      subject_en: cleanText(s?.subject_en, 20) || cleanText(s?.subject, 12),
      score: Math.min(59, Math.max(30, Math.round(Number(s?.score)) || 0)),
    }))
    .filter((s) => s.subject && s.score)
    .slice(0, 3);
  return {
    memories_en: (Array.isArray(b.memories_en) ? b.memories_en : []).map((m) => cleanText(m, 300)).slice(0, 3),
    era: cleanText(b.era, 400),
    details: Object.fromEntries(Object.keys(SCENES).map((id) => [id, cleanText(b.details?.[id], 400)])),
    threads: (Array.isArray(b.threads) ? b.threads : []).slice(0, 3).map((th) => ({
      motif: cleanText(th?.motif, 80),
      walk2: cleanText(th?.walk2, 300),
      walk3: cleanText(th?.walk3, 300),
    })),
    teacher: cleanText(b.teacher, 200),
    pa: {
      [school.lang]: cleanText(b.pa, 80) || fallback.pa[school.lang],
      en: cleanText(b.pa_en, 140) || fallback.pa.en,
    },
    scores: scores.length === 3 ? scores : fallback.scores,
  };
}

// What the page needs from the bible. The page adds the player's name itself.
const publicBible = (school) => ({
  year: school.year,
  scores: school.bible.scores,
  pa: school.bible.pa,
});

// ---------- the next walk, prepared while you walk this one ----------

async function dealCards(school, loop) {
  if (MOCK) return MOCK_DEALS[(loop - 1) % MOCK_DEALS.length];
  const ids = LOOPS[loop];
  const shown = [...new Set(ids)].filter((id) => school.photos[id]);
  const brief = JSON.stringify({
    walk: loop + 1,
    of: LOOPS.length,
    photos: ids,
    language: school.lang === 'zh' ? 'Traditional Chinese (Taiwan)' : 'English',
    year: school.year,
    memories: school.memories,
    bible: { era: school.bible.era, threads: school.bible.threads, teacher: school.bible.teacher },
    previous: school.changes.map((c) => c.title_en || c.title),
  });
  const images = await Promise.all(
    shown.map(async (id) => [
      { type: 'text', text: `Photo "${id}" as it is now:` },
      { type: 'image_url', image_url: { url: dataUrl((await readPhoto(school.photos[id])).bytes) } },
    ]),
  );
  const ask = (withPhotos) =>
    chat(
      [
        { role: 'system', content: CARDS_SYSTEM },
        { role: 'user', content: withPhotos ? [{ type: 'text', text: brief }, ...images.flat()] : brief },
      ],
      { effort: 'low', maxTokens: 8000 },
    );
  try {
    return parseDeal(await ask(true), ids);
  } catch (err) {
    if (err.status === 402) throw err;
    console.error(`[deal] ${err.message}; dealing again without the photos`);
    return parseDeal(await ask(false), ids);
  }
}

// A frame that shows for a fraction of a second while a tube flickers: someone is there.
async function flickerFrame(corridorId, loop) {
  if (!FLICKER_FIGURE[loop]) return null;
  if (MOCK) return `/photos/${await savePhoto(mockPhoto('corridor', { walk: loop, changes: [], note: 'flicker: a figure down the corridor' }))}`;
  try {
    const id = await firstAcceptedEdit(corridorId, [FLICKER_FIGURE[loop]]);
    return id && `/photos/${id}`;
  } catch (err) {
    if (err.status === 402) throw err;
    console.error(`[flicker] ${err.message}`);
    return null;
  }
}

// The first scare: the door opens onto the corridor where you started, and the
// teacher is standing right there.
async function teacherScare(school) {
  if (MOCK) return `/photos/${await savePhoto(mockPhoto('corridor', { walk: 1, changes: [], note: 'scare: the faceless teacher' }))}`;
  try {
    const id = await firstAcceptedEdit(school.first.corridor, [SCARE_TEACHER(school.bible.teacher), SCARE_TEACHER()]);
    return id && `/photos/${id}`;
  } catch (err) {
    if (err.status === 402) throw err;
    console.error(`[scare] teacher: ${err.message}`);
    return null;
  }
}

// The second scare. The classroom you walk into is full, backs to you; at roll call
// every head turns. If the crowd is refused, the lights go out instead.
async function crowdFrames(classroomId) {
  if (MOCK) {
    const [seated, turned] = await Promise.all(
      ['crowd: a class with its back to you', 'scare: every head turns to you'].map((note) => savePhoto(mockPhoto('classroom', { walk: 2, changes: [], note }))),
    );
    return { seated: `/photos/${seated}`, turned: `/photos/${turned}` };
  }
  try {
    const seated = await firstAcceptedEdit(classroomId, [CROWD_SEATED]);
    const turned = seated && (await preferredEdit(seated, CROWD_TURNED));
    if (seated && turned) return { seated: `/photos/${seated}`, turned: `/photos/${turned}` };
    const dark = await firstAcceptedEdit(classroomId, LIGHTS_OUT);
    return { seated: null, turned: dark && `/photos/${dark}` };
  } catch (err) {
    if (err.status === 402) throw err;
    console.error(`[scare] crowd: ${err.message}`);
    return { seated: null, turned: null };
  }
}

// Renders one chalk line's version of the next walk, photos, doors and scares included.
// Scare and flicker frames start as soon as their photo exists, alongside depth and SAM.
async function renderOption(school, loop, card) {
  const ids = LOOPS[loop];
  const changes = [...school.changes, card];
  const last = loop === LOOPS.length - 1;
  const photoIds = {};
  const views = {};
  let flicker = Promise.resolve(null);
  let scare = loop === 1 ? school.scare1 : Promise.resolve(null);
  await Promise.all(
    ids.map(async (id) => {
      const previous = school.photos[id];
      let photoId = previous;
      if (MOCK) photoId = await savePhoto(mockPhoto(id, { walk: loop, changes }));
      else if (!previous) photoId = await takePhoto(id, school, [card.edits[id], TRACES[loop]?.[id]].filter(Boolean).join(' ')); // first time in this room
      else {
        const instruction = [card.edits[id], TRACES[loop]?.[id], last && id === 'classroom' ? FINAL_CLASSROOM : ''].filter(Boolean).join(' ');
        const fallback = [TRACES[loop]?.[id], last && id === 'classroom' ? FINAL_CLASSROOM.replace(/^Also /, '') : ''].filter(Boolean).join(' ');
        if (instruction) photoId = (await editScene(id, previous, instruction, fallback)) ?? previous;
      }
      photoIds[id] = photoId;
      if (id === 'corridor') flicker = quiet(flickerFrame(photoId, loop));
      if (id === 'classroom' && last) scare = quiet(crowdFrames(photoId));
      views[id] = photoId === previous && school.views[id] ? school.views[id] : await sceneView(id, photoId);
    }),
  );
  const [figure, frames] = await Promise.all([flicker, scare]);
  const scenes = ids.map((id) => views[id]);
  let frame = null;
  if (loop === 1 && frames) frame = { after: 'door', kind: 'teacher', photo: frames };
  if (last && frames?.turned) {
    frame = { after: 'classroom', kind: frames.seated ? 'turn' : 'dark', photo: frames.turned };
    if (frames.seated) {
      // You walk into the full room; once they have turned, it is empty again.
      const i = ids.indexOf('classroom');
      scenes[i] = { ...scenes[i], photo: frames.seated, after: scenes[i].photo };
    }
  }
  return {
    card,
    photoIds,
    walk: {
      index: loop,
      scenes,
      flicker: figure ? { scene: 'corridor', photo: figure } : null,
      scare: frame,
    },
  };
}

// Starts dealing and rendering all three lines of the next walk in the background.
function prepareLoop(school) {
  const loop = school.changes.length + 1;
  const cards = quiet(dealCards(school, loop));
  const contexts = [0, 1, 2].map(() => ({ cancelled: false }));
  const options = [0, 1, 2].map((i) => quiet(cards.then((dealt) => job.run(contexts[i], () => renderOption(school, loop, dealt[i])))));
  school.next = { loop, cards, options, contexts };
  return school.next;
}

function commit(school, option) {
  school.changes.push(option.card);
  Object.assign(school.photos, option.photoIds);
  for (const view of option.walk.scenes) school.views[view.id] = view;
  return option.walk;
}

// The teacher's note, in the player's language and in English. Never left blank.
async function teacherComment(school) {
  const fallback = { comment: MOCK_COMMENT[school.lang], comment_en: MOCK_COMMENT.en };
  if (MOCK) return fallback;
  try {
    const text = await chat(
      [
        { role: 'system', content: COMMENT_SYSTEM },
        {
          role: 'user',
          content: `Language: ${school.lang === 'zh' ? 'Traditional Chinese (Taiwan)' : 'English'}\nMemories: ${(school.bible.memories_en.length ? school.bible.memories_en : school.memories).join('; ')}\nChanges: ${school.changes.map((c) => c.title_en || c.title).join('; ')}`,
        },
      ],
      { effort: 'low', maxTokens: 4000 },
    );
    const note = parseJson(text);
    const comment = cleanText(note?.note, 200);
    if (!comment) return fallback;
    return { comment, comment_en: cleanText(note?.note_en, 300) || comment };
  } catch (err) {
    if (err.status === 402) throw err;
    console.error(`[comment] ${err.message}`);
    return fallback;
  }
}

// The ending is prepared during the last walk: the classroom in daylight and the note.
async function prepareEnding(school) {
  const [daylightId, comment] = await Promise.all([
    MOCK
      ? savePhoto(mockPhoto('classroom', { walk: school.changes.length, changes: school.changes, daylight: true }))
      : readPhoto(school.photos.classroom).then(({ bytes }) => editImage(bytes, DAYLIGHT_EDIT)).then(savePhoto),
    teacherComment(school),
  ]);
  return {
    daylight: `/photos/${daylightId}`,
    first: `/photos/${school.first.corridor}`,
    last: `/photos/${school.photos.corridor}`,
    year: school.year,
    memories: school.memories,
    memories_en: school.bible.memories_en,
    changes: school.changes.map((c) => c.title),
    changes_en: school.changes.map((c) => c.title_en || c.title),
    ...comment,
  };
}

// ---------- your voice ----------

// Muse Voice Transcribe takes WAV, mono, 16-bit, 16 or 24 kHz. Nothing is stored.
async function transcribe(wav, lang) {
  if (MOCK) return '';
  if (wav.length < 44 || wav.subarray(0, 4).toString() !== 'RIFF' || wav.subarray(8, 12).toString() !== 'WAVE') {
    throw new HttpError(400, 'Send a WAV recording.');
  }
  assertBudget();
  const form = new FormData();
  form.append(
    'request',
    new Blob(
      [JSON.stringify({ model: VOICE_MODEL, mode: 'PUSH_TO_TALK', audioEncoding: 'WAV', languageBias: [lang === 'zh' ? 'Chinese' : 'English'] })],
      { type: 'application/json' },
    ),
  );
  form.append('audio', new Blob([wav], { type: 'audio/wav' }), 'voice.wav');
  const res = await fetch(`${API_BASE}/asr/transcribe`, {
    method: 'POST',
    headers: authHeader(),
    body: form,
    redirect: 'error',
    signal: AbortSignal.timeout(60_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const reason = String(data?.error?.message ?? data?.message ?? '').replace(/\s+/g, ' ').slice(0, 200);
    console.error(`[voice] HTTP ${res.status} ${reason}`);
    throw new UpstreamError(res.status);
  }
  await addSpend(((wav.length - 44) / 32000 / 3600) * VOICE_PRICE_PER_HOUR);
  return cleanText(data?.transcript ?? data?.text ?? '', 400);
}

// ---------- routes ----------

const yearOf = (value) => {
  const year = Math.round(Number(value));
  return year >= 1950 && year <= THIS_YEAR ? year : THIS_YEAR - 15;
};

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
      year: yearOf(body.year),
      lang: ['zh', 'en'].includes(body.lang) ? body.lang : hasCjk(memories.join('')) ? 'zh' : 'en',
      bible: null,
      photos: {},
      views: {},
      first: {},
      changes: [],
      next: null,
      scare1: null,
      ending: null,
      busy: false,
      record: { walks: [], draws: [] }, // replayed later without any model calls
    };
    schools.set(school.id, school);
    if (schools.size > 200) schools.delete(schools.keys().next().value);
    return exclusive(school, async () => {
      school.bible = await memoryBible(school);
      const walk = await firstWalk(school);
      school.record.walks.push(walk);
      school.scare1 = quiet(teacherScare(school));
      prepareLoop(school);
      return { schoolId: school.id, lang: school.lang, draws: DRAWS, bible: publicBible(school), walk };
    });
  },

  // Keeping a chalk line. Its walk was rendered in the background; this waits for it.
  'POST /api/draw': async (body) => {
    const school = getSchool(body.schoolId);
    const index = Number(body.index);
    if (![0, 1, 2].includes(index)) throw new HttpError(400, 'Keep one of the three lines.');
    if (school.changes.length >= DRAWS) throw new HttpError(409, 'No lines left. Walk on.');
    return exclusive(school, async () => {
      let next = school.next ?? prepareLoop(school);
      next.contexts.forEach((context, i) => (context.cancelled = i !== index)); // only the kept line is still needed
      let cards = await next.cards.catch(() => null);
      if (!cards) {
        next = prepareLoop(school); // the deal failed once; deal again
        next.contexts.forEach((context, i) => (context.cancelled = i !== index));
        cards = await next.cards;
      }
      const option = await next.options[index].catch((err) => {
        if (err.status === 402) throw err;
        console.error(`[draw] ${err.message}; rendering the line again`);
        return renderOption(school, next.loop, cards[index]);
      });
      school.next = null;
      const walk = commit(school, option);
      school.record.draws.push({ cards, picked: index });
      school.record.walks.push(walk);
      const last = school.changes.length >= DRAWS;
      if (last) school.ending = quiet(prepareEnding(school));
      else prepareLoop(school);
      return { cards, picked: index, walk, last };
    });
  },

  'POST /api/ending': async (body) => {
    const school = getSchool(body.schoolId);
    if (school.changes.length < DRAWS || !school.ending) throw new HttpError(409, 'Not yet.');
    return exclusive(school, async () => {
      const ending = await school.ending.catch((err) => {
        if (err.status === 402) throw err;
        school.ending = quiet(prepareEnding(school));
        return school.ending;
      });
      if (!school.saved) {
        school.saved = true;
        await saveRun(school, ending).catch((err) => console.error(`[run] not saved: ${err.message}`));
      }
      return ending;
    });
  },
};

// Your voice: the memories you speak and your answer at roll call. Audio in, text out.
const binaryRoutes = {
  'POST /api/transcribe': async (bytes, url) => {
    const lang = url.searchParams.get('lang') === 'zh' ? 'zh' : 'en';
    let transcript = await transcribe(bytes, lang);
    // Speech comes back in Simplified Chinese; a spoken memory is written the Taiwanese way.
    if (lang === 'zh' && url.searchParams.get('for') === 'memory' && transcript) {
      transcript = cleanText(await chat([{ role: 'system', content: TRADITIONAL_SYSTEM }, { role: 'user', content: transcript }], { effort: 'low', maxTokens: 1500 }), 200) || transcript;
    }
    return { transcript: lang === 'en' ? transcript.replace(/[。，]+/g, '').trim() : transcript.replace(/。{2,}/g, '。') };
  },
};

// Saves a finished walk with its photos to runs/<id>/, so scripts/build-demo.mjs can
// publish a replay that needs no model calls. The player's name is never part of it.
async function saveRun(school, ending) {
  const dir = join(RUNS_DIR, school.id);
  const photoDir = join(dir, 'photos');
  await mkdir(photoDir, { recursive: true });
  const local = async (url) => {
    if (!url) return url;
    const id = url.slice('/photos/'.length);
    const { bytes, mime } = await readPhoto(id);
    const name = `${id}.${EXT[mime]}`;
    await writeFile(join(photoDir, name), bytes);
    return `photos/${name}`;
  };
  const frame = async (f) => (f ? { ...f, photo: await local(f.photo) } : null);
  const walks = await Promise.all(
    school.record.walks.map(async (walk) => ({
      ...walk,
      scenes: await Promise.all(
        walk.scenes.map(async (scene) => ({ ...scene, photo: await local(scene.photo), depth: await local(scene.depth), after: await local(scene.after) })),
      ),
      flicker: await frame(walk.flicker),
      scare: await frame(walk.scare),
    })),
  );
  const run = {
    lang: school.lang,
    memories: school.memories,
    memories_en: school.bible.memories_en,
    bible: publicBible(school),
    walks,
    draws: school.record.draws,
    ending: { ...ending, daylight: await local(ending.daylight), first: await local(ending.first), last: await local(ending.last) },
  };
  await writeFile(join(dir, 'run.json'), JSON.stringify(run, null, 2));
  console.log(`[run] saved runs/${school.id}`);
}

// ---------- http ----------

const APP_CSP =
  "default-src 'self'; img-src 'self' blob: data:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
  "base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const PHOTO_CSP = "default-src 'none'; style-src 'unsafe-inline'";
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg' };

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

async function readBytes(req, limit) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Too long. Keep it short.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
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
    const binary = binaryRoutes[`${req.method} ${url.pathname}`];
    if (binary) return sendJson(res, 200, await binary(await readBytes(req, 2_000_000), url));
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
