// Fixed answers used when there is no MODEL_API_KEY, so the UI can be built and tested offline.

export const MOCK_CARDS = {
  nearest: 'Endless runner (mock)',
  why_familiar: 'Mock mode: no API key yet, so these three cards are fixed examples.',
  cards: [
    {
      title: 'Gravity on a tap',
      rule: 'Tapping flips gravity instead of jumping.',
      twist: 'The floor and ceiling both become paths.',
    },
    {
      title: 'Sound is the map',
      rule: 'The screen goes dark; obstacles only show while you hold a key, and holding costs points.',
      twist: 'Every look is a bet.',
    },
    {
      title: 'You are the level',
      rule: 'You drop the obstacles and a runner tries to survive them.',
      twist: 'Winning means making something just hard enough.',
    },
  ],
};

export const MOCK_GAME = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mock game</title>
<style>html,body{margin:0;height:100%;background:#0d1117;color:#e6edf3;font:16px system-ui;overflow:hidden}canvas{display:block}#hud{position:fixed;top:8px;left:12px}</style>
</head><body><div id="hud"></div><canvas id="c"></canvas><script>
const c = document.getElementById('c'), x = c.getContext('2d'), hud = document.getElementById('hud');
let W, H, p = null, shards = [], score = 0, best = 0, state = 'title', t = 0;
function size() { W = c.width = innerWidth; H = c.height = innerHeight; }
addEventListener('resize', size); size();
function reset() { p = { x: W * 0.25, y: H / 2, vy: 0, g: 1 }; shards = []; score = 0; t = 0; state = 'play'; }
function flip() { if (state !== 'play') return reset(); p.g *= -1; }
addEventListener('keydown', (e) => { if (e.code === 'Space') flip(); });
addEventListener('pointerdown', flip);
function end() { state = 'over'; best = Math.max(best, score); }
function step() {
  t++; if (t % 40 === 0) shards.push({ x: W + 20, y: 40 + Math.random() * (H - 80), bad: Math.random() < 0.35 });
  p.vy = (p.vy + 0.35 * p.g) * 0.98; p.y += p.vy;
  if (p.y < 12 || p.y > H - 12) end();
  const speed = 3 + score * 0.05;
  for (const s of shards) {
    s.x -= speed;
    if (Math.hypot(s.x - p.x, s.y - p.y) < 20) { s.hit = true; if (s.bad) end(); else score++; }
  }
  shards = shards.filter((s) => !s.hit && s.x > -20);
}
function draw() {
  x.fillStyle = '#0d1117'; x.fillRect(0, 0, W, H);
  for (const s of shards) { x.fillStyle = s.bad ? '#f85149' : '#3fb950'; x.beginPath(); x.arc(s.x, s.y, 9, 0, 7); x.fill(); }
  if (p) { x.fillStyle = '#e6edf3'; x.beginPath(); x.arc(p.x, p.y, 12, 0, 7); x.fill(); }
  x.fillStyle = '#e6edf3'; x.font = '16px system-ui'; x.textAlign = 'center';
  if (state === 'title') x.fillText('Mock game: tap or press Space to flip gravity. Green = points, red = out.', W / 2, H / 2);
  if (state === 'over') x.fillText('Game over. Tap to play again.', W / 2, H / 2);
  hud.textContent = 'Score ' + score + '   Best ' + best;
}
(function loop() { if (state === 'play') step(); draw(); requestAnimationFrame(loop); })();
</script></body></html>`;
