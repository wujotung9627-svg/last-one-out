// Renders the trailer's title cards as short animated clips (1920x1080, 30 fps, with sound).
// Each card is drawn frame by frame on a canvas (deterministic, no dropped frames), then
// ffmpeg joins the frames with a synthesised sound for its effect.
//   node titles.mjs <out dir> <cards.json>      cards.json: [{ "text": "...", "effect": "flicker" (default) | "seep|crack|smear|stain" }]
// -> <out dir>/title-<i>.mp4
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(process.env.PLAYWRIGHT_FROM ?? import.meta.url);
const { chromium } = (() => {
  try {
    return require('playwright');
  } catch {
    return require('@playwright/test');
  }
})();

const [outDir, listFile] = process.argv.slice(2).map((p) => resolve(p));
const cards = JSON.parse(readFileSync(listFile, 'utf8'));
mkdirSync(outDir, { recursive: true });
const FPS = 30;
const SECONDS = Number(process.env.TITLE_SECONDS || 4.4); // long enough to read
const ff = (...args) => execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>@import url('https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Caveat:wght@500&family=Permanent+Marker&family=Rubik+Wet+Paint&display=swap');
html,body{margin:0;background:#000;overflow:hidden}canvas{display:block}</style></head>
<body><canvas id="c" width="1920" height="1080"></canvas><script>
const W = 1920, H = 1080, c = document.getElementById('c'), g = c.getContext('2d');
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);
const off = document.createElement('canvas'); off.width = W; off.height = H; const o = off.getContext('2d');
let card = null;

window.setup = (text, effect, s) => {
  seed = s;
  // flicker: on/off spans like a failing fluorescent tube, then a hold with one stutter, then off
  const on = [];
  let t = 0.15;
  for (const [a, b] of [[0.05, 0.08], [0.06, 0.12], [0.04, 0.05], [0.1, 0.2], [0.05, 0.06]]) { const len = a + rnd() * (b - a); on.push([t, t + len]); t += len + 0.04 + rnd() * 0.09; }
  const hold = t + 1.6 + rnd() * 0.3; // steady, then one stutter, then steady until it goes out
  on.push([t, hold]);
  on.push([hold + 0.07, hold + 0.15]);
  on.push([hold + 0.21, ${SECONDS} - 0.35]);
  window.__on = on;
  card = { text, effect, drips: [], runs: [], crack: null, stain: [] };
  const chalk = effect === 'smear';
  o.clearRect(0, 0, W, H);
  if (effect === 'drip') {
    const face = window.__face || 'Rubik Wet Paint';
    // one line, or two lines split at the space nearest the middle, as large as fits
    const words = text.split(' ');
    let rows = [text];
    let size = 160;
    o.font = size + 'px "' + face + '"';
    if (o.measureText(text).width > W * 0.84 && words.length > 2) {
      let best = 1, diff = Infinity;
      for (let i = 1; i < words.length; i++) { const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length); if (d < diff) (diff = d), (best = i); }
      rows = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
    }
    const widest = () => Math.max(...rows.map((r) => o.measureText(r).width));
    while (widest() > W * 0.84 && size > 80) { size -= 6; o.font = size + 'px "' + face + '"'; }
    o.textAlign = 'center'; o.textBaseline = 'middle';
    o.fillStyle = '#a3171a';
    const lh = size * 1.12, top = H / 2 - 50 - ((rows.length - 1) * lh) / 2;
    rows.forEach((r, i) => o.fillText(r, W / 2, top + i * lh));
    card.box = { x0: W / 2 - widest() / 2, x1: W / 2 + widest() / 2, y0: top - size * 0.5, y1: top + (rows.length - 1) * lh + size * 0.5 };
    // the lowest painted pixel in each column: where paint can run from
    const img = o.getImageData(0, 0, W, H).data;
    const bottom = (x) => { for (let y = Math.min(H - 1, Math.round(card.box.y1 + size * 0.4)); y > card.box.y0; y--) if (img[(y * W + x) * 4 + 3] > 200) return y; return -1; };
    card.paint = [];
    let x = Math.round(card.box.x0 + 8);
    while (x < card.box.x1 - 8) {
      const y = bottom(x);
      if (y > 0 && rnd() < 0.55) card.paint.push({ x, y: y - 3, w: 5 + rnd() * 9, len: 25 + rnd() ** 1.6 * 300, t0: 0.5 + rnd() * 1.4, sp: 0.6 + rnd() * 0.8 });
      x += 22 + Math.round(rnd() * 40);
    }
    // ink flicked off the brush: specks and a few splashes around the words
    card.specks = [];
    for (let i = 0; i < 70; i++) {
      const sx = card.box.x0 - 60 + rnd() * (card.box.x1 - card.box.x0 + 120);
      const above = rnd() < 0.55;
      const sy = above ? card.box.y0 - 6 - rnd() ** 1.5 * size * 0.9 : card.box.y1 + 10 + rnd() ** 1.5 * size * 1.2;
      card.specks.push({ x: sx, y: sy, r: rnd() < 0.85 ? 1 + rnd() * 3.5 : 4 + rnd() * 7, k: Math.floor(rnd() * 3) });
    }
    return;
  }
  o.font = chalk ? '500 124px Caveat' : 'italic 116px "IM Fell English"';
  o.textAlign = 'center'; o.textBaseline = 'middle';
  o.fillStyle = chalk ? 'rgba(236,236,226,0.92)' : '#ece6d8';
  o.fillText(text, W / 2, H / 2);
  const m = o.measureText(text);
  card.box = { x0: W / 2 - m.width / 2, x1: W / 2 + m.width / 2, y0: H / 2 - 60, y1: H / 2 + 60 };
  // seep: drips from the top edge, and the words themselves running
  for (let i = 0; i < 16; i++) card.drips.push({ x: 60 + rnd() * (W - 120), w: 26 + rnd() * 60, len: 260 + rnd() * 760, t0: 0.1 + rnd() * 0.8, sp: 0.9 + rnd() * 1.2 });
  for (let i = 0; i < 16; i++) card.runs.push({ x: card.box.x0 + 20 + rnd() * (card.box.x1 - card.box.x0 - 40), w: 4 + rnd() * 6, len: 60 + rnd() * 260, t0: 0.8 + rnd() * 0.9 });
  // crack: a jagged line through the words, with branches
  const pts = []; let x = card.box.x0 - 260 - rnd() * 200, y = H / 2 - 260 - rnd() * 120;
  const tx = card.box.x1 + 260 + rnd() * 200, ty = H / 2 + 260 + rnd() * 120;
  for (let k = 0; k <= 24; k++) { const f = k / 24; pts.push([x + (tx - x) * f + (rnd() - 0.5) * 70, y + (ty - y) * f + (rnd() - 0.5) * 70]); }
  const branches = [];
  for (let b = 0; b < 7; b++) { const at = pts[2 + Math.floor(rnd() * 20)]; const br = [at]; let bx = at[0], by = at[1], a = rnd() * Math.PI * 2;
    for (let k = 0; k < 6; k++) { a += (rnd() - 0.5) * 0.9; bx += Math.cos(a) * (30 + rnd() * 50); by += Math.sin(a) * (30 + rnd() * 50); br.push([bx, by]); } branches.push(br); }
  card.crack = { pts, branches };
  for (let i = 0; i < 10; i++) card.stain.push({ n: 2 + Math.floor(rnd() * 6), amp: 0.02 + rnd() * 0.05, ph: rnd() * Math.PI * 2, dx: (rnd() - 0.5) * 900, dy: (rnd() - 0.5) * 420, r: 60 + rnd() * 140 });
};

function grain(t, amount) {
  const img = g.getImageData(0, 0, W, H), d = img.data; let s = Math.floor(t * 1000) + 7;
  for (let i = 0; i < d.length; i += 16) { s = (s * 1103515245 + 12345) & 0x7fffffff; const n = ((s >> 16) / 32768 - 0.5) * amount; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
}

function vignette() {
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.75)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
}

// The words appear the way a fluorescent tube comes on.
function textAlpha(t) {
  if (t < 0.12) return 0;
  if (t < 0.5) return [0.3, 0, 0.7, 0.2, 1, 0.6, 1][Math.floor((t - 0.12) / 0.055)] ?? 1;
  return 1;
}

function drip(x, top, w, len, color) {
  g.fillStyle = color; g.beginPath();
  g.moveTo(x - w / 2, top); g.lineTo(x - w * 0.35, top + len); g.arc(x, top + len, w * 0.55, Math.PI, 0, true); g.lineTo(x + w / 2, top); g.closePath(); g.fill();
}

window.frame = (t) => {
  const e = card.effect, end = ${SECONDS};
  if (e === 'drip') {
    g.fillStyle = '#030303'; g.fillRect(0, 0, W, H);
    const lit = window.__on.some(([a, b]) => t >= a && t < b);
    if (lit) {
      g.drawImage(off, 0, 0);
      g.fillStyle = '#a3171a';
      for (const p of card.specks) {
        g.beginPath();
        if (p.k === 0) g.ellipse(p.x, p.y, p.r * 1.6, p.r * 0.7, p.x % 3, 0, Math.PI * 2);
        else g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        g.fill();
      }
      for (const d of card.paint) {
        const k = clamp((t - d.t0) / (end - d.t0)) * d.sp; if (k <= 0) continue;
        const len = d.len * ease(clamp(k)) ;
        g.fillStyle = '#a3171a';
        g.fillRect(d.x - d.w / 2, d.y, d.w, len);
        g.beginPath(); g.arc(d.x, d.y + len, d.w * 0.62, 0, Math.PI * 2); g.fill();
      }
    } else if (window.__on.some(([a]) => Math.abs(t - a) < 0.05)) {
      g.globalAlpha = 0.18; g.drawImage(off, 0, 0); g.globalAlpha = 1;
    }
    vignette();
    grain(t, 20);
    return;
  }
  if (e === 'flicker') {
    g.fillStyle = '#030303'; g.fillRect(0, 0, W, H);
    const lit = window.__on.some(([a, b]) => t >= a && t < b);
    if (lit) {
      const level = 0.82 + 0.18 * Math.sin(t * 2 * Math.PI * 60) ** 2; // mains hum in the light
      g.save(); g.globalAlpha = 0.5 * level; g.filter = 'blur(18px)'; g.drawImage(off, 0, 0); g.filter = 'none';
      g.globalAlpha = level; g.drawImage(off, 0, 0); g.restore();
    } else if (window.__on.some(([a]) => Math.abs(t - a) < 0.05)) {
      g.globalAlpha = 0.12; g.drawImage(off, 0, 0); g.globalAlpha = 1; // the filament's afterglow
    }
    vignette();
    grain(t, 22);
    return;
  }
  g.fillStyle = '#040404'; g.fillRect(0, 0, W, H);
  let shake = [0, 0];
  if (e === 'crack' && t > 1.05 && t < 1.25) shake = [(rnd() - 0.5) * 22, (rnd() - 0.5) * 14];
  g.save(); g.translate(shake[0], shake[1]);
  if (e === 'stain') {
    const k = ease(clamp((t - 0.25) / 2.2));
    const shape = (cx, cy, R, scale) => { g.beginPath(); for (let i = 0; i <= 90; i++) { const th = (i / 90) * Math.PI * 2; let f = 1; for (const h of card.stain) f += h.amp * Math.sin(h.n * th + h.ph); g.lineTo(cx + Math.cos(th) * R * f * 1.9 * scale, cy + Math.sin(th) * R * f * scale); } g.closePath(); };
    const draw = (cx, cy, R, kk) => {
      if (kk <= 0) return;
      g.filter = 'blur(14px)'; shape(cx, cy, R, kk); g.fillStyle = 'rgba(58,45,24,0.55)'; g.fill();
      shape(cx, cy, R, kk * 0.7); g.fillStyle = 'rgba(40,31,17,0.5)'; g.fill();
      g.filter = 'blur(3px)'; shape(cx, cy, R, kk); g.lineWidth = 7 * kk; g.strokeStyle = 'rgba(100,76,40,0.55)'; g.stroke();
      g.filter = 'blur(5px)'; shape(cx, cy, R, kk * 0.55); g.lineWidth = 4 * kk; g.strokeStyle = 'rgba(92,70,36,0.35)'; g.stroke(); g.filter = 'none';
    };
    draw(W / 2, H / 2, 300, k);
    card.stain.slice(0, 2).forEach((h, i) => draw(W / 2 + h.dx * 0.8, H / 2 + h.dy * 0.6, h.r * 0.8, ease(clamp((t - 0.8 - i * 0.3) / 1.8))));
    g.globalAlpha = textAlpha(t); g.filter = 'blur(' + (2.2 * k).toFixed(2) + 'px)'; g.drawImage(off, 0, 0); g.filter = 'none'; g.globalAlpha = 1;
  } else if (e === 'crack' && t > 1.05) {
    // the words split along the crack
    const p = card.crack.pts;
    for (const [side, dx, dy] of [[0, -9, -7], [1, 10, 8]]) {
      g.save(); g.beginPath();
      if (side === 0) { g.moveTo(-50, -50); g.lineTo(W + 50, -50); g.lineTo(W + 50, p.at(-1)[1]); for (let k = p.length - 1; k >= 0; k--) g.lineTo(...p[k]); g.lineTo(-50, p[0][1]); }
      else { g.moveTo(-50, H + 50); g.lineTo(W + 50, H + 50); g.lineTo(W + 50, p.at(-1)[1]); for (let k = p.length - 1; k >= 0; k--) g.lineTo(...p[k]); g.lineTo(-50, p[0][1]); }
      g.closePath(); g.clip(); g.drawImage(off, dx, dy); g.restore();
    }
  } else {
    g.globalAlpha = textAlpha(t); g.drawImage(off, 0, 0); g.globalAlpha = 1;
  }
  if (e === 'crack' && t > 1.05) {
    const k = clamp((t - 1.05) / 0.12), p = card.crack.pts, n = Math.max(2, Math.ceil(p.length * k));
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [col, lw] of [['rgba(232,226,210,0.85)', 9], ['rgba(0,0,0,1)', 5]]) {
      g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(...p[0]); for (let i = 1; i < n; i++) g.lineTo(...p[i]); g.stroke();
      if (k >= 1) for (const br of card.crack.branches) { g.lineWidth = lw * 0.45; g.beginPath(); g.moveTo(...br[0]); for (const q of br.slice(1, 1 + Math.ceil(clamp((t - 1.12) / 0.3) * (br.length - 1)))) g.lineTo(...q); g.stroke(); }
    }
  }
  if (e === 'seep') {
    for (const d of card.runs) { const k = ease(clamp((t - d.t0) / 1.3)); if (k > 0) drip(d.x, card.box.y0 + 40, d.w, d.len * k, 'rgba(236,230,216,0.9)'); }
    // a murky liquid gathers along the top and runs down over everything
    const pool = 30 + 70 * ease(clamp(t / 1.6));
    g.fillStyle = 'rgba(26,30,20,0.97)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0);
    for (let x = W; x >= 0; x -= 40) g.lineTo(x, pool + Math.sin(x * 0.013 + t * 2) * 12 + Math.sin(x * 0.041) * 8);
    g.closePath(); g.fill();
    for (const d of card.drips) {
      const k = clamp((t - d.t0) / (end - d.t0)) ** 1.5 * d.sp; if (k <= 0) continue;
      const len = d.len * Math.min(1.5, k);
      drip(d.x, 0, d.w, pool + len, 'rgba(26,30,20,0.97)');
      const sheen = g.createLinearGradient(d.x - d.w / 2, 0, d.x + d.w / 2, 0);
      sheen.addColorStop(0, 'rgba(150,160,128,0)'); sheen.addColorStop(0.3, 'rgba(170,180,146,0.55)'); sheen.addColorStop(0.45, 'rgba(150,160,128,0)');
      g.fillStyle = sheen; g.fillRect(d.x - d.w / 2, 0, d.w, pool + len * 0.96);
      g.fillStyle = 'rgba(200,208,176,0.6)'; g.beginPath(); g.arc(d.x - d.w * 0.18, pool + len - d.w * 0.05, d.w * 0.12, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(170,180,146,0.35)'; g.fillRect(0, pool - 6, W, 2);
  }
  if (e === 'smear' && t > 1.0) {
    // an eraser drags across: behind it the words are dragged into chalk dust
    const k = ease(clamp((t - 1.0) / 1.1)), x = card.box.x0 - 60 + (card.box.x1 - card.box.x0 + 120) * k;
    g.save(); g.beginPath(); g.rect(0, card.box.y0 - 80, x, card.box.y1 - card.box.y0 + 160); g.clip();
    g.fillStyle = '#040404'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 7; i++) { g.globalAlpha = 0.09; g.filter = 'blur(' + (3 + i) + 'px)'; g.drawImage(off, -14 * i - 10, (i % 3) * 3); }
    g.filter = 'none'; g.globalAlpha = 1;
    for (let i = 0; i < 34; i++) { g.fillStyle = 'rgba(228,226,216,' + (0.03 + 0.05 * Math.abs(Math.sin(i * 7.3))) + ')'; g.fillRect(card.box.x0 - 70, card.box.y0 - 40 + i * 5.5, x - card.box.x0 + 70, 1.5 + (i % 3)); }
    g.restore();
    const dust = g.createLinearGradient(x - 60, 0, x + 10, 0); dust.addColorStop(0, 'rgba(230,228,220,0)'); dust.addColorStop(1, 'rgba(230,228,220,0.22)');
    g.fillStyle = dust; g.fillRect(x - 60, card.box.y0 - 50, 70, card.box.y1 - card.box.y0 + 100);
  }
  g.restore();
  vignette();
  grain(t, 26);
  if (t > end - 0.35) { g.fillStyle = 'rgba(0,0,0,' + clamp((t - (end - 0.35)) / 0.35) + ')'; g.fillRect(0, 0, W, H); }
};
</script></body></html>`;

// Each effect's sound, synthesised (no recordings): ffmpeg filter graphs, SECONDS long.
const SOUND = {
  seep: "anoisesrc=color=brown:amplitude=0.25:d=2.8,lowpass=f=160,volume=0.9[a];aevalsrc='0.35*sin(2*PI*(1300-900*mod(t,0.97))*t)*exp(-28*mod(t-0.2,0.97))*gte(t,0.6)':d=2.8[b];[a][b]amix=inputs=2:normalize=0,afade=t=in:d=0.4,afade=t=out:st=2.4:d=0.4",
  crack: "anoisesrc=color=white:amplitude=0.9:d=2.8,highpass=f=1400,volume='if(between(t,1.05,1.13),1,0)':eval=frame[a];aevalsrc='0.9*sin(2*PI*52*t)*exp(-9*(t-1.05))*gte(t,1.05)':d=2.8[b];anoisesrc=color=brown:amplitude=0.12:d=2.8,lowpass=f=200[c];[a][b][c]amix=inputs=3:normalize=0,afade=t=out:st=2.4:d=0.4",
  smear: "anoisesrc=color=pink:amplitude=0.5:d=2.8,bandpass=f=2600:width_type=o:w=1.4,volume='if(between(t,1.0,2.0),0.6+0.4*sin(2*PI*7*t),0)':eval=frame[a];anoisesrc=color=brown:amplitude=0.1:d=2.8,lowpass=f=200[c];[a][c]amix=inputs=2:normalize=0,afade=t=out:st=2.4:d=0.4",
  stain: "aevalsrc='0.22*sin(2*PI*55*t)*min(t/2,1)+0.12*sin(2*PI*82.4*t)*min(t/2.4,1)':d=2.8[a];anoisesrc=color=brown:amplitude=0.15:d=2.8,lowpass=f=300[c];[a][c]amix=inputs=2:normalize=0,afade=t=in:d=0.5,afade=t=out:st=2.4:d=0.4",
};

function flickerSound(on) {
  const lit = on.map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`).join('+');
  const clicks = on.flatMap(([a, b]) => [a, b]).map((x) => `between(t,${x.toFixed(3)},${(x + 0.018).toFixed(3)})`).join('+');
  return `aevalsrc='(0.10*sin(2*PI*120*t)+0.05*sin(2*PI*240*t)+0.03*sin(2*PI*360*t))*(0.15+0.85*min(1,${lit}))':d=${SECONDS}[h];` +
    `anoisesrc=color=white:amplitude=0.6:d=${SECONDS},highpass=f=2500,volume='min(1,${clicks})':eval=frame[c];` +
    `anoisesrc=color=brown:amplitude=0.08:d=${SECONDS},lowpass=f=200[r];[h][c][r]amix=inputs=3:normalize=0,afade=t=out:st=${SECONDS - 0.3}:d=0.3`;
}

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await tab.setContent(PAGE);
await tab.evaluate(() => Promise.all(['italic 116px "IM Fell English"', '500 124px Caveat', '170px "Permanent Marker"', '170px "Rubik Wet Paint"'].map((f) => document.fonts.load(f))));
for (const [i, cardDef] of cards.entries()) {
  const effect = ['flicker', 'drip'].includes(cardDef.effect) ? cardDef.effect : SOUND[cardDef.effect] ? cardDef.effect : 'drip';
  await tab.evaluate((f) => (window.__face = f), cardDef.face ?? process.env.TITLE_FACE ?? 'Rubik Wet Paint');
  const frames = join(outDir, `title-${i}-frames`);
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });
  await tab.evaluate(([text, eff, s]) => window.setup(text, eff, s), [cardDef.text, effect, 1234 + i * 977]);
  const n = Math.round(SECONDS * FPS);
  for (let f = 0; f < n; f++) {
    await tab.evaluate((t) => window.frame(t), f / FPS);
    await tab.screenshot({ path: join(frames, `${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 });
  }
  const out = join(outDir, `title-${i}.mp4`);
  ff('-framerate', String(FPS), '-i', join(frames, '%04d.jpg'), '-f', 'lavfi', '-t', String(SECONDS), '-i', 'anullsrc=r=48000:cl=stereo',
    '-filter_complex', `${effect === 'flicker' || effect === 'drip' ? flickerSound(await tab.evaluate(() => window.__on)) : SOUND[effect]},aformat=sample_rates=48000:channel_layouts=stereo[s]`, '-map', '0:v', '-map', '[s]',
    '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-t', String(SECONDS), out);
  rmSync(frames, { recursive: true, force: true });
  console.log('title', i, effect, cardDef.text);
}
await browser.close();
