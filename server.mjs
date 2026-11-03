// Mutation Forge — local server.
// Keeps the Meta Model API key on the server, serves the UI, and serves each
// generated game from its own locked-down URL (sandboxed, no network access).
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOCK_CARDS, MOCK_GAME } from './mock.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const GAMES_DIR = join(ROOT, 'games');
const SPEND_FILE = join(ROOT, '.spend.json');

const PORT = Number(process.env.PORT || 4310);
const API_KEY = process.env.MODEL_API_KEY || '';
const API_BASE = 'https://api.meta.ai/v1';
const TEXT_MODEL = process.env.TEXT_MODEL || 'muse-spark-1.3';
const SPEND_CAP_USD = Number(process.env.SPEND_CAP_USD || 100);
const MOCK = !API_KEY;

// USD per 1M tokens, from dev.meta.ai/docs/pricing-rate-limits (2026-11-03).
// Unknown models are priced like the most expensive one so the cap stays safe.
const PRICES = {
  'muse-spark-1.3': { in: 1.25, out: 4.25 },
  'muse-spark-1.3-contributor': { in: 0.1, out: 0.2 },
  'muse-wonder-1.0': { in: 4, out: 20 },
};
const FALLBACK_PRICE = PRICES['muse-wonder-1.0'];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
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

async function callModel(path, body) {
  assertBudget();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(240_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const kind = String(data?.error?.type ?? data?.error?.code ?? 'unknown').slice(0, 60);
    console.error(`[model] ${path} ${body.model} -> HTTP ${res.status} (${kind})`);
    throw new HttpError(502, res.status === 429 ? 'The model is busy. Try again in a moment.' : `The model call failed (HTTP ${res.status}).`);
  }
  return data;
}

async function chat(system, user, { effort = 'low', maxTokens = 4000 } = {}) {
  const data = await callModel('/chat/completions', {
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    reasoning_effort: effort,
    max_completion_tokens: maxTokens,
  });
  const price = PRICES[TEXT_MODEL] ?? FALLBACK_PRICE;
  const usage = data.usage ?? {};
  await addSpend(((usage.prompt_tokens ?? 0) * price.in + (usage.completion_tokens ?? 0) * price.out) / 1e6);
  return data.choices?.[0]?.message?.content ?? '';
}

// ---------- prompts ----------

const CARDS_SYSTEM = `You are the card dealer of Mutation Forge, where players turn a game idea into something original.
Given the player's idea:
1. Name the closest familiar genre or mechanic family in generic words. Never name commercial games, brands or characters.
2. Deal exactly 3 mutation cards. Each card must change a CORE rule of play (controls, goal, physics, time, perspective, or who the player is), not just the theme or art. Each must be playable in a small 2D browser game and visible within 10 seconds of play. Make the three cards very different from each other.
Reply with JSON only, no prose:
{"nearest":"...","why_familiar":"one sentence","cards":[{"title":"at most 4 words","rule":"one sentence","twist":"one sentence on what becomes possible"}]}
Write the text values in the same language as the player's idea.`;

const GAME_SYSTEM = `You write complete, original, playable 2D browser games as ONE self-contained HTML file.
Rules:
- Only inline <style> and <script>. No external URLs, imports, fonts, images, fetch, storage or any network access.
- Draw with <canvas> 2D, fill the viewport, handle resize, and support both keyboard and touch/pointer input.
- Include a title screen with one line on how to play, a visible score, a game-over state and restart.
- The mutation card's rule must be the core mechanic and obvious within 10 seconds of play.
- Do not copy names, characters, levels or art of existing games.
- Keep it under 400 lines and make sure it runs without errors.
Output only the HTML, inside one \`\`\`html block.`;

const FIX_SYSTEM = `You repair browser games. You get a single-file HTML game and the runtime error it threw.
Fix the cause, keep the game and its rules the same, and keep all previous constraints (no network, no external resources).
Output only the full fixed HTML, inside one \`\`\`html block.`;

// ---------- helpers ----------

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function parseCards(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  let data;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new HttpError(502, 'The cards came back garbled. Deal again.');
  }
  const cards = Array.isArray(data.cards) ? data.cards.slice(0, 3) : [];
  if (cards.length !== 3 || cards.some((c) => !c?.title || !c?.rule)) {
    throw new HttpError(502, 'The cards came back incomplete. Deal again.');
  }
  return {
    nearest: cleanText(data.nearest, 120),
    why_familiar: cleanText(data.why_familiar, 300),
    cards: cards.map((c) => ({
      title: cleanText(c.title, 80),
      rule: cleanText(c.rule, 300),
      twist: cleanText(c.twist, 300),
    })),
  };
}

function extractHtml(text) {
  const fenced = text.match(/```html\s*([\s\S]*?)```/i);
  const html = (fenced ? fenced[1] : text).trim();
  if (!/<script|<canvas/i.test(html)) {
    throw new HttpError(502, 'The model did not return a game. Try again.');
  }
  return html;
}

// ---------- generated games ----------

const games = new Map(); // id -> { html, idea, card }
const GAME_ID = /^[a-f0-9]{8}$/;

async function saveGame(html, meta) {
  const id = randomUUID().replaceAll('-', '').slice(0, 8);
  games.set(id, { html, ...meta });
  if (games.size > 100) games.delete(games.keys().next().value);
  await mkdir(GAMES_DIR, { recursive: true });
  await writeFile(join(GAMES_DIR, `${id}.html`), html);
  return id;
}

async function loadGame(id) {
  if (!GAME_ID.test(id)) return null;
  if (games.has(id)) return games.get(id);
  try {
    return { html: await readFile(join(GAMES_DIR, `${id}.html`), 'utf8') };
  } catch {
    return null;
  }
}

// Reports runtime errors to the page around the game, so the game can be repaired.
// Inserted on the same line as <head> so the model's line numbers stay correct.
const ERROR_REPORTER =
  "<script>(()=>{const s=(m)=>parent.postMessage({type:'forge-error',message:String(m).slice(0,500)},'*');" +
  "addEventListener('error',(e)=>s(e.message+(e.lineno?' (line '+e.lineno+')':'')));" +
  "addEventListener('unhandledrejection',(e)=>s(e.reason));})()</script>";

function withReporter(html) {
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + ERROR_REPORTER) : ERROR_REPORTER + html;
}

// ---------- routes ----------

const routes = {
  'GET /api/status': async () => ({
    mock: MOCK,
    model: TEXT_MODEL,
    spentUsd: Math.round(spentUsd * 100) / 100,
    capUsd: SPEND_CAP_USD,
  }),

  'POST /api/cards': async (body) => {
    const idea = cleanText(body.idea, 500);
    if (!idea) throw new HttpError(400, 'Describe your game idea first.');
    if (MOCK) return MOCK_CARDS;
    return parseCards(await chat(CARDS_SYSTEM, idea, { effort: 'low', maxTokens: 3000 }));
  },

  'POST /api/game': async (body) => {
    const idea = cleanText(body.idea, 500);
    const card = { title: cleanText(body.card?.title, 80), rule: cleanText(body.card?.rule, 300) };
    if (!idea || !card.rule) throw new HttpError(400, 'Pick a card first.');
    const html = MOCK
      ? MOCK_GAME
      : extractHtml(
          await chat(GAME_SYSTEM, `Game idea: ${idea}\nMutation card: ${card.title} — ${card.rule}`, {
            effort: 'medium',
            maxTokens: 20000,
          }),
        );
    return { id: await saveGame(html, { idea, card }) };
  },

  'POST /api/fix': async (body) => {
    const id = cleanText(body.id, 8);
    const game = await loadGame(id);
    if (!game) throw new HttpError(404, 'That game is gone. Forge a new one.');
    if (MOCK) return { id };
    const error = cleanText(body.error, 500);
    const html = extractHtml(
      await chat(FIX_SYSTEM, `Runtime error: ${error}\n\n\`\`\`html\n${game.html}\n\`\`\``, {
        effort: 'low',
        maxTokens: 20000,
      }),
    );
    return { id: await saveGame(html, { idea: game.idea, card: game.card, fixedFrom: id }) };
  },
};

// ---------- http ----------

const APP_CSP =
  "default-src 'self'; img-src 'self' data:; frame-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const GAME_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; " +
  "media-src data: blob:; font-src data:; frame-ancestors 'self'; sandbox allow-scripts";
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
    if (size > 300_000) throw new HttpError(413, 'Too large.');
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

async function servePlay(id, res) {
  const game = await loadGame(id);
  if (!game) return send(res, 404, 'Game not found', { 'Content-Type': 'text/plain' });
  send(res, 200, withReporter(game.html), {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': GAME_CSP,
  });
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname.startsWith('/play/')) return await servePlay(url.pathname.slice(6), res);
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
  console.log(`Mutation Forge on http://127.0.0.1:${PORT}  (${MOCK ? 'mock mode — no MODEL_API_KEY' : TEXT_MODEL})`);
});
